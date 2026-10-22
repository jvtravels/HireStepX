/* Miscellaneous candidate-side scalar signals — Phase 17F (2026-05-13).
 *
 * Four single-purpose extractors gathered into one module because each
 * is too small to warrant its own file but together they close
 * meaningful gaps in the 19-scenario audit:
 *
 *   - candidateFloor (Scenario 4): the candidate's stated MINIMUM
 *     acceptable number, distinct from their target/expected ask.
 *     Real candidates often give "my floor is X, my ideal is Y" — the
 *     legacy kernel folded only Y into `candidateTarget` and lost X.
 *
 *   - salaryReviewMonths (Scenario 3): "can we review salary after 6
 *     months?" is a common India-market chip when the recruiter can't
 *     match the ask up front. Captures the months the candidate is
 *     willing to wait for a review cycle.
 *
 *   - proofOfCtcRequested (Scenario 5): when the recruiter has asked
 *     for salary slips / offer letter / proof-of-CTC. The candidate
 *     side may explicitly acknowledge or decline ("I can share slips"
 *     vs "I'd prefer not to share documents"). We capture the
 *     acknowledgement as a boolean.
 *
 *   - internalCounterRisk (Scenario 14): the candidate's signal about
 *     their current employer's retention behaviour — "I haven't asked
 *     internally yet", "they've offered me a hike to stay", "I've
 *     turned down their counter". Materially affects how aggressive
 *     the AI should be on joining-bonus / start-date.
 *
 * All four are conservative — false positives would silently teach the
 * kernel constraints the candidate didn't state. */

export type InternalCounterRisk =
  /** Candidate has asked their current employer for a raise / counter. */
  | "asked"
  /** Candidate has received a retention/counter-offer from current employer. */
  | "received"
  /** Candidate has explicitly rejected the internal counter. */
  | "rejected";

export interface MiscSignalsResult {
  /** Stated absolute minimum acceptable CTC (LPA). Distinct from
   *  target. Null when unstated. */
  candidateFloor: number | null;
  /** Months candidate is willing to wait for a salary review. Range
   *  1–24. Null when unstated. */
  salaryReviewMonths: number | null;
  /** Candidate has signalled willingness to share CTC proof (slips,
   *  offer letter). Null when unstated; true when affirmative; false
   *  when explicit refusal. */
  proofOfCtcShareable: boolean | null;
  /** Internal counter-offer dynamics. Null when unstated. */
  internalCounterRisk: InternalCounterRisk | null;
  /** Convenience flag. */
  hasAny: boolean;
}

const EMPTY: MiscSignalsResult = {
  candidateFloor: null,
  salaryReviewMonths: null,
  proofOfCtcShareable: null,
  internalCounterRisk: null,
  hasAny: false,
};

/* Floor phrasings: "my floor is X", "minimum acceptable X", "won't go
 * below X", "lowest I can do X", "lower bound X". LPA-only. Verbs
 * (is / would be / acceptable at) are optional so "floor 20 LPA"
 * and "minimum 20 lakhs" both bind. */
const FLOOR_PATTERNS = [
  /\b(?:my\s+)?(?:floor|minimum|min|lowest|lower\s+bound|absolute\s+(?:floor|minimum)|rock\s+bottom)\s+(?:(?:is|would\s+be|acceptable|acceptable\s+is|acceptable\s+at)\s+)?₹?\s*(\d{1,3}(?:[.,]\d+)?)\s*(lpa|lakhs?|l\b|cr|crore)?/i,
  /* OA-B16 (2026-07-17): "shouldn't" modal + "less than"/"under" comparator
   * added. Third-party-relayed floors ("my wife says I shouldn't accept less
   * than ₹70L") previously extracted NO floor — the modal/comparator gap, not a
   * family-stall misclassification. The co-required ₹N digit keeps it tight so
   * digit-less hypotheticals ("shouldn't accept less than market") never bind. */
  /\b(?:won.?t|wouldn.?t|shouldn.?t|should\s+not|can.?t|cannot)\s+(?:go|accept|consider|come\s+down|settle|settle\s+for|take)\s+(?:below|under|less\s+than|lower\s+than)\s+₹?\s*(\d{1,3}(?:[.,]\d+)?)\s*(lpa|lakhs?|l\b|cr|crore)?/i,
  /\blowest\s+(?:i\s+can\s+do|i.?d\s+(?:accept|consider)|acceptable)\s+(?:(?:is|would\s+be)\s+)?₹?\s*(\d{1,3}(?:[.,]\d+)?)\s*(lpa|lakhs?|l\b|cr|crore)?/i,
  /\bpractical\s+(?:lower\s+)?range\s+(?:(?:is|of|around)\s+)?₹?\s*(\d{1,3}(?:[.,]\d+)?)\s*(lpa|lakhs?|l\b|cr|crore)?/i,
];

function normalizeLpa(raw: string, unit?: string): number | null {
  const v = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(v) || v <= 0) return null;
  const u = (unit || "").toLowerCase();
  let lpa: number;
  if (u === "cr" || u === "crore") lpa = v * 100;
  else lpa = v;
  if (lpa < 1 || lpa > 5000) return null;
  return Math.round(lpa * 10) / 10;
}

function extractFloor(text: string): number | null {
  for (const re of FLOOR_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const n = normalizeLpa(m[1], m[2]);
      if (n != null) return n;
    }
  }
  return null;
}

/* "review after 6 months", "salary review in 12 months", "revisit
 * compensation at 6-month mark", "review at month 6". */
const REVIEW_PATTERNS = [
  /\b(?:salary|compensation|comp|pay|ctc)\s+review\s+(?:after|in|at)\s+(\d{1,2})\s+(?:month|mo|months|mos)\b/i,
  /\breview\s+(?:my\s+)?(?:salary|compensation|comp|pay|ctc)\s+(?:after|in|at)\s+(\d{1,2})\s+(?:month|mo|months|mos)\b/i,
  /\brevisit\s+(?:compensation|salary|comp)\s+(?:after|in|at)\s+(\d{1,2})\s+(?:month|mo|months|mos)\b/i,
  /\b(?:after|in)\s+(\d{1,2})\s+(?:month|mo|months|mos)\s+review\b/i,
  /\breview\s+(?:after|in|at)\s+(\d{1,2})\s+(?:month|mo|months|mos)\b/i,
];

function extractReviewMonths(text: string): number | null {
  for (const re of REVIEW_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const v = parseInt(m[1], 10);
      if (Number.isFinite(v) && v >= 1 && v <= 24) return v;
    }
  }
  /* "6-month review" alone */
  const concise = /\b(\d{1,2})[-\s]?month\s+(?:salary\s+)?review\b/i.exec(text);
  if (concise) {
    const v = parseInt(concise[1], 10);
    if (Number.isFinite(v) && v >= 1 && v <= 24) return v;
  }
  return null;
}

const PROOF_AFFIRM_PATTERNS = [
  /\b(?:can\s+(?:share|provide|send|forward)\s+(?:my\s+)?(?:salary\s+)?slips?|happy\s+to\s+share\s+(?:the\s+)?(?:salary\s+)?(?:slips?|proof|offer\s+letter|documents?)|will\s+share\s+(?:the\s+)?(?:slips?|proof|documents?)|i.?ll\s+send\s+(?:the\s+)?(?:slips?|proof))\b/i,
];

const PROOF_REFUSE_PATTERNS = [
  /\b(?:prefer\s+not\s+to\s+share\s+(?:(?:salary\s+)?slips?|documents?|proof)|won.?t\s+share\s+(?:(?:salary\s+)?slips?|documents?)|company\s+policy.*(?:slips?|documents?|proof)|confidential.*(?:slips?|documents?))\b/i,
];

function extractProofShareable(text: string): boolean | null {
  if (PROOF_AFFIRM_PATTERNS.some((p) => p.test(text))) return true;
  if (PROOF_REFUSE_PATTERNS.some((p) => p.test(text))) return false;
  return null;
}

const COUNTER_RECEIVED_PATTERNS = [
  /\b(?:they(?:.?ve)?\s+(?:offered|gave|extended)\s+(?:me\s+)?(?:a\s+)?(?:counter|hike|raise|retention)|current\s+(?:employer|company)\s+(?:has\s+)?(?:offered|gave|extended)|received\s+(?:a\s+)?counter[-\s]?offer)\b/i,
];

const COUNTER_REJECTED_PATTERNS = [
  /\b(?:(?:turned\s+down|declined|rejected|refused)\s+(?:the\s+|their\s+)?(?:counter[-\s]?offer|retention|internal\s+offer)|not\s+(?:taking|accepting)\s+(?:their|the)\s+counter|already\s+(?:turned\s+down|said\s+no)\s+(?:to\s+)?(?:their|the)\s+counter)\b/i,
];

const COUNTER_ASKED_PATTERNS = [
  /\b(?:asked\s+(?:for\s+)?(?:a\s+)?(?:counter|raise|hike|retention)\s+(?:internally|at\s+(?:my\s+)?current)|spoke\s+to\s+(?:my\s+)?(?:manager|hr)\s+about\s+(?:a\s+)?(?:raise|counter)|raised\s+(?:the\s+)?(?:topic\s+of\s+)?(?:counter|raise)\s+with\s+(?:my\s+)?(?:manager|current))\b/i,
];

function extractCounterRisk(text: string): InternalCounterRisk | null {
  /* Precedence: rejected > received > asked. A "rejected" statement is
   * the strongest signal because the candidate is closing off retention
   * risk. */
  if (COUNTER_REJECTED_PATTERNS.some((p) => p.test(text))) return "rejected";
  if (COUNTER_RECEIVED_PATTERNS.some((p) => p.test(text))) return "received";
  if (COUNTER_ASKED_PATTERNS.some((p) => p.test(text))) return "asked";
  return null;
}

export function extractMiscSignals(text: string): MiscSignalsResult {
  if (!text) return EMPTY;
  const candidateFloor = extractFloor(text);
  const salaryReviewMonths = extractReviewMonths(text);
  const proofOfCtcShareable = extractProofShareable(text);
  const internalCounterRisk = extractCounterRisk(text);
  const hasAny =
    candidateFloor != null ||
    salaryReviewMonths != null ||
    proofOfCtcShareable != null ||
    internalCounterRisk != null;
  return { candidateFloor, salaryReviewMonths, proofOfCtcShareable, internalCounterRisk, hasAny };
}

export function mergeMiscSignals(
  prior: MiscSignalsResult | null | undefined,
  next: MiscSignalsResult,
): MiscSignalsResult {
  const p = prior ?? EMPTY;
  /* Floor: shorter / lower wins (the candidate may revise down, which
   * is the tightest constraint). But the move-picker only uses the
   * latest non-null statement — so last-stated-wins. */
  const merged: MiscSignalsResult = {
    candidateFloor: next.candidateFloor ?? p.candidateFloor,
    salaryReviewMonths: next.salaryReviewMonths ?? p.salaryReviewMonths,
    proofOfCtcShareable: next.proofOfCtcShareable ?? p.proofOfCtcShareable,
    internalCounterRisk: next.internalCounterRisk ?? p.internalCounterRisk,
    hasAny: false,
  };
  merged.hasAny =
    merged.candidateFloor != null ||
    merged.salaryReviewMonths != null ||
    merged.proofOfCtcShareable != null ||
    merged.internalCounterRisk != null;
  return merged;
}
