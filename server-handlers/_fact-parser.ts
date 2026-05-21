/* Typed fact parser — single source of truth for salary-bearing
 * number extraction across the pipeline.
 *
 * Audit follow-up (2026-05-21). The salary-negotiation pipeline had
 * five+ independent regex literals doing variants of the same job
 * (`SALARY_NUM_RE`, `RUPEE_NUM_RE`, `LPA_NUM_RE`, `extractNumberAfter`,
 * etc.). Each consumer hand-rolled the parse, lost range-upper
 * information ("₹22-24 LPA" silently became two scalars), and
 * normalised units inconsistently (lakh / L / LPA / crore).
 *
 * `parseSalaryFacts(text)` produces a typed `SalaryFact[]` once per
 * sentence. Each fact carries:
 *   - value           — normalised to LPA (lakh-per-annum)
 *   - unit            — the source unit token before normalisation
 *   - rawSpan         — offset window in the input string
 *   - isRangeUpper    — true if this fact is the upper bound of an
 *                       N-M LPA range (so the consumer can decide
 *                       whether to use the midpoint, the upper, or
 *                       reject as ambiguous)
 *   - rangePeer       — value of the paired bound when isRangeUpper
 *                       OR isRangeLower is set
 *   - confidence      — "high" when an explicit unit token was
 *                       present, "medium" for ₹-prefixed bare
 *                       numbers in salary contexts, "low" otherwise
 *
 * Consumers that only need the raw scalar string (legacy contract of
 * `extractNumbers`) can use `extractSalaryScalars()` which flattens
 * the typed result. */

export type SalaryUnit = "LPA" | "lakh" | "crore" | "rupee" | "raw";

export interface SalaryFact {
  /** LPA-normalised value. crore → ×100, lakh/L/LPA → ×1, ₹ → assumed LPA. */
  value: number;
  /** Original unit token (lower-cased) before normalisation. */
  unit: SalaryUnit;
  /** Raw match span in the source string [start, end). */
  rawSpan: [number, number];
  /** Original captured digits as the legacy `extractNumbers` returned them. */
  rawDigits: string;
  /** True if this fact is part of a range "N-M unit". */
  isRangeLower: boolean;
  isRangeUpper: boolean;
  /** Value of the paired bound when range. */
  rangePeer: number | null;
  /** "high" = explicit LPA/lakh/crore unit; "medium" = ₹-prefixed; "low" = bare. */
  confidence: "high" | "medium" | "low";
}

/* ─────────────── core patterns ─────────────── */

/* Voice-STT robustness (2026-05-22): Indian candidates say "LPA" out
 * loud constantly ("thirty-six L-P-A"), and the Sarvam / Azure STT
 * layers regularly mis-transcribe the trailing "A" as a different
 * vowel — "LPE", "LPI", "LPO", "LPU" — or as a close consonant
 * ("LPS", "LPP"). User report (Flipkart Senior Product Designer
 * session): candidate said "my current CTC is 36 LPA" → STT shipped
 * "36 LPE" → parser returned [] → kernel saw no disclosure → engine
 * fell through to the static closing on turn 1. The unit shape is
 * unambiguous (digits + space + "LP" + one letter), so accept any
 * `LP[A-Z]` token as LPA — there is no real word in the Indian-HR
 * register that this collides with. */
const UNIT_TOKEN = "LPA|LP[A-Z]|lakhs?|crores?|cr|lacs?|L";

/* Standalone salary-bearing tokens: 22 LPA / 22.5 lakhs / 1.2 crore / 22L.
 * Capture groups:
 *   1 → digits, 2 → unit token */
const UNIT_NUM_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\b`, "gi");

/* ₹-prefixed numbers — these may or may not have a unit token after. */
const RUPEE_NUM_RE = new RegExp(`₹\\s*(\\d[\\d,.]*)(?:\\s*(${UNIT_TOKEN})\\b)?`, "gi");

/* Range detector — bridges two numbers across a dash/hyphen/word "to",
 * with a shared trailing unit. Matches both:
 *   "22-24 LPA"      (single unit at the end)
 *   "₹22 to ₹24 LPA" (₹-prefixed peers)
 *   "22 to 24 LPA" */
const RANGE_RE = new RegExp(
  `(?:₹\\s*)?(\\d+(?:\\.\\d+)?)\\s*(?:-|–|to)\\s*(?:₹\\s*)?(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\b`,
  "gi",
);

function normaliseUnit(raw: string | undefined): SalaryUnit {
  if (!raw) return "raw";
  const u = raw.toLowerCase();
  if (u === "lpa") return "LPA";
  if (u.startsWith("crore") || u === "cr") return "crore";
  if (u.startsWith("lakh") || u.startsWith("lac") || u === "l") return "lakh";
  /* STT typo tolerance — any 3-char `lp?` shape (lpe / lps / lpp / lpi /
   * lpo / lpu / lpm …) is treated as LPA. Constrained by the regex above
   * to `LP[A-Z]`, so this branch only ever sees the near-miss family. */
  if (u.length === 3 && u.startsWith("lp")) return "LPA";
  return "raw";
}

function toLpa(value: number, unit: SalaryUnit): number {
  if (unit === "crore") return value * 100;
  /* LPA, lakh, L, rupee-with-salary-context, raw → already LPA-scale. */
  return value;
}

/** Strip "," thousand separators and parse. */
function digitsToNumber(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

/* ─────────────── public API ─────────────── */

/** Extract typed salary facts from arbitrary text. Range-aware:
 *  matches like "22-24 LPA" produce two SalaryFacts with
 *  `isRangeLower=true` / `isRangeUpper=true` and `rangePeer` set so
 *  the consumer can detect the pairing. */
export function parseSalaryFacts(text: string): SalaryFact[] {
  if (!text) return [];
  const facts: SalaryFact[] = [];
  /* Tracks spans we've already produced a fact for, so a range match
   * doesn't double-count with the per-number unit/rupee passes. */
  const consumed: Array<[number, number]> = [];
  const overlaps = (start: number, end: number) =>
    consumed.some(([s, e]) => start < e && end > s);

  /* PASS 1 — range tokens (consumes both bounds + the shared unit). */
  RANGE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RANGE_RE.exec(text)) !== null) {
    const [whole, lowDigits, highDigits, unitTok] = m;
    const start = m.index;
    const end = start + whole.length;
    const unit = normaliseUnit(unitTok);
    const lowRaw = digitsToNumber(lowDigits);
    const highRaw = digitsToNumber(highDigits);
    if (!Number.isFinite(lowRaw) || !Number.isFinite(highRaw)) continue;
    const lowLpa = toLpa(lowRaw, unit);
    const highLpa = toLpa(highRaw, unit);
    facts.push({
      value: lowLpa,
      unit,
      rawSpan: [start, end],
      rawDigits: lowDigits,
      isRangeLower: true,
      isRangeUpper: false,
      rangePeer: highLpa,
      confidence: "high",
    });
    facts.push({
      value: highLpa,
      unit,
      rawSpan: [start, end],
      rawDigits: highDigits,
      isRangeLower: false,
      isRangeUpper: true,
      rangePeer: lowLpa,
      confidence: "high",
    });
    consumed.push([start, end]);
  }

  /* PASS 2 — explicit unit tokens (LPA / lakh / crore / L). */
  UNIT_NUM_RE.lastIndex = 0;
  while ((m = UNIT_NUM_RE.exec(text)) !== null) {
    const [whole, digits, unitTok] = m;
    const start = m.index;
    const end = start + whole.length;
    if (overlaps(start, end)) continue;
    const unit = normaliseUnit(unitTok);
    const raw = digitsToNumber(digits);
    if (!Number.isFinite(raw)) continue;
    facts.push({
      value: toLpa(raw, unit),
      unit,
      rawSpan: [start, end],
      rawDigits: digits,
      isRangeLower: false,
      isRangeUpper: false,
      rangePeer: null,
      confidence: "high",
    });
    consumed.push([start, end]);
  }

  /* PASS 3 — ₹-prefixed bare numbers (no explicit unit). Treated as
   * LPA by convention (matches legacy `RUPEE_NUM_RE` behaviour). */
  RUPEE_NUM_RE.lastIndex = 0;
  while ((m = RUPEE_NUM_RE.exec(text)) !== null) {
    const [whole, digits, unitTok] = m;
    const start = m.index;
    const end = start + whole.length;
    if (overlaps(start, end)) continue;
    const unit = unitTok ? normaliseUnit(unitTok) : "rupee";
    const raw = digitsToNumber(digits);
    if (!Number.isFinite(raw)) continue;
    facts.push({
      value: toLpa(raw, unit),
      unit,
      rawSpan: [start, end],
      rawDigits: digits.replace(/,/g, ""),
      isRangeLower: false,
      isRangeUpper: false,
      rangePeer: null,
      confidence: unitTok ? "high" : "medium",
    });
    consumed.push([start, end]);
  }

  /* Sort by source offset so consumers see facts in reading order. */
  facts.sort((a, b) => a.rawSpan[0] - b.rawSpan[0]);
  return facts;
}

/** Legacy-compatible scalar extractor. Returns the raw captured digit
 *  strings (matching the prior `extractNumbers` contract). Used by the
 *  restyle validator's subset-check pathway. */
export function extractSalaryScalars(text: string): string[] {
  return parseSalaryFacts(text).map((f) => f.rawDigits);
}

/** Convenience predicate — true if the text contains any salary-bearing
 *  fact above the supplied LPA threshold. */
export function hasSalaryAbove(text: string, lpaThreshold: number): boolean {
  for (const f of parseSalaryFacts(text)) {
    if (f.value > lpaThreshold) return true;
  }
  return false;
}

/** Returns the maximum LPA value across all salary facts (range upper
 *  bounds included), or null if none. Useful for "did the LLM ship a
 *  number above band.maxStretch?" guards. */
export function maxSalaryLpa(text: string): number | null {
  let max: number | null = null;
  for (const f of parseSalaryFacts(text)) {
    if (max == null || f.value > max) max = f.value;
  }
  return max;
}
