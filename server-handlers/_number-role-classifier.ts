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

import { substituteEnglishNumbers } from "./_fact-parser";

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
  /** Audit Fix (2026-05-19) — Component scope of the bound `target`.
   *  - `"total"` (default) when the candidate framed it as the whole
   *    package ("expecting ₹32 LPA total").
   *  - `"fixed"` when the candidate explicitly tagged the target as a
   *    fixed/base/basic component ("target is ₹26 LPA fixed at
   *    minimum"). The kernel routes fixed-scoped targets to a separate
   *    `candidateTargetFixed` field so a fixed-component target does
   *    NOT overwrite a previously stated total target.
   *  - `null` when no target was bound. */
  targetComponent: "total" | "fixed" | null;
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
    /* AUDIT-2 follow-up (2026-06-08): role-token between "I'm" and "at"
     * — "I'm a SE3 at Myntra, 24 LPA". The bare `\bi.?m\s+at\b` cue
     * requires adjacency; the role token ("a SE3") breaks it. Surfaced
     * by role-mismatch-needs-clarify scenario. REQUIRES the indefinite
     * article (a/an) as the lead — without it "I'm anchored at 30 LPA"
     * and "I'm targeting at least 30 LPA" would also match and steal
     * the bind from target-cue. With "an?" the pattern only fires on
     * noun-phrase role tokens. */
    /\bi.?m\s+an?\s+(?:[a-z0-9]+\s+){0,3}at\s+\w/i,
    /\b(?:earning|drawing|making|getting|take\s+home)\b/i,
    /\btold\s+you(?:\s+(?:already|multiple\s+times|before|many\s+times))?\b/i,
    /\b(?:as|like)\s+i\s+(?:said|mentioned|stated|told\s+you)\b/i,
    /\bpackage\s+progression\b/i,
    /\b(?:said|mentioned)\s+(?:already\s+)?/i,
    /* PARSER-1 (2026-06-08): "Total CTC is N LPA" is a very common
     * candidate phrasing in long sessions (EVAL-6 long-horizon-
     * trajectory T2). The pre-existing `my ... ctc` cue requires a
     * possessive pronoun; bare "Total CTC is..." was binding nothing,
     * leaving current-ctc null past turn 2. */
    /\btotal\s+(?:ctc|package|comp(?:ensation)?|pay)\b/i,
  ],
  right: [
    /^\s*(?:lpa|lakhs?|lacs?|l|cr|crore)\s+ctc\b(?!\s+(?:expectation|target|expect|range))/i,
    /^\s*(?:lpa|lakhs?|lacs?|l|cr|crore)\s+ctc\s+(?:overall|total|annual|right\s+now|presently|at\s+present)/i,
    /* AUDIT-2 (2026-06-08): the "X LPA total." compact disclosure cue
     * lives in the LAST_AI_ASKED_*-style fall-through layer in pickRole
     * (see SENTENCE_FINAL_TOTAL_RE below), NOT here in CURRENT_CUES.
     * Adding it as a right-cue tied with target-verb left-cues
     * ("I'm looking for 60 LPA total.") and current incorrectly won the
     * tiebreak. The fall-through layer only fires when nothing else
     * scored, which preserves both: S3 "Razorpay, 20 LPA total." binds
     * to current (no other cue fires) AND PDF30 "I'm looking for 60
     * LPA total." binds to target (target left-cue wins outright). */
  ],
};

const TARGET_CUES: CueTable = {
  left: [
    /* PDF #45 fix (2026-05-22) — the prior `expect(?:ing|ed)?` form
     * required a word boundary right after `expect`, which the noun
     * forms "expectation" / "expectations" fail (the `a` after `expect`
     * is a word char). User-reported Flipkart transcript: candidate
     * said "my expectation is 46 LPA CTC" → target field stayed null
     * → discoveryChecklist.targetAnswered stayed false → planner
     * probed target twice more after disclosure → loop, then session
     * died. */
    /\bexpect(?:ing|ed|ation|ations|s)?\b/i,
    /\bwant(?:ing)?\b/i,
    /\blooking\s+for\b/i,
    /\btarget(?:ing|ed|s)?\b/i,
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
    /* Counter-movement frames (live-staging, 2026-06-17). After the
     * recruiter anchors an offer, candidates counter by asking to MOVE a
     * component toward a number — "can we get the fixed closer to 28",
     * "push the base to 30", "bring it up to 32". These carry no classic
     * target verb (expect/want/looking-for) yet are unambiguous counters:
     * the verb-of-motion + a destination number IS the ask. Without these
     * the bare-integer (Pass 4) and unit-bearing paths both scored zero
     * target cues, the counter fell through to a content-free
     * answer-direct deflection, and the negotiation could never close. */
    /\bcloser\s+to\b/i,
    /\bpush(?:\s+\w+){0,3}\s+(?:to|up|closer|towards?)\b/i,
    /\bbump(?:\s+\w+){0,3}\s+(?:to|up)\b/i,
    /\bbring(?:\s+\w+){0,3}\s+(?:to|up|closer|towards?)\b/i,
    /\bmove(?:\s+\w+){0,3}\s+(?:to|up|closer|towards?)\b/i,
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

/** AUDIT-2 (2026-06-08): symmetric companion. Did the bot's last turn
 *  ask for the candidate's TARGET / expectation? Bare-number replies
 *  to a target probe should bind to `target`, not fall through to
 *  phase-default. Surfaced by bare-number-reply-in-probe scenario
 *  whose target probe ("What's your target for this move?") wasn't
 *  recognized because no symmetric pattern existed. */
const LAST_AI_ASKED_TARGET = new RegExp(
  [
    String.raw`\bwhat.?s\s+your\s+(?:target|expectation|ask|expected|number)\b`,
    String.raw`\b(?:target|expectation|expected\s+ctc)\s+for\s+this\s+(?:move|role)\b`,
    String.raw`\byour\s+(?:target|expectation|expected\s+ctc)\b`,
    String.raw`\bhow\s+much\s+(?:are\s+you\s+)?(?:looking|expecting|targeting|asking)\b`,
    String.raw`\bwhat\s+(?:are\s+you|number\s+are\s+you)\s+(?:looking\s+for|targeting|expecting)\b`,
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

/** Voice-STT robustness (2026-05-22): mirror the same `lp[a-z]` near-miss
 *  tolerance the shared `_fact-parser.ts` adopted. Indian candidates
 *  spell "L-P-A" out loud and Sarvam / Azure STT regularly mis-transcribe
 *  the trailing vowel ("LPE", "LPI", "LPO", "LPU") or close consonant
 *  ("LPS", "LPP"). The unit shape `[Dd]igits + LP[A-Z]` is unambiguous
 *  in the Indian-HR register; accept the whole family as LPA so the
 *  role-classifier mirrors the fact-parser. */
const SALARY_UNIT_GROUP = "(lpa|lp[a-z]|lakhs?|lacs?|lacks|lax|l|cr|crore|cash)";

/** LPA-shaped salary number: `[₹]? digits [LPA|lakhs|L|cr|crore]`.
 *  Allows zero whitespace between digit and unit ("24LPA"). */
const LPA_NUM_RE = new RegExp(
  `(?:^|[^a-z0-9])(₹?\\s*)([\\d,]+(?:\\.\\d+)?)\\s*${SALARY_UNIT_GROUP}\\b`,
  "gi",
);

/** USD-shaped salary number: `$NNNk` / `$NNN,NNN`. */
const USD_NUM_RE =
  /(?:^|[^a-z0-9])\$\s*([\d,]+(?:\.\d+)?)\s*(k|K)?\b/g;

/** Range pattern — matches `30-35 LPA` / `30 to 35 lakhs` / `₹30 – ₹35 LPA`.
 *  Used to mark the upper-bound number as `isRangeUpper`. */
const RANGE_RE = new RegExp(
  `(₹?\\s*)([\\d,]+(?:\\.\\d+)?)\\s*(?:[-–—]|to)\\s*(₹?\\s*)([\\d,]+(?:\\.\\d+)?)\\s*${SALARY_UNIT_GROUP}\\b`,
  "gi",
);

/** Units that should make us SKIP a numeric match — these are not
 *  salary disclosures. `\d+ days`, `\d+ years`, `\d+%`, `\d+ PF`. */
const NON_SALARY_UNIT_RE =
  /(\d[\d,.]*)\s*(?:%|days?\b|months?\b|years?\b|yrs?\b|percent\b|pf\b|hours?\b|hrs?\b|members?\b|people\b|reports?\b|yoe\b)/i;

/* Per-month periodicity (2026-06-15, unbiased-review HIGH). The classifier
 * normalizes every salary span to LPA (lakhs per ANNUM). A figure quoted PER
 * MONTH ("2.4 lakh per month") must be annualized (× 12) or it under-counts
 * by ~12× and silently false-accepts. Periodicity is decided PER SPAN by the
 * span's OWN trailing context — never the whole utterance — so a mixed
 * sentence ("I make 18 LPA now, I want 2.4 lakh per month") annualizes only
 * the per-month figure and leaves the explicitly-annual one untouched. */
const MONTHLY_SPAN_TRAIL_RE = /\b(?:per\s+month|a\s+month|monthly|per\s+mo|\/\s*month)\b/i;
/* A span whose OWN matched text already carries an annual unit (LPA / the
 * STT LP[a-z] family / per annum) is annual by construction — never apply the
 * monthly multiplier to it, even if a stray "per month" trails (contradictory
 * phrasing; annual wins).
 *
 * No leading \b: the unit abuts the digits in the no-whitespace form ("24LPA",
 * which LPA_NUM_RE explicitly supports), where "4"→"L" is not a word boundary
 * and a leading \b would silently miss it — re-allowing a ×12 inflation of an
 * explicitly-annual figure. This RE is tested only against the narrow span
 * substring (digits + unit), so dropping the boundary cannot match a unit
 * embedded in an unrelated word. */
const ANNUAL_UNIT_IN_SPAN_RE = /(?:lpa|lp[a-z]|per\s+annum|annual(?:ly)?|p\.?\s?a\.?)\b/i;

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
  /* Counter-movement frames (live-staging, 2026-06-17) — see the matching
   * note in TARGET_CUES above. "closer to", "push/bump/bring/move ... to/up"
   * mark a bare integer as a counter destination ("get the fixed closer to
   * 28") so Pass 4 emits the span; "to be N" is the positional opener for
   * "I'd like the fixed component to be 28". */
  /* Inflection alignment (live-staging, 2026-06-17): these two gate
   * regexes hardcoded bare "target"/"expect", so `\btarget\b` failed to
   * match the inflected "targeting" — "I was really targeting 28 fixed"
   * (bare integer, no LPA unit) emitted no span and the counter vanished.
   * Mirror the inflected forms already used in TARGET_CUES.left so the
   * Pass-4 gate and the scored cue table stay in sync. */
  const TARGET_CUE_PRESENCE = /\b(?:anchor(?:ing)?|target(?:ing|ed|s)?|expect(?:ing|ed|ation|ations|s)?|hoping|aim(?:ing)?|looking\s+for|would\s+like|i.?d\s+like|asking|comfortable\s+with|settle\s+for|closer\s+to|push|bump|bring|move)\b/i;
  const POSITIONAL_OPENER_AT_END = /(?:\b(?:around|about|at|of|near|like|maybe|is|are|was|were|be|to)\s+|\b(?:to\s+be|closer\s+to|up\s+to)\s+|\b(?:anchor(?:ing)?|target(?:ing|ed|s)?|expect(?:ing|ed|ation|ations|s)?|hoping(?:\s+for)?|aim(?:ing)?\s+for|looking\s+for|would\s+like|i.?d\s+like|asking)\s+(?:around\s+|about\s+|at\s+|of\s+)?)$/i;
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
  /* Per-span monthly annualization. For each span, search the text from its
   * end up to the next span's start (capped at +20 chars so "₹2.4L in hand
   * per month" still attributes, but a later number's "per month" cannot
   * bleed back). Skip spans whose own unit is explicitly annual. */
  for (let i = 0; i < spans.length; i++) {
    const sp = spans[i];
    if (ANNUAL_UNIT_IN_SPAN_RE.test(text.slice(sp.start, sp.end))) continue;
    const nextStart = i + 1 < spans.length ? spans[i + 1].start : text.length;
    const win = text.slice(sp.end, Math.min(nextStart, sp.end + 20));
    if (MONTHLY_SPAN_TRAIL_RE.test(win)) {
      sp.value = Math.round(sp.value * 12 * 10) / 10;
    }
  }
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
  /* AUDIT-2 (2026-06-08): symmetric — bot asked target → bare = target. */
  const aiAskedTarget = !!ctx.lastAiText && LAST_AI_ASKED_TARGET.test(ctx.lastAiText);
  if (aiAskedTarget) {
    const competingAnywhere = COMPETING_CUES.left.some((r) => r.test(text)) ||
      COMPETING_CUES.right.some((r) => r.test(text));
    const currentAnywhere = CURRENT_CUES.left.some((r) => r.test(text));
    if (!competingAnywhere && !currentAnywhere) return "target";
  }
  if (ctx.phase === "probe-expectations") {
    const currentAnywhere = CURRENT_CUES.left.some((r) => r.test(text));
    const competingAnywhere = COMPETING_CUES.left.some((r) => r.test(text));
    if (!currentAnywhere && !competingAnywhere) return "target";
  }
  /* AUDIT-2 (2026-06-08): "X LPA total." compact-disclosure fall-through.
   * Runs ONLY when nothing else scored. Tests the right window post-LPA
   * for sentence-final "total" with punctuation, e.g. "Razorpay, 20 LPA
   * total." → current. Placed after all other fall-throughs so target-
   * verb left-cues ("I'm looking for 60 LPA total.") win outright via
   * the cue table before this fires. */
  {
    const right = text.slice(span.end, Math.min(text.length, span.end + 25));
    if (/^\s*total\s*[.!?,]/i.test(right)) {
      const targetAnywhere = TARGET_CUES.left.some((r) => r.test(text));
      const competingAnywhere = COMPETING_CUES.left.some((r) => r.test(text));
      if (!targetAnywhere && !competingAnywhere) return "current";
    }
  }
  /* AUDIT-2 follow-up (2026-06-08): considered adding an opening-phase
   * fall-through (bare-number → current) for "Razorpay, 18 LPA." style
   * cold-opens, but it regressed salary-inflation-history which opens
   * with parenthesized career history ("started at TCS (4 LPA), moved
   * to Flipkart (12 LPA)…") — the fall-through bound 4 as current via
   * first-wins, blocking the real 30 LPA later disclosure. Better-
   * specific signal needed before re-enabling. Deferred. */
  /* Mark unused for lint quiet — `span` is part of the signature so
   * future scoring rules (e.g. position-aware) can extend without
   * touching call sites. */
  void span;
  return null;
}

/* ─── Negation guard ──────────────────────────────────────────────────
 *
 * QUALITY-2 (EVAL-5): "Not 30 LPA, that's too high" was binding 30
 * as target via the bare-number-in-probe-expectations default. Real
 * candidates use negation to REJECT a number a recruiter floated;
 * binding it as their target is exactly the wrong inference.
 *
 * Tight 15-char left window so we don't false-trigger on distant
 * negation in a long sentence. "less than" / "below" / "under"
 * between the negation and the number invert intent ("not less than
 * 30 LPA" = "at least 30 LPA") — those keep the number bindable. */
const NEGATION_LEFT_PATTERNS = [
  /\bnot\b[^.,;]{0,12}$/i,
  /\bno\b[^.,;]{0,12}$/i,
  /\bnever\b[^.,;]{0,12}$/i,
  /\bwon['']?t\b[^.,;]{0,15}$/i,
  /\bwouldn['']?t\b[^.,;]{0,15}$/i,
  /\bshouldn['']?t\b[^.,;]{0,15}$/i,
  /\bcouldn['']?t\b[^.,;]{0,15}$/i,
  /\bnahi(?:n)?\b[^.,;]{0,12}$/i,
];

const NEGATION_INVERTERS = [
  /\bless\s+than\b/i,
  /\bbelow\b/i,
  /\bunder\b/i,
  /\blower\s+than\b/i,
  /\bse\s+kam\b/i, // hindi: "se kam" = "less than"
];

function isNegatedSpan(text: string, span: SalarySpan): boolean {
  const NEGATION_WINDOW = 25;
  const leftWindow = text.slice(Math.max(0, span.start - NEGATION_WINDOW), span.start);
  const hasNegation = NEGATION_LEFT_PATTERNS.some((re) => re.test(leftWindow));
  if (!hasNegation) return false;
  // Inverter between negation and number ("not LESS THAN 30") flips
  // intent back to "at least 30" — bindable.
  const hasInverter = NEGATION_INVERTERS.some((re) => re.test(leftWindow));
  return !hasInverter;
}

/* ─── Equity-scope guard (L1 / PRI-50, 2026-06-17) ────────────────────
 *
 * A number explicitly framed as equity/RSU/ESOP/stock is NOT a CTC,
 * target, or competing-offer figure — it's an equity component, captured
 * separately by extractComponentBreakdown / extractEquityVesting. Without
 * this guard a bundled discovery answer like "RSUs worth roughly 3 LPA a
 * year. My notice is 60 days." fell through pickRole's bot-asked-current
 * default and bound 3 as currentCtc, OVERWRITING the real currentCtc (22)
 * from the prior turn. The kernel then saw current-CTC change 22→3 and
 * fired a spurious contradiction-callout (lever acknowledge-and-recover) —
 * which, pre-Gap-C, killed the session with a 400. Even post-Gap-C it's a
 * wrong "you contradicted yourself" call-out on a non-contradiction.
 *
 * Deliberately narrow: this only suppresses spans that scored ZERO
 * role cues (so an explicit "my current CTC is 24 LPA with equity" keeps
 * binding 24 to current via its scored cue) AND have an equity keyword in
 * a tight window adjacent to the number. */
const EQUITY_SPAN_CUES = [
  /\b(?:rsu|esop)s?\b/i,
  /\bequity\b/i,
  /\bstock(?:\s+(?:options?|units?|grants?|awards?))?\b/i,
  /\brestricted\s+stock\b/i,
  /\bshares\b/i,
];
function isEquityScopedSpan(text: string, span: SalarySpan): boolean {
  const EQUITY_WINDOW = 30;
  const leftWindow = text.slice(Math.max(0, span.start - EQUITY_WINDOW), span.start);
  const rightWindow = text.slice(span.end, Math.min(text.length, span.end + EQUITY_WINDOW));
  const window = `${leftWindow} ${rightWindow}`;
  return EQUITY_SPAN_CUES.some((re) => re.test(window));
}

/* Stronger form: an equity keyword sitting IMMEDIATELY before the number
 * ("stock worth 5", "5 in RSUs" → "RSUs" right-adjacent is excluded here;
 * this is left-only) scopes the number to equity even when a current cue
 * ALSO fired ("I get stock worth 5 LPA" — "I get" is a current cue but the
 * 5 is the stock value, not CTC). Left-only + tight window so a trailing
 * "24 LPA with equity on top" keeps binding 24 to current. */
const EQUITY_LEFT_ADJACENT = [
  /\b(?:rsu|esop)s?\s+(?:worth|of|at|around|roughly|about)?\s*$/i,
  /\bequity\s+(?:worth|of|at|is|around|roughly|about)?\s*$/i,
  /\bstock(?:\s+(?:options?|units?|grants?|awards?))?\s+(?:worth|of|at|around|roughly|about)?\s*$/i,
  /\bshares\s+(?:worth|of|at|around|roughly|about)?\s*$/i,
];
function isEquityLeftAdjacentSpan(text: string, span: SalarySpan): boolean {
  const leftWindow = text.slice(Math.max(0, span.start - 24), span.start);
  return EQUITY_LEFT_ADJACENT.some((re) => re.test(leftWindow));
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
  textIn: string,
  ctx: NumberRoleContext = {},
): NumberRoleResult {
  if (!textIn || !textIn.trim()) {
    return { currentCtc: null, target: null, competing: null, targetAsRange: false, targetComponent: null };
  }
  /* STT fragility (2026-05-22): mirror `parseSalaryFacts` and normalize
   * English number-words to digits BEFORE span discovery / cue scoring.
   * Without this, "my current CTC is thirty six LPA" silently returns
   * { currentCtc: null }, the kernel sees no disclosure, and the engine
   * falls through — exact same shape as the LPE bug f5289f3 fixed. */
  const text = substituteEnglishNumbers(textIn);
  const spans = findSalarySpans(text);
  if (spans.length === 0) {
    return { currentCtc: null, target: null, competing: null, targetAsRange: false, targetComponent: null };
  }
  let currentCtc: number | null = null;
  let target: number | null = null;
  let competing: number | null = null;
  let currentFromRange = false;
  let targetFromRange = false;
  let targetComponent: "total" | "fixed" | null = null;
  for (const span of spans) {
    // Negation short-circuit: "Not 30 LPA, that's too high" must not
    // bind 30 to any role. See NEGATION_LEFT_PATTERNS / INVERTERS for
    // the precise contract.
    if (isNegatedSpan(text, span)) continue;
    const scores = scoreRolesForSpan(text, span);
    /* Equity-scope guard (L1 / PRI-50): an equity/RSU/ESOP/stock-framed
     * number with NO explicit current/target/competing cue is an equity
     * component, not a CTC — don't let it fall through pickRole's
     * bot-asked-current default and clobber the real currentCtc. */
    const cueMax = Math.max(scores.current, scores.target, scores.competing);
    if (cueMax === 0 && isEquityScopedSpan(text, span)) continue;
    /* Equity keyword directly preceding the number overrides even a scored
     * current cue ("I get stock worth 5 LPA"). */
    if (isEquityLeftAdjacentSpan(text, span)) continue;
    const role = pickRole(scores, ctx, span, text);
    if (role == null) continue;
    if (role === "current" && currentCtc == null) {
      currentCtc = span.value;
      currentFromRange = span.isRangeUpper;
    } else if (role === "target" && target == null) {
      target = span.value;
      targetFromRange = span.isRangeUpper;
      targetComponent = detectTargetComponentScope(text, span);
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
    targetComponent = null;
  }
  const targetAsRange = targetFromRange || (target != null && currentFromRange === false && spans.some((s) => s.isRangeUpper));
  return {
    currentCtc,
    target,
    competing,
    targetAsRange: target != null ? targetAsRange : false,
    targetComponent: target != null ? (targetComponent ?? "total") : null,
  };
}

/* ─── Component-scope detection for the bound target ───────────────── */

/** Cue patterns that mark a target number as referring to the FIXED /
 *  BASE component specifically (not the total package). Conservative:
 *  must appear adjacent to the number span (within 20 chars on either
 *  side) and must not be negated by a "total"/"overall" / "ctc"
 *  qualifier in the same window. */
const FIXED_COMPONENT_CUES = [
  /\bfixed(?:\s+(?:component|pay|salary))?\b/i,
  /\bbase(?:\s+(?:pay|salary))?\b/i,
  /\bbasic\b/i,
];
const TOTAL_COMPONENT_CUES = [
  /\btotal\b/i,
  /\boverall\b/i,
  /\bctc\b/i,
  /\bpackage\b/i,
  /\bgross\b/i,
];

function detectTargetComponentScope(text: string, span: SalarySpan): "total" | "fixed" | null {
  /* Window widened 20→45 on the left (live-staging, 2026-06-17). A
   * fixed/base cue can sit a full clause before the number — "I was
   * hoping the base could be around 28" puts "base" ~19 chars out, and
   * "can we get the fixed component closer to 28" puts "fixed" ~30 out;
   * the old 20-char window missed both and mis-scoped the counter as
   * total. We clip the left window back to the current clause (after the
   * last sentence/comma boundary) so a PRIOR clause's "total"/"base"
   * can't leak across — keeps the both-hit→total contract intact for
   * single-clause "₹32 LPA total with base at ₹26". */
  const LEFT_COMPONENT_WINDOW = 45;
  const RIGHT_COMPONENT_WINDOW = 20;
  let leftWindow = text.slice(Math.max(0, span.start - LEFT_COMPONENT_WINDOW), span.start);
  const clauseCut = Math.max(
    leftWindow.lastIndexOf("."),
    leftWindow.lastIndexOf(";"),
    leftWindow.lastIndexOf(","),
  );
  if (clauseCut >= 0) leftWindow = leftWindow.slice(clauseCut + 1);
  const rightWindow = text.slice(span.end, Math.min(text.length, span.end + RIGHT_COMPONENT_WINDOW));
  const window = `${leftWindow} ${rightWindow}`;
  const fixedHit = FIXED_COMPONENT_CUES.some((re) => re.test(window));
  const totalHit = TOTAL_COMPONENT_CUES.some((re) => re.test(window));
  /* Both hit ("₹32 LPA total with base at ₹26") → total wins. The
   * candidate's anchor is the total; the base mention is a constraint
   * but the bound target value here is the total. */
  if (totalHit) return "total";
  if (fixedHit) return "fixed";
  return null;
}
