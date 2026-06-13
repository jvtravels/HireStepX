/* Pure helpers for the calendar API handlers (PRI-35 rebuild).
 *
 * Everything here is side-effect-free and edge-safe (no Node APIs) so it can
 * be unit-tested in isolation — see src/__tests__/calendarHelpers.test.ts.
 * The handlers (calendar-save / calendar-list / calendar-delete) stay focused
 * on request plumbing and delegate all shaping + validation to these
 * functions. Mirrors the _subscription-actions.ts pattern.
 */

export const VALID_KINDS = ["real", "prep-session"] as const;
export const VALID_STATUSES = ["upcoming", "completed", "cancelled"] as const;
export const VALID_SOURCES = ["manual", "nl", "google", "prep-runway"] as const;
export const VALID_REMINDER_CHANNELS = ["email", "push"] as const;

export type CalendarKind = (typeof VALID_KINDS)[number];
export type CalendarStatus = (typeof VALID_STATUSES)[number];
export type CalendarSource = (typeof VALID_SOURCES)[number];
export type ReminderChannel = (typeof VALID_REMINDER_CHANNELS)[number];

export interface Reminder {
  channel: ReminderChannel;
  minutesBefore: number;
}

/** The DB row shape (snake_case) the save handler upserts into Supabase. */
export interface CalendarRow {
  id: string;
  user_id: string;
  title: string;
  company: string;
  date: string;
  time: string;
  type: string;
  notes: string;
  start_utc: string | null;
  end_utc: string | null;
  timezone: string;
  duration_minutes: number;
  location: string;
  status: CalendarStatus;
  kind: CalendarKind;
  parent_interview_id: string | null;
  source: CalendarSource;
  google_event_id: string | null;
  reminders: Reminder[];
  updated_at: string;
}

const DEFAULT_TIMEZONE = "Asia/Kolkata";
const MIN_DURATION = 5;
const MAX_DURATION = 1440; // 24h
const DEFAULT_DURATION = 60;
const MAX_REMINDERS = 6;
const MAX_REMINDER_MINUTES = 10080; // 1 week

/** Default reminder ladder when a client sends `reminders: true` (legacy boolean). */
export const DEFAULT_REMINDERS: Reminder[] = [
  { channel: "email", minutesBefore: 1440 }, // 1 day
  { channel: "email", minutesBefore: 30 },
];

export function asString(v: unknown, max = 500): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max).trim();
}

export function clampDuration(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return DEFAULT_DURATION;
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, Math.round(v)));
}

/** Accept a plausible IANA zone ("Area/Location" or "UTC"); otherwise default.
 *  We intentionally don't ship the full tz database to the edge — this is a
 *  shape guard, not a registry lookup. The browser supplies a real zone. */
export function sanitizeTimezone(v: unknown): string {
  if (typeof v !== "string") return DEFAULT_TIMEZONE;
  const tz = v.trim();
  if (tz === "UTC") return "UTC";
  if (/^[A-Za-z]+(?:[_-][A-Za-z]+)*\/[A-Za-z]+(?:[_+\-/][A-Za-z0-9]+)*$/.test(tz) && tz.length <= 64) {
    return tz;
  }
  return DEFAULT_TIMEZONE;
}

/** Parse an ISO-8601 instant. Returns a normalized ISO string or null. */
export function parseInstant(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  const ms = Date.parse(v);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

function isEnumMember<T extends readonly string[]>(list: T, v: unknown): v is T[number] {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}

/** Normalize the reminders field. Accepts the legacy boolean, an array of
 *  {channel, minutesBefore}, or junk — always returns a clean, capped array. */
export function normalizeReminders(v: unknown): Reminder[] {
  if (v === true) return [...DEFAULT_REMINDERS];
  if (v === false || v == null) return [];
  if (!Array.isArray(v)) return [];
  const out: Reminder[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (!isEnumMember(VALID_REMINDER_CHANNELS, o.channel)) continue;
    const mins = o.minutesBefore;
    if (typeof mins !== "number" || !Number.isFinite(mins)) continue;
    const minutesBefore = Math.max(0, Math.min(MAX_REMINDER_MINUTES, Math.round(mins)));
    // de-dupe identical channel+offset pairs
    if (out.some((r) => r.channel === o.channel && r.minutesBefore === minutesBefore)) continue;
    out.push({ channel: o.channel, minutesBefore });
    if (out.length >= MAX_REMINDERS) break;
  }
  return out;
}

/** Derive authoritative start/end instants. Prefers a client-sent UTC instant
 *  (the browser knows the real zone). Falls back to composing the legacy
 *  date+time strings into a best-effort instant when no start_utc is given. */
export function deriveTimes(
  body: Record<string, unknown>,
  durationMinutes: number,
): { start_utc: string | null; end_utc: string | null } {
  let start = parseInstant(body.start_utc);
  if (!start) {
    // Legacy fallback for clients that didn't send an explicit instant. We
    // append "Z" so the naive wall-clock string is interpreted as UTC
    // deterministically — never the server's local zone, which would make the
    // result depend on where the edge function happened to run. The browser is
    // expected to send start_utc (it knows the real IANA zone); this path is
    // only a best-effort for old/degraded clients.
    const date = asString(body.date, 32);
    const time = asString(body.time, 16);
    if (date) start = parseInstant(`${date}T${time || "00:00"}:00Z`);
  }
  if (!start) return { start_utc: null, end_utc: null };

  const explicitEnd = parseInstant(body.end_utc);
  if (explicitEnd && Date.parse(explicitEnd) > Date.parse(start)) {
    return { start_utc: start, end_utc: explicitEnd };
  }
  const end = new Date(Date.parse(start) + durationMinutes * 60_000).toISOString();
  return { start_utc: start, end_utc: end };
}

export type NormalizeResult =
  | { ok: true; row: CalendarRow }
  | { ok: false; error: string };

/** Validate + normalize an inbound calendar event into a DB row.
 *  `id` and `updated_at` are supplied by the caller (server-generated) so this
 *  stays deterministic and testable. */
export function normalizeCalendarEvent(
  body: unknown,
  ctx: { userId: string; id: string; updatedAt: string },
): NormalizeResult {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid event body" };
  const b = body as Record<string, unknown>;

  const title = asString(b.title, 200);
  if (!title) return { ok: false, error: "Event title is required" };

  const date = asString(b.date, 32);
  const start = parseInstant(b.start_utc);
  if (!date && !start) return { ok: false, error: "Event needs a date or start time" };

  const kind: CalendarKind = isEnumMember(VALID_KINDS, b.kind) ? b.kind : "real";
  const status: CalendarStatus = isEnumMember(VALID_STATUSES, b.status) ? b.status : "upcoming";
  const source: CalendarSource = isEnumMember(VALID_SOURCES, b.source) ? b.source : "manual";

  const duration = clampDuration(b.duration ?? b.duration_minutes);
  const { start_utc, end_utc } = deriveTimes(b, duration);

  const parentRaw = asString(b.parent_interview_id, 64);
  // A prep-session must hang off a real interview; a real event never has a parent.
  const parent_interview_id = kind === "prep-session" && parentRaw ? parentRaw : null;

  return {
    ok: true,
    row: {
      id: ctx.id,
      user_id: ctx.userId,
      title,
      company: asString(b.company, 200),
      date: date || (start_utc ? start_utc.slice(0, 10) : ""),
      time: asString(b.time, 16),
      type: asString(b.type, 64) || "interview",
      notes: asString(b.notes, 4000),
      start_utc,
      end_utc,
      timezone: sanitizeTimezone(b.timezone),
      duration_minutes: duration,
      location: asString(b.location, 500),
      status,
      kind,
      parent_interview_id,
      source,
      google_event_id: asString(b.google_event_id, 256) || null,
      reminders: normalizeReminders(b.reminders),
      updated_at: ctx.updatedAt,
    },
  };
}
