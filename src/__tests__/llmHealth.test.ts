import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/* Shared provider health: counts live in Redis so every serverless instance
 * routes around a provider another instance already saw failing. _shared's
 * redisPipeline is replaced with an in-memory fake that understands the few
 * commands the health module issues. */

const store = new Map<string, string>();
let redisDown = false;

vi.mock("../../server-handlers/_shared", async (orig) => {
  const actual = await orig<typeof import("../../server-handlers/_shared")>();
  return {
    ...actual,
    redisPipeline: vi.fn(async (commands: Array<Array<string | number>>) => {
      if (redisDown) return null;
      return commands.map((c) => {
        const [op, k, ...rest] = c.map(String);
        if (op === "GET") return store.get(k) ?? null;
        if (op === "INCR") { const n = Number(store.get(k) ?? 0) + 1; store.set(k, String(n)); return n; }
        if (op === "SET") { store.set(k, rest[0]); return "OK"; }
        return 1;
      });
    }),
  };
});

type Health = typeof import("../../server-handlers/_llm-health");
let health: Health;

beforeEach(async () => {
  vi.resetModules();
  store.clear();
  redisDown = false;
  health = await import("../../server-handlers/_llm-health");
  health.resetHealthMemo();
});
afterEach(() => vi.restoreAllMocks());

describe("isDegraded", () => {
  it("needs both enough failures and a high failure rate", () => {
    expect(health.isDegraded(3, 0)).toBe(false);
    expect(health.isDegraded(4, 0)).toBe(true);
    expect(health.isDegraded(4, 10)).toBe(false);
    expect(health.isDegraded(6, 6)).toBe(true);
  });
});

describe("loadProviderHealth", () => {
  const now = 1_700_000_000_000;

  it("reports degraded once recent failures dominate, across instances", async () => {
    for (let i = 0; i < 4; i++) await health.recordProviderOutcome("gemini", false, now);
    health.resetHealthMemo(); // a different instance has no local memory
    const h = await health.loadProviderHealth(["gemini", "groq"], now);
    expect(h.get("gemini")?.degraded).toBe(true);
    expect(h.get("groq")?.degraded).toBe(false);
  });

  it("counts the previous minute so a boundary does not reset the evidence", async () => {
    for (let i = 0; i < 4; i++) await health.recordProviderOutcome("gemini", false, now - 60_000);
    const h = await health.loadProviderHealth(["gemini"], now);
    expect(h.get("gemini")?.degraded).toBe(true);
  });

  it("recovers once the failures age out of the window", async () => {
    for (let i = 0; i < 4; i++) await health.recordProviderOutcome("gemini", false, now);
    health.resetHealthMemo();
    const h = await health.loadProviderHealth(["gemini"], now + 3 * 60_000);
    expect(h.get("gemini")?.degraded).toBe(false);
  });

  it("is not degraded when successes outweigh failures", async () => {
    for (let i = 0; i < 4; i++) await health.recordProviderOutcome("gemini", false, now);
    for (let i = 0; i < 12; i++) await health.recordProviderOutcome("gemini", true, now);
    expect((await health.loadProviderHealth(["gemini"], now)).get("gemini")?.degraded).toBe(false);
  });

  it("shares a hard cooldown", async () => {
    await health.setSharedCooldown("groq", 300_000);
    health.resetHealthMemo();
    expect((await health.loadProviderHealth(["groq"], now)).get("groq")?.cooling).toBe(true);
  });

  it("fails open when Redis is unavailable", async () => {
    redisDown = true;
    const h = await health.loadProviderHealth(["gemini"], now);
    expect(h.get("gemini")).toEqual({ degraded: false, cooling: false });
  });

  it("memoizes briefly so a burst of calls costs one Redis read", async () => {
    const { redisPipeline } = await import("../../server-handlers/_shared");
    const spy = vi.mocked(redisPipeline);
    spy.mockClear();
    await health.loadProviderHealth(["gemini"], now);
    await health.loadProviderHealth(["gemini"], now + 5_000);
    expect(spy).toHaveBeenCalledTimes(1);
    await health.loadProviderHealth(["gemini"], now + 11_000);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("orderByHealth", () => {
  it("moves degraded providers to the back and keeps the rest in order", () => {
    const providers = [{ name: "gemini" }, { name: "gemini-2.5-flash-lite" }, { name: "groq" }];
    const h = new Map([["gemini", { degraded: true, cooling: false }]]);
    expect(health.orderByHealth(providers, h).map((p) => p.name)).toEqual(["gemini-2.5-flash-lite", "groq", "gemini"]);
  });

  it("leaves the order alone when everything is healthy", () => {
    const providers = [{ name: "a" }, { name: "b" }];
    expect(health.orderByHealth(providers, new Map())).toEqual(providers);
  });
});

describe("callLLM routing from shared health", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "g";
    process.env.GEMINI_API_KEY = "k";
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  const geminiOk = (t: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }], usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 } }), { status: 200 });

  it("skips a primary that other instances saw failing and answers from the backup first", async () => {
    const h = await import("../../server-handlers/_llm-health");
    for (let i = 0; i < 5; i++) await h.recordProviderOutcome("gemini", false);
    h.resetHealthMemo();
    const urls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { urls.push(String(url)); return String(url).includes("generativelanguage") ? geminiOk("ok") : new Response("{}", { status: 200 }); }));
    const { callLLM } = await import("../../server-handlers/_llm");
    const result = await callLLM({ prompt: "Evaluate." }, 7000);
    expect(result.model).toBe("gemini-2.5-flash-lite");
    expect(urls.filter((u) => u.includes("generativelanguage"))).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it("records a success so the provider stays healthy", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => geminiOk("ok")));
    const { callLLM } = await import("../../server-handlers/_llm");
    await callLLM({ prompt: "Evaluate." }, 7000);
    expect([...store.keys()].some((k) => k.startsWith("llmh:s:gemini:"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("shares a quota-exhausted cooldown so other instances skip the provider", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      String(url).includes("gemini-3.5-flash-lite") ? new Response("RESOURCE_EXHAUSTED: quota", { status: 429 }) : geminiOk("backup")));
    const { callLLM } = await import("../../server-handlers/_llm");
    await callLLM({ prompt: "Evaluate." }, 7000);
    expect(store.has("llmh:cool:gemini")).toBe(true);
    vi.unstubAllGlobals();
  });
});
