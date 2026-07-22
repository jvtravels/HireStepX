/* Notice period + joining bonus + buyout parser — Phase 13 (2026-05-13).
 *
 * The audit (2026-05-13) flagged that India-specific negotiation chips
 * around notice period economics — 60/90 day notices, buyout offers,
 * early-joining incentives, separate joining bonuses — had zero
 * structured handling in the kernel. The `notice-buyout` lever existed
 * but was a non-numeric soft signal; no state tracked the actual days,
 * buyout amount, or joining bonus quantum.
 *
 * Failure modes this closes:
 *   1. Candidate says "I have 90-day notice, can you buy out 60 days?".
 *      Pre-Phase-13 the kernel didn't capture the day count or the
 *      buyout ask. The LLM had to re-derive both from the conversation
 *      log each turn.
 *   2. Candidate says "I want a 5 LPA joining bonus" — pre-Phase-13
 *      this folded into the variable bucket of the component breakdown
 *      OR got lost entirely. Joining bonus is a SEPARATE chip:
 *      one-time, doesn't compound, sometimes clawback-attached.
 *   3. Candidate asks "can you release me early if you pay the buyout?"
 *      — a question the AI couldn't structurally respond to.
 *
 * Patterns are conservative — pre-numerals (e.g. "ninety day notice")
 * are normalized via the same Hinglish + word-number lexicon the
 * kernel uses elsewhere, but only the salary-range and notice-range
 * windows.
 *
 * Number normalization:
 *   - Notice: parsed as days. "2 months" / "60 days" / "90 days" all
 *     accepted; months × 30. Range 0–180 (anything outside is
 *     rejected as malformed STT).
 *   - Joining bonus: LPA-normalized (lakhs/crore/k). Bonuses < 0.5 LPA
 *     or > 100 LPA are rejected. */

export interface NoticeJoiningResult {
  /** Candidate's notice period in DAYS. Null when unstated. */
  noticePeriodDays: number | null;
  /** Did the candidate explicitly request the recruiter buy out their
   *  notice? Distinct from passively having notice — this is the ASK. */
  buyoutRequested: boolean;
  /** Joining bonus amount the candidate asked for, in LPA. Null when
   *  unstated. The recruiter side (band / move-picker) decides if the
   *  number is achievable; this just captures the ask. */
  joiningBonusAsk: number | null;
  /** Did the candidate signal a preference / hard-requirement to join
   *  earlier than their full notice? Common chip: "I can join in 30
   *  days if you can buy out the remaining notice." */
  earlyJoinPreferred: boolean;
  /** Phase 17D (2026-05-13) — Did the candidate explicitly mention
   *  clawback clauses on the joining bonus? "Is there a clawback if I
   *  leave in 12 months?" is a literacy signal AND a negotiation chip
   *  (candidate may push for reduced clawback period). */
  joiningBonusClawbackDiscussed: boolean;
  /** Phase 17D (2026-05-13) — Candidate's stated last-working-day, as
   *  a free-text phrase (not parsed to a Date — we keep it informative
   *  so the AI can quote it back). Examples: "Dec 15", "next Friday",
   *  "after my project handover". Bounded to 60 chars. */
  lastWorkingDayText: string | null;
  /** Convenience: any non-default field set. */
  hasAny: boolean;
}

const EMPTY: NoticeJoiningResult = {
  noticePeriodDays: null,
  buyoutRequested: false,
  joiningBonusAsk: null,
  earlyJoinPreferred: false,
  joiningBonusClawbackDiscussed: false,
  lastWorkingDayText: null,
  hasAny: false,
};

/* Word-number table for notice-period phrasings. Restricted to the
 * realistic notice window (30 / 45 / 60 / 90 days, or 1-3 months). */
const NOTICE_WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  thirty: 30, forty: 40, "forty-five": 45, fortyfive: 45,
  sixty: 60, ninety: 90, hundred: 100,
};

function normalizeNoticeWords(s: string): string {
  return s.replace(/\b(one|two|three|four|five|six|thirty|forty[-\s]?five|forty|sixty|ninety|hundred)\b/gi, (m) => {
    const k = m.toLowerCase().replace(/\s+/g, "-");
    const n = NOTICE_WORD_NUMBERS[k] ?? NOTICE_WORD_NUMBERS[k.replace("-", "")];
    return n != null ? String(n) : m;
  });
}

/** Extract notice-period days from candidate text. Matches:
 *    "60 day notice", "90-day notice", "2 month notice period",
 *    "notice is 30 days", "serving 60 days", "ninety day notice". */
function extractNoticeDays(text: string): number | null {
  const n = normalizeNoticeWords(text);
  /* "<num> (day|days) (notice)?" — note we also accept just "X day"
     in a notice context. */
  const dayPat = /\b(\d{1,3})\s*[-\s]?\s*(?:day|days)\s*(?:notice|period|of\s+notice)?\b/i;
  const m1 = dayPat.exec(n);
  if (m1) {
    const d = parseInt(m1[1], 10);
    if (Number.isFinite(d) && d >= 0 && d <= 365) return d;
  }
  /* "<num> month(s) notice" */
  const monthPat = /\b(\d{1,2})\s*[-\s]?\s*(?:month|months|mo|mos)\s*(?:notice|period|of\s+notice)?\b/i;
  const m2 = monthPat.exec(n);
  if (m2) {
    const months = parseInt(m2[1], 10);
    if (Number.isFinite(months) && months >= 0 && months <= 12) return months * 30;
  }
  /* "notice (period )?(is |of )?<num> (day|month)s?" */
  const notice2 = /\bnotice\s+(?:period\s+)?(?:is|of)\s+(\d{1,3})\s*(day|days|month|months|mo|mos)?\b/i;
  const m3 = notice2.exec(n);
  if (m3) {
    const v = parseInt(m3[1], 10);
    if (!Number.isFinite(v)) return null;
    const unit = (m3[2] || "day").toLowerCase();
    const d = unit.startsWith("month") || unit.startsWith("mo") ? v * 30 : v;
    if (d >= 0 && d <= 365) return d;
  }
  return null;
}

const BUYOUT_PATTERNS = [
  /\b(?:buy\s*out|buyout|bought\s+out|pay(?:ing)?\s+(?:for\s+)?(?:the\s+)?(?:notice|buyout))\b/i,
  /\bcan\s+you\s+(?:buy|cover|pay)\s+(?:my\s+)?(?:notice|out)/i,
];

const EARLY_JOIN_PATTERNS = [
  /\b(?:join\s+(?:earlier|sooner|early|immediately|right\s+away)|early\s+join(?:ing)?|join\s+in\s+\d+\s+days?|reduce\s+(?:my\s+)?notice|short(?:en)?\s+(?:my\s+)?notice|release\s+(?:me\s+)?early)\b/i,
  /* S37-B1 (2026-07-23) — "can negotiate (the notice period) to N days / months"
   * is a flexibility signal identical to "reduce notice" but wasn't matched.
   * Two patterns cover: (a) "negotiate notice/joining" (negotiate + notice noun),
   * and (b) "notice … negotiate" / "can negotiate to N days" (notice mentioned
   * earlier in the sentence, candidate offers a shorter period via "negotiate to"). */
  /\bnegotiate\s+(?:(?:my|the)\s+)?(?:notice(?:\s+period)?|joining)\b/i,
  /\bnotice\b.{0,60}\bcan\s+negotiate\b/i,
  /\bcan\s+negotiate\s+(?:it\s+)?(?:down\s+)?to\s+\d+\s*(?:days?|months?)\b/i,
];

/** Extract joining-bonus amount (LPA). Matches:
 *    "joining bonus of 5 LPA", "₹3L joining bonus", "5 lakh sign-on",
 *    "sign-on bonus 5 LPA", "signing bonus of 3 lakhs". */
function extractJoiningBonus(text: string): number | null {
  const re = /\b(?:joining\s+bonus|sign[-\s]?on\s+bonus|signing\s+bonus|sign[-\s]?on|joining\s+amount|hiring\s+bonus|welcome\s+bonus)[^.!?\n]{0,20}?₹?\s*(\d{1,3}(?:[.,]\d+)?)\s*(lpa|lakhs?|l\b|cr|crore)?/i;
  const m = re.exec(text);
  if (m) return normalizeLpa(m[1], m[2]);

  /* Reverse phrasing: "₹5L joining bonus" / "5 LPA sign-on" */
  const re2 = /₹?\s*(\d{1,3}(?:[.,]\d+)?)\s*(lpa|lakhs?|l\b|cr|crore)?\s+(?:joining\s+bonus|sign[-\s]?on(?:\s+bonus)?|signing\s+bonus|hiring\s+bonus|welcome\s+bonus)/i;
  const m2 = re2.exec(text);
  if (m2) return normalizeLpa(m2[1], m2[2]);
  return null;
}

function normalizeLpa(raw: string, unit?: string): number | null {
  const v = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(v) || v <= 0) return null;
  const u = (unit || "").toLowerCase();
  let lpa: number;
  if (u === "cr" || u === "crore") lpa = v * 100;
  else lpa = v;
  if (lpa < 0.5 || lpa > 100) return null;
  return Math.round(lpa * 10) / 10;
}

const CLAWBACK_PATTERNS = [
  /\b(?:clawback|claw\s+back|clawed\s+back|return\s+(?:the\s+)?bonus|repay(?:ment)?\s+(?:of\s+)?(?:joining|sign[-\s]?on|bonus)|tenure\s+requirement|pro[-\s]?rata\s+(?:return|repay)|joining\s+bonus\s+(?:lock|tenure))\b/i,
];

/** Last-working-day textual phrasing. We don't parse to a Date — we
 *  preserve the candidate's own phrasing so the AI can quote it
 *  naturally. Patterns match "last working day is X" / "LWD is X" /
 *  "after my project handover" / "Dec 15". The captured snippet is
 *  bounded for safety. */
function extractLastWorkingDay(text: string): string | null {
  const patterns = [
    /\b(?:last\s+working\s+day|lwd|final\s+day)\s+(?:is|will\s+be|on)?\s+([^.!?\n,]{2,40})/i,
    /\b(?:last\s+day|relieving\s+date|exit\s+date)\s+(?:is|will\s+be|on)?\s+([^.!?\n,]{2,40})/i,
  ];
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1]) {
      const snippet = m[1].trim().replace(/\s+/g, " ").slice(0, 60);
      if (snippet.length >= 2) return snippet;
    }
  }
  return null;
}

/** Parse notice-period + buyout + joining-bonus signals from a single
 *  candidate utterance. Returns EMPTY when none found. */
export function extractNoticeJoining(text: string): NoticeJoiningResult {
  if (!text) return EMPTY;
  const days = extractNoticeDays(text);
  const buyoutRequested = BUYOUT_PATTERNS.some((p) => p.test(text));
  const joiningBonusAsk = extractJoiningBonus(text);
  const earlyJoinPreferred = EARLY_JOIN_PATTERNS.some((p) => p.test(text));
  const joiningBonusClawbackDiscussed = CLAWBACK_PATTERNS.some((p) => p.test(text));
  const lastWorkingDayText = extractLastWorkingDay(text);
  const hasAny =
    days != null ||
    buyoutRequested ||
    joiningBonusAsk != null ||
    earlyJoinPreferred ||
    joiningBonusClawbackDiscussed ||
    lastWorkingDayText != null;
  return {
    noticePeriodDays: days,
    buyoutRequested,
    joiningBonusAsk,
    earlyJoinPreferred,
    joiningBonusClawbackDiscussed,
    lastWorkingDayText,
    hasAny,
  };
}

/** Merge prior + current — non-null wins (candidate can revise),
 *  booleans monotone-up (once requested, stays requested). */
export function mergeNoticeJoining(
  prior: NoticeJoiningResult | null | undefined,
  next: NoticeJoiningResult,
): NoticeJoiningResult {
  const p = prior ?? EMPTY;
  const merged: NoticeJoiningResult = {
    noticePeriodDays: next.noticePeriodDays ?? p.noticePeriodDays,
    buyoutRequested: p.buyoutRequested || next.buyoutRequested,
    joiningBonusAsk: next.joiningBonusAsk ?? p.joiningBonusAsk,
    earlyJoinPreferred: p.earlyJoinPreferred || next.earlyJoinPreferred,
    joiningBonusClawbackDiscussed:
      p.joiningBonusClawbackDiscussed || next.joiningBonusClawbackDiscussed,
    lastWorkingDayText: next.lastWorkingDayText ?? p.lastWorkingDayText,
    hasAny: false,
  };
  merged.hasAny =
    merged.noticePeriodDays != null ||
    merged.buyoutRequested ||
    merged.joiningBonusAsk != null ||
    merged.earlyJoinPreferred ||
    merged.joiningBonusClawbackDiscussed ||
    merged.lastWorkingDayText != null;
  return merged;
}
