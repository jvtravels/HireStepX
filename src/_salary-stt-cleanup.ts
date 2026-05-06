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

  // "legs" / "leg" appearing next to a number or a comp keyword =
  // mishear of "lakhs" / "lakh". Only fire near a digit OR a
  // salary-context word so we don't mutate real "legs".
  out = out.replace(
    /(\d+(?:\.\d+)?)(\s*)\b(?:legs|leg)\b/gi,
    (_m, n, ws) => `${n}${ws}lakhs`,
  );
  out = out.replace(
    /\b(salary|base|CTC|annum|package|bonus|stipend|offer)(\s+\w+){0,3}\s+\b(?:legs|leg)\b/gi,
    (m) => m.replace(/\b(?:legs|leg)\b/gi, "lakhs"),
  );

  // "celery" right after "the/at/of/my" + comp context = "salary".
  out = out.replace(
    /\b(the|at|of|my|your|his|her|our|on)\s+celery\b/gi,
    (_m, lead) => `${lead} salary`,
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

  return out;
}
