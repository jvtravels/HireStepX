/* Vercel Edge Function — Canonical Negotiation Turn
 * ─────────────────────────────────────────────────────────────────────
 * Ship 2 of the structural rewrite. This endpoint owns one turn of a
 * salary negotiation:
 *
 *   { action: "init", role, company, band? }
 *     → initialises state, picks open-with-offer, generates the opening
 *       line, returns serialized state + text.
 *
 *   { action: "turn", state, candidateAnswer }
 *     → folds candidate's answer into state, derives phase, picks the
 *       AI's move, generates text via LLM, validates against the band
 *       and verbatim-repeat guard, applies move to state, returns
 *       serialized new state + text.
 *
 * Feature-flagged: by default this endpoint returns 404 unless
 * NEGOTIATION_KERNEL_ENABLED=1. That means committing this to main is
 * safe — no traffic flows here until the env var flips, and Ship 3
 * (engine wiring) gates the client on the same flag via /api/feature-flags.
 *
 * The LLM is downstream of the kernel and CANNOT mutate state. If it
 * returns text that violates the band or repeats verbatim, we retry
 * once with a tighter prompt, then fall back to deterministic text.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, validateContentType, hashStable, redisGet, redisSetEx } from "./_shared";
import { callLLM } from "./_llm";
import { captureServerEvent, distinctIdFrom } from "./_posthog";
import {
  initState,
  applyCandidateAnswer,
  pickAiMove,
  applyAiMove,
  serializeState,
  deserializeState,
  isTerminalPhase,
  type NegotiationState,
  type NegotiationBand,
  type AiMove,
} from "./_negotiation-kernel";
import { resolveServerBand } from "./_band-resolver";
import {
  buildAiPrompt,
  validateAiText,
  validateStructuredFields,
  parseStructuredAiResponse,
  deterministicFallbackText,
  stripMarkdown,
} from "./_negotiate-turn-helpers";
import { enforceRoleLabel } from "./_role-label";
import { checkBandSanity, bandFamilyForRole, clampBandToTierP50 } from "./_band-sanity";
import { getCompanyTier } from "../data/company-tiers";
import {
  detectAdversarialInput,
  JAILBREAK_DEFLECTION_TEXT,
  detectPromptInjection,
  detectMultiTurnInjection,
  detectTokenLeak,
  redactLeakedTokens,
  detectDocumentRequest,
  stripDocumentRequest,
  stripHonorifics,
  detectUnpromptedSweetener,
  stripUnpromptedSweetener,
} from "./_adversarial-detector";
import {
  clampInput,
  checkSessionTurnLimit,
  checkUserDailyLimit,
  logTurnUsage,
} from "./_session-limits";
import { getTurnsToday, incrementTurnsToday } from "./_daily-cap-store";
import { selectPromptVariant, getSystemPrompt, type PromptVariant } from "./_prompt-variants";
import { detectBotReplyRepetition, BOT_REPLY_REPETITION_THRESHOLD } from "./_recruiter-facts";
import { assessTurnCoherence } from "./_turn-coherence";
import {
  validateNumberDiscipline,
  validateBudgetDiscipline,
  validateRangeDiscipline,
  validateAcknowledgement,
  validateNextActionEmitted,
  validateHikeProbe,
  validateNoFabricatedFacts,
} from "./_response-validators";
import { renderActionFallbackProse, type NextAction } from "./_next-action-planner";

declare const process: { env: Record<string, string | undefined> };

/* Post-rebuild (Phase 7, May 2026): kernel is the live path by default.
 * The flag flipped from opt-in to opt-OUT — set NEGOTIATION_KERNEL_ENABLED=0
 * to disable. This is the right semantic now that the v2 kernel has
 * surface parity with the old static script and addresses the five
 * documented failure modes (Lollypop + Wipro sessions). Disable-flag
 * exists only as an emergency stop if something regresses in prod. */
const ENABLED = process.env.NEGOTIATION_KERNEL_ENABLED !== "0";

/** Hard cap on the candidate's free-text answer per turn. STT mishears
 *  and copy-paste accidents can push payloads to tens of KB, which both
 *  dominates the LLM prompt budget and surfaces TLS retransmit issues
 *  on the kind of mobile networks we deploy on in India. 4 KB is well
 *  above a normal spoken-answer length (~200 words ≈ 1.2 KB) but bounds
 *  the worst case. */
const MAX_CANDIDATE_ANSWER_CHARS = 4_000;

/** Idempotency window for the turn endpoint. India-mobile retries
 *  (TLS timeout → client re-fires) used to apply the same answer twice,
 *  double-incrementing turnIndex and double-counting metric movements.
 *  We hash (action + state + answer) and cache the *whole* response for
 *  60 s; the second fire returns the first fire's body verbatim. */
const IDEMPOTENCY_TTL_SEC = 60;

/* resolveServerBand + DEFAULT_BAND + inferExperienceFromRole live in
 * ./_band-resolver — extracted so the kernel can re-resolve mid-session
 * when freshGradDisclosed flips true. Imported above. */

interface InitRequest {
  action: "init";
  sessionId: string;
  role: string;
  company: string;
  band?: NegotiationBand;
  maxTurns?: number;
  /** Candidate's self-reported experience level (entry/mid/senior/lead/
   *  executive). Threaded through to generateNegotiationBand so the
   *  server-resolved band reflects seniority — without this, a senior
   *  Java dev applying to TCS was getting the entry-level band ceiling
   *  (May 2026 session). Untrusted in the sense that the salary-lookup
   *  pipeline gates downstream, but the field itself is informational. */
  experienceLevel?: string;
  /* Phase 29 (2026-05-14) — role-applicable YOE. The client computes
   * (totalYoe, primaryDomain) from the resume and applicableYoe from
   * the (primaryDomain, role) pair. When applicableYoe is provided, it
   * trumps experienceLevel — a Senior Product Designer pivoting to
   * Java would carry experienceLevel="senior" from onboarding but
   * applicableYoe≈0, and the band must reflect the latter. Untrusted
   * in the band-resolution sense (salary-lookup gates downstream), but
   * the dispatch field is informational. */
  totalYoe?: number | null;
  applicableYoe?: number | null;
  primaryDomain?: string | null;
  /** Fresher-flow extension (2026-05-14c). Optional onboarding signal —
   *  client may pass collegeTier from resume parsing or a self-select
   *  field. Routes into resolveServerBand as a ±20-25% multiplier on
   *  the entry band. Server-validated to the known enum before use. */
  collegeTier?: string;
  /** Fresher-flow extension (2026-05-14d). Optional override of the
   *  default 6-month internship duration when the role is an intern
   *  role. Sent by the onboarding flow when the user selects a 12-week
   *  summer / 3-month winter program. Clamped server-side to [1,12]. */
  internshipMonths?: number;
}

interface TurnRequest {
  action: "turn";
  state: string; // serialized NegotiationState
  candidateAnswer: string;
}

type RequestBody = InitRequest | TurnRequest;

/* ─── LLM glue (injectable for tests) ─────────────────────────────── */

export interface LlmCaller {
  (system: string, user: string, opts: { userId?: string }): Promise<string>;
}

const defaultLlmCaller: LlmCaller = async (system, user, opts) => {
  /* jsonMode: true forces Groq / Gemini / Cerebras into structured
     response mode. The prompt asks for a 4-field envelope (text,
     roleMentioned, totalLpaMentioned, leverExecuted) — see
     buildAiPrompt. maxTokens bumped from 220 to 320 to make room for
     the JSON envelope keys; the actual prose stays 1–3 sentences. */
  const result = await callLLM(
    { prompt: `${system}\n\n${user}`, temperature: 0.7, maxTokens: 320, fast: true, jsonMode: true },
    8000,
    { userId: opts.userId, endpoint: "negotiate-turn" },
  );
  return result.text;
};

/** Generate AI text for a move, retry on validation failure, fall back
 *  to deterministic on second failure. Exposed for tests via DI. */
export async function generateAiText(
  state: NegotiationState,
  move: AiMove,
  candidateAnswer: string,
  llm: LlmCaller,
  userId?: string,
  promptVariant?: PromptVariant,
): Promise<{
  text: string;
  source: "llm" | "llm-retry" | "fallback";
  /* Validation failures observed across attempts. Captured so the
     handler can emit telemetry without needing to re-run validators —
     critical for diagnosing regressions in the wild (a transcript
     alone doesn't show *which* check fired). */
  failureKinds: string[];
  /* Count of LLM attempts that returned text the structured-envelope
     parser couldn't decode (LLM ignored jsonMode or wrapped its
     response in unrecoverable prose). 0/1/2. Surfaced so the handler
     can emit `kernel_structured_envelope_missing` PostHog events and
     we can track the LLM provider's jsonMode-honouring rate over
     time — directly addresses the "refusal rate is invisible" risk
     called out post-Phase-2. */
  envelopeMissingAttempts: number;
}> {
  const built = buildAiPrompt({ state, move, candidateAnswer });
  /* A/B prompt-variant transform — applied at the leaf so the kernel
   * brief / user message stays cache-stable. The variant is selected
   * once per session by `selectPromptVariant`; we accept it as a param
   * so the handler can log it via PostHog without re-selecting. */
  const variant: PromptVariant = promptVariant ?? "control";
  const system = getSystemPrompt(variant, built.system);
  const user = built.user;
  const failureKinds: string[] = [];
  let envelopeMissingAttempts = 0;

  /* One attempt = call LLM → parse JSON envelope → run text + structured
     validators. The structured envelope is Phase 2 of the rebuild
     (forcing the LLM to emit roleMentioned / totalLpaMentioned /
     leverExecuted alongside the prose). When jsonMode produces a
     malformed envelope, we fall through to the text-only path on the
     raw output — same validators still run on .text, so this is
     strictly additive vs the pre-Phase-2 behaviour. */
  async function attempt(promptUser: string): Promise<{ text: string; failures: string[]; envelopeOk: boolean } | { error: string }> {
    let raw: string;
    try {
      raw = await llm(system, promptUser, { userId });
    } catch {
      return { error: "llm-throw" };
    }
    /* parseStructuredAiResponse tolerates fences, preambles, and trailing
       prose. When it returns null the LLM either ignored JSON-mode or
       emitted something unparseable; fall through to text-only validation
       on the raw output (pre-Phase-2 behaviour). The structured-field
       checks add coverage when present but don't gate when absent —
       that way Phase 2 is purely additive, no regression in the path
       where the upstream LLM provider quietly disables jsonMode. */
    const parsed = parseStructuredAiResponse(raw);
    const text = stripMarkdown(parsed ? parsed.text : raw);
    const v = validateAiText(text, state, move);
    const structured = parsed ? validateStructuredFields(parsed, state, move) : [];
    const allFailures = [...v.failures, ...structured];
    return { text, failures: allFailures.map(f => f.kind), envelopeOk: parsed !== null };
  }

  const a1 = await attempt(user);
  if ("error" in a1) {
    return { text: enforceRoleLabel(deterministicFallbackText(state, move), state.role || ""), source: "fallback", failureKinds: [a1.error], envelopeMissingAttempts };
  }
  if (!a1.envelopeOk) envelopeMissingAttempts++;
  if (a1.failures.length === 0) {
    /* Fix 4 (2026-05-15) — Full-message-repetition detector. Reroll once
     * if the validated text near-duplicates the prior bot reply. */
    const rep = detectBotReplyRepetition(a1.text, state.lastBotReply ?? null);
    /* Sprint C.1 (2026-05-15) — turn-coherence detector. If the candidate
     * asked a real question or a breakdown ask and the bot reply doesn't
     * address it, reroll once with an explicit answer-the-question note.
     * Mirrors the repetition reroll pattern. */
    const coh = assessTurnCoherence(candidateAnswer, a1.text);
    /* Architectural bug-prevention (2026-05-15) — promote NUMBER DISCIPLINE
     * and BUDGET DISCIPLINE to post-generation state validators. The
     * prompt still carries the rules; these are the enforcement layer. */
    const numDisc = validateNumberDiscipline(a1.text, state);
    const budDisc = validateBudgetDiscipline(a1.text, state);
    /* Negotiation-flow redesign commit 5 (2026-05-15) — 4 more validators. */
    const rangeDisc = validateRangeDiscipline(a1.text, state);
    const ackDisc = validateAcknowledgement(a1.text, state);
    const nextActDisc = validateNextActionEmitted(a1.text, state);
    const hikeDisc = validateHikeProbe(a1.text, state);
    /* F3 (PDF#19 2026-05-15) — fabricated-facts validator. Critical. */
    const fabDisc = validateNoFabricatedFacts(a1.text, state);
    if (
      !rep.repeated &&
      coh.coherent &&
      numDisc.ok &&
      budDisc.ok &&
      rangeDisc.ok &&
      ackDisc.ok &&
      nextActDisc.ok &&
      hikeDisc.ok &&
      fabDisc.ok
    ) {
      return { text: enforceRoleLabel(a1.text, state.role || ""), source: "llm", failureKinds, envelopeMissingAttempts };
    }
    /* F3 (2026-05-15) — reroll cap. We allow at most ONE reroll across
     * coherence + duplicate-reply combined. If a1 triggers both flags
     * we attach BOTH notes to a single reroll prompt rather than stacking
     * two sequential rerolls (which would burn 3 LLM calls and double
     * the latency). After the single reroll attempt, return whichever
     * draft is least bad — never fire a third call. The combined-notes
     * design also guarantees a 4-failure-mode session caps at 2 calls. */
    let rerollAttempts = 0;
    const rerollNotes: string[] = [];
    if (rep.repeated) {
      console.warn(`[negotiate-turn] bot reply repetition detected (sim=${rep.similarity.toFixed(2)}); rerolling`);
      rerollNotes.push(
        `DO NOT REPEAT THE PREVIOUS REPLY (Jaccard similarity ${rep.similarity.toFixed(2)} ≥ ${BOT_REPLY_REPETITION_THRESHOLD}). Generate a new substantive answer that advances the negotiation, not a paraphrase of your last turn.`,
      );
    }
    if (!coh.coherent) {
      console.warn(`[negotiate-turn] turn-incoherence detected (${coh.reason ?? ""}); rerolling`);
      rerollNotes.push(
        `ANSWER THE CANDIDATE'S LAST UTTERANCE DIRECTLY. ${coh.reason ?? ""} Either give a specific number or an explicit deferral ("I'll come back to that"), and keep content overlap with the candidate's question.`,
      );
    }
    if (!numDisc.ok) {
      console.warn(`[negotiate-turn] number-discipline violation (${numDisc.reason}); rerolling`);
      rerollNotes.push(`[VALIDATOR REJECTION: ${numDisc.reason}]`);
    }
    if (!budDisc.ok) {
      console.warn(`[negotiate-turn] budget-discipline violation (${budDisc.reason}); rerolling`);
      rerollNotes.push(`[VALIDATOR REJECTION: ${budDisc.reason}]`);
    }
    if (!rangeDisc.ok) {
      console.warn(`[negotiate-turn] range-discipline violation (${rangeDisc.reason}); rerolling`);
      rerollNotes.push(`[VALIDATOR REJECTION: ${rangeDisc.reason}]`);
    }
    if (!ackDisc.ok) {
      console.warn(`[negotiate-turn] acknowledgement violation (${ackDisc.reason}); rerolling`);
      rerollNotes.push(`[VALIDATOR REJECTION: ${ackDisc.reason}]`);
    }
    if (!nextActDisc.ok) {
      console.warn(`[negotiate-turn] next-action violation (${nextActDisc.reason}); rerolling`);
      rerollNotes.push(`[VALIDATOR REJECTION: ${nextActDisc.reason}]`);
    }
    if (!hikeDisc.ok) {
      console.warn(`[negotiate-turn] hike-probe violation (${hikeDisc.reason}); rerolling`);
      rerollNotes.push(`[VALIDATOR REJECTION: ${hikeDisc.reason}]`);
    }
    if (!fabDisc.ok) {
      /* F3 (PDF#19 2026-05-15) — fabricated-facts critical. */
      console.warn(`[negotiate-turn] fabricated-facts violation (${fabDisc.reason}); rerolling`);
      rerollNotes.push(`[VALIDATOR REJECTION: ${fabDisc.reason}]`);
    }
    const rerollUser = user + `\n\nNOTE — ${rerollNotes.join(" ")}`;
    rerollAttempts++;
    const a1b = await attempt(rerollUser);
    if (!("error" in a1b)) {
      if (!a1b.envelopeOk) envelopeMissingAttempts++;
      if (a1b.failures.length === 0) {
        const rep2 = detectBotReplyRepetition(a1b.text, state.lastBotReply ?? null);
        const coh2 = assessTurnCoherence(candidateAnswer, a1b.text);
        const numDisc2 = validateNumberDiscipline(a1b.text, state);
        const budDisc2 = validateBudgetDiscipline(a1b.text, state);
        const rangeDisc2 = validateRangeDiscipline(a1b.text, state);
        const ackDisc2 = validateAcknowledgement(a1b.text, state);
        const nextActDisc2 = validateNextActionEmitted(a1b.text, state);
        const hikeDisc2 = validateHikeProbe(a1b.text, state);
        /* F3 (PDF#19 2026-05-15) — fabricated-facts validator. */
        const fabDisc2 = validateNoFabricatedFacts(a1b.text, state);
        if (
          !rep2.repeated &&
          coh2.coherent &&
          numDisc2.ok &&
          budDisc2.ok &&
          rangeDisc2.ok &&
          ackDisc2.ok &&
          nextActDisc2.ok &&
          hikeDisc2.ok &&
          fabDisc2.ok
        ) {
          return { text: enforceRoleLabel(a1b.text, state.role || ""), source: "llm-retry", failureKinds, envelopeMissingAttempts };
        }
        if (rep2.repeated) {
          console.warn(`[negotiate-turn] bot reply repetition persisted after reroll (sim=${rep2.similarity.toFixed(2)}); returning original`);
        }
        if (!coh2.coherent) {
          console.warn(`[negotiate-turn] turn-incoherence persisted after reroll (${coh2.reason ?? ""}); returning original`);
        }
        /* F2 (PDF#19 2026-05-15) — kernel-authored prose substitution.
         * Previously this site logged a `validator-reject-fallthrough`
         * decisionLog entry and SHIPPED THE BAD LLM TEXT to the user.
         * That is the meta-defect: prompt-rule "advisory" violations
         * escaped validator enforcement. Now: when ANY critical
         * discipline persists past the reroll cap, substitute
         * deterministic prose anchored on state.plannedNextAction. */
        const criticalFailed =
          !numDisc2.ok ||
          !budDisc2.ok ||
          !rangeDisc2.ok ||
          !nextActDisc2.ok ||
          !fabDisc2.ok;
        const advisoryFailed = !ackDisc2.ok || !hikeDisc2.ok;
        if (criticalFailed) {
          const reasons = [
            !numDisc2.ok ? `number-discipline: ${numDisc2.reason}` : null,
            !budDisc2.ok ? `budget-discipline: ${budDisc2.reason}` : null,
            !rangeDisc2.ok ? `range-discipline: ${rangeDisc2.reason}` : null,
            !nextActDisc2.ok ? `next-action-emitted: ${nextActDisc2.reason}` : null,
            !fabDisc2.ok ? `fabricated-facts: ${fabDisc2.reason}` : null,
          ].filter((r): r is string => !!r);
          console.warn(`[negotiate-turn] critical validator fallthrough → substituting kernel prose: ${reasons.join(" | ")}`);
          if (!state.decisionLog) state.decisionLog = [];
          state.decisionLog.push({
            turn: state.turnIndex,
            picker: "kernel-prose-substitution",
            rationale: reasons.join(" | "),
            phase: state.phase,
          });
          const planned = (state.plannedNextAction ?? null) as NextAction | null;
          const substituted = renderActionFallbackProse(planned, state);
          return { text: enforceRoleLabel(substituted, state.role || ""), source: "fallback", failureKinds, envelopeMissingAttempts };
        }
        if (advisoryFailed) {
          const reasons = [
            !ackDisc2.ok ? `acknowledgement: ${ackDisc2.reason}` : null,
            !hikeDisc2.ok ? `hike-probe: ${hikeDisc2.reason}` : null,
          ].filter((r): r is string => !!r);
          console.warn(`[negotiate-turn] advisory validator fallthrough (returning original): ${reasons.join(" | ")}`);
          if (!state.decisionLog) state.decisionLog = [];
          state.decisionLog.push({
            turn: state.turnIndex,
            picker: "validator-advisory-fallthrough",
            rationale: reasons.join(" | "),
            phase: state.phase,
          });
        }
      }
    }
    /* F3 reroll-cap enforcement: rerollAttempts === 1 here. We do NOT
     * fire a second reroll regardless of which flag persisted — return
     * the original draft as the "least bad" choice (it at least passed
     * the legality + structured-envelope validators). */
    void rerollAttempts; // documented invariant; cap = 1
    /* F2 (PDF#19) — ALSO substitute on a1's critical-failure path when
     * a1b didn't recover. If a1 had a critical failure and a1b is in
     * `error` state OR a1b.failures.length > 0, we still reach here
     * holding a1.text — that's the bad text. Substitute on critical. */
    const a1Crit =
      !numDisc.ok || !budDisc.ok || !rangeDisc.ok || !nextActDisc.ok || !fabDisc.ok;
    if (a1Crit) {
      const reasons = [
        !numDisc.ok ? `number-discipline: ${numDisc.reason}` : null,
        !budDisc.ok ? `budget-discipline: ${budDisc.reason}` : null,
        !rangeDisc.ok ? `range-discipline: ${rangeDisc.reason}` : null,
        !nextActDisc.ok ? `next-action-emitted: ${nextActDisc.reason}` : null,
        !fabDisc.ok ? `fabricated-facts: ${fabDisc.reason}` : null,
      ].filter((r): r is string => !!r);
      console.warn(`[negotiate-turn] critical validator fallthrough (a1 path) → substituting kernel prose: ${reasons.join(" | ")}`);
      if (!state.decisionLog) state.decisionLog = [];
      state.decisionLog.push({
        turn: state.turnIndex,
        picker: "kernel-prose-substitution",
        rationale: reasons.join(" | "),
        phase: state.phase,
      });
      const planned = (state.plannedNextAction ?? null) as NextAction | null;
      const substituted = renderActionFallbackProse(planned, state);
      return { text: enforceRoleLabel(substituted, state.role || ""), source: "fallback", failureKinds, envelopeMissingAttempts };
    }
    return { text: enforceRoleLabel(a1.text, state.role || ""), source: "llm", failureKinds, envelopeMissingAttempts };
  }
  failureKinds.push(...a1.failures);

  /* Retry with explicit failure feedback in the prompt. */
  const retryUser =
    user +
    `\n\nNOTE — your previous draft failed validation (kinds: ${a1.failures.join(", ")}). ` +
    `Try again. Stick to the kernel brief exactly and ensure the JSON envelope fields agree with the prose.`;
  const a2 = await attempt(retryUser);
  if ("error" in a2) {
    return { text: enforceRoleLabel(deterministicFallbackText(state, move), state.role || ""), source: "fallback", failureKinds: [...failureKinds, a2.error], envelopeMissingAttempts };
  }
  if (!a2.envelopeOk) envelopeMissingAttempts++;
  if (a2.failures.length === 0) return { text: enforceRoleLabel(a2.text, state.role || ""), source: "llm-retry", failureKinds, envelopeMissingAttempts };
  failureKinds.push(...a2.failures);

  return { text: enforceRoleLabel(deterministicFallbackText(state, move), state.role || ""), source: "fallback", failureKinds, envelopeMissingAttempts };
}

/* ─── Handler ─────────────────────────────────────────────────────── */

export default async function handler(
  req: Request,
  deps?: { llm?: LlmCaller },
): Promise<Response> {
  if (!ENABLED) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  {
    const early = validateContentType(req, withRequestId(corsHeaders(req)));
    if (early) return early;
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "negotiate-turn",
    ipLimit: 30,
    userLimit: 20,
    maxBytes: 32_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  const llm = deps?.llm ?? defaultLlmCaller;

  try {
    const distinctId = distinctIdFrom(req, auth.userId);

    if (body.action === "init") {
      const role = body.role || "swe";
      const company = body.company || "";
      /* SECURITY: ignore body.band. Recompute server-side from (role,
         company) so a tampered client can't push the band ceiling. */
      const applicableYoe = typeof body.applicableYoe === "number" && Number.isFinite(body.applicableYoe)
        ? body.applicableYoe
        : null;
      const totalYoe = typeof body.totalYoe === "number" && Number.isFinite(body.totalYoe)
        ? body.totalYoe
        : null;
      const primaryDomain = typeof body.primaryDomain === "string" && body.primaryDomain
        ? body.primaryDomain
        : null;
      /* Fresher-flow extension (2026-05-14c): collegeTier may arrive in
       * the onboarding body (resume-derived or self-selected). PPO flag
       * is candidate-utterance-derived so it won't be set at init —
       * mid-session rebase handles the late-disclosure case. Accept a
       * conservative subset of CollegeTier strings; anything else
       * passes through as null and falls back to the standard band. */
      const onboardingCollegeTier =
        body.collegeTier === "tier-1" || body.collegeTier === "tier-2" || body.collegeTier === "tier-3"
          ? body.collegeTier
          : null;
      const onboardingInternshipMonths =
        typeof body.internshipMonths === "number" && Number.isFinite(body.internshipMonths)
          ? body.internshipMonths
          : undefined;
      const resolvedBand = resolveServerBand(role, company, body.experienceLevel, applicableYoe, {
        collegeTier: onboardingCollegeTier,
        internshipMonths: onboardingInternshipMonths,
      });
      const companyTier = getCompanyTier(company);

      /* Wipro UI/UX session (May 2026) revealed the failure mode that
         family-wide sanity bounds cannot catch: the curator/sector-
         fallback band returned ₹27 LPA opener for Wipro UI/UX (IT-services
         tier, designer family P50 ≈ ₹8 LPA). Designer family bound is
         ₹3-45 LPA so ₹27 passes — but it's 3.4× the tier P50 and the
         candidate accepted on turn 2.

         clampBandToTierP50 rewrites the band at INIT (and only at init)
         when initialOffer > 2× tier P50. Mid-session clamping is still
         off-limits — that would mask curator bugs and break thread
         coherence. The original band is preserved in telemetry so
         curator review can fix the source data upstream. */
      const clampResult = clampBandToTierP50(resolvedBand, role, companyTier);
      const serverBand = clampResult.clamped
        ? { ...resolvedBand, ...clampResult.band }
        : resolvedBand;

      if (clampResult.clamped) {
        void captureServerEvent("kernel_band_clamped_tier_p50", distinctId, {
          role,
          company: company.slice(0, 80),
          tier: clampResult.tier ?? "unknown",
          family: clampResult.family ?? "unknown",
          p50: clampResult.p50,
          original_initial: clampResult.originalInitial,
          original_stretch: clampResult.originalStretch,
          clamped_initial: serverBand.initialOffer,
          clamped_stretch: serverBand.maxStretch,
          reason: clampResult.reason,
        }, req);
        console.warn(
          `[negotiate-turn] band clamped at init for role="${role}" company="${company}" ` +
          `tier=${clampResult.tier} family=${clampResult.family}: ` +
          `${clampResult.originalInitial}→${serverBand.initialOffer} LPA (P50=${clampResult.p50})`,
        );
      }

      /* Phase 4 of the rebuild: log a sanity warning when the resolved
         band sits outside the family's reasonable spread, OR (Phase 7)
         when it sits above the tier P50 — even if clamping didn't
         trigger. This catches mild misfits (1.5-2× P50) before they
         become severe enough to clamp. */
      const bandWarnings = checkBandSanity(serverBand, role, companyTier);
      if (bandWarnings.length > 0) {
        void captureServerEvent("kernel_band_sanity_warn", distinctId, {
          role,
          company: company.slice(0, 80),
          tier: companyTier ?? "unknown",
          family: bandFamilyForRole(role),
          kinds: bandWarnings.map(w => w.kind).join(","),
          initial: serverBand.initialOffer,
          stretch: serverBand.maxStretch,
          walk: serverBand.walkAway,
          was_clamped: clampResult.clamped,
        }, req);
        console.warn(`[negotiate-turn] band sanity warnings for role="${role}" company="${company}":`, bandWarnings);
      }
      let state = initState({
        sessionId: body.sessionId || crypto.randomUUID(),
        role,
        company,
        band: serverBand,
        maxTurns: body.maxTurns,
        candidateTotalYoe: totalYoe,
        candidateApplicableYoe: applicableYoe,
        candidatePrimaryDomain: primaryDomain,
      });
      const move = pickAiMove(state);
      const promptVariant = selectPromptVariant(state.sessionId);
      const { text, source, failureKinds, envelopeMissingAttempts } = await generateAiText(state, move, "", llm, auth.userId, promptVariant);
      state = applyAiMove(state, move, text);
      const terminal = isTerminalPhase(state.phase);
      if (failureKinds.length > 0) {
        void captureServerEvent("kernel_validate_fail", distinctId, {
          kinds: failureKinds.join(","),
          lever: move.lever,
          phase: state.phase,
          where: "init",
          recovered: source !== "fallback",
        }, req);
      }
      if (envelopeMissingAttempts > 0) {
        /* LLM provider quietly disabled jsonMode for at least one
           attempt. Phase 2 of the rebuild added structured JSON output
           specifically so we could cross-check role/lever/number — when
           the envelope is missing we lose that coverage and fall back
           to text-only validation. Tracking this in PostHog lets us spot
           a provider regression (e.g. Groq pushes a model that stops
           respecting jsonMode) before the validation-failure rate
           climbs as a downstream symptom. */
        void captureServerEvent("kernel_structured_envelope_missing", distinctId, {
          missing_attempts: envelopeMissingAttempts,
          lever: move.lever,
          phase: state.phase,
          where: "init",
        }, req);
      }
      void captureServerEvent("kernel_init", distinctId, {
        role,
        company: company.slice(0, 80),
        lever: move.lever,
        source,
        phase: state.phase,
        band_initial: serverBand.initialOffer,
        band_max: serverBand.maxStretch,
        band_walk: serverBand.walkAway,
      }, req);
      if (source === "fallback") {
        void captureServerEvent("kernel_fallback", distinctId, { lever: move.lever, phase: state.phase, where: "init" }, req);
      }
      return new Response(
        JSON.stringify({ ok: true, state: serializeState(state), text, move, source, terminal }),
        { status: 200, headers },
      );
    }

    if (body.action === "turn") {
      let state: NegotiationState;
      try {
        state = deserializeState(body.state);
      } catch {
        return new Response(JSON.stringify({ error: "Invalid state" }), { status: 400, headers });
      }

      /* Session-turn-cap enforcement (launch-blocker). Past the
         ceiling, return a 429-equivalent error and skip the LLM call. */
      const turnCapCheck = checkSessionTurnLimit(state.turnIndex);
      if (!turnCapCheck.allowed) {
        return new Response(
          JSON.stringify({ error: "session-turn-cap", reason: turnCapCheck.reason }),
          { status: 429, headers },
        );
      }
      /* Daily per-user cap. Backing store is in-memory with date-rollover
         (see _daily-cap-store). REDIS_URL hooks up a no-op stub today; a
         future revision can swap in a real Redis client without touching
         this call site. */
      const turnsToday = await getTurnsToday(auth.userId ?? null);
      const dailyCheck = checkUserDailyLimit(turnsToday);
      if (!dailyCheck.allowed) {
        return new Response(
          JSON.stringify({ error: "user-daily-cap", reason: dailyCheck.reason }),
          { status: 429, headers },
        );
      }

      /* Idempotency: same (state, candidateAnswer) within 60 s replays
         the cached response instead of re-applying the turn. Protects
         against client retries on flaky mobile networks where the
         response was generated but TLS dropped the body. */
      const clamped = clampInput(body.candidateAnswer || "");
      const safeAnswer = clamped.text.slice(0, MAX_CANDIDATE_ANSWER_CHARS);
      const turnStartedAt = Date.now();
      const idemKey = `nt:${await hashStable(`turn|${body.state}|${safeAnswer}`)}`;
      const cached = await redisGet(idemKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as Record<string, unknown>;
          void captureServerEvent("kernel_idempotency_hit", distinctId, {
            turn_index: state.turnIndex,
            phase: state.phase,
          }, req);
          return new Response(
            JSON.stringify({ ...parsed, _replayed: true }),
            { status: 200, headers },
          );
        } catch { /* malformed cache → fall through */ }
      }

      const prevPhase = state.phase;

      /* Phase 10B (2026-05-13): adversarial-input classifier.
       * Detect jailbreaks / profanity / off-topic BEFORE folding the
       * candidate's text into state. We always fold (turnIndex must
       * advance, otherwise a hostile caller could spin indefinitely),
       * but on jailbreak we short-circuit the LLM call entirely and
       * return a canned deflection — this both prevents prompt
       * disclosure and saves token cost. Telemetry is emitted for every
       * non-"none" classification so we can see attack rate in prod. */
      /* Prompt-injection check (2026-05-14) — runs alongside the
       * adversarial classifier. When the input is flagged we sanitize
       * (replace the matched span with [redacted]) and continue;
       * critically we do NOT short-circuit, because the candidate may
       * still be making a legitimate negotiation point around it. The
       * turn-usage log captures `injectionDetected:true` for telemetry. */
      const injection = detectPromptInjection(safeAnswer);
      let injectionDetected = injection.detected;
      let sanitizedAnswer = safeAnswer;
      if (injection.detected) {
        sanitizedAnswer = "[redacted]";
        void captureServerEvent("kernel_prompt_injection", distinctId, {
          reasons: injection.reasons.join(",") || null,
          turn_index: state.turnIndex,
          phase: state.phase,
        }, req);
      }
      /* Multi-turn injection: inspect the last 5 conversation entries
       * plus the current candidate utterance. We map conversationLog
       * speakers ('ai' / 'candidate') onto the detector's role tags. */
      const recentForMt = state.conversationLog.slice(-5).map((e) => ({
        role: (e.speaker === "candidate" ? "user" : "bot") as "user" | "bot",
        text: e.text,
      }));
      recentForMt.push({ role: "user", text: safeAnswer });
      const mt = detectMultiTurnInjection(recentForMt);
      if (mt.injected) {
        injectionDetected = true;
        void captureServerEvent("kernel_multi_turn_injection", distinctId, {
          reason: mt.reason ?? null,
          turn_index: state.turnIndex,
          phase: state.phase,
        }, req);
      }

      const adversarial = detectAdversarialInput(sanitizedAnswer, { turnIndex: state.turnIndex });
      if (adversarial.kind !== "none") {
        void captureServerEvent("kernel_adversarial_input", distinctId, {
          kind: adversarial.kind,
          reasons: adversarial.reasons.join(",") || null,
          short_circuited: adversarial.shouldShortCircuit,
          turn_index: state.turnIndex,
          phase: state.phase,
          role: state.role,
          company: (state.company || "").slice(0, 80),
        }, req);
      }

      state = applyCandidateAnswer(state, sanitizedAnswer);
      const move = pickAiMove(state);

      let text: string;
      let source: "llm" | "llm-retry" | "fallback" | "deflection";
      let failureKinds: string[];
      let envelopeMissingAttempts: number;
      if (adversarial.shouldShortCircuit) {
        /* Skip the LLM. The canned deflection is neutral and redirects
         * the candidate back to the negotiation topic. The picked move
         * still applies to state (so phase/lever progress stays
         * coherent), but the prose is replaced. */
        text = JAILBREAK_DEFLECTION_TEXT;
        source = "deflection";
        failureKinds = [];
        envelopeMissingAttempts = 0;
      } else {
        const promptVariantTurn = selectPromptVariant(state.sessionId);
        const gen = await generateAiText(state, move, sanitizedAnswer, llm, auth.userId, promptVariantTurn);
        text = gen.text;
        source = gen.source;
        failureKinds = gen.failureKinds;
        envelopeMissingAttempts = gen.envelopeMissingAttempts;
      }
      const promptVariant = selectPromptVariant(state.sessionId);
      /* LLM-output token-leak guard (2026-05-14). Scrub any internal
       * kernel tokens / system-prompt fragments before applying to
       * state and returning. Caught leaks fire telemetry so we can
       * trace which prompt regressed. */
      const leak = detectTokenLeak(text);
      if (leak.leaked) {
        text = redactLeakedTokens(text);
        void captureServerEvent("kernel_token_leak", distinctId, {
          tokens: leak.tokens.slice(0, 5).join(",") || null,
          token_count: leak.tokens.length,
          turn_index: state.turnIndex,
          phase: state.phase,
        }, req);
      }
      /* Bug 3 (2026-05-14) — PII/document-request post-processor. The
       * practice-session bot must never request Aadhaar / PAN / payslips
       * / BGV documents. Strip violating sentences and log. */
      const docReq = detectDocumentRequest(text);
      if (docReq.violated) {
        text = stripDocumentRequest(text);
        void captureServerEvent("kernel_pii_document_request", distinctId, {
          phrases: docReq.phrases.slice(0, 5).join(",") || null,
          turn_index: state.turnIndex,
          phase: state.phase,
        }, req);
      }
      /* Fix 2 (PDF #17 follow-up, 2026-05-15) — strip unprompted
       * sweeteners ("we can add equity", "we can offer a sign-on
       * bonus") when the candidate's last turn did not contain a
       * matching ask. Real recruiters never volunteer comp the
       * candidate did not ask for. */
      const sweetener = detectUnpromptedSweetener(text, sanitizedAnswer);
      if (sweetener.violated) {
        text = stripUnpromptedSweetener(text, sanitizedAnswer);
        void captureServerEvent("kernel_unprompted_sweetener", distinctId, {
          sweeteners: sweetener.sweeteners.slice(0, 5).join(",") || null,
          turn_index: state.turnIndex,
          phase: state.phase,
        }, req);
      }
      /* Bug 6 (2026-05-14) — strip honorifics ("sir" / "ma'am" / "Mr.")
       * from bot output. Indian HR addresses peers by first name. */
      const honor = stripHonorifics(text);
      if (honor.applied) {
        text = honor.text;
        void captureServerEvent("kernel_honorific_stripped", distinctId, {
          turn_index: state.turnIndex,
          phase: state.phase,
        }, req);
      }
      state = applyAiMove(state, move, text);
      const terminal = isTerminalPhase(state.phase);

      /* F2 (2026-05-15) — post-acceptance dispatch. When the kernel
       * transitions to terminal `accepted`, it has already populated
       * `state.postAcceptanceMessage` (PF UAN / Form 16 / BGV / relieving-
       * letter / joining-date checklist) via attachPostAcceptanceMessage.
       * We append that structured message to the LLM reply so the
       * candidate ACTUALLY receives it. The LLM is told not to improvise
       * onboarding language; this is the deterministic-truth scaffold.
       * Idempotent — appending the same message twice cannot happen
       * because the kernel only attaches it once. */
      if (state.phase === "accepted" && state.postAcceptanceMessage) {
        if (!text.includes(state.postAcceptanceMessage)) {
          text = (text.trim() ? text.trim() + "\n\n" : "") + state.postAcceptanceMessage;
        }
      }

      if (failureKinds.length > 0) {
        void captureServerEvent("kernel_validate_fail", distinctId, {
          kinds: failureKinds.join(","),
          lever: move.lever,
          phase: state.phase,
          where: "turn",
          recovered: source !== "fallback",
        }, req);
      }
      if (envelopeMissingAttempts > 0) {
        /* See init branch for rationale. */
        void captureServerEvent("kernel_structured_envelope_missing", distinctId, {
          missing_attempts: envelopeMissingAttempts,
          lever: move.lever,
          phase: state.phase,
          where: "turn",
        }, req);
      }

      void captureServerEvent("kernel_turn", distinctId, {
        lever: move.lever,
        phase: state.phase,
        prev_phase: prevPhase,
        turn_index: state.turnIndex,
        source,
        new_total_lpa: move.newTotalLpa,
        highest_offer: state.highestOfferMade,
        candidate_target: state.candidateTarget,
        /* Tactic + intent telemetry — lets us measure candidate
           negotiation skill in production before tuning boost weights.
           Arrays serialized as comma-joined strings for easy PostHog
           filtering (PostHog supports array props but joined strings
           are easier to chart). */
        candidate_target_as_range: state.candidateAskedAsRange,
        voss_tactics: state.vossTacticsUsed.join(",") || null,
        voss_tactics_count: state.vossTacticsUsed.length,
        info_asked: state.infoAsked.join(",") || null,
        info_asked_count: state.infoAsked.length,
        verbal_acceptance_turn: state.verbalAcceptanceTurn,
        walk_away_returned: state.walkAwayReturned,
        hard_band_cap: state.hardBandCap,
        market_mode: state.marketMode,
        final_offer_asserted_count: state.finalOfferAssertedCount,
      }, req);
      if (prevPhase !== state.phase) {
        void captureServerEvent("kernel_phase_transition", distinctId, { from: prevPhase, to: state.phase, lever: move.lever }, req);
      }
      if (source === "fallback") {
        void captureServerEvent("kernel_fallback", distinctId, { lever: move.lever, phase: state.phase, where: "turn" }, req);
      }
      if (terminal) {
        void captureServerEvent("kernel_terminal", distinctId, {
          phase: state.phase,
          lever: move.lever,
          turn_index: state.turnIndex,
          highest_offer: state.highestOfferMade,
          accepted: state.acceptedAtTurn != null,
          walked_away: state.walkedAwayAtTurn != null,
          /* Outcome attribution: which tactics did the candidate use
             and what did they ask about? Lets us measure whether
             calibrated questions + range asks correlate with higher
             accepted offers. */
          voss_tactics: state.vossTacticsUsed.join(",") || null,
          info_asked: state.infoAsked.join(",") || null,
          candidate_target_as_range: state.candidateAskedAsRange,
          walk_away_returned: state.walkAwayReturned,
          market_mode: state.marketMode,
          band_initial: state.band.initialOffer,
          band_max: state.band.maxStretch,
          /* Useful delta for funnels: how far over initial did we end? */
          offer_over_initial_lpa: state.highestOfferMade - state.band.initialOffer,
        }, req);
      }

      const responseBody = {
        ok: true,
        state: serializeState(state),
        text,
        move,
        source,
        terminal,
      };
      /* Best-effort idempotency write — never block the response. A
         missed cache write just means a retry will reprocess the turn
         (the prior behaviour), not lose data. */
      void redisSetEx(idemKey, IDEMPOTENCY_TTL_SEC, JSON.stringify(responseBody)).catch(() => {});
      /* Cost / abuse observability — structured stdout log captured by
         the platform pipeline. Fire-and-forget; logger swallows errors. */
      logTurnUsage({
        sessionId: state.sessionId,
        userId: auth.userId,
        inputChars: safeAnswer.length,
        inputText: sanitizedAnswer,
        outputText: text,
        latencyMs: Date.now() - turnStartedAt,
        injectionDetected,
        promptVariant,
      });
      /* Bump the per-user daily counter AFTER a successful turn. We
       * deliberately do this in fire-and-forget mode — a counter miss
       * means at most one extra free turn, never a hard block. */
      void incrementTurnsToday(auth.userId ?? null);
      return new Response(JSON.stringify(responseBody), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
}
