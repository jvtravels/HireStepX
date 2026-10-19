/* Money/credit integration across the unlock payment path: credit verified at
 * fulfilment (incl. late payments), the partial cash share returned as credit,
 * clawback on refunds/disputes, the receipt email, and the reconciler's credit
 * release. A stateful credit-ledger fake sits in front of FakeUnlockDb. */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FakeUnlockDb, HEADERS, SUPABASE, match, order, fakeRazorpay, type FakeOrder } from "./unlockTestUtils";
import type { NotifyInput } from "../../server-handlers/_notify";

vi.mock("../../server-handlers/_shared", () => ({
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  supabaseUrl: () => "https://example.supabase.co",
  supabaseServiceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key" }),
}));
const captureServerEvent = vi.fn();
vi.mock("../../server-handlers/_posthog", () => ({ captureServerEvent: (...a: unknown[]) => captureServerEvent(...a) }));

const { fulfillUnlockOrder } = await import("../../server-handlers/_unlock-fulfillment");
const { handleEmployerUnlockWebhook } = await import("../../server-handlers/_employer-unlock-webhook");
const { reconcileUnlockOrders } = await import("../../server-handlers/_employer-unlock-reconcile");
const { creditRefundForMatches, clawbackRefundOverlap } = await import("../../server-handlers/_employer-credit");
const { buildReceiptEmail, hasSupplierGstin } = await import("../../server-handlers/_unlock-receipt-email");
const { slog } = await import("../../server-handlers/_shared");

interface LedgerRow {
  employer_id: string; amount: number; kind: string; reason?: string | null; match_id?: string | null; order_ref?: string | null; created_at: string;
}
const json = (body: unknown, status = 200) => (status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status }));

/** employer_credit_ledger + spend RPC with the real unique indexes (refund per match and order, one row per kind+ref, one adjustment per ref). */
class FakeCredit {
  rows: LedgerRow[] = [];
  /** Simulates migration 0042 not applied: clawback/conversion hit the old check constraint. */
  oldConstraint = false;
  resend: Array<{ headers: Record<string, string>; body: { to: string[]; subject: string; html: string } }> = [];
  emailOnFile: string | null = "boss@acme.test";

  balance(employer = "emp-1") { return this.rows.filter((r) => r.employer_id === employer).reduce((s, r) => s + r.amount, 0); }
  ofKind(kind: string) { return this.rows.filter((r) => r.kind === kind); }

  wrap(db: FakeUnlockDb): typeof fetch {
    return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = String(input);
      const method = (init?.method || "GET").toUpperCase();
      if (url.startsWith("https://api.resend.com/")) {
        const body = JSON.parse(String(init?.body));
        // The candidate "employer is interested" mail is not the buyer's receipt.
        if (!String(body.subject).startsWith("An employer is interested")) this.resend.push({ headers: (init?.headers ?? {}) as Record<string, string>, body });
        return json({ id: "em_1" });
      }
      if (!url.startsWith(SUPABASE)) return json({}, 404);
      const u = new URL(url);
      const path = u.pathname;
      const q = u.searchParams;
      if (path.endsWith("/rpc/spend_employer_credit")) {
        const b = JSON.parse(String(init?.body)) as { p_employer: string; p_amount: number; p_order_ref: string };
        const prior = this.rows.find((r) => r.kind === "spend" && r.order_ref === b.p_order_ref);
        if (prior) return json(-prior.amount);
        if (this.balance(b.p_employer) < b.p_amount) return json(0);
        this.rows.push({ employer_id: b.p_employer, amount: -b.p_amount, kind: "spend", order_ref: b.p_order_ref, created_at: new Date().toISOString() });
        return json(b.p_amount);
      }
      if (path.endsWith("/rest/v1/employer_credit_ledger")) {
        if (method === "POST") {
          const b = JSON.parse(String(init?.body)) as LedgerRow;
          if (this.oldConstraint && (b.kind === "clawback" || b.kind === "conversion")) {
            return new Response('new row violates check constraint "employer_credit_ledger_kind_check" 23514', { status: 400 });
          }
          const dup = this.rows.some((r) =>
            (b.kind === "refund" && r.kind === "refund" && r.match_id === b.match_id && r.order_ref === b.order_ref) ||
            (["spend", "release"].includes(b.kind) && r.kind === b.kind && r.order_ref === b.order_ref) ||
            (["clawback", "conversion"].includes(b.kind) && ["clawback", "conversion"].includes(r.kind) && r.order_ref === b.order_ref));
          if (dup) return json({ code: "23505" }, 409);
          this.rows.push({ ...b, created_at: new Date().toISOString() });
          return json(null, 201);
        }
        let rows = [...this.rows];
        const emp = q.get("employer_id");
        if (emp?.startsWith("eq.")) rows = rows.filter((r) => r.employer_id === emp.slice(3));
        const kind = q.get("kind");
        if (kind?.startsWith("in.(")) { const ks = kind.slice(4, -1).split(","); rows = rows.filter((r) => ks.includes(r.kind)); }
        else if (kind?.startsWith("eq.")) rows = rows.filter((r) => r.kind === kind.slice(3));
        const ref = q.get("order_ref");
        if (ref?.startsWith("in.(")) { const refs = [...ref.matchAll(/"([^"]+)"/g)].map((m) => m[1]); rows = rows.filter((r) => r.order_ref && refs.includes(r.order_ref)); }
        if (ref?.startsWith("eq.")) rows = rows.filter((r) => r.order_ref === ref.slice(3));
        if (ref?.startsWith("like.")) { const prefix = decodeURIComponent(ref.slice(5)).replace(/\*$/, ""); rows = rows.filter((r) => !!r.order_ref && r.order_ref.startsWith(prefix)); }
        const reason = q.get("reason");
        if (reason?.startsWith("in.(")) { const rs = reason.slice(4, -1).split(","); rows = rows.filter((r) => !!r.reason && rs.includes(r.reason)); }
        const mid = q.get("match_id");
        if (mid?.startsWith("eq.")) rows = rows.filter((r) => r.match_id === mid.slice(3));
        if (mid?.startsWith("in.(")) { const ms = mid.slice(4, -1).split(",").map(decodeURIComponent); rows = rows.filter((r) => !!r.match_id && ms.includes(r.match_id)); }
        return json(rows);
      }
      if (path.endsWith("/rest/v1/profiles")) return json(this.emailOnFile ? [{ email: this.emailOnFile }] : []);
      if (path.endsWith("/rest/v1/employers")) return db.employers.size > 0 ? db.fetch(input, init) : json([{ company_name: "Acme" }]);
      if (path.endsWith("/rest/v1/conversations")) return json([]);
      if (path.endsWith("/rest/v1/employer_unlock_payments") && q.get("created_at") && !q.get("invoice_no")) return json([]);
      return db.fetch(input, init);
    }) as typeof fetch;
  }
}

const PAY = { id: "pay_1", status: "captured", currency: "INR", amount: 5900, orderId: "order_1" };
const NOW = new Date("2026-10-10T09:00:00.000Z");
type Partial3 = Partial<Parameters<typeof fulfillUnlockOrder>[0]>;

let db: FakeUnlockDb;
let credit: FakeCredit;
let notifyImpl: ReturnType<typeof vi.fn<(i: NotifyInput) => Promise<void>>>;

const creditOrder = (over: Partial<FakeOrder> & { credit_applied_paise?: number } = {}): FakeOrder => Object.assign(order(), over);
const fulfil = (over: Partial3 = {}) =>
  fulfillUnlockOrder({ supabaseUrl: SUPABASE, headers: HEADERS, razorpayOrderId: "order_1", payment: PAY, fetchImpl: credit.wrap(db), notifyImpl, now: () => NOW, ...over });

beforeEach(() => {
  db = new FakeUnlockDb();
  credit = new FakeCredit();
  notifyImpl = vi.fn(async () => {});
  captureServerEvent.mockClear();
  vi.mocked(slog.error).mockClear();
  vi.mocked(slog.warn).mockClear();
  delete process.env.RESEND_API_KEY;
  delete process.env.NEXT_PUBLIC_LEGAL_GSTIN;
});
afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.NEXT_PUBLIC_LEGAL_GSTIN;
});

const spentRow = (ref: string, amount: number): LedgerRow => ({ employer_id: "emp-1", amount: -amount, kind: "spend", order_ref: ref, created_at: "2026-10-09T00:00:00Z" });
const releaseRow = (ref: string, amount: number): LedgerRow => ({ employer_id: "emp-1", amount, kind: "release", order_ref: ref, created_at: "2026-10-09T01:00:00Z" });
const topUp = (amount: number): LedgerRow => ({ employer_id: "emp-1", amount, kind: "refund", reason: "declined", match_id: `seed-${amount}`, order_ref: "seed", created_at: "2026-10-01T00:00:00Z" });

describe("fulfilment verifies the credit the order was priced with", () => {
  it("passes through when the credit is still spent", async () => {
    db.seed({ orders: [creditOrder({ amount: 3900, credit_applied_paise: 2000 })], matches: [match("m1")] });
    credit.rows.push(spentRow("order_1", 2000));
    const r = await fulfil({ payment: { ...PAY, amount: 3900 } });
    expect(r.kind).toBe("fulfilled");
    expect(credit.rows.filter((x) => x.kind === "spend")).toHaveLength(1);
  });

  it("re-spends credit the reconciler released before a late payment arrived (ref :late) and fulfils", async () => {
    db.seed({ orders: [creditOrder({ status: "expired", amount: 3900, credit_applied_paise: 2000 })], matches: [match("m1")] });
    credit.rows.push(topUp(5000), spentRow("order_1", 2000), releaseRow("order_1", 2000));
    const r = await fulfil({ payment: { ...PAY, amount: 3900 } });
    expect(r.kind).toBe("fulfilled");
    expect(credit.rows.find((x) => x.kind === "spend" && x.order_ref === "order_1:late")?.amount).toBe(-2000);
    expect(db.matches.get("m1")?.unlocked).toBe(true);
  });

  it("when the credit can no longer be covered the cash becomes credit and no candidate is exposed", async () => {
    db.seed({ orders: [creditOrder({ status: "expired", amount: 3900, credit_applied_paise: 2000 })], matches: [match("m1")] });
    credit.rows.push(spentRow("order_1", 2000), releaseRow("order_1", 2000));
    const r = await fulfil({ payment: { ...PAY, amount: 3900 } });
    expect(r).toMatchObject({ kind: "converted_to_credit", creditPaise: 3900 });
    expect(db.matches.get("m1")?.unlocked).toBe(false);
    expect(db.orders.get("order_1")?.status).toBe("refunded");
    expect(credit.ofKind("conversion")).toEqual([expect.objectContaining({ amount: 3900, reason: "late_payment", order_ref: "order_1:convert" })]);
    expect(credit.balance()).toBe(3900);
    expect(notifyImpl).toHaveBeenCalledWith(expect.objectContaining({ type: "credit_refunded" }));
    expect(captureServerEvent).toHaveBeenCalledWith("employer_unlock_failed", "emp-1", expect.objectContaining({ reason: "late_payment_credit_unavailable" }));
  });

  it("a replayed webhook for a converted order is a no-op (no second conversion)", async () => {
    db.seed({ orders: [creditOrder({ status: "expired", amount: 3900, credit_applied_paise: 2000 })], matches: [match("m1")] });
    credit.rows.push(spentRow("order_1", 2000), releaseRow("order_1", 2000));
    await fulfil({ payment: { ...PAY, amount: 3900 } });
    const again = await fulfil({ payment: { ...PAY, amount: 3900 } });
    expect(again.kind).toBe("refunded");
    expect(credit.ofKind("conversion")).toHaveLength(1);
  });

  it("asks for a retry (db_error) rather than fulfilling when the credit state cannot be read", async () => {
    db.seed({ orders: [creditOrder({ amount: 3900, credit_applied_paise: 2000 })], matches: [match("m1")] });
    const f = credit.wrap(db);
    const flaky = ((input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes("kind=in.(spend,release)") ? Promise.resolve(json({}, 500)) : f(input, init)) as typeof fetch;
    const r = await fulfil({ payment: { ...PAY, amount: 3900 }, fetchImpl: flaky });
    expect(r).toMatchObject({ kind: "error", code: "db_error" });
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("does not block legacy orders that have no stored credit_applied_paise", async () => {
    db.seed({ orders: [order({ amount: 3900 })], matches: [match("m1")] });
    expect((await fulfil({ payment: { ...PAY, amount: 3900 } })).kind).toBe("fulfilled");
  });
});

describe("partial fulfilment returns the cash share as credit", () => {
  const seedPartial = () => db.seed({
    orders: [order({ mode: "batch", match_ids: ["m1", "m2", "m3", "m4"], amount: 11960 })],
    matches: [
      match("m1"),
      match("m2", { profiles: { name: "B", email: "b@x.com", employer_visibility: "off" } }),
      match("m3"),
    ],
  });

  it("credits every unavailable candidate's share, persists refund_due_paise and says so in the notification", async () => {
    seedPartial();
    db.blockedCandidates.add("cand-m3");
    const r = await fulfil({ payment: { ...PAY, amount: 11960 } });
    expect(r.kind).toBe("partial");
    if (r.kind !== "partial") return;
    expect(r.returnedCreditPaise).toBe(2990 * 3);
    expect(credit.ofKind("refund").map((x) => [x.match_id, x.amount, x.reason])).toEqual([["m2", 2990, "unavailable"], ["m3", 2990, "unavailable"], ["m4", 2990, "unavailable"]]);
    expect((db.orders.get("order_1") as FakeOrder & { refund_due_paise?: number }).refund_due_paise).toBe(8970);
    expect(notifyImpl.mock.calls.find(([i]) => i.type === "unlock_confirmed")?.[0].body).toContain("added to your account credit");
    expect(captureServerEvent).toHaveBeenCalledWith("employer_credit_granted", "emp-1", expect.objectContaining({ reason: "unavailable", amountPaise: 8970 }));
  });

  it("a replay does not credit twice", async () => {
    seedPartial();
    db.blockedCandidates.add("cand-m3");
    await fulfil({ payment: { ...PAY, amount: 11960 } });
    const again = await fulfil({ payment: { ...PAY, amount: 11960 } });
    // The replay reports the credit that was returned (so the buyer's screen is right) but adds no new ledger rows.
    expect(again.kind === "partial" && again.returnedCreditPaise).toBe(8970);
    expect(credit.ofKind("refund")).toHaveLength(3);
  });

  it("falls back to the manual-refund wording when the ledger is unavailable", async () => {
    seedPartial();
    db.blockedCandidates.add("cand-m3");
    const r = await fulfil({ payment: { ...PAY, amount: 11960 }, fetchImpl: db.fetch as typeof fetch });
    expect(r.kind === "partial" && r.returnedCreditPaise).toBe(0);
    expect(notifyImpl.mock.calls[0]?.[0].body).toContain("we will refund that portion");
  });
});

describe("receipt email on fulfilment", () => {
  beforeEach(() => { process.env.RESEND_API_KEY = "re_test"; });

  it("sends one receipt that says it is not a GST tax invoice until a supplier GSTIN is set", async () => {
    db.seed({ orders: [order()], matches: [match("m1")] });
    await fulfil();
    await vi.waitFor(() => expect(credit.resend).toHaveLength(1));
    const mail = credit.resend[0];
    expect(mail.body.to).toEqual(["boss@acme.test"]);
    expect(mail.body.subject).toContain("receipt");
    expect(mail.body.html).toContain("not a GST tax invoice");
    expect(mail.headers["Idempotency-Key"]).toBe("unlock-receipt-pay_1");
  });

  it("calls it a tax invoice once NEXT_PUBLIC_LEGAL_GSTIN is configured", async () => {
    process.env.NEXT_PUBLIC_LEGAL_GSTIN = "29ABCDE1234F1Z5";
    db.seed({ orders: [order()], matches: [match("m1")] });
    await fulfil();
    await vi.waitFor(() => expect(credit.resend).toHaveLength(1));
    expect(credit.resend[0].body.html).not.toContain("not a GST tax invoice");
    expect(credit.resend[0].body.subject).toContain("tax invoice");
  });

  it("does not re-send on a replay, and not for credit-only orders or when nothing was unlocked", async () => {
    db.seed({ orders: [order()], matches: [match("m1")] });
    await fulfil();
    await vi.waitFor(() => expect(credit.resend).toHaveLength(1));
    await fulfil();
    await new Promise((r) => setTimeout(r, 10));
    expect(credit.resend).toHaveLength(1);

    const zero = new FakeUnlockDb().seed({ orders: [order({ razorpay_order_id: "credit_1", amount: 0 })], matches: [match("m1")] });
    await fulfillUnlockOrder({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayOrderId: "credit_1", payment: { id: "credit_1", status: "captured", currency: "INR", amount: 0, orderId: "credit_1" },
      fetchImpl: credit.wrap(zero), notifyImpl, now: () => NOW,
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(credit.resend).toHaveLength(1);
  });

  it("never blocks fulfilment: a missing address or key just skips the email", async () => {
    credit.emailOnFile = null;
    db.seed({ orders: [order()], matches: [match("m1")] });
    expect((await fulfil()).kind).toBe("fulfilled");
    await new Promise((r) => setTimeout(r, 10));
    expect(credit.resend).toHaveLength(0);
  });

  it("buildReceiptEmail shows credit applied only when there was some", () => {
    const base = { employerId: "e", orderId: "o", paymentId: "p", amountPaise: 3900, creditPaise: 2000, candidates: 1, invoiceNo: "HSX-1" };
    expect(buildReceiptEmail(base, { company: "Acme", appUrl: "https://x", taxInvoice: false }).html).toContain("Account credit applied");
    expect(buildReceiptEmail({ ...base, creditPaise: 0 }, { company: null, appUrl: "https://x", taxInvoice: false }).html).not.toContain("Account credit applied");
    expect(hasSupplierGstin()).toBe(false);
    process.env.NEXT_PUBLIC_LEGAL_GSTIN = "29ABCDE1234F1Z5";
    expect(hasSupplierGstin()).toBe(true);
  });
});

describe("webhook: refunds and disputes claw back credit", () => {
  const capturedEvent = {
    payload: { payment: { entity: { id: "pay_1", status: "captured", currency: "INR", amount: 5900, order_id: "order_1" } } },
  };
  const refundEvent = { payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount: 5900 } } } };
  const disputeEvent = { payload: { dispute: { entity: { id: "disp_1", payment_id: "pay_1" } } } };
  const hook = (eventType: string, event: unknown) =>
    handleEmployerUnlockWebhook({
      eventType, event: event as never, supabaseUrl: SUPABASE, headers: HEADERS, fetchImpl: credit.wrap(db), notifyImpl, now: () => NOW,
    });

  beforeEach(async () => {
    db.seed({ orders: [order()], matches: [match("m1")] });
    credit.rows.push(topUp(1000));
    await hook("payment.captured", capturedEvent);
    // the candidate then declined: credit landed and the match was relocked
    credit.rows.push({ employer_id: "emp-1", amount: 5900, kind: "refund", reason: "declined", match_id: "m1", order_ref: "order_1", created_at: "2026-10-11T00:00:00Z" });
    credit.rows.push(spentRow("order_1", 1000));
  });

  it("a full refund reverses the credit the order generated and releases credit spent on it", async () => {
    const r = await hook("refund.processed", refundEvent);
    expect(r).toMatchObject({ handled: true, status: 200, body: { creditClawedBackPaise: 5900 } });
    expect(credit.ofKind("clawback")).toEqual([expect.objectContaining({ amount: -5900, reason: "payment_refunded", order_ref: "clawback:order_1:m1" })]);
    expect(credit.ofKind("release")).toEqual([expect.objectContaining({ amount: 1000, order_ref: "order_1" })]);
    expect(db.orders.get("order_1")?.status).toBe("refunded");
    expect(captureServerEvent).toHaveBeenCalledWith("employer_credit_clawed_back", "emp-1", expect.objectContaining({ amountPaise: 5900, reason: "payment_refunded" }));
  });

  it("refund.created then refund.processed claws back once", async () => {
    await hook("refund.created", refundEvent);
    await hook("refund.processed", refundEvent);
    expect(credit.ofKind("clawback")).toHaveLength(1);
    expect(credit.ofKind("release")).toHaveLength(1);
  });

  it("the balance may go negative (documented debt) when the credit was already spent", async () => {
    credit.rows.push(spentRow("order_other", 5900));
    await hook("refund.processed", refundEvent);
    expect(credit.balance()).toBeLessThan(0);
  });

  it("asks for redelivery and leaves the order un-refunded when the clawback write fails", async () => {
    const f = credit.wrap(db);
    const r = await handleEmployerUnlockWebhook({
      eventType: "refund.processed", event: refundEvent as never, supabaseUrl: SUPABASE, headers: HEADERS, notifyImpl, now: () => NOW,
      fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
        (init?.method === "POST" && String(input).includes("employer_credit_ledger") && String(init.body).includes('"clawback"')
          ? Promise.resolve(json({}, 500))
          : f(input, init))) as typeof fetch,
    });
    expect(r).toMatchObject({ status: 500, retry: true });
    expect(db.orders.get("order_1")?.status).not.toBe("refunded");
  });

  it("with migration 0042 unapplied the refund still completes and logs a manual-reversal error", async () => {
    credit.oldConstraint = true;
    const r = await hook("refund.processed", refundEvent);
    expect(r).toMatchObject({ status: 200 });
    expect(slog.error).toHaveBeenCalledWith(expect.stringContaining("migration 0042"), expect.anything());
  });

  it("a partial refund claws back nothing", async () => {
    await hook("refund.processed", { payload: { refund: { entity: { id: "r", payment_id: "pay_1", amount: 1000 } } } });
    expect(credit.ofKind("clawback")).toHaveLength(0);
  });

  it("dispute.created freezes nothing; dispute.lost claws back credit but keeps credit spent on the order", async () => {
    await hook("payment.dispute.created", disputeEvent);
    expect(credit.ofKind("clawback")).toHaveLength(0);
    const r = await hook("payment.dispute.lost", disputeEvent);
    expect(r).toMatchObject({ status: 200 });
    expect(credit.ofKind("clawback")).toEqual([expect.objectContaining({ amount: -5900, reason: "payment_disputed" })]);
    expect(credit.ofKind("release")).toHaveLength(0);
  });

  it("dispute.won claws back nothing", async () => {
    await hook("payment.dispute.created", disputeEvent);
    await hook("payment.dispute.won", disputeEvent);
    expect(credit.ofKind("clawback")).toHaveLength(0);
  });

  it("a late capture that converted to credit answers 200 with the credit amount", async () => {
    db = new FakeUnlockDb().seed({ orders: [creditOrder({ status: "expired", amount: 5900, credit_applied_paise: 2000 })], matches: [match("m1")] });
    credit = new FakeCredit();
    credit.rows.push(spentRow("order_1", 2000), releaseRow("order_1", 2000));
    const r = await hook("payment.captured", capturedEvent);
    expect(r).toMatchObject({ handled: true, status: 200, body: { unlock: "converted_to_credit", creditPaise: 5900 } });
  });
});

describe("reconciler credit handling", () => {
  const sweep = () =>
    reconcileUnlockOrders({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayKeyId: "k", razorpayKeySecret: "s",
      fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
        (String(input).includes("api.razorpay.com") ? Promise.resolve(json({ items: [] })) : credit.wrap(db)(input, init))) as typeof fetch,
      notifyImpl, now: () => new Date("2026-10-12T12:00:00.000Z"),
    });

  it("expiring an unpaid cash order releases its credit and emits employer_unlock_abandoned", async () => {
    db.seed({ orders: [order({ created_at: "2026-10-10T08:00:00.000Z", amount: 3900 })] });
    credit.rows.push(topUp(2000), spentRow("order_1", 2000));
    const s = await sweep();
    expect(s.expired).toBe(1);
    expect(credit.ofKind("release")).toEqual([expect.objectContaining({ amount: 2000, order_ref: "order_1" })]);
    expect(captureServerEvent).toHaveBeenCalledWith("employer_unlock_abandoned", "emp-1", expect.objectContaining({ orderId: "order_1" }));
  });

  it("releases credit still attached to a recently failed order, once", async () => {
    db.seed({ orders: [order({ status: "failed", amount: 3900 })] });
    credit.rows.push(topUp(2000), spentRow("order_1", 2000));
    const first = await sweep();
    expect(first.creditSwept).toBe(1);
    await sweep();
    expect(credit.ofKind("release")).toHaveLength(1);
    expect(credit.balance()).toBe(2000);
  });
});

describe("reconciler: credit stranded on expired orders", () => {
  const AT = new Date("2026-10-12T12:00:00.000Z");
  const run = (wrap: typeof fetch) =>
    reconcileUnlockOrders({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayKeyId: "k", razorpayKeySecret: "s",
      fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
        (String(input).includes("api.razorpay.com") ? Promise.resolve(json({ items: [] })) : wrap(input, init))) as typeof fetch,
      notifyImpl, now: () => AT,
    });
  const failingReleases = (): typeof fetch => {
    const f = credit.wrap(db);
    return ((input: RequestInfo | URL, init?: RequestInit) =>
      (init?.method === "POST" && String(input).includes("employer_credit_ledger") && String(init.body).includes('"release"')
        ? Promise.resolve(json({ message: "boom" }, 500))
        : f(input, init))) as typeof fetch;
  };

  it("a failed release at expiry is reported as an error, and the next sweep releases the credit from the expired order", async () => {
    db.seed({ orders: [order({ created_at: "2026-10-10T08:00:00.000Z", amount: 3900 })] });
    credit.rows.push(topUp(2000), spentRow("order_1", 2000));
    const first = await run(failingReleases());
    expect(first.expired).toBe(0);
    expect(first.errors).toBe(1);
    expect(db.orders.get("order_1")?.status).toBe("expired");
    expect(credit.ofKind("release")).toHaveLength(0);

    const second = await run(credit.wrap(db));
    expect(second.creditSwept).toBe(1);
    expect(credit.ofKind("release")).toEqual([expect.objectContaining({ amount: 2000, order_ref: "order_1" })]);
    expect(credit.balance()).toBe(2000);

    await run(credit.wrap(db));
    expect(credit.ofKind("release")).toHaveLength(1);
  });

  it("does not release a late re-spend while sweeping an expired order", async () => {
    db.seed({ orders: [order({ status: "expired", amount: 3900, updated_at: "2026-10-12T08:00:00.000Z" })] });
    credit.rows.push(topUp(5000), spentRow("order_1", 2000), releaseRow("order_1", 2000), spentRow("order_1:late", 2000));
    await run(credit.wrap(db));
    expect(credit.ofKind("release").map((r) => r.order_ref)).toEqual(["order_1"]);
  });
});

/* ── audit fixes: credit return is retriable, suspended employers, refund notes, expiry race, invoice back-fill ── */

describe("partial fulfilment: a failed credit return is retried, never stranded", () => {
  const seed = () => {
    db.applied0045 = true;
    db.applied0047 = true;
    db.seed({
      orders: [order({ mode: "batch", match_ids: ["m1", "m2", "m3", "m4"], amount: 11960 })],
      matches: [match("m1"), match("m2", { profiles: { name: "B", email: "b@x.com", employer_visibility: "off" } }), match("m3")],
    });
    db.blockedCandidates.add("cand-m3");
  };
  const failingRefundWrites = (): typeof fetch => {
    const f = credit.wrap(db);
    return ((input: RequestInfo | URL, init?: RequestInit) =>
      (init?.method === "POST" && String(input).includes("employer_credit_ledger") && String(init.body).includes('"refund"')
        ? Promise.resolve(json({ message: "boom" }, 500))
        : f(input, init))) as typeof fetch;
  };

  it("closes the order first; a failed credit write is alerted, and the replay credits once", async () => {
    seed();
    const first = await fulfil({ payment: { ...PAY, amount: 11960 }, fetchImpl: failingRefundWrites() });
    // The CAS winner owns the credit decision, so the order closes before the credit is written.
    expect(first.kind).toBe("partial");
    expect(first.kind === "partial" && first.returnedCreditPaise).toBe(0);
    expect(db.orders.get("order_1")?.status).toBe("partial");
    expect(credit.ofKind("refund")).toHaveLength(0);

    const retry = await fulfil({ payment: { ...PAY, amount: 11960 } });
    expect(retry.kind).toBe("partial");
    expect(retry.kind === "partial" && retry.returnedCreditPaise).toBe(8970);
    expect(credit.ofKind("refund")).toHaveLength(3);
    expect(db.orders.get("order_1")?.status).toBe("partial");
    expect(notifyImpl.mock.calls.filter(([i]) => i.type === "unlock_confirmed")).toHaveLength(1);
  });

  it("a second fulfilment racing the winner does not return credit (only the CAS winner decides)", async () => {
    seed();
    const [a, b] = await Promise.all([fulfil({ payment: { ...PAY, amount: 11960 } }), fulfil({ payment: { ...PAY, amount: 11960 } })]);
    expect([a.kind, b.kind]).toEqual(["partial", "partial"]);
    expect(credit.ofKind("refund")).toHaveLength(3);
    const returned = [a, b].map((r) => (r.kind === "partial" ? r.returnedCreditPaise : 0)).sort((x, y) => x - y);
    expect(returned[0]).toBe(0);
  });

  it("the invoice's credit note carries the returned share (one row, replay adds none)", async () => {
    seed();
    await fulfil({ payment: { ...PAY, amount: 11960 } });
    expect(db.creditNotes.map((c) => [c.refund_id, c.amount_paise])).toEqual([["unavailable:order_1", 8970]]);
    await fulfil({ payment: { ...PAY, amount: 11960 } });
    expect(db.creditNotes).toHaveLength(1);
  });
});

describe("a suspended employer is never given contact", () => {
  it("unlocks nothing, returns the whole payment as credit with reason employer_suspended and exposes no contact", async () => {
    db.applied0045 = true;
    db.seed({ orders: [order()], matches: [match("m1")] });
    db.employers.set("emp-1", { company_name: "Acme", billing_name: "Acme", gstin: "", suspended_at: "2026-10-09T00:00:00Z" });
    const r = await fulfil();
    expect(r.kind).toBe("partial");
    if (r.kind !== "partial") return;
    expect(r.unlockedMatchIds).toEqual([]);
    expect(r.candidates).toEqual([]);
    expect(r.failed).toEqual([{ matchId: "m1", reason: "employer_suspended" }]);
    expect(db.matches.get("m1")?.unlocked).toBe(false);
    expect(credit.ofKind("refund")).toEqual([expect.objectContaining({ match_id: "m1", amount: 5900, reason: "employer_suspended" })]);
    expect(r.invoiceNo).toBeNull();
    expect(db.ledger[0]).toMatchObject({ invoice_no: null });
  });
});

describe("full refund credit note covers spent credit", () => {
  it("a 3900 cash refund on an order that also spent 2000 credit is noted for 5900, read before the clawback releases the spend", async () => {
    db.applied0047 = true;
    db.seed({ orders: [creditOrder({ amount: 3900, credit_applied_paise: 2000 })], matches: [match("m1")] });
    credit.rows.push(topUp(2000), spentRow("order_1", 2000));
    expect((await fulfil({ payment: { ...PAY, amount: 3900 } })).kind).toBe("fulfilled");
    await handleEmployerUnlockWebhook({
      eventType: "refund.processed",
      event: { payload: { refund: { entity: { id: "rfnd_X", payment_id: "pay_1", amount: 3900 } } } },
      supabaseUrl: SUPABASE, headers: HEADERS, fetchImpl: credit.wrap(db), notifyImpl, now: () => NOW,
    });
    expect(db.creditNotes).toEqual([expect.objectContaining({ refund_id: "rfnd_X", amount_paise: 5900 })]);
    expect(credit.ofKind("release")).toEqual([expect.objectContaining({ amount: 2000 })]);
    expect(db.orders.get("order_1")?.status).toBe("refunded");
  });
});

describe("reconciler: expiry vs late fulfilment", () => {
  const LATER = new Date("2026-10-12T12:00:00.000Z");
  const sweepWith = (rzp: Parameters<typeof import("./unlockTestUtils").fakeRazorpay>[0], after?: () => void) => {
    const wrapped = credit.wrap(db);
    const razor = fakeRazorpay(rzp);
    return reconcileUnlockOrders({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayKeyId: "k", razorpayKeySecret: "s",
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).includes("api.razorpay.com")) { const r = await razor(input); after?.(); return r; }
        return wrapped(input, init);
      }) as typeof fetch,
      notifyImpl, now: () => LATER,
    });
  };

  it("does not release credit or count an expiry when the order was paid between the Razorpay read and the expiry write", async () => {
    db.seed({ orders: [order({ created_at: "2026-10-10T08:00:00.000Z", amount: 3900 })], matches: [match("m1")] });
    credit.rows.push(topUp(2000), spentRow("order_1", 2000));
    const s = await sweepWith({ payments: [] }, () => { const o = db.orders.get("order_1")!; o.status = "paid"; o.razorpay_payment_id = "pay_late"; });
    expect(s.expired).toBe(0);
    expect(s.pending).toBe(1);
    expect(db.orders.get("order_1")?.status).toBe("paid");
    expect(credit.ofKind("release")).toHaveLength(0);
    expect(captureServerEvent).not.toHaveBeenCalledWith("employer_unlock_abandoned", expect.anything(), expect.anything());
  });

  it("a payment captured after the order expired is still fulfilled by the next sweep (credit re-spent, late)", async () => {
    db.seed({ orders: [creditOrder({ created_at: "2026-10-10T08:00:00.000Z", amount: 3900, credit_applied_paise: 2000, status: "expired", updated_at: "2026-10-12T08:00:00.000Z" })], matches: [match("m1")] });
    credit.rows.push(topUp(5000), spentRow("order_1", 2000), releaseRow("order_1", 2000));
    const s = await sweepWith({ payments: [{ id: "pay_1", status: "captured", currency: "INR", amount: 3900, order_id: "order_1" }] });
    expect(s.fulfilled).toBe(1);
    expect(db.orders.get("order_1")?.status).toBe("fulfilled");
    expect(db.matches.get("m1")?.unlocked).toBe(true);
    expect(credit.rows.find((x) => x.kind === "spend" && x.order_ref === "order_1:late")?.amount).toBe(-2000);
  });

  it("leaves an expired order with no captured payment alone, and does not re-expire it", async () => {
    db.seed({ orders: [order({ created_at: "2026-10-10T08:00:00.000Z", status: "expired", updated_at: "2026-10-12T08:00:00.000Z" })] });
    const s = await sweepWith({ payments: [] });
    expect(s.expired).toBe(0);
    expect(s.errors).toBe(0);
    expect(db.orders.get("order_1")?.status).toBe("expired");
  });
});

describe("reconciler: invoice back-fill", () => {
  const LATER = new Date("2026-10-12T12:00:00.000Z");
  const run = () =>
    reconcileUnlockOrders({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayKeyId: "k", razorpayKeySecret: "s",
      fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
        (String(input).includes("api.razorpay.com") ? Promise.resolve(json({ items: [] })) : credit.wrap(db)(input, init))) as typeof fetch,
      notifyImpl, now: () => LATER,
    });
  const seedFulfilled = (over: Partial<FakeOrder> = {}, unlocked = true) => {
    db.applied0045 = true;
    db.employers.set("emp-1", { company_name: "Acme", billing_name: "Acme Pvt Ltd", gstin: "" });
    db.seed({
      orders: [order({ status: "fulfilled", razorpay_payment_id: "pay_1", created_at: "2026-10-11T08:00:00.000Z", updated_at: "2026-10-11T08:00:00.000Z", ...over })],
      matches: [match("m1", unlocked ? { unlocked: true, unlocked_at: "2026-10-11T08:01:00.000Z" } : {})],
    });
    db.ledger.push({ razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", employer_id: "emp-1", amount: 5900, invoice_no: null, refunded_at: null, created_at: "2026-10-11T08:01:00.000Z" });
  };

  it("numbers a fulfilled cash purchase whose invoice number was never assigned, and freezes its snapshot", async () => {
    seedFulfilled();
    const s = await run();
    expect(s.invoicesBackfilled).toBe(1);
    expect(s.errors).toBe(0);
    expect(db.ledger[0].invoice_no).toMatch(/^HSX-/);
    expect(db.ledger[0].invoice_snapshot).toBeTruthy();
  });

  it("is a no-op the second time round", async () => {
    seedFulfilled();
    await run();
    const second = await run();
    expect(second.invoicesBackfilled).toBe(0);
    expect(db.invoiceSeq).toBe(1);
  });

  it("skips a purchase where nobody was unlocked (no tax invoice exists for it)", async () => {
    seedFulfilled({ status: "partial" }, false);
    const s = await run();
    expect(s.invoicesBackfilled).toBe(0);
    expect(db.ledger[0].invoice_no).toBeNull();
    expect(db.invoiceSeq).toBe(0);
  });

  it("a failure to number is counted as an error so the cron reports it", async () => {
    seedFulfilled();
    db.failWhen = (_m, url) => url.includes("rpc/assign_unlock_invoice_no");
    const s = await run();
    expect(s.invoicesBackfilled).toBe(0);
    expect(s.invoiceBackfillErrors).toBe(1);
    expect(s.errors).toBeGreaterThanOrEqual(1);
  });
});


describe("credit-only purchases get a tax invoice at redemption", () => {
  const CREDIT_PAY = { id: "credit_pay_1", status: "captured", currency: "INR", amount: 0, orderId: "credit_1" };
  const seedCreditOrder = () => {
    db.applied0045 = true;
    db.applied0047 = true;
    db.employers.set("emp-1", { company_name: "Acme", billing_name: "Acme Pvt Ltd", gstin: "" });
    db.seed({ orders: [order({ razorpay_order_id: "credit_1", amount: 0 })], matches: [match("m1")] });
    credit.rows.push({ employer_id: "emp-1", amount: -5900, kind: "spend", order_ref: "credit_1", created_at: "2026-10-10T08:00:00.000Z" });
  };
  const redeem = (over: Partial3 = {}) =>
    fulfillUnlockOrder({ supabaseUrl: SUPABASE, headers: HEADERS, razorpayOrderId: "credit_1", payment: CREDIT_PAY, fetchImpl: credit.wrap(db), notifyImpl, now: () => NOW, ...over });

  it("numbers the purchase and freezes a snapshot whose taxable base is the credit spent", async () => {
    seedCreditOrder();
    const r = await redeem();
    expect(r.kind).toBe("fulfilled");
    expect(r.kind === "fulfilled" && r.invoiceNo).toMatch(/^HSX-/);
    expect(db.ledger[0]).toMatchObject({ amount: 0, razorpay_payment_id: "credit_pay_1" });
    expect(db.ledger[0].invoice_snapshot).toMatchObject({ cashPaise: 0, creditPaise: 5900, breakup: { taxablePaise: 5000, taxPaise: 900 } });
    expect(db.invoiceSeq).toBe(1);
  });

  it("a replay returns the same number and burns none", async () => {
    seedCreditOrder();
    const first = await redeem();
    const second = await redeem();
    expect(second.kind === "fulfilled" && second.invoiceNo).toBe(first.kind === "fulfilled" && first.invoiceNo);
    expect(db.invoiceSeq).toBe(1);
  });

  it("an order where nobody could be unlocked gets no invoice", async () => {
    seedCreditOrder();
    db.blockedCandidates.add("cand-m1");
    const r = await redeem();
    expect(r.kind === "partial" && r.invoiceNo).toBeNull();
    expect(db.invoiceSeq).toBe(0);
  });

  it("the reconciler back-fills a credit-only purchase whose number was lost", async () => {
    seedCreditOrder();
    db.orders.set("credit_1", { ...(db.orders.get("credit_1") as FakeOrder), status: "fulfilled", razorpay_payment_id: "credit_pay_1" });
    db.matches.set("m1", { ...(db.matches.get("m1") as ReturnType<typeof match>), unlocked: true, unlocked_at: "2026-10-10T08:01:00.000Z" });
    db.ledger.push({ razorpay_payment_id: "credit_pay_1", razorpay_order_id: "credit_1", employer_id: "emp-1", amount: 0, invoice_no: null, refunded_at: null, created_at: "2026-10-10T08:01:00.000Z" });
    const s = await reconcileUnlockOrders({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayKeyId: "k", razorpayKeySecret: "s",
      fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
        (String(input).includes("api.razorpay.com") ? Promise.resolve(json({ items: [] })) : credit.wrap(db)(input, init))) as typeof fetch,
      notifyImpl, now: () => new Date("2026-10-12T12:00:00.000Z"),
    });
    expect(s.invoicesBackfilled).toBe(1);
    expect(db.ledger[0].invoice_no).toMatch(/^HSX-/);
    expect(db.ledger[0].invoice_snapshot).toMatchObject({ creditPaise: 5900 });
  });

  it("an admin grant (zero amount, not a credit_pay_ id) is never numbered", async () => {
    db.applied0045 = true;
    db.ledger.push({ razorpay_payment_id: "admin_grant_1", razorpay_order_id: "admin_order_1", employer_id: "emp-1", amount: 0, invoice_no: null, refunded_at: null });
    const f = credit.wrap(db);
    const res = await f(`${SUPABASE}/rest/v1/rpc/assign_unlock_invoice_no`, { method: "POST", body: JSON.stringify({ p_payment_id: "admin_grant_1" }) });
    expect(await res.json()).toBeNull();
  });
});

/* ── Overlapping orders and the double-refund guards ── */

const hookAs = (eventType: string, event: unknown) =>
  handleEmployerUnlockWebhook({ eventType, event: event as never, supabaseUrl: SUPABASE, headers: HEADERS, fetchImpl: credit.wrap(db), notifyImpl, now: () => NOW });
const refundEv = (id: string, amount: number, total?: number) => ({
  payload: {
    refund: { entity: { id, payment_id: "pay_1", amount } },
    ...(total ? { payment: { entity: { id: "pay_1", amount: 5900, amount_refunded: total } } } : {}),
  },
});
const declinedRefund = (amount: number, ref: string, matchId = "m1"): LedgerRow =>
  ({ employer_id: "emp-1", amount, kind: "refund", reason: "declined", match_id: matchId, order_ref: ref, created_at: "2026-10-11T00:00:00Z" });
const fulfilledOrder = (id: string, over: Partial<FakeOrder> = {}): FakeOrder =>
  order({ id: `row-${id}`, razorpay_order_id: id, status: "fulfilled", razorpay_payment_id: `pay_${id}`, created_at: "2026-10-10T08:00:00.000Z", ...over });

describe("a full refund only relocks matches this order owns", () => {
  const setup = async () => {
    db.seed({ orders: [order()], matches: [match("m1")] });
    await fulfil();
    db.orders.set("order_2", fulfilledOrder("order_2", { created_at: "2026-10-10T09:30:00.000Z" }));
  };

  it("leaves a match unlocked when another live order also lists it (the employer paid that order for it)", async () => {
    await setup();
    const r = await hookAs("refund.processed", refundEv("rfnd_1", 5900));
    expect(r).toMatchObject({ handled: true, status: 200 });
    expect(db.orders.get("order_1")?.status).toBe("refunded");
    expect(db.matches.get("m1")?.unlocked).toBe(true);
  });

  it("relocks it when the other order handed the match back as unavailable (it never owned it)", async () => {
    await setup();
    credit.rows.push({ employer_id: "emp-1", amount: 5900, kind: "refund", reason: "unavailable", match_id: "m1", order_ref: "order_2", created_at: "2026-10-10T10:00:00Z" });
    await hookAs("refund.processed", refundEv("rfnd_1", 5900));
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("asks for redelivery when ownership cannot be read, without refunding or relocking", async () => {
    await setup();
    const f = credit.wrap(db);
    const r = await handleEmployerUnlockWebhook({
      eventType: "refund.processed", event: refundEv("rfnd_1", 5900) as never, supabaseUrl: SUPABASE, headers: HEADERS, notifyImpl, now: () => NOW,
      fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
        (String(input).includes("employer_unlock_orders") && String(input).includes("match_ids=ov.") && String(input).includes("neq.")
          ? Promise.resolve(json({}, 500))
          : f(input, init))) as typeof fetch,
    });
    expect(r).toMatchObject({ status: 500, retry: true });
    expect(db.orders.get("order_1")?.status).toBe("fulfilled");
    expect(db.matches.get("m1")?.unlocked).toBe(true);
  });
});

describe("a cash partial refund after credit already went back does not refund the match twice", () => {
  beforeEach(async () => {
    db.applied0045 = true;
    db.applied0047 = true;
    db.seed({ orders: [order()], matches: [match("m1")] });
    await fulfil();
    credit.rows.push(declinedRefund(5900, "order_1"));
  });

  it("claws the excess credit back once per refund and does not issue a note for value that already has one", async () => {
    await hookAs("refund.processed", refundEv("rfnd_p1", 1000));
    expect(credit.ofKind("clawback")).toEqual([expect.objectContaining({ amount: -1000, order_ref: "clawback:order_1:overlap:rfnd_p1", reason: "payment_refunded" })]);
    expect(db.creditNotes).toHaveLength(0);
    await hookAs("refund.created", refundEv("rfnd_p1", 1000));
    expect(credit.ofKind("clawback")).toHaveLength(1);
  });

  it("a second partial refund claws back only what it added", async () => {
    await hookAs("refund.processed", refundEv("rfnd_p1", 1000));
    await hookAs("refund.processed", refundEv("rfnd_p2", 500, 1500));
    expect(credit.ofKind("clawback").map((r) => [r.order_ref, r.amount])).toEqual([
      ["clawback:order_1:overlap:rfnd_p1", -1000],
      ["clawback:order_1:overlap:rfnd_p2", -500],
    ]);
  });

  it("the later full refund reverses only the credit not already taken back", async () => {
    await hookAs("refund.processed", refundEv("rfnd_p1", 1000));
    await hookAs("refund.processed", refundEv("rfnd_full", 4900, 5900));
    const all = credit.ofKind("clawback").reduce((n, r) => n + r.amount, 0);
    expect(all).toBe(-5900);
    expect(credit.ofKind("clawback").find((r) => r.order_ref === "clawback:order_1:m1")?.amount).toBe(-4900);
  });

  it("with no credit returned the partial refund gets its full credit note and no clawback", async () => {
    credit.rows.length = 0;
    await hookAs("refund.processed", refundEv("rfnd_p1", 1000));
    expect(credit.ofKind("clawback")).toHaveLength(0);
    expect(db.creditNotes).toEqual([expect.objectContaining({ refund_id: "rfnd_p1", amount_paise: 1000 })]);
  });

  it("asks for redelivery when the overlap clawback write fails", async () => {
    const f = credit.wrap(db);
    const r = await handleEmployerUnlockWebhook({
      eventType: "refund.processed", event: refundEv("rfnd_p1", 1000) as never, supabaseUrl: SUPABASE, headers: HEADERS, notifyImpl, now: () => NOW,
      fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
        (init?.method === "POST" && String(input).includes("employer_credit_ledger") && String(init.body).includes('"clawback"')
          ? Promise.resolve(json({}, 500))
          : f(input, init))) as typeof fetch,
    });
    expect(r).toMatchObject({ status: 500, retry: true });
  });

  it("clawbackRefundOverlap reports a failed read instead of guessing", async () => {
    const r = await clawbackRefundOverlap({
      base: SUPABASE, headers: HEADERS, employerId: "emp-1", orderRef: "order_1", refundId: "r", cashPaise: 5900, creditSpentPaise: 0, cashRefundedTotalPaise: 1000,
      fetchImpl: (async () => json({}, 500)) as typeof fetch,
    });
    expect(r).toEqual({ ok: false, clawedBackPaise: 0 });
  });
});

describe("a candidate-triggered credit refund is priced against the owning order", () => {
  const call = () => creditRefundForMatches({
    base: SUPABASE, headers: HEADERS, matchIds: ["m1"], reason: "declined", fetchImpl: credit.wrap(db), notifyImpl,
  });

  it("is clamped to what a cash partial refund left on the order", async () => {
    db.applied0045 = true;
    db.seed({ orders: [fulfilledOrder("order_1")], matches: [match("m1", { unlocked: true, unlocked_at: "2026-10-10T09:00:00.000Z" })] });
    db.ledger.push({ razorpay_payment_id: "pay_order_1", razorpay_order_id: "order_1", employer_id: "emp-1", amount: 5900, invoice_no: "HSX-2610-000001", refunded_at: null, partial_refund_paise: 2000 });
    const r = await call();
    expect(r.credited).toEqual([expect.objectContaining({ matchId: "m1", amountPaise: 3900 })]);
    expect(credit.ofKind("refund")).toEqual([expect.objectContaining({ amount: 3900, order_ref: "order_1" })]);
    expect(slog.warn).toHaveBeenCalledWith(expect.stringContaining("clamped"), expect.objectContaining({ code: "credit_refund_clamped", creditedPaise: 3900 }));
  });

  it("credits nothing when the cash refund already took the whole order back", async () => {
    db.applied0045 = true;
    db.seed({ orders: [fulfilledOrder("order_1")], matches: [match("m1", { unlocked: true, unlocked_at: "2026-10-10T09:00:00.000Z" })] });
    db.ledger.push({ razorpay_payment_id: "pay_order_1", razorpay_order_id: "order_1", employer_id: "emp-1", amount: 5900, invoice_no: null, refunded_at: null, partial_refund_paise: 5900 });
    const r = await call();
    expect(r.credited).toEqual([]);
    expect(credit.ofKind("refund")).toHaveLength(0);
  });

  it("skips an order that handed the match back as unavailable and credits the order that delivered it", async () => {
    db.seed({
      orders: [
        fulfilledOrder("order_new", { created_at: "2026-10-10T10:00:00.000Z", amount: 4000 }),
        fulfilledOrder("order_old", { created_at: "2026-10-10T08:00:00.000Z", amount: 5900 }),
      ],
      matches: [match("m1", { unlocked: true, unlocked_at: "2026-10-10T09:00:00.000Z" })],
    });
    credit.rows.push({ employer_id: "emp-1", amount: 4000, kind: "refund", reason: "unavailable", match_id: "m1", order_ref: "order_new", created_at: "2026-10-10T10:30:00Z" });
    const r = await call();
    expect(r.credited).toEqual([expect.objectContaining({ amountPaise: 5900 })]);
    expect(credit.ofKind("refund").filter((x) => x.reason === "declined")).toEqual([expect.objectContaining({ order_ref: "order_old", amount: 5900 })]);
  });

  it("does nothing, and retries later, when the ownership read fails", async () => {
    db.seed({ orders: [fulfilledOrder("order_1")], matches: [match("m1", { unlocked: true, unlocked_at: "2026-10-10T09:00:00.000Z" })] });
    const f = credit.wrap(db);
    const r = await creditRefundForMatches({
      base: SUPABASE, headers: HEADERS, matchIds: ["m1"], reason: "declined", notifyImpl,
      fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) =>
        (String(input).includes("reason=in.(") ? Promise.resolve(json({}, 500)) : f(input, init))) as typeof fetch,
    });
    expect(r.credited).toEqual([]);
    expect(credit.ofKind("refund")).toHaveLength(0);
    expect(db.matches.get("m1")?.unlocked).toBe(true);
  });
});

describe("a match another order already delivered is charged once", () => {
  const seedHeld = () => {
    db.applied0045 = true;
    db.applied0047 = true;
    db.seed({
      orders: [order(), fulfilledOrder("order_0", { created_at: "2026-10-10T07:00:00.000Z" })],
      matches: [match("m1", { unlocked: true, unlocked_at: "2026-10-10T07:30:00.000Z", unlocked_candidate_name: "Name m1", unlocked_candidate_email: "m1@example.com" })],
    });
  };

  it("returns this order's share as credit, leaves the match with its owner and closes the order partial", async () => {
    seedHeld();
    const r = await fulfil();
    expect(r.kind).toBe("partial");
    if (r.kind !== "partial") return;
    expect(r.failed).toEqual([{ matchId: "m1", reason: "already_unlocked" }]);
    expect(r.unlockedMatchIds).toEqual([]);
    expect(credit.ofKind("refund")).toEqual([expect.objectContaining({ amount: 5900, match_id: "m1", order_ref: "order_1", reason: "unavailable" })]);
    expect(db.matches.get("m1")?.unlocked).toBe(true);
    expect(db.orders.get("order_1")?.status).toBe("partial");
  });

  it("a replay returns it once, not twice", async () => {
    seedHeld();
    await fulfil();
    const again = await fulfil();
    expect(again.kind).toBe("partial");
    expect(again.kind === "partial" && again.failed).toEqual([{ matchId: "m1", reason: "already_unlocked" }]);
    expect(credit.ofKind("refund")).toHaveLength(1);
  });

  it("does not treat the match as held when the other order handed it back as unavailable", async () => {
    seedHeld();
    db.matches.set("m1", match("m1"));
    credit.rows.push({ employer_id: "emp-1", amount: 5900, kind: "refund", reason: "unavailable", match_id: "m1", order_ref: "order_0", created_at: "2026-10-10T07:40:00Z" });
    const r = await fulfil();
    expect(r.kind).toBe("fulfilled");
    expect(db.matches.get("m1")?.unlocked).toBe(true);
  });
});

describe("reconciler: credit-note back-fill and partial-order credit sweep", () => {
  const LATER = new Date("2026-10-12T12:00:00.000Z");
  const reconcile = (refunds: Array<{ id: string; payment_id: string; amount: number; created_at?: number; status?: string }> = [], rzpDown = false) => {
    const rzp = fakeRazorpay({ refunds, down: rzpDown });
    const f = credit.wrap(db);
    return reconcileUnlockOrders({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayKeyId: "k", razorpayKeySecret: "s",
      fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) => (String(input).includes("api.razorpay.com") ? rzp(input) : f(input, init))) as typeof fetch,
      notifyImpl, now: () => LATER,
    });
  };
  const seedRefunded = (ledger: Record<string, unknown>, orderOver: Partial<FakeOrder> & { credit_applied_paise?: number } = {}) => {
    db.applied0045 = true;
    db.applied0047 = true;
    db.seed({
      orders: [Object.assign(order({ status: "fulfilled", razorpay_payment_id: "pay_1", created_at: "2026-10-11T08:00:00.000Z", updated_at: "2026-10-11T08:00:00.000Z" }), orderOver)],
      matches: [match("m1", { unlocked: true, unlocked_at: "2026-10-11T08:01:00.000Z" })],
    });
    db.ledger.push({
      razorpay_payment_id: "pay_1", razorpay_order_id: "order_1", employer_id: "emp-1", amount: 5900, invoice_no: "HSX-2610-000001", refunded_at: null,
      created_at: "2026-10-11T08:01:00.000Z", ...ledger,
    } as never);
  };

  it("numbers a partial refund whose credit note was never issued, once", async () => {
    seedRefunded({ partial_refund_paise: 1000, partial_refund_at: "2026-10-11T09:00:00.000Z" });
    const refunds = [{ id: "rfnd_a", payment_id: "pay_1", amount: 1000, created_at: 10 }];
    const s = await reconcile(refunds);
    expect(s.creditNotesBackfilled).toBe(1);
    expect(db.creditNotes).toEqual([expect.objectContaining({ refund_id: "rfnd_a", amount_paise: 1000 })]);
    const again = await reconcile(refunds);
    expect(again.creditNotesBackfilled).toBe(0);
    expect(db.creditNotes).toHaveLength(1);
  });

  it("a failed refund gets no note, and the ones that moved money are noted in order with the same running total the webhook uses", async () => {
    seedRefunded({ partial_refund_paise: 1500, partial_refund_at: "2026-10-11T09:00:00.000Z" });
    const s = await reconcile([
      { id: "rfnd_b", payment_id: "pay_1", amount: 500, created_at: 20 },
      { id: "rfnd_x", payment_id: "pay_1", amount: 700, created_at: 15, status: "failed" },
      { id: "rfnd_a", payment_id: "pay_1", amount: 1000, created_at: 10 },
    ]);
    expect(s.creditNotesBackfilled).toBe(2);
    expect(db.creditNotes.map((c) => [c.refund_id, c.amount_paise]).sort()).toEqual([["rfnd_a", 1000], ["rfnd_b", 500]]);
  });

  it("the last refund of a fully refunded order is noted for the cash plus the credit that was spent on it", async () => {
    seedRefunded({ amount: 3900, refunded_at: "2026-10-11T09:00:00.000Z" }, { amount: 3900, credit_applied_paise: 2000 });
    const s = await reconcile([{ id: "rfnd_f", payment_id: "pay_1", amount: 3900, created_at: 10 }]);
    expect(s.creditNotesBackfilled).toBe(1);
    expect(db.creditNotes).toEqual([expect.objectContaining({ refund_id: "rfnd_f", amount_paise: 5900 })]);
  });

  it("does not note value that already went back as credit", async () => {
    seedRefunded({ partial_refund_paise: 1000, partial_refund_at: "2026-10-11T09:00:00.000Z" });
    credit.rows.push(declinedRefund(5900, "order_1"));
    const s = await reconcile([{ id: "rfnd_a", payment_id: "pay_1", amount: 1000, created_at: 10 }]);
    expect(s.creditNotesBackfilled).toBe(0);
    expect(db.creditNotes).toHaveLength(0);
  });

  it("counts an unreachable Razorpay as an error so the cron retries and reports it", async () => {
    seedRefunded({ partial_refund_paise: 1000, partial_refund_at: "2026-10-11T09:00:00.000Z" });
    const s = await reconcile([], true);
    expect(s.creditNotesBackfilled).toBe(0);
    expect(s.creditNoteBackfillErrors).toBe(1);
    expect(s.errors).toBeGreaterThanOrEqual(1);
  });

  it("returns credit stranded on a partial order whose first attempt died, once", async () => {
    db.applied0045 = true;
    db.seed({
      orders: [order({ status: "partial", razorpay_payment_id: "pay_1", created_at: "2026-10-11T08:00:00.000Z", updated_at: "2026-10-11T08:00:00.000Z" })],
      matches: [match("m1")],
    });
    const s = await reconcile();
    expect(s.partialSwept).toBe(1);
    expect(credit.ofKind("refund")).toEqual([expect.objectContaining({ amount: 5900, match_id: "m1", order_ref: "order_1" })]);
    const again = await reconcile();
    expect(again.partialSwept).toBe(0);
    expect(credit.ofKind("refund")).toHaveLength(1);
  });

  it("leaves a partial order alone when all its matches are delivered", async () => {
    db.seed({
      orders: [order({ status: "partial", razorpay_payment_id: "pay_1", created_at: "2026-10-11T08:00:00.000Z", updated_at: "2026-10-11T08:00:00.000Z" })],
      matches: [match("m1", { unlocked: true, unlocked_at: "2026-10-11T08:01:00.000Z" })],
    });
    const s = await reconcile();
    expect(s.partialSwept).toBe(0);
    expect(credit.ofKind("refund")).toHaveLength(0);
  });
});
