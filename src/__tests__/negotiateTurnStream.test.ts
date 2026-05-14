import { describe, it, expect } from "vitest";
import {
  streamGroqChat,
  type StreamChatOptions,
} from "../../server-handlers/negotiate-turn-stream";

/* These tests exercise the streamGroqChat adapter via the test seam —
 * `mockStream` and `fetchImpl`. We never hit a real Groq endpoint. */

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const t of gen) out.push(t);
  return out;
}

describe("streamGroqChat (test seam)", () => {
  it("yields tokens from a mock async generator", async () => {
    const opts: StreamChatOptions = {
      system: "sys",
      user: "user",
      mockStream: async function* () {
        yield "Hello";
        yield " ";
        yield "world";
      },
    };
    const toks = await collect(streamGroqChat(opts));
    expect(toks).toEqual(["Hello", " ", "world"]);
  });

  it("parses Groq SSE chunks via the fetchImpl seam", async () => {
    /* Synthesize a Response body that mirrors Groq's SSE shape. */
    const chunks = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Hi" } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: " there" } }] })}\n\n`,
      `data: [DONE]\n\n`,
    ];
    const body = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        for (const c of chunks) controller.enqueue(enc.encode(c));
        controller.close();
      },
    });
    const fakeFetch = (async () =>
      new Response(body, { status: 200 })) as unknown as typeof fetch;
    /* GROQ_API_KEY needs to be set for the adapter to proceed past the
     * config check; stub it via the test env. */
    process.env.GROQ_API_KEY = "test-key";
    const toks = await collect(
      streamGroqChat({ system: "s", user: "u", fetchImpl: fakeFetch }),
    );
    expect(toks).toEqual(["Hi", " there"]);
  });

  it("throws when Groq is not configured (no API key)", async () => {
    const prev = process.env.GROQ_API_KEY;
    delete process.env.GROQ_API_KEY;
    try {
      await expect(collect(streamGroqChat({ system: "s", user: "u" }))).rejects.toThrow(
        /not configured/i,
      );
    } finally {
      if (prev != null) process.env.GROQ_API_KEY = prev;
    }
  });

  it("throws on non-OK HTTP status", async () => {
    const fakeFetch = (async () =>
      new Response("rate limited", { status: 429 })) as unknown as typeof fetch;
    process.env.GROQ_API_KEY = "test-key";
    await expect(
      collect(streamGroqChat({ system: "s", user: "u", fetchImpl: fakeFetch })),
    ).rejects.toThrow(/Groq stream error/);
  });

  it("skips malformed JSON frames without aborting the stream", async () => {
    const chunks = [
      `data: NOT_JSON\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "ok" } }] })}\n\n`,
      `data: [DONE]\n\n`,
    ];
    const body = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        for (const c of chunks) controller.enqueue(enc.encode(c));
        controller.close();
      },
    });
    const fakeFetch = (async () =>
      new Response(body, { status: 200 })) as unknown as typeof fetch;
    process.env.GROQ_API_KEY = "test-key";
    const toks = await collect(
      streamGroqChat({ system: "s", user: "u", fetchImpl: fakeFetch }),
    );
    expect(toks).toEqual(["ok"]);
  });

  it("yields nothing for an empty stream", async () => {
    const toks = await collect(
      streamGroqChat({
        system: "s",
        user: "u",
        mockStream: async function* () {
          /* empty */
        },
      }),
    );
    expect(toks).toEqual([]);
  });
});
