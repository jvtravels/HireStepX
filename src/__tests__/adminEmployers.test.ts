import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const {
  parseEmployerTier, buildTierPatch, parseSuspendReason, buildSuspendPatch, buildUnsuspendPatch,
  parseReportFilter, parseResolveStatus, canTransitionReport, summarizeEmployers,
  setEmployerTier, suspendEmployer, unsuspendEmployer, resolveEmployerReport, listEmployerReports,
} = await import("../../server-handlers/_admin-employers");
const { ValidationError } = await import("../../server-handlers/_admin-shared");

const EMP = "22222222-2222-4222-8222-222222222222";
const REP = "33333333-3333-4333-8333-333333333333";

describe("tier helpers", () => {
  it("parseEmployerTier validates", () => {
    expect(parseEmployerTier("verified")).toBe("verified");
    expect(() => parseEmployerTier("gold")).toThrow(ValidationError);
    expect(() => parseEmployerTier(undefined)).toThrow(ValidationError);
  });
  it("buildTierPatch stamps verified_at for non-basic tiers and clears it for basic", () => {
    expect(buildTierPatch("verified", "T")).toEqual({ verification_tier: "verified", verified_at: "T" });
    expect(buildTierPatch("email_verified", "T").verified_at).toBe("T");
    expect(buildTierPatch("basic", "T")).toEqual({ verification_tier: "basic", verified_at: null });
  });
});

describe("suspension helpers", () => {
  it("requires a reason, strips control chars and caps length", () => {
    expect(() => parseSuspendReason("")).toThrow(ValidationError);
    expect(() => parseSuspendReason("   ")).toThrow(ValidationError);
    expect(() => parseSuspendReason(undefined)).toThrow(ValidationError);
    expect(parseSuspendReason("fake\u0000  company\n")).toBe("fake company");
    expect(parseSuspendReason("x".repeat(1000)).length).toBe(300);
  });
  it("builds suspend / unsuspend patches; admin reasons are prefixed to tell them from auto ones", () => {
    expect(buildSuspendPatch("scam", "T")).toEqual({ suspended_at: "T", suspended_reason: "admin: scam" });
    expect(buildUnsuspendPatch()).toEqual({ suspended_at: null, suspended_reason: null });
  });
});

describe("report helpers", () => {
  it("parseReportFilter defaults to open and validates", () => {
    expect(parseReportFilter(undefined)).toBe("open");
    expect(parseReportFilter("all")).toBe("all");
    expect(parseReportFilter("dismissed")).toBe("dismissed");
    expect(() => parseReportFilter("weird")).toThrow(ValidationError);
  });
  it("parseResolveStatus rejects open and unknown", () => {
    expect(parseResolveStatus("actioned")).toBe("actioned");
    expect(() => parseResolveStatus("open")).toThrow(ValidationError);
  });
  it("canTransitionReport: open->any, reviewed->final, finals are final", () => {
    expect(canTransitionReport("open", "reviewed")).toBe(true);
    expect(canTransitionReport("open", "dismissed")).toBe(true);
    expect(canTransitionReport("reviewed", "actioned")).toBe(true);
    expect(canTransitionReport("reviewed", "reviewed")).toBe(false);
    expect(canTransitionReport("actioned", "dismissed")).toBe(false);
    expect(canTransitionReport("dismissed", "actioned")).toBe(false);
  });
});

describe("summarizeEmployers", () => {
  it("aggregates open reports and PAID unlock revenue only, with contacts", () => {
    const rows = summarizeEmployers(
      [
        { id: "a", company_name: "Acme", website: "acme.com", verification_tier: "verified", verified_at: "v", suspended_at: null, suspended_reason: null, submitted_at: "s" },
        { id: "b", company_name: null, website: null, verification_tier: null, verified_at: null, suspended_at: "x", suspended_reason: "auto: 3 candidate reports", submitted_at: null },
      ],
      [{ employer_id: "a" }, { employer_id: "a" }],
      [
        { employer_id: "a", amount: 5900, status: "completed" },
        { employer_id: "a", amount: 5900, status: "completed" },
        { employer_id: "a", amount: 0, status: "admin_grant" },
        { employer_id: "a", amount: 999, status: "failed" },
      ],
      new Map([["a", { name: "Asha", email: "a@acme.com" }]]),
    );
    expect(rows[0]).toMatchObject({ id: "a", tier: "verified", suspended: false, openReports: 2, unlockRevenuePaise: 11800, contactEmail: "a@acme.com" });
    expect(rows[1]).toMatchObject({ id: "b", tier: "basic", suspended: true, suspendedReason: "auto: 3 candidate reports", openReports: 0, unlockRevenuePaise: 0, contactName: "(deleted user)" });
  });
});

describe("admin employer actions (I/O)", () => {
  let calls: Array<{ url: string; method: string; body?: string }>;
  function mockFetch(handlerFn: (url: string, method: string) => unknown) {
    calls = [];
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url: String(url), method, body: init?.body as string | undefined });
      const out = handlerFn(String(url), method);
      return { ok: true, status: 200, json: async () => out, text: async () => "" } as unknown as Response;
    }) as unknown as typeof fetch;
  }
  beforeEach(() => vi.clearAllMocks());

  it("rejects non-uuid employer ids before any request", async () => {
    mockFetch(() => []);
    await expect(setEmployerTier("1;drop", "verified")).rejects.toThrow(ValidationError);
    await expect(suspendEmployer(undefined, "x")).rejects.toThrow(ValidationError);
    await expect(unsuspendEmployer("nope")).rejects.toThrow(ValidationError);
    expect(calls).toHaveLength(0);
  });

  it("setEmployerTier PATCHes tier + verified_at; 400s on an unknown employer", async () => {
    mockFetch(() => [{ id: EMP }]);
    const out = await setEmployerTier(EMP, "verified");
    expect(out).toMatchObject({ ok: true, verification_tier: "verified" });
    expect(calls[0].url).toContain(`employers?id=eq.${EMP}`);
    expect(JSON.parse(calls[0].body!)).toMatchObject({ verification_tier: "verified" });
    mockFetch(() => []);
    await expect(setEmployerTier(EMP, "verified")).rejects.toThrow(ValidationError);
  });

  it("suspend / unsuspend write the suspension columns", async () => {
    mockFetch(() => [{ id: EMP }]);
    await suspendEmployer(EMP, "fake company");
    expect(JSON.parse(calls[0].body!)).toMatchObject({ suspended_reason: "admin: fake company" });
    await unsuspendEmployer(EMP);
    expect(JSON.parse(calls[1].body!)).toEqual({ suspended_at: null, suspended_reason: null });
  });

  it("resolveEmployerReport transitions with a status CAS and stamps reviewed_at", async () => {
    mockFetch((url, method) => (method === "GET" ? [{ status: "open" }] : [{ id: REP }]));
    const out = await resolveEmployerReport(REP, "actioned");
    expect(out).toMatchObject({ ok: true, status: "actioned" });
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toContain(`id=eq.${REP}`);
    expect(patch.url).toContain("status=eq.open");
    expect(JSON.parse(patch.body!)).toMatchObject({ status: "actioned" });
    expect(JSON.parse(patch.body!).reviewed_at).toBeTruthy();
  });

  it("resolveEmployerReport rejects final reports, unknown reports and lost CAS races", async () => {
    mockFetch(() => [{ status: "dismissed" }]);
    await expect(resolveEmployerReport(REP, "actioned")).rejects.toThrow(ValidationError);
    mockFetch(() => []);
    await expect(resolveEmployerReport(REP, "actioned")).rejects.toThrow(/not found/);
    mockFetch((_u, method) => (method === "GET" ? [{ status: "open" }] : []));
    await expect(resolveEmployerReport(REP, "reviewed")).rejects.toThrow(/concurrently/);
    await expect(resolveEmployerReport("bad", "reviewed")).rejects.toThrow(ValidationError);
  });

  it("listEmployerReports defaults to open, filters by employer and joins company info", async () => {
    mockFetch((url) =>
      url.includes("employer_reports")
        ? [{ id: REP, employer_id: EMP, match_id: null, reason: "spam", note: null, status: "open", created_at: "c", reviewed_at: null }]
        : [{ id: EMP, company_name: "Acme", suspended_at: null, verification_tier: "basic" }],
    );
    const out = await listEmployerReports(undefined, EMP);
    expect(calls[0].url).toContain("status=eq.open");
    expect(calls[0].url).toContain(`employer_id=eq.${EMP}`);
    expect(out.rows[0]).toMatchObject({ id: REP, companyName: "Acme", reason: "spam", employerSuspended: false });
    await expect(listEmployerReports("all", "not-uuid")).rejects.toThrow(ValidationError);
  });
});
