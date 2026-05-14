/* Streaming variant of /api/negotiate-turn (2026-05-14).
 * ─────────────────────────────────────────────────────────────────────
 * The non-streaming endpoint waits for the full LLM response before
 * returning — for 200-300 ms responses on Groq llama-3.1-8b this is
 * fine, but for Gemini-fallback paths (1-2 s) the perceived latency
 * shows. This handler returns Server-Sent Events: one `data: {token}`
 * event per LLM chunk, then a final `data: {done:true, full, meta}`
 * event with the same response shape the non-streaming endpoint
 * returns.
 *
 * Token-leak trade-off: detectTokenLeak runs on the FULL accumulated
 * text post-stream. By the time we detect a leak the client has
 * already received the offending tokens. We emit a final
 * `data: {error: 'redacted'}` event and the client MUST discard the
 * accumulated text on receipt. The right long-term fix is a streaming
 * leak detector that gates each chunk; for now the trade-off (worse
 * worst-case for leaks, much better p50 latency) is acceptable because
 * the leak guard is a defence-in-depth layer — prompts are already
 * scrubbed upstream.
 *
 * The non-streaming endpoint (negotiate-turn.ts) is unchanged. This
 * handler is invoked on `?stream=1` query-param. */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, validateContentType } from "./_shared";
import {
  applyCandidateAnswer,
  applyAiMove,
  pickAiMove,
  deserializeState,
  serializeState,
  isTerminalPhase,
  type NegotiationState,
} from "./_negotiation-kernel";
import {
  buildAiPrompt,
  deterministicFallbackText,
} from "./_negotiate-turn-helpers";
import { enforceRoleLabel } from "./_role-label";
import { detectTokenLeak, redactLeakedTokens } from "./_adversarial-detector";
import { clampInput, checkSessionTurnLimit, logTurnUsage } from "./_session-limits";
import { selectPromptVariant, getSystemPrompt } from "./_prompt-variants";

declare const process: { env: Record<string, string | undefined> };

interface StreamTurnRequest {
  action: "turn";
  state: string;
  candidateAnswer: string;
}

/** SSE encoder — one helper to keep the wire format consistent. */
function sse(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export interface StreamChatOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /** Test seam — defaults to the real Groq endpoint. */
  fetchImpl?: typeof fetch;
  /** Test seam — when provided we use this token-yielding generator
   *  instead of hitting Groq. Lets tests run without a real network. */
  mockStream?: () => AsyncGenerator<string>;
}

/** Async-generator adapter over Groq's streaming chat completions.
 *
 *  Yields one decoded token at a time. Caller accumulates them and
 *  applies post-stream validation. Pure-ish — depends only on the
 *  injected `fetch`. */
export async function* streamGroqChat(
  opts: StreamChatOptions,
): AsyncGenerator<string> {
  if (opts.mockStream) {
    for await (const tok of opts.mockStream()) yield tok;
    return;
  }
  const fetchImpl = opts.fetchImpl ?? fetch;
  const apiKey = process?.env?.GROQ_API_KEY || "";
  if (!apiKey) throw new Error("Groq not configured");
  const res = await fetchImpl("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 320,
      stream: true,
    }),
  });
  if (!res.ok || !res.body) {
    throw new Error(`Groq stream error ${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    /* SSE frames are separated by double newlines. */
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const tok = parsed.choices?.[0]?.delta?.content;
          if (typeof tok === "string" && tok.length > 0) yield tok;
        } catch {
          /* skip malformed frame */
        }
      }
    }
  }
}

export interface StreamHandlerDeps {
  /** Test seam — injected stream generator. */
  streamChat?: (opts: StreamChatOptions) => AsyncGenerator<string>;
}

export default async function handler(
  req: Request,
  deps?: StreamHandlerDeps,
): Promise<Response> {
  {
    const early = validateContentType(req, withRequestId(corsHeaders(req)));
    if (early) return early;
  }
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "negotiate-turn-stream",
    ipLimit: 30,
    userLimit: 20,
    maxBytes: 32_000,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  let body: StreamTurnRequest;
  try {
    body = (await req.json()) as StreamTurnRequest;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers });
  }
  if (body.action !== "turn" || typeof body.state !== "string") {
    return new Response(JSON.stringify({ error: "Streaming endpoint requires action=turn" }), {
      status: 400,
      headers,
    });
  }

  let state: NegotiationState;
  try {
    state = deserializeState(body.state);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid state" }), { status: 400, headers });
  }
  const turnCap = checkSessionTurnLimit(state.turnIndex);
  if (!turnCap.allowed) {
    return new Response(
      JSON.stringify({ error: "session-turn-cap", reason: turnCap.reason }),
      { status: 429, headers },
    );
  }

  const safeAnswer = clampInput(body.candidateAnswer || "").text;
  state = applyCandidateAnswer(state, safeAnswer);
  const move = pickAiMove(state);
  const promptVariant = selectPromptVariant(state.sessionId);
  const built = buildAiPrompt({ state, move, candidateAnswer: safeAnswer });
  const system = getSystemPrompt(promptVariant, built.system);
  const user = built.user;
  const streamChat = deps?.streamChat ?? streamGroqChat;

  /* SSE response. Headers must include text/event-stream + disabled
   * buffering so platform proxies (Vercel edge / nginx) flush per-event
   * to the client. */
  const sseHeaders = {
    ...headers,
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  };

  const turnStartedAt = Date.now();
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      let accumulated = "";
      try {
        for await (const token of streamChat({ system, user })) {
          accumulated += token;
          controller.enqueue(enc.encode(sse({ token })));
        }
      } catch {
        /* Fall back to deterministic text — emit it as a single token
         * so the client gets at least one frame, then continue to the
         * done event. */
        const fb = enforceRoleLabel(deterministicFallbackText(state, move), state.role || "");
        accumulated = fb;
        controller.enqueue(enc.encode(sse({ token: fb })));
      }
      /* Post-stream leak check. See header comment for the trade-off. */
      const leak = detectTokenLeak(accumulated);
      if (leak.leaked) {
        accumulated = redactLeakedTokens(accumulated);
        controller.enqueue(
          enc.encode(sse({ error: "redacted", tokenCount: leak.tokens.length })),
        );
      }
      const newState = applyAiMove(state, move, accumulated);
      const terminal = isTerminalPhase(newState.phase);
      const meta = { lever: move.lever, source: "llm-stream", phase: newState.phase };
      controller.enqueue(
        enc.encode(
          sse({
            done: true,
            full: accumulated,
            state: serializeState(newState),
            move,
            terminal,
            meta,
          }),
        ),
      );
      logTurnUsage({
        sessionId: state.sessionId,
        userId: auth.userId,
        inputChars: safeAnswer.length,
        inputText: safeAnswer,
        outputText: accumulated,
        latencyMs: Date.now() - turnStartedAt,
        promptVariant,
      });
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: sseHeaders });
}
