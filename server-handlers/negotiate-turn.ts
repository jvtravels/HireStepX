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
  type AiMove,
} from "./_negotiation-kernel";
import { resolveServerBand } from "./_band-resolver";
import { validateRequestBody } from "./_request-validator";
import { enforceRoleLabel } from "./_role-label";
import { checkBandSanity, bandFamilyForRole, clampBandToTierP50 } from "./_band-sanity";
import { getCompanyTier } from "../data/company-tiers";
import type { CompanyTierBucket } from "../src/_negotiation-math";
import { selectRecruiterSectorPersona } from "./_indian-recruiter-personas";
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
import { detectAndSanitizeInjection } from "./_prompt-injection-defense";
import {
  clampInput,
  checkSessionTurnLimit,
  checkUserDailyLimit,
  logTurnUsage,
} from "./_session-limits";
import { getTurnsToday, incrementTurnsToday } from "./_daily-cap-store";
import { selectPromptVariant, type PromptVariant } from "./_prompt-variants";
import { inferCompanyMode } from "./_market-mode";
import { generateBotReply, type GenerateAiTextFn } from "./_response-pipeline";
import { deriveMoveTag, type MoveTag } from "./_move-tag";
import type { NextAction } from "./_next-action-planner";

declare const process: { env: Record<string, string | undefined> };

/* Post-rebuild (Phase 7, May 2026): kernel is the live path by default.
 * The flag flipped from opt-in to opt-OUT — set NEGOTIATION_KERNEL_ENABLED=0
 * to disable. This is the right semantic now that the v2 kernel has
 * surface parity with the old static script and addresses the five
 * documented failure modes (Lollypop + Wipro sessions). Disable-flag
 * exists only as an emergency stop if something regresses in prod. */
const ENABLED = process.env.NEGOTIATION_KERNEL_ENABLED !== "0";

/* 2026-05-16 — KERNEL-FIRST PIPELINE.
 *
 * Turn generation runs through the single kernel-first pipeline
 * (_response-pipeline.ts):
 *
 *   planNextAction → renderCanonicalProse → LLM restyles → validate
 *   restyle preserves semantics → ship restyle OR fall back to
 *   canonical verbatim.
 *
 * The LLM authors NOTHING from scratch. Bugs structurally impossible
 * under this design: turn-0 anchors, repeated probes, hallucinated
 * facts. The legacy LLM-first reroll loop (with its validator chain,
 * F2 substitution, and deterministic fallback) was removed on
 * 2026-05-16 — it had been dead code behind the
 * USE_KERNEL_FIRST_PIPELINE flag, which is now also gone. */

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

/* Request shapes used to live here as `InitRequest`/`TurnRequest`/
 * `RequestBody`. They were replaced by the validated shapes in
 * `_request-validator.ts` (2026-05-21 audit follow-up). The validator
 * owns the field documentation now — the handler reads pre-cleaned
 * values from validation.body. */

/* ─── LLM glue (injectable for tests) ─────────────────────────────── */

export interface LlmCaller {
  (
    system: string,
    user: string,
    opts: { userId?: string; jsonMode?: boolean },
  ): Promise<string>;
}

const defaultLlmCaller: LlmCaller = async (system, user, opts) => {
  /* jsonMode is now caller-opt-in (Fix 5, 2026-05-16). The kernel-first
   * restyle prompt produces plain prose ("OUTPUT: just the restyled
   * line, no preamble") — forcing Groq into structured mode wraps the
   * line in `{"text":"..."}` which the downstream restyle validator
   * cannot decode. Pass jsonMode: true only when the caller's prompt
   * explicitly asks for a JSON envelope. Default false. */
  const jsonMode = opts.jsonMode === true;
  const result = await callLLM(
    { prompt: `${system}\n\n${user}`, temperature: 0.7, maxTokens: 320, fast: true, jsonMode },
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
  /* AP3 / Dim-14 transparency layer (2026-05-17). Planner output
   * surfaced so the handler can derive a user-facing moveTag for the
   * turn response without re-running planNextAction. Untouched by
   * downstream post-processors (token-leak strip, sweetener strip,
   * etc.) — it describes the TACTIC, not the prose. */
  action: NextAction;
}> {
  /* 2026-05-16 — KERNEL-FIRST PIPELINE (single path). The legacy
   * LLM-first reroll loop + validator chain + F2 substitution was
   * deleted in the cleanup pass; this function is now a thin adapter
   * around generateBotReply so the handler / DI test surface stays
   * stable. promptVariant is accepted for caller compat but no
   * longer used inside (variant selection happens upstream for
   * telemetry only — the kernel brief is the same for all variants). */
  void promptVariant;
  const pipelineLlm: GenerateAiTextFn = async (sys, usr) => {
    return llm(sys, usr, { userId });
  };
  const result = await generateBotReply(state, pipelineLlm, candidateAnswer);
  /* Telemetry — decisionLog picker reflects the pipeline source. */
  if (!state.decisionLog) state.decisionLog = [];
  state.decisionLog.push({
    turn: state.turnIndex,
    picker: `kernel-first:${result.source}`,
    rationale: result.rejectReason ?? `kind=${result.action.kind}`,
    phase: state.phase,
  });
  const adaptedSource: "llm" | "llm-retry" | "fallback" =
    result.source === "restyle" || result.source === "answer-restyle"
      ? "llm"
      : "fallback";
  return {
    text: enforceRoleLabel(result.text, state.role || ""),
    source: adaptedSource,
    failureKinds: result.rejectReason ? [result.rejectReason] : [],
    envelopeMissingAttempts: 0,
    action: result.action,
  };
}

/* ─── (legacy reroll loop deleted 2026-05-16) ─────────────────────── */

/* Removed: ~280 LoC of LLM-first reroll loop, validator chain,
 * F2 kernel-prose substitution, and deterministic fallback path.
 * The kernel-first pipeline (planNextAction → renderCanonicalProse →
 * LLM restyle → validateRestyle) is now the sole generation path.
 *
 * Historical reference: commit 8d79554 (pre-cleanup) for the
 * removed validator-stack behaviour. */


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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }

  /* Audit follow-up (2026-05-21) — API boundary schema validation.
   * Untyped JSON payload is run through a Result-style validator
   * (_request-validator.ts) that asserts presence, type, length, and
   * shape on every documented field. Replaces 30+ lines of inline
   * `body.X || default` coercion. On invalid shape we return a 400
   * with a precise error message — corruption can no longer flow into
   * the kernel and surface deep in the parser. */
  const validation = validateRequestBody(rawBody);
  if (!validation.ok) {
    return new Response(JSON.stringify({ error: validation.error }), {
      status: validation.status,
      headers,
    });
  }
  const body = validation.body;

  const llm = deps?.llm ?? defaultLlmCaller;

  try {
    const distinctId = distinctIdFrom(req, auth.userId);

    if (body.action === "init") {
      /* Field coercion / validation now lives in _request-validator.ts —
       * the values below are pre-cleaned (defaults applied, enums
       * narrowed, numbers asserted finite). SECURITY: body.band is
       * still ignored here and recomputed server-side from (role,
       * company) so a tampered client can't push the band ceiling. */
      const role = body.role || "swe";
      const company = body.company;
      const applicableYoe = body.applicableYoe;
      const totalYoe = body.totalYoe;
      const primaryDomain = body.primaryDomain;
      const onboardingCollegeTier = body.collegeTier;
      const onboardingInternshipMonths = body.internshipMonths;
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
      /* ITEM 2 (2026-05-15) — auto-infer marketMode from role + company when
       * not explicitly set. Maps CompanyMode → MarketMode:
       *   GCC → neutral (global pricing, competitive but not hot)
       *   BFSI → soft (conservative hike norms, variable-heavy)
       *   STARTUP → hot (equity-upside framing, aggressive hike expectations)
       *   MNC → neutral (competitive but band-governed)
       *   IT_SERVICES → soft (service-pricing compression 2025-26)
       */
      const companyMode = inferCompanyMode(role, company);
      const inferredMarketMode = (
        companyMode === "STARTUP" ? "hot" :
        companyMode === "BFSI" || companyMode === "IT_SERVICES" ? "soft" :
        "neutral"
      ) as import("./_negotiation-kernel").MarketMode;

      /* Phase 3 of Salary-Negotiation plan (2026-05-18) — derive the
       * Indian recruiter SECTOR persona once at session start, from
       * (tierBucket, band shape). Mirrors the analyzer's `tierBucket`
       * helper so the kernel + analyzer agree on the persona. Kernel
       * is data-tier-agnostic; we compute here and pass via init. */
      const initTierBucket: CompanyTierBucket | null = (() => {
        const t = getCompanyTier(company);
        switch (t) {
          case "faang": case "big-tech": case "gcc":          return "listed_big_tech";
          case "indian-unicorn": case "saas-product":         return "mature_unicorn";
          case "edtech": case "startup-growth":               return "growth_startup";
          case "startup-early":                                return "early_startup";
          case "it-services":                                  return "it_services";
          case "bfsi-global": case "bfsi-domestic":           return "bfsi";
          case "fmcg-mnc":                                     return "fmcg";
          case "government-psu":                               return "psu";
          default:                                             return null;
        }
      })();
      const initRecruiterSectorPersona = selectRecruiterSectorPersona({
        tierBucket: initTierBucket,
        band: serverBand,
        company,
      });
      let state = initState({
        sessionId: body.sessionId || crypto.randomUUID(),
        role,
        company,
        band: serverBand,
        maxTurns: body.maxTurns,
        candidateTotalYoe: totalYoe,
        candidateApplicableYoe: applicableYoe,
        candidatePrimaryDomain: primaryDomain,
        marketMode: inferredMarketMode,
        resumeFactPack: body.resumeFactPack ?? null,
        parsedResume: body.parsedResume ?? null,
        recruiterSectorPersona: initRecruiterSectorPersona,
        tierBucketHint: initTierBucket,
      });
      const move = pickAiMove(state);
      const promptVariant = selectPromptVariant(state.sessionId);
      const { text, source, failureKinds, envelopeMissingAttempts, action: initAction } = await generateAiText(state, move, "", llm, auth.userId, promptVariant);
      const initMoveTag: MoveTag = deriveMoveTag(initAction, state);
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
        /* Phase 3 of Salary-Negotiation plan (2026-05-18) — the
         * sector persona kernel selected for this session. Logged
         * once at session start; never mutates. */
        salneg_persona: state.recruiterSectorPersona ?? "default",
      }, req);
      if (source === "fallback") {
        void captureServerEvent("kernel_fallback", distinctId, { lever: move.lever, phase: state.phase, where: "init" }, req);
      }
      /* Bug 2 fix (PDF#25, 2026-05-16) — typewriter animation.
       *
       * The client-side typewriter (LiveCaptions in InterviewComponents)
       * keys off step.aiTextDisplay ?? step.aiText. Previously this
       * handler returned only `text`; the client had to re-map it into
       * aiText/aiTextDisplay before passing to the step renderer. That
       * adapter was the field-shape seam where the animation could
       * race ahead (the typewriter saw a fresh cleanText, but the
       * downstream component was also reading the legacy `.text` field
       * for transcript bubble reveal — they fired in different ticks
       * and the visible question rendered all-at-once on some turns).
       *
       * Fix: emit aiText + aiTextDisplay alongside `text` so any
       * consumer reads from a single canonical pair. The legacy `text`
       * field is preserved for backward compatibility (telemetry, IDB
       * draft writers, idempotency cache readers). */
      return new Response(
        JSON.stringify({
          ok: true,
          state: serializeState(state),
          text,
          aiText: text,
          aiTextDisplay: text,
          move,
          source,
          terminal,
          moveTag: initMoveTag,
        }),
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
      let safeAnswer = clamped.text.slice(0, MAX_CANDIDATE_ANSWER_CHARS);

      /* Prompt-injection defense (2026-05-17). Span-redact known
       * steering patterns BEFORE anything downstream sees the
       * utterance — the restyle prompt treats candidate text as data,
       * but we still neutralise injection attempts at the source so the
       * LLM has zero opportunity to be steered. Silent — the AI does
       * not telegraph the defense; the candidate's residual content
       * continues to parse for target/current/stance signals. */
      const injectionDefense = detectAndSanitizeInjection(safeAnswer);
      if (injectionDefense.detected) {
        const originalLength = safeAnswer.length;
        safeAnswer = injectionDefense.sanitizedText;
        if (!Array.isArray(state.promptInjectionAttempts)) {
          state.promptInjectionAttempts = [];
        }
        state.promptInjectionAttempts.push({
          atTurn: state.turnIndex,
          patterns: injectionDefense.patterns,
          originalLength,
          sanitizedLength: injectionDefense.sanitizedText.length,
        });
        void captureServerEvent("kernel_prompt_injection_redacted", distinctId, {
          patterns: injectionDefense.patterns.join(",") || null,
          turn_index: state.turnIndex,
          phase: state.phase,
          original_length: originalLength,
          sanitized_length: injectionDefense.sanitizedText.length,
        }, req);
      }
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
      /* AP3 / Dim-14 transparency layer (2026-05-17) — derived from
       * the planner action. Defaults to a meta tag for the adversarial
       * deflection branch where prose is replaced wholesale. */
      let moveTag: MoveTag = {
        label: "Redirecting the conversation",
        family: "meta",
        hint: "When the conversation drifts off-topic, recruiters redirect to the negotiation — stay focused on terms.",
      };
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
        moveTag = deriveMoveTag(gen.action, state);
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
      /* PDF#34 Fix 4 (2026-05-18, Meesho/Prita BUG 3) — final-mile
       * same-response repeat guard. The response-pipeline has an 8-
       * content-word fingerprint guard for the restyle/answer paths,
       * but the adversarial-deflection short-circuit (JAILBREAK_-
       * DEFLECTION_TEXT) bypasses the pipeline entirely AND is a
       * fixed canned string — when the candidate sends two off-topic
       * inputs in a row the bot shipped the byte-identical sentence
       * twice, which made the session feel stuck and (downstream)
       * tripped the auto-terminate heuristic. The architectural fix
       * is a single boundary check on the FINAL shipped text against
       * state.lastAiText, after every post-processor has run. On
       * match we ship a deterministic loop-breaker stub instead.
       * This catches all generation paths uniformly: restyle,
       * canonical-fallback, deflection, deferral, anything. */
      {
        /* PDF#35 (2026-05-18) — strengthen the normalize: PDF#34 Fix 4's
         * byte-exact match missed the Meesho/Prita repeated-deflection
         * loop because the bot rotated the LEADING ACK WORD only
         * ("Got it.", "Okay.", "Right.", "Noted."). Strip an optional
         * leading ack so the comparison sees the body of the sentence,
         * not the rotation surface. Also collapses straight vs.
         * typographic quotes, which the prior pipeline already
         * pre-normalises but we belt-and-brace here. */
        const LEADING_ACK_RE =
          /^\s*(?:got it|okay|ok|right|sure|alright|noted|understood|fair enough|fine|i hear you)[\s,.\-—:;]+/i;
        const normalize = (s: string): string =>
          (s || "")
            .trim()
            .toLowerCase()
            .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
            .replace(LEADING_ACK_RE, "")
            .replace(/\s+/g, " ")
            .replace(/[.!?]+$/, "");
        const prior = normalize(state.lastAiText || "");
        const next = normalize(text);
        if (prior.length > 0 && next.length > 0 && prior === next) {
          text = "I realise I'm circling — let's reset. What would be most useful to cover next from your side?";
          void captureServerEvent("kernel_same_response_guard", distinctId, {
            turn_index: state.turnIndex,
            phase: state.phase,
            source,
          }, req);
        }
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

      /* Bug 2 fix (PDF#25, 2026-05-16) — single canonical field pair for
       * the typewriter consumer (see init-branch comment above). */
      const responseBody = {
        ok: true,
        state: serializeState(state),
        text,
        aiText: text,
        aiTextDisplay: text,
        move,
        source,
        terminal,
        moveTag,
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
