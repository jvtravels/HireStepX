/* Speech / STT normalization for candidate-turn input.
 *
 * Background: Indian-candidate voice input via Sarvam / Whisper / Azure
 * STT introduces a small, well-bounded set of systematic transcription
 * artifacts that have caused multiple silent parser failures
 * (commit f5289f3: "36 LPA" → "36 LPE"; this module: follow-up sweep).
 *
 * Each parser miss propagates the same way: parser returns [] / null,
 * kernel binds no fact, planner falls through to static closing — the
 * candidate experiences a ghosted session. Patching every parser's
 * regex bank individually accumulates drift; instead this module
 * pre-normalizes the text ONCE at the kernel boundary
 * (`applyCandidateAnswer` / `parseCandidateAnswer`) so every downstream
 * extractor sees clean input.
 *
 * Conservative-by-design. False positives (transforming text that
 * didn't need it) can corrupt non-numeric parsing — only transforms
 * when the pattern is unambiguous and bounded to the salary-negotiation
 * register.
 *
 * Boundary: this is candidate input only. The LLM's own output is NOT
 * routed through here (LLM output is already canonical text).
 *
 * Transformations (idempotent — running twice == running once):
 *   1. Hinglish numerals      tees → 30, ek → 1, paanch → 5, do saal → 2 saal
 *   2. English number-words   thirty-six → 36, fifteen → 15, hundred ignored
 *   3. Unit-suffix STT typos  LPE/LPS/LPI → LPA; lac/lacks/lax → lakh;
 *                             crow/krore/core → crore; rupies/ropee → rupees
 *   4. Decimal markers        "thirty point five" → "30.5"
 *                             (engaged ONLY when surrounded by digit context)
 *   5. Letter-spelled units   "L P A" / "L-P-A" / "elpea" → "LPA"
 *
 * Out of scope (handled by parser-side logic, not normalization):
 *   - Word-numbers > 99 (candidates use digits past 100)
 *   - Devanagari script (no Hindi script in STT pipelines)
 *   - Range markers (parsers accept "to" / "-" / "–" natively)
 *   - Currency symbols (parsers accept ₹, Rs, INR natively)
 */

/* ─── 1. Hinglish numerals (commonly transcribed phonetically) ─────
 *
 * Split into two registers:
 *   A. UNAMBIGUOUS tokens — Hindi-only spellings with no plausible
 *      English-register collision. Substituted on a bare-word match.
 *   B. ENGLISH-COLLIDING tokens — Hindi numerals that are also English
 *      words ("do", "teen", "char", "saat", "nau"). Substituted ONLY
 *      when followed by a salary/tenure context word (lakh, crore,
 *      saal, mahine, LPA, hazaar, karod). Without that anchor "do"
 *      stays as English "do" — protects e.g. "what do I get apart
 *      from base?" from becoming "what 2 I get apart from base?".
 *      ("ek" and "paanch" are unambiguous and live in register A.) */
const HINGLISH_NUMBERS_UNAMBIG: Record<string, string> = {
  das: "10", gyarah: "11", barah: "12", terah: "13", chaudah: "14",
  pandrah: "15", solah: "16", satrah: "17", atharah: "18", unnees: "19",
  bees: "20", ikees: "21", baees: "22", tees: "30", paintees: "35",
  chalees: "40", chalis: "40", chaalis: "40", paintaalis: "45",
  pachas: "50", pachaas: "50", pachpan: "55", saath: "60", pasath: "65",
  sattar: "70", pichattar: "75", assi: "80", pacchasi: "85", nabbe: "90",
  pachanve: "95", sau: "100",
  /* Single-digit unambiguous — "ek" / "paanch" never collide with
   * English; "chhe" / "chhah" / "aath" similarly safe. */
  ek: "1", paanch: "5", panch: "5", chhe: "6", chhah: "6", aath: "8",
};
const HINGLISH_NUMBERS_AMBIG: Record<string, string> = {
  /* Hindi numerals that are also common English words. Require a
   * trailing salary/tenure context anchor to fire. */
  do: "2", teen: "3", char: "4", chaar: "4", saat: "7", nau: "9",
};
const HINGLISH_RE_UNAMBIG = new RegExp(
  "\\b(" + Object.keys(HINGLISH_NUMBERS_UNAMBIG).join("|") + ")\\b",
  "gi",
);
const HINGLISH_CONTEXT_WORD =
  "(?:lakh|lakhs|lac|lacs|crore|crores|cr|lpa|saal|saalo?n?|mahine|mahino?n?|hazaar|hazar|karod|karoron?|year|years|yr|yrs)";
const HINGLISH_RE_AMBIG = new RegExp(
  "\\b(" + Object.keys(HINGLISH_NUMBERS_AMBIG).join("|") + ")\\s+" + HINGLISH_CONTEXT_WORD + "\\b",
  "gi",
);

function substituteHinglish(s: string): string {
  let out = s.replace(HINGLISH_RE_UNAMBIG, (m) =>
    HINGLISH_NUMBERS_UNAMBIG[m.toLowerCase()] ?? m,
  );
  out = out.replace(HINGLISH_RE_AMBIG, (whole, num: string) => {
    /* Preserve the context word — replace only the numeral prefix. */
    const lower = num.toLowerCase();
    const digit = HINGLISH_NUMBERS_AMBIG[lower];
    if (!digit) return whole;
    return digit + whole.slice(num.length);
  });
  return out;
}

/* ─── 2. English number-words ─────────────────────────────────────
 * Maps tens / teens / ones into digits in the range [1, 99]. Above 99
 * candidates use digits anyway, and "hundred and fifty" collides with
 * non-salary registers. */
const EN_NUM: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const TENS = "twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety";
const ONES = "one|two|three|four|five|six|seven|eight|nine";
const TEENS = "eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen";
const EN_NUM_RE = new RegExp(
  `\\b((?:${TENS})(?:[-\\s]?(?:${ONES}))?|${TEENS}|${ONES}|ten)\\b`,
  "gi",
);

function substituteEnglish(s: string): string {
  return s.replace(EN_NUM_RE, (whole) => {
    const norm = whole.toLowerCase().replace(/\s+/g, "-");
    const compound = norm.match(
      /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-?(one|two|three|four|five|six|seven|eight|nine)$/
    );
    if (compound) {
      const t = EN_NUM[compound[1]];
      const o = EN_NUM[compound[2]];
      if (t != null && o != null) return String(t + o);
    }
    const direct = EN_NUM[norm.replace(/-/g, "")] ?? EN_NUM[norm];
    return direct != null ? String(direct) : whole;
  });
}

/* ─── 3. Unit-suffix STT typo normalization ───────────────────────
 * Conservative: each pattern requires a numeric-context anchor (digit
 * before, or whitespace + currency/salary intent) so we don't
 * accidentally rewrite unrelated text. */

function normalizeUnitTypos(s: string): string {
  let out = s;
  /* "L P A" / "L-P-A" / "L.P.A." spelled out → "LPA". Only when the
   * three letters appear in sequence separated by spaces/hyphens/dots
   * and bordered by word boundaries. */
  out = out.replace(/\bL[\s\-.]*P[\s\-.]*A\b/gi, "LPA");
  /* "elpea" / "el pee ay" / "el p a" — letter-name spellouts. */
  out = out.replace(/\bel\s*pee\s*ay\b/gi, "LPA");
  out = out.replace(/\belpea\b/gi, "LPA");
  out = out.replace(/\bel\s+p\s+a\b/gi, "LPA");
  /* "lac" / "lacs" / "lacks" / "lax" → "lakh" — ONLY when paired with
   * a salary numeric context (preceding digit OR following "per
   * annum"). Without context, "lax" is an English word and "lacks"
   * is a verb; we'd corrupt unrelated text. */
  out = out.replace(
    /(\d(?:[\d,.]*\d)?\s*)(lacks?|lacs?|lax)\b/gi,
    (_m, num, _u) => `${num}lakh`,
  );
  /* "crore" mishears — STT writes "crow" / "krore" / "core" / "kror".
   * Same numeric-context anchor: digit before. */
  out = out.replace(
    /(\d(?:[\d,.]*\d)?\s*)(crow|krore|kror|core)\b/gi,
    (_m, num, _u) => `${num}crore`,
  );
  /* "rupies" / "ropee" / "rupie" → "rupees". These are unambiguous
   * misspellings — no English-register collision risk. */
  out = out.replace(/\brup(?:ies|ie|ies?|pies)\b/gi, "rupees");
  out = out.replace(/\bropee(?:s)?\b/gi, "rupees");
  return out;
}

/* ─── 4. Decimal-marker "point" normalization ─────────────────────
 * "thirty point five LPA" → after English-num pass becomes
 * "30 point 5 LPA" → here folded to "30.5 LPA". Only fires when the
 * "point" token is surrounded by digit tokens on both sides — a hard
 * gate against rewriting unrelated "point" mentions ("point taken",
 * "good point"). */
function foldDecimalPoint(s: string): string {
  return s.replace(/(\d+)\s+point\s+(\d+)/gi, (_m, a, b) => `${a}.${b}`);
}

/* ─── Public entry ─────────────────────────────────────────────── */

/** Normalize a candidate-turn utterance for downstream parsing.
 *
 *  Pure, idempotent. Order matters:
 *    Hinglish first (some Hindi number-words contain English fragments
 *    after substitution wouldn't); then English (multi-word compounds);
 *    then unit-typo fixups (require numeric anchor, so digits must be
 *    materialized first); finally decimal-point folding (also needs
 *    digits).
 */
export function normalizeForParsing(text: string): string {
  if (!text) return text;
  let out = text;
  out = substituteHinglish(out);
  out = substituteEnglish(out);
  out = normalizeUnitTypos(out);
  out = foldDecimalPoint(out);
  return out;
}
