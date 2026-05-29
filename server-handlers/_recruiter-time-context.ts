/**
 * Time-of-day / day-of-week mood overlay for the recruiter persona.
 *
 * Pure functions only — no I/O, no module-scope `Date.now()`. The kernel
 * (or any caller) feeds in an ISO-8601 timestamp and gets back a small
 * mood-shift delta plus an optional opener prefix. All hour classification
 * is done in IST (`Asia/Kolkata`) regardless of `process.env.TZ`, since the
 * product is India-focused.
 */

export type TimeContext =
  | "monday-fresh"
  | "midweek-standard"
  | "friday-rush"
  | "lunch-distracted"
  | "after-hours-tired"
  | "weekend-unusual";

export interface TimeContextInput {
  /** ISO-8601 timestamp. Falls back to "midweek-standard" if undefined. */
  callTimeIso?: string;
  /** Optional override for tests; takes precedence over callTimeIso. */
  now?: Date;
}

export interface TimeMoodDelta {
  /** -2 (terse) to +2 (patient). */
  patience: number;
  /** Multiplier 0.7..1.2 applied to recruiter's max concession. */
  concessionHeadroom: number;
  replyLengthBias: "short" | "neutral" | "long";
}

/**
 * Extract { weekday, hour } in IST without depending on process TZ.
 * Uses Intl.DateTimeFormat with timeZone: "Asia/Kolkata" — the canonical
 * server-side pattern for timezone-safe extraction.
 */
function toIstParts(date: Date): { weekday: number; hour: number } {
  // weekday: "short" gives Mon/Tue/Wed/etc. We map to 0..6 (Sun..Sat) to
  // match Date.getDay() convention.
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  let weekdayStr = "";
  let hourStr = "0";
  for (const p of parts) {
    if (p.type === "weekday") weekdayStr = p.value;
    else if (p.type === "hour") hourStr = p.value;
  }
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayMap[weekdayStr] ?? 3;
  // Intl can emit "24" for midnight in some locales; normalize to 0.
  let hour = parseInt(hourStr, 10);
  if (!Number.isFinite(hour)) hour = 0;
  if (hour === 24) hour = 0;
  return { weekday, hour };
}

export function deriveTimeContext(input: TimeContextInput): TimeContext {
  const source = input.now ?? (input.callTimeIso ? new Date(input.callTimeIso) : undefined);
  if (!source || isNaN(source.getTime())) {
    return "midweek-standard";
  }
  const { weekday, hour } = toIstParts(source);

  // Weekend first — overrides everything else.
  if (weekday === 0 || weekday === 6) {
    return "weekend-unusual";
  }

  // After-hours: weekday after 19:00 or before 09:00.
  if (hour >= 19 || hour < 9) {
    return "after-hours-tired";
  }

  // Lunch window 12:00–14:00 — overrides monday-fresh on overlap.
  if (hour >= 12 && hour < 14) {
    return "lunch-distracted";
  }

  // Friday rush 16:00–18:00.
  if (weekday === 5 && hour >= 16 && hour < 18) {
    return "friday-rush";
  }

  // Monday fresh 10:00–12:00 (lunch already handled above).
  if (weekday === 1 && hour >= 10 && hour < 12) {
    return "monday-fresh";
  }

  return "midweek-standard";
}

export function timeContextToMoodDelta(ctx: TimeContext): TimeMoodDelta {
  switch (ctx) {
    case "monday-fresh":
      return { patience: 2, concessionHeadroom: 1.2, replyLengthBias: "long" };
    case "friday-rush":
      return { patience: -2, concessionHeadroom: 0.7, replyLengthBias: "short" };
    case "lunch-distracted":
      return { patience: -1, concessionHeadroom: 0.9, replyLengthBias: "short" };
    case "after-hours-tired":
      return { patience: -1, concessionHeadroom: 0.85, replyLengthBias: "short" };
    case "weekend-unusual":
      return { patience: 0, concessionHeadroom: 1.0, replyLengthBias: "neutral" };
    case "midweek-standard":
    default:
      return { patience: 0, concessionHeadroom: 1.0, replyLengthBias: "neutral" };
  }
}

/** Bank of prefixes — exported shape is internal to the module. */
const PREFIX_BANK: Partial<Record<TimeContext, string>> = {
  "friday-rush": "Quick one before EOD — ",
  "monday-fresh": "Got a fresh slot this morning, so — ",
  "lunch-distracted": "Just stepped out for a minute, but — ",
  "after-hours-tired": "Late one on my side, so — ",
};

/**
 * Returns the opener-prefix string for this context, or null if no prefix
 * applies (midweek-standard, weekend-unusual) or the text already starts
 * with any of the bank phrases (idempotency guard).
 */
export function timeContextPrefix(ctx: TimeContext, text: string): string | null {
  const prefix = PREFIX_BANK[ctx];
  if (!prefix) return null;
  // Idempotency: if `text` already begins with ANY bank phrase, no-op.
  for (const phrase of Object.values(PREFIX_BANK)) {
    if (phrase && text.startsWith(phrase)) return null;
  }
  return prefix;
}
