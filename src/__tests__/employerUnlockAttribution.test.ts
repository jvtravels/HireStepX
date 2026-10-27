import { describe, it, expect, vi } from "vitest";
import { actorFromNotes, attributeUnlocks, cashOrderActor, type FulfilledResult } from "../../server-handlers/_employer-unlock-attribution";

const SUPABASE = "https://db.test";
const HEADERS = { apikey: "svc" };
const ACTOR = "11111111-1111-4111-8111-111111111111";

const result = (ids: string[]): FulfilledResult => ({
  kind: "fulfilled",
  order: {
    id: "o1", razorpay_order_id: "order_1", employer_id: "co-1", requirement_id: "job-1", mode: "cash",
    match_ids: ids, amount: 5900, currency: "INR", status: "fulfilled", razorpay_payment_id: "pay_1",
    created_at: "2026-10-01T00:00:00Z", paid_at: null, fulfilled_at: null,
  },
  requirementId: "job-1",
  unlockedMatchIds: ids,
  failed: [],
  candidates: ids.map((matchId) => ({ matchId, name: `Name ${matchId}`, email: null, withheld: false })),
  invoiceNo: null,
  firstFulfilment: true,
} as unknown as FulfilledResult);

type Call = { url: string; method: string; body: Record<string, unknown> | null };

function fakeDb(opts: { claimable?: string[]; alreadyLogged?: string[]; failAll?: boolean } = {}) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (opts.failAll) throw new Error("network down");
    if (url.includes("requirement_matches?") && method === "PATCH") {
      return new Response(JSON.stringify((opts.claimable ?? []).map((id) => ({ id }))), { status: 200 });
    }
    if (url.includes("employer_audit_log?") && method === "GET") {
      return new Response(JSON.stringify((opts.alreadyLogged ?? []).map((entity_id) => ({ entity_id }))), { status: 200 });
    }
    return new Response(null, { status: 201 });
  }) as unknown as typeof fetch;
  const audits = () => calls.filter((c) => c.method === "POST" && c.url.includes("employer_audit_log")).map((c) => c.body);
  return { calls, fetchImpl, audits };
}

describe("actorFromNotes", () => {
  it("accepts only a uuid createdBy", () => {
    expect(actorFromNotes({ createdBy: ACTOR })).toBe(ACTOR);
    expect(actorFromNotes({ createdBy: "not-a-uuid" })).toBeNull();
    expect(actorFromNotes({})).toBeNull();
    expect(actorFromNotes(null)).toBeNull();
  });
});

describe("cashOrderActor", () => {
  const rzp = (notes: unknown, ok = true) => vi.fn(async () =>
    ok ? new Response(JSON.stringify({ amount: 5900, notes })) : new Response("{}", { status: 500 })) as unknown as typeof fetch;

  it("reads the teammate who created the order from the Razorpay notes", async () => {
    expect(await cashOrderActor("order_1", "k", "s", rzp({ createdBy: ACTOR }))).toBe(ACTOR);
  });
  it("returns null without keys, on a Razorpay failure, or when the note is missing", async () => {
    expect(await cashOrderActor("order_1", undefined, "s", rzp({ createdBy: ACTOR }))).toBeNull();
    expect(await cashOrderActor("order_1", "k", "s", rzp({}, false))).toBeNull();
    expect(await cashOrderActor("order_1", "k", "s", rzp({}))).toBeNull();
  });
});

describe("attributeUnlocks", () => {
  it("logs only the matches this call claimed, so a second path can't log them again", async () => {
    const db = fakeDb({ claimable: ["m1"] });
    const logged = await attributeUnlocks({ supabaseUrl: SUPABASE, headers: HEADERS, result: result(["m1", "m2"]), actorId: ACTOR, paymentId: "pay_1", fetchImpl: db.fetchImpl });
    expect(logged).toEqual(["m1"]);
    expect(db.audits()).toHaveLength(1);
    expect(db.audits()[0]).toMatchObject({
      employer_id: "co-1", actor_user_id: ACTOR, action: "candidate.unlocked", entity_type: "match", entity_id: "m1",
      meta: { candidateName: "Name m1", jobId: "job-1", orderId: "order_1", mode: "cash" },
    });
    const claim = db.calls.find((c) => c.url.includes("requirement_matches?"));
    expect(claim?.url).toContain("unlocked_by=is.null");
    expect(claim?.body).toEqual({ unlocked_by: ACTOR });
    expect(db.calls.find((c) => c.url.includes("employer_unlock_payments?"))?.body).toEqual({ paid_by: ACTOR });
  });

  it("with no known actor, logs under System but skips matches already logged for this order", async () => {
    const db = fakeDb({ alreadyLogged: ["m1"] });
    const logged = await attributeUnlocks({ supabaseUrl: SUPABASE, headers: HEADERS, result: result(["m1", "m2"]), actorId: null, fetchImpl: db.fetchImpl });
    expect(logged).toEqual(["m2"]);
    expect(db.audits()).toHaveLength(1);
    expect(db.audits()[0]).toMatchObject({ actor_user_id: null, entity_id: "m2" });
    expect(db.calls.some((c) => c.method === "PATCH")).toBe(false);
  });

  it("does nothing when no match was newly unlocked", async () => {
    const db = fakeDb();
    expect(await attributeUnlocks({ supabaseUrl: SUPABASE, headers: HEADERS, result: result([]), actorId: ACTOR, fetchImpl: db.fetchImpl })).toEqual([]);
    expect(db.audits()).toHaveLength(0);
  });

  it("never throws when the database is unreachable", async () => {
    const db = fakeDb({ failAll: true });
    await expect(attributeUnlocks({ supabaseUrl: SUPABASE, headers: HEADERS, result: result(["m1"]), actorId: ACTOR, paymentId: "pay_1", fetchImpl: db.fetchImpl })).resolves.toEqual([]);
  });
});
