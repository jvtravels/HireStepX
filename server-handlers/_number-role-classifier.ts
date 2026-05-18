/* Number-role classifier (PDF#30 architectural pass, 2026-05-18).
 *
 * ─── Why this module exists ────────────────────────────────────────
 *
 * Five session-replay PDFs in a row (#19, #20, #27, #29, #30) all
 * surfaced the same shape of bug: a candidate disclosed a salary
 * number, the parser missed it, the bot re-probed for the same fact.
 * Every fix added one more `RegExp` to a 60+-alternative bank in
 * `parseCandidateAnswer`. That stack has three properties we don't
 * want:
 *
 *   1. Alternative ordering is invisible — alt-N can shadow alt-N+1
 *      and the only way to know is a failing replay test.
 *   2. Cues for current/target/competing are interleaved across
 *      patterns; you can't read the answer to "what makes this a
 *      target vs a current?" from any single place.
 *   3. Adding a phrasing means writing a new RegExp from scratch and
 *      praying it doesn't false-positive against another role.
 *
 * This module reverses all three. Numbers in the utterance are
 * tokenized once. Each number is then scored against three role-
 * specific cue tables (current / target / competing). The
 * highest-scoring role wins. When no cue is present, the sentence-
 * level context decides (lastAiText asked? phase = probe-expectations?).
 *
 * Adding a new phrasing now means appending one row to a cue table
 * and one row to the test fixture. No new RegExp alternative; no risk
 * of shadowing.
 *
 * ─── Contract ──────────────────────────────────────────────────────
 *
 *   classifyNumberRoles(text, ctx) returns
 *     { currentCtc, target, competing, targetAsRange }
 *
 *   where each numeric field is in LPA (lakhs per annum). USD ($150k,
 *   $120,000) is converted at 83 INR/USD — same constant the legacy
 *   `extractUsdAmount` used, so behaviour matches existing fixtures.
 *
 * ─── What this module deliberately does NOT do ─────────────────────
 *
 *   - Acceptance / walk-away detection (lives in
 *     `_acceptance-classifier`).
 *   - Component breakdown ("₹12L fixed, ₹6L variable") — handled by
 *     `extractComponentBreakdown` in the kernel; that parser needs the
 *     total CTC context which is orthogonal to role classification.
 *   - Notice period days, equity vesting years, work-mode flags —
 *     each has its own structured extractor.
 *   - Range upper-bound binding for current-CTC (`"earning 25-28
 *     LPA"`) is supported. Bare range with no role cue is treated as
 *     target only when phase context permits.
 *
 * Pure. No clock, no IO.
 */

/* ─── Type surface ─────────────────────────────────────────────────── */

export type NumberRole = "current" | "target" | "competing";

export interface NumberRoleContext {
  /** Bot's previous utterance — used to detect "AI asked for current
   *  CTC" so a bare reply binds via Gricean cooperation. */
  lastAiText?: string;
  /** Current negotiation phase. When the bot is in probe-expectations
   *  AND the candidate replies with a bare number, the default role
   *  is `target` (the bot just asked for it). */
  phase?: string;
}

export interface NumberRoleResult {
  currentCtc: number | null;
  target: number | null;
  competing: number | null;
  /** True when the bound `target` (or `currentCtc`) came from a
   *  range pattern (`"30-35 LPA"`); the upper bound is what we
   *  bound, but downstream code uses this to render "you mentioned
   *  a range". */
  targetAsRange: boolean;
}

/* ─── Constants ────────────────────────────────────────────────────── */

const USD_TO_INR = 83;
/* Window sizes for left/right cue search around each number span.
 * 40 chars before the number captures typical "I am currently
 * earning around ₹..." phrasings without crossing sentence boundaries.
 * 25 chars after captures trailing qualifiers ("...24 LPA CTC
 * overall right now"). */
const LEFT_WINDOW = 40;
const RIGHT_WINDOW = 25;
/* Output sanity clamp (also enforced by the kernel's `clampInr`).
 * Anything outside [1, 5000] LPA is implausible for an Indian
 * salary disclosure and is rejected at the classifier boundary. */
const MIN_LPA = 1;
const MAX_LPA = 5000;

/* ─── Cue tables ───────────────────────────────────────────────────── */

/**
 * Each cue is a small RegExp that captures ONE phrasing the candidate
 * (or recruiter, in the case of `lastAiText`) uses to mark a number's
 * role. Cues are evaluated against a fixed window of text on either
 * side of the number span; the role with the most cue hits wins.
 *
 * Adding coverage:
 *   1. Add the phrasing to the matching role array below.
 *   2. Add a fixture row to `pdf30NumberClassifier.test.ts`.
 *   3. Run the test. No other changes needed.
 *
 * Do NOT add cues that overlap roles (e.g. don't put `\bctc\b` here —
 * "ctc" is a unit qualifier, both current and target candidates say
 * it; role comes from the verb/noun cue, not the unit).
 */

interface CueTable {
  /** Cues that appear BEFORE the number ("expecting 30 LPA"). */
  left: RegExp[];
  /** Cues that appear AFTER the number ("30 LPA chahiye"). */
  right: RegExp[];
}

const CURRENT_CUES: CueTable = {
  left: [
    /\bcurrent(?:ly)?\b/i,
    /\bmy\s+(?:current\s+)?(?:[a-z]+\s+){0,3}(?:package|salary|ctc|comp(?:ensation)?|pay|fitment|fixed|total)\b/i,
    /\bi\s+(?:make|earn|get|draw)\b/i,
    /\bi.?m\s+at\b/i,
    /\b(?:earning|drawing|making|getting|take\s+home)\b/i,
    /\btold\s+you(?:\s+(?:already|multiple\s+times|before|many\s+times))?\b/i,
    /\b(?:as|like)\s+i\s+(?:said|mentioned|stated|told\s+you)\b/i,
    /\bpackage\s+progression\b/i,
    /\b(?:said|mentioned)\s+(?:already\s+)?/i,
  ],
  right: [
    /^\s*(?:lpa|lakhs?|lacs?|l|cr|crore)\s+ctc\b(?!\s+(?:expectation|target|expect|range))/i,
    /^\s*(?:lpa|lakhs?|lacs?|l|cr|crore)\s+ctc\s+(?:overall|total|annual|right\s+now|presently|at\s+present)/i,
  ],
};

const TARGET_CUES: CueTable = {
  left: [
    /\bexpect(?:ing|ed)?\b/i,
    /\bwant(?:ing)?\b/i,
    /\blooking\s+for\b/i,
    /\btarget\b/i,
    /\bhoping(?:\s+for)?\b/i,
    /\baim(?:ing)?\s+for\b/i,
    /\bwould\s+like\b/i,
    /\bi.?d\s+like\b/i,
    /\banchor(?:ing)?(?:\s+(?:around|at|on|between))?\b/i,
    /\bcomfortable\s+with\b/i,
    /\bsettle\s+for\b/i,
    /\bmujhe\b/i,
    /\bmera\s+target\b/i,
    /\basking\b/i,
    /\bneed\b/i,
    /\bbetween\b/i,
  ],
  right: [
    /\bchahiye\b/i,
    /\bka\s+package\b/i,
    /\bmil\s+jaye\b/i,
    /\bmilna\s+chahiye\b/i,
    /\bexpect\s+kar(?:ta|ti)\s+hu\b/i,
    /\bchahta\s+hu\b/i,
    /\bchahti\s+hu\b/i,
  ],
};

const COMPETING_CUES: CueTable = {
  left: [
    /\bcompeting\s+offer(?:\s+(?:of|at))?\b/i,
    /\banother\s+offer(?:\s+(?:of|at))?\b/i,
    /\banother\s+opportunity(?:\s+(?:of|at))?\b/i,
    /\bother\s+offers?\b/i,
    /\boffer\s+(?:of|at)\b/i,
    /\bin[-\s]?hand(?:\s+offer)?(?:\s+(?:of|at))?\b/i,
    /\balready\s+have\b/i,
    /\breceived\s+(?:an?\s+)?offer\b/i,
    /\bgot\s+an?\s+offer(?:\s+(?:of|at))?\b/i,
    /\bmultiple\s+offers?\b/i,
  ],
  right: [],
};

/** Sentence-level cue: did the bot's last turn explicitly ask for the
 *  candidate's current CTC? When yes, an unqualified number in the
 *  candidate's reply binds to `current` (Gricean cooperation). */
const LAST_AI_ASKED_CURRENT_CTC = new RegExp(
  [
    String.raw`\bcurrent(?:ly)?\s+(?:total\s+)?(?:annual\s+)?ctc\b`,
    String.raw`\btotal\s+(?:annual\s+)?ctc\b`,
    String.raw`\bwhat.?s\s+your\s+(?:current\s+)?(?:total\s+)?(?:annual\s+)?ctc\b`,
    String.raw`\bctc\s+at\s+(?:present|the\s+moment)\b`,
    String.raw`\bpresent\s+ctc\b`,
    String.raw`\byour\s+(?:current\s+)?package\b`,
  ].join("|"),
  "i",
);

/* ─── Number-span finder ───────────────────────────────────────────── */

/** A salary-shaped number found in the utterance. */
interface SalarySpan {
  /** Value normalized to LPA (crore × 100, USD-k via FX). */
  value: number;
  /** [start, end) character offsets into the input text. */
  start: number;
  end: number;
  /** True when this span is the upper bound of a `X-Y` / `X to Y`
   *  range pattern. The lower bound is dropped — recruiter framing
   *  binds the candidate's ceiling. */
  isRangeUpper: boolean;
}

/** LPA-shaped salary number: `[₹]? digits [LPA|lakhs|L|cr|crore]`.
 *  Allows zero whitespace between digit and unit ("24LPA"). */
const LPA_NUM_RE =
  /(?:^|[^a-z0-9])(₹?\s*)([\d,]+(?:\.\d+)?)\s*(lpa|lakhs?|lacs?|l|cr|crore)\b/gi;

/** USD-shaped salary number: `$NNNk` / `$NNN,NNN`. */
const USD_NUM_RE =
  /(?:^|[^a-z0-9])\$\s*([\d,]+(?:\.\d+)?)\s*(k|K)?\b/g;

/** Range pattern — matches `30-35 LPA` / `30 to 35 lakhs` / `₹30 – ₹35 LPA`.
 *  Used to mark the upper-bound number as `isRangeUpper`. */
const RANGE_RE =
  /(₹?\s*)([\d,]+(?:\.\d+)?)\s*(?:[-–—]|to)\s*(₹?\s*)([\d,]+(?:\.\d+)?)\s*(lpa|lakhs?|lacs?|l|cr|crore)\b/gi;

/** Units that should make us SKIP a numeric match — these are not
 *  salary disclosures. `\d+ days`, `\d+ years`, `\d+%`, `\d+ PF`. */
const NON_SALARY_UNIT_RE =
  /(\d[\d,.]*)\s*(?:%|days?\b|months?\b|years?\b|yrs?\b|percent\b|pf\b|hours?\b|hrs?\b|members?\b|people\b|reports?\b|yoe\b)/i;

function parseDigits(s: string): number {
  return parseFloat(s.replace(/,/g, ""));
}

function unitMultiplier(unit: string): number {
  const u = unit.toLowerCase();
  return u === "cr" || u === "crore" ? 100 : 1;
}

/** Scan the text and return every salary-shaped number, in left-to-right
 *  order. Ranges are emitted as a single `isRangeUpper` span (the lower
 *  bound is dropped). USD spans are converted to LPA at the FX boundary. */
function findSalarySpans(text: string): SalarySpan[] {
  const spans: SalarySpan[] = [];
  /* Pass 1 — ranges. Mark the upper bound, claim both numbers' offsets. */
  const claimedRanges = new Set<string>(); // "start-end" of digits we've claimed
  for (const m of text.matchAll(RANGE_RE)) {
    if (m.index == null) continue;
    const upper = parseDigits(m[4]);
    const unit = m[5];
    if (!Number.isFinite(upper)) continue;
    const value = upper * unitMultiplier(unit);
    if (value < MIN_LPA || value > MAX_LPA) continue;
    const start = m.index + m[0].search(/[\d₹]/);
    const end = m.index + m[0].length;
    spans.push({ value, start, end, isRangeUpper: true });
    claimedRanges.add(`${m.index}-${end}`);
  }
  /* Pass 2 — non-range LPA numbers. */
  for (const m of text.matchAll(LPA_NUM_RE)) {
    if (m.index == null) continue;
    /* Skip if this span sits inside a previously-claimed range. */
    const innerStart = m.index + m[0].search(/[\d₹]/);
    const innerEnd = m.index + m[0].length;
    const overlapping = [...claimedRanges].some((k) => {
      const [s, e] = k.split("-").map(Number);
      return innerStart >= s && innerEnd <= e;
    });
    if (overlapping) continue;
    /* Reject if matched text is actually a non-salary unit token. */
    const left = Math.max(0, m.index - 10);
    const windowText = text.slice(left, innerEnd + 10);
    if (NON_SALARY_UNIT_RE.test(windowText) && !/(?:lpa|lakhs?|lacs?|\bl\b|cr|crore)/i.test(m[0])) {
      continue;
    }
    const digits = parseDigits(m[2]);
    if (!Number.isFinite(digits)) continue;
    const value = digits * unitMultiplier(m[3]);
    if (value < MIN_LPA || value > MAX_LPA) continue;
    spans.push({ value, start: innerStart, end: innerEnd, isRangeUpper: false });
  }
  /* Pass 3 — USD. Converted to LPA via fixed FX (matches legacy
   * `extractUsdAmount` behaviour). */
  for (const m of text.matchAll(USD_NUM_RE)) {
    if (m.index == null) continue;
    let usd = parseDigits(m[1]);
    if (!Number.isFinite(usd)) continue;
    if (/k/i.test(m[2] || "")) usd *= 1000;
    if (usd < 10_000 || usd > 5_000_000) continue;
    const lpa = Math.round((usd * USD_TO_INR) / 100_000 * 10) / 10;
    if (lpa < MIN_LPA || lpa > MAX_LPA) continue;
    const innerStart = m.index + m[0].indexOf("$");
    const innerEnd = m.index + m[0].length;
    spans.push({ value: lpa, start: innerStart, end: innerEnd, isRangeUpper: false });
  }
  /* Pass 4 — bare integers preceded by a strong anchor/target cue.
   *  Candidates often drop the unit when the verb already carries the
   *  role ("the anchor I had in mind was around 28"). We only emit a
   *  span when an `anchor` / `target` / `expecting` cue fires inside
   *  the immediate left window AND the integer falls in the plausible
   *  LPA target range [5, 100]. NON_SALARY_UNIT_RE near the digit kills
   *  the match (28 days, 28%, 28 years). */
  const BARE_INT_RE = /(?:^|[^\d.,])(\d{1,3})\b/g;
  const TARGET_CUE_PRESENCE = /\b(?:anchor(?:ing)?|target|expect(?:ing|ed)?|hoping|aim(?:ing)?|looking\s+for|would\s+like|i.?d\s+like|asking|comfortable\s+with|settle\s+for)\b/i;
  const POSITIONAL_OPENER_AT_END = /(?:\b(?:around|about|at|of|near|like|maybe|is|was|to)\s+|\b(?:anchor(?:ing)?|target|expect(?:ing|ed)?|hoping(?:\s+for)?|aim(?:ing)?\s+for|looking\s+for|would\s+like|i.?d\s+like|asking)\s+(?:around\s+|about\s+|at\s+|of\s+)?)$/i;
  const SALARY_UNIT_NEARBY = /[\d,.]\s*(?:lpa|lakhs?|lacs?|cr|crore|\bl\b)/i;
  for (const m of text.matchAll(BARE_INT_RE)) {
    if (m.index == null) continue;
    const digitStart = m.index + m[0].search(/\d/);
    const digitEnd = digitStart + m[1].length;
    if (spans.some((s) => digitStart >= s.start && digitEnd <= s.end)) continue;
    const n = parseDigits(m[1]);
    if (!Number.isFinite(n) || n < 5 || n > 100) continue;
    const leftWindow = text.slice(Math.max(0, digitStart - LEFT_WINDOW), digitStart);
    if (!TARGET_CUE_PRESENCE.test(leftWindow)) continue;
    if (!POSITIONAL_OPENER_AT_END.test(leftWindow)) continue;
    const nearby = text.slice(Math.max(0, digitStart - 5), Math.min(text.length, digitEnd + 20));
    if (NON_SALARY_UNIT_RE.test(nearby)) continue;
    /* If a salary unit (LPA / lakh / crore) follows this integer, it
     * was already considered by Pass 2 — either claimed or rejected by
     * the clamp. Don't second-guess. */
    const rightTail = text.slice(digitEnd, Math.min(text.length, digitEnd + 25));
    if (SALARY_UNIT_NEARBY.test(m[1] + rightTail)) continue;
    spans.push({ value: n, start: digitStart, end: digitEnd, isRangeUpper: false });
  }
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

/* ─── Per-number role classification ───────────────────────────────── */

/** Score how strongly each role's cues match the window around a span.
 *  Score = number of distinct cue patterns that hit. Ties resolved by
 *  preference order: current > competing > target (current has the
 *  strongest cue specificity — verb / "my" / "told you"). */
function scoreRolesForSpan(
  text: string,
  span: SalarySpan,
): Record<NumberRole, number> {
  let leftWindow = text.slice(Math.max(0, span.start - LEFT_WINDOW), span.start);
  /* Clause clipping: when an earlier salary disclosure sits in the
   * window ("18 LPA and I'd like 32 LPA"), cues before it belong to
   * that number, not this span. Truncate the window to start AFTER
   * the last such disclosure or clause boundary. */
  const PRIOR_DISCLOSURE = /[\d,.]+\s*(?:lpa|lakhs?|lacs?|cr|crore|\bl\b)\b/gi;
  let lastEnd = -1;
  for (const m of leftWindow.matchAll(PRIOR_DISCLOSURE)) {
    if (m.index != null) lastEnd = Math.max(lastEnd, m.index + m[0].length);
  }
  if (lastEnd >= 0) leftWindow = leftWindow.slice(lastEnd);
  const rightWindow = text.slice(span.end, Math.min(text.length, span.end + RIGHT_WINDOW));
  const scoreOne = (cues: CueTable): number => {
    let n = 0;
    for (const re of cues.left) if (re.test(leftWindow)) n++;
    for (const re of cues.right) if (re.test(rightWindow)) n++;
    return n;
  };
  return {
    current: scoreOne(CURRENT_CUES),
    target: scoreOne(TARGET_CUES),
    competing: scoreOne(COMPETING_CUES),
  };
}

/** Pick the winning role for a span, or null if no cue fired and
 *  sentence context doesn't break the tie. */
function pickRole(
  scores: Record<NumberRole, number>,
  ctx: NumberRoleContext,
  span: SalarySpan,
  text: string,
): NumberRole | null {
  const max = Math.max(scores.current, scores.target, scores.competing);
  if (max > 0) {
    /* Tie-break order: current > competing > target. Empirically the
     * highest-precision cue family (current — verb / "my" / "told
     * you") should win when multiple roles fire on the same span. */
    if (scores.current === max) return "current";
    if (scores.competing === max) return "competing";
    return "target";
  }
  /* No explicit cue. Sentence-level defaults:
   *   - Bot just asked for current CTC → bare number = current.
   *   - Phase is probe-expectations and no current/competing cue
   *     anywhere in the sentence → bare number = target. */
  const aiAskedCurrent = !!ctx.lastAiText && LAST_AI_ASKED_CURRENT_CTC.test(ctx.lastAiText);
  if (aiAskedCurrent) {
    /* Defensive gate: don't let a bare number bind to current when the
     * sentence as a whole carries a competing cue ("offer of 24 LPA"
     * after the bot asked "current CTC?" — that's still competing). */
    const competingAnywhere = COMPETING_CUES.left.some((r) => r.test(text)) ||
      COMPETING_CUES.right.some((r) => r.test(text));
    const targetAnywhere = TARGET_CUES.left.some((r) => r.test(text)) ||
      TARGET_CUES.right.some((r) => r.test(text));
    if (!competingAnywhere && !targetAnywhere) return "current";
  }
  if (ctx.phase === "probe-expectations") {
    const currentAnywhere = CURRENT_CUES.left.some((r) => r.test(text));
    const competingAnywhere = COMPETING_CUES.left.some((r) => r.test(text));
    if (!currentAnywhere && !competingAnywhere) return "target";
  }
  /* Mark unused for lint quiet — `span` is part of the signature so
   * future scoring rules (e.g. position-aware) can extend without
   * touching call sites. */
  void span;
  return null;
}

/* ─── Aggregator ───────────────────────────────────────────────────── */

/** Main entry point. Returns the role-bound numbers for the utterance.
 *
 *  Algorithm:
 *    1. Find every salary-shaped number span (LPA / USD; range upper).
 *    2. Classify each span's role via cue scoring + context defaults.
 *    3. For each role, pick the FIRST classified number. (Candidates
 *       sometimes disclose two numbers of the same role in one
 *       sentence — "current is 18, expecting 26"; both end up
 *       classified correctly because the cue windows are local.)
 *    4. Drop a number if it's bound to multiple roles (shouldn't
 *       happen after scoring, but defence-in-depth).
 *    5. `targetAsRange` is true when ANY salary span is a range upper
 *       AND a target was bound. */
export function classifyNumberRoles(
  text: string,
  ctx: NumberRoleContext = {},
): NumberRoleResult {
  if (!text || !text.trim()) {
    return { currentCtc: null, target: null, competing: null, targetAsRange: false };
  }
  const spans = findSalarySpans(text);
  if (spans.length === 0) {
    return { currentCtc: null, target: null, competing: null, targetAsRange: false };
  }
  let currentCtc: number | null = null;
  let target: number | null = null;
  let competing: number | null = null;
  let currentFromRange = false;
  let targetFromRange = false;
  for (const span of spans) {
    const scores = scoreRolesForSpan(text, span);
    const role = pickRole(scores, ctx, span, text);
    if (role == null) continue;
    if (role === "current" && currentCtc == null) {
      currentCtc = span.value;
      currentFromRange = span.isRangeUpper;
    } else if (role === "target" && target == null) {
      target = span.value;
      targetFromRange = span.isRangeUpper;
    } else if (role === "competing" && competing == null) {
      competing = span.value;
    }
  }
  /* Disambiguation: a single number shouldn't be both current and
   * target. If they collide, drop target (current's cue specificity
   * is higher; the bare-number-after-probe-expectations default is
   * the more likely false positive). */
  if (target != null && (target === currentCtc || target === competing)) {
    target = null;
    targetFromRange = false;
  }
  const targetAsRange = targetFromRange || (target != null && currentFromRange === false && spans.some((s) => s.isRangeUpper));
  return {
    currentCtc,
    target,
    competing,
    targetAsRange: target != null ? targetAsRange : false,
  };
}
