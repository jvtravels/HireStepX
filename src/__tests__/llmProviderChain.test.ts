import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* Tests for callLLM's provider failover chain: Groq → Gemini → Cerebras.
 *
 * The 62% live error rate (2026-07-16) was caused by all three providers
 * hitting free-tier limits simultaneously. These tests pin the routing
 * decisions so a code change can't silently break failover behavior.
 *
 * Uses vi.resetModules() + dynamic import so each test starts with a fresh
 * module that reads the env vars set in beforeEach. fetch is stubbed globally
 * to intercept all outbound calls (LLM APIs + any PostHog/Supabase logging).
 */

type CallLLM = typeof import("../../server-handlers/_llm").callLLM;
let callLLM: CallLLM;
let fetchSpy: ReturnType<typeof vi.fn>;

/* ── Response builders ─────────────────────────────────────────────── */

function groqOk(content: string) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
    }),
    { status: 200 },
  );
}

function groqErr(status: number, body: string) {
  return new Response(body, { status });
}

function geminiOk(content: string) {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: content }] } }],
      usageMetadata: { promptTokenCount: 80, candidatesTokenCount: 40, totalTokenCount: 120 },
    }),
    { status: 200 },
  );
}

function geminiErr(status: number, body: string) {
  return new Response(body, { status });
}

/* ── Setup ─────────────────────────────────────────────────────────── */

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();

  // Set env vars BEFORE importing so the module captures them at init time.
  process.env.GROQ_API_KEY = "test-groq-key";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  delete process.env.CEREBRAS_API_KEY;
  // No Supabase → USAGE_LOGGING_ENABLED = false → no Supabase fetch calls.
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const mod = await import("../../server-handlers/_llm");
  callLLM = mod.callLLM;

  // Route fetch by URL prefix. Unknown URLs (PostHog event capture) return 200
  // so logUsage's emitAiGeneration doesn't throw.
  fetchSpy = vi.fn().mockImplementation(async (url: string) => {
    if (String(url).includes("api.groq.com")) throw new Error("fetchSpy: no Groq stub for this call");
    if (String(url).includes("generativelanguage")) throw new Error("fetchSpy: no Gemini stub for this call");
    return new Response("{}", { status: 200 }); // PostHog, anything else
  });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete process.env.GROQ_API_KEY;
  delete process.env.GEMINI_API_KEY;
});

/* ── Happy path ─────────────────────────────────────────────────────── */

describe("happy path", () => {
  it("returns Groq result and does not fall over when Groq succeeds", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) return groqOk('{"score":85}');
      return new Response("{}", { status: 200 });
    });

    const result = await callLLM({ prompt: "Evaluate." });

    expect(result.model).toBe("llama-3.3-70b-versatile");
    expect(result.text).toBe('{"score":85}');
    expect(result.fallback).toBe(false);
    const groqCalls = fetchSpy.mock.calls.filter((args: unknown[]) => String(args[0]).includes("api.groq.com"));
    expect(groqCalls).toHaveLength(1);
  });

  it("uses llama-3.1-8b-instant when opts.fast is true", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) return groqOk("quick");
      return new Response("{}", { status: 200 });
    });

    await callLLM({ prompt: "Fast eval.", fast: true });

    const groqCall = fetchSpy.mock.calls.find((args: unknown[]) => String(args[0]).includes("api.groq.com"));
    const body = JSON.parse(groqCall?.[1]?.body as string);
    expect(body.model).toBe("llama-3.1-8b-instant");
  });
});

/* ── Quota exhaustion (permanent — fail over immediately, no retry) ── */

describe("quota exhaustion 429", () => {
  it("fails over to Gemini immediately — does NOT retry Groq on quota exhaustion", async () => {
    let groqCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) {
        groqCallCount++;
        return groqErr(429, 'Groq error 429: You exceeded your current quota, please check your plan and billing details.');
      }
      if (String(url).includes("generativelanguage")) return geminiOk('{"score":72}');
      return new Response("{}", { status: 200 });
    });

    const promise = callLLM({ prompt: "Evaluate." });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.model).toBe("gemini-2.5-flash");
    expect(groqCallCount).toBe(1); // quota exhaustion = no retry
  });

  it("fails over on RESOURCE_EXHAUSTED (Gemini quota format)", async () => {
    let groqCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) {
        groqCallCount++;
        return groqErr(429, "RESOURCE_EXHAUSTED: daily quota exceeded");
      }
      if (String(url).includes("generativelanguage")) return geminiOk("ok");
      return new Response("{}", { status: 200 });
    });

    const promise = callLLM({ prompt: "Evaluate." });
    await vi.runAllTimersAsync();
    await promise;

    expect(groqCallCount).toBe(1);
  });
});

/* ── Transient errors (retries once on same provider before failover) ─ */

describe("transient rate limiting", () => {
  it("retries Groq once on a per-second rate-limit 429, then succeeds", async () => {
    let groqCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) {
        groqCallCount++;
        if (groqCallCount === 1) return groqErr(429, "rate limit reached, retry in 1s");
        return groqOk('{"ok":true}');
      }
      return new Response("{}", { status: 200 });
    });

    const promise = callLLM({ prompt: "Test." });
    await vi.runAllTimersAsync(); // advance past 800ms retry delay
    const result = await promise;

    expect(result.model).toBe("llama-3.3-70b-versatile");
    expect(groqCallCount).toBe(2); // 1 fail + 1 retry on same provider
  });

  it("falls over to Gemini after Groq exhausts both attempts on transient errors", async () => {
    let groqCallCount = 0;
    let geminiCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) {
        groqCallCount++;
        return groqErr(429, "rate limit reached");
      }
      if (String(url).includes("generativelanguage")) {
        geminiCallCount++;
        return geminiOk('{"score":60}');
      }
      return new Response("{}", { status: 200 });
    });

    const promise = callLLM({ prompt: "Test." });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.model).toBe("gemini-2.5-flash");
    expect(groqCallCount).toBe(2); // 1 initial + 1 retry, then fail over
    expect(geminiCallCount).toBe(1);
  });

  it("retries on 503 overload errors", async () => {
    let groqCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) {
        groqCallCount++;
        if (groqCallCount === 1) return groqErr(503, "model overloaded, retry later");
        return groqOk("success after retry");
      }
      return new Response("{}", { status: 200 });
    });

    const promise = callLLM({ prompt: "Test." });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.model).toBe("llama-3.3-70b-versatile");
    expect(groqCallCount).toBe(2);
  });
});

/* ── All providers fail ─────────────────────────────────────────────── */

describe("all providers fail", () => {
  it("throws when Groq and Gemini both return 500", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) return groqErr(500, "Groq error 500: Internal Server Error");
      if (String(url).includes("generativelanguage")) return geminiErr(500, "Gemini error 500: Internal Server Error");
      return new Response("{}", { status: 200 });
    });

    // Attach .rejects BEFORE advancing timers so the rejection is handled
    // immediately when the retry fires — avoids an unhandled-rejection warning.
    const promise = callLLM({ prompt: "Test." });
    const assertion = expect(promise).rejects.toThrow(/error 500/i);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("throws immediately when no API keys are configured", async () => {
    vi.resetModules();
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const mod = await import("../../server-handlers/_llm");
    await expect(mod.callLLM({ prompt: "Test." })).rejects.toThrow(/No LLM configured/);
  });
});

/* ── jsonMode ───────────────────────────────────────────────────────── */

describe("jsonMode", () => {
  it("sets response_format: json_object on the Groq request body", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) return groqOk('{"x":1}');
      return new Response("{}", { status: 200 });
    });

    await callLLM({ prompt: "Return JSON.", jsonMode: true });

    const groqCall = fetchSpy.mock.calls.find((args: unknown[]) => String(args[0]).includes("api.groq.com"));
    const body = JSON.parse(groqCall?.[1]?.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("omits response_format when jsonMode is false", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) return groqOk("plain text response");
      return new Response("{}", { status: 200 });
    });

    await callLLM({ prompt: "Answer in prose.", jsonMode: false });

    const groqCall = fetchSpy.mock.calls.find((args: unknown[]) => String(args[0]).includes("api.groq.com"));
    const body = JSON.parse(groqCall?.[1]?.body as string);
    expect(body.response_format).toBeUndefined();
  });
});
