import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

/* Handler-level tests for employer-create-unlock-order.ts — the money path
 * that decides what an employer gets charged (₹59 single / ₹299 batch), which
 * candidates a batch order covers, and whether the tier's daily unlock limit
 * lets the purchase through. _shared.ts is mocked so these run without real
 * Supabase/network config; every outbound request goes through a URL-routed
 * global.fetch fake (Supabase REST + Razorpay), so no real orders are created. */

process.env.RAZORPAY_KEY_ID = "rzp_test_key123";
process.env.RAZORPAY_KEY_SECRET = "test_secret_abc";

const applyCorsHeaders = vi.fn();
const handlePreflightAndMethod = vi.fn();
const isRateLimited = vi.fn();
const getVercelClientIp = vi.fn();
const supabaseUrl = vi.fn();
const supabaseAnonKey = vi.fn();
const supabaseServiceHeaders = vi.fn();

vi.mock("../../server-handlers/_shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_shared")>();
  return {
    applyCorsHeaders: (...args: unknown[]) => applyCorsHeaders(...args),
    handlePreflightAndMethod: (...args: unknown[]) => handlePreflightAndMethod(...args),
    isRateLimited: (...args: unknown[]) => isRateLimited(...args),
    getVercelClientIp: (...args: unknown[]) => getVercelClientIp(...args),
    supabaseUrl: (...args: unknown[]) => supabaseUrl(...args),
    supabaseAnonKey: (...args: unknown[]) => supabaseAnonKey(...args),
    supabaseServiceHeaders: (...args: unknown[]) => supabaseServiceHeaders(...args),
    verifyEmployerAuthToken: actual.verifyEmployerAuthToken,
    slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  };
});

const { default: handler } = await import("../../server-handlers/employer-create-unlock-order");

const EMP = "11111111-1111-4111-8111-111111111111";
const REQ = "22222222-2222-4222-8222-222222222222";
const uid = (n: number) => `33333333-3333-4333-8333-${String(n).padStart(12, "0")}`;
const M1 = uid(1);

function mockReq(body: Record<string, unknown>, overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: "POST",
    headers: { authorization: "Bearer user-token", origin: "https://app.hirestepx.com" },
    body,
    ...overrides,
  } as unknown as VercelRequest;
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(key: string, value: string) { res.headers[key] = value; return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; },
    end() { return res; },
  };
  return res as unknown as VercelResponse & typeof res;
}

/* ── routed fetch fake ── */

interface MatchSpec {
  id: string;
  unlocked?: boolean;
  visibility?: string;
  candidate?: string;
  score?: number;
}
interface World {
  authOk: boolean;
  email: string | null;
  emailConfirmed: boolean;
  website: string | null;
  storedTier: string | null;
  suspendedAt: string | null;
  reqStatus: string;
  ownerId: string;
  matches: MatchSpec[];
  blockedCandidates: Set<string>;
  openOrders: Array<Record<string, unknown>>;
  unlocked24h: number;
  razorpay: { ok: boolean; status: number; id: string };
  insertStatus: number; // 201 ok, 409 conflict, 500
  matchLookupStatus: number;
}
let world: World;
let calls: Array<{ method: string; url: string; body: unknown }>;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const accessRow = (m: MatchSpec) => ({
  id: m.id, requirement_id: REQ, candidate_user_id: m.candidate ?? `cand-${m.id}`, match_score: m.score ?? 80,
  unlocked: !!m.unlocked, candidate_status: "new",
  employer_requirements: {
    employer_id: world.ownerId, status: world.reqStatus, title: "Engineer",
    employers: { company_name: "Acme", website: world.website, suspended_at: world.suspendedAt, verification_tier: world.storedTier },
  },
  profiles: { name: "Cand", employer_visibility: m.visibility ?? "on" },
});

function routedFetch() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method || "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url, body });

    if (url.endsWith("/auth/v1/user")) return world.authOk ? json({ id: EMP }) : json({}, 401);
    if (url.includes("/auth/v1/admin/users/")) {
      return json({ email: world.email, email_confirmed_at: world.emailConfirmed ? "2026-01-01T00:00:00Z" : null });
    }
    if (url.includes("requirement_matches?id=eq.")) {
      if (world.matchLookupStatus !== 200) return json({}, world.matchLookupStatus);
      const id = decodeURIComponent(url.split("requirement_matches?id=eq.")[1].split("&")[0]);
      const m = world.matches.find((x) => x.id === id);
      return json(m ? [accessRow(m)] : []);
    }
    if (url.includes("employer_blocks?")) {
      const cand = decodeURIComponent(url.split("candidate_user_id=eq.")[1].split("&")[0]);
      return json(world.blockedCandidates.has(cand) ? [{ candidate_user_id: cand }] : []);
    }
    if (url.includes("employer_requirements?id=eq.")) {
      const id = decodeURIComponent(url.split("employer_requirements?id=eq.")[1].split("&")[0]);
      if (id !== REQ || world.ownerId !== EMP) return json([]);
      return json([{ id: REQ, status: world.reqStatus, employers: { website: world.website, suspended_at: world.suspendedAt, verification_tier: world.storedTier } }]);
    }
    if (url.includes("requirement_matches?requirement_id=eq.")) {
      const sorted = [...world.matches].sort((a, b) => (b.score ?? 80) - (a.score ?? 80) || a.id.localeCompare(b.id));
      return json(sorted.map((m) => ({ id: m.id, unlocked: !!m.unlocked })));
    }
    if (url.includes("requirement_matches?unlocked=eq.true")) {
      return json(Array.from({ length: world.unlocked24h }, (_, i) => ({ id: `u${i}` })));
    }
    if (url.includes("employer_unlock_orders?employer_id=eq.") && method === "GET") return json(world.openOrders);
    if (url.endsWith("/rest/v1/employer_unlock_orders") && method === "POST") {
      if (world.insertStatus === 409) return json({ code: "23505" }, 409);
      if (world.insertStatus !== 201) return json({ message: "boom" }, world.insertStatus);
      return json([{ id: "row-1", mode: body.mode, match_ids: body.match_ids, status: "created", created_at: new Date().toISOString(),
        razorpay_order_id: body.razorpay_order_id, employer_id: body.employer_id, requirement_id: body.requirement_id,
        amount: body.amount, currency: body.currency }], 201);
    }
    if (url === "https://api.razorpay.com/v1/orders") {
      if (!world.razorpay.ok) return json({ error: { description: "bad" } }, world.razorpay.status);
      return json({ id: world.razorpay.id, amount: body.amount, currency: "INR" });
    }
    return json({ message: `unrouted ${method} ${url}` }, 404);
  });
}

const razorpayCall = () => calls.find((c) => c.url === "https://api.razorpay.com/v1/orders");
const openOrder = (over: Record<string, unknown> = {}) => ({
  id: "row-x", razorpay_order_id: "order_existing", employer_id: EMP, requirement_id: REQ, mode: "single", match_ids: [M1],
  amount: 5900, currency: "INR", status: "created", razorpay_payment_id: null,
  created_at: new Date().toISOString(), paid_at: null, fulfilled_at: null, ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  applyCorsHeaders.mockReturnValue("https://app.hirestepx.com");
  handlePreflightAndMethod.mockReturnValue(false);
  isRateLimited.mockResolvedValue(false);
  getVercelClientIp.mockReturnValue("1.2.3.4");
  supabaseUrl.mockReturnValue("https://example.supabase.co");
  supabaseAnonKey.mockReturnValue("anon-key");
  supabaseServiceHeaders.mockReturnValue({ apikey: "service-key", Authorization: "Bearer service-key" });
  calls = [];
  world = {
    authOk: true, email: "boss@acme.com", emailConfirmed: true, website: "https://acme.com", storedTier: null,
    suspendedAt: null, reqStatus: "open", ownerId: EMP, matches: [{ id: M1 }], blockedCandidates: new Set(),
    openOrders: [], unlocked24h: 0, razorpay: { ok: true, status: 200, id: "order_new" }, insertStatus: 201, matchLookupStatus: 200,
  };
  global.fetch = routedFetch() as unknown as typeof fetch;
});

describe("employer-create-unlock-order — request gating", () => {
  it("403s when the origin isn't allowed", async () => {
    applyCorsHeaders.mockReturnValue("");
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(403);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("429s and sets Retry-After when rate limited", async () => {
    isRateLimited.mockResolvedValue(true);
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(429);
    expect(res.headers["Retry-After"]).toBe("60");
  });

  it("401s with no Authorization header", async () => {
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }, { headers: { origin: "https://app.hirestepx.com" } }), res);
    expect(res.statusCode).toBe(401);
  });

  it("401s when the Supabase auth lookup rejects the token", async () => {
    world.authOk = false;
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(401);
  });

  it("400s when single mode is missing matchId, batch mode is missing requirementId, or the id is not a uuid", async () => {
    for (const body of [{ mode: "single" }, { mode: "batch" }, { mode: "single", matchId: "m1" }, { mode: "batch", requirementId: "x,or=(1.eq.1)" }]) {
      const res = mockRes();
      await handler(mockReq(body), res);
      expect(res.statusCode).toBe(400);
    }
    expect(razorpayCall()).toBeUndefined();
  });
});

describe("employer-create-unlock-order — single mode", () => {
  it("creates a ₹59 order, records it in employer_unlock_orders and returns checkout details", async () => {
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ orderId: "order_new", amount: 5900, currency: "INR", keyId: "rzp_test_key123" });
    expect((res.body as Record<string, unknown>).reused).toBeUndefined();
    expect(razorpayCall()?.body).toMatchObject({ amount: 5900, currency: "INR", notes: { employerId: EMP, mode: "single", requirementId: REQ, matchIds: M1 } });
    const insert = calls.find((c) => c.method === "POST" && c.url.endsWith("/rest/v1/employer_unlock_orders"));
    expect(insert?.body).toMatchObject({ razorpay_order_id: "order_new", employer_id: EMP, requirement_id: REQ, mode: "single", match_ids: [M1], amount: 5900, status: "created" });
  });

  it("ignores any client-supplied amount", async () => {
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1, amount: 1 }), res);
    expect(razorpayCall()?.body).toMatchObject({ amount: 5900 });
  });

  it("404s when the match does not exist and 403s when it belongs to another employer", async () => {
    world.matches = [];
    let res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(404);

    world.matches = [{ id: M1 }];
    world.ownerId = "99999999-9999-4999-8999-999999999999";
    res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(403);
    expect(razorpayCall()).toBeUndefined();
  });

  it("refuses a suspended employer with code 'suspended'", async () => {
    world.suspendedAt = "2026-09-01T00:00:00Z";
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: "suspended" });
    expect(razorpayCall()).toBeUndefined();
  });

  it("refuses a candidate who opted out of employer visibility (no Razorpay order, no charge)", async () => {
    world.matches = [{ id: M1, visibility: "off" }];
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: "candidate_opted_out" });
    expect(razorpayCall()).toBeUndefined();
  });

  it("refuses a candidate who blocked this employer", async () => {
    world.blockedCandidates.add(`cand-${M1}`);
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ code: "blocked" });
    expect(razorpayCall()).toBeUndefined();
  });

  it("409s for an already-unlocked candidate and for a closed requirement", async () => {
    world.matches = [{ id: M1, unlocked: true }];
    let res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(409);

    world.matches = [{ id: M1 }];
    world.reqStatus = "closed";
    res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(409);
    expect(razorpayCall()).toBeUndefined();
  });

  it("500s (not 404) when the match lookup itself fails", async () => {
    world.matchLookupStatus = 500;
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(500);
  });

  it("502s when Razorpay rejects the order and never writes an order row", async () => {
    world.razorpay = { ok: false, status: 500, id: "" };
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(502);
    expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/rest/v1/employer_unlock_orders"))).toBe(false);
  });
});

describe("employer-create-unlock-order — tier daily unlock limit", () => {
  it("429s with code, limit, remaining and tier for a basic (free-mail) employer past 3/day", async () => {
    world.email = "boss@gmail.com";
    world.website = null;
    world.unlocked24h = 3;
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ code: "unlock_daily_limit", limit: 3, remaining: 0, tier: "basic" });
    expect(res.headers["Retry-After"]).toBe("3600");
    expect(razorpayCall()).toBeUndefined();
  });

  it("allows the last unlock of the day for the same tier", async () => {
    world.email = "boss@gmail.com";
    world.website = null;
    world.unlocked24h = 2;
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(200);
  });

  it("counts matches in other fresh open orders against the limit", async () => {
    world.email = "boss@gmail.com";
    world.website = null;
    world.unlocked24h = 1;
    world.openOrders = [openOrder({ razorpay_order_id: "order_b", mode: "batch", match_ids: [uid(7), uid(8)], status: "paid" })];
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ limit: 3, remaining: 0 });
  });

  it("a verified-tier employer has the higher limit (25 for email_verified, 100 for admin-verified)", async () => {
    world.website = null;
    world.unlocked24h = 24;
    let res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(200);

    world.unlocked24h = 25;
    res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ limit: 25, tier: "email_verified" });
  });

  it("503s rather than skipping the limit when the usage count cannot be read", async () => {
    const real = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes("requirement_matches?unlocked=eq.true") ? json({}, 500) : real(input, init)) as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(503);
    expect(razorpayCall()).toBeUndefined();
  });
});

describe("employer-create-unlock-order — open order reuse and overlap", () => {
  it("returns the existing unpaid order (reused:true) instead of creating a second Razorpay order", async () => {
    world.openOrders = [openOrder()];
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ orderId: "order_existing", amount: 5900, reused: true });
    expect(razorpayCall()).toBeUndefined();
  });

  it("409s order_in_progress when a paid order already covers the candidate", async () => {
    world.openOrders = [openOrder({ status: "paid" })];
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: "order_in_progress" });
  });

  it("409s order_in_progress when a fresh batch order overlaps a single purchase", async () => {
    world.openOrders = [openOrder({ razorpay_order_id: "order_batch", mode: "batch", match_ids: [M1, uid(2)], amount: 11800 })];
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: "order_in_progress" });
  });

  it("a stale abandoned unpaid order for a different purchase does not block it", async () => {
    world.openOrders = [openOrder({ razorpay_order_id: "order_old", mode: "batch", match_ids: [M1, uid(2)], created_at: new Date(Date.now() - 2 * 3600_000).toISOString() })];
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(200);
    expect((res.body as Record<string, unknown>).orderId).toBe("order_new");
  });

  it("when the unique open-order index rejects a racing insert, returns the winner's order", async () => {
    world.insertStatus = 409;
    const real = global.fetch;
    let listCalls = 0;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("employer_unlock_orders?employer_id=eq.") && (init?.method || "GET") === "GET") {
        listCalls += 1;
        // first listing (pre-check) is empty; the post-conflict listing contains the winner
        return json(listCalls === 1 ? [] : [openOrder({ razorpay_order_id: "order_winner" })]);
      }
      return real(input, init);
    }) as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ orderId: "order_winner", reused: true });
  });

  it("500s when the order row cannot be persisted (never hands out an unrecorded order)", async () => {
    world.insertStatus = 500;
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(500);
  });

  it("503s when open orders cannot be read", async () => {
    const real = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes("employer_unlock_orders?employer_id=eq.") ? json({}, 500) : real(input, init)) as unknown as typeof fetch;
    const res = mockRes();
    await handler(mockReq({ mode: "single", matchId: M1 }), res);
    expect(res.statusCode).toBe(503);
  });
});

describe("employer-create-unlock-order — batch mode", () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => uid(100 + i));

  it("charges the flat ₹299 for a full bucket of 10 and records the ids server-side (notes carry only a count)", async () => {
    world.matches = ids(12).map((id, i) => ({ id, score: 99 - i }));
    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: REQ }), res);
    expect(res.statusCode).toBe(200);
    expect(razorpayCall()?.body).toMatchObject({ amount: 29900, notes: { employerId: EMP, mode: "batch", requirementId: REQ, matchCount: "10" } });
    const notes = (razorpayCall()?.body as { notes: Record<string, string> }).notes;
    expect(notes.matchIds).toBeUndefined();
    const insert = calls.find((c) => c.method === "POST" && c.url.endsWith("/rest/v1/employer_unlock_orders"));
    expect((insert?.body as { match_ids: string[] }).match_ids).toEqual(ids(10));
  });

  it("prices a partial bucket proportionally (5 candidates -> ₹149.50)", async () => {
    world.matches = ids(5).map((id, i) => ({ id, score: 90 - i }));
    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: REQ }), res);
    expect(razorpayCall()?.body).toMatchObject({ amount: 14950 });
    expect((res.body as Record<string, unknown>).amount).toBe(14950);
  });

  it("skips fully-unlocked buckets and targets only the still-locked candidates of the next one", async () => {
    const all = ids(13);
    world.matches = all.map((id, i) => ({ id, score: 99 - i, unlocked: i < 10 || i === 10 }));
    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: REQ }), res);
    expect(res.statusCode).toBe(200);
    expect(razorpayCall()?.body).toMatchObject({ amount: 5980 });
    const insert = calls.find((c) => c.method === "POST" && c.url.endsWith("/rest/v1/employer_unlock_orders"));
    expect((insert?.body as { match_ids: string[] }).match_ids).toEqual([all[11], all[12]]);
  });

  it("drops opted-out and blocked candidates from the batch and from its price", async () => {
    const all = ids(4);
    world.matches = all.map((id, i) => ({ id, score: 90 - i, visibility: i === 1 ? "off" : "on" }));
    world.blockedCandidates.add(`cand-${all[2]}`);
    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: REQ }), res);
    expect(res.statusCode).toBe(200);
    const insert = calls.find((c) => c.method === "POST" && c.url.endsWith("/rest/v1/employer_unlock_orders"));
    expect((insert?.body as { match_ids: string[] }).match_ids).toEqual([all[0], all[3]]);
    expect(razorpayCall()?.body).toMatchObject({ amount: 5980 });
  });

  it("409s no_eligible_candidates when every candidate in the bucket is unavailable", async () => {
    world.matches = ids(2).map((id) => ({ id, visibility: "off" }));
    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: REQ }), res);
    expect(res.statusCode).toBe(409);
    expect(res.body).toMatchObject({ code: "no_eligible_candidates" });
    expect(razorpayCall()).toBeUndefined();
  });

  it("409s when all candidates are already unlocked", async () => {
    world.matches = ids(3).map((id) => ({ id, unlocked: true }));
    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: REQ }), res);
    expect(res.statusCode).toBe(409);
  });

  it("403s for a requirement the caller does not own and for a suspended employer", async () => {
    world.ownerId = "99999999-9999-4999-8999-999999999999";
    let res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: REQ }), res);
    expect(res.statusCode).toBe(403);

    world.ownerId = EMP;
    world.suspendedAt = "2026-09-01T00:00:00Z";
    res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: REQ }), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: "suspended" });
  });

  it("applies the tier limit to the batch size (10 requested vs 3/day basic)", async () => {
    world.email = "boss@gmail.com";
    world.website = null;
    world.matches = ids(10).map((id, i) => ({ id, score: 90 - i }));
    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: REQ }), res);
    expect(res.statusCode).toBe(429);
    expect(res.body).toMatchObject({ code: "unlock_daily_limit", limit: 3, tier: "basic" });
  });

  it("reuses an existing unpaid order for exactly the same batch", async () => {
    world.matches = ids(3).map((id, i) => ({ id, score: 90 - i }));
    world.openOrders = [openOrder({ razorpay_order_id: "order_batch_existing", mode: "batch", match_ids: ids(3), amount: 8970 })];
    const res = mockRes();
    await handler(mockReq({ mode: "batch", requirementId: REQ }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ orderId: "order_batch_existing", reused: true, amount: 8970 });
    expect(razorpayCall()).toBeUndefined();
  });
});
