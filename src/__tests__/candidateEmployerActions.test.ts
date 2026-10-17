import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const withAuthAndRateLimit = vi.fn();
const notify = vi.fn(async () => undefined);
const slogWarn = vi.fn();

vi.mock("../../server-handlers/_shared", () => ({
  withAuthAndRateLimit: (...a: unknown[]) => withAuthAndRateLimit(...a),
  corsHeaders: () => ({}),
  supabaseUrl: () => "https://example.supabase.co",
  supabaseServiceHeaders: () => ({ apikey: "service-role-key", Authorization: "Bearer service-role-key", "Content-Type": "application/json" }),
  slog: { error: vi.fn(), warn: (...a: unknown[]) => slogWarn(...a), info: vi.fn() },
}));
vi.mock("../../server-handlers/_notify", () => ({ notify: (...a: unknown[]) => (notify as unknown as (...x: unknown[]) => unknown)(...a) }));

const { default: handler } = await import("../../server-handlers/candidate-employer-actions");

const UID = "cand-1";
const MATCH = "11111111-1111-4111-8111-111111111111";
const EMP = "emp-1";
const REQ = "req-1";
const RID = "22222222-2222-4222-8222-222222222222";
type Call = { url: string; method: string; body?: string };

function fakeDb(o: {
  owner?: string; response?: string; status?: string; employerSuspended?: boolean; reporters?: string[];
  duplicateReport?: boolean; matchMissing?: boolean; blockFails?: boolean; unlocked?: boolean; requestGone?: boolean;
} = {}) {
  const calls: Call[] = [];
  const res = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;
  global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    const method = init?.method ?? "GET";
    calls.push({ url: u, method, body: init?.body as string | undefined });
    if (u.includes("/rest/v1/requirement_matches") && method === "GET") {
      if (o.matchMissing) return res([]);
      return res([{
        id: MATCH, requirement_id: REQ, candidate_user_id: o.owner ?? UID, candidate_status: o.status ?? "shortlisted", candidate_response: o.response ?? "none", unlocked: o.unlocked ?? false,
        employer_requirements: { employer_id: EMP, title: "SRE", employers: { suspended_at: o.employerSuspended ? "2026-10-01" : null } },
      }]);
    }
    if (u.includes("/rest/v1/requirement_matches") && method === "PATCH") return res([{ id: MATCH }]);
    if (u.includes("/rest/v1/candidate_requests") && method === "PATCH") {
      return o.requestGone ? res([]) : res([{ id: RID, match_id: MATCH, kind: "document", topic: "Certificate", fields: null, note: null, status: "fulfilled", response_note: null, created_at: "c", resolved_at: "r" }]);
    }
    if (u.includes("/rest/v1/employer_blocks")) return o.blockFails ? res({}, 500) : res([]);
    if (u.includes("/rest/v1/employer_reports") && method === "POST") return o.duplicateReport ? res({}, 409) : res([], 201);
    if (u.includes("/rest/v1/employer_reports") && method === "GET") return res((o.reporters ?? [UID]).map((r) => ({ reporter_user_id: r })));
    return res([]);
  }) as unknown as typeof fetch;
  return calls;
}

function post(body: unknown) {
  return new Request("https://x.test/api/candidate-employer-actions", { method: "POST", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: UID }, headers: {} });
});

describe("candidate-employer-actions — validation + ownership", () => {
  it("401 unauthenticated, 405 non-POST", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    expect((await handler(post({}))).status).toBe(401);
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: UID }, headers: {} });
    expect((await handler(new Request("https://x.test/x", { method: "GET" }))).status).toBe(405);
  });

  it("400 on unknown action, bad matchId, missing reason, bad response", async () => {
    fakeDb();
    expect((await handler(post({ action: "nuke", matchId: MATCH }))).status).toBe(400);
    expect((await handler(post({ action: "block", matchId: "nope" }))).status).toBe(400);
    expect((await handler(post({ action: "report", matchId: MATCH }))).status).toBe(400);
    expect((await handler(post({ action: "report", matchId: MATCH, reason: "rude" }))).status).toBe(400);
    expect((await handler(post({ action: "respond", matchId: MATCH, response: "maybe" }))).status).toBe(400);
  });

  it("404 (not 403) for a match owned by another candidate, and does no writes", async () => {
    const calls = fakeDb({ owner: "someone-else" });
    const res = await handler(post({ action: "block", matchId: MATCH }));
    expect(res.status).toBe(404);
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
  });

  it("404 for a missing match", async () => {
    fakeDb({ matchMissing: true });
    expect((await handler(post({ action: "block", matchId: MATCH }))).status).toBe(404);
  });
});

describe("block", () => {
  it("upserts a block for the employer derived from the match (never from the client)", async () => {
    const calls = fakeDb();
    const res = await handler(post({ action: "block", matchId: MATCH, employerId: "attacker" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, blocked: true });
    const b = calls.find((c) => c.url.includes("employer_blocks"))!;
    expect(b.url).toContain("on_conflict=candidate_user_id,employer_id");
    expect(JSON.parse(b.body!)).toEqual({ candidate_user_id: UID, employer_id: EMP });
  });

  it("500s when the block cannot be written", async () => {
    fakeDb({ blockFails: true });
    expect((await handler(post({ action: "block", matchId: MATCH }))).status).toBe(500);
  });
});

describe("report", () => {
  it("files the report, blocks, and does not suspend below the threshold", async () => {
    const calls = fakeDb({ reporters: [UID, "other"] });
    const res = await handler(post({ action: "report", matchId: MATCH, reason: "spam", note: "  too\nmany  mails " }));
    expect(await res.json()).toEqual({ ok: true, blocked: true, reported: true, alreadyReported: false });
    const ins = calls.find((c) => c.url.endsWith("/employer_reports") && c.method === "POST")!;
    expect(JSON.parse(ins.body!)).toMatchObject({ reporter_user_id: UID, employer_id: EMP, match_id: MATCH, reason: "spam", note: "too many mails" });
    expect(calls.some((c) => c.url.includes("employer_blocks"))).toBe(true);
    expect(calls.some((c) => c.method === "PATCH" && c.url.includes("/employers"))).toBe(false);
  });

  it("treats a duplicate (409) as alreadyReported but still blocks", async () => {
    const calls = fakeDb({ duplicateReport: true });
    const res = await handler(post({ action: "report", matchId: MATCH, reason: "spam" }));
    expect(res.status).toBe(200);
    expect((await res.json()).alreadyReported).toBe(true);
    expect(calls.some((c) => c.url.includes("employer_blocks"))).toBe(true);
  });

  it("only counts non-dismissed reports toward suspension", async () => {
    const calls = fakeDb();
    await handler(post({ action: "report", matchId: MATCH, reason: "spam" }));
    const count = calls.find((c) => c.method === "GET" && c.url.includes("employer_reports"))!;
    expect(count.url).toContain("status=neq.dismissed");
  });

  it("auto-suspends at 3 distinct reporters, guarded by suspended_at=is.null", async () => {
    const calls = fakeDb({ reporters: [UID, "b", "c"] });
    await handler(post({ action: "report", matchId: MATCH, reason: "fake_company" }));
    const sus = calls.find((c) => c.method === "PATCH" && c.url.includes("/rest/v1/employers"))!;
    expect(sus.url).toContain(`id=eq.${EMP}`);
    expect(sus.url).toContain("suspended_at=is.null");
    expect(JSON.parse(sus.body!)).toMatchObject({ suspended_reason: "auto: 3 candidate reports" });
    expect(slogWarn).toHaveBeenCalled();
  });

  it("does not re-suspend an already suspended employer", async () => {
    const calls = fakeDb({ reporters: [UID, "b", "c", "d"], employerSuspended: true });
    await handler(post({ action: "report", matchId: MATCH, reason: "spam" }));
    expect(calls.some((c) => c.method === "PATCH" && c.url.includes("/rest/v1/employers"))).toBe(false);
  });
});

describe("respond", () => {
  it("saves the response, writes a candidate_<response> audit event and notifies the employer with a masked name", async () => {
    const calls = fakeDb();
    const res = await handler(post({ action: "respond", matchId: MATCH, response: "interested" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ ok: true, response: "interested", changed: true });
    const patch = calls.find((c) => c.method === "PATCH" && c.url.includes("requirement_matches"))!;
    expect(patch.url).toContain(`candidate_user_id=eq.${UID}`);
    expect(JSON.parse(patch.body!)).toMatchObject({ candidate_response: "interested" });
    const ev = JSON.parse(calls.find((c) => c.url.includes("match_status_events"))!.body!);
    expect(ev).toMatchObject({ match_id: MATCH, employer_id: EMP, candidate_user_id: UID, from_status: null, to_status: "candidate_interested", actor: "candidate" });
    expect(notify).toHaveBeenCalledTimes(1);
    const n = (notify.mock.calls[0] as unknown as [Record<string, string>])[0];
    expect(n).toMatchObject({ userId: EMP, type: "candidate_responded", link: `/employer/requirements/${REQ}/candidates/${MATCH}` });
    expect(n.body).toContain("Candidate #111111");
    expect(n.body).toContain("Locked");
  });

  it("tells the employer when the interested candidate is already unlocked", async () => {
    fakeDb({ unlocked: true });
    await handler(post({ action: "respond", matchId: MATCH, response: "interested" }));
    const n = (notify.mock.calls[0] as unknown as [Record<string, string>])[0];
    expect(n.body).toContain("Unlocked");
    expect(n.body).not.toContain("Locked");
  });

  it("records the previous response as from_status when changing it", async () => {
    const calls = fakeDb({ response: "interested" });
    await handler(post({ action: "respond", matchId: MATCH, response: "declined" }));
    const ev = JSON.parse(calls.find((c) => c.url.includes("match_status_events"))!.body!);
    expect(ev).toMatchObject({ from_status: "candidate_interested", to_status: "candidate_declined" });
  });

  it("refuses to change the response once the employer is interviewing or has hired", async () => {
    for (const status of ["interviewing", "hired"]) {
      const calls = fakeDb({ response: "interested", status });
      const res = await handler(post({ action: "respond", matchId: MATCH, response: "declined" }));
      expect(res.status).toBe(409);
      expect(calls.some((c) => c.method !== "GET")).toBe(false);
    }
    expect(notify).not.toHaveBeenCalled();
  });

  it("still lets a response change while the match is only invited", async () => {
    fakeDb({ response: "interested", status: "interview_invited" });
    const res = await handler(post({ action: "respond", matchId: MATCH, response: "declined" }));
    expect(res.status).toBe(200);
  });

  it("is a no-op (no write, no event, no notification) when the response is unchanged", async () => {
    const calls = fakeDb({ response: "declined" });
    const res = await handler(post({ action: "respond", matchId: MATCH, response: "declined" }));
    expect((await res.json()).changed).toBe(false);
    expect(calls.some((c) => c.method !== "GET")).toBe(false);
    expect(notify).not.toHaveBeenCalled();
  });
});

describe("resolve_request", () => {
  it("400 on a bad requestId or resolution", async () => {
    fakeDb();
    expect((await handler(post({ action: "resolve_request", matchId: MATCH, requestId: "x", resolution: "fulfilled" }))).status).toBe(400);
    expect((await handler(post({ action: "resolve_request", matchId: MATCH, requestId: RID, resolution: "cancelled" }))).status).toBe(400);
  });

  it("patches only a pending request owned by this candidate and match, then notifies the employer", async () => {
    const calls = fakeDb();
    const res = await handler(post({ action: "resolve_request", matchId: MATCH, requestId: RID, resolution: "fulfilled", note: "Shared the certificate" }));
    expect(res.status).toBe(200);
    const p = calls.find((c) => c.url.includes("candidate_requests") && c.method === "PATCH")!;
    expect(p.url).toContain(`id=eq.${RID}`);
    expect(p.url).toContain(`match_id=eq.${MATCH}`);
    expect(p.url).toContain(`candidate_user_id=eq.${UID}`);
    expect(p.url).toContain("status=eq.pending");
    expect(JSON.parse(p.body!)).toMatchObject({ status: "fulfilled", response_note: "Shared the certificate" });
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ userId: EMP, type: "candidate_request_resolved" }));
  });

  it("409 when the request is no longer pending", async () => {
    fakeDb({ requestGone: true });
    expect((await handler(post({ action: "resolve_request", matchId: MATCH, requestId: RID, resolution: "declined" }))).status).toBe(409);
    expect(notify).not.toHaveBeenCalled();
  });

  it("refuses contact details in the reply while the match is locked", async () => {
    const calls = fakeDb({ unlocked: false });
    const res = await handler(post({ action: "resolve_request", matchId: MATCH, requestId: RID, resolution: "fulfilled", note: "mail me a@b.com" }));
    expect(res.status).toBe(400);
    expect(calls.some((c) => c.url.includes("candidate_requests"))).toBe(false);
  });

  it("allows contact details in the reply once unlocked", async () => {
    fakeDb({ unlocked: true });
    const res = await handler(post({ action: "resolve_request", matchId: MATCH, requestId: RID, resolution: "fulfilled", note: "mail me a@b.com" }));
    expect(res.status).toBe(200);
  });
});

describe("credit triggers: block credits, report does not", () => {
  /** Layers a paid order and a ledger onto fakeDb so a credit would be visible if one were written. */
  function withPaidOrder(unlocked = true) {
    const calls = fakeDb({ unlocked });
    const inner = global.fetch;
    global.fetch = vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      const method = init?.method ?? "GET";
      const res = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body, text: async () => "" }) as unknown as Response;
      if (u.includes("/rest/v1/employer_unlock_orders")) {
        calls.push({ url: u, method });
        return res([{ razorpay_order_id: "order_1", employer_id: EMP, amount: 5900, match_ids: [MATCH] }]);
      }
      if (u.includes("/rest/v1/employer_credit_ledger")) {
        calls.push({ url: u, method, body: init?.body as string | undefined });
        return method === "POST" ? res(null, 201) : res([]);
      }
      return inner(url, init);
    }) as unknown as typeof fetch;
    return calls;
  }
  const ledgerInserts = (calls: Call[]) => calls.filter((c) => c.method === "POST" && c.url.includes("employer_credit_ledger"));

  it("a block credits the unlock back and relocks the contact", async () => {
    const calls = withPaidOrder();
    await handler(post({ action: "block", matchId: MATCH }));
    expect(ledgerInserts(calls).map((c) => JSON.parse(c.body!))).toEqual([expect.objectContaining({ kind: "refund", reason: "blocked", match_id: MATCH, amount: 5900 })]);
    expect(calls.some((c) => c.method === "PATCH" && c.url.includes("requirement_matches") && c.body?.includes('"unlocked":false'))).toBe(true);
  });

  it("a report never credits, so reports cannot be used to farm credit", async () => {
    const calls = withPaidOrder();
    const res = await handler(post({ action: "report", matchId: MATCH, reason: "spam" }));
    expect(res.status).toBe(200);
    expect(ledgerInserts(calls)).toHaveLength(0);
    expect(calls.some((c) => c.url.includes("employer_unlock_orders"))).toBe(false);
  });
});
