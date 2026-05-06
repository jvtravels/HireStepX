/* HireStepX — Salary-domain STT cleanup.
 *
 * Speech-to-text routinely mangles Indian salary-negotiation
 * vocabulary in ways that turn the transcript into nonsense. Real
 * captures from production:
 *   "I would like to go for 20 legs at the celery"
 *   "18 legs as a base salary of it, and 28. Legs"
 *   "21 lakhs per annum CTZ from some other company"
 *   "NMCTC", "MCTC"
 * The user-facing transcript becomes unreadable and the evaluator
 * scores against gibberish.
 *
 * This helper runs ONLY when interviewType === "salary-negotiation"
 * and only on confirmed answer text (not interim STT). It applies
 * a small, conservative dictionary of Indian-salary mishears that
 * are specific enough to almost never collide with normal English.
 *
 * Conservative on purpose — we'd rather leave a real word alone
 * than over-correct. See src/__tests__/salaryStTCleanup.test.ts.
 */

export function cleanSalarySttArtifacts(text: string): string {
  if (!text) return text;
  let out = text;

  // "legs" / "leg" / "lags" / "lag" appearing next to a number or a
  // comp keyword = mishear of "lakhs" / "lakh". Only fire near a
  // digit OR a salary-context word so we don't mutate real "legs"
  // (anatomy) or "lag" (latency talk).
  out = out.replace(
    /(\d+(?:\.\d+)?)(\s*)\b(?:legs|leg|lags|lag)\b/gi,
    (_m, n, ws) => `${n}${ws}lakhs`,
  );
  // Number-word + legs/lags = lakhs ("five legs" → "five lakhs").
  out = out.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|twenty-five|thirty|forty|fifty)(\s+)\b(?:legs|leg|lags|lag)\b/gi,
    (_m, n, ws) => `${n}${ws}lakhs`,
  );
  out = out.replace(
    /\b(salary|base|CTC|annum|package|bonus|stipend|offer|target|expecting|want|asking)(\s+\w+){0,3}\s+\b(?:legs|leg|lags|lag)\b/gi,
    (m) => m.replace(/\b(?:legs|leg|lags|lag)\b/gi, "lakhs"),
  );

  // Common STT garblings around salary-context phrases:
  //   "Wide five lakhs"   → "I'd like five lakhs"
  //   "Wide like to"      → "I'd like to"
  //   "X eggs joining"    → "X as joining"
  //   "X eggs base"       → "X as base"
  // Only fire near a digit, the word "lakhs", or comp keywords so
  // these don't mutate normal English.
  out = out.replace(/\bWide\s+(?=\d|like|five|four|three|two|one|six|seven|eight|nine|ten|lakhs?)/g, "I'd ");
  out = out.replace(/(\d+(?:\.\d+)?\s+(?:lakhs?|LPA))\s+\beggs\b\s+(?=joining|base|variable|bonus|salary|CTC)/gi, "$1 as ");
  out = out.replace(/\b(lakhs?|LPA)\s+\beggs\b\s+/gi, "$1 as ");

  // "celery" right after "the/at/of/my" + comp context = "salary".
  out = out.replace(
    /\b(the|at|of|my|your|his|her|our|on)\s+celery\b/gi,
    (_m, lead) => `${lead} salary`,
  );
  // "Celery" before a comp keyword (base / CTC / package / annum)
  // = "salary". Catches "Celery base salary is very important".
  out = out.replace(
    /\bcelery\b(\s+(?:base|CTC|package|annum|component|pay|structure|total|breakdown))/gi,
    (_m, tail) => `salary${tail}`,
  );

  // "CTZ" / "MCTC" / "NMCTC" → "CTC". These tokens are exclusively
  // STT artifacts in this domain — no real meaning.
  out = out.replace(/\b(?:NMCTC|MCTC|CTZ|CDC)\b/g, "CTC");

  // "lacks" / "lac" near a number or "per annum" = "lakhs" / "lakh".
  out = out.replace(/(\d+(?:\.\d+)?)(\s*)\b(?:lacks|lac)\b/gi, (_m, n, ws) => `${n}${ws}lakhs`);

  // "L P A" spaced → "LPA"
  out = out.replace(/\bL\.?\s*P\.?\s*A\b\.?/g, "LPA");

  // Stray ". Legs" mid-sentence → ". Lakhs" (kept distinct so the
  // earlier digit-anchored rule doesn't have to match across a period).
  out = out.replace(/(\d+(?:\.\d+)?)\.\s*\b(?:Legs|Leg)\b/g, "$1 lakhs");

  // Word-number → digit when followed by "lakhs"/"LPA"/"crore". Lets
  // the fact extractor see "twelve lakhs" the same way as "12 lakhs".
  // Only applies in the salary-domain context (this whole helper
  // already runs only for salary-negotiation type), so collisions
  // with prose like "ten thousand pages" aren't a concern.
  const WORD_NUMS: Array<[RegExp, string]> = [
    [/\bone\b/gi, "1"],
    [/\btwo\b/gi, "2"],
    [/\bthree\b/gi, "3"],
    [/\bfour\b/gi, "4"],
    [/\bfive\b/gi, "5"],
    [/\bsix\b/gi, "6"],
    [/\bseven\b/gi, "7"],
    [/\beight\b/gi, "8"],
    [/\bnine\b/gi, "9"],
    [/\bten\b/gi, "10"],
    [/\beleven\b/gi, "11"],
    [/\btwelve\b/gi, "12"],
    [/\bfifteen\b/gi, "15"],
    [/\btwenty\b/gi, "20"],
    [/\bthirty\b/gi, "30"],
    [/\bforty\b/gi, "40"],
    [/\bfifty\b/gi, "50"],
  ];
  // Only swap word-numbers that are within 3 tokens of a salary unit.
  const salaryUnit = /\b(?:lakhs?|LPA|lpa|cr|crore|CTC|per\s+annum|annually)\b/i;
  out = out.replace(
    /\b(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty)\b(?=[^.?!]{0,40}?\b(?:lakhs?|LPA|lpa|cr|crore|CTC|per\s+annum|annually)\b)/gi,
    (m) => {
      for (const [re, digit] of WORD_NUMS) {
        if (re.test(m)) return digit;
      }
      return m;
    },
  );
  void salaryUnit;

  return out;
}
