/* HireStepX — Behavioural answer-analysis signals (Lift A)
 *
 * Pure, fast (no LLM) detectors that run on every behavioural turn and
 * feed deterministic cues to the follow-up coach. Today the engine only
 * emits `starGap` + `weHeavy`; real interviewers pick up four more
 * dimensions of an answer:
 *
 *   - vagueness:        scale words without numbers ("many", "several",
 *                       "a lot" with no quantification) — push for scale.
 *   - crispness:        word-count shape — thin (< 40), ok (40–300),
 *                       rambling (> 300). Drives a "set the scene" probe
 *                       when thin, and informs the coach when rambling.
 *   - selfAwareness:    candidate volunteered a self-critique without
 *                       being asked ("in hindsight", "I should have"). A
 *                       strong positive signal — suppresses the standard
 *                       "what would you do differently?" closer because
 *                       they already did.
 *   - defensiveness:    on a failure / mistake / regret question, the
 *                       answer deflects accountability ("wasn't my call",
 *                       "out of my control", "the team didn't"). Probe
 *                       fires a "what would you own?" redirect.
 *
 * These run every turn — keep them dependency-free regex matchers. No
 * heap allocations beyond what the regex engine already does. Empty /
 * null input must not throw; default to "no signal".
 *
 * Test pin: src/__tests__/behavioralAnswerSignals.test.ts.
 */

/** Scale-word matcher. Triggers vagueness ONLY when no numeric token is
 *  present anywhere in the answer — "we shipped to many customers" is
 *  vague, but "we shipped to many — about 1,200 — customers" is not. */
const VAGUENESS_WORDS_RE =
  /\b(many|several|a lot|lots|tons|some|few|various|most|multiple)\b/i;

/** Any digit anywhere in the text disqualifies vagueness. */
const NUMERIC_TOKEN_RE = /\b\d/;

/** Self-critique markers — candidate self-flagged growth without being
 *  asked. Strong positive signal. */
const SELF_AWARENESS_RE =
  /\b(in hindsight|looking back|i could have|i should have|with hindsight|i'd do .* differently|my mistake was|i underestimated|i misread|in retrospect)\b/i;

/** Failure / mistake / regret question — gates defensiveness detection. */
const FAILURE_QUESTION_RE =
  /\b(fail|mistake|wrong|missed|didn't go well|setback|regret)\b/i;

/** Deflection phrases — push blame off the candidate. Only meaningful in
 *  the failure-question context (otherwise an answer can legitimately
 *  describe team dynamics without it being a dodge). */
const DEFENSIVENESS_RE =
  /\b(but the team|but my manager|wasn't my call|out of my control|blame|fault was|because they|they didn't|to be honest, no one)\b/i;

/** True iff the answer uses scale words and has zero numeric tokens. */
export function detectVagueness(answer: string | null | undefined): boolean {
  const t = answer || "";
  if (!t) return false;
  if (NUMERIC_TOKEN_RE.test(t)) return false;
  return VAGUENESS_WORDS_RE.test(t);
}

/** Return the first scale-word hit (lowercased) when an answer is vague,
 *  else null. Lets coaching surfaces quote the candidate's *actual* hedge
 *  ("some", "few", "many") instead of a static example list — avoids the
 *  jarring "'many', 'several', 'a lot'" chip on an answer that said
 *  "some". Mirrors the quote-the-match discipline used in
 *  `resume_transcript_mismatch`. */
export function vaguenessMatch(answer: string | null | undefined): string | null {
  const t = answer || "";
  if (!t) return null;
  if (NUMERIC_TOKEN_RE.test(t)) return null;
  const m = t.match(VAGUENESS_WORDS_RE);
  return m ? m[0].toLowerCase() : null;
}

export type Crispness = "thin" | "ok" | "rambling";

/** Word-count shape. Thin: < 40, Ok: 40–300, Rambling: > 300. */
export function detectCrispness(answer: string | null | undefined): Crispness {
  const t = (answer || "").trim();
  if (!t) return "thin";
  const words = t.split(/\s+/).filter(Boolean).length;
  if (words < 40) return "thin";
  if (words > 300) return "rambling";
  return "ok";
}

/** True iff the candidate volunteered a self-critique phrase. */
export function detectSelfAwareness(answer: string | null | undefined): boolean {
  const t = answer || "";
  if (!t) return false;
  return SELF_AWARENESS_RE.test(t);
}

/** True iff the question is about a failure/mistake/regret AND the
 *  answer deflects accountability. Both gates must fire — deflection
 *  language is legitimate context outside a failure question. */
export function detectDefensiveness(
  questionText: string | null | undefined,
  answer: string | null | undefined,
): boolean {
  const q = questionText || "";
  const a = answer || "";
  if (!q || !a) return false;
  if (!FAILURE_QUESTION_RE.test(q)) return false;
  return DEFENSIVENESS_RE.test(a);
}

/** True iff the question itself is about a failure / mistake / regret.
 *  Exported for the cue precedence rules in `_behavioral-followup-bank`. */
export function isFailureQuestion(questionText: string | null | undefined): boolean {
  const q = questionText || "";
  if (!q) return false;
  return FAILURE_QUESTION_RE.test(q);
}

export interface BehaviouralAnswerSignals {
  vagueness: boolean;
  crispness: Crispness;
  selfAwarenessShown: boolean;
  defensiveness: boolean;
}

/** Convenience: compute all four signals in one call. Handlers that
 *  already have the question + answer in scope can pass them through
 *  to the follow-up coach as engine hints. */
export function detectBehaviouralAnswerSignals(opts: {
  questionText?: string | null;
  answer?: string | null;
}): BehaviouralAnswerSignals {
  return {
    vagueness: detectVagueness(opts.answer),
    crispness: detectCrispness(opts.answer),
    selfAwarenessShown: detectSelfAwareness(opts.answer),
    defensiveness: detectDefensiveness(opts.questionText, opts.answer),
  };
}
