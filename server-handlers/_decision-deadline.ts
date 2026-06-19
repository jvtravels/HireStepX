/* Decision-deadline + conditional-accept parser — Phase 17A (2026-05-13).
 *
 * The audit (post-Phase-16 review against 19 negotiation scenarios)
 * surfaced two adjacent candidate-side signals that the kernel did
 * NOT capture:
 *
 *   1. Decision deadline — "I need to respond by Friday", "they want
 *      an answer by EOD", "I have 48 hours". Real recruiters always
 *      probe "what's your deadline?" because it sets the pace of
 *      counter-offers. Pre-Phase-17 the AI couldn't internalize
 *      candidate-side urgency.
 *
 *   2. Conditional acceptance — "if you match 30 LPA, I'll sign
 *      today", "if you cover the buyout, I'm in". The legacy
 *      `signalsAcceptance` boolean would fire on these, which was
 *      WRONG — a conditional commit is not an unconditional accept;
 *      the AI should respond to the CONDITION, not close the deal.
 *
 * This module is conservative. Conditional patterns require both an
 * `if/when/provided` clause AND a commitment idiom in the same
 * utterance (decoupled from `signalsAcceptance` so the kernel can
 * downgrade: when `conditionalAcceptance=true`, treat as a structured
 * offer-to-trade rather than a yes). */

export interface DecisionDeadlineResult {
  /** Days until candidate's stated deadline. 0 means "today". Null
   *  when unstated. Range 0–60 (anything outside is rejected as STT
   *  noise — real negotiation deadlines rarely exceed a month). */
  deadlineDays: number | null;
  /** Did the candidate explicitly state a deadline at all (even if
   *  the day count is fuzzy)? Lets the LLM probe for specificity. */
  deadlineExplicit: boolean;
  /** Did the candidate make a conditional acceptance offer? Distinct
   *  from unconditional accept — the AI should respond to the
   *  CONDITION, not just close. */
  conditionalAcceptance: boolean;
  /** Brief evidence snippet (≤120 chars) of the conditional clause —
   *  e.g. "if you match 30 LPA, I'll sign today". */
  conditionalEvidence: string | null;
  /** Convenience flag. */
  hasAny: boolean;
}

const EMPTY: DecisionDeadlineResult = {
  deadlineDays: null,
  deadlineExplicit: false,
  conditionalAcceptance: false,
  conditionalEvidence: null,
  hasAny: false,
};

/* Weekday → "days from now" assuming a Monday baseline. The kernel
 * doesn't know the current weekday, so we use a heuristic midweek
 * value (3) for "by Friday" / "Monday" mentions. The day-count is
 * informative-only — the move-picker uses it for pacing, not as a
 * legal calendar. */
const WEEKDAY_DAYS: Record<string, number> = {
  today: 0,
  tonight: 0,
  tomorrow: 1,
  monday: 3, tuesday: 3, wednesday: 3, thursday: 4, friday: 4,
  saturday: 5, sunday: 6,
};

const DEADLINE_EXPLICIT_PATTERNS = [
  /\b(?:deadline|by\s+(?:eod|end\s+of\s+(?:day|week))|need(?:s)?\s+(?:to\s+)?(?:respond|answer|decide)|have\s+to\s+(?:respond|decide)|response\s+by|answer\s+by|decide\s+by)\b/i,
  /\b(?:offer\s+expires|offer\s+(?:is\s+)?valid|valid\s+(?:until|till)|expires\s+(?:on|by))\b/i,
];

/* "X day(s)" / "X hour(s)" / "X week(s)" with deadline context. */
const NUMERIC_DEADLINE_PATTERNS = [
  /\b(?:in|within|have)\s+(\d{1,2})\s+(day|days|hour|hours|hr|hrs|week|weeks)\b/i,
  /\b(\d{1,2})\s+(day|days|hour|hours|hr|hrs|week|weeks)\s+(?:to\s+(?:respond|decide|answer)|deadline|window)\b/i,
];

const WEEKDAY_DEADLINE_PATTERNS = [
  /\b(?:by|before|on|this|next)\s+(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  /\b(?:respond|decide|answer|need)\s+(?:by|before)\s+(today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
];

/* Commitment idioms that close the conditional ("if X, <commitment>").
 * Live-staging 2026-06-19 (Razorpay PM, #94): a candidate who frames the
 * conditional as "...that works for me" / "...I can make that work" /
 * "...that's acceptable" was NOT detected (only sign/accept/deal idioms
 * were listed). The conditional acceptance went invisible, so the planner
 * kept arguing the candidate's STALE opening anchor instead of engaging
 * the concrete near-offer number — a divert, exactly the failure mode we
 * forbid. These "soft-commit" idioms are the most common Indian-candidate
 * phrasing for "yes, on that condition". extractConditional still requires
 * a CONDITIONAL_CLAUSE ("if/when/provided/…") to co-occur, so a bare
 * "that works" with no condition does NOT trip this — keeping false
 * positives near zero. */
const COMMITMENT_IDIOM = /\b(?:i.?ll\s+(?:sign|accept|take\s+it|join|come\s+on\s+board)|i.?m\s+in|count\s+me\s+in|sign\s+today|accept\s+today|close\s+(?:this\s+)?today|done\s+deal|deal\b|sold\b|i.?d\s+(?:sign|accept|take)|will\s+(?:sign|accept|join)|that\s+works(?:\s+for\s+me)?|works\s+for\s+me|i\s+can\s+(?:make\s+(?:that|it)\s+work|live\s+with\s+that|work\s+with\s+that)|that.?s\s+acceptable|that.?(?:d|ll)\s+work|i.?d\s+be\s+(?:comfortable|fine|okay|ok)\s+with\s+that|happy\s+with\s+that|i.?d\s+take\s+that|we.?(?:ve|re)\s+(?:got\s+a\s+deal|good))\b/i;

const CONDITIONAL_CLAUSE = /\b(?:if|when|provided|as\s+long\s+as|on\s+condition|contingent\s+on|subject\s+to|once\s+you)\b/i;

function extractDeadlineDays(text: string): number | null {
  for (const re of NUMERIC_DEADLINE_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const n = parseInt(m[1], 10);
      const unit = m[2].toLowerCase();
      if (!Number.isFinite(n)) continue;
      let days: number;
      if (unit.startsWith("hour") || unit.startsWith("hr")) {
        /* <24h → 0 day (today); 24–48h → 1; etc. */
        days = Math.max(0, Math.round(n / 24));
      } else if (unit.startsWith("week")) {
        days = n * 7;
      } else {
        days = n;
      }
      if (days >= 0 && days <= 60) return days;
    }
  }
  for (const re of WEEKDAY_DEADLINE_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const key = m[1].toLowerCase();
      const d = WEEKDAY_DAYS[key];
      if (d != null) return d;
    }
  }
  /* "EOD" / "end of day" → 0 */
  if (/\b(?:eod|end\s+of\s+(?:the\s+)?day)\b/i.test(text)) return 0;
  /* "end of week" → 4 (Friday mid-week heuristic) */
  if (/\bend\s+of\s+(?:the\s+)?week\b/i.test(text)) return 4;
  return null;
}

function extractConditional(text: string): string | null {
  if (!CONDITIONAL_CLAUSE.test(text)) return null;
  if (!COMMITMENT_IDIOM.test(text)) return null;
  /* Try to slice from the conditional cue through the commitment, or
   * vice-versa, whichever ordering matched. Bound to 120 chars. */
  const condIdx = text.search(CONDITIONAL_CLAUSE);
  const commitIdx = text.search(COMMITMENT_IDIOM);
  if (condIdx < 0 || commitIdx < 0) return null;
  const start = Math.max(0, Math.min(condIdx, commitIdx));
  const end = Math.min(text.length, Math.max(condIdx, commitIdx) + 40);
  return text.slice(start, end).trim().slice(0, 120);
}

export function extractDecisionDeadline(text: string): DecisionDeadlineResult {
  if (!text) return EMPTY;

  const deadlineDays = extractDeadlineDays(text);
  const deadlineExplicit =
    deadlineDays != null ||
    DEADLINE_EXPLICIT_PATTERNS.some((p) => p.test(text));

  const conditionalEvidence = extractConditional(text);
  const conditionalAcceptance = conditionalEvidence != null;

  const hasAny =
    deadlineDays != null ||
    deadlineExplicit ||
    conditionalAcceptance;

  return {
    deadlineDays,
    deadlineExplicit,
    conditionalAcceptance,
    conditionalEvidence,
    hasAny,
  };
}

export function mergeDecisionDeadline(
  prior: DecisionDeadlineResult | null | undefined,
  next: DecisionDeadlineResult,
): DecisionDeadlineResult {
  const p = prior ?? EMPTY;
  /* Deadline: shorter wins (the tightest constraint matters). Booleans
   * monotone-up except `conditionalAcceptance` which is last-stated-wins
   * because a candidate can withdraw the condition by restating
   * unconditionally. We keep the most recent evidence snippet. */
  const mergedDays =
    next.deadlineDays != null && p.deadlineDays != null
      ? Math.min(next.deadlineDays, p.deadlineDays)
      : next.deadlineDays ?? p.deadlineDays;

  const merged: DecisionDeadlineResult = {
    deadlineDays: mergedDays,
    deadlineExplicit: p.deadlineExplicit || next.deadlineExplicit,
    conditionalAcceptance: next.conditionalAcceptance,
    conditionalEvidence: next.conditionalEvidence ?? p.conditionalEvidence,
    hasAny: false,
  };
  merged.hasAny =
    merged.deadlineDays != null ||
    merged.deadlineExplicit ||
    merged.conditionalAcceptance;
  return merged;
}
