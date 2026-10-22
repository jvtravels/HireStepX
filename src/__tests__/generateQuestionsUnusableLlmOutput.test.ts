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
}));

vi.mock("../../server-handlers/_llm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_llm")>();
  return { ...actual, callLLM: (...args: unknown[]) => callLLM(...args) };
});

import handler from "../../server-handlers/generate-questions";

function makeReq() {
  return new Request("https://app.hirestepx.com/api/generate-questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "behavioral", focus: "general", role: "Backend Engineer", company: "Acme" }),
  });
}

describe("generate-questions: unusable LLM output", () => {
  beforeEach(() => {
    callLLM.mockReset();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("serves the static fallback (200) when the model returns JSON with no questions array", async () => {
    callLLM.mockResolvedValue({ text: JSON.stringify({ note: "no questions here" }), provider: "groq" });
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body._fallback).toBe("static");
    expect(body.questions.length).toBeGreaterThan(0);
  });

  it("serves the static fallback (200) when the model returns an empty questions array", async () => {
    callLLM.mockResolvedValue({ text: JSON.stringify({ questions: [] }), provider: "groq" });
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json())._fallback).toBe("static");
  });

  it("serves the static fallback (200) when the model returns unparseable text", async () => {
    callLLM.mockResolvedValue({ text: "Sorry, I can't help with that.", provider: "groq" });
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect((await res.json())._fallback).toBe("static");
  });
});
