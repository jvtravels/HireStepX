import { describe, it, expect, vi, beforeEach } from "vitest";

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

const { default: handler } = await import("../../server-handlers/employer-unlock-history");

function req() {
  return new Request("https://x.test/api/employer-unlock-history", { method: "GET" });
}

/** URL-routed fetch: each key is matched as a substring of the request URL; unmatched tables answer []. */
function routed(map: Record<string, unknown | ((url: string) => { ok: boolean; status?: number; body: unknown })>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(map).find((k) => url.includes(k));
    const v = key ? map[key] : [];
    const r = typeof v === "function" ? (v as (u: string) => { ok: boolean; status?: number; body: unknown })(url) : { ok: true, body: v };
    return { ok: r.ok, status: r.status ?? (r.ok ? 200 : 500), json: async () => r.body, text: async () => JSON.stringify(r.body) } as Response;
  });
}

const PAY_ROW = { id: "p1", match_id: "m1", match_ids: null, amount: 5900, currency: "INR", created_at: "2026-10-01T00:00:00Z" };

beforeEach(() => {
  vi.restoreAllMocks();
  withAuthAndRateLimit.mockResolvedValue({ auth: { userId: "emp-1" }, headers: {} });
});

describe("employer-unlock-history handler", () => {
  it("returns 401 when unauthenticated", async () => {
    withAuthAndRateLimit.mockResolvedValue({ auth: { userId: null }, headers: {} });
    const res = await handler(req());
    expect(res.status).toBe(401);
  });

  it("returns purchases with candidate snapshots on the happy path", async () => {
    global.fetch = routed({
      employer_unlock_payments: [PAY_ROW],
      requirement_matches: [{ id: "m1", candidate_user_id: "c1", unlocked_candidate_name: "Priya Sharma", unlocked_candidate_email: "priya@example.com" }],
    });

    const res = await handler(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.purchases).toEqual([
      {
        id: "p1",
        matchIds: ["m1"],
        amount: 5900,
        currency: "INR",
        createdAt: "2026-10-01T00:00:00Z",
        invoiceNo: null,
        refundedAt: null,
        requirementId: null,
        orderId: null,
        orderStatus: null,
        creditAppliedPaise: 0,
        invoiceSnapshot: null,
        partialRefundPaise: 0,
        partialRefundAt: null,
        creditNotes: [],
        gstin: null,
        billingName: null,
        candidates: [{ matchId: "m1", name: "Priya Sharma", email: "priya@example.com" }],
      },
    ]);
  });

  it("still returns the purchase list when the candidate-snapshot columns don't exist yet (supabase-migrations/0026 not applied) instead of 500ing", async () => {
    // PostgREST rejects the unknown-column select with a 400 + a JSON
    // error BODY (not an array) — the historical bug iterated this object
    // directly and threw "not iterable", turning a cosmetic lookup failure
    // into a full 500 for the whole endpoint.
    global.fetch = routed({
      employer_unlock_payments: [PAY_ROW],
      requirement_matches: () => ({ ok: false, status: 400, body: { code: "42703", message: 'column "unlocked_candidate_name" does not exist' } }),
    });

    const res = await handler(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.purchases).toEqual([
      {
        id: "p1",
        matchIds: ["m1"],
        amount: 5900,
        currency: "INR",
        createdAt: "2026-10-01T00:00:00Z",
        invoiceNo: null,
        refundedAt: null,
        requirementId: null,
        orderId: null,
        orderStatus: null,
        creditAppliedPaise: 0,
        invoiceSnapshot: null,
        partialRefundPaise: 0,
        partialRefundAt: null,
        creditNotes: [],
        gstin: null,
        billingName: null,
        candidates: [{ matchId: "m1", name: null, email: null }],
      },
    ]);
    expect(slogError).toHaveBeenCalledWith(
      "employer-unlock-history candidate snapshot lookup failed",
      expect.objectContaining({ status: 400 }),
    );
  });

  it("surfaces invoice, refund, order status and GST billing identity when present", async () => {
    global.fetch = routed({
      employer_unlock_payments: [{ ...PAY_ROW, razorpay_order_id: "order_1", invoice_no: "INV-0001", refunded_at: "2026-10-02T00:00:00Z" }],
      requirement_matches: [{ id: "m1", candidate_user_id: "c1", unlocked_candidate_name: "Priya Sharma", unlocked_candidate_email: "priya@example.com" }],
      employer_unlock_orders: [{ razorpay_order_id: "order_1", status: "paid" }],
      employer_credit_ledger: [{ amount: -2000, order_ref: "order_1" }],
      "select=gstin": [{ gstin: "29ABCDE1234F1Z5", billing_name: "Acme Pvt Ltd" }],
    });

    const res = await handler(req());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.purchases[0]).toMatchObject({
      invoiceNo: "INV-0001",
      refundedAt: "2026-10-02T00:00:00Z",
      orderId: "order_1",
      orderStatus: "paid",
      creditAppliedPaise: 2000,
      gstin: "29ABCDE1234F1Z5",
      billingName: "Acme Pvt Ltd",
    });
  });

  describe("invoice snapshot and partial refund (migration 0045)", () => {
    const snapshot = {
      v: 1,
      supplier: { name: "HireStepX Pvt Ltd", address: "Bengaluru", gstin: "29ABCDE1234F1Z5", sac: "998439" },
      buyer: { name: "Acme Pvt Ltd", gstin: "27ABCDE1234F1Z5" },
      ratePercent: 18, cashPaise: 5900, creditPaise: 0,
      breakup: { taxablePaise: 5000, taxPaise: 900, interState: true, lines: [{ label: "IGST @ 18%", paise: 900 }], placeOfSupply: { code: "27", name: "Maharashtra", basis: "buyer_gstin" } },
      takenAt: "2026-10-01T00:00:00.000Z",
    };
    const row = { id: "p1", match_id: "m1", match_ids: null, amount: 5900, currency: "INR", created_at: "2026-10-01T00:00:00Z", razorpay_order_id: "order_1", invoice_no: "HSX-2610-000001", refunded_at: null, requirement_id: null };

    it("returns the stored snapshot and partial refund, and drops a malformed snapshot", async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => [
          { ...row, invoice_snapshot: snapshot, partial_refund_paise: 2000, partial_refund_at: "2026-10-03T00:00:00Z" },
          { ...row, id: "p2", invoice_snapshot: { v: 1, supplier: "nope" } },
        ] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });
      const body = await (await handler(req())).json();
      expect(body.purchases[0].invoiceSnapshot).toEqual(snapshot);
      expect(body.purchases[0].partialRefundPaise).toBe(2000);
      expect(body.purchases[0].partialRefundAt).toBe("2026-10-03T00:00:00Z");
      expect(body.purchases[1].invoiceSnapshot).toBeNull();
      expect(body.purchases[1].partialRefundPaise).toBe(0);
    });

    it("falls back to the 0032 column set when 0045 is not applied, leaving the snapshot null", async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ code: "42703" }) })
        .mockResolvedValueOnce({ ok: true, json: async () => [row] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });
      global.fetch = fetchMock;
      const res = await handler(req());
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(String(fetchMock.mock.calls[0][0])).toContain("invoice_snapshot");
      expect(String(fetchMock.mock.calls[1][0])).not.toContain("invoice_snapshot");
      expect(body.purchases[0]).toMatchObject({ invoiceNo: "HSX-2610-000001", invoiceSnapshot: null, partialRefundPaise: 0 });
    });
  });

  describe("withheld contact", () => {
    const match = (over: Record<string, unknown> = {}) => ({
      id: "m1", candidate_user_id: "c1", candidate_response: null, profiles: { employer_visibility: "on" },
      unlocked_candidate_name: "Priya Sharma", unlocked_candidate_email: "priya@example.com", ...over,
    });
    const run = async (o: { match?: Record<string, unknown>; payRow?: Record<string, unknown>; blocked?: boolean; suspended?: boolean; orderStatus?: string }) => {
      global.fetch = routed({
        employer_unlock_payments: [{ ...PAY_ROW, razorpay_order_id: "order_1", ...o.payRow }],
        requirement_matches: [match(o.match)],
        employer_blocks: o.blocked ? [{ candidate_user_id: "c1" }] : [],
        "select=suspended_at": o.suspended ? [{ suspended_at: "2026-10-05T00:00:00Z" }] : [{ suspended_at: null }],
        employer_unlock_orders: [{ razorpay_order_id: "order_1", status: o.orderStatus ?? "fulfilled" }],
      });
      return (await (await handler(req())).json()).purchases[0].candidates[0];
    };

    it("releases name and email while the candidate is still reachable", async () => {
      expect(await run({})).toEqual({ matchId: "m1", name: "Priya Sharma", email: "priya@example.com" });
    });

    it.each([
      ["withdrew", { match: { profiles: { employer_visibility: "off" } } }],
      ["declined", { match: { candidate_response: "declined" } }],
      ["blocked", { blocked: true }],
      ["suspended", { suspended: true }],
      ["refunded (ledger)", { payRow: { refunded_at: "2026-10-02T00:00:00Z" } }],
      ["refunded (order)", { orderStatus: "refunded" }],
    ])("masks the name and drops the email when the unlock is %s", async (_label, o) => {
      const c = await run(o as Parameters<typeof run>[0]);
      expect(c).toEqual({ matchId: "m1", name: "Candidate #m1", email: null });
    });
  });

  describe("credit notes (migration 0047)", () => {
    it("lists the credit notes issued for each order, oldest first", async () => {
      global.fetch = routed({
        employer_unlock_payments: [{ ...PAY_ROW, razorpay_order_id: "order_1", invoice_no: "HSX-2610-000001" }],
        employer_credit_notes: [
          { order_id: "order_1", amount_paise: 1000, credit_note_no: "CN-2610-000001", created_at: "2026-10-02T00:00:00Z" },
          { order_id: "order_1", amount_paise: 500, credit_note_no: "CN-2610-000002", created_at: "2026-10-03T00:00:00Z" },
        ],
      });
      const body = await (await handler(req())).json();
      expect(body.purchases[0].creditNotes).toEqual([
        { no: "CN-2610-000001", amountPaise: 1000, issuedAt: "2026-10-02T00:00:00Z" },
        { no: "CN-2610-000002", amountPaise: 500, issuedAt: "2026-10-03T00:00:00Z" },
      ]);
    });

    it("returns an empty list (client derives the number) when the table does not exist yet", async () => {
      global.fetch = routed({
        employer_unlock_payments: [{ ...PAY_ROW, razorpay_order_id: "order_1" }],
        employer_credit_notes: () => ({ ok: false, status: 404, body: { code: "42P01" } }),
      });
      const res = await handler(req());
      expect(res.status).toBe(200);
      expect((await res.json()).purchases[0].creditNotes).toEqual([]);
    });
  });

  it("500s when the primary purchase list query itself fails", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 500 });
    const res = await handler(req());
    expect(res.status).toBe(500);
  });
});
