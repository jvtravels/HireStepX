import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const redisGet = vi.fn();
const redisSetEx = vi.fn();
const redisIncr = vi.fn();
const callLLM = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...a: unknown[]) => withAuthAndRateLimit(...a),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  redisGet: (...a: unknown[]) => redisGet(...a),
  redisSetEx: (...a: unknown[]) => redisSetEx(...a),
  redisIncrByWithExpiry: (...a: unknown[]) => redisIncr(...a),
  hashStable: async (s: string) => `h${s.length}`,
  slog: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("../../server-handlers/_llm-pii", () => ({
  callLLM: (...a: unknown[]) => callLLM(...a),
  extractJSON: (t: string) => JSON.parse(t),
}));
vi.mock("../../server-handlers/_posthog", () => ({
  captureServerEvent: vi.fn(),
  captureServerException: vi.fn(),
  distinctIdFrom: () => "d1",
}));

const { default: handler } = await import("../../server-handlers/employer-parse-jd");
const { JD_BACKEND_BLR } = await import("./fixtures/jdSamples");

function req(text: unknown) {
  return new Request("https://x.test/api/employer-parse-jd", { method: "POST", body: JSON.stringify({ text }) });
}

function employerFound(found = true, suspended: string | null = null) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => (found ? [{ id: "emp-1", suspended_at: suspended }] : []),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
  redisGet.mockResolvedValue(null);
  redisIncr.mockResolvedValue(1);
  employerFound();
});

describe("employer-parse-jd handler", () => {
  it("rejects unauthenticated callers", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    expect((await handler(req(JD_BACKEND_BLR))).status).toBe(401);
  });

  it("rejects text that is too short", async () => {
    expect((await handler(req("hi"))).status).toBe(400);
  });

  it("rejects a non-string body", async () => {
    expect((await handler(req(42))).status).toBe(400);
  });

  it("returns 403 for a caller without an employer profile", async () => {
    employerFound(false);
    expect((await handler(req(JD_BACKEND_BLR))).status).toBe(403);
  });

  it("returns 403 for a suspended employer", async () => {
    employerFound(true, "2026-10-01T00:00:00Z");
    expect((await handler(req(JD_BACKEND_BLR))).status).toBe(403);
  });

  it("serves a repeat JD from cache without spending the allowance or calling the model", async () => {
    redisGet.mockResolvedValue(JSON.stringify({ fields: { title: { value: "X", confidence: "high", evidence: "", source: "llm" } }, warnings: [] }));
    const res = await handler(req(JD_BACKEND_BLR));
    const body = await res.json();
    expect(body.cached).toBe(true);
    expect(callLLM).not.toHaveBeenCalled();
    expect(redisIncr).not.toHaveBeenCalled();
  });

  it("returns 429 and refunds when the employer is over the daily cap", async () => {
    redisIncr.mockResolvedValueOnce(11);
    const res = await handler(req(JD_BACKEND_BLR));
    const body = await res.json();
    expect(res.status).toBe(429);
    expect(body.limitReached).toBe(true);
    expect(redisIncr).toHaveBeenCalledWith(expect.stringContaining("jdparse:emp:emp-1"), -1, expect.any(Number));
    expect(callLLM).not.toHaveBeenCalled();
  });

  it("merges model and pattern fields, grounds the model's output, and caches the result", async () => {
    callLLM.mockResolvedValue({
      text: JSON.stringify({
        title: { v: "Senior Backend Engineer", q: "Senior Backend Engineer" },
        salary: { v: { min: 90, max: 99, unit: "lakhs_per_year" }, q: "CTC: 90 - 99 LPA" },
        skills: { v: ["Java", "Kafka"] },
      }),
    });
    const res = await handler(req(JD_BACKEND_BLR));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.llm).toBe(true);
    expect(body.fields.title.value).toBe("Senior Backend Engineer");
    expect(body.fields.salary.value).toEqual({ type: "per-annum", min: 25, max: 35 });
    expect(body.fields.description.source).toBe("derived");
    expect(body.warnings.join(" ")).toMatch(/salary/i);
    expect(callLLM).toHaveBeenCalledWith(
      expect.anything(), expect.any(Number), expect.objectContaining({ excludeGemini: true, endpoint: "employer-parse-jd" }),
    );
    expect(redisSetEx).toHaveBeenCalledTimes(1);
  });

  it("falls back to pattern-only results and refunds the employer when the model fails", async () => {
    callLLM.mockRejectedValue(new Error("all providers down"));
    const res = await handler(req(JD_BACKEND_BLR));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.llm).toBe(false);
    expect(body.fields.experience.value).toEqual({ min: 4, max: 7 });
    expect(body.warnings.join(" ")).toMatch(/unavailable/i);
    expect(redisSetEx).not.toHaveBeenCalled();
    expect(redisIncr).toHaveBeenCalledWith(expect.stringContaining("jdparse:emp:emp-1"), -1, expect.any(Number));
  });

  it("skips the model past the global daily budget but still returns pattern fields", async () => {
    redisIncr.mockResolvedValueOnce(1).mockResolvedValueOnce(9999);
    const res = await handler(req(JD_BACKEND_BLR));
    const body = await res.json();
    expect(body.llm).toBe(false);
    expect(callLLM).not.toHaveBeenCalled();
    expect(body.fields.salary.value.min).toBe(25);
  });
});
