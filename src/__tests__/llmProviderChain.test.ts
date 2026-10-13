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
/* Provider order (e3e634b): non-fast → Gemini primary, Groq fallback.
 *                           fast    → Groq primary, Gemini fallback. */

describe("happy path", () => {
  it("returns Gemini result and does not fall over when Gemini succeeds", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("generativelanguage")) return geminiOk('{"score":85}');
      return new Response("{}", { status: 200 });
    });

    const result = await callLLM({ prompt: "Evaluate." });

    expect(result.model).toBe("gemini-3.5-flash-lite");
    expect(result.text).toBe('{"score":85}');
    expect(result.fallback).toBe(false);
    const geminiCalls = fetchSpy.mock.calls.filter((args: unknown[]) => String(args[0]).includes("generativelanguage"));
    expect(geminiCalls).toHaveLength(1);
  });

  it("uses GPT-OSS 20B when opts.fast is true (Groq primary for fast calls)", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) return groqOk("quick");
      return new Response("{}", { status: 200 });
    });

    await callLLM({ prompt: "Fast eval.", fast: true });

    const groqCall = fetchSpy.mock.calls.find((args: unknown[]) => String(args[0]).includes("api.groq.com"));
    const body = JSON.parse(groqCall?.[1]?.body as string);
    expect(body.model).toBe("openai/gpt-oss-20b");
  });
});

/* ── Quota exhaustion (permanent — fail over immediately, no retry) ── */

describe("quota exhaustion 429", () => {
  it("fails over to Groq immediately — does NOT retry Gemini on quota exhaustion", async () => {
    let geminiCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("generativelanguage")) {
        if (String(url).includes("gemini-3.5-flash-lite")) geminiCallCount++; // count the primary model only
        return geminiErr(429, "RESOURCE_EXHAUSTED: You exceeded your quota, check your plan and billing details.");
      }
      if (String(url).includes("api.groq.com")) return groqOk('{"score":72}');
      return new Response("{}", { status: 200 });
    });

    const promise = callLLM({ prompt: "Evaluate." });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.model).toBe("openai/gpt-oss-120b");
    expect(geminiCallCount).toBe(1); // quota exhaustion = no retry
  });

  it("fails over on RESOURCE_EXHAUSTED (Gemini quota format)", async () => {
    let geminiCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("generativelanguage")) {
        if (String(url).includes("gemini-3.5-flash-lite")) geminiCallCount++; // count the primary model only
        return geminiErr(429, "RESOURCE_EXHAUSTED: daily quota exceeded");
      }
      if (String(url).includes("api.groq.com")) return groqOk("ok");
      return new Response("{}", { status: 200 });
    });

    const promise = callLLM({ prompt: "Evaluate." });
    await vi.runAllTimersAsync();
    await promise;

    expect(geminiCallCount).toBe(1);
  });
});

/* ── Transient errors (retries once on same provider before failover) ─ */

describe("transient rate limiting", () => {
  it("retries Gemini once on a per-second rate-limit 429, then succeeds", async () => {
    let geminiCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("generativelanguage")) {
        geminiCallCount++;
        if (geminiCallCount === 1) return geminiErr(429, "rate limit reached, retry in 1s");
        return geminiOk('{"ok":true}');
      }
      return new Response("{}", { status: 200 });
    });

    const promise = callLLM({ prompt: "Test." });
    await vi.runAllTimersAsync(); // advance past 800ms retry delay
    const result = await promise;

    expect(result.model).toBe("gemini-3.5-flash-lite");
    expect(geminiCallCount).toBe(2); // 1 fail + 1 retry on same provider
  });

  it("falls over to Groq after Gemini exhausts both attempts on transient errors", async () => {
    let geminiCallCount = 0;
    let groqCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("generativelanguage")) {
        if (String(url).includes("gemini-3.5-flash-lite")) geminiCallCount++; // count the primary model only
        return geminiErr(429, "rate limit reached");
      }
      if (String(url).includes("api.groq.com")) {
        groqCallCount++;
        return groqOk('{"score":60}');
      }
      return new Response("{}", { status: 200 });
    });

    const promise = callLLM({ prompt: "Test." });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.model).toBe("openai/gpt-oss-120b");
    expect(geminiCallCount).toBe(2); // 1 initial + 1 retry, then fail over
    expect(groqCallCount).toBe(1);
  });

  it("retries on 503 overload errors", async () => {
    let geminiCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("generativelanguage")) {
        geminiCallCount++;
        if (geminiCallCount === 1) return geminiErr(503, "model overloaded, retry later");
        return geminiOk("success after retry");
      }
      return new Response("{}", { status: 200 });
    });

    const promise = callLLM({ prompt: "Test." });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.model).toBe("gemini-3.5-flash-lite");
    expect(geminiCallCount).toBe(2);
  });
});

/* ── All providers fail ─────────────────────────────────────────────── */

describe("all providers fail", () => {
  it("throws when Gemini and Groq both return 500", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("generativelanguage")) return geminiErr(500, "Gemini error 500: Internal Server Error");
      if (String(url).includes("api.groq.com")) return groqErr(500, "Groq error 500: Internal Server Error");
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
  it("sets response_format: json_object on the Groq request body (fast=true, Groq primary)", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) return groqOk('{"x":1}');
      return new Response("{}", { status: 200 });
    });

    await callLLM({ prompt: "Return JSON.", jsonMode: true, fast: true });

    const groqCall = fetchSpy.mock.calls.find((args: unknown[]) => String(args[0]).includes("api.groq.com"));
    const body = JSON.parse(groqCall?.[1]?.body as string);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("omits response_format when jsonMode is false (fast=true, Groq primary)", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) return groqOk("plain text response");
      return new Response("{}", { status: 200 });
    });

    await callLLM({ prompt: "Answer in prose.", jsonMode: false, fast: true });

    const groqCall = fetchSpy.mock.calls.find((args: unknown[]) => String(args[0]).includes("api.groq.com"));
    const body = JSON.parse(groqCall?.[1]?.body as string);
    expect(body.response_format).toBeUndefined();
  });
});

/* ── Gemini thinkingConfig ────────────────────────────────────────────
 *
 * Production 400 INVALID_ARGUMENT on every Gemini call (2026-10-04):
 * gemini-3.5-flash-lite is a Gemini 3-family model and rejects
 * `thinkingBudget` outright (thinking can't be disabled that way on
 * Gemini 3 — only on 2.x). `thinkingLevel: "minimal"` is the supported
 * equivalent, and it's mutually exclusive with `thinkingBudget` — never
 * send both. Pin the request body shape so this can't regress silently. */

describe("Gemini thinkingConfig", () => {
  it("sends thinkingLevel: minimal, never thinkingBudget, on the Gemini request body", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("generativelanguage")) return geminiOk('{"score":85}');
      return new Response("{}", { status: 200 });
    });

    await callLLM({ prompt: "Evaluate." });

    const geminiCall = fetchSpy.mock.calls.find((args: unknown[]) => String(args[0]).includes("generativelanguage"));
    const body = JSON.parse(geminiCall?.[1]?.body as string);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: "minimal" });
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBeUndefined();
  });
});

/* ── Groq TPM-cap-aware sizing (callGroq) ────────────────────────────
 *
 * Groq's free tier caps openai/gpt-oss-20b/120b at a flat 8,000
 * tokens/minute, counting (prompt + max_tokens) against it regardless
 * of actual output length. callGroq() sizes max_tokens off the actual
 * prompt size and skips the call outright (no network round trip) when
 * even its minimum usable completion floor doesn't fit under the cap.
 * These tests pin that behavior so it can't silently regress back to a
 * fixed max_tokens that 413s once a prompt grows large. */

function tokenPaddedPrompt(tokens: number): string {
  // No whitespace → countTokens' word-based upper bound collapses to a
  // small constant, so the char-based lower bound (ceil(len/4)) decides
  // the count alone — length = tokens * 4 yields exactly `tokens`.
  return "a".repeat(tokens * 4);
}

describe("Groq TPM-cap-aware sizing", () => {
  it("shrinks max_tokens to fit the remaining TPM budget on a large prompt", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) return groqOk("ok");
      return new Response("{}", { status: 200 });
    });

    // 6000-token prompt leaves 8000 - 400 - 600 (10% estimator margin) - 6000
    // = 1000 available, below the default 2000 maxTokens but above the floor.
    await callLLM({ prompt: tokenPaddedPrompt(6000), fast: true });

    const groqCall = fetchSpy.mock.calls.find((args: unknown[]) => String(args[0]).includes("api.groq.com"));
    const body = JSON.parse(groqCall?.[1]?.body as string);
    expect(body.max_tokens).toBe(1000);
  });

  it("passes requestedMaxTokens through unmodified when the prompt is small", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) return groqOk("ok");
      return new Response("{}", { status: 200 });
    });

    await callLLM({ prompt: "Short prompt.", fast: true });

    const groqCall = fetchSpy.mock.calls.find((args: unknown[]) => String(args[0]).includes("api.groq.com"));
    const body = JSON.parse(groqCall?.[1]?.body as string);
    expect(body.max_tokens).toBe(2000); // default requestedMaxTokens, untouched
  });

  it("skips Groq outright (no fetch) and fails over when the prompt alone leaves less than the default floor", async () => {
    let groqCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) { groqCallCount++; return groqOk("ok"); }
      if (String(url).includes("generativelanguage")) return geminiOk("fallback result");
      return new Response("{}", { status: 200 });
    });

    // 7500-token prompt leaves 8000 - 400 - 7500 = 100 available, below
    // the default 256-token floor — callGroq() must throw before any fetch.
    const promise = callLLM({ prompt: tokenPaddedPrompt(7500), fast: true });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(groqCallCount).toBe(0);
    expect(result.model).toBe("gemini-3.5-flash-lite");
    expect(result.text).toBe("fallback result");
  });

  it("skips Groq when a caller's custom groqMinCompletionTokens floor isn't met, even though the default floor would have allowed it", async () => {
    let groqCallCount = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("api.groq.com")) { groqCallCount++; return groqOk("ok"); }
      if (String(url).includes("generativelanguage")) return geminiOk("fallback result");
      return new Response("{}", { status: 200 });
    });

    // 7000-token prompt leaves 8000 - 400 - 7000 = 600 available — above
    // the default 256-token floor (so the previous test's prompt wouldn't
    // have skipped here) but below a caller-specified 1800-token floor,
    // mirroring evaluate-session's real requirement.
    const promise = callLLM({ prompt: tokenPaddedPrompt(7000), fast: true, groqMinCompletionTokens: 1800 });
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(groqCallCount).toBe(0);
    expect(result.model).toBe("gemini-3.5-flash-lite");
  });
});

/* ── totalBudgetMs — whole-chain wall-clock ceiling ──────────────────
 *
 * analyze-resume's real worst case (gemini → groq → cerebras, each with
 * a possible retry) could exceed both the client's fetch timeout and
 * Vercel's edge execution ceiling, killing the isolate before the
 * handler's own catch block could return a graceful timeout response.
 * These tests pin totalBudgetMs so that regression can't come back
 * silently. Omitting it must leave every other caller's behavior
 * unchanged (covered by every other test in this file, none of which
 * pass it). */

describe("totalBudgetMs", () => {
  it("throws immediately without calling any provider when the budget is already exhausted", async () => {
    const result = callLLM({ prompt: "Evaluate." }, 15000, { totalBudgetMs: 0 });
    await expect(result).rejects.toThrow(/budget exhausted/);
    expect(fetchSpy.mock.calls.filter((args: unknown[]) =>
      String(args[0]).includes("generativelanguage") || String(args[0]).includes("api.groq.com"),
    )).toHaveLength(0);
  });

  it("does not change the result when the budget comfortably covers the call", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("generativelanguage")) return geminiOk('{"score":85}');
      return new Response("{}", { status: 200 });
    });

    const result = await callLLM({ prompt: "Evaluate." }, 15000, { totalBudgetMs: 20000 });

    expect(result.model).toBe("gemini-3.5-flash-lite");
    expect(result.fallback).toBe(false);
  });

  it("skips the fallback provider once the first provider's timeout consumes the whole budget", async () => {
    // Gemini hangs until its own abort signal fires — never resolves on
    // its own, so the only way it settles is via the AbortController
    // callLLM wires up from the (budget-capped) provider timeout.
    fetchSpy.mockImplementation((url: string, init?: { signal?: AbortSignal }) => {
      if (String(url).includes("generativelanguage")) {
        return new Promise((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    const promise = callLLM({ prompt: "Evaluate." }, 15000, { totalBudgetMs: 3000 });
    const assertion = expect(promise).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;

    const groqCalls = fetchSpy.mock.calls.filter((args: unknown[]) => String(args[0]).includes("api.groq.com"));
    expect(groqCalls).toHaveLength(0); // budget was gone after Gemini's capped timeout fired
  });
});

/* ── Oversized prompt + single-provider timeout (generate-questions) ──
 *
 * generate-questions prompts run ~9k tokens, always above Groq's 8000 TPM
 * cap, so Groq can never serve them. The skip must not surface as an
 * "error" row, and a slow or overloaded primary Gemini must fail over to the
 * backup Gemini model instead of dropping the visitor to the static fallback. */

describe("oversized prompt with a single viable provider", () => {
  const hang = (init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" })));
    });

  it("does not report the Groq pre-flight skip as a provider failure", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("generativelanguage")) return geminiOk("ok");
      return new Response("{}", { status: 200 });
    });
    const promise = callLLM({ prompt: tokenPaddedPrompt(8400), fast: true }, 8000, { totalBudgetMs: 20000 });
    await vi.runAllTimersAsync();
    expect((await promise).model).toBe("gemini-3.5-flash-lite");
    expect(errSpy.mock.calls.some((c) => String(c[0]).includes("groq failed"))).toBe(false);
    errSpy.mockRestore();
  });

  it("fails over to the backup Gemini model when the primary hangs", async () => {
    const models: string[] = [];
    fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("generativelanguage")) {
        const model = String(url).match(/models\/([^:]+):/)?.[1] ?? "";
        models.push(model);
        return model === "gemini-3.5-flash-lite" ? hang(init) : geminiOk("backup answer");
      }
      return new Response("{}", { status: 200 });
    });
    const promise = callLLM({ prompt: tokenPaddedPrompt(8400) }, 7000, { totalBudgetMs: 20000 });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(models).toEqual(["gemini-3.5-flash-lite", "gemini-2.5-flash-lite"]);
    expect(result.text).toBe("backup answer");
  });

  it("fails over to the backup Gemini model on a 503 from the primary", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("gemini-3.5-flash-lite")) return new Response("overloaded", { status: 503 });
      if (String(url).includes("generativelanguage")) return geminiOk("backup answer");
      return new Response("{}", { status: 200 });
    });
    const promise = callLLM({ prompt: tokenPaddedPrompt(8400) }, 7000, { totalBudgetMs: 20000 });
    await vi.runAllTimersAsync();
    expect((await promise).text).toBe("backup answer");
  });

  it("hedges: starts the backup model after hedgeAfterMs and does not wait for a hung primary", async () => {
    const started: Record<string, number> = {};
    const t0 = Date.now();
    fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("gemini-3.5-flash-lite")) { started.primary = Date.now() - t0; return hang(init); }
      if (String(url).includes("gemini-2.5-flash-lite")) { started.backup = Date.now() - t0; return geminiOk("hedged answer"); }
      return new Response("{}", { status: 200 });
    });
    const promise = callLLM({ prompt: tokenPaddedPrompt(8400) }, 7000, { totalBudgetMs: 20000, hedgeAfterMs: 3500 });
    await vi.advanceTimersByTimeAsync(3500);
    const result = await promise;
    expect(result.text).toBe("hedged answer");
    expect(started.backup).toBeGreaterThanOrEqual(3500);
    expect(started.backup).toBeLessThan(7000);
    await vi.runAllTimersAsync();
  });

  it("hedge: a primary that answers before hedgeAfterMs never starts the backup", async () => {
    let backupCalls = 0;
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("gemini-2.5-flash-lite")) { backupCalls++; return geminiOk("backup"); }
      if (String(url).includes("generativelanguage")) return geminiOk("primary");
      return new Response("{}", { status: 200 });
    });
    const promise = callLLM({ prompt: tokenPaddedPrompt(8400) }, 7000, { totalBudgetMs: 20000, hedgeAfterMs: 3500 });
    await vi.runAllTimersAsync();
    expect((await promise).text).toBe("primary");
    expect(backupCalls).toBe(0);
  });

  it("hedge: a primary failure starts the backup immediately instead of waiting out the hedge delay", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("gemini-3.5-flash-lite")) return new Response("bad request", { status: 400 });
      if (String(url).includes("generativelanguage")) return geminiOk("backup");
      return new Response("{}", { status: 200 });
    });
    const promise = callLLM({ prompt: tokenPaddedPrompt(8400) }, 7000, { totalBudgetMs: 20000, hedgeAfterMs: 3500 });
    await vi.advanceTimersByTimeAsync(10);
    expect((await promise).text).toBe("backup");
  });

  it("hedge: falls through to Groq when both Gemini models fail", async () => {
    fetchSpy.mockImplementation(async (url: string) => {
      if (String(url).includes("generativelanguage")) return new Response("overloaded", { status: 400 });
      if (String(url).includes("api.groq.com")) return groqOk("groq answer");
      return new Response("{}", { status: 200 });
    });
    const promise = callLLM({ prompt: "Short prompt that fits Groq." }, 7000, { totalBudgetMs: 20000, hedgeAfterMs: 3500 });
    await vi.runAllTimersAsync();
    expect((await promise).text).toBe("groq answer");
  });

  it("disables thinking on the backup model with thinkingBudget, not thinkingLevel", async () => {
    let backupBody: { generationConfig: { thinkingConfig: Record<string, unknown> } } | undefined;
    fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes("gemini-3.5-flash-lite")) return new Response("overloaded", { status: 400 });
      if (String(url).includes("gemini-2.5-flash-lite")) { backupBody = JSON.parse(String(init?.body)); return geminiOk("ok"); }
      return new Response("{}", { status: 200 });
    });
    const promise = callLLM({ prompt: tokenPaddedPrompt(8400) }, 7000, { totalBudgetMs: 20000 });
    await vi.runAllTimersAsync();
    await promise;
    expect(backupBody?.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });
});
