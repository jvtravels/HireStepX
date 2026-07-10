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
/* AUDIT-2 follow-up (2026-06-08): "cash" added as a unit synonym for
 * the equity-heavy disclosure pattern "Targeting 36 cash + meaningful
 * equity". In the Indian-tech register, "N cash" inside a comp context
 * means "N LPA in cash comp" (distinguishing from equity/ESOP). Bare
 * numeric extraction maps it to LPA same as "lakhs". Surfaced by the
 * esop-heavy-comp scenario. */
const UNIT_TOKEN = "LPA|LP[A-Z]|lakhs?|crores?|cr|lacs?|lacks|lax|cash|L";

/* STT fragility audit (2026-05-22) — follow-up to LPE fix.
 *
 * English number-word substitution. STT layers (Sarvam / Whisper /
 * Azure) sometimes ship spelled-out numerals instead of digits for
 * slowly / carefully pronounced numbers ("thirty six LPA", not "36
 * LPA"). Every downstream salary parser keys on digit strings, so a
 * spelled-out disclosure was silently dropped — exact same shape as
 * the LPE bug.
 *
 * Strategy: pre-normalize spelled-out English numbers in the salary
 * range [1, 100] LPA — that's the realistic Indian-HR window. We
 * substitute the spelled form (with optional hyphen) for its digit
 * equivalent so the downstream regex bank sees "36 LPA" regardless of
 * whether STT shipped "36", "thirty six", or "thirty-six".
 *
 * Word boundaries: the substitution is whole-word with `\b`, so
 * "thirtysix" (word-boundary STT mishap) is handled by also accepting
 * the run-together form for tens+ones combinations.
 *
 * Range cap of 100 is conservative — Indian salary disclosures in
 * the spelled-out window almost never exceed two digits, and the
 * collision risk grows above 100 ("hundred and fifty" might be a
 * page count, etc.). Above 100 candidates use digits anyway. */
const ENGLISH_NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const TENS_WORDS = ["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const ONES_WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

/* Build a single regex that matches either:
 *   - tens + (hyphen|space|none) + ones    → "thirty-six" / "thirty six" / "thirtysix"
 *   - tens alone                           → "thirty"
 *   - teens (eleven..nineteen)             → "fifteen"
 *   - ones (one..nine)                     → "six"
 * Whole-word anchored to avoid colliding with substrings ("forty" inside
 * "forty-five-year-old"). Case-insensitive. */
const _tensAlt = TENS_WORDS.join("|");
const _onesAlt = ONES_WORDS.join("|");
const _teensAlt = "eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen";
const ENGLISH_NUM_RE = new RegExp(
  `\\b((?:${_tensAlt})(?:[-\\s]?(?:${_onesAlt}))?|${_teensAlt}|${_onesAlt}|ten)\\b`,
  "gi",
);

/** Substitute spelled-out English number-words in the salary range
 *  [1, 99] with their digit equivalent. Exposed so other parsers
 *  (`_number-role-classifier`) can apply the same normalization at
 *  their input boundary. Pure. */
export function substituteEnglishNumbers(s: string): string {
  if (!s) return s;
  return s.replace(ENGLISH_NUM_RE, (whole) => {
    const norm = whole.toLowerCase().replace(/\s+/g, "-");
    /* Compound "thirty-six" / "thirtysix" / "thirty six" → 36. */
    const compound = norm.match(/^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-?(one|two|three|four|five|six|seven|eight|nine)$/);
    if (compound) {
      const tens = ENGLISH_NUMBER_WORDS[compound[1]];
      const ones = ENGLISH_NUMBER_WORDS[compound[2]];
      if (tens != null && ones != null) return String(tens + ones);
    }
    const direct = ENGLISH_NUMBER_WORDS[norm.replace(/-/g, "")] ?? ENGLISH_NUMBER_WORDS[norm];
    if (direct != null) return String(direct);
    return whole;
  });
}

/* N-4 (2026-07-10, live staging — Senior Product Designer @ Lollypop Design
 * Studio) — vague decade-band CTC idiom. Indian candidates routinely disclose
 * comp as a fuzzy decade ("my current is in the low-to-mid 30s", "somewhere in
 * the high 20s") instead of a crisp number. Every downstream salary parser keys
 * on a digit+unit shape, so the disclosure was silently dropped: currentCtc
 * stayed null, discovery never completed the current-CTC item, and the planner
 * re-probed. This normalises the idiom to a representative "NN LPA" BEFORE the
 * regex bank / span discovery runs, so both parseSalaryFacts and the
 * number-role-classifier bind it. Gated on a money-context cue in the same text
 * so the age idiom ("she's in her mid 30s") is never mis-read as salary. */
const VAGUE_DECADE_MONEY_CUE_RE =
  /\b(ctc|salary|salaries|lpa|lakhs?|lacs?|package|comp|compensation|pay|paid|paying|earn(?:ing|s)?|mak(?:e|ing)|draw(?:ing|s)?|base|fixed|in[-\s]?hand|take[-\s]?home|per\s?annum|p\.?a\.?|current(?:ly)?|currently\s+at)\b/i;
/* Modifier → offset within the decade. Compound "X-to-Y" averages the two.
 * low/early → bottom third, mid → middle, high/late/upper → top. */
const VAGUE_MOD_OFFSET: Record<string, number> = {
  low: 2, lower: 2, early: 2,
  mid: 5, middle: 5, medium: 5,
  high: 8, higher: 8, upper: 8, late: 8,
};
const VAGUE_DECADE_RE =
  /\b(low|lower|early|mid|middle|medium|high|higher|upper|late)(?:[-\s](?:to[-\s]?)?(low|lower|early|mid|middle|medium|high|higher|upper|late))?\s+([2-9]0)s\b/gi;

/** Normalise a vague decade-band salary idiom ("low-to-mid 30s") to a
 *  representative "NN LPA" token. Pure. No-op unless the text also carries a
 *  money-context cue (so age phrasings are left untouched). Exposed so the
 *  number-role-classifier can apply the identical normalization at its input
 *  boundary — single source of truth for the idiom. */
export function substituteVagueSalaryDecades(s: string): string {
  if (!s || !VAGUE_DECADE_MONEY_CUE_RE.test(s)) return s;
  return s.replace(VAGUE_DECADE_RE, (whole, mod1: string, mod2: string | undefined, decadeTok: string) => {
    const decade = Number(decadeTok);
    if (!Number.isFinite(decade)) return whole;
    const o1 = VAGUE_MOD_OFFSET[mod1.toLowerCase()];
    if (o1 == null) return whole;
    const o2 = mod2 ? VAGUE_MOD_OFFSET[mod2.toLowerCase()] : null;
    const offset = o2 == null ? o1 : Math.round((o1 + o2) / 2);
    return `${decade + offset} LPA`;
  });
}

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
  if (u.startsWith("lakh") || u.startsWith("lac") || u === "lacks" || u === "lax" || u === "l") return "lakh";
  /* AUDIT-2 (2026-06-08): "cash" maps to lakh-equivalent. "36 cash"
   * in an equity-heavy comp disclosure means "36 LPA cash component". */
  if (u === "cash") return "lakh";
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
export function parseSalaryFacts(textIn: string): SalaryFact[] {
  if (!textIn) return [];
  /* STT fragility (2026-05-22): normalize English number-words to digits
   * BEFORE running the regex bank. "thirty six LPA" → "36 LPA" → matches.
   * Without this pre-pass, the entire downstream pipeline (kernel fact
   * binding, salary clamping, hike math, telemetry) silently drops
   * spelled-out salary disclosures. */
  const text = substituteVagueSalaryDecades(substituteEnglishNumbers(textIn));
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
