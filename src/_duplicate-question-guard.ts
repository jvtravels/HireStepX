/* HireStepX — Duplicate question/follow-up text guard
 *
 * Pure function — answers "has this exact question already been asked
 * in this script?" Every follow-up insertion site upstream (stale-ref
 * races, a confused LLM echoing the prompt back, a cache collision)
 * can hand the engine a candidate follow-up whose text is identical to
 * a question already asked earlier in the same session. Nothing before
 * this guard checked text content — _follow-up-cap.ts only counts
 * turns, it can't tell two turns apart. Without this, that candidate
 * gets spliced into interviewScript and the candidate hears (or reads)
 * the same question twice with no new answer in between (BUG C).
 *
 * Comparison is exact-match after normalization (case, punctuation,
 * whitespace) — not fuzzy — so two related-but-distinct probes on the
 * same competency are never falsely flagged.
 *
 * See src/__tests__/duplicateQuestionGuard.test.ts.
 */

function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isDuplicateQuestionText(
  candidateText: string,
  script: ReadonlyArray<{ type: string; aiText?: string }>,
  uptoIndex: number,
): boolean {
  const candidate = normalizeQuestionText(candidateText);
  if (!candidate) return false;
  for (let i = 0; i < uptoIndex && i < script.length; i++) {
    const s = script[i];
    if (s.type !== "question" && s.type !== "follow-up") continue;
    if (!s.aiText) continue;
    if (normalizeQuestionText(s.aiText) === candidate) return true;
  }
  return false;
}
