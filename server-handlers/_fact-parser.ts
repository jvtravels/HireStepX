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

export type SalaryUnit = "LPA" | "lakh" | "crore" | "million" | "rupee" | "raw";

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
/* OA-B12 (2026-07-17): "million"/"mn" added as a unit synonym. Returning-NRI
 * and MNC candidates quote INR comp in millions ("4.8 million" = ₹48 lakh =
 * 48 LPA), and `figureToLakhs` in _utterance-intent already maps million→×10 —
 * so the two subsystems disagreed and parseSalaryFacts silently dropped it.
 * Bare single-letter `m` is deliberately EXCLUDED (it collides with the far
 * more common "48L"/stray "m" noise); only the unambiguous `million`/`mn`
 * forms are accepted. */
const UNIT_TOKEN = "LPA|LP[A-Z]|lakhs?|laakhs?|laaks?|crores?|cr|lacs?|lacks|lax|cash|millions?|mn|L";

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

/* Magnitude constants shared by multiple substitution functions and the
 * resolveBareRupee / plausibility-ceiling logic below. Defined here (before the
 * substitution functions) so substituteCompoundCroreLakh (S38-B1) and
 * substituteMonthlyInHand (S28-B1) can reference them without forward-ref errors. */
const RUPEES_PER_LAKH = 100_000;
const MAX_PLAUSIBLE_LPA = 5000;

/* S38-B1 (2026-07-21): "one crore twenty lakhs" — substituteEnglishNumbers
 * converts "one"→"1" and "twenty"→"20", giving "1 crore 20 lakhs" which
 * parseSalaryFacts reads as [100 LPA, 20 LPA] instead of the correct 120 LPA.
 * We must convert compound crore+lakh forms BEFORE word substitution runs.
 * Also handles: "1 crore 20 lakhs" → "120 LPA", "2 crore 50 lakhs" → "250 LPA".
 * Decimal crore ("1.2 crore") is already handled by UNIT_NUM_RE (crore → ×100). */
const COMPOUND_CRORE_LAKH_RE =
  /(\d+(?:\.\d+)?)\s*crores?\s+(\d+(?:\.\d+)?)\s*lakhs?/gi;

/** Convert "N crore M lakhs" compound forms to "NNN LPA" BEFORE English number
 *  substitution runs — otherwise "1 crore 20 lakhs" parses as two separate
 *  facts. Pure. Exposed so number-role-classifier can apply the same pass (S38-B1). */
export function substituteCompoundCroreLakh(s: string): string {
  if (!s) return s;
  return s.replace(COMPOUND_CRORE_LAKH_RE, (whole, croreStr: string, lakhStr: string) => {
    const crore = parseFloat(croreStr);
    const lakh = parseFloat(lakhStr);
    if (!Number.isFinite(crore) || !Number.isFinite(lakh)) return whole;
    const totalLpa = crore * 100 + lakh;
    if (totalLpa <= 0 || totalLpa > MAX_PLAUSIBLE_LPA) return whole;
    return `${Number.isInteger(totalLpa) ? totalLpa : Number(totalLpa.toFixed(2))} LPA`;
  });
}

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

/* OA-B13 — "fifty thousand" scale word. substituteEnglishNumbers resolves
 * "fifty" → "50" but leaves the multiplier "thousand" as inert text, so a
 * bare "50" then false-binds as 50 LPA — a 100x error (candidate meant
 * ₹50,000). Handle the "<N> thousand|grand" shape explicitly: ₹N,000 is
 * N/100 LPA. Sub-lakh figures (N < 100 → below ₹1 LPA annual) are an
 * implausibly low annual CTC and almost always a mis-scaled/monthly figure,
 * so we suppress them rather than let the bare number bind wrong. At or above
 * ₹1 lakh it's a plausible annual figure — emit an explicit LPA token so both
 * parsers bind the true value. */
const THOUSAND_SCALE_RE = /\b(\d+(?:\.\d+)?)\s*(?:thousand|grand)\b/gi;

/** Normalise a trailing "thousand"/"grand" scale word into its true LPA value
 *  (or drop it when sub-lakh). Runs AFTER substituteEnglishNumbers so spelled
 *  tens ("fifty") are already digits. Pure. Exposed so the number-role
 *  classifier applies the identical normalization — single source of truth. */
export function substituteThousandScale(s: string): string {
  if (!s) return s;
  return s.replace(THOUSAND_SCALE_RE, (whole, numStr: string) => {
    const n = parseFloat(numStr);
    if (!isFinite(n)) return whole;
    const lpa = (n * 1000) / 100000; // ₹N,000 → LPA
    if (lpa < 1) return " "; // sub-₹1L annual — suppress, don't false-bind
    return ` ${Number.isInteger(lpa) ? lpa : Number(lpa.toFixed(2))} LPA `;
  });
}

/* S28-B1 (2026-07-21): "₹2.5 lakh per month in-hand" — monthly in-hand figures
 * were not converted to annual. "2.5 lakh per month" = 30 LPA but the parser
 * read it as 2.5 LPA. We detect "N lakh(s)/LPA per month" patterns and
 * substitute with the annual equivalent (×12) AFTER substituteThousandScale. */
const MONTHLY_LAKH_RE =
  /(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?|lax|LPA|L)\s+per\s+month\b/gi;

/** Convert "N lakh(s) per month" / "N LPA per month" to the annual "NN.N LPA"
 *  equivalent (×12). Runs AFTER substituteThousandScale. Pure. Exposed so
 *  number-role-classifier can share the same normalization (S28-B1). */
export function substituteMonthlyInHand(s: string): string {
  if (!s) return s;
  return s.replace(MONTHLY_LAKH_RE, (whole, numStr: string) => {
    const monthly = parseFloat(numStr);
    if (!Number.isFinite(monthly) || monthly <= 0) return whole;
    const annual = monthly * 12;
    if (annual > MAX_PLAUSIBLE_LPA) return whole;
    return `${Number.isInteger(annual) ? annual : Number(annual.toFixed(2))} LPA`;
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
/* Fix A (S29-B1, 2026-07-22): added target/expect/aim/looking-for/want/hoping
 * so "I am targeting around 28,00,000" (and similar) gates through to
 * substituteAbsoluteRupees.  The vague-decade idiom guard (age: "mid 30s")
 * is still safe because none of the new words are decades. */
const VAGUE_DECADE_MONEY_CUE_RE =
  /\b(ctc|salary|salaries|lpa|lakhs?|lacs?|package|comp|compensation|pay|paid|paying|earn(?:ing|s)?|mak(?:e|ing)|draw(?:ing|s)?|base|fixed|in[-\s]?hand|take[-\s]?home|per\s?annum|p\.?a\.?|current(?:ly)?|currently\s+at|target(?:ing)?|expect(?:ing|ation)?|aim(?:ing)?\s+for|looking\s+for|want(?:ing)?|hoping(?:\s+for)?)\b/i;
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

/* OA-B55 (2026-07-17): a URL in the candidate's message carries digits in its
 * port / path / query ("check https://example.com:8080/jobs/45") that are NOT
 * salary figures. The bare-integer span path in the number-role-classifier
 * would false-bind "8080" or "45" as a target/current CTC. Strip URL-shaped
 * tokens to whitespace BEFORE any number extraction so their digits never
 * reach the span scorer. Exposed so both parseSalaryFacts and
 * classifyNumberRoles share ONE definition (single source of truth). Pure.
 * Covers scheme-prefixed (`https://…`, `www.…`) and bare host+TLD forms with
 * an optional port/path/query tail. Kept to common TLDs so a sentence-final
 * "word.Something" idiom can't accidentally swallow real text. */
const URL_RE =
  /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.(?:com|in|io|org|net|co|dev|app|xyz|ai|gov|edu|info|biz|me|tech)\b(?:[/:?#]\S*)?/gi;

export function stripUrls(s: string): string {
  if (!s) return s;
  return s.replace(URL_RE, " ");
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

/* S30-B1 (2026-07-21): "My current CTC is between 25 and 27 lakhs" — "and" is
 * NOT a range separator in RANGE_RE (only "-/–/to"). "25" had no unit token so
 * parseSalaryFacts extracted only "27 lakhs" = 27 LPA and dropped "25". The fix:
 * a dedicated BETWEEN_RANGE_RE that matches "between N and M UNIT" before PASS 1,
 * converting it to a canonical "N-M UNIT" form that RANGE_RE will then consume.
 * "and" as a range separator is ONLY valid when preceded by "between" — this avoids
 * false-positives like "equity and 30 LPA" being read as a range. */
const BETWEEN_RANGE_RE = new RegExp(
  `\\bbetween\\s+(?:₹\\s*)?(\\d+(?:\\.\\d+)?)\\s+and\\s+(?:₹\\s*)?(\\d+(?:\\.\\d+)?)\\s*(${UNIT_TOKEN})\\b`,
  "gi",
);

function normaliseUnit(raw: string | undefined): SalaryUnit {
  if (!raw) return "raw";
  const u = raw.toLowerCase();
  if (u === "lpa") return "LPA";
  if (u.startsWith("crore") || u === "cr") return "crore";
  if (u.startsWith("million") || u === "mn") return "million";
  if (u.startsWith("lakh") || u.startsWith("laakh") || u.startsWith("laak") || u.startsWith("lac") || u === "lacks" || u === "lax" || u === "l") return "lakh";
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
  /* OA-B12: ₹N million = N × 10 lakh = 10N LPA. */
  if (unit === "million") return value * 10;
  /* LPA, lakh, L, rupee-with-salary-context, raw → already LPA-scale. */
  return value;
}

/* ── Family A / OA-B1 / OA-B29 (CRITICAL): absolute-rupee resolution ──
 *
 * A ₹-prefixed number carrying NO unit token is ambiguous between two
 * conventions in the Indian-HR register:
 *   1. LPA shorthand      — "₹25 base"        → 25 LPA
 *   2. absolute rupees     — "₹22,00,000"      → 22 lakh p.a. = 22 LPA
 *      (Indian comma grouping: "₹1,20,00,000" = 1.2 crore = 120 LPA)
 *
 * The OLD code returned the bare rupee count AS LPA (2,200,000 / 12,000,000
 * "LPA"), poisoning every hike/band/score computation downstream. Magnitude
 * disambiguates deterministically — nobody quotes annual comp as "100000
 * LPA", and no plausible LPA figure exceeds a few thousand — so:
 *   - value ≥ 1 lakh rupees  → absolute rupees, LPA = value / 100,000 (high)
 *   - value ≤ MAX plausible LPA → LPA shorthand (medium)
 *   - in-between (e.g. ₹35,000) → too big for LPA, too small for absolute:
 *       ambiguous (monthly? noise?) → keep value, mark LOW so the
 *       downstream plausibility band can drop it rather than trust it. */
/* RUPEES_PER_LAKH and MAX_PLAUSIBLE_LPA are defined earlier (before the
 * substitution functions) so substituteCompoundCroreLakh and
 * substituteMonthlyInHand can reference them without a forward-reference error. */

/* OA-B15 (2026-07-17): a unit-bearing figure whose LPA magnitude is absurd —
 * "₹1 lakh crore" → 1 crore-of-lakh = 100,000 LPA, or "1000 crore" → 100,000
 * LPA — must not be emitted as a HIGH-confidence salary fact. The
 * number-role-classifier already rejects spans above MAX_LPA
 * (_number-role-classifier.ts findSalarySpans), but parseSalaryFacts had no
 * equivalent ceiling, so maxSalaryLpa/hasSalaryAbove could surface a garbage
 * six-figure LPA. We reuse the SAME MAX_PLAUSIBLE_LPA ceiling (single source
 * of truth) and drop — never push — a unit-derived value above it. The
 * intentional bare-₹ LOW-confidence retention (resolveBareRupee) is untouched;
 * this guards only the confident crore/million/lakh conversion paths. */
function exceedsPlausibleLpa(lpa: number): boolean {
  return lpa > MAX_PLAUSIBLE_LPA;
}

function resolveBareRupee(value: number): { lpa: number; confidence: "high" | "medium" | "low" } {
  if (value >= RUPEES_PER_LAKH) return { lpa: value / RUPEES_PER_LAKH, confidence: "high" };
  if (value > MAX_PLAUSIBLE_LPA) return { lpa: value, confidence: "low" };
  return { lpa: value, confidence: "medium" };
}

/* OA-B2 (2026-07-17): bare comma-grouped absolute-rupee amounts.
 * "I earn 48,00,000 currently" — Indian (48,00,000) or Western
 * (4,800,000) comma grouping with NO ₹ prefix and NO unit token — matched
 * neither UNIT_NUM_RE (needs a unit) nor RUPEE_NUM_RE (needs ₹), so BOTH
 * parseSalaryFacts AND the number-role-classifier's span bank silently
 * dropped it: the disclosed CTC never bound and discovery re-probed. The
 * comma grouping IS the absolute-rupee signal; we normalise it to a
 * representative "NN LPA" token at the shared input boundary so both
 * subsystems bind it identically (single source of truth — mirrors N-4 /
 * stripUrls). Gated on a money-context cue in the same text so a
 * comma-grouped user/view count in a non-salary sentence is never
 * mis-read as pay; resolved through the SAME RUPEES_PER_LAKH divisor and
 * MAX_PLAUSIBLE_LPA ceiling as resolveBareRupee. A trailing unit token is
 * excluded by lookahead so an already-tagged figure is left for the unit
 * pass. Pure. */
/* A leading $/€/£/¥ (or an abutting digit) is excluded by lookbehind so a
 * foreign-currency amount ("$120,000") stays intact for the USD→INR path and a
 * sub-run of a longer number is never matched. */
const GROUPED_ABSOLUTE_RUPEE_RE =
  /(?<![$€£¥\d])(₹\s*)?(\d{1,3}(?:,\d{2,3})+)(?!\s*(?:lpa|lp[a-z]|lakhs?|lacs?|crores?|cr|millions?|mn|l)\b)/gi;

export function substituteAbsoluteRupees(s: string): string {
  /* Fix A (S29-B1, 2026-07-22): gate is now expanded (see VAGUE_DECADE_MONEY_CUE_RE)
   * to include target/expect verbs, so "I am targeting around 28,00,000" passes.
   *
   * ₹-prefixed comma-grouped amounts (e.g. ₹22,00,000) are intentionally left
   * for PASS 3 of parseSalaryFacts (RUPEE_NUM_RE + resolveBareRupee), which
   * preserves the original rawDigits string.  Substituting them here would
   * rewrite "₹22,00,000" → "₹22 LPA" and lose rawDigits="2200000", breaking
   * the existing pinned tests.  The ₹ symbol is its own sufficient cue; PASS 3
   * already handles the absolute-rupee case correctly. */
  if (!s || !VAGUE_DECADE_MONEY_CUE_RE.test(s)) return s;
  return s.replace(GROUPED_ABSOLUTE_RUPEE_RE, (whole, rupeePfx: string | undefined, digits: string) => {
    /* ₹-prefixed: leave untouched, handled by PASS 3 / resolveBareRupee. */
    if (rupeePfx) return whole;
    const raw = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(raw) || raw < RUPEES_PER_LAKH) return whole;
    const lpa = raw / RUPEES_PER_LAKH;
    if (lpa > MAX_PLAUSIBLE_LPA) return whole;
    return `${Math.round(lpa * 10) / 10} LPA`;
  });
}

/* OA-B71 (2026-07-17): foreign-currency salary disclosures. A returning-NRI or
 * MNC candidate quotes comp in AED / GBP / EUR / JPY / USD ("my current is AED
 * 400,000", "£90,000 base", "€85k"). The OLD chain had NO foreign-currency
 * handling except the classifier's $-only Pass 3, so these produced CONFIDENT
 * WRONG binds — worse than dropping: substituteAbsoluteRupees treated "AED
 * 400,000" as ₹400,000 → ₹4L (real ~₹90L), and a £/€ symbol (excluded by the
 * rupee lookbehind) leaked its digits so bare "90" bound as 90 LPA. We convert
 * every foreign-currency amount to a representative "NN LPA" token at the shared
 * input boundary — BEFORE substituteAbsoluteRupees — via a fixed FX table (the
 * same fixed-FX convention the classifier's USD path already uses: this is a
 * mock-interview sim, ballpark parity is sufficient and deterministic). The
 * currency symbol/code IS the money cue, so this is not gated on the vague-cue
 * RE. Emitted only when the resulting LPA is salary-plausible (≥1, ≤ ceiling) so
 * "€5" / "¥500" are left untouched. The USD $-symbol form is deliberately left
 * to the classifier's dedicated Pass 3 (tested, kernel-relied-upon); we handle
 * the word-form "USD" and the £/€/¥ symbols + AED/GBP/EUR/JPY codes it misses.
 * Exposed so parseSalaryFacts and classifyNumberRoles share ONE definition. */
const FX_TO_INR: Record<string, number> = {
  usd: 83, gbp: 105, eur: 90, aed: 22.6, jpy: 0.55,
};
function fxRateForToken(token: string): number | null {
  const t = token.toLowerCase().replace(/s$/, "");
  if (t === "£" || t === "gbp" || t === "pound") return FX_TO_INR.gbp;
  if (t === "€" || t === "eur" || t === "euro") return FX_TO_INR.eur;
  if (t === "¥" || t === "jpy") return FX_TO_INR.jpy;
  if (t === "aed" || t === "dirham") return FX_TO_INR.aed;
  if (t === "usd") return FX_TO_INR.usd;
  return null;
}
function scaleSuffix(sfx: string | undefined): number {
  if (!sfx) return 1;
  const s = sfx.toLowerCase();
  if (s === "k") return 1_000;
  if (s === "m") return 1_000_000;
  return 1;
}
function foreignToLpaToken(currencyTok: string, digits: string, sfx: string | undefined, whole: string): string {
  const rate = fxRateForToken(currencyTok);
  if (rate == null) return whole;
  const amount = Number(digits.replace(/,/g, "")) * scaleSuffix(sfx);
  if (!Number.isFinite(amount) || amount <= 0) return whole;
  const lpa = (amount * rate) / RUPEES_PER_LAKH;
  if (lpa < 1 || lpa > MAX_PLAUSIBLE_LPA) return whole;
  return `${Math.round(lpa * 10) / 10} LPA`;
}
/* Symbol/code BEFORE the amount: "AED 400,000", "£90,000", "€85k", "USD 1.2m".
 * The k/m suffix abuts the digits (no separating whitespace consumed) so a
 * trailing " per annum" is left intact — otherwise "€85,000 per annum" would
 * collapse to "LPAper annum" and lose the unit's word boundary. */
const FOREIGN_CURRENCY_PREFIX_RE =
  /(£|€|¥|\bAED\b|\bGBP\b|\bEUR\b|\bJPY\b|\bUSD\b)\s*(\d[\d,]*(?:\.\d+)?)(k|m)?/gi;
/* Amount BEFORE the code/word: "90,000 AED", "1.2m GBP", "85000 euros". */
const FOREIGN_CURRENCY_SUFFIX_RE =
  /(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\s*(\bAED\b|\bGBP\b|\bEUR\b|\bJPY\b|\bUSD\b|dirhams?|pounds?|euros?)/gi;

export function substituteForeignCurrency(s: string): string {
  if (!s) return s;
  let out = s.replace(FOREIGN_CURRENCY_PREFIX_RE, (whole, cur: string, digits: string, sfx: string | undefined) =>
    foreignToLpaToken(cur, digits, sfx, whole),
  );
  out = out.replace(FOREIGN_CURRENCY_SUFFIX_RE, (whole, digits: string, sfx: string | undefined, cur: string) =>
    foreignToLpaToken(cur, digits, sfx, whole),
  );
  return out;
}

/** Strip "," thousand separators and parse.
 * Scientific-notation strings (e.g. "6e6") are rejected — they represent
 * magnitudes far above MAX_LPA and were never a valid salary input format. */
function digitsToNumber(raw: string): number {
  const clean = raw.replace(/,/g, "");
  if (/[eE]/.test(clean)) return NaN;
  return Number(clean);
}

/* Family A / OA-B14 — unary-negation guard. The number-capture regexes
 * start at the first digit, so a leading minus in "-5 lakhs" is never
 * captured and the sign is silently stripped, storing +5 at HIGH
 * confidence and poisoning every downstream hike/band/score computation.
 * A negative salary is *implausible*, not a positive one — so we detect a
 * unary minus immediately preceding the matched digit and drop the fact
 * (design: implausible → no fact, never a confident wrong value). The
 * minus must be a genuine sign — abutting the digit and itself preceded by
 * whitespace or string start — so a compound hyphen inside a word can't
 * trip it. Range spans are consumed in PASS 1 before this runs, so a "-"
 * used as a range separator ("22-24 LPA") never reaches here as a sign. */
function isUnaryNegated(text: string, start: number): boolean {
  if (start === 0) return false;
  const prev = text[start - 1];
  if (prev !== "-" && prev !== "–" && prev !== "−" && prev !== "‑") {
    return false;
  }
  return start - 1 === 0 || /\s/.test(text[start - 2]);
}

/* ─────────────── public API ─────────────── */

/** Normalise "between N and M UNIT" to "N-M UNIT" so RANGE_RE in PASS 1 can
 *  consume it. The "and" separator is ONLY treated as a range connector when it
 *  appears in the "between … and …" idiom (S30-B1). Pure. */
export function substituteBetweenAndRange(s: string): string {
  if (!s) return s;
  return s.replace(BETWEEN_RANGE_RE, (_whole, low: string, high: string, unit: string) =>
    `${low}-${high} ${unit}`,
  );
}

/** Extract typed salary facts from arbitrary text. Range-aware:
 *  matches like "22-24 LPA" produce two SalaryFacts with
 *  `isRangeLower=true` / `isRangeUpper=true` and `rangePeer` set so
 *  the consumer can detect the pairing. */
export function parseSalaryFacts(textIn: string): SalaryFact[] {
  if (!textIn) return [];
  /* Normalization pipeline (in order):
   *  1. stripUrls                  — drop URL digits before any parse
   *  2. substituteForeignCurrency  — AED/GBP/EUR → LPA tokens
   *  3. substituteAbsoluteRupees   — comma-grouped ₹ amounts → LPA tokens
   *  4. substituteCompoundCroreLakh — "N crore M lakhs" → LPA (S38-B1, before word sub)
   *  5. substituteEnglishNumbers   — "thirty six" → "36"
   *  6. substituteThousandScale    — "50 thousand" → LPA or suppress
   *  7. substituteMonthlyInHand    — "N lakh per month" → annual LPA (S28-B1)
   *  8. substituteVagueSalaryDecades — "mid 30s" → "35 LPA"
   *  9. substituteBetweenAndRange  — "between N and M UNIT" → "N-M UNIT" (S30-B1) */
  const text = substituteBetweenAndRange(substituteVagueSalaryDecades(substituteMonthlyInHand(substituteThousandScale(substituteEnglishNumbers(substituteCompoundCroreLakh(substituteAbsoluteRupees(substituteForeignCurrency(stripUrls(textIn)))))))));
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
    /* OA-B15: an absurd bound makes the whole range garbage — drop it. */
    if (exceedsPlausibleLpa(lowLpa) || exceedsPlausibleLpa(highLpa)) {
      consumed.push([start, end]);
      continue;
    }
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
    if (isUnaryNegated(text, start)) continue;
    const unit = normaliseUnit(unitTok);
    const raw = digitsToNumber(digits);
    if (!Number.isFinite(raw)) continue;
    const lpa = toLpa(raw, unit);
    /* OA-B15: drop an absurd unit-derived magnitude (e.g. "1 lakh crore"). */
    if (exceedsPlausibleLpa(lpa)) {
      consumed.push([start, end]);
      continue;
    }
    facts.push({
      value: lpa,
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
    if (isUnaryNegated(text, start)) continue;
    const unit = unitTok ? normaliseUnit(unitTok) : "rupee";
    const raw = digitsToNumber(digits);
    if (!Number.isFinite(raw)) continue;
    /* Bare ₹ number (no unit): resolve absolute-rupees vs LPA-shorthand by
     * magnitude (Family A). ₹ WITH a unit token normalises through toLpa. */
    const resolved = unitTok ? null : resolveBareRupee(raw);
    facts.push({
      value: resolved ? resolved.lpa : toLpa(raw, unit),
      unit,
      rawSpan: [start, end],
      rawDigits: digits.replace(/,/g, ""),
      isRangeLower: false,
      isRangeUpper: false,
      rangePeer: null,
      confidence: resolved ? resolved.confidence : "high",
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
