import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FakeUnlockDb, HEADERS, SUPABASE, match, order, fakeRazorpay, combineFetch } from "./unlockTestUtils";
import type { NotifyInput } from "../../server-handlers/_notify";

vi.mock("../../server-handlers/_shared", () => ({
  slog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  supabaseUrl: () => "https://example.supabase.co",
  supabaseServiceHeaders: () => ({ apikey: "service-key", Authorization: "Bearer service-key" }),
}));

const { fulfillUnlockOrder, isFullyRefundedPayment } = await import("../../server-handlers/_unlock-fulfillment");
const { handleEmployerUnlockWebhook } = await import("../../server-handlers/_employer-unlock-webhook");
const { reconcileUnlockOrders } = await import("../../server-handlers/_employer-unlock-reconcile");
const tax = await import("../../server-handlers/_unlock-tax");
const { readLegalEntity } = await import("../../data/legal-entity");
const { hasSupplierGstin } = await import("../../server-handlers/_unlock-receipt-email");
import { buildInvoiceHtml, type InvoiceInput } from "../employer/_invoiceHtml";
import type { UnlockWebhookEvent } from "../../server-handlers/_employer-unlock-webhook";

const NOW = new Date("2026-10-10T09:00:00.000Z");
const PAY = { id: "pay_1", status: "captured", amount: 5900, orderId: "order_1" };
const FULL_REFUND = { ...PAY, refundStatus: "full", amountRefunded: 5900 };
const GSTIN_KARNATAKA = "29AABCT1332L1ZA";
const ENV_KEYS = ["NEXT_PUBLIC_LEGAL_GSTIN", "NEXT_PUBLIC_LEGAL_ENTITY_NAME", "NEXT_PUBLIC_LEGAL_ADDRESS", "NEXT_PUBLIC_LEGAL_SAC"];

let db: FakeUnlockDb;
const notifyImpl = vi.fn(async (_input: NotifyInput) => {});

function fulfil(over: Partial<Parameters<typeof fulfillUnlockOrder>[0]> = {}, d = db) {
  return fulfillUnlockOrder({
    supabaseUrl: SUPABASE, headers: HEADERS, razorpayOrderId: "order_1", payment: PAY,
    fetchImpl: d.fetch as typeof fetch, notifyImpl, now: () => NOW, ...over,
  });
}
function hook(eventType: string, event: UnlockWebhookEvent) {
  return handleEmployerUnlockWebhook({
    eventType, event, supabaseUrl: SUPABASE, headers: HEADERS, fetchImpl: db.fetch as typeof fetch, notifyImpl,
    now: () => new Date("2026-10-10T10:00:00.000Z"),
  });
}
const capturedEvent = (entity: Record<string, unknown> = {}) => ({
  payload: { payment: { entity: { id: "pay_1", status: "captured", amount: 5900, order_id: "order_1", notes: {}, ...entity } } },
});
const refundEvent = (amount: number, paymentExtra: Record<string, unknown> = {}) => ({
  payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_1", amount } }, payment: { entity: { id: "pay_1", amount: 5900, ...paymentExtra } } },
});
const noMoney = (d: FakeUnlockDb) => ({
  unlocked: [...d.matches.values()].some((m) => m.unlocked),
  ledger: d.ledger.length,
  creditWrites: d.calls.filter((c) => c.method === "POST" && c.url.includes("employer_credit_ledger")).length,
});

beforeEach(() => {
  db = new FakeUnlockDb().seed({ orders: [order()], matches: [match("m1")] });
  db.employers.set("emp-1", { company_name: "Acme", billing_name: "Acme Pvt Ltd", gstin: "27AAPFU0939F1ZV" });
  notifyImpl.mockClear();
  for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => { for (const k of ENV_KEYS) delete process.env[k]; });

/* ── 1. fully refunded payments never fulfil ── */

describe("a fully refunded payment never fulfils an order", () => {
  it("isFullyRefundedPayment: refund_status full, or amount_refunded reaching the amount; a partial refund is live", () => {
    expect(isFullyRefundedPayment({ ...PAY, refundStatus: "full" })).toBe(true);
    expect(isFullyRefundedPayment({ ...PAY, amountRefunded: 5900 })).toBe(true);
    expect(isFullyRefundedPayment({ ...PAY, amountRefunded: 6000 })).toBe(true);
    expect(isFullyRefundedPayment({ ...PAY, refundStatus: "partial", amountRefunded: 1000 })).toBe(false);
    expect(isFullyRefundedPayment(PAY)).toBe(false);
  });

  it("fulfil/verify path: closes the order as refunded, unlocks nothing, records nothing, sends no notification", async () => {
    const r = await fulfil({ payment: FULL_REFUND });
    expect(r.kind).toBe("refunded");
    expect(db.orders.get("order_1")).toMatchObject({ status: "refunded", razorpay_payment_id: "pay_1" });
    expect(noMoney(db)).toMatchObject({ unlocked: false, ledger: 0 });
    expect(notifyImpl).not.toHaveBeenCalled();
  });

  it("is detected from amount_refunded alone, even when refund_status is missing", async () => {
    const r = await fulfil({ payment: { ...PAY, amountRefunded: 5900 } });
    expect(r.kind).toBe("refunded");
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("a partially refunded payment still fulfils (the refund webhook accounts for the partial refund)", async () => {
    const r = await fulfil({ payment: { ...PAY, refundStatus: "partial", amountRefunded: 1000 } });
    expect(r.kind).toBe("fulfilled");
    expect(db.matches.get("m1")?.unlocked).toBe(true);
  });

  it("leaves an already fulfilled order to the refund webhook (no writes here)", async () => {
    await fulfil();
    const writes = db.calls.filter((c) => c.method !== "GET").length;
    const r = await fulfil({ payment: FULL_REFUND });
    expect(r.kind).toBe("refunded");
    expect(db.calls.filter((c) => c.method !== "GET").length).toBe(writes);
    expect(db.orders.get("order_1")?.status).toBe("fulfilled");
  });

  it("webhook path: payment.captured carrying refund_status full is skipped and the order closed", async () => {
    const r = await hook("payment.captured", capturedEvent({ refund_status: "full", amount_refunded: 5900 }));
    expect(r).toMatchObject({ handled: true, status: 200, body: { skipped: "unlock_order_refunded" } });
    expect(db.orders.get("order_1")?.status).toBe("refunded");
    expect(noMoney(db)).toMatchObject({ unlocked: false, ledger: 0 });
  });

  it("reconcile path: a captured-then-refunded payment on a 'created' order is closed as refunded, not fulfilled or expired", async () => {
    db.orders.get("order_1")!.created_at = "2026-10-09T08:00:00.000Z";
    const s = await reconcileUnlockOrders({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayKeyId: "k", razorpayKeySecret: "s", notifyImpl, now: () => new Date("2026-10-10T12:00:00.000Z"),
      fetchImpl: combineFetch(db, fakeRazorpay({ payments: [{ id: "pay_1", status: "captured", amount: 5900, order_id: "order_1", refund_status: "full", amount_refunded: 5900 }] })),
    });
    expect(s).toMatchObject({ scanned: 1, fulfilled: 0, expired: 0, skipped: 1, errors: 0 });
    expect(db.orders.get("order_1")?.status).toBe("refunded");
    expect(noMoney(db)).toMatchObject({ unlocked: false, ledger: 0 });
  });

  it("reconcile path: an order left 'paid' whose payment was then refunded is closed instead of retried", async () => {
    Object.assign(db.orders.get("order_1")!, { status: "paid", razorpay_payment_id: "pay_1", created_at: "2026-10-09T08:00:00.000Z" });
    const s = await reconcileUnlockOrders({
      supabaseUrl: SUPABASE, headers: HEADERS, razorpayKeyId: "k", razorpayKeySecret: "s", notifyImpl, now: () => new Date("2026-10-10T12:00:00.000Z"),
      fetchImpl: combineFetch(db, fakeRazorpay({ payments: [{ id: "pay_1", status: "captured", amount: 5900, order_id: "order_1", refund_status: "full" }] })),
    });
    expect(s.fulfilled).toBe(0);
    expect(db.orders.get("order_1")?.status).toBe("refunded");
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });
});

/* ── 5. invoice numbers only for issued tax invoices ── */

describe("invoice number assignment (migration 0045)", () => {
  beforeEach(() => { db.applied0045 = true; });

  it("assigns the number after the unlock, for a cash purchase", async () => {
    const r = await fulfil();
    expect(r.kind).toBe("fulfilled");
    if (r.kind === "fulfilled") expect(r.invoiceNo).toBe("HSX-2610-000001");
    expect(db.ledger[0].invoice_no).toBe("HSX-2610-000001");
  });

  it("does not burn a number when every candidate is unavailable (no tax invoice was issued)", async () => {
    db.matches.set("m1", match("m1", { profiles: { name: "x", email: "x@x.com", employer_visibility: "off" } }));
    const r = await fulfil();
    expect(r.kind).toBe("partial");
    expect(db.ledger).toHaveLength(1);
    expect(db.ledger[0].invoice_no).toBeNull();
    expect(db.invoiceSeq).toBe(0);
  });

  it("does not number a credit-only (zero cash) order", async () => {
    db.orders.get("order_1")!.amount = 0;
    await fulfil({ payment: { ...PAY, amount: 0 } });
    expect(db.invoiceSeq).toBe(0);
  });

  it("a lost ledger race (409) or a replay never consumes a second number", async () => {
    await Promise.all([fulfil(), fulfil()]);
    await fulfil();
    expect(db.ledger).toHaveLength(1);
    expect(db.invoiceSeq).toBe(1);
  });

  it("a replay fills in a number that a failed assignment left null", async () => {
    db.failWhen = (_m, url) => url.includes("rpc/assign_unlock_invoice_no");
    const first = await fulfil();
    expect(first.kind).toBe("fulfilled");
    expect(db.ledger[0].invoice_no).toBeNull();
    db.failWhen = null;
    const again = await fulfil();
    if (again.kind === "fulfilled") expect(again.invoiceNo).toBe("HSX-2610-000001");
    expect(db.invoiceSeq).toBe(1);
  });

  it("tolerates 0045 being unapplied: the column default numbered the row and the missing RPC is not an error", async () => {
    db.applied0045 = false;
    const r = await fulfil();
    expect(r.kind).toBe("fulfilled");
    if (r.kind === "fulfilled") expect(r.invoiceNo).toBe("HSX-2610-000001");
    expect(db.ledger[0].invoice_snapshot).toBeUndefined();
  });
});

/* ── 2. invoice snapshot ── */

describe("invoice snapshot written at fulfilment", () => {
  beforeEach(() => {
    db.applied0045 = true;
    process.env.NEXT_PUBLIC_LEGAL_GSTIN = GSTIN_KARNATAKA;
    process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME = "HireStepX Pvt Ltd";
    process.env.NEXT_PUBLIC_LEGAL_ADDRESS = "Bengaluru";
    process.env.NEXT_PUBLIC_LEGAL_SAC = "998439";
  });

  it("freezes supplier, SAC, rate, buyer name/GSTIN, place of supply and the tax breakup", async () => {
    await fulfil();
    const snap = tax.parseInvoiceSnapshot(db.ledger[0].invoice_snapshot);
    expect(snap).not.toBeNull();
    expect(snap).toMatchObject({
      supplier: { name: "HireStepX Pvt Ltd", address: "Bengaluru", gstin: GSTIN_KARNATAKA, sac: "998439" },
      buyer: { name: "Acme Pvt Ltd", gstin: "27AAPFU0939F1ZV" },
      ratePercent: 18, cashPaise: 5900, creditPaise: 0,
      breakup: { taxablePaise: 5000, taxPaise: 900, interState: true, placeOfSupply: { code: "27", basis: "buyer_gstin" } },
    });
    expect(snap?.breakup.lines).toEqual([{ label: "IGST @ 18%", paise: 900 }]);
  });

  it("is write-once: a later fulfilment pass after the profile or env changed does not rewrite it", async () => {
    await fulfil();
    const before = JSON.stringify(db.ledger[0].invoice_snapshot);
    process.env.NEXT_PUBLIC_LEGAL_GSTIN = "07AAACH7409R1ZZ";
    db.employers.set("emp-1", { company_name: "Acme", billing_name: "Renamed Ltd", gstin: "29ABCDE1234F1Z5" });
    await fulfil();
    expect(JSON.stringify(db.ledger[0].invoice_snapshot)).toBe(before);
  });

  it("the rendered document keeps the issued values after the live env and profile change", async () => {
    await fulfil();
    const snapshot = tax.parseInvoiceSnapshot(db.ledger[0].invoice_snapshot);
    process.env.NEXT_PUBLIC_LEGAL_GSTIN = "";
    const input: InvoiceInput = {
      invoiceNo: db.ledger[0].invoice_no, createdAt: NOW.toISOString(), orderId: "order_1", candidateNames: [], candidateCount: 1,
      cashPaise: 5900, creditPaise: 0, refunded: false, snapshot,
      supplier: { name: "Someone Else", address: "Elsewhere", gstin: "" },
      buyer: { companyName: "Renamed", billingName: "Renamed Ltd", gstin: "" },
    };
    const html = buildInvoiceHtml(input);
    expect(html).toContain("Tax invoice");
    expect(html).toContain(GSTIN_KARNATAKA);
    expect(html).toContain("Acme Pvt Ltd");
    expect(html).not.toContain("Renamed");
    expect(html).not.toContain("Someone Else");
  });

  it("tolerates 0045 being unapplied: fulfilment succeeds and the row simply has no snapshot", async () => {
    db.applied0045 = false;
    const r = await fulfil();
    expect(r.kind).toBe("fulfilled");
    expect(db.ledger).toHaveLength(1);
    expect(db.ledger[0].invoice_snapshot).toBeUndefined();
  });

  it("legacy rows (no snapshot) render from the live values", () => {
    const html = buildInvoiceHtml({
      invoiceNo: "HSX-2609-000004", createdAt: NOW.toISOString(), orderId: "order_old", candidateNames: [], candidateCount: 1,
      cashPaise: 5900, creditPaise: 0, refunded: false, snapshot: null,
      supplier: { name: "Live Supplier", address: "", gstin: GSTIN_KARNATAKA },
      buyer: { companyName: "Live Buyer", billingName: "", gstin: "" },
    });
    expect(html).toContain("Live Supplier");
    expect(html).toContain("Live Buyer");
  });
});

/* ── 3. one GSTIN source ── */

describe("supplier GSTIN has a single source", () => {
  it("the receipt email and the in-app documents both read NEXT_PUBLIC_LEGAL_GSTIN through the legal-entity module", () => {
    expect(hasSupplierGstin()).toBe(false);
    process.env.NEXT_PUBLIC_LEGAL_GSTIN = GSTIN_KARNATAKA;
    expect(hasSupplierGstin()).toBe(true);
    expect(readLegalEntity().gstin).toBe(GSTIN_KARNATAKA);
  });

  it("the retired SUPPLIER_GSTIN names are ignored, so the two surfaces cannot disagree", () => {
    process.env.SUPPLIER_GSTIN = GSTIN_KARNATAKA;
    process.env.NEXT_PUBLIC_SUPPLIER_GSTIN = GSTIN_KARNATAKA;
    expect(hasSupplierGstin()).toBe(false);
    delete process.env.SUPPLIER_GSTIN;
    delete process.env.NEXT_PUBLIC_SUPPLIER_GSTIN;
  });
});

/* ── 4. place of supply default ── */

describe("place of supply for a buyer with no GSTIN", () => {
  it("is one named constant, currently the supplier's state (behaviour unchanged)", () => {
    expect(tax.PLACE_OF_SUPPLY_WITHOUT_BUYER_GSTIN).toBe("supplier_state");
    expect(tax.resolvePlaceOfSupply(GSTIN_KARNATAKA, "")).toEqual({ code: "29", basis: "supplier_state" });
    expect(tax.resolvePlaceOfSupply(GSTIN_KARNATAKA, "27AAPFU0939F1ZV")).toEqual({ code: "27", basis: "buyer_gstin" });
    expect(tax.resolvePlaceOfSupply("", "")).toEqual({ code: null, basis: "unknown" });
  });

  it("drives the CGST+SGST vs IGST split", () => {
    expect(tax.gstBreakup(5900, GSTIN_KARNATAKA, "").lines.map((l) => l.label)).toEqual(["CGST @ 9%", "SGST @ 9%"]);
    expect(tax.gstBreakup(5900, GSTIN_KARNATAKA, "27AAPFU0939F1ZV").lines.map((l) => l.label)).toEqual(["IGST @ 18%"]);
  });
});

/* ── 6. credit notes, including partial refunds ── */

describe("credit note numbers and partial refunds", () => {
  it("creditNoteNumber stays within the 16-character GST rule 46 cap", () => {
    expect(tax.creditNoteNumber("HSX-2610-000001")).toBe("CN-2610-000001");
    expect(tax.creditNoteNumber("HSX-2610-000001").length).toBeLessThanOrEqual(16);
    expect(tax.creditNoteNumber("HSX-2610-9999999999999").length).toBe(16);
  });

  it("webhook records a partial refund cumulatively on the ledger row without relocking anything", async () => {
    db.applied0045 = true;
    await fulfil();
    const r = await hook("refund.processed", refundEvent(1000));
    expect(r).toMatchObject({ handled: true, body: { unlock_refund: "partial_ignored", creditNote: true } });
    expect(db.ledger[0]).toMatchObject({ partial_refund_paise: 1000, partial_refund_at: "2026-10-10T10:00:00.000Z" });
    expect(db.matches.get("m1")?.unlocked).toBe(true);
    expect(db.orders.get("order_1")?.status).toBe("fulfilled");

    await hook("refund.processed", refundEvent(500, { amount_refunded: 1500 }));
    expect(db.ledger[0].partial_refund_paise).toBe(1500);
    // an older, smaller total delivered late must not move the figure backwards
    await hook("refund.processed", refundEvent(1000, { amount_refunded: 1000 }));
    expect(db.ledger[0].partial_refund_paise).toBe(1500);
  });

  it("a series of partial refunds that reaches the full amount is handled as the full refund it is", async () => {
    db.applied0045 = true;
    await fulfil();
    const r = await hook("refund.processed", refundEvent(900, { amount_refunded: 5900 }));
    expect(r).toMatchObject({ body: { unlock_refund: "refund.processed" } });
    expect(db.orders.get("order_1")?.status).toBe("refunded");
    expect(db.matches.get("m1")?.unlocked).toBe(false);
  });

  it("is harmless while 0045 is unapplied: still a 200, the refund is just not recorded", async () => {
    await fulfil();
    const r = await hook("refund.processed", refundEvent(1000));
    expect(r).toMatchObject({ handled: true, status: 200, body: { unlock_refund: "partial_ignored", creditNote: false } });
    expect(db.ledger[0].partial_refund_paise).toBeUndefined();
  });

  const taxBase: InvoiceInput = {
    invoiceNo: "HSX-2610-000001", createdAt: "2026-10-05T10:00:00Z", orderId: "order_1", candidateNames: [], candidateCount: 1,
    cashPaise: 5900, creditPaise: 0, refunded: false,
    supplier: { name: "HireStepX Pvt Ltd", address: "", gstin: GSTIN_KARNATAKA },
    buyer: { companyName: "Acme", billingName: "", gstin: "27AAPFU0939F1ZV" },
  };

  it("renders a partial credit note for the refunded amount only, with its own GST split", () => {
    const html = buildInvoiceHtml({ ...taxBase, document: "credit_note", partialRefundPaise: 2950, refundedAt: "2026-10-07T00:00:00Z" });
    expect(html).toContain("No. CN-2610-000001");
    expect(html).toContain("Credit note total (GST inclusive)");
    expect(html).toContain("&minus;₹29.50");
    expect(html).toContain("IGST @ 18%");
    expect(html).toContain("&minus;₹4.50");
    expect(html).toContain("reverse the part of that invoice that was refunded");
    expect(html).not.toContain("&minus;₹59");
  });

  it("points a partially refunded invoice at its credit note", () => {
    expect(buildInvoiceHtml({ ...taxBase, partialRefundPaise: 2950 })).toContain("partially refunded");
  });
});

describe("parseInvoiceSnapshot", () => {
  const good = tax.buildInvoiceSnapshot({
    supplier: { name: "HireStepX Pvt Ltd", address: "Bengaluru", gstin: GSTIN_KARNATAKA.toLowerCase(), sac: "998439" },
    buyer: { companyName: "Acme", billingName: "", gstin: "" },
    cashPaise: 3900, creditPaise: 2000, now: NOW,
  });

  it("round-trips a snapshot through JSON, normalising the GSTIN and using the full price as the taxable base", () => {
    expect(good.supplier.gstin).toBe(GSTIN_KARNATAKA);
    expect(good.buyer.name).toBe("Acme");
    expect(good.breakup.taxablePaise + good.breakup.taxPaise).toBe(5900);
    expect(tax.parseInvoiceSnapshot(JSON.parse(JSON.stringify(good)))).toEqual(good);
  });

  it("treats anything malformed as absent", () => {
    expect(tax.parseInvoiceSnapshot(null)).toBeNull();
    expect(tax.parseInvoiceSnapshot("x")).toBeNull();
    expect(tax.parseInvoiceSnapshot({ ...good, v: 2 })).toBeNull();
    expect(tax.parseInvoiceSnapshot({ ...good, supplier: { ...good.supplier, gstin: 1 } })).toBeNull();
    expect(tax.parseInvoiceSnapshot({ ...good, breakup: { ...good.breakup, lines: [{ label: "x" }] } })).toBeNull();
    expect(tax.parseInvoiceSnapshot({ ...good, breakup: { ...good.breakup, placeOfSupply: { ...good.breakup.placeOfSupply, basis: "bogus" } } })).toBeNull();
  });
});
