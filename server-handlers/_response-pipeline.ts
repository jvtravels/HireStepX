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

import { isVerbatimRepeat, type NegotiationState, type AiMove, type NegotiationPhase } from "./_negotiation-kernel";
import { planNextAction, actionToLever, type NextAction } from "./_next-action-planner";
import {
  renderCanonicalProse,
  buildRestylePrompt,
  buildAnswerCandidatePrompt,
  BANNED_RECRUITER_IDIOM_RE,
  IDIOM_PER_UTTERANCE_CAP,
  countPreferredIdioms,
  ACK_TEMPLATES,
  META_DIRECTIVE_TOKENS_RE,
  FACT_GROUNDING_HEDGE,
} from "./_canonical-prose";
import { extractSalaryScalars } from "./_fact-parser";
import {
  buildFactPack,
  detectFactGap,
  detectCandidateAskedQuestion,
} from "./_fact-pack";
import type { QuestionIntent } from "./_question-intent";
import { captureServerEvent } from "./_posthog";

/* PDF#42 BUG-B (2026-05-21) — set of reactive-followup topics whose
 * canonical prose is authored in planWiredProfileFollowup (planner)
 * and MUST be shipped through the restyle path. If a candidate's
 * question routes the planner to one of these, the pipeline must NOT
 * pre-empt with the LLM answer-from-factPack path. Keep in sync with
 * the WiredRule list in _next-action-planner.ts.
 *
 * Note: "answer-direct" is the GENERIC fallback (not wired) and stays
 * on the LLM-answer path; only the topic-specific wired entries skip
 * the answer path. */
const WIRED_PROFILE_TOPICS = new Set<string>([
  "wants-higher-base",
  "wants-joining-bonus",
  "wants-relocation-allowance",
  "spouse-family-context",
  "reporting-structure",
  "growth-path",
  "team-size",
  "tax-implication",
  "bgv-concern",
  "moonlighting-policy",
  "range-to-point",
  "range-deflection",
  "market-data-reference",
]);

/** Chaos audit (2026-05-21) — structural prompt-template artifacts.
 *  Matches: unfilled mustache `{{name}}`, markdown code fences,
 *  lead-anchored `system:` framing, the literal recruiter persona
 *  string. Used by the pipeline boundary check to swap to a safe
 *  canonical stub when an LLM regurgitates the prompt scaffolding
 *  instead of producing prose. */
export const PROMPT_ARTIFACT_RE =
  /\{\{[a-z_][a-z0-9_]*\}\}|```|^\s*system\s*:|you\s+are\s+a\s+recruiter/i;

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
  distinctId?: string,
): Promise<PipelineResult> {
  /* PDF #45 fix (2026-05-22) — outermost safety net. User-reported
   * Flipkart Sr PD session DIED on T17 after a frustration-recovery
   * turn; the planner verified-never-returns-null, the LLM call has
   * its own catch, but ANY OTHER thrown error in the pipeline (e.g.
   * a validator panic, a fact-pack assembly throw, a prose helper
   * missing arm) would bubble up to negotiate-turn.ts's 500 handler
   * and end the session. Wrap the whole pipeline so the worst case
   * is a benign continuation prompt, never a session-killer. */
  try {
    return await generateBotReplyInner(state, generateAiText, candidateAnswer, distinctId);
  } catch (err) {
    void err;
    return {
      text: "Let me come back to that — what would be most useful to cover next from your side?",
      source: "canonical-fallback",
      action: { kind: "terminal-restate" } as NextAction,
      move: actionToLever({ kind: "terminal-restate" } as NextAction, state),
      rejectReason: "pipeline-outer-throw",
    };
  }
}

async function generateBotReplyInner(
  state: NegotiationState,
  generateAiText: GenerateAiTextFn,
  candidateAnswer?: string,
  distinctId?: string,
): Promise<PipelineResult> {
  const rawAction = planNextAction(state);
  /* Audit follow-up (2026-05-21) — planner → pipeline shape guard.
   * planNextAction is the kernel's authoritative decision; downstream
   * validators (NEXT_ACTION_CONTRACT, validateRestyle) all key off
   * action.kind. If a future planner branch ever returns a malformed
   * shape (missing kind, non-string kind, null, etc.), the validators
   * silently no-op and the LLM lands an unchecked restyle. Catch
   * malformed planner output at the boundary and degrade to a safe
   * terminal-restate (which has no contract requirements other than
   * canonical-verbatim) before the LLM is invoked. */
  const actionShapeOk =
    rawAction && typeof rawAction === "object" && typeof (rawAction as { kind?: unknown }).kind === "string" && (rawAction as { kind: string }).kind.length > 0;
  const action: NextAction = actionShapeOk
    ? (rawAction as NextAction)
    : ({ kind: "terminal-restate" } as NextAction);
  if (!actionShapeOk) {
    /* Audit follow-up (2026-05-25) — emit observability when the planner
     * shape-guard fires. Without this, a future planner regression that
     * returns malformed actions in prod is silently degraded to
     * terminal-restate with zero signal. Fire-and-forget to PostHog so
     * ops can alert on count > 0. */
    // eslint-disable-next-line no-console
    console.warn("[planner-shape-guard] degraded malformed action", {
      raw_kind: (rawAction as { kind?: unknown } | null)?.kind ?? null,
      phase: (state as { phase?: string }).phase ?? null,
      turn_index: (state as { turnIndex?: number }).turnIndex ?? null,
    });
    void captureServerEvent(
      "negotiation_planner_malformed",
      distinctId ?? (state as { sessionId?: string }).sessionId ?? "anonymous",
      {
        raw_kind: typeof (rawAction as { kind?: unknown } | null)?.kind === "string"
          ? (rawAction as { kind: string }).kind
          : null,
        phase: (state as { phase?: string }).phase ?? null,
        turn_index: (state as { turnIndex?: number }).turnIndex ?? null,
      },
    );
  }
  const move = actionToLever(action, state);

  /* AR2 telemetry wire-in (2026-05-25, prod-arm 2026-05-25b) — surface
   * turn-coherence warnings to PostHog so live regressions get caught
   * the way the regression harness catches them in tests. In prod the
   * sample rate is controlled by POSTHOG_COHERENCE_SAMPLE (0..1, default
   * 0 = off). Set to 0.1 at launch, ramp to 1.0 after burn-in. The
   * fire-and-forget posthog emit cannot throw (telemetry contract), so
   * we don't await or wrap. */
  try {
    const prevAi = state.lastShippedAction
      ? (state.lastShippedAction as NextAction)
      : null;
    const warnings = validateTurnCoherence(prevAi, candidateAnswer ?? null, action, state);
    if (warnings.length > 0) {
      void emitCoherenceWarnings(state, warnings, distinctId);
    }
  } catch {
    /* never break the pipeline on a telemetry path */
  }

  /* Off-script candidate-question routing. Two signals — preferred is
   * the structured candidateAskedQuestion field carried on TurnDelta;
   * fallback is a fresh detection on the candidate answer string. */
  const lastDelta = state.lastTurnDelta;
  const ext = (lastDelta ?? {}) as {
    candidateAskedQuestion?: { raw: string; intent?: QuestionIntent };
    askedQuestion?: boolean;
  };
  const askedFromDelta = ext.candidateAskedQuestion;
  const askedFromAnswer = candidateAnswer
    ? detectCandidateAskedQuestion(candidateAnswer)
    : { asked: false };

  let result: PipelineResult;
  if ((askedFromDelta && askedFromDelta.raw) || askedFromAnswer.asked) {
    const rawQ = askedFromDelta?.raw ?? askedFromAnswer.raw ?? candidateAnswer ?? "";
    /* Audit follow-up (2026-05-21) — cross-turn answer coherence
     * short-circuit. If the candidate is asking about an intent the
     * bot has ALREADY answered earlier in this session, skip the LLM
     * and ship a deterministic reconfirmation of the prior answer.
     * Two reasons this lives upstream of generateAnswerToCandidate:
     *   1. The LLM, on a fresh factPack, can drift to an
     *      inconsistent factual answer (different vesting math, a
     *      different team-size guess) — risk #4 from the 2026-05-21
     *      audit.
     *   2. Returning the prior canonical answer is strictly cheaper
     *      (no LLM call) and strictly safer (the answer was already
     *      validated when it shipped originally).
     * Skip on the same-turn-as-prior-answer case: if the intent was
     * answered THIS turn we're still inside the same exchange and
     * should let the planner's prose run normally. */
    const askedIntent = askedFromDelta?.intent ?? askedFromAnswer.intent;
    const ledger = state.answeredQuestionLedger;
    const priorAnswer =
      typeof askedIntent === "string" && askedIntent.length > 0 && ledger
        ? ledger[askedIntent]
        : undefined;
    if (
      priorAnswer &&
      typeof priorAnswer.answerText === "string" &&
      priorAnswer.answerText.length > 0 &&
      priorAnswer.turn < state.turnIndex
    ) {
      result = {
        text: `Just to reconfirm — ${priorAnswer.answerText}`,
        source: "answer-canonical",
        action,
        move,
        rejectReason: `repeat-intent:${askedIntent}`,
      };
    } else {
      result = await generateAnswerToCandidate(state, action, move, rawQ, generateAiText);
    }
  } else {
    result = await generateRestyledCanonical(state, action, move, generateAiText);
  }

  /* BUG E fix (PDF#31 T18, 2026-05-18) — defense-in-depth boundary.
   * If for ANY reason a meta-directive token (e.g. "Answer the
   * candidate's question first; checklist advance pauses…") slipped
   * through canonical-prose or the LLM restyle/answer paths, swap to
   * a safe deterministic stub before the candidate ever sees it. The
   * planner-side and canonical-side fixes should make this branch
   * unreachable; keeping the boundary check guards against future
   * regressions of the same class. */
  if (META_DIRECTIVE_TOKENS_RE.test(result.text)) {
    return {
      text: "Happy to address that — let me come back to where we were.",
      source: "canonical-fallback",
      action,
      move,
      rejectReason: "meta-directive-leak",
    };
  }
  /* Chaos audit (2026-05-21) — defense-in-depth boundary for raw
   * prompt-template artifacts. If the LLM regurgitates an unfilled
   * mustache (`{{candidate_name}}`), a markdown code-fence, a raw
   * `system:` lead, or the literal recruiter persona ("you are a
   * recruiter"), it means the LLM has reflected the system prompt
   * back instead of producing prose. The restyle/answer validators
   * are salary-number focused and don't catch these structural
   * artifacts. Boundary-swap to a safe stub so the candidate never
   * sees the seams. */
  if (PROMPT_ARTIFACT_RE.test(result.text)) {
    return {
      text: "Let me circle back on that — give me a beat to think it through.",
      source: "canonical-fallback",
      action,
      move,
      rejectReason: "prompt-artifact-leak",
    };
  }
  /* PDF#31 BUG F fix (2026-05-18) — empty / whitespace-only text would
   * crash the downstream UI render and looked like an abrupt session
   * end in the Meesho/Prita replay. Defense-in-depth: any path that
   * fails to produce visible prose ships a neutral stub so the session
   * can recover gracefully. */
  if (!result.text || !result.text.trim()) {
    return {
      text: "Let me come back to that in a moment.",
      source: "canonical-fallback",
      action,
      move,
      rejectReason: "empty-text",
    };
  }
  /* User-reported bug (2026-05-22, Flipkart transcript T17/T19) —
   * recent-bot-prose de-dup. The byte-identical "Coming back to the
   * structure — okay. Happy to address that — let me come back to
   * where we were." shipped twice in a row because the META boundary
   * fallback and the answer-path defer both bypass `isVerbatimRepeat`
   * for one path or another. Defense-in-depth: at the final pipeline
   * boundary, normalize the proposed text and compare against the last
   * N AI turns from conversationLog. On match, ship LOOP_BREAKER_STUB
   * once so the candidate at least sees something different. The
   * ROOT-cause planner fix (offer-breakdown disclosure branch) prevents
   * the repeat from being generated in the first place; this is a
   * defense-in-depth guard for any future class of repeat. */
  {
    const proposed = normalizeForLoopCompare(result.text);
    if (proposed.length > 0) {
      const log = state.conversationLog ?? [];
      let dup = false;
      for (let i = log.length - 1, seen = 0; i >= 0 && seen < 3; i--) {
        const e = log[i];
        if (!e || e.speaker !== "ai" || !e.text) continue;
        seen++;
        if (normalizeForLoopCompare(e.text) === proposed) {
          dup = true;
          break;
        }
      }
      if (dup) {
        return {
          text: LOOP_BREAKER_STUB,
          source: "canonical-fallback",
          action,
          move,
          rejectReason: `recent-prose-dedup:${result.rejectReason ?? result.source}`,
        };
      }
    }
  }
  return result;
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
  /* LN7 / Audit Pass 4 (PDF#27, 2026-05-17) — strip typographic curly
   * quotes BEFORE validateRestyle so downstream regex matches see
   * straight quotes. Silent normalization — not a rejection reason. */
  restyled = stripWrappingQuotes(stripCurlyQuotes((restyled || "").trim()));

  const validation = validateRestyle(canonical, restyled, state, action);
  if (!validation.valid) {
    return {
      text: canonical,
      source: "canonical-fallback",
      action,
      move,
      rejectReason: validation.reason,
    };
  }
  /* PDF#30 R4 (2026-05-18, Meesho/Prita T18/T20/T22) — verbatim-repeat
   * guard. The kernel exports `isVerbatimRepeat` but no path called it,
   * so the pipeline could ship the IDENTICAL sentence three turns in a
   * row when the planner stayed on the same lever and the LLM landed
   * on the same content-word prefix. We reject the restyle (falls back
   * to canonical) if it verbatim-matches state.lastAiText. If the
   * canonical ALSO matches lastAiText, the planner is the one looping —
   * surface a deterministic stub that breaks the repeat instead of
   * shipping a third copy. */
  if (isVerbatimRepeat(restyled, state)) {
    if (isVerbatimRepeat(canonical, state)) {
      return {
        text: "Let me step back for a moment — what would be most useful to cover next from your side?",
        source: "canonical-fallback",
        action,
        move,
        rejectReason: "verbatim-repeat-canonical",
      };
    }
    return {
      text: canonical,
      source: "canonical-fallback",
      action,
      move,
      rejectReason: "verbatim-repeat-restyle",
    };
  }
  /* PDF#36 Fix A1 (2026-05-19) — leading-ack-rotation loop guard at
   * pipeline boundary. byte-identical comparisons (isVerbatimRepeat)
   * miss the case where the body of two consecutive AI turns is the
   * same but the leading ack word rotates ("Got it. X" → "Okay. X").
   * Catch it here so the deterministic loop-breaker fires instead of
   * shipping the restyle and waiting for the negotiate-turn boundary
   * guard to substitute. */
  if (isLeadingAckRotationRepeat(restyled, state.lastAiText)) {
    return {
      text: LOOP_BREAKER_STUB,
      source: "canonical-fallback",
      action,
      move,
      rejectReason: "leading-ack-repeat-restyle",
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
    if (topic === "teamSize")     return "Team size is something the hiring manager will walk you through in the next round —";
    if (topic === "reportingTo")  return "Reporting line gets confirmed once your grade is finalised —";
    return "Let me check on that and come back to you —";
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

  /* PDF#42 BUG-B (2026-05-21) — wired-profile precedence.
   *
   * When the planner has already routed this turn to a wired-profile-
   * followup (the candidate's question matched candidateProfile flags
   * like wantsHigherBase / wantsJoiningBonus / askedAboutTeamSize),
   * the canonical prose is itself the substantive, topic-correct
   * answer. Inviting the LLM to answer-from-factPack is BOTH
   * unnecessary (canonical already answers) and unsafe (the answer-
   * path validator only catches salary-formatted numbers, so the LLM
   * can leak fabricated facts like "42 people across three pods" on
   * non-salary topics).
   *
   * Architectural decision: for wired-profile topics, ship the
   * canonical verbatim. No LLM, no restyle. The deterministic answer
   * is strictly better than the LLM freelancing — pre-fix, the LLM
   * famously emitted "Base salary is a fixed component, and we don't
   * negotiate it separately from the CTC" when the wired canonical
   * was "Understood that fixed weight matters to you — is that to
   * bank against EMIs or to anchor the next appraisal cycle?". */
  if (
    action.kind === "reactive-followup" &&
    WIRED_PROFILE_TOPICS.has(action.topic)
  ) {
    return {
      text: canonicalFollowup,
      source: "canonical-fallback",
      action,
      move,
      rejectReason: `wired-profile-topic:${action.topic}`,
    };
  }

  /* PDF#42 BUG-C (2026-05-21) — every defer early-return below used to
   * ship its built text without running the loop guards, which meant a
   * second consecutive validation rejection (or fact-gap, llm-throw,
   * empty-llm, meta-leak, length-cap) emitted byte-identical defer text
   * twice in a row. Live capture: T23 LLM-answer shipped, T25 LLM
   * regenerated the same text and validation-rejected on both turns,
   * defer was identical, no guard fired. Route every defer through
   * `shipDefer` so the verbatim-repeat / leading-ack-repeat / META
   * checks all run before the text leaves the pipeline. */
  const shipDefer = (
    defer: string,
    rejectReason: string,
  ): PipelineResult => {
    if (
      isVerbatimRepeat(defer, state) ||
      isLeadingAckRotationRepeat(defer, state.lastAiText)
    ) {
      return {
        text: LOOP_BREAKER_STUB,
        source: "answer-canonical",
        action,
        move,
        rejectReason: `${rejectReason}+defer-repeat`,
      };
    }
    return { text: defer, source: "answer-canonical", action, move, rejectReason };
  };

  /* When a fact is missing → graceful defer + resume planned line.
   * No LLM call needed — the deterministic answer is more reliable. */
  if (!gap.canAnswer) {
    const defer = buildDeferText("fact-gap", gap.missing, canonicalFollowup);
    return shipDefer(defer, `fact-gap: ${gap.missing.join(",")}`);
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
    return shipDefer(defer, "llm-throw");
  }
  answer = (answer || "").trim();
  if (!answer) {
    const defer = buildDeferText("empty-llm", [], canonicalFollowup);
    return shipDefer(defer, "empty-llm");
  }
  /* Answer-side validation: same number/fact discipline as restyle.
   * PDF#29 Bug 5 (2026-05-18) — thread stateContext so the semantic
   * guards (unfounded-final-offer-claim, band-leak-pre-anchor) fire
   * on this path too. */
  const validation = validateAnswer(answer, factPack, {
    highestOfferMade: state.highestOfferMade,
    phase: state.phase,
  });
  if (!validation.valid) {
    const defer = buildDeferText("validation", [], canonicalFollowup);
    return shipDefer(defer, validation.reason ?? "validation-failed");
  }
  /* Audit follow-up (2026-05-21) — fact-grounding validator. Catches
   * non-numeric LLM hallucinations (manager names, office addresses,
   * insurance carriers) that `validateAnswer` is blind to. On failure
   * we ship the canonical hedge `FACT_GROUNDING_HEDGE` rather than the
   * planner's canonicalFollowup — the hedge is a topic-neutral stall
   * move (defer to hiring manager) which is the safe real-world
   * resolution. Defense-in-depth: this runs in addition to
   * `validateAnswer`, not instead of it. */
  const grounding = validateAnswerGrounding(answer, factPack);
  if (!grounding.ok) {
    return shipDefer(
      FACT_GROUNDING_HEDGE,
      grounding.reason ?? "fact-grounding-failed",
    );
  }
  /* PDF#36 Fix A4 (2026-05-19) — META directive leak on the answer
   * path. The boundary META check in generateBotReply runs AFTER this
   * returns, but its only fallback is a generic stub. We prefer the
   * deterministic defer + canonical follow-up here so the candidate
   * gets a usable answer surface, not the boundary's generic line. */
  if (META_DIRECTIVE_TOKENS_RE.test(answer)) {
    const defer = buildDeferText("validation", [], canonicalFollowup);
    return shipDefer(defer, "meta-directive-leak-answer");
  }
  /* PDF#36 Fix B4 (2026-05-19) — answer-path sentence-length cap.
   * The restyle path enforces this via validateRestyle; the answer
   * path historically did not, so kitchen-sink 50+ word single-
   * sentence answers shipped unchecked. Same cap as restyle. */
  if (checkSentenceLength(answer) !== "ok") {
    const defer = buildDeferText("validation", [], canonicalFollowup);
    return shipDefer(defer, "answer-too-long");
  }
  /* PDF#36 Fix A1 (2026-05-19) — leading-ack-rotation loop guard on
   * the answer path. The negotiate-turn boundary guard catches this
   * AFTER the pipeline ships, but moving the check upstream means we
   * surface a deterministic loop-breaker via the defer cadence
   * instead of letting the boundary substitute its own stub. */
  if (isLeadingAckRotationRepeat(answer, state.lastAiText)) {
    return {
      text: LOOP_BREAKER_STUB,
      source: "answer-canonical",
      action,
      move,
      rejectReason: "leading-ack-repeat-answer",
    };
  }
  /* PDF#30 R4 (2026-05-18) — same verbatim-repeat guard on the answer
   * path. If the LLM's answer is identical to the prior AI turn, defer
   * to the deterministic canonical follow-up instead. */
  if (isVerbatimRepeat(answer, state)) {
    const defer = buildDeferText("validation", [], canonicalFollowup);
    return shipDefer(defer, "verbatim-repeat-answer");
  }
  return { text: answer, source: "answer-restyle", action, move };
}

/** PDF#36 Fix A1 (2026-05-19) — leading-ack-rotation loop detector.
 *  Same normalize logic as the negotiate-turn boundary guard: strip an
 *  optional leading ack word and compare bodies. Returns true when the
 *  proposed text differs from `lastAiText` ONLY by rotation of the
 *  leading ack token. */
const LEADING_ACK_RE_PIPELINE =
  /^\s*(?:got it|okay|ok|right|sure|alright|noted|understood|fair enough|fine|i hear you)[\s,.\-—:;]+/i;
function normalizeForLoopCompare(s: string): string {
  return (s || "")
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    /* Audit fix (2026-05-22) — collapse internal punctuation so prose
     * that differs only by `—` vs `,` vs `;` vs `:` vs ` - ` collapses
     * to the same key. Without this the T17/T19 dedup misses the same
     * sentence punctuated differently by a restyling LLM. */
    .replace(/[\u2014\u2013,;:]+/g, " ")
    .replace(/\s+-\s+/g, " ")
    .replace(LEADING_ACK_RE_PIPELINE, "")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
}
export function isLeadingAckRotationRepeat(
  proposed: string,
  lastAiText: string | undefined,
): boolean {
  const prior = normalizeForLoopCompare(lastAiText || "");
  const next = normalizeForLoopCompare(proposed);
  return prior.length > 0 && next.length > 0 && prior === next;
}
const LOOP_BREAKER_STUB =
  "Let me try that differently — what would be most useful to cover next from your side?";

/* ─── validators ───────────────────────────────────────────────────── */

/* Salary scalar extraction now delegates to the typed `_fact-parser`
 * module. The legacy `extractNumbers(s) → string[]` contract is
 * preserved (restyle subset-check still iterates raw digit strings),
 * but the underlying parse is range-aware and unit-normalised. The
 * two former regex literals (`SALARY_NUM_RE`, `RUPEE_NUM_RE`) live in
 * `_fact-parser.ts` as `UNIT_NUM_RE` / `RUPEE_NUM_RE`. */
function extractNumbers(s: string): string[] {
  return extractSalaryScalars(s);
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
 *  so we accept any of an extended vocab set.
 *
 *  FL2 / Audit Pass 4 (PDF#27, 2026-05-17) — broadened to also cover
 *  the standalone neutral bridges ("Got it.", "Right.", "Okay.")
 *  pickNeutralBridgeAck emits in front of non-disclosure probe turns,
 *  so the validator's bridge-preservation check catches both ack flavors
 *  through a single regex. */
const ACK_VOCAB_RE =
  /\b(noted|got it|understood|appreciate|right[,\s—]+on|thanks for that|fair enough|fine,?\s+so|okay,?\s+on|alright,?\s+on)\b|^(?:got it|right|okay|alright)[.\s]/i;

/** FL2 / Audit Pass 4 (PDF#27, 2026-05-17) — probe-kind set that the
 *  canonical layer prepends with a turn-bridge ACK (disclosure or
 *  neutral). The validator uses this set to choose between two
 *  rejection reasons when the restyle strips the lead:
 *    - probe-kind canonical with bridge → `no-turn-bridge`
 *    - non-probe canonical with ack    → `ack-prefix-stripped` (legacy)
 *  Both ship the canonical verbatim; the reason name is the audit
 *  surface that tells us WHICH protection fired. */
const PROBE_KINDS_NEEDING_BRIDGE_SET = new Set<string>([
  "discovery-probe",
  "component-probe",
  "anchor-with-offer",
  "band-disclosure-deflect",
  "probe-expectations",
  "probe-justification",
  "probe-mismatch",
  "reactive-followup",
]);

/** Defect 6 (2026-05-16) — sentiment-prefix anchor phrases.
 *  `renderSentimentPrefix` (in _canonical-prose.ts) prepends one of
 *  three fixed phrases ("I hear you …", "Glad we're broadly aligned —",
 *  "Take your time on this —") in front of the canonical body when the
 *  candidate sentiment is frustrated / excited / hesitant. The restyle
 *  prompt explicitly permits opening-phrase changes, so without a
 *  preservation rule the LLM can fully strip the empathy lead and the
 *  bot regresses to flat-affect cadence. Accept any of an extended
 *  anchor set so Indian-recruiter rephrasings ("I get where you're
 *  coming from", "good that we're broadly aligned", "no rush") pass. */
const SENTIMENT_VOCAB_RE =
  /\b(i hear you|i get where you|i understand where you|broadly aligned|glad we['’]?re aligned|take your time|no rush|in your own time)\b/i;

/** Bug 1 (PDF#25, 2026-05-16) — declarative-connective-lead + trailing
 *  question-mark, IN THE SAME CLAUSE. The sentence starts with one of
 *  the connectives the restyle prompt is allowed to use as a soft ack
 *  ("Fair enough,", "Got it,", "Sure,", "Right,", "Okay,", "Alright,",
 *  "Noted,", "Understood,") followed by a COMMA (i.e. same-clause
 *  continuation, not a separate sentence) and ends with "?".
 *
 *  Counter-example we MUST allow: "Noted on the expected side. What's
 *  the notice period?" — two separate sentences, the first declarative
 *  with a period, the second a clean interrogative. We require the
 *  connective to be comma-joined to the rest of the same clause AND no
 *  intervening period / em-dash / question-mark before the trailing "?"
 *  so genuine two-sentence acks still pass. */
const DECLARATIVE_PLUS_QUESTION_RE =
  /^\s*(?:fair enough|got it|sure|right|okay|alright|noted|understood)[^.?\u2014\u2013]*,[^.?\u2014\u2013]*\?\s*$/i;

/** F1 / Audit Pass 2 (PDF#25, 2026-05-16) — topic-keyword map.
 *
 *  One regex per discovery topic. Used by the multi-topic-utterance
 *  gate: count how many distinct topics a restyled line mentions and
 *  reject when >1. Keywords are scoped tightly so generic English words
 *  ("at present", "structure") don't collide across topics. */
export const TOPIC_KEYWORD_MAP: Record<string, RegExp> = {
  currentCtc:
    /\b(?:current\s+(?:ctc|package|compensation|comp|fitment|side)|at\s+present|right\s+now|today)\b/i,
  targetCtc:
    /\b(?:expected|fitment|target|looking\s+at|anchoring|expectation)\b/i,
  fixedVariable:
    /\b(?:fixed[\s/-]*variable|variable\s+split|fixed\s+and\s+variable|split\s+between\s+fixed|how\s+is\s+(?:your|the)\s+package\s+structured)\b/i,
  notice:
    /\b(?:notice\s+period|notice\s+side|buyout)\b/i,
  competing:
    /\b(?:competing\s+(?:offer|process|opportunity)|other\s+process|other\s+opportunity|other\s+offer)\b/i,
  valueProof:
    /\b(?:value\s+proof|impact|one\s+project)\b/i,
};

/** F2 / Audit Pass 2 (PDF#25, 2026-05-16) — internal-hedge-filler.
 *
 *  Recruiter-internal thought leaking into the dialog ("let me check as
 *  per the band ... but broadly aligned") is process-narration that
 *  doesn't belong in the candidate-facing line. Canonical prose never
 *  emits these patterns except via the sentiment-prefix path (where
 *  "broadly aligned" is the legitimate excited-sentiment lead). The
 *  gate respects canonical content — if the canonical itself carries
 *  the hedge phrase, the restyle is allowed to mirror it. */
export const HEDGE_FILLER_RE =
  /\b(?:let\s+me\s+check|broadly\s+aligned|just\s+to\s+confirm|hmm,?\s+let\s+me|we'?re\s+aligned|from\s+our\s+side|on\s+our\s+side)\b/i;

/** PDF#27 Fix 4 (2026-05-17) — EVASIVE DEFLECTION.
 *
 *  T3 fixture: "I'd be happy to share / clarify ..." — the LLM stalling
 *  with a politeness-filler when the real recruiter move is either an
 *  honest defer or a band-anchor. Reject so the canonical-fallback
 *  prose ships. */
const EVASIVE_DEFLECTION_RE =
  /I'?d\s+(?:be\s+)?(?:happy\s+to|like\s+to)\s+(?:share|clarify|walk\s+you\s+through)/i;

/** Bug 1 (PDF#25, 2026-05-16) — "total CTC as per your current band"
 *  tautology. The candidate's current CTC IS their current-band number;
 *  the qualifier adds no information. Catches both directions ("CTC as
 *  per … band" and "band … current CTC" within close proximity). */
const TAUTOLOGY_RE =
  /\b(?:total\s+)?ctc\s+as\s+per\s+(?:your|the)\s+(?:current\s+)?band\b/i;

/* Audit Pass 3 / Fix 3 / ArchRec 3 (2026-05-16) — per-NextAction
 * validator contract. Until now `validateRestyle` enforced only the
 * global rules (number subset, sentiment vocab, banned idioms, close-
 * recap completeness). Different NextAction kinds have different
 * invariants — a discovery-probe must not introduce numbers at all,
 * a counter-offer MUST emit at least one number, a close-recap-formal
 * needs the verbal-acceptance acknowledgement token to bind the recap
 * to the candidate's prior yes. Hard-coding those into separate branches
 * spreads the per-kind contract across the validator body and makes it
 * easy for new NextAction kinds to ship with zero validation.
 *
 * The contract table keys NextAction.kind values to:
 *   - numberPolicy: "forbidden" (no numbers permitted), "required" (at
 *     least one number must appear), or "optional" (no constraint
 *     beyond the global subset rule).
 *   - requiredTokens: regexes that MUST match the restyle.
 *   - bannedTokens: regexes that MUST NOT match the restyle.
 *
 * Seeded with five entries that capture documented invariants. Kinds
 * without an entry fall through to the global checks — there is no
 * implicit-deny default to keep the change non-breaking for the long
 * tail of action kinds. Add entries here as invariants are documented. */
type NextActionContractEntry = {
  numberPolicy: "forbidden" | "required" | "optional";
  requiredTokens?: RegExp[];
  bannedTokens?: RegExp[];
};

export const NEXT_ACTION_CONTRACT: Partial<Record<NextAction["kind"], NextActionContractEntry>> = {
  /* Discovery probes ask one structured question; emitting a number
   * here is almost always the LLM hallucinating a salary anchor before
   * the recruiter has decided to disclose. Numbers that legitimately
   * appear in the canonical (e.g. "your 18L current") are echoed via
   * the global subset rule — restyle output containing numbers that
   * weren't already in the canonical is blocked there. The forbidden
   * policy makes the failure mode obvious in the validator log. */
  "discovery-probe": { numberPolicy: "forbidden" },
  /* Probe-justification asks "why this number?" without quoting one. */
  "probe-justification": { numberPolicy: "forbidden" },
  /* Counter-offers are math turns — the restyle must carry a numeric
   * offer or the candidate has no anchor to react to. */
  "counter-offer": { numberPolicy: "required" },
  /* Open-with-offer: in the kernel-first world this turn is the OPENING
   * DISCOVERY PROBE (turn 0: "what's your current CTC at the moment?";
   * turn != 0: "Before I put a number out — what fitment were you
   * anchoring on?"). Crack 6 (2026-05-17) — contract↔prose drift fix.
   * The legacy contract required at least one number (it was authored
   * back when this kind emitted a seed anchor); under the kernel-first
   * inversion the canonical never emits a number here, so every LLM
   * restyle of the opener was being rejected on the now-stale
   * "contract-number-required" rule. Switched to `forbidden` to match
   * the probe semantics: any number the LLM introduces in the opener is
   * an unauthorised salary anchor. */
  "open-with-offer": { numberPolicy: "forbidden" },
  /* close-recap-formal is the structured confirmation turn — numbers
   * are mandatory (the recap exists to bind the candidate to the
   * structured offer). The four band-anchor field tokens (fixed /
   * variable / notice / bgv) are enforced by the legacy
   * `close-recap-incomplete` branch below to preserve its named-reason
   * contract; the table entry layers in the numeric-content invariant
   * the legacy check did not cover. */
  "close-recap-formal": { numberPolicy: "required" },
  /* ResumeFactPack track Step 4 (2026-05-16) — credibility-probe. No
   * numbers (alignment question, not an offer). Required token "resume"
   * pins the line to its purpose so the LLM can't restyle away the
   * resume reference. */
  "credibility-probe": { numberPolicy: "forbidden", requiredTokens: [/\bresume\b/i] },
  /* AP3-F2 (2026-05-17) — component-aware discovery. Per-component
   * requiredTokens pin the restyle to its topic (the LLM cannot restyle
   * a "what's the base split?" into a generic compensation probe).
   * numberPolicy is "optional" — the candidate may quote a number back
   * but the kernel itself doesn't author one. The actual component
   * regex applied at validation time is selected by inspecting the
   * NextAction.component field via the lookup helper below. */
  "component-probe": { numberPolicy: "optional" },
  /* Phase 2 Indian-HR redesign (2026-05-17) — anchor-with-offer
   * (replaces the legacy anchor-with-band range emitter). Real Indian
   * HR recruiters disclose a SINGLE point offer, not a band; the dash
   * requirement is dropped because the canonical no longer carries a
   * range. Required tokens: "LPA", "fitment". The validator below
   * relaxes numberPolicy when action.bandIncomplete is true (honest-
   * defer path). bannedTokens include the range-dash so the LLM
   * restyle cannot reintroduce a leaky range. */
  "anchor-with-offer": {
    numberPolicy: "required",
    requiredTokens: [
      /\bLPA\b/i,
      /\bfitment\b/i,
    ],
    /* Reject any en-dash / em-dash / "to" between numbers — Indian HR
     * does not disclose internal bands. We pattern-match on a digit
     * followed by a dash/"to" followed by a digit to allow legitimate
     * single-clause dashes elsewhere in the line. */
    bannedTokens: [
      /\d+\s*(?:[-\u2013\u2014]|\bto\b)\s*\d/,
    ],
  },
  /* PDF#29 Bug 7 (2026-05-18) — acknowledge-and-recover (frustration
   * recovery). No numbers (it's a repair turn, not a comp move).
   * Required token "apolog" pins the recovery semantics so the LLM
   * restyle cannot drift into a generic "got it, moving on" that
   * drops the explicit acknowledgement. */
  "acknowledge-and-recover": {
    numberPolicy: "forbidden",
    requiredTokens: [/apolog/i],
  },
  /* PDF#35 Move 1 (2026-05-18) — offer-recap. Numbers REQUIRED (the
   * recap quotes the standing offer). Required tokens: "LPA" pins the
   * unit + "recap" / "on the table" pins the recap framing so the LLM
   * restyle can't drift into a fresh anchor. Range dashes banned so
   * the LLM cannot reintroduce a band range. */
  "offer-recap": {
    numberPolicy: "required",
    requiredTokens: [/\bLPA\b/i, /\b(?:recap|on\s+the\s+table)\b/i],
    bannedTokens: [/\d+\s*(?:[-\u2013\u2014]|\bto\b)\s*\d/],
  },
  /* PDF#34 Fix 3 (2026-05-18) — clarify-prior-question. Optional
   * numbers (the base-split clarification quotes ₹X LPA from the
   * candidate's prior disclosure). Required tokens pin the
   * clarification semantics so the LLM restyle cannot drift into a
   * deflection ("this conversation is about…" — the PDF#34 persona
   * break) or a silent topic-advance. */
  "clarify-prior-question": {
    numberPolicy: "optional",
    requiredTokens: [/\b(?:let\s+me\s+(?:clarify|rephrase)|sorry|by\s+\w+\s+i\s+mean|means?\b)/i],
  },
  /* Bug 3 fix (2026-05-18) — band-anchor-with-rationale. Point offer only;
   * the dash/"to" between digits is banned so the LLM restyle cannot
   * reintroduce the internal band range. */
  "band-anchor-with-rationale": {
    numberPolicy: "required",
    requiredTokens: [/\bLPA\b/i, /\bband\b/i],
    bannedTokens: [/\d+\s*(?:[-\u2013\u2014]|\bto\b)\s*\d/],
  },
  /* Phase 2 Indian-HR redesign (2026-05-17) — band-disclosure-deflect.
   * "panel" anchors the deflection.
   * PDF#37 BUG-B (2026-05-20) — numberPolicy relaxed from "forbidden"
   * to "optional". The deflect's job is to refuse INTERNAL band
   * disclosure (band ceiling / range); when a point-offer is already
   * on the table from a prior anchor turn, the deflect MAY recap that
   * already-disclosed number so the candidate isn't confused into
   * thinking the offer was withdrawn. The "panel" required token plus
   * the bannedTokens (range-dash + "between") still block real band
   * leakage; a single ₹XL recap of the on-table offer is permitted. */
  "band-disclosure-deflect": {
    numberPolicy: "optional",
    requiredTokens: [/\bpanel\b/i],
    bannedTokens: [/\d+\s*(?:[-\u2013\u2014]|\bto\b)\s*\d/, /\bbetween\b/i],
  },
  /* Phase 2 Indian-HR redesign (2026-05-17) — post-acceptance docs req.
   * Crack 6 (2026-05-17) — contract↔prose drift fix. The canonical prose
   * was trimmed (per Phase 4.5 direction) so the offer-letter touchpoint
   * only asks for PAN + Aadhaar; Form 16 / payslips / bank statements /
   * relieving letters belong to a separate later BGV workflow. The
   * contract used to require `Form 16` and `payslip` — tokens the prose
   * no longer carried — which meant every LLM restyle of this canonical
   * was being silently rejected in production. Required tokens now
   * mirror the trimmed canonical: PAN + Aadhaar at the offer-letter
   * touchpoint, plus a BGV-deferred-step reference so the restyle can't
   * drop the "we'll come back for the rest" framing. */
  "post-acceptance-document-request": {
    numberPolicy: "optional",
    requiredTokens: [/\bPAN\b/i, /\bAadhaar\b/i, /\bBGV\b/i],
  },
  /* Phase 3 missing-lever set (2026-05-17) — panel-approval-stall.
   * Pure stall move; no numbers. The "panel" or "leadership" anchor
   * pins the move's semantics so the restyle can't drift into a
   * generic hedge ("let me check internally"). "revert by EOD" is
   * the canonical close so we require the EOD token. */
  "panel-approval-stall": {
    numberPolicy: "forbidden",
    requiredTokens: [/\b(?:panel|leadership)\b/i, /\b(?:EOD|end\s+of\s+day)\b/i],
  },
  /* Phase 3 missing-lever set (2026-05-17) — polite-walkaway.
   * No numbers. The canonical line MUST surface the "without a firm
   * decision / competing offer" hinge AND the "move forward with
   * other candidates" exit clause — both pin the move to its
   * declining semantics, blocking a soft restyle that hides the
   * walk. "Honestly" is also required to gate against a sanitised
   * restyle that drops the candid framing. */
  "polite-walkaway": {
    numberPolicy: "forbidden",
    requiredTokens: [/\bhonest(?:ly)?\b/i, /\b(?:other\s+candidates|move\s+forward)\b/i],
  },
  /* Phase 3 missing-lever set (2026-05-17) — anchor-defense-hike-strong.
   * Numbers required (the rebuttal IS the math). Required tokens
   * pin the peer-context framing and the % hike claim so a restyle
   * can't drop the comparative anchor that makes the rebuttal land. */
  "anchor-defense-hike-strong": {
    numberPolicy: "required",
    requiredTokens: [/%\s*hike\b/i, /\bpeers\b/i],
  },
  /* fake-leverage-challenge (2026-05-17) — soft proof-of-offer probe.
   * Number-free (asking for the letter, not quoting LPA). Required
   * tokens pin the proof-request semantics: must mention "offer letter"
   * OR "redacted" so a sanitised restyle can't drop the proof ask. */
  "fake-leverage-challenge": {
    numberPolicy: "forbidden",
    requiredTokens: [/\b(?:offer\s+letter|redacted)\b/i],
  },
};

/** AP3-F2 (2026-05-17) — component-probe requiredTokens are
 *  per-component, so they cannot be statically baked into the contract
 *  table. The validator below consults this map when the action kind is
 *  "component-probe" and layers the matching regex on top of the
 *  static entry. */
const COMPONENT_PROBE_REQUIRED_TOKENS: Record<
  "base" | "variable" | "esop",
  RegExp
> = {
  base: /\bbase\b/i,
  variable: /\b(?:variable|bonus|perf)\b/i,
  /* Crack 6 (2026-05-17) — contract↔prose drift fix. The canonical prose
   * for the esop component-probe reads "ESOPs in play? Any vesting cliff
   * or accelerator?" — both "ESOPs" (plural) and "vesting" (gerund) carry
   * the morpheme, but the prior `\besop\b|\bvest\b` regex pinned the
   * word boundary and rejected both. Real Indian recruiter idiom for
   * this topic spans esop/esops/rsu/rsus/equity/vest/vesting/vested, so
   * the contract token now matches the morpheme + any of its standard
   * inflections. */
  esop: /\b(?:esops?|rsus?|equity|vest(?:ed|ing|s)?)\b/i,
};

/** PDF#27 Fix 2 (2026-05-17) — FOURTH-WALL BREAK.
 *
 *  PDF#27 T4: "No, I'm not repeating the question." The LLM is responding
 *  to a perceived complaint by stepping out of the recruiter persona and
 *  meta-commenting on its own conversational behaviour. Real recruiters
 *  apologise concretely ("Apologies — moving on to …") or just advance
 *  the topic. They never narrate the fact of asking. Reject so the
 *  canonical (which advances cleanly) ships. */
const FOURTH_WALL_BREAK_RE =
  /\b(?:i'?m\s+not\s+repeating|i\s+am\s+not\s+repeating|as\s+an\s+ai|i'?m\s+an\s+interview|the\s+question\s+(?:i\s+|that\s+i\s+)?asked|i\s+already\s+asked)\b/i;

/** PDF#27 Fix 1 (2026-05-17) — INTERNAL TERMINOLOGY LEAK.
 *
 *  The LLM has been observed surfacing kernel-internal vocabulary in the
 *  candidate-facing line ("missing from the fact pack", "next-action",
 *  "state.candidateCurrentCtc", "kernel", "lever", "asked topic"). Real
 *  recruiters never say these things — they're implementation jargon.
 *  Any occurrence is the LLM ignoring the persona and exposing the
 *  scaffold. Reject hard with named reason `internal-terminology-leak`
 *  so the canonical (which is, by construction, persona-clean) ships. */
const INTERNAL_TERMINOLOGY_LEAK_RE =
  /\b(?:fact[\s-]*pack|system[\s-]*prompt|canonical[\s-]*prose|next[\s-]*action|state\.|kernel|fold[\s-]*facts?|response[\s-]*pipeline|lever(?:s|sUsed)?|asked[\s-]*topics?|skip[\s-]*record|discovery[\s-]*topic|turn[\s-]*delta|market[\s-]*mode|nextactioncontract|validate[\s-]*restyle)\b/i;

/** PDF#27 Fix 1 (2026-05-17) — INTERNAL DEFER LEAK.
 *
 *  PDF#27 T6: "I cannot provide the total CTC offered as that
 *  information is missing from the fact pack." This is the response-
 *  pipeline's defer text leaking its internal reason verbatim. A
 *  recruiter would say "I'll have a firmer number once the panel signs
 *  off" — never "fact pack". Reject so `buildDeferText` ships its
 *  honest, persona-clean copy. */
const INTERNAL_DEFER_LEAK_RE =
  /I\s+cannot\s+provide\s+.+\s+as\s+that\s+information\s+is\s+missing|missing\s+from\s+(?:the\s+)?(?:fact\s*pack|context|prompt)/i;

/** PDF#27 Fix 1 (2026-05-17) — INVENTED MARKET JARGON.
 *
 *  PDF#27 T5: "...considering the current market mode as hot..." —
 *  there is no "market mode" anywhere in the kernel; the LLM
 *  fabricated it. Real recruiters cite specific signals ("benchmarks
 *  are tight this quarter", "we're seeing 25-30% hikes for this skill")
 *  — not abstract "mode" labels. Reject. */
const INVENTED_MARKET_JARGON_RE =
  /\bmarket\s+mode\b|\bmode\s+as\s+(?:hot|cold|tight|loose)\b/i;

/** LN2 / Audit Pass 4 (PDF#27, 2026-05-17) — non-Indian currency / unit
 *  vocab. Indian recruiters quote compensation in ₹ + LPA / lakhs;
 *  any occurrence of USD / EUR / GBP / "annual salary" / "per year" /
 *  "dollars" / "euros" / "pounds" in the restyle is the LLM regressing
 *  to US-tech framing. Reject so the canonical fallback (which is
 *  guaranteed ₹+LPA) ships instead. */
const NON_INDIAN_CURRENCY_VOCAB_RE =
  /\b(?:USD|EUR|GBP|annual\s+salary|per\s+year|per\s+annum|dollars?|euros?|pounds?)\b/i;

/** LN7 / Audit Pass 4 (PDF#27, 2026-05-17) — typographic curly quotes.
 *  Mirror of candidate-side normalizeQuotes (in _negotiation-kernel and
 *  _acceptance-classifier). Applied to AI output BEFORE validateRestyle
 *  runs so downstream regex matches see straight quotes. Silent
 *  normalization — not a rejection reason. */
export function stripCurlyQuotes(s: string): string {
  return s
    .replace(/[\u2018\u2019\u02BC\u02BB]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

/** PDF#37 BUG-E (2026-05-20) — strip surrounding wrapping quotes.
 *  LLM restyle occasionally returns the recruiter line wrapped in
 *  outer quotation marks ("..."), which leaks into the chat UI as a
 *  spoken-quote artifact. Only strip when BOTH ends carry the same
 *  quote AND no inner quote of the same flavour is opened — i.e. it's
 *  a wrapper, not legitimate dialogue. Idempotent; runs after curly
 *  quotes have already been normalized to straight quotes. */
export function stripWrappingQuotes(s: string): string {
  let out = s.trim();
  for (let i = 0; i < 2; i++) {
    if (out.length < 2) break;
    const first = out[0];
    const last = out[out.length - 1];
    if ((first === '"' || first === "'") && first === last) {
      const inner = out.slice(1, -1);
      // Reject if inner already contains a matching quote (real dialogue).
      if (!inner.includes(first)) {
        out = inner.trim();
        continue;
      }
    }
    break;
  }
  return out;
}

/** LN3 / Audit Pass 4 (PDF#27, 2026-05-17) — em-dash vs en-dash policy.
 *  Canonical-prose locks em-dash (—, U+2014) for prose pauses; en-dash
 *  (–, U+2013) is reserved for numeric ranges only ("20–25 LPA"). If
 *  the restyle uses an en-dash where neither side is a number, the LLM
 *  is hyphenating prose — reject so the canonical (em-dash everywhere
 *  prose-side) ships. We only fire `mixed-dash-style` when BOTH dash
 *  forms are present AND the en-dash is in a non-numeric context. */
const EN_DASH = "\u2013";
const EM_DASH = "\u2014";
function hasNonNumericEnDash(s: string): boolean {
  /* Walk every en-dash occurrence. Numeric range = digit on both sides
   * (allowing one whitespace either side). Anything else is prose use. */
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== EN_DASH) continue;
    let l = i - 1;
    while (l >= 0 && /\s/.test(s[l])) l--;
    let r = i + 1;
    while (r < s.length && /\s/.test(s[r])) r++;
    const leftCh = l >= 0 ? s[l] : "";
    const rightCh = r < s.length ? s[r] : "";
    const leftIsDigit = /\d/.test(leftCh);
    const rightIsDigit = /\d/.test(rightCh);
    if (!(leftIsDigit && rightIsDigit)) return true;
  }
  return false;
}

/** LN4 / Audit Pass 4 (PDF#27, 2026-05-17) — sentence length caps.
 *  Reject if any single sentence exceeds 30 words, or if the average
 *  across sentences exceeds 25 words. Real recruiter cadence is short;
 *  long sentences are the LLM padding with subordinate clauses. */
const MAX_SENTENCE_WORDS = 30;
const MAX_AVG_SENTENCE_WORDS = 25;
function checkSentenceLength(s: string): "ok" | "too-long" {
  const sentences = s
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  if (sentences.length === 0) return "ok";
  let total = 0;
  for (const sent of sentences) {
    const words = sent.split(/\s+/).filter((w) => /\w/.test(w));
    if (words.length > MAX_SENTENCE_WORDS) return "too-long";
    total += words.length;
  }
  const avg = total / sentences.length;
  if (avg > MAX_AVG_SENTENCE_WORDS) return "too-long";
  return "ok";
}

/** LN5 / Audit Pass 4 (PDF#27, 2026-05-17) — inconsistent component
 *  phrasing. Canonical phrasing for the comp breakdown is "fixed/variable
 *  split". Variants like "fixed and variable elements", "fixed and
 *  variable parts", or generic "compensation elements" sound corporate
 *  rather than recruiter-natural. Reject so the canonical (which uses
 *  the locked phrasing) ships. */
const INCONSISTENT_COMPONENT_PHRASING_RE =
  /\b(?:fixed\s+and\s+variable\s+(?:elements|parts|portions|components)|compensation\s+elements)\b/i;

/** LN6 / Audit Pass 4 (PDF#27, 2026-05-17) — pronoun drift.
 *  Recruiter persona: "I" for personal voice ("I'll check", "I think"),
 *  "we" reserved for explicit company-position statements ("our band",
 *  "we offer", "we can stretch"). Reject if both pronouns appear in the
 *  same utterance and the "we" usage isn't anchored to a company-
 *  position cue. The check is deliberately narrow — single-pronoun
 *  utterances pass, and an utterance where "we" is paired with a
 *  company-position cue ("we offer", "we can", "our band", "our side")
 *  passes too. */
const PERSONAL_I_RE = /\bI\b/;
const WE_PRONOUN_RE = /\b(?:we|us|our)\b/i;
const COMPANY_POSITION_CUE_RE =
  /\b(?:we\s+(?:offer|can|stretch|are\s+(?:able|prepared|looking)|sit|cap)|our\s+(?:band|side|grade|policy|cap|offer|comp|fitment))\b/gi;
function hasPronounDrift(s: string): boolean {
  if (!PERSONAL_I_RE.test(s)) return false;
  if (!WE_PRONOUN_RE.test(s)) return false;
  /* If every "we/our/us" sits in a company-position cue context, no drift. */
  /* Approximate: if any "we/our/us" occurrence is OUTSIDE a company cue
   * window, it's personal-voice "we" — drift. We strip company-cue
   * matches and re-test. */
  const stripped = s.replace(COMPANY_POSITION_CUE_RE, " ");
  return WE_PRONOUN_RE.test(stripped);
}

/** Validate the LLM restyle against the canonical line. Rejection
 *  causes canonical fallback. Conservative: any number not present in
 *  the canonical, any new closing-vocab outside close phase, or any
 *  >2x length blow-up is rejected. */
export function validateRestyle(
  canonical: string,
  restyled: string,
  state: NegotiationState,
  action?: NextAction,
): { valid: boolean; reason?: string } {
  if (!restyled || !restyled.trim()) {
    return { valid: false, reason: "empty-restyle" };
  }
  /* PDF#27 Fix 1 (2026-05-17) — INTERNAL TERMINOLOGY LEAK GUARD.
   * Sits before every other check so the rejection reason names the
   * primary failure mode (the LLM exposing kernel scaffold) without
   * masking under an unrelated downstream check. */
  /* Order matters: market-mode jargon is a SUBSET of the internal-
   * terminology regex, so the more specific reason fires first.
   * Likewise the defer-leak phrase. Fourth-wall break runs first
   * because it's the most candidate-visible scaffold leak. */
  if (FOURTH_WALL_BREAK_RE.test(restyled)) {
    return { valid: false, reason: "fourth-wall-break" };
  }
  if (INVENTED_MARKET_JARGON_RE.test(restyled)) {
    return { valid: false, reason: "invented-market-jargon" };
  }
  if (INTERNAL_DEFER_LEAK_RE.test(restyled)) {
    return { valid: false, reason: "internal-defer-leak" };
  }
  if (INTERNAL_TERMINOLOGY_LEAK_RE.test(restyled)) {
    return { valid: false, reason: "internal-terminology-leak" };
  }
  /* PDF#33 Move A (2026-05-18) — TEASER-PROSE GATE.
   *
   * "Let me walk you through X" / "let me run you through Y" /
   * "let me put X in context" are teaser patterns: the line promises
   * content the kernel doesn't actually deliver on the same turn, so
   * the candidate's natural next utterance ("what?" / "go on") finds
   * the kernel jumping topics or repeating. Excised across all
   * canonical sites; this boundary gate stops the LLM-restyle from
   * reintroducing the pattern.
   *
   * Scoped to bare-teaser shapes — sentences that promise a walk-
   * through with NO substantive content immediately after the
   * promise. We allow "let me check with X and revert" (legitimate
   * defer cadence with delivery commitment) by requiring the teaser
   * to NOT be followed by a concrete deferral verb (check/confirm/
   * run/revert) tied to an escalation anchor. */
  const TEASER_PROSE_RE =
    /\b(?:let\s+me\s+(?:walk|run)\s+you\s+through|let\s+me\s+put\s+(?:the\s+)?(?:fitment|number|structure|details?)\s+in\s+context)\b/i;
  if (TEASER_PROSE_RE.test(restyled)) {
    return { valid: false, reason: "teaser-prose" };
  }
  /* PDF#33 (2026-05-18) — BUREAUCRATIC PROBE TERMINATOR.
   *
   * PDF#33 T5 shipped "Vesting cliff or accelerator in place? Kindly
   * revert with details." — a probe (asking the candidate to disclose)
   * with a corporate-jargon imperative tail ("Kindly revert with
   * details"). The system-prompt now bans this construction on probe
   * lines, but the prompt is advisory and the LLM occasionally still
   * emits the pattern. Boundary check rejects so the canonical (plain-
   * English probe) ships instead.
   *
   * Scoped to lines containing a `?` (i.e. actual probes) so a
   * legitimate scheduling line ("kindly revert by EOD") in a non-probe
   * context can still pass. */
  const BUREAUCRATIC_PROBE_TERMINATOR_RE =
    /\?[^?]*\b(?:kindly\s+(?:revert|share|confirm)|revert\s+with\s+(?:details|the\s+details)|do\s+the\s+needful)\b/i;
  if (BUREAUCRATIC_PROBE_TERMINATOR_RE.test(restyled)) {
    return { valid: false, reason: "bureaucratic-probe-terminator" };
  }
  /* LN4 / Audit Pass 4 (PDF#27, 2026-05-17) — sentence-length cap.
   * Sits BEFORE the 2x-length gate so the more specific reason fires
   * when the LLM emits over-long sentences (even if total length also
   * exceeds the global cap). */
  if (checkSentenceLength(restyled) === "too-long") {
    return { valid: false, reason: "sentence-too-long" };
  }
  /* Length check — restyle must not balloon past 2x canonical. */
  if (restyled.length > canonical.length * 2 && restyled.length > 280) {
    return { valid: false, reason: "restyle-too-long" };
  }
  /* PDF #45 second-pass audit (2026-05-22) — SAME-OPENER-THRICE GUARD.
   *
   * Flipkart Sr PD transcript T3/T5/T7/T9/T11/T13 all opened with
   * "Thanks for that —" or "Fair enough —". The restyle prompt
   * permits these openers but the 0.4-temperature model lands on the
   * same family turn after turn. The opener carries <10% of the prose
   * information but is the loudest cadence signal — a candidate
   * hearing the same opener five turns running reads it as parrot.
   *
   * Sits BEFORE content-specific gates (ack-prefix, ack-without-
   * disclosure, idiom cap) because opener repetition is a cadence
   * concern independent of content. One repeat is allowed (natural);
   * three in a row is the regression we reject.
   *
   * Buckets are coarse — "thanks/appreciate", "fair/understood",
   * "got it/noted", "okay/alright/right", "sure/of course" — so
   * synonymous restylings within a bucket still trip the gate. */
  const OPENER_BUCKET_RE: Array<{ key: string; re: RegExp }> = [
    { key: "thanks", re: /^\s*(?:thanks?(?:\s+(?:you|so much))?\s+(?:for|on)|appreciate(?:\s+(?:that|the|you))?)\b/i },
    { key: "fair", re: /^\s*(?:fair\s+enough|understood|that[\s']?s\s+fair|makes\s+sense)\b/i },
    { key: "gotit", re: /^\s*(?:got\s+it|noted)\b/i },
    { key: "okay", re: /^\s*(?:okay|ok|alright|right)[\s,.\-—:;]/i },
    { key: "sure", re: /^\s*(?:sure|of\s+course|absolutely)\b/i },
  ];
  function classifyOpenerBucket(s: string): string | null {
    const t = (s || "").trim();
    for (const b of OPENER_BUCKET_RE) {
      if (b.re.test(t)) return b.key;
    }
    return null;
  }
  /* Skip when validating canonical-against-itself (lint mode). The
   * canonical layer has its own rotation (pickNeutralBridgeAck);
   * rejecting here would have no remedy — fallback IS the canonical.
   * Same-opener-thrice is a check on the LLM restyle layer only. */
  if (restyled.trim() !== canonical.trim()) {
    const restyleBucket = classifyOpenerBucket(restyled);
    if (restyleBucket != null) {
      const log = state.conversationLog ?? [];
      const recentAi: string[] = [];
      for (let i = log.length - 1; i >= 0 && recentAi.length < 2; i--) {
        const e = log[i];
        if (!e || e.speaker !== "ai" || !e.text) continue;
        recentAi.push(e.text);
      }
      if (
        recentAi.length === 2 &&
        classifyOpenerBucket(recentAi[0]) === restyleBucket &&
        classifyOpenerBucket(recentAi[1]) === restyleBucket
      ) {
        return { valid: false, reason: "same-opener-thrice" };
      }
    }
  }
  /* PDF #45 second-pass audit (2026-05-22) — COMPOUND-PROBE GUARD.
   *
   * T5 of the Flipkart Sr PD transcript shipped "Are there any ESOPs
   * or RSUs in your current package, AND what's the vesting schedule
   * like?" — two distinct fact-probes (equity presence, vesting
   * structure) crammed into one turn. The candidate dropped one half
   * and the kernel had no way to retry the dropped fact cleanly.
   *
   * Real recruiters ask one fact per probe turn. The kernel canonical
   * for the equity case has been split (line 1127), so this validator
   * catches the LLM RE-INTRODUCING a compound shape: more `?` in the
   * restyle than the canonical is a hard reject for probe-kind
   * actions. Non-probe actions (anchor, recap, terminal) often
   * legitimately have multiple question marks (rhetorical anchors) so
   * the gate is scoped. */
  if (action != null && PROBE_KINDS_NEEDING_BRIDGE_SET.has(action.kind)) {
    const canonicalQs = (canonical.match(/\?/g) ?? []).length;
    const restyleQs = (restyled.match(/\?/g) ?? []).length;
    if (restyleQs > Math.max(canonicalQs, 1)) {
      return { valid: false, reason: "compound-probe-introduced" };
    }
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
    /* FL2 (PDF#27, 2026-05-17) — when the canonical was a probe-kind
     * with a turn-bridge prepended, name the rejection `no-turn-bridge`
     * so the audit surface tells us this fired specifically because
     * the LLM stripped the FL2 bridge. Non-probe ACK strips retain the
     * legacy `ack-prefix-stripped` reason. */
    const reason =
      action != null && PROBE_KINDS_NEEDING_BRIDGE_SET.has(action.kind)
        ? "no-turn-bridge"
        : "ack-prefix-stripped";
    return { valid: false, reason };
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
  /* LN2 / Audit Pass 4 (PDF#27, 2026-05-17) — Indian currency / unit
   * lock. Indian recruiters quote compensation in ₹ + LPA, never in
   * USD / EUR / GBP / "annual salary" / "per year" / "dollars" /
   * "euros". The canonical-prose surface never emits these tokens
   * (all money-bearing templates are ₹+LPA); any occurrence in the
   * restyle is the LLM regressing to US-tech-recruiter framing.
   *
   * The check is structural (vocab tokens), not semantic — we trust
   * the canonical to have used the right currency and the validator
   * to enforce it. */
  if (NON_INDIAN_CURRENCY_VOCAB_RE.test(restyled)) {
    return { valid: false, reason: "non-indian-currency-vocab" };
  }
  /* F7 / Audit Pass 2 (PDF#25, 2026-05-16) — ack-without-disclosure.
   *
   * Every ACK_TEMPLATES entry pairs a restyle keyword pattern (e.g.
   * "Fair enough on your current compensation") with a state predicate
   * that must hold for that ACK to be honest. If the restyle leaks an
   * ACK keyword but the corresponding state field is null/empty, the
   * recruiter is fabricating a disclosure. Reject before any grammar /
   * idiom-stacking gate so the more fundamental invariant gets the
   * named rejection reason. */
  for (const t of ACK_TEMPLATES) {
    if (t.restyleKeywordRe.test(restyled) && !t.requires(state)) {
      return { valid: false, reason: "ack-without-disclosure" };
    }
  }
  /* PDF #45 fix (2026-05-22) — FALSE-ATTRIBUTION CLARIFICATION.
   *
   * User-reported Flipkart Sr PD transcript: bot asked "what's your
   * current CTC — total annual?" on T1, candidate gave their total
   * CTC on T2, bot shipped on T3:
   *   "Thanks for that clarification on the base split — how does it
   *    look?"
   * The candidate hadn't "clarified" anything — they gave a substantive
   * first-disclosure of total CTC. The LLM imposed "clarification"
   * framing because the restyle prompt explicitly permits "Thanks for
   * that —" openers (canonical-prose.ts:1181 system instruction).
   *
   * Reject the restyle when it asserts the candidate's prior turn was
   * a clarification UNLESS the prior candidate turn actually contained
   * a clarification-seeking signal ("what do you mean", "can you
   * explain", "I'm confused", "could you clarify"). Candidates rarely
   * clarify; they disclose, anchor, push back, accept, walk. False
   * "thanks for clarifying" framing reads as patronising. */
  const CLARIFICATION_ATTRIBUTION_RE =
    /\b(?:thanks?\s+(?:you\s+)?for\s+(?:that\s+)?(?:clarification|clarifying|explaining)|appreciate\s+(?:that\s+)?(?:clarification|clarifying|the\s+explanation)|thank\s+you\s+for\s+(?:that\s+)?(?:clarification|clarifying|explaining))\b/i;
  if (CLARIFICATION_ATTRIBUTION_RE.test(restyled)) {
    const log = state.conversationLog ?? [];
    let lastCandidate = "";
    for (let i = log.length - 1; i >= 0; i--) {
      if (log[i].speaker === "candidate") {
        lastCandidate = (log[i].text ?? "").toLowerCase();
        break;
      }
    }
    const CLARIFY_REQUEST_RE =
      /\b(?:what\s+do\s+you\s+mean|can\s+you\s+(?:explain|clarify|elaborate)|could\s+you\s+(?:explain|clarify|elaborate)|i'?m\s+confused|not\s+sure\s+(?:what|i\s+follow)|come\s+again|sorry,?\s+(?:what|can\s+you)|didn'?t\s+(?:catch|get)\s+that|repeat\s+that)\b/i;
    if (!CLARIFY_REQUEST_RE.test(lastCandidate)) {
      return { valid: false, reason: "false-attribution-clarification" };
    }
  }
  /* Bug 1 fix (PDF#25, 2026-05-16) — IDIOM STACKING.
   *
   * Session #25 (Senior Product Designer @ Flipkart) produced restyles
   * that crammed 3-4 Indian-recruiter idioms into a single sentence
   * ("on the expected fitment", "as per the band for this grade",
   * "broadly aligned"). The whitelist is per-token; nothing previously
   * capped the per-utterance count. Real recruiters pick ONE idiom and
   * route the rest as plain English.
   *
   * The effective cap is max(IDIOM_PER_UTTERANCE_CAP, canonicalIdioms)
   * — the restyle must not introduce MORE idioms than the canonical
   * already chose. Canonical prose is curated (e.g. close-recap-formal
   * legitimately uses both "fitment" + "revert" — 2 idioms — because
   * those are the load-bearing tokens for the recap and the
   * confirmation). The cap floor applies to free-form turns where the
   * canonical opted for one idiom and the LLM padded with two more. */
  const canonicalIdiomCount = countPreferredIdioms(canonical);
  const restyleIdiomCount = countPreferredIdioms(restyled);
  const effectiveCap = Math.max(IDIOM_PER_UTTERANCE_CAP, canonicalIdiomCount);
  if (restyleIdiomCount > effectiveCap) {
    return { valid: false, reason: "idiom-stacking" };
  }
  /* Bug 1 fix (PDF#25, 2026-05-16) — GRAMMAR MISMATCH.
   *
   * Lines like "Fair enough on your current compensation, let's look at
   * the total CTC at present?" mix a declarative connective lead with a
   * trailing "?" — grammatically wrong in any English. Reject and rebuild
   * from canonical. The declarative leads we police are the ones the
   * restyle prompt explicitly nominates ("Fair enough", "Got it", "Sure",
   * "Right") plus "Okay" / "Alright" which the LLM reaches for as
   * synonyms. */
  if (DECLARATIVE_PLUS_QUESTION_RE.test(restyled)) {
    return { valid: false, reason: "declarative-plus-question-mark" };
  }
  /* Bug 1 fix (PDF#25, 2026-05-16) — TAUTOLOGY CHECK.
   *
   * "what's the total CTC as per your current band?" — the candidate's
   * current CTC is, definitionally, set by their current employer's
   * band. The "as per your current band" qualifier is a tautology that
   * makes the recruiter sound like they're padding. The canonical never
   * emits this; the LLM is filling space. Reject. */
  if (TAUTOLOGY_RE.test(restyled)) {
    return { valid: false, reason: "tautology-current-band" };
  }
  /* F1 / Audit Pass 2 (PDF#25, 2026-05-16) — multi-topic-per-utterance.
   *
   * Session #25 T2 packed two discovery topics into a single bot turn
   * ("expected fitment ... what's the total CTC at present?"). Canonical
   * prose is curated to one topic per turn; the LLM restyle must not
   * collapse two probes into one. Count distinct topic keywords; if >1,
   * reject so the canonical (single-topic) line ships verbatim. */
  let topicHits = 0;
  for (const re of Object.values(TOPIC_KEYWORD_MAP)) {
    if (re.test(restyled)) topicHits += 1;
    if (topicHits > 1) break;
  }
  if (topicHits > 1) {
    /* But canonical may legitimately reference two topics (e.g. the
     * close-recap-formal recap names notice + variable + fixed). Skip
     * the gate when the canonical itself spans >1 topic — the LLM is
     * mirroring, not stacking. */
    let canonicalHits = 0;
    for (const re of Object.values(TOPIC_KEYWORD_MAP)) {
      if (re.test(canonical)) canonicalHits += 1;
      if (canonicalHits > 1) break;
    }
    if (canonicalHits <= 1) {
      return { valid: false, reason: "multi-topic-utterance" };
    }
  }
  /* F2 / Audit Pass 2 (PDF#25, 2026-05-16) — internal-hedge leak.
   *
   * Recruiter-internal thought ("let me check as per the band ... but
   * broadly aligned") is process-narration. Canonical never emits these
   * patterns outside the legitimate sentiment-prefix path; if the
   * restyle introduces one the canonical didn't, the LLM is padding.
   * Reject. */
  if (HEDGE_FILLER_RE.test(restyled) && !HEDGE_FILLER_RE.test(canonical)) {
    return { valid: false, reason: "internal-hedge-leak" };
  }
  /* PDF#27 Fix 4 (2026-05-17) — evasive-deflection. Politeness-filler
   * stalling like "I'd be happy to share..." in place of either an
   * honest defer or a band-anchor. Reject; canonical-fallback ships. */
  if (EVASIVE_DEFLECTION_RE.test(restyled) && !EVASIVE_DEFLECTION_RE.test(canonical)) {
    return { valid: false, reason: "evasive-deflection" };
  }
  /* Defect 6 (2026-05-16) — sentiment-prefix preservation. If the
   * canonical opened with one of the renderSentimentPrefix anchor
   * phrases, the restyle MUST keep at least one anchor phrase (broad
   * vocab — see SENTIMENT_VOCAB_RE). Without this rule a frustrated /
   * excited / hesitant cue gets stripped to flat-affect cadence. */
  if (SENTIMENT_VOCAB_RE.test(canonical) && !SENTIMENT_VOCAB_RE.test(restyled)) {
    return { valid: false, reason: "sentiment-prefix-stripped" };
  }
  /* LN3 / Audit Pass 4 (PDF#27, 2026-05-17) — em-dash vs en-dash policy.
   * Canonical-prose locks em-dash (—) for prose pauses; en-dash (–) is
   * reserved for numeric ranges only. */
  if (
    restyled.includes(EM_DASH) &&
    restyled.includes(EN_DASH) &&
    hasNonNumericEnDash(restyled) &&
    !hasNonNumericEnDash(canonical)
  ) {
    return { valid: false, reason: "mixed-dash-style" };
  }
  /* LN5 / Audit Pass 4 (PDF#27, 2026-05-17) — fixed/variable phrasing. */
  if (
    INCONSISTENT_COMPONENT_PHRASING_RE.test(restyled) &&
    !INCONSISTENT_COMPONENT_PHRASING_RE.test(canonical)
  ) {
    return { valid: false, reason: "inconsistent-component-phrasing" };
  }
  /* LN6 / Audit Pass 4 (PDF#27, 2026-05-17) — pronoun drift. */
  if (hasPronounDrift(restyled) && !hasPronounDrift(canonical)) {
    return { valid: false, reason: "pronoun-drift" };
  }
  /* Audit Pass 3 / Fix 3 (2026-05-16) — per-kind contract enforcement.
   * Looks up the active NextAction kind in NEXT_ACTION_CONTRACT and
   * applies numberPolicy + requiredTokens + bannedTokens on top of the
   * global checks above. Unknown kinds fall through (no implicit deny).*/
  if (action != null) {
    /* Phase 2 Indian-HR redesign (2026-05-17) — anchor-with-offer honest-
     * defer override. When the band is incomplete the canonical emits a
     * panel-signoff defer (no point-offer, no "LPA"); the static contract
     * would mis-reject it. Skip the contract block for the defer path
     * and require only "fitment" (the invitation token) which keeps
     * the line tied to its purpose. */
    if (action.kind === "anchor-with-offer" && action.bandIncomplete) {
      if (!/\bfitment\b/i.test(restyled)) {
        return { valid: false, reason: "contract-required-token-missing:anchor-with-offer-defer:fitment" };
      }
      return { valid: true };
    }
    const contract = NEXT_ACTION_CONTRACT[action.kind];
    if (contract != null) {
      if (contract.numberPolicy === "forbidden" && restyleNums.length > 0) {
        return { valid: false, reason: `contract-number-forbidden:${action.kind}` };
      }
      if (contract.numberPolicy === "required" && restyleNums.length === 0) {
        return { valid: false, reason: `contract-number-required:${action.kind}` };
      }
      if (contract.requiredTokens != null) {
        for (const re of contract.requiredTokens) {
          if (!re.test(restyled)) {
            return { valid: false, reason: `contract-required-token-missing:${action.kind}:${re.source}` };
          }
        }
      }
      if (contract.bannedTokens != null) {
        for (const re of contract.bannedTokens) {
          if (re.test(restyled)) {
            return { valid: false, reason: `contract-banned-token-present:${action.kind}:${re.source}` };
          }
        }
      }
    }
    /* AP3-F2 (2026-05-17) — component-probe per-component requiredToken
     * overlay. The base contract entry for "component-probe" carries no
     * static requiredTokens because each component (base/variable/esop)
     * pins a different lexical surface. Layer the per-component regex
     * on top of the contract's static checks so the restyle for a
     * "base" probe cannot drift into a "variable" probe or vice-versa. */
    if (action.kind === "component-probe") {
      const re = COMPONENT_PROBE_REQUIRED_TOKENS[action.component];
      if (re != null && !re.test(restyled)) {
        return {
          valid: false,
          reason: `contract-required-token-missing:component-probe:${action.component}:${re.source}`,
        };
      }
      /* PDF#32 BUG G (2026-05-18) — component-probe SHAPE invariant.
       * A component-probe is by construction an ASK: the recruiter is
       * requesting disclosure of base/variable/esop, not narrating that
       * those components exist. PDF#32 T17 shipped a restyle that
       * dropped the question mark and pivoted to a statement of fact:
       *   "Thanks for that — ESOPs do kick in, but there's a vesting
       *    cliff as per company policy."
       * vs canonical: "ESOPs in play? Any vesting cliff or accelerator?"
       *
       * The statement form *fabricates a disclosure on the candidate's
       * behalf* — combined with the "Thanks for that" acknowledgement
       * lead, it reads as if the recruiter is confirming what the
       * candidate just said. But the candidate's prior turn was
       * unparseable noise. The contract-token check passed because
       * "ESOPs"/"vesting" tokens are present; only a shape gate catches
       * the question→statement drift.
       *
       * Reject any component-probe restyle that doesn't carry an
       * interrogative marker (`?`). Canonical always ships with one;
       * if the LLM dropped it, it changed the speech act. */
      if (!/\?/.test(restyled)) {
        return {
          valid: false,
          reason: `contract-shape-not-interrogative:component-probe:${action.component}`,
        };
      }
      /* PDF#32 BUG G (2026-05-18) — fabricated-disclosure statement.
       * Catch the specific statement-form drift even if a `?` slipped
       * in elsewhere: "ESOPs do kick in", "RSUs do vest", "equity does
       * vest", "<equity-token> kicks in" all assert candidate facts
       * the recruiter has no business asserting. */
      if (/\b(?:esops?|rsus?|equity|vest(?:ing)?)\s+(?:do|does|will)\s+(?:kick|vest|exist)/i.test(restyled)) {
        return {
          valid: false,
          reason: `contract-fabricated-disclosure:component-probe:${action.component}`,
        };
      }
    }
  }
  /* Defect 6 (2026-05-16) — close-recap-formal field completeness.
   * The formal recap canonical enumerates Fixed | Variable | (JB) |
   * Notice | BGV | OL ETA, and the candidate is asked to confirm
   * against that list. The LLM has historically smoothed over the
   * recap into a single-sentence summary that drops "fixed",
   * "variable", "notice", or "BGV" — a recap that's missing any of
   * those four is unfit to ship because the candidate's "yes" no
   * longer binds them to the structured terms. */
  if (action != null && action.kind === "close-recap-formal") {
    const lc = restyled.toLowerCase();
    const required = ["fixed", "variable", "notice", "bgv"] as const;
    for (const term of required) {
      if (!lc.includes(term)) {
        return { valid: false, reason: "close-recap-incomplete" };
      }
    }
  }
  return { valid: true };
}

/** Validate the LLM answer against the factPack. Numbers in the answer
 *  must appear in the factPack JSON (or be the candidate's own ctc /
 *  expected). Fabricated specifics → fall back to deterministic defer. */
export function validateAnswer(
  answer: string,
  factPack: { candidateCurrentCtc?: number; candidateExpectedCtc?: number; budgetBand?: { low: number; high: number; walk: number }; teamSize?: number },
  /* PDF#29 Bug 5 (2026-05-18) — semantic state guards. The previous
   * validator only enforced numeric-allowlist + banned-idiom checks;
   * it could not catch claims that DEPEND ON the negotiation state
   * (e.g. "Our final offer remains the same as presented earlier"
   * when highestOfferMade=0 — no offer was ever presented). Two
   * guards live here:
   *   (a) unfounded-final-offer-claim — pre-anchor language about an
   *       offer that doesn't exist.
   *   (b) band-leak-pre-anchor — internal-band reference in any pre-
   *       anchor phase, defence-in-depth against an LLM restyle path
   *       that bypassed the per-action contract.
   * Optional to preserve back-compat with unit-test fixtures that
   * don't have a kernel state to thread. */
  stateContext?: { highestOfferMade: number; phase: NegotiationPhase },
): { valid: boolean; reason?: string } {
  if (!answer || !answer.trim()) return { valid: false, reason: "empty-answer" };
  /* PDF#29 Bug 5 (2026-05-18) — semantic state guards run FIRST so the
   * named reason ("unfounded-final-offer-claim", "band-leak-pre-anchor")
   * surfaces instead of a generic "unfounded-number:X" downstream. */
  if (stateContext) {
    if (stateContext.highestOfferMade <= 0) {
      const UNFOUNDED_FINAL_OFFER_RES: RegExp[] = [
        /\bfinal\s+offer\b/i,
        /\b(?:offer\s+)?remains?\s+the\s+same\b/i,
        /\bas\s+(?:presented|stated|discussed)\s+earlier\b/i,
        /\bour\s+offer\s+(?:stands|stays|holds)\b/i,
      ];
      for (const re of UNFOUNDED_FINAL_OFFER_RES) {
        if (re.test(answer)) {
          return { valid: false, reason: "unfounded-final-offer-claim" };
        }
      }
    }
    const PRE_ANCHOR_PHASES: NegotiationPhase[] = [
      "opening",
      "range-disclosure",
      "probe-expectations",
    ];
    if (PRE_ANCHOR_PHASES.includes(stateContext.phase)) {
      if (/\bband\b[^.!?\n]*\d/i.test(answer)) {
        return { valid: false, reason: "band-leak-pre-anchor" };
      }
    }
  }
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
  /* PDF#30 R3 (2026-05-18, Meesho/Prita session T10) — defensive-loop
   * guard. After a candidate signals frustration at being re-probed
   * (USER_FRUSTRATION_RE), the LLM has historically emitted bot-self-
   * defense rationalizations like "we're asking to ensure we're on the
   * same page" / "to align our understanding" / "for clarity on our
   * end". These are meta-explanations of WHY the bot keeps asking — a
   * tell that the bot is looping on a topic the candidate has already
   * answered. The correct response is acknowledge-and-recover (the new
   * lever added in the PDF#29 batch), NOT a meta-justification.
   *
   * We reject the restyle so the pipeline falls back to the canonical
   * acknowledge-and-recover prose, which apologizes and pivots WITHOUT
   * defending the previous question. */
  if (DEFENSIVE_LOOP_RE.test(answer)) {
    return { valid: false, reason: "defensive-loop-leaked" };
  }
  return { valid: true };
}

/* Audit follow-up (2026-05-21) — fact-grounding validator.
 *
 * `validateAnswer` above is salary-number focused — it catches LPA
 * hallucinations and band-leaks but lets the LLM fabricate NON-NUMERIC
 * facts: manager names ("Priya Sharma"), office addresses ("12th floor,
 * Prestige Tower"), insurance carriers ("ICICI Lombard"), team-lead
 * names, vesting schedules, etc. Those are the audit harm.
 *
 * This validator extracts the proper-noun shaped tokens from the LLM
 * output (capitalized multi-token phrases that aren't at the start of a
 * sentence, plus standalone Title-Case bigrams) and rejects the answer
 * if any of those tokens are NOT present in the JSON-serialized factPack
 * or the small allowlist of generic recruiter vocabulary.
 *
 * It is HEURISTIC. False positives → safe hedge (no harm). False
 * negatives are the harm we're preventing; tune conservatively. The
 * tradeoff favours rejecting borderline LLM prose since the fallback
 * (canonical hedge) is itself a valid recruiter move. */

/* Allowlist: generic recruiter / business / Indian-context tokens that
 * are safe even when not literally in the factPack. Lowercase. Keep
 * tight — anything load-bearing as a fact (carrier names, vendor names,
 * specific city/office strings) MUST come from the pack. */
const GROUNDING_GENERIC_ALLOWLIST = new Set<string>([
  // Days / months / time
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
  "q1", "q2", "q3", "q4",
  // Generic recruiter / role / process vocabulary
  "ctc", "lpa", "hr", "hm", "em", "vp", "ceo", "cto", "cfo", "coo", "pm", "pmo",
  "rsu", "esop", "pf", "epf", "epfo", "uan", "bgv", "esic", "fbp",
  "fixed", "variable", "base", "bonus", "joining", "retention",
  "wfh", "hybrid", "remote", "office", "onsite",
  "india", "indian", "bengaluru", "bangalore", "mumbai", "delhi", "hyderabad",
  "pune", "chennai", "gurgaon", "noida", "kolkata",
  "firstadvantage", "authbridge",
  // Statutory acts / regulators referenced in INDIAN_MARKET_FACTS
  "epf", "esic", "sec", "section",
  // Common BFSI / IT-services / product-cos shorthand
  "bfsi", "it-services", "it",
]);

/* Proper-noun-like phrase detector. Matches:
 *   - Capitalized word followed by 1-3 more capitalized words (e.g.
 *     "Priya Sharma", "ICICI Lombard", "Prestige Tech Park").
 *   - Standalone Capitalized words that aren't the very first word of
 *     a sentence (the lead-word check is applied by scanning per-
 *     sentence and skipping the first whitespace-delimited token).
 * We deliberately do NOT match all-caps acronyms like "RSU" / "BGV"
 * since those are domain vocabulary, not fabricated specifics. */
const PROPER_NOUN_RE = /\b[A-Z][a-z]{1,}(?:\s+[A-Z][a-z]+){0,3}\b/g;

/** Extract proper-noun-shaped tokens from `text`, excluding sentence-
 *  initial leads (which are just normal capitalization). Returns
 *  lowercase tokens for case-insensitive comparison. */
function extractGroundingTokens(text: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  /* Split into sentences on . ! ? while preserving content. */
  const sentences = text.split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    /* Drop sentence-initial capitalized lead — that's syntactic, not a
     * proper noun. Find first whitespace-delimited token and skip it
     * when scanning. */
    const firstSpace = trimmed.indexOf(" ");
    const afterLead = firstSpace > 0 ? trimmed.slice(firstSpace) : "";
    const matches = afterLead.match(PROPER_NOUN_RE) || [];
    for (const m of matches) out.push(m.toLowerCase());
  }
  return out;
}

/** Audit follow-up (2026-05-21) — grounding validator.
 *
 *  Verifies every proper-noun-shaped token in the LLM output appears
 *  either in the JSON-serialized factPack or in the generic allowlist.
 *  Returns { ok: false, reason } when an unrecognised proper noun is
 *  found — the pipeline then substitutes `FACT_GROUNDING_HEDGE`.
 *
 *  Pure. Heuristic. False-positives are safe (hedge fallback); the
 *  tuning bias is low false-negative. */
export function validateAnswerGrounding(
  text: string,
  factPack: unknown,
): { ok: boolean; reason?: string } {
  if (!text || !text.trim()) return { ok: true };
  const tokens = extractGroundingTokens(text);
  if (tokens.length === 0) return { ok: true };
  let packStr: string;
  try {
    packStr = JSON.stringify(factPack ?? {});
  } catch {
    packStr = "";
  }
  const packLower = packStr.toLowerCase();
  for (const tok of tokens) {
    if (GROUNDING_GENERIC_ALLOWLIST.has(tok)) continue;
    /* Multi-word phrase: accept if the FULL phrase appears in pack, or
     * if each component word (>=4 chars) appears in pack. The component
     * check guards against the LLM splicing a real first-name with a
     * fabricated last-name ("Priya Random"). */
    if (packLower.includes(tok)) continue;
    const parts = tok.split(/\s+/);
    const allPartsKnown = parts.every(
      (p) =>
        GROUNDING_GENERIC_ALLOWLIST.has(p) ||
        (p.length >= 4 && packLower.includes(p)) ||
        p.length < 4 /* short tokens too noisy to flag */,
    );
    if (allPartsKnown) continue;
    return { ok: false, reason: `unfounded-proper-noun:${tok}` };
  }
  return { ok: true };
}

/* PDF#30 R3 (2026-05-18) — bot self-defense phrasings that indicate
 * the LLM is justifying the re-probe instead of recovering from it.
 * Conservative list — every cue requires both a meta verb ("ensure",
 * "align", "confirm") AND a topic about the conversation itself
 * ("same page", "understanding", "on our end") so plain "to ensure
 * fit for the role" doesn't false-positive. */
const DEFENSIVE_LOOP_RE = new RegExp(
  [
    // "to ensure we're on the same page" / "ensuring we are on the same page"
    String.raw`\b(?:to\s+)?ensur(?:e|ing)\s+(?:we|that\s+we|you\s+and\s+i)\s*(?:are|.?re)?\s*(?:on\s+the\s+same\s+page|aligned|in\s+sync|in\s+alignment)`,
    // "to align our understanding" / "for alignment on our end"
    String.raw`\b(?:to\s+|for\s+)?align(?:ment|ing)?\s+(?:our|on)\s+(?:understanding|end|side|process)`,
    // "for clarity on our end" / "clarity on our side"
    String.raw`\bfor\s+clarity\s+on\s+(?:our|my)\s+(?:end|side|process)`,
    // "to make sure we have the right understanding" / "we have a clear picture"
    String.raw`\b(?:to\s+)?make\s+sure\s+(?:we|i)\s+(?:have|get)\s+(?:the\s+right|a\s+clear|complete)\s+(?:understanding|picture|alignment)`,
    // "for our records to be accurate" / "to keep our records straight"
    String.raw`\b(?:for|to\s+keep)\s+our\s+records\s+(?:to\s+be\s+)?(?:accurate|straight|complete)`,
    // "we're asking [again|this] to confirm/verify our understanding"
    String.raw`\bwe.?re\s+asking\s+(?:again|this|the\s+same)\s+(?:to|so\s+(?:that|we))\s+(?:confirm|verify|align|ensure)`,
  ].join("|"),
  "i",
);

function lowercaseFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/* ─── AR2 / Audit Pass 4 — turn-pair coherence (dev only) ───────────── */

/** AR2 / Audit Pass 4 (PDF#27, 2026-05-17) — turn-pair coherence.
 *
 *  Diagnostic-only validator that fires AFTER a candidate answer has
 *  been folded into state and the planner has emitted the NEXT AI turn.
 *  Flags three classes of incoherence:
 *
 *  (a) SILENT DODGE — prev AI turn asked topic X, candidate gave a
 *      non-trivial reply, planner is asking X again because state[X]
 *      stayed null. The parser missed the disclosure.
 *  (b) ACK WITHOUT DISCLOSURE — next AI turn acks a state field that
 *      wasn't populated this turn (foldFacts missed, or the parser
 *      hallucinated).
 *  (c) TOPIC REGRESS — anchoring → discovery drop-back without an
 *      explicit phase reset.
 *
 *  Dev-only (`process.env.NODE_ENV !== 'production'`). Never blocks
 *  prod traffic. console.warn + ring-buffer for test inspection. */

type CoherenceTopic =
  | "currentCtc"
  | "targetCtc"
  | "noticePeriod"
  | "competingOffers"
  | "valueProof"
  | "fixedVariableSplit";

type ProbeKind =
  | "discovery-probe"
  | "component-probe"
  | "probe-expectations"
  | "probe-justification"
  | "reactive-followup"
  | "anchor-with-offer"
  | "band-disclosure-deflect"
  | "probe-mismatch";

const PROBE_KINDS: ReadonlySet<string> = new Set<ProbeKind>([
  "discovery-probe",
  "component-probe",
  "probe-expectations",
  "probe-justification",
  "reactive-followup",
  "anchor-with-offer",
  "band-disclosure-deflect",
  "probe-mismatch",
]);

/** Map probe action → the topic it satisfies. Best-effort derivation
 *  from the existing NextAction shape until AR1 lands the type-level
 *  satisfiesTopic field. */
function deriveSatisfiesTopic(action: NextAction): CoherenceTopic | null {
  switch (action.kind) {
    case "discovery-probe": {
      const item = (action as { item?: string }).item ?? "";
      if (item === "currentCtc") return "currentCtc";
      if (item === "expectedCtc" || item === "target") return "targetCtc";
      if (item === "noticePeriod") return "noticePeriod";
      if (item === "competing" || item === "competingOffers") return "competingOffers";
      if (item === "valueProof") return "valueProof";
      if (item === "fixedVariable" || item === "fixedVariableSplit") return "fixedVariableSplit";
      return null;
    }
    case "probe-expectations":
      return "targetCtc";
    case "probe-justification":
      return "targetCtc";
    case "component-probe":
      return "currentCtc";
    case "anchor-with-offer":
      return "targetCtc";
    case "band-disclosure-deflect":
      return "targetCtc";
    case "reactive-followup": {
      const topic = (action as { topic?: string }).topic ?? "";
      if (topic === "ctc-gentle-push" || topic === "hike-justification" || topic === "number-clarification") return "currentCtc";
      if (topic === "value-proof") return "valueProof";
      if (topic === "notice-buyout" || topic === "notice-buyout-confirm") return "noticePeriod";
      if (topic === "competing-credibility" || topic === "competing-leverage-ack") return "competingOffers";
      if (topic === "variable-comfort" || topic === "equity-clarity") return "fixedVariableSplit";
      return null;
    }
    default:
      return null;
  }
}

/** Read the state field a topic should be populating into. Null means
 *  the candidate hasn't disclosed it yet. */
function readTopicField(
  topic: CoherenceTopic,
  state: NegotiationState,
): unknown {
  switch (topic) {
    case "currentCtc":
      return state.candidateCurrentCtc ?? null;
    case "targetCtc":
      return state.candidateTarget ?? null;
    case "noticePeriod":
      return (state as { candidateNoticePeriodWeeks?: number | null }).candidateNoticePeriodWeeks ?? null;
    case "competingOffers":
      return state.competingOffer ?? null;
    case "valueProof":
      return (state as { valueProof?: unknown }).valueProof ?? null;
    case "fixedVariableSplit":
      return state.candidateComponentBreakdown ?? null;
  }
}

/** Topic ordering for regression check — lower index = earlier phase. */
const TOPIC_PHASE_ORDER: Record<string, number> = {
  "discovery-probe": 0,
  "component-probe": 0,
  "probe-expectations": 1,
  "probe-justification": 1,
  "anchor-with-offer": 2,
  "band-disclosure-deflect": 2,
  "counter-offer": 3,
  "close-recap-formal": 4,
};

/** Ring buffer of dev-only warnings — exposed for tests. */
interface CoherenceWarning {
  kind: "silent-dodge" | "ack-without-disclosure" | "topic-regress";
  topic: CoherenceTopic | null;
  prevKind: string;
  nextKind: string;
  message: string;
}
const COHERENCE_BUFFER: CoherenceWarning[] = [];
const COHERENCE_BUFFER_MAX = 64;

export function getCoherenceWarnings(): readonly CoherenceWarning[] {
  return COHERENCE_BUFFER.slice();
}

export function clearCoherenceWarnings(): void {
  COHERENCE_BUFFER.length = 0;
}

function pushCoherenceWarning(w: CoherenceWarning): void {
  COHERENCE_BUFFER.push(w);
  if (COHERENCE_BUFFER.length > COHERENCE_BUFFER_MAX) {
    COHERENCE_BUFFER.shift();
  }
  // eslint-disable-next-line no-console
  console.warn(`[turn-coherence] ${w.kind}: ${w.message}`);
}

/** AR2 / Audit Pass 4 (PDF#27, 2026-05-17) — turn-pair coherence
 *  validator. Dev-only diagnostic. Returns the warnings it surfaced
 *  (also pushed to the ring buffer). Always returns; never throws. */
export function validateTurnCoherence(
  prevAiTurn: NextAction | null,
  candidateAnswer: string | null | undefined,
  nextAiTurn: NextAction | null,
  state: NegotiationState,
): readonly CoherenceWarning[] {
  /* Production gate (2026-05-25b). In prod, sample by
   * POSTHOG_COHERENCE_SAMPLE (0..1). Default 0 keeps prod silent until
   * ops explicitly opts in. Dev/test always runs at 100% so the
   * regression harness sees every warning. Parse defensively: a
   * malformed env value (NaN, negative, > 1) collapses to 0. */
  if (process.env.NODE_ENV === "production") {
    const raw = Number(process.env.POSTHOG_COHERENCE_SAMPLE);
    const rate = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
    if (rate === 0) return [];
    if (rate < 1 && Math.random() >= rate) return [];
  }
  const surfaced: CoherenceWarning[] = [];
  if (prevAiTurn == null || nextAiTurn == null) return surfaced;

  /* Non-trivial = ≥3 words OR contains a number. */
  const isNonTrivial = (() => {
    const t = (candidateAnswer ?? "").trim();
    if (!t) return false;
    if (/\d/.test(t)) return true;
    const words = t.split(/\s+/).filter((w) => w.length > 0);
    return words.length >= 3;
  })();

  const prevTopic = PROBE_KINDS.has(prevAiTurn.kind)
    ? deriveSatisfiesTopic(prevAiTurn)
    : null;
  const nextTopic = PROBE_KINDS.has(nextAiTurn.kind)
    ? deriveSatisfiesTopic(nextAiTurn)
    : null;

  /* (a) SILENT DODGE — same topic re-asked after a non-trivial answer
   *     but state field for that topic is still null. */
  if (
    prevTopic != null &&
    nextTopic === prevTopic &&
    isNonTrivial &&
    readTopicField(prevTopic, state) == null
  ) {
    const w: CoherenceWarning = {
      kind: "silent-dodge",
      topic: prevTopic,
      prevKind: prevAiTurn.kind,
      nextKind: nextAiTurn.kind,
      message: `re-asking topic "${prevTopic}" after non-trivial reply but state[${prevTopic}] still null — parser miss?`,
    };
    pushCoherenceWarning(w);
    surfaced.push(w);
  }

  /* (b) ACK WITHOUT DISCLOSURE — next AI turn acks the prev topic but
   *     the corresponding state field wasn't populated this turn. We
   *     detect ack by checking whether nextAiTurn is NOT a re-probe of
   *     prevTopic (i.e. moved on) AND state[prevTopic] still null. */
  if (
    prevTopic != null &&
    nextTopic !== prevTopic &&
    PROBE_KINDS.has(nextAiTurn.kind) &&
    isNonTrivial &&
    readTopicField(prevTopic, state) == null
  ) {
    const w: CoherenceWarning = {
      kind: "ack-without-disclosure",
      topic: prevTopic,
      prevKind: prevAiTurn.kind,
      nextKind: nextAiTurn.kind,
      message: `advanced past topic "${prevTopic}" without state[${prevTopic}] being populated`,
    };
    pushCoherenceWarning(w);
    surfaced.push(w);
  }

  /* (c) TOPIC REGRESS — anchoring/counter dropping back to discovery
   *     without an explicit phase reset. */
  const prevPhase = TOPIC_PHASE_ORDER[prevAiTurn.kind];
  const nextPhase = TOPIC_PHASE_ORDER[nextAiTurn.kind];
  if (
    typeof prevPhase === "number" &&
    typeof nextPhase === "number" &&
    nextPhase < prevPhase &&
    prevPhase >= 2
  ) {
    const w: CoherenceWarning = {
      kind: "topic-regress",
      topic: null,
      prevKind: prevAiTurn.kind,
      nextKind: nextAiTurn.kind,
      message: `phase regress from "${prevAiTurn.kind}" (rank ${prevPhase}) to "${nextAiTurn.kind}" (rank ${nextPhase}) without explicit reset`,
    };
    pushCoherenceWarning(w);
    surfaced.push(w);
  }

  return surfaced;
}

/** AR2 telemetry emit (2026-05-25) — surface coherence warnings to
 *  PostHog so live regressions get logged the way the regression harness
 *  catches them in tests. Fire-and-forget, never throws (telemetry must
 *  never break a request). One event per warning so the PostHog filter
 *  surface can pivot by `kind` / `topic`. */
async function emitCoherenceWarnings(
  state: NegotiationState,
  warnings: readonly CoherenceWarning[],
  distinctId?: string,
): Promise<void> {
  /* Prod sampling is owned by validateTurnCoherence (POSTHOG_COHERENCE_SAMPLE).
   * Prefer the route-supplied distinctId (derived via distinctIdFrom(req,
   * userId) so person-on-events joins to the same user across events);
   * fall back to sessionId, then "anonymous". */
  if (warnings.length === 0) return;
  const id =
    distinctId ??
    (state as { sessionId?: string }).sessionId ??
    "anonymous";
  for (const w of warnings) {
    void captureServerEvent("negotiation_coherence_warning", id, {
      kind: w.kind,
      topic: w.topic,
      prev_action_kind: w.prevKind,
      next_action_kind: w.nextKind,
      turn_index: (state as { turnIndex?: number }).turnIndex ?? null,
      phase: (state as { phase?: string }).phase ?? null,
      message: w.message,
    });
  }
}
