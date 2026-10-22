import { describe, it, expect, vi, beforeEach } from "vitest";

const shared = vi.hoisted(() => ({
  store: new Map<string, string>(),
  quotaCalls: 0,
}));
const llm = vi.hoisted(() => ({ calls: 0 }));

vi.mock("../../server-handlers/_shared", () => ({
  handleCorsPreflightOrMethod: () => null,
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  validateOrigin: () => true,
  checkBodySize: () => false,
  verifyAuth: async () => ({ authenticated: true, userId: "u1" }),
  unauthorizedResponse: () => new Response("no", { status: 401 }),
  isRateLimited: async () => false,
  getClientIp: () => "1.1.1.1",
  rateLimitResponse: () => new Response("rl", { status: 429 }),
  getSubscriptionTier: async () => "pro",
  checkLLMQuota: async () => { shared.quotaCalls++; return { allowed: true }; },
  redisGet: async (k: string) => shared.store.get(k) ?? null,
  redisSetEx: async (k: string, _t: number, v: string) => { shared.store.set(k, v); },
  hashStable: async (s: string) => s,
}));
vi.mock("../../server-handlers/_llm", () => ({
  callLLM: async () => { llm.calls++; return { text: '[{"type":"tip","text":"Do X"}]', model: "m" }; },
  extractJSON: (t: string) => JSON.parse(t),
}));

import handler from "../../server-handlers/generate-insights";

const req = (skills: unknown) =>
  new Request("http://x", { method: "POST", body: JSON.stringify({ role: "SWE", skills, sessionCount: 2 }) });

describe("generate-insights cache", () => {
  beforeEach(() => { shared.store.clear(); shared.quotaCalls = 0; llm.calls = 0; });

  it("serves an identical profile from cache without a second LLM call or quota hit", async () => {
    const skills = [{ name: "Communication", score: 70 }];
    const a = await handler(req(skills));
    const b = await handler(req(skills));
    expect((await a.json()).insights).toHaveLength(1);
    expect((await b.json())._cached).toBe(true);
    expect(llm.calls).toBe(1);
    expect(shared.quotaCalls).toBe(1);
  });

  it("regenerates when the skill scores change", async () => {
    await handler(req([{ name: "Communication", score: 70 }]));
    await handler(req([{ name: "Communication", score: 75 }]));
    expect(llm.calls).toBe(2);
  });
});
