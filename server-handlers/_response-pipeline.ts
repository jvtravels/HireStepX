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
  BANNED_RECRUITER_IDIOM_RE,
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

/** BUG-4 (PDF#24, 2026-05-16) — every defer path used to ship the
 *  identical "Let me confirm that with the team and get back to you. In
 *  the meantime — ..." string. That phrase (a) models the bot as a
 *  passthrough who has to escalate every question, (b) promises a
 *  callback that the simulator can't honour, and (c) makes the
 *  candidate hear the same line three turns running.
 *
 *  The honest fix: a defer text that varies by reason and pivots back
 *  to the planned canonical line without faking a callback. Reasons:
 *    - "fact-gap"   → unknowable from the session FactPack (workMode,
 *                     team size, reporting line). Acknowledge openly.
 *    - "llm-throw"  → LLM error; we can't restyle but the canonical
 *                     line is already loaded.
 *    - "empty-llm"  → LLM returned blank; same as above.
 *    - "validation" → LLM injected a number/fact the factPack didn't
 *                     authorise. Quietly fall back to the canonical.
 *
 *  In all branches we ship the canonical follow-up so the negotiation
 *  keeps moving — the difference is only the lead-in. */
function buildDeferLead(reason: "fact-gap" | "llm-throw" | "empty-llm" | "validation", missing: string[]): string {
  if (reason === "fact-gap") {
    const topic = missing[0] ?? "";
    /* Indian-recruiter idiom — honest about what we don't know
     * without committing to "circle back" / "get back to you". */
    if (topic === "workMode")     return "On the work mode, I'll keep that one open for now —";
    if (topic === "joiningWindow") return "On the joining side, that's something we firm up post-offer —";
    if (topic === "teamSize")     return "Team size is something the HM walks through in the next round —";
    if (topic === "reportingTo")  return "Reporting line gets confirmed once the band is locked —";
    return "That detail is one I'd rather not commit to off the cuff —";
  }
  /* llm-throw / empty-llm / validation — quietly fall through to the
   * planned next move; no fake-callback theatre. */
  return "Coming back to the structure —";
}

function buildDeferText(
  reason: "fact-gap" | "llm-throw" | "empty-llm" | "validation",
  missing: string[],
  canonicalFollowup: string,
): string {
  const lead = buildDeferLead(reason, missing);
  return `${lead} ${lowercaseFirst(canonicalFollowup)}`;
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
    const defer = buildDeferText("fact-gap", gap.missing, canonicalFollowup);
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
    const defer = buildDeferText("llm-throw", [], canonicalFollowup);
    return { text: defer, source: "answer-canonical", action, move, rejectReason: "llm-throw" };
  }
  answer = (answer || "").trim();
  if (!answer) {
    const defer = buildDeferText("empty-llm", [], canonicalFollowup);
    return { text: defer, source: "answer-canonical", action, move, rejectReason: "empty-llm" };
  }
  /* Answer-side validation: same number/fact discipline as restyle. */
  const validation = validateAnswer(answer, factPack);
  if (!validation.valid) {
    const defer = buildDeferText("validation", [], canonicalFollowup);
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

/** Discovery-probe ack-prefix vocab. buildDiscoveryAck emits one of
 *  six phrases ("Noted on …", "Got it on …", "Understood on …",
 *  "Appreciate the colour …"). When the kernel canonical opens with
 *  any of these, the restyle MUST keep the acknowledgement gesture so
 *  the bot doesn't sound transactional. We don't require verbatim
 *  reproduction — Indian recruiter idiom has several broadly-aligned
 *  near-equivalents ("right, on the X side …", "thanks for that —")
 *  so we accept any of an extended vocab set. */
const ACK_VOCAB_RE =
  /\b(noted|got it|understood|appreciate|right[,\s—]+on|thanks for that|fair enough|fine,?\s+so|okay,?\s+on|alright,?\s+on)\b/i;

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
  /* PDF#24 follow-up (2026-05-16) — ack-prefix preservation. When the
   * kernel canonical was authored with a discovery-probe acknowledgement
   * prefix (buildDiscoveryAck), the restyle MUST preserve some form of
   * acknowledgement. The restyle prompt explicitly permits opening-phrase
   * changes, so without this rule the LLM can fully strip the ack and
   * regress to the transactional cadence the prefix was meant to fix.
   * The vocab set is broad — any of "noted", "got it", "understood",
   * "appreciate", "right on …", "thanks for that", "fair enough" is fine. */
  if (ACK_VOCAB_RE.test(canonical) && !ACK_VOCAB_RE.test(restyled)) {
    return { valid: false, reason: "ack-prefix-stripped" };
  }
  /* Defect 2 (2026-05-16) — banned Indian-recruiter idiom (US-tech
   * recruiter phrases like "circle back", "touch base", "on board",
   * "synergy", "reach out") MUST NOT leak into the restyle output.
   * Canonical never emits these (renderCanonicalProse is curated), so
   * any occurrence in the restyle is the LLM ignoring the banned-list
   * directive. Fall back to canonical verbatim. */
  if (BANNED_RECRUITER_IDIOM_RE.test(restyled)) {
    return { valid: false, reason: "banned-idiom-leaked" };
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
  /* Defect 2 (2026-05-16) — answer path also enforces the banned-idiom
   * floor. Off-script answers go through the LLM with a factPack hint,
   * which historically leaked phrases like "let me get back to you" /
   * "circle back" on fact-gap defers. Pipeline-built defers use the
   * deterministic `buildDeferLead` text instead. */
  if (BANNED_RECRUITER_IDIOM_RE.test(answer)) {
    return { valid: false, reason: "banned-idiom-leaked" };
  }
  return { valid: true };
}

function lowercaseFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}
