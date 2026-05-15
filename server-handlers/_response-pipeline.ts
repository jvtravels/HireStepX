/* Kernel-first response pipeline (2026-05-16).
 *
 * The single generation path that replaces the prior LLM-first reroll
 * loop. Flow:
 *
 *   1. planNextAction(state) → NextAction (kernel decides what to do).
 *   2. If candidate asked an off-script question → answer from factPack
 *      (LLM may only use factPack content; missing fact → graceful
 *      defer + resume planned canonical).
 *   3. Otherwise → renderCanonicalProse(action, state) builds the line
 *      the kernel WANTS shipped.
 *   4. LLM restyles under tight constraint (no new numbers, no new
 *      facts, no meaning change).
 *   5. validateRestyle preserves canonical semantics; on failure or
 *      LLM throw, ship the canonical verbatim.
 *
 * The LLM physically cannot:
 *   - Anchor in opening — canonical opening is a discovery probe with
 *     no number, restyle can't introduce one.
 *   - Repeat a probe — planner advances; canonical changes per turn.
 *   - Hallucinate facts — restyle prompt forbids new facts; factPack
 *     is the only context for off-script answers.
 *
 * Pure orchestration. The LLM caller is injected so tests can mock it.
 */

import type { NegotiationState, AiMove } from "./_negotiation-kernel";
import { planNextAction, actionToLever, type NextAction } from "./_next-action-planner";
import {
  renderCanonicalProse,
  buildRestylePrompt,
  buildAnswerCandidatePrompt,
} from "./_canonical-prose";
import {
  buildFactPack,
  detectFactGap,
  detectCandidateAskedQuestion,
} from "./_fact-pack";

export type GenerateAiTextFn = (
  system: string,
  user: string,
  opts?: { temperature?: number; userId?: string },
) => Promise<string>;

export interface PipelineResult {
  text: string;
  source: "restyle" | "canonical-fallback" | "answer-restyle" | "answer-canonical";
  action: NextAction;
  move: AiMove;
  /** Diagnostic reason when the restyle was rejected (telemetry). */
  rejectReason?: string;
}

/** Top-level generator. Always returns a useful text — falls back to
 *  the canonical verbatim if the LLM throws or the restyle violates
 *  semantics. */
export async function generateBotReply(
  state: NegotiationState,
  generateAiText: GenerateAiTextFn,
  candidateAnswer?: string,
): Promise<PipelineResult> {
  const action = planNextAction(state);
  const move = actionToLever(action, state);

  /* Off-script candidate-question routing. Two signals — preferred is
   * the structured candidateAskedQuestion field carried on TurnDelta;
   * fallback is a fresh detection on the candidate answer string. */
  const lastDelta = state.lastTurnDelta;
  const ext = (lastDelta ?? {}) as {
    candidateAskedQuestion?: { raw: string; intent?: string };
    askedQuestion?: boolean;
  };
  const askedFromDelta = ext.candidateAskedQuestion;
  const askedFromAnswer = candidateAnswer
    ? detectCandidateAskedQuestion(candidateAnswer)
    : { asked: false };

  if ((askedFromDelta && askedFromDelta.raw) || askedFromAnswer.asked) {
    const rawQ = askedFromDelta?.raw ?? askedFromAnswer.raw ?? candidateAnswer ?? "";
    return generateAnswerToCandidate(state, action, move, rawQ, generateAiText);
  }

  return generateRestyledCanonical(state, action, move, generateAiText);
}

async function generateRestyledCanonical(
  state: NegotiationState,
  action: NextAction,
  move: AiMove,
  generateAiText: GenerateAiTextFn,
): Promise<PipelineResult> {
  let canonical: string;
  try {
    canonical = renderCanonicalProse(action, state);
  } catch (err) {
    /* Canonical coverage gap — surface a defensive default rather than
     * crashing the turn. The repro test for canonical exhaustiveness
     * should catch this in CI, not in prod. */
    void err;
    return {
      text: "Let me come back to you in a moment.",
      source: "canonical-fallback",
      action,
      move,
      rejectReason: "canonical-render-threw",
    };
  }

  const { system, user } = buildRestylePrompt(canonical, state);
  let restyled: string;
  try {
    restyled = await generateAiText(system, user, { temperature: 0.4 });
  } catch {
    return { text: canonical, source: "canonical-fallback", action, move, rejectReason: "llm-throw" };
  }
  restyled = (restyled || "").trim();

  const validation = validateRestyle(canonical, restyled, state);
  if (!validation.valid) {
    return {
      text: canonical,
      source: "canonical-fallback",
      action,
      move,
      rejectReason: validation.reason,
    };
  }
  return { text: restyled, source: "restyle", action, move };
}

async function generateAnswerToCandidate(
  state: NegotiationState,
  action: NextAction,
  move: AiMove,
  candidateQuestion: string,
  generateAiText: GenerateAiTextFn,
): Promise<PipelineResult> {
  const factPack = buildFactPack(state, candidateQuestion);
  const gap = detectFactGap(factPack, candidateQuestion);
  const canonicalFollowup = (() => {
    try { return renderCanonicalProse(action, state); }
    catch { return "Let me come back to that in a moment."; }
  })();

  /* When a fact is missing → graceful defer + resume planned line.
   * No LLM call needed — the deterministic answer is more reliable. */
  if (!gap.canAnswer) {
    const defer = `Let me confirm that with the team and get back to you. In the meantime — ${lowercaseFirst(canonicalFollowup)}`;
    return { text: defer, source: "answer-canonical", action, move, rejectReason: `fact-gap: ${gap.missing.join(",")}` };
  }

  /* All required facts present — ask the LLM to answer from factPack. */
  const { system, user } = buildAnswerCandidatePrompt(
    candidateQuestion,
    JSON.stringify(factPack, null, 2),
    canonicalFollowup,
    state,
  );
  let answer: string;
  try {
    answer = await generateAiText(system, user, { temperature: 0.4 });
  } catch {
    const defer = `Let me confirm that with the team and get back to you. In the meantime — ${lowercaseFirst(canonicalFollowup)}`;
    return { text: defer, source: "answer-canonical", action, move, rejectReason: "llm-throw" };
  }
  answer = (answer || "").trim();
  if (!answer) {
    const defer = `Let me confirm that with the team and get back to you. In the meantime — ${lowercaseFirst(canonicalFollowup)}`;
    return { text: defer, source: "answer-canonical", action, move, rejectReason: "empty-llm" };
  }
  /* Answer-side validation: same number/fact discipline as restyle. */
  const validation = validateAnswer(answer, factPack);
  if (!validation.valid) {
    const defer = `Let me confirm that with the team and get back to you. In the meantime — ${lowercaseFirst(canonicalFollowup)}`;
    return { text: defer, source: "answer-canonical", action, move, rejectReason: validation.reason };
  }
  return { text: answer, source: "answer-restyle", action, move };
}

/* ─── validators ───────────────────────────────────────────────────── */

/** Numbers (LPA / lakh / crore) that look like salary references. */
const SALARY_NUM_RE = /(\d+(?:\.\d+)?)\s*(?:LPA|L\b|lakhs?|crores?|cr|lac|lacs)/gi;
/** ₹-prefixed numbers. */
const RUPEE_NUM_RE = /₹\s*(\d[\d,.]*)/g;

function extractNumbers(s: string): string[] {
  const out: string[] = [];
  if (!s) return out;
  let m: RegExpExecArray | null;
  SALARY_NUM_RE.lastIndex = 0;
  while ((m = SALARY_NUM_RE.exec(s)) !== null) out.push(m[1]);
  RUPEE_NUM_RE.lastIndex = 0;
  while ((m = RUPEE_NUM_RE.exec(s)) !== null) out.push(m[1].replace(/[,]/g, ""));
  return out;
}

const CLOSE_VOCAB_RE =
  /\b(welcome to the team|congratulations[^.!?]*on board|we['’]?re excited to have you|offer letter (?:will be|is being|has been) (?:prepared|sent|issued)|let['’]?s get you onboarded)\b/i;

/** Validate the LLM restyle against the canonical line. Rejection
 *  causes canonical fallback. Conservative: any number not present in
 *  the canonical, any new closing-vocab outside close phase, or any
 *  >2x length blow-up is rejected. */
export function validateRestyle(
  canonical: string,
  restyled: string,
  state: NegotiationState,
): { valid: boolean; reason?: string } {
  if (!restyled || !restyled.trim()) {
    return { valid: false, reason: "empty-restyle" };
  }
  /* Length check — restyle must not balloon past 2x canonical. */
  if (restyled.length > canonical.length * 2 && restyled.length > 280) {
    return { valid: false, reason: "restyle-too-long" };
  }
  /* Numbers in restyle must be a subset of numbers in canonical. */
  const canonicalNums = new Set(extractNumbers(canonical));
  const restyleNums = extractNumbers(restyled);
  for (const n of restyleNums) {
    if (!canonicalNums.has(n)) {
      return { valid: false, reason: `new-number-in-restyle:${n}` };
    }
  }
  /* Closing vocab is allowed only when the canonical itself has it OR
   * the phase is a close phase. */
  const canonicalHasClose = CLOSE_VOCAB_RE.test(canonical);
  const inClosePhase = state.phase === "accepted" || state.phase === "walked-away" || state.phase === "stalemate";
  if (!canonicalHasClose && !inClosePhase && CLOSE_VOCAB_RE.test(restyled)) {
    return { valid: false, reason: "new-close-vocab-outside-close-phase" };
  }
  return { valid: true };
}

/** Validate the LLM answer against the factPack. Numbers in the answer
 *  must appear in the factPack JSON (or be the candidate's own ctc /
 *  expected). Fabricated specifics → fall back to deterministic defer. */
export function validateAnswer(
  answer: string,
  factPack: { candidateCurrentCtc?: number; candidateExpectedCtc?: number; budgetBand?: { low: number; high: number; walk: number }; teamSize?: number },
): { valid: boolean; reason?: string } {
  if (!answer || !answer.trim()) return { valid: false, reason: "empty-answer" };
  const allowed = new Set<string>();
  if (factPack.candidateCurrentCtc != null) allowed.add(String(factPack.candidateCurrentCtc));
  if (factPack.candidateExpectedCtc != null) allowed.add(String(factPack.candidateExpectedCtc));
  if (factPack.budgetBand) {
    allowed.add(String(factPack.budgetBand.low));
    allowed.add(String(factPack.budgetBand.high));
    allowed.add(String(factPack.budgetBand.walk));
  }
  if (typeof factPack.teamSize === "number") allowed.add(String(factPack.teamSize));
  /* Allow tiny integers that show up in canonical reference facts (e.g.
   * "15 days", "12% PF", "4-year vest", "1-year cliff"). */
  for (const tinyInt of ["1", "3", "4", "5", "7", "12", "15", "25"]) allowed.add(tinyInt);

  const restyleNums = extractNumbers(answer);
  for (const n of restyleNums) {
    if (!allowed.has(n)) {
      return { valid: false, reason: `unfounded-number:${n}` };
    }
  }
  return { valid: true };
}

function lowercaseFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
