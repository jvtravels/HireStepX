import { describe, it, expect, vi, beforeEach } from "vitest";

/* Status/stage guards and the archive undo in employer-requirement-detail.ts:
 * reopen and stage PATCHes carry their own precondition (409 on no row),
 * "archive and reject remaining" reports exactly what it rejected, and
 * `restore` puts those rows back without touching anything changed since. */

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...a: unknown[]) => withAuthAndRateLimit(...a),
  corsHeaders: () => ({}),
  withRequestId: (h: Record<string, string>) => h,
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
const runMatching = vi.fn();
vi.mock("../../server-handlers/employer-requirements", () => ({
  runMatching: (...a: unknown[]) => runMatching(...a),
  logRequirementActivity: vi.fn(async () => undefined),
}));

vi.mock("../../server-handlers/_employer-matching-helpers", async (orig) => ({
  ...(await orig<typeof import("../../server-handlers/_employer-matching-helpers")>()),
  checkEmployerAllowance: vi.fn(async () => ({ ok: true })),
}));

const { default: handler } = await import("../../server-handlers/employer-requirement-detail");

const M1 = "11111111-1111-4111-8111-111111111111";
const M2 = "22222222-2222-4222-8222-222222222222";
const M3 = "33333333-3333-4333-8333-333333333333";

const patchReq = (body: Record<string, unknown>) =>
  new Request("https://x.test/api/employer-requirement-detail?id=req-1", { method: "PATCH", body: JSON.stringify(body) });

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body, text: async () => "", headers: { get: () => null } });

interface Sim {
  status?: string;
  stage?: string;
  /** Rows the guarded requirement PATCH returns; [] simulates a lost race. */
  requirementPatchRows?: unknown[];
  activeMatches?: Array<{ id: string; candidate_status: string | null }>;
  restoreReturns?: (url: string) => unknown[];
}

function install(sim: Sim) {
  const calls: Array<{ url: string; method: string; body: Record<string, unknown> | null }> = [];
  global.fetch = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method || "GET";
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
    calls.push({ url, method, body });
    if (url.includes("/rest/v1/employer_requirements?")) {
      if (method === "PATCH") return json(sim.requirementPatchRows ?? [{ id: "req-1", status: "closed", stage: "interviewing" }]);
      return json([{
        id: "req-1", status: sim.status ?? "ready", stage: sim.stage ?? "ready_for_review", title: "Dev", location: "Pune", description: "d".repeat(80),
        skills: [], custom_skill_sets: [], employers: { suspended_at: null, verification_tier: "verified", website: null },
      }]);
    }
    if (url.includes("/rest/v1/requirement_matches?")) {
      if (method === "PATCH") return json(sim.restoreReturns ? sim.restoreReturns(url) : (sim.activeMatches ?? []).map((m) => ({ id: m.id })));
      if (url.includes("select=id,candidate_status")) return json(sim.activeMatches ?? []);
      return json([], true);
    }
    return json([]);
  }) as unknown as typeof fetch;
  return calls;
}

beforeEach(() => {
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
  runMatching.mockReset();
  runMatching.mockResolvedValue("ready");
});

describe("set_stage guard", () => {
  it("guards the PATCH on the validated stage and a non-closed status", async () => {
    const calls = install({ stage: "ready_for_review", requirementPatchRows: [{ id: "req-1", stage: "interviewing" }] });
    // evaluated-count read returns a content-range through the headers mock
    const base = global.fetch as unknown as (u: string, i?: RequestInit) => Promise<unknown>;
    global.fetch = vi.fn(async (u: string, i?: RequestInit) => {
      const r = (await base(u, i)) as { headers: { get: (n: string) => string | null } };
      if (String(u).includes("select=id") && String(u).includes("requirement_matches")) r.headers = { get: (n) => (n === "content-range" ? "0-0/3" : null) };
      return r;
    }) as unknown as typeof fetch;
    const res = await handler(patchReq({ action: "set_stage", stage: "interviewing" }));
    expect(res.status).toBe(200);
    const patch = calls.find((c) => c.method === "PATCH" && c.url.includes("employer_requirements"))!;
    expect(patch.url).toContain("stage=eq.ready_for_review");
    expect(patch.url).toContain("status=neq.closed");
    expect(patch.url).toContain("employer_id=eq.emp-1");
  });

  it("answers 409 when the guarded PATCH matched no row (archived or advanced meanwhile)", async () => {
    install({ stage: "ready_for_review", requirementPatchRows: [] });
    const base = global.fetch as unknown as (u: string, i?: RequestInit) => Promise<unknown>;
    global.fetch = vi.fn(async (u: string, i?: RequestInit) => {
      const r = (await base(u, i)) as { headers: { get: (n: string) => string | null } };
      if (String(u).includes("select=id") && String(u).includes("requirement_matches")) r.headers = { get: (n) => (n === "content-range" ? "0-0/3" : null) };
      return r;
    }) as unknown as typeof fetch;
    const res = await handler(patchReq({ action: "set_stage", stage: "interviewing" }));
    expect(res.status).toBe(409);
  });
});

describe("reopen guard", () => {
  it("only flips a row that is still closed, and 409s when the PATCH matched nothing", async () => {
    const calls = install({ status: "closed", requirementPatchRows: [] });
    const res = await handler(patchReq({ action: "reopen" }));
    expect(res.status).toBe(409);
    const patch = calls.find((c) => c.method === "PATCH" && c.url.includes("employer_requirements"))!;
    expect(patch.url).toContain("status=eq.closed");
    expect(runMatching).not.toHaveBeenCalled();
  });
});

describe("archive with reject_remaining", () => {
  it("returns the rejected ids with the status each held, writing by id", async () => {
    const calls = install({
      status: "ready",
      activeMatches: [
        { id: M1, candidate_status: "shortlisted" },
        { id: M2, candidate_status: "interviewing" },
        { id: M3, candidate_status: null },
      ],
    });
    const res = await handler(patchReq({ action: "archive", archiveDisposition: "reject_remaining" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rejectedMatchIds.sort()).toEqual([M1, M2, M3].sort());
    expect(body.rejectedMatches).toEqual(expect.arrayContaining([
      { id: M1, previousStatus: "shortlisted" },
      { id: M2, previousStatus: "interviewing" },
      { id: M3, previousStatus: "shortlisted" },
    ]));
    const reject = calls.find((c) => c.method === "PATCH" && c.url.includes("requirement_matches"))!;
    expect(reject.url).toContain(`id=in.(`);
    expect(reject.body).toMatchObject({ candidate_status: "rejected" });
    const archivePatch = calls.find((c) => c.method === "PATCH" && c.url.includes("employer_requirements"))!;
    expect(archivePatch.url).toContain("status=neq.closed");
  });

  it("does not report a record for a plain archive", async () => {
    install({ status: "ready" });
    const body = await (await handler(patchReq({ action: "archive", archiveDisposition: "keep_candidates" }))).json();
    expect(body.rejectedMatchIds).toBeUndefined();
  });
});

describe("restore action", () => {
  it("sets each match back to its previous status, only where still rejected", async () => {
    const calls = install({ restoreReturns: (url) => (url.includes(M1) ? [{ id: M1 }] : [{ id: M2 }]) });
    const res = await handler(patchReq({
      action: "restore",
      matches: [{ id: M1, previousStatus: "shortlisted" }, { id: M2, previousStatus: "interviewing" }],
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).restored).toBe(2);
    const patches = calls.filter((c) => c.method === "PATCH" && c.url.includes("requirement_matches"));
    expect(patches).toHaveLength(2);
    for (const p of patches) {
      expect(p.url).toContain("requirement_id=eq.req-1");
      expect(p.url).toContain("candidate_status=eq.rejected");
    }
    expect(patches.map((p) => p.body!.candidate_status).sort()).toEqual(["interviewing", "shortlisted"]);
  });

  it("rejects a payload that could write a status the archive never replaced", async () => {
    install({});
    for (const matches of [
      [{ id: M1, previousStatus: "hired" }],
      [{ id: "not-a-uuid", previousStatus: "shortlisted" }],
      [],
      "nope",
    ]) {
      const res = await handler(patchReq({ action: "restore", matches }));
      expect(res.status).toBe(400);
    }
  });

  it("404s when the requirement is not the caller's", async () => {
    global.fetch = vi.fn(async () => json([])) as unknown as typeof fetch;
    const res = await handler(patchReq({ action: "restore", matches: [{ id: M1, previousStatus: "shortlisted" }] }));
    expect(res.status).toBe(404);
  });
});
