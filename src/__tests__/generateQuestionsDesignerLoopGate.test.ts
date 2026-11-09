import { describe, it, expect, vi, beforeEach } from "vitest";

const callLLM = vi.fn();

vi.mock("../../server-handlers/_shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_shared")>();
  return {
    ...actual,
    withAuthAndRateLimit: vi.fn(async () => ({
      headers: { "Content-Type": "application/json" },
      auth: { userId: "user-1" },
      quota: { tier: "free" },
    })),
    checkSessionLimit: vi.fn(async () => ({ allowed: true })),
    redisGet: vi.fn(async () => null),
    redisSetEx: vi.fn(async () => undefined),
  };
});

vi.mock("../../server-handlers/_posthog", () => ({
  captureServerEvent: vi.fn(async () => undefined),
  captureServerException: vi.fn(async () => undefined),
  distinctIdFrom: vi.fn(() => "distinct"),
  getServerFeatureFlag: vi.fn(async () => undefined),
}));

vi.mock("../../server-handlers/_llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_llm")>();
  return { ...actual, callLLM: (...args: unknown[]) => callLLM(...args) };
});

import handler from "../../server-handlers/generate-questions";

function makeReq(type: string, host: string) {
  return new Request("https://app.hirestepx.com/api/generate-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json", host },
    body: JSON.stringify({ type, focus: "general", role: "Product Designer", company: "Acme" }),
  });
}

/* DESIGNER_LOOP_MODE is `stagingOnly` (featureFlagRegistry.ts) while this
 * feature is mid-build — it must resolve off for every production host
 * regardless of rollout/override, so these two focuses must 503 off-staging
 * even though the LLM path would otherwise serve them fine. */
describe("generate-questions: Designer Loop staging gate", () => {
  beforeEach(() => {
    callLLM.mockReset();
    callLLM.mockResolvedValue({ text: JSON.stringify({ questions: [{ type: "question", aiText: "Q1" }] }), provider: "groq" });
  });

  it("503s portfolio-review on a production host", async () => {
    const res = await handler(makeReq("portfolio-review", "hirestepx.com"));
    expect(res.status).toBe(503);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it("503s design-exercise on a production host", async () => {
    const res = await handler(makeReq("design-exercise", "hirestepx.com"));
    expect(res.status).toBe(503);
    expect(callLLM).not.toHaveBeenCalled();
  });

  it("serves portfolio-review on the staging host once the flag is forced on (stagingOnly only lifts the production hard-block, not the rollout)", async () => {
    process.env.FF_DESIGNER_LOOP_MODE = "on";
    try {
      const res = await handler(makeReq("portfolio-review", "staging.hirestepx.com"));
      expect(res.status).toBe(200);
    } finally {
      delete process.env.FF_DESIGNER_LOOP_MODE;
    }
  });

  it("still 503s on staging when the flag isn't separately enabled (outside its rollout)", async () => {
    const res = await handler(makeReq("portfolio-review", "staging.hirestepx.com"));
    expect(res.status).toBe(503);
  });

  it("does not gate an unrelated type (behavioral) on a production host", async () => {
    const res = await handler(makeReq("behavioral", "hirestepx.com"));
    expect(res.status).toBe(200);
  });
});
