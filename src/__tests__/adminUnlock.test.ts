import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const {
  sanitizeSearchTerm,
  selectUnlockTargets,
  isUuid,
  adminUnlockCandidates,
  getUnlockMatches,
  listUnlockRequirements,
  ADMIN_UNLOCK_MAX_PER_CALL,
} = await import("../../server-handlers/_admin-unlock");

const REQ = "11111111-1111-4111-8111-111111111111";
const EMP = "22222222-2222-4222-8222-222222222222";
const M1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const M2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const M3 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const C1 = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const C2 = "cccccccc-cccc-4ccc-8ccc-ccccccccccc2";
const C3 = "cccccccc-cccc-4ccc-8ccc-ccccccccccc3";

describe("sanitizeSearchTerm", () => {
  it("strips PostgREST filter metacharacters and collapses whitespace", () => {
    expect(sanitizeSearchTerm("tcs),id.eq.1(*%")).toBe("tcs id.eq.1");
    expect(sanitizeSearchTerm("  a   b  ")).toBe("a b");
  });
  it("returns empty for non-strings and caps length", () => {
    expect(sanitizeSearchTerm(undefined)).toBe("");
    expect(sanitizeSearchTerm(42)).toBe("");
    expect(sanitizeSearchTerm("x".repeat(200))).toHaveLength(60);
  });
});

describe("isUuid", () => {
  it("accepts uuids and rejects everything else", () => {
    expect(isUuid(REQ)).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(`${REQ},${M1}`)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe("selectUnlockTargets", () => {
  const matches = [
    { id: M1, unlocked: false },
    { id: M2, unlocked: true },
    { id: M3, unlocked: false },
  ];
  it("null requested = every locked match", () => {
    expect(selectUnlockTargets(matches, null)).toEqual({ toUnlock: [M1, M3], alreadyUnlocked: 1 });
  });
  it("honours an explicit subset and dedupes", () => {
    expect(selectUnlockTargets(matches, [M3, M3, M2])).toEqual({ toUnlock: [M3], alreadyUnlocked: 1 });
  });
  it("rejects ids that are not on the requirement", () => {
    expect(() => selectUnlockTargets(matches, ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"])).toThrow();
  });
});

type Call = { url: string; method: string; body: unknown };

function stubSupabase(opts: {
  matches?: Array<{ id: string; candidate_user_id: string; unlocked: boolean }>;
  auditStatus?: number;
  failPatchFor?: string;
}) {
  const calls: Call[] = [];
  const matches = opts.matches ?? [
    { id: M1, candidate_user_id: C1, unlocked: false },
    { id: M2, candidate_user_id: C2, unlocked: true },
    { id: M3, candidate_user_id: C3, unlocked: false },
  ];
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    if (url.includes("/employer_requirements")) {
      return json([{ id: REQ, employer_id: EMP, title: "Backend Engineer", location: "Pune", status: "ready", created_at: "2026-01-01" }]);
    }
    if (url.includes("/employers?")) {
      return json([{ id: EMP, company_name: "Acme" }]);
    }
    if (url.includes("/requirement_matches") && method === "GET") return json(matches);
    if (url.includes("/profiles")) {
      return json([
        { id: C1, name: "Asha", email: "asha@x.in" },
        { id: C3, name: "Ravi", email: "ravi@x.in" },
      ]);
    }
    if (url.includes("/employer_unlock_payments") && method === "POST") return new Response(null, { status: opts.auditStatus ?? 201 });
    if (url.includes("/requirement_matches") && method === "PATCH") {
      if (opts.failPatchFor && url.includes(opts.failPatchFor)) return new Response("boom", { status: 500 });
      return new Response(null, { status: 204 });
    }
    if (url.includes("/notifications")) return new Response(null, { status: 201 });
    return json([]);
  }));
  return calls;
}

describe("adminUnlockCandidates", () => {
  beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("unlocks every locked match, records a zero-amount audit row per match first", async () => {
    const calls = stubSupabase({});
    const out = await adminUnlockCandidates({ requirementId: REQ, note: "demo for Acme" });
    expect(out).toMatchObject({ ok: true, unlocked: 2, alreadyUnlocked: 1, failed: 0 });

    const auditIdx = calls.findIndex((c) => c.url.includes("/employer_unlock_payments") && c.method === "POST");
    const firstPatchIdx = calls.findIndex((c) => c.method === "PATCH");
    expect(auditIdx).toBeGreaterThan(-1);
    expect(auditIdx).toBeLessThan(firstPatchIdx);

    const rows = calls[auditIdx].body as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.amount === 0 && r.status === "admin_grant" && r.employer_id === EMP)).toBe(true);
    expect(new Set(rows.map((r) => r.razorpay_payment_id)).size).toBe(2);
    expect(String(rows[0].razorpay_payment_id).startsWith("admin-grant:")).toBe(true);

    const patches = calls.filter((c) => c.method === "PATCH");
    expect(patches).toHaveLength(2);
    expect(patches[0].body).toMatchObject({ unlocked: true, unlocked_candidate_name: "Asha", unlocked_candidate_email: "asha@x.in" });
  });

  it("only touches the requested matches", async () => {
    const calls = stubSupabase({});
    const out = await adminUnlockCandidates({ requirementId: REQ, matchIds: [M3] });
    expect(out).toMatchObject({ ok: true, unlocked: 1 });
    const patches = calls.filter((c) => c.method === "PATCH");
    expect(patches).toHaveLength(1);
    expect(patches[0].url).toContain(M3);
  });

  it("never reads or filters on the employer's status — no approval needed", async () => {
    const calls = stubSupabase({});
    const out = await adminUnlockCandidates({ requirementId: REQ });
    expect(out).toMatchObject({ ok: true, unlocked: 2 });
    const employerReads = calls.filter((c) => c.url.includes("/employers?"));
    expect(employerReads.length).toBeGreaterThan(0);
    expect(employerReads.every((c) => !c.url.includes("status"))).toBe(true);
  });

  it("does not unlock anything if the audit row cannot be written", async () => {
    const calls = stubSupabase({ auditStatus: 500 });
    const out = await adminUnlockCandidates({ requirementId: REQ });
    expect(out).toMatchObject({ ok: false });
    expect(calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("reports partial failure instead of claiming success", async () => {
    stubSupabase({ failPatchFor: M3 });
    const out = await adminUnlockCandidates({ requirementId: REQ });
    expect(out).toMatchObject({ ok: false, unlocked: 1, failed: 1 });
  });

  it("is a no-op when everything is already unlocked", async () => {
    const calls = stubSupabase({ matches: [{ id: M2, candidate_user_id: C2, unlocked: true }] });
    const out = await adminUnlockCandidates({ requirementId: REQ });
    expect(out).toEqual({ ok: true, unlocked: 0, alreadyUnlocked: 1, failed: 0 });
    expect(calls.some((c) => c.method === "POST" || c.method === "PATCH")).toBe(false);
  });

  it("rejects malformed input", async () => {
    stubSupabase({});
    await expect(adminUnlockCandidates({ requirementId: "nope" })).rejects.toThrow();
    await expect(adminUnlockCandidates({ requirementId: REQ, matchIds: [] })).rejects.toThrow();
    await expect(adminUnlockCandidates({ requirementId: REQ, matchIds: ["x"] })).rejects.toThrow();
  });

  it("caps how many can be unlocked in one action", async () => {
    const many = Array.from({ length: ADMIN_UNLOCK_MAX_PER_CALL + 1 }, (_, i) => ({
      id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, "0")}`, candidate_user_id: C1, unlocked: false,
    }));
    const calls = stubSupabase({ matches: many });
    const out = await adminUnlockCandidates({ requirementId: REQ });
    expect(out).toMatchObject({ ok: false });
    expect(calls.some((c) => c.method === "POST" || c.method === "PATCH")).toBe(false);
  });
});

describe("read sections", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("getUnlockMatches joins candidate names and keeps locked state", async () => {
    stubSupabase({});
    const out = await getUnlockMatches(REQ);
    expect(out.employer).toEqual({ id: EMP, companyName: "Acme" });
    expect(out.matches.find((m) => m.matchId === M1)).toMatchObject({ name: "Asha", unlocked: false });
    expect(out.matches.find((m) => m.matchId === M2)).toMatchObject({ name: "(no name)", unlocked: true });
  });

  it("listUnlockRequirements lists requirements for every employer", async () => {
    stubSupabase({});
    const out = await listUnlockRequirements("acme");
    expect(out.rows).toEqual([expect.objectContaining({ requirementId: REQ, companyName: "Acme", title: "Backend Engineer" })]);
  });
});
