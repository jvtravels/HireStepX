/* Audit fixes on the employer unlock payment path that need no credit ledger:
 *  - refund webhooks keyed on the refund entity (two partial refunds, replays) incl. the real handler's dedup
 *  - one numbered credit note per refund (migration 0047) and graceful behaviour before it is applied
 *  - a refund that arrives before the capture; a capture that arrives after the refund
 *  - non-INR payments
 *  - contact withheld on a fulfilment replay
 *  - ops alerts (rate limited, never blocking) from the helper and from the real webhook handler
 *  - tax / invoice cosmetics (SGST never above CGST, credit note rendered from its own row, IST dates) */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FakeUnlockDb, HEADERS, SUPABASE, match, order, fakeRazorpay, combineFetch } from "./unlockTestUtils";
import type { NotifyInput } from "../../server-handlers/_notify";

// The webhook handler reads its secrets at module load.
const WEBHOOK_SECRET = "whsec_audit_test";
vi.hoisted(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_audit_test";
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

const redisPipeline = vi.fn(async (..._a: unknown[]): Promise<unknown> => null);
vi.mock("../../server-handlers/_shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../server-handlers/_shared")>();
  return {
    ...actual,
    slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
    redisPipeline: (...a: unknown[]) => redisPipeline(...a),
    supabaseUrl: () => "https://example.supabase.co",
    supabaseServiceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key" }),
  };
});
const captureServerEvent = vi.fn();
const captureServerException = vi.fn(async (..._a: unknown[]) => {});
vi.mock("../../server-handlers/_posthog", () => ({
  captureServerEvent: (...a: unknown[]) => captureServerEvent(...a),
  captureServerException: (...a: unknown[]) => captureServerException(...a),
}));
const sendOpsAlert = vi.fn(async (..._a: unknown[]) => {});
vi.mock("../../server-handlers/_ops-alert", () => ({ sendOpsAlert: (...a: unknown[]) => sendOpsAlert(...a) }));

const { fulfillUnlockOrder, alertUnlockProblem } = await import("../../server-handlers/_unlock-fulfillment");
const { handleEmployerUnlockWebhook } = await import("../../server-handlers/_employer-unlock-webhook");
const { default: webhookHandler } = await import("../../server-handlers/razorpay-webhook");
const { slog } = await import("../../server-handlers/_shared");
const tax = await import("../../server-handlers/_unlock-tax");
import { buildInvoiceHtml, type InvoiceInput } from "../employer/_invoiceHtml";
import type { UnlockWebhookEvent } from "../../server-handlers/_employer-unlock-webhook";

const NOW = new Date("2026-10-10T09:00:00.000Z");
const PAY = { id: "pay_1", status: "captured", currency: "INR", amount: 5900, orderId: "order_1" };

let db: FakeUnlockDb;
const notifyImpl = vi.fn(async (_i: NotifyInput) => {});

const fulfil = (over: Partial<Parameters<typeof fulfillUnlockOrder>[0]> = {}) =>
  fulfillUnlockOrder({
    supabaseUrl: SUPABASE, headers: HEADERS, razorpayOrderId: "order_1", payment: PAY,
    fetchImpl: db.fetch as typeof fetch, notifyImpl, now: () => NOW, ...over,
  });
function hook(eventType: string, event: UnlockWebhookEvent, over: Partial<Parameters<typeof handleEmployerUnlockWebhook>[0]> = {}) {
  return handleEmployerUnlockWebhook({
    eventType, event, supabaseUrl: SUPABASE, headers: HEADERS, fetchImpl: db.fetch as typeof fetch, notifyImpl,
    now: () => new Date("2026-10-10T10:00:00.000Z"), ...over,
  });
}
const refundEvent = (refundId: string, amount: number, paymentExtra: Record<string, unknown> = {}): UnlockWebhookEvent => ({
  payload: { refund: { entity: { id: refundId, payment_id: "pay_1", amount } }, payment: { entity: { id: "pay_1", amount: 5900, order_id: "order_1", ...paymentExtra } } },
});
const capturedEvent = (entity: Record<string, unknown> = {}): UnlockWebhookEvent => ({
  payload: { payment: { entity: { id: "pay_1", status: "captured", currency: "INR", amount: 5900, order_id: "order_1", notes: {}, ...entity } } },
});

beforeEach(() => {
  db = new FakeUnlockDb().seed({ orders: [order()], matches: [match("m1")] });
  db.employers.set("emp-1", { company_name: "Acme", billing_name: "Acme Pvt Ltd", gstin: "27AAPFU0939F1ZV" });
  db.applied0045 = true;
  db.applied0047 = true;
  notifyImpl.mockClear();
  captureServerEvent.mockClear();
  captureServerException.mockClear();
  sendOpsAlert.mockClear();
  redisPipeline.mockReset();
  redisPipeline.mockResolvedValue(null);
  vi.mocked(slog.error).mockClear();
  vi.mocked(slog.warn).mockClear();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

/* ── credit notes: one numbered row per refund ── */

describe("refund webhooks: one credit note per refund entity", () => {
  it("two partial refunds with distinct refund ids produce two notes with distinct numbers", async () => {
    await fulfil();
    await hook("refund.processed", refundEvent("rfnd_A", 1000, { amount_refunded: 1000 }));
    await hook("refund.processed", refundEvent("rfnd_B", 900, { amount_refunded: 1900 }));
    expect(db.creditNotes.map((c) => [c.refund_id, c.amount_paise])).toEqual([["rfnd_A", 1000], ["rfnd_B", 900]]);
    expect(new Set(db.creditNotes.map((c) => c.credit_note_no)).size).toBe(2);
    expect(db.orders.get("order_1")?.status).toBe("fulfilled");
    expect(db.ledger[0].partial_refund_paise).toBe(1900);
  });

  it("refund.created then refund.processed for the same refund id is one note", async () => {
    await fulfil();
    await hook("refund.created", refundEvent("rfnd_A", 1000, { amount_refunded: 1000 }));
    await hook("refund.processed", refundEvent("rfnd_A", 1000, { amount_refunded: 1000 }));
    expect(db.creditNotes).toHaveLength(1);
  });

  it("the refund that completes the order gets a note for its own amount (no credit was spent here)", async () => {
    await fulfil();
    await hook("refund.processed", refundEvent("rfnd_FULL", 5900, { amount_refunded: 5900 }));
    expect(db.orders.get("order_1")?.status).toBe("refunded");
    expect(db.creditNotes).toEqual([expect.objectContaining({ refund_id: "rfnd_FULL", amount_paise: 5900 })]);
  });

  it("is harmless before migration 0047 is applied: the refund is still recorded and answered 200", async () => {
    db.applied0047 = false;
    await fulfil();
    const r = await hook("refund.processed", refundEvent("rfnd_A", 1000, { amount_refunded: 1000 }));
    expect(r).toMatchObject({ handled: true, status: 200, body: { unlock_refund: "partial_ignored" } });
    expect(db.creditNotes).toHaveLength(0);
    expect(db.ledger[0].partial_refund_paise).toBe(1000);
  });
});

describe("a refund that beats the capture", () => {
  it("adopts the payment id from the refund event's payment entity, then processes the refund", async () => {
    // Fresh 'created' order, no payment recorded yet.
    expect(db.orders.get("order_1")?.razorpay_payment_id).toBeNull();
    const r = await hook("refund.processed", refundEvent("rfnd_A", 5900, { amount_refunded: 5900 }));
    expect(r).toMatchObject({ handled: true, status: 200, body: { unlock_refund: "refund.processed" } });
    expect(db.orders.get("order_1")).toMatchObject({ status: "refunded", razorpay_payment_id: "pay_1" });
    expect(db.creditNotes).toHaveLength(1);
  });

  it("the capture that arrives afterwards unlocks nothing (the order is already refunded)", async () => {
    await hook("refund.processed", refundEvent("rfnd_A", 5900, { amount_refunded: 5900 }));
    const r = await hook("payment.captured", capturedEvent());
    expect(r).toMatchObject({ handled: true, body: { skipped: "unlock_order_refunded" } });
    expect(db.matches.get("m1")?.unlocked).toBe(false);
    expect(db.ledger).toHaveLength(0);
  });

  it("a partial refund before the capture is recorded once the capture has created the ledger row", async () => {
    const r = await hook("refund.processed", refundEvent("rfnd_A", 1000, { amount_refunded: 1000 }));
    expect(r).toMatchObject({ handled: true, body: { unlock_refund: "partial_ignored" } });
    expect(db.orders.get("order_1")?.razorpay_payment_id).toBe("pay_1");
    expect(db.creditNotes).toHaveLength(1);
  });

  it("is not claimed when the payment belongs to a different (non unlock) order", async () => {
    const r = await hook("refund.processed", refundEvent("rfnd_A", 100, { order_id: "order_not_ours" }));
    expect(r).toEqual({ handled: false });
  });

  it("is not claimed when the order already has a different payment", async () => {
    db.orders.get("order_1")!.razorpay_payment_id = "pay_other";
    const r = await hook("refund.processed", refundEvent("rfnd_A", 100));
    expect(r).toEqual({ handled: false });
  });
});

describe("captured after refund, via the live Razorpay view", () => {
  const creds = { razorpayKeyId: "k", razorpayKeySecret: "s" };
  const live = (over: Record<string, unknown> = {}) => ({ id: "pay_1", status: "captured", currency: "INR", amount: 5900, order_id: "order_1", ...over });

  it("a stale payload says nothing about a refund, Razorpay says it is fully refunded: order closed, nothing unlocked", async () => {
    const fetchImpl = combineFetch(db, fakeRazorpay({ payments: [live({ refund_status: "full", amount_refunded: 5900 })] }));
    const r = await hook("payment.captured", capturedEvent(), { ...creds, fetchImpl });
    expect(r).toMatchObject({ handled: true, status: 200, body: { skipped: "unlock_order_refunded" } });
    expect(db.orders.get("order_1")?.status).toBe("refunded");
    expect(db.matches.get("m1")?.unlocked).toBe(false);
    expect(db.ledger).toHaveLength(0);
  });

  it("asks Razorpay to redeliver (500) when the live payment cannot be fetched", async () => {
    const fetchImpl = combineFetch(db, fakeRazorpay({ payments: [] }));
    const r = await hook("payment.captured", capturedEvent(), { ...creds, fetchImpl });
    expect(r).toMatchObject({ handled: true, status: 500, retry: true });
    expect(db.orders.get("order_1")?.status).toBe("created");
  });

  it("fulfils from the live view when it is not refunded", async () => {
    const fetchImpl = combineFetch(db, fakeRazorpay({ payments: [live()] }));
    const r = await hook("payment.captured", capturedEvent(), { ...creds, fetchImpl });
    expect(r).toMatchObject({ handled: true, status: 200, body: { unlock: "fulfilled", unlocked: 1 } });
  });

  it("a non-INR payment is rejected: nothing unlocked and ops alerted", async () => {
    redisPipeline.mockResolvedValue(["OK"]);
    const r = await hook("payment.captured", capturedEvent({ currency: "USD" }));
    expect(r).toMatchObject({ handled: true, status: 200, body: { skipped: "unlock_currency_mismatch" } });
    expect(db.matches.get("m1")?.unlocked).toBe(false);
    expect(db.ledger).toHaveLength(0);
    expect(sendOpsAlert).toHaveBeenCalledTimes(1);
  });

  it("a payment entity with no currency at all is rejected, not waved through", async () => {
    redisPipeline.mockResolvedValue(["OK"]);
    const r = await hook("payment.captured", capturedEvent({ currency: undefined }));
    expect(r).toMatchObject({ handled: true, status: 200, body: { skipped: "unlock_currency_mismatch" } });
    expect(db.matches.get("m1")?.unlocked).toBe(false);
    expect(db.ledger).toHaveLength(0);
  });

  it("the live currency is what counts, not the payload's", async () => {
    const fetchImpl = combineFetch(db, fakeRazorpay({ payments: [live({ currency: "USD" })] }));
    const r = await hook("payment.captured", capturedEvent(), { ...creds, fetchImpl });
    expect(r).toMatchObject({ body: { skipped: "unlock_currency_mismatch" } });
  });
});

/* ── contact withheld on replay ── */

describe("a fulfilment replay never re-exposes a candidate who has since opted out", () => {
  const replayCandidate = async () => {
    const r = await fulfil();
    if (r.kind !== "fulfilled") throw new Error(`expected fulfilled, got ${r.kind}`);
    return r.candidates[0];
  };

  it("first fulfilment shows the real contact; an untouched replay still does", async () => {
    const first = await replayCandidate();
    expect(first).toMatchObject({ name: "Name m1", email: "m1@example.com" });
    expect(first.withheld).toBeUndefined();
    expect(await replayCandidate()).toMatchObject({ email: "m1@example.com" });
  });

  it.each([
    ["withdrew", (d: FakeUnlockDb) => { d.matches.get("m1")!.profiles!.employer_visibility = "off"; }],
    ["declined", (d: FakeUnlockDb) => { d.matches.get("m1")!.candidate_response = "declined"; }],
    ["blocked", (d: FakeUnlockDb) => { d.blockedCandidates.add("cand-m1"); }],
    ["employer_suspended", (d: FakeUnlockDb) => { d.employers.get("emp-1")!.suspended_at = "2026-10-09T00:00:00Z"; }],
  ])("%s: masked name, no email, `withheld` set", async (reason, mutate) => {
    await fulfil();
    mutate(db);
    const again = await replayCandidate();
    expect(again).toMatchObject({ matchId: "m1", email: null, withheld: reason });
    expect(again.name).toMatch(/^Candidate #?/);
    expect(again.name).not.toContain("Name m1");
  });
});

/* ── alerts ── */

describe("alertUnlockProblem", () => {
  const args = (key: string) => ({ kind: "unlock_not_fulfilled", key, subject: "Payment captured but not fulfilled", detail: `order ${key}`, distinctId: "emp-1" });

  it("reports to PostHog and the ops channel, once per key per hour", async () => {
    await alertUnlockProblem(args("order_a1"));
    await alertUnlockProblem(args("order_a1"));
    expect(captureServerException).toHaveBeenCalledTimes(1);
    expect(sendOpsAlert).toHaveBeenCalledTimes(1);
    expect(sendOpsAlert).toHaveBeenCalledWith("Payment captured but not fulfilled", "order order_a1");
    await alertUnlockProblem(args("order_a2"));
    expect(sendOpsAlert).toHaveBeenCalledTimes(2);
  });

  it("claims the slot in Redis (SET NX EX 3600) and stays quiet when another instance already did", async () => {
    redisPipeline.mockResolvedValueOnce(["OK"]).mockResolvedValueOnce([null]);
    await alertUnlockProblem(args("order_r1"));
    await alertUnlockProblem(args("order_r1"));
    expect(redisPipeline).toHaveBeenCalledWith([["SET", "opsalert:unlock_not_fulfilled:order_r1", "1", "NX", "EX", 3600]]);
    expect(sendOpsAlert).toHaveBeenCalledTimes(1);
  });

  it("falls back to the per-instance guard when Redis throws", async () => {
    redisPipeline.mockRejectedValue(new Error("redis down"));
    await alertUnlockProblem(args("order_f1"));
    await alertUnlockProblem(args("order_f1"));
    expect(sendOpsAlert).toHaveBeenCalledTimes(1);
  });

  it("never throws when a channel fails", async () => {
    sendOpsAlert.mockRejectedValueOnce(new Error("slack down"));
    captureServerException.mockRejectedValueOnce(new Error("posthog down"));
    await expect(alertUnlockProblem(args("order_e1"))).resolves.toBeUndefined();
  });

  it("does not block the caller for more than about a second when the channels hang", async () => {
    vi.useFakeTimers();
    sendOpsAlert.mockImplementationOnce(() => new Promise<void>(() => {}));
    let settled = false;
    const p = alertUnlockProblem(args("order_h1")).then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(400);
    await p;
    expect(settled).toBe(true);
  });
});

/* ── the real webhook handler ── */

function mockRes() {
  const res = {
    statusCode: 200, body: undefined as unknown, headersSent: false,
    status(c: number) { res.statusCode = c; return res; },
    json(b: unknown) { res.body = b; return res; },
    setHeader() { return res; },
  };
  return res as unknown as VercelResponse & typeof res;
}
const signed = (body: object, secret = WEBHOOK_SECRET) => {
  const raw = JSON.stringify(body);
  return { raw, sig: createHmac("sha256", secret).update(raw).digest("hex") };
};
const post = (body: object, secret = WEBHOOK_SECRET) => {
  const { raw, sig } = signed(body, secret);
  return { method: "POST", headers: { "x-razorpay-signature": sig, "x-forwarded-for": "9.9.9.9" }, body: raw } as unknown as VercelRequest;
};

describe("razorpay-webhook handler", () => {
  beforeEach(() => {
    // The handler uses the global fetch for Supabase; no Razorpay creds are configured so it does not re-fetch.
    vi.stubGlobal("fetch", ((i: RequestInfo | URL, init?: RequestInit) => db.fetch(i, init)) as typeof fetch);
  });

  it("a signature mismatch answers 400 and alerts ops (once for repeated hits from one source)", async () => {
    const res = mockRes();
    await webhookHandler(post({ event: "payment.captured" }, "wrong-secret"), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Invalid signature" });
    expect(sendOpsAlert).toHaveBeenCalledWith("Razorpay webhook signature mismatch", expect.stringContaining("RAZORPAY_WEBHOOK_SECRET"));
    expect(captureServerException).toHaveBeenCalledTimes(1);

    await webhookHandler(post({ event: "payment.captured" }, "wrong-secret"), mockRes());
    expect(sendOpsAlert).toHaveBeenCalledTimes(1);
  });

  it("two partial refunds on one payment are both processed; only a redelivery of the same refund id is a duplicate", async () => {
    await fulfil();
    const evt = (id: string, amount: number, total: number) => ({
      event: "refund.processed", entity: "event",
      payload: refundEvent(id, amount, { amount_refunded: total }).payload,
    });
    const r1 = mockRes(); await webhookHandler(post(evt("rfnd_H1", 1000, 1000)), r1);
    const r2 = mockRes(); await webhookHandler(post(evt("rfnd_H2", 900, 1900)), r2);
    const r3 = mockRes(); await webhookHandler(post(evt("rfnd_H1", 1000, 1000)), r3);
    expect(r1.body).toMatchObject({ unlock_refund: "partial_ignored" });
    expect(r2.body).toMatchObject({ unlock_refund: "partial_ignored" });
    expect(r3.body).toEqual({ received: true, skipped: "duplicate" });
    expect(db.creditNotes.map((c) => c.refund_id)).toEqual(["rfnd_H1", "rfnd_H2"]);
  });

  it("a captured payment rejected as unfixable (amount mismatch) answers 200 but alerts ops", async () => {
    redisPipeline.mockResolvedValue(["OK"]);
    const res = mockRes();
    await webhookHandler(post({
      event: "payment.captured", payload: { payment: { entity: { id: "pay_mm", status: "captured", currency: "INR", amount: 100, order_id: "order_1", notes: {} } } },
    }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ skipped: "unlock_amount_mismatch" });
    expect(sendOpsAlert).toHaveBeenCalledWith("Payment captured but not fulfilled", expect.stringContaining("amount_mismatch"));
  });

  it("a fulfilment that hits a database error answers 500 (so Razorpay redelivers) and alerts ops", async () => {
    redisPipeline.mockResolvedValue(["OK"]);
    db.failWhen = (m, url) => m === "PATCH" && url.includes("requirement_matches");
    const res = mockRes();
    await webhookHandler(post({
      event: "payment.captured", payload: { payment: { entity: { id: "pay_db", status: "captured", currency: "INR", amount: 5900, order_id: "order_1", notes: {} } } },
    }), res);
    expect(res.statusCode).toBe(500);
    expect(sendOpsAlert).toHaveBeenCalledWith("Payment captured but not fulfilled", expect.stringContaining("order_1"));
    expect(db.orders.get("order_1")?.status).toBe("paid");
  });

  it("an alert channel failing never changes the response", async () => {
    sendOpsAlert.mockRejectedValue(new Error("slack down"));
    const res = mockRes();
    await webhookHandler(post({ event: "payment.captured" }, "wrong-secret"), res);
    expect(res.statusCode).toBe(400);
    sendOpsAlert.mockResolvedValue(undefined);
  });
});

/* ── tax and invoice cosmetics ── */

describe("GST split", () => {
  it("SGST is never larger than CGST and the two always sum to the tax (an odd paisa lands on CGST)", () => {
    let sawOdd = false;
    for (let total = 1; total <= 3000; total++) {
      const b = tax.gstBreakup(total, "27AAPFU0939F1ZV", "27AAPFU0939F1ZV");
      const [cgst, sgst] = b.lines;
      expect(cgst.paise + sgst.paise).toBe(b.taxPaise);
      expect(sgst.paise).toBeLessThanOrEqual(cgst.paise);
      if (cgst.paise !== sgst.paise) { sawOdd = true; expect(cgst.paise - sgst.paise).toBe(1); }
    }
    expect(sawOdd).toBe(true);
  });
});

describe("credit note rendering", () => {
  const base: InvoiceInput = {
    invoiceNo: "HSX-2610-000001", createdAt: "2026-10-05T10:00:00Z", orderId: "order_1", candidateNames: [], candidateCount: 1,
    cashPaise: 5900, creditPaise: 0, refunded: false,
    supplier: { name: "HireStepX Pvt Ltd", address: "Pune", gstin: "29AABCT1332L1ZA", sac: "998439" },
    buyer: { companyName: "Acme", billingName: "", gstin: "27AAPFU0939F1ZV" },
  };

  it("renders the numbered credit note row: its number, amount and date win over the derived ones", () => {
    const html = buildInvoiceHtml({
      ...base, document: "credit_note", partialRefundPaise: 2950, refundedAt: null,
      creditNote: { no: "CN-2610-000042", amountPaise: 1000, issuedAt: "2026-10-07T10:00:00Z" },
    });
    expect(html).toContain("No. CN-2610-000042");
    expect(html).toContain("&minus;₹10");
    expect(html).not.toContain("&minus;₹29.50");
    expect(html).not.toContain("CND-2610-000001");
    expect(html).toMatch(/7 Oct(ober)? 2026/);
  });

  it("falls back to the derived number when there is no credit note row (legacy refunds)", () => {
    const html = buildInvoiceHtml({ ...base, document: "credit_note", partialRefundPaise: 2950, partialRefundAt: "2026-10-07T00:00:00Z" });
    expect(html).toContain("No. CND-2610-000001");
    expect(html).toContain("&minus;₹29.50");
  });

  it("dates a document in IST: 20:00 UTC on 31 Oct is already 1 Nov in India", () => {
    const html = buildInvoiceHtml({ ...base, createdAt: "2026-10-31T20:00:00Z" });
    expect(html).toMatch(/1 Nov(ember)? 2026/);
    expect(html).not.toMatch(/31 Oct(ober)? 2026/);
  });
});
