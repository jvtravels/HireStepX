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

import { withAuthAndRateLimit, corsHeaders, withRequestId, validateContentType } from "./_shared";
import { callLLM } from "./_llm";
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

const DEFAULT_BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: false,
};

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
    if (body.action === "init") {
      let state = initState({
        sessionId: body.sessionId || crypto.randomUUID(),
        role: body.role || "swe",
        company: body.company || "",
        band: body.band ?? DEFAULT_BAND,
        maxTurns: body.maxTurns,
      });
      const move = pickAiMove(state);
      const { text, source } = await generateAiText(state, move, "", llm, auth.userId);
      state = applyAiMove(state, move, text);
      return new Response(
        JSON.stringify({ ok: true, state: serializeState(state), text, move, source }),
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

      state = applyCandidateAnswer(state, body.candidateAnswer || "");
      const move = pickAiMove(state);
      const { text, source } = await generateAiText(state, move, body.candidateAnswer || "", llm, auth.userId);
      state = applyAiMove(state, move, text);

      return new Response(
        JSON.stringify({
          ok: true,
          state: serializeState(state),
          text,
          move,
          source,
          terminal: isTerminalPhase(state.phase),
        }),
        { status: 200, headers },
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
}
