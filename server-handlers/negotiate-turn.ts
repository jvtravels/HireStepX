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
import { generateNegotiationBand } from "../data/salary-lookup";
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
import { experienceLevelFromYoe } from "./_candidate-profile";
import { getCompanyTier } from "../data/company-tiers";
import { detectAdversarialInput, JAILBREAK_DEFLECTION_TEXT } from "./_adversarial-detector";

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

const DEFAULT_BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: false,
};

/** Recompute the negotiation band server-side from (role, company).
 *  The client MAY supply a band hint, but it is never trusted —
 *  otherwise a tampered request could push the AI above maxStretch or
 *  below walkAway. We fall back to DEFAULT_BAND only when the
 *  data/salary-lookup pipeline can't resolve a band (no role / unknown
 *  company / lookup throws). Pure given inputs. */
/** Senior-inference fallback. When the client doesn't pass an explicit
 *  experienceLevel (legacy session, missing onboarding field), infer it
 *  from role-title prefixes so seniority still propagates into the band.
 *  Mirrors data/salary-lookup.ts:applyTitleExpFloor — that helper is
 *  private to salary-lookup so we duplicate the regex shape here at the
 *  resolveServerBand boundary. Returns undefined when no signal — caller
 *  passes-through to generateNegotiationBand which has its own
 *  applyTitleExpFloor pass over (params.role) downstream. */
function inferExperienceFromRole(role: string): string | undefined {
  if (!role) return undefined;
  const r = role.toLowerCase();
  if (/\b(vp|vice president|director|head of|chief|cxo|c[deot]o|c-?suite|partner)\b/.test(r)) return "executive";
  if (/\b(lead|principal|staff|architect)\b/.test(r)) return "lead";
  if (/\b(senior|sr\.?|sr )/.test(r)) return "senior";
  return undefined;
}

function resolveServerBand(
  role: string,
  company: string,
  experienceLevel?: string,
  applicableYoe?: number | null,
): NegotiationBand {
  if (!role) return DEFAULT_BAND;
  try {
    /* Phase 29 — when applicableYoe is known, derive the level from it
     * instead of trusting the onboarding-time experienceLevel. The
     * domain-pivot scenario (Senior PD → Java) explicitly requires this:
     * onboarding said "senior" but applicableYoe=0, so band must be
     * "entry". applicableYoe wins, then onboarding experienceLevel,
     * then title-regex inference. */
    const expFromYoe = experienceLevelFromYoe(applicableYoe ?? null);
    const expForBand = expFromYoe || experienceLevel || inferExperienceFromRole(role);
    const b = generateNegotiationBand({ role, company: company || undefined, experienceLevel: expForBand });
    /* SEMANTIC NORMALISATION: salary-lookup.ts stores `walkAway` as the
       RECRUITER's upper ceiling (= 1.1 × maxStretch — i.e. an ask above
       this and the recruiter walks). The kernel's `band.walkAway` means
       the CANDIDATE's floor (an offer below which the candidate walks).
       These are opposite ends of the band. Map salary-lookup's `minOffer`
       (= 0.95 × totalMin) to the kernel's walkAway so downstream
       validation (findOutOfBandNumber) lines up. Without this, every
       legitimate offer was being flagged out-of-band, the LLM retried
       endlessly, and we shipped the deterministic fallback unfiltered. */
    const kernelWalkAway = typeof b.minOffer === "number" && b.minOffer > 0 ? b.minOffer : Math.max(1, b.initialOffer * 0.75);
    return {
      initialOffer: b.initialOffer,
      maxStretch: b.maxStretch,
      walkAway: kernelWalkAway,
      hasEquity: Boolean(b.hasEquity),
    };
  } catch {
    return DEFAULT_BAND;
  }
}

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
  const { system, user } = buildAiPrompt({ state, move, candidateAnswer });
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
    return { text: deterministicFallbackText(state, move), source: "fallback", failureKinds: [a1.error], envelopeMissingAttempts };
  }
  if (!a1.envelopeOk) envelopeMissingAttempts++;
  if (a1.failures.length === 0) return { text: enforceRoleLabel(a1.text, state.role || ""), source: "llm", failureKinds, envelopeMissingAttempts };
  failureKinds.push(...a1.failures);

  /* Retry with explicit failure feedback in the prompt. */
  const retryUser =
    user +
    `\n\nNOTE — your previous draft failed validation (kinds: ${a1.failures.join(", ")}). ` +
    `Try again. Stick to the kernel brief exactly and ensure the JSON envelope fields agree with the prose.`;
  const a2 = await attempt(retryUser);
  if ("error" in a2) {
    return { text: deterministicFallbackText(state, move), source: "fallback", failureKinds: [...failureKinds, a2.error], envelopeMissingAttempts };
  }
  if (!a2.envelopeOk) envelopeMissingAttempts++;
  if (a2.failures.length === 0) return { text: enforceRoleLabel(a2.text, state.role || ""), source: "llm-retry", failureKinds, envelopeMissingAttempts };
  failureKinds.push(...a2.failures);

  return { text: deterministicFallbackText(state, move), source: "fallback", failureKinds, envelopeMissingAttempts };
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
      const resolvedBand = resolveServerBand(role, company, body.experienceLevel, applicableYoe);
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
      const { text, source, failureKinds, envelopeMissingAttempts } = await generateAiText(state, move, "", llm, auth.userId);
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

      /* Idempotency: same (state, candidateAnswer) within 60 s replays
         the cached response instead of re-applying the turn. Protects
         against client retries on flaky mobile networks where the
         response was generated but TLS dropped the body. */
      const safeAnswer = (body.candidateAnswer || "").slice(0, MAX_CANDIDATE_ANSWER_CHARS);
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
      const adversarial = detectAdversarialInput(safeAnswer, { turnIndex: state.turnIndex });
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

      state = applyCandidateAnswer(state, safeAnswer);
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
        const gen = await generateAiText(state, move, safeAnswer, llm, auth.userId);
        text = gen.text;
        source = gen.source;
        failureKinds = gen.failureKinds;
        envelopeMissingAttempts = gen.envelopeMissingAttempts;
      }
      state = applyAiMove(state, move, text);
      const terminal = isTerminalPhase(state.phase);

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
      return new Response(JSON.stringify(responseBody), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
}
