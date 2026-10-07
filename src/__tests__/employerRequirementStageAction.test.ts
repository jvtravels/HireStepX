import { describe, it, expect, vi, beforeEach } from "vitest";

/* Locks in the stage-transition guard in handleStageAction
 * (employer-requirement-detail.ts): `ai_matching` is system-owned (set only
 * by runMatching) and must never be reachable through the `set_stage`
 * action, whatever the posting's current stage is. The guard reads
 * STAGE_TRANSITIONS (_employer-requirements-helpers.ts) — the same table
 * the stage dropdown renders its options from (src/employer/_atoms.tsx) —
 * so these tests double as regression coverage for that shared contract. */

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const slogError = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...args: unknown[]) => withAuthAndRateLimit(...args),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: (...args: unknown[]) => slogError(...args) },
}));

const runMatching = vi.fn();
const logRequirementActivity = vi.fn();

vi.mock("../../server-handlers/employer-requirements", () => ({
  runMatching: (...args: unknown[]) => runMatching(...args),
  logRequirementActivity: (...args: unknown[]) => logRequirementActivity(...args),
}));

const { default: handler } = await import("../../server-handlers/employer-requirement-detail");

function stageReq(stage: string) {
  return new Request("https://x.test/api/employer-requirement-detail?id=req-1", {
    method: "PATCH",
    body: JSON.stringify({ action: "set_stage", stage }),
  });
}

function countResponse(evaluated: number) {
  return {
    ok: true,
    headers: { get: (name: string) => (name === "content-range" ? `0-0/${evaluated}` : null) },
    json: async () => [],
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
  logRequirementActivity.mockResolvedValue(undefined);
});

describe("set_stage — ai_matching is never a reachable manual destination", () => {
  it("rejects moving ready_for_review -> ai_matching with 409, no PATCH sent", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", stage: "ready_for_review" }] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(stageReq("ai_matching"));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/ready_for_review.*ai_matching/);
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the existing-row lookup — no PATCH
  });

  it("rejects moving interviewing -> ai_matching with 409", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", stage: "interviewing" }] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(stageReq("ai_matching"));

    expect(res.status).toBe(409);
  });

  it("rejects moving hired -> ai_matching with 409", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", stage: "hired" }] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(stageReq("ai_matching"));

    expect(res.status).toBe(409);
  });

  it("rejects any set_stage call while the posting is still in ai_matching", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", stage: "ai_matching" }] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(stageReq("ready_for_review"));

    expect(res.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("set_stage — legal human-stage moves still work", () => {
  it("allows ready_for_review -> interviewing once a candidate has been evaluated", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", stage: "ready_for_review" }] })
      .mockResolvedValueOnce(countResponse(3))
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", stage: "interviewing" }] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(stageReq("interviewing"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stage).toBe("interviewing");
  });

  it("allows un-hiring a mis-click back to interviewing", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", stage: "hired" }] })
      .mockResolvedValueOnce(countResponse(1))
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", stage: "interviewing" }] });
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(stageReq("interviewing"));

    expect(res.status).toBe(200);
  });

  it("still blocks a legal transition when no candidate has been evaluated yet", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: "req-1", stage: "ready_for_review" }] })
      .mockResolvedValueOnce(countResponse(0));
    global.fetch = fetchMock as unknown as typeof fetch;

    const res = await handler(stageReq("hired"));

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toMatch(/evaluated/);
  });
});
