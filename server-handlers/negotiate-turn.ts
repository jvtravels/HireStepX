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
  deterministicFallbackText,
} from "./_negotiate-turn-helpers";

declare const process: { env: Record<string, string | undefined> };

const ENABLED = process.env.NEGOTIATION_KERNEL_ENABLED === "1";

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
function resolveServerBand(role: string, company: string): NegotiationBand {
  if (!role) return DEFAULT_BAND;
  try {
    const b = generateNegotiationBand({ role, company: company || undefined });
    return {
      initialOffer: b.initialOffer,
      maxStretch: b.maxStretch,
      walkAway: b.walkAway,
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
  const result = await callLLM(
    { prompt: `${system}\n\n${user}`, temperature: 0.7, maxTokens: 220, fast: true },
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
): Promise<{ text: string; source: "llm" | "llm-retry" | "fallback" }> {
  const { system, user } = buildAiPrompt({ state, move, candidateAnswer });

  let text: string;
  try {
    text = await llm(system, user, { userId });
  } catch {
    return { text: deterministicFallbackText(state, move), source: "fallback" };
  }

  const v1 = validateAiText(text, state, move);
  if (v1.ok) return { text, source: "llm" };

  /* Retry with explicit failure feedback in the prompt. */
  const retryUser =
    user +
    `\n\nNOTE — your previous draft failed validation: ` +
    JSON.stringify(v1.failures) +
    `. Try again. Stick to the kernel brief exactly.`;
  let retryText: string;
  try {
    retryText = await llm(system, retryUser, { userId });
  } catch {
    return { text: deterministicFallbackText(state, move), source: "fallback" };
  }
  const v2 = validateAiText(retryText, state, move);
  if (v2.ok) return { text: retryText, source: "llm-retry" };

  return { text: deterministicFallbackText(state, move), source: "fallback" };
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
      const serverBand = resolveServerBand(role, company);
      let state = initState({
        sessionId: body.sessionId || crypto.randomUUID(),
        role,
        company,
        band: serverBand,
        maxTurns: body.maxTurns,
      });
      const move = pickAiMove(state);
      const { text, source } = await generateAiText(state, move, "", llm, auth.userId);
      state = applyAiMove(state, move, text);
      const terminal = isTerminalPhase(state.phase);
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
      state = applyCandidateAnswer(state, safeAnswer);
      const move = pickAiMove(state);
      const { text, source } = await generateAiText(state, move, safeAnswer, llm, auth.userId);
      state = applyAiMove(state, move, text);
      const terminal = isTerminalPhase(state.phase);

      void captureServerEvent("kernel_turn", distinctId, {
        lever: move.lever,
        phase: state.phase,
        prev_phase: prevPhase,
        turn_index: state.turnIndex,
        source,
        new_total_lpa: move.newTotalLpa,
        highest_offer: state.highestOfferMade,
        candidate_target: state.candidateTarget,
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
