import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildInvoiceHtml, canIssueCreditNote, gstBreakup, GST_RATE_PERCENT, invoiceDocKind, isTaxInvoice,
  purchaseAmountLabel, purchaseAmounts, splitInclusiveGst, type InvoiceInput,
  isInvoicePending, documentButtonLabel, openInvoice, INVOICE_URL_TTL_MS, INVOICE_PENDING_NOTE,
} from "../employer/_invoiceHtml";
import { gstinStateCode } from "../../server-handlers/_gstin";

const base: InvoiceInput = {
  invoiceNo: "HSX-2610-0007",
  createdAt: "2026-10-05T10:00:00Z",
  orderId: "order_abc",
  candidateNames: ["Priya Sharma"],
  candidateCount: 1,
  cashPaise: 5900,
  creditPaise: 0,
  refunded: false,
  supplier: { name: "", address: "", gstin: "" },
  buyer: { companyName: "Acme", billingName: "", gstin: "27AAPFU0939F1ZV" },
};

describe("invoice html", () => {
  it("is a payment receipt, not a tax invoice, while the supplier has no GSTIN", () => {
    const html = buildInvoiceHtml(base);
    expect(isTaxInvoice(base.supplier)).toBe(false);
    expect(html).toContain("Payment receipt");
    expect(html).toContain("not a GST tax invoice");
    expect(html).toContain("GSTIN: 27AAPFU0939F1ZV");
    expect(html).toContain("HSX-2610-0007");
  });

  it("becomes a tax invoice and prints both GSTINs once the supplier has one", () => {
    const html = buildInvoiceHtml({ ...base, supplier: { name: "HireStepX Pvt Ltd", address: "Pune", gstin: "29AABCT1332L1ZA", sac: "998439" } });
    expect(html).toContain("Tax invoice");
    expect(html).toContain("GSTIN: 29AABCT1332L1ZA");
    expect(html).toContain("GSTIN: 27AAPFU0939F1ZV");
    expect(html).not.toContain("not a GST tax invoice");
  });

  it("prefers the billing name and shows credit-paid portions", () => {
    const html = buildInvoiceHtml({ ...base, buyer: { ...base.buyer, billingName: "Acme Technologies Pvt Ltd" }, cashPaise: 3900, creditPaise: 2000 });
    expect(html).toContain("Acme Technologies Pvt Ltd");
    expect(html).toContain("Paid from account credit");
  });

  it("escapes user-supplied text and hides synthetic credit order ids", () => {
    const html = buildInvoiceHtml({ ...base, candidateNames: ["<script>alert(1)</script>"], orderId: "credit_123" });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("credit_123");
  });
});

const MH = "27AABCT1332L1ZA"; // Maharashtra
const KA = "29AAPFU0939F1ZV"; // Karnataka
const taxSupplier = { name: "HireStepX Pvt Ltd", address: "Pune", gstin: MH, sac: "998439" };
const taxBase: InvoiceInput = { ...base, supplier: taxSupplier, buyer: { ...base.buyer, gstin: MH }, cashPaise: 11800 };

describe("GST split", () => {
  it("uses an 18% rate constant", () => {
    expect(GST_RATE_PERCENT).toBe(18);
  });

  it("taxable + tax equals the total for every paise amount 100..99999, with taxable the nearest paise", () => {
    for (let total = 100; total <= 99999; total++) {
      const { taxablePaise, taxPaise } = splitInclusiveGst(total);
      expect(taxablePaise + taxPaise).toBe(total);
      expect(Math.abs(taxablePaise * 118 - total * 100)).toBeLessThanOrEqual(59);
      const g = gstBreakup(total, MH, MH);
      expect(g.lines.reduce((n, l) => n + l.paise, 0)).toBe(taxPaise);
      expect(g.lines).toHaveLength(2);
      expect(Math.abs(g.lines[0].paise - g.lines[1].paise)).toBeLessThanOrEqual(1);
    }
  }, 60_000);

  it("splits 11800 paise into 10000 + 1800", () => {
    expect(splitInclusiveGst(11800)).toEqual({ taxablePaise: 10000, taxPaise: 1800 });
  });

  it("charges CGST+SGST within a state and IGST across states", () => {
    expect(gstBreakup(11800, MH, MH).lines.map((l) => l.label)).toEqual(["CGST @ 9%", "SGST @ 9%"]);
    const inter = gstBreakup(11800, MH, KA);
    expect(inter.interState).toBe(true);
    expect(inter.lines).toEqual([{ label: "IGST @ 18%", paise: 1800 }]);
    expect(inter.placeOfSupply).toMatchObject({ code: "29", name: "Karnataka", basis: "buyer_gstin" });
  });

  it("defaults the place of supply to the supplier's state when the buyer has no GSTIN", () => {
    const g = gstBreakup(11800, MH, "");
    expect(g.interState).toBe(false);
    expect(g.placeOfSupply).toMatchObject({ code: "27", basis: "supplier_state" });
    expect(gstBreakup(11800, "XX", "").interState).toBe(true);
  });

  it("reads state codes only from known prefixes", () => {
    expect(gstinStateCode(" 27aabct1332l1za ")).toBe("27");
    expect(gstinStateCode("25AABCT1332L1ZA")).toBeNull();
    expect(gstinStateCode(null)).toBeNull();
  });
});

describe("tax invoice", () => {
  it("shows taxable value, CGST/SGST, place of supply, buyer GSTIN and the job", () => {
    const html = buildInvoiceHtml({ ...taxBase, jobTitle: "Backend Engineer", candidateNames: [] });
    expect(html).toContain("Tax invoice");
    expect(html).toContain("Taxable value");
    expect(html).toContain("CGST @ 9%");
    expect(html).toContain("SGST @ 9%");
    expect(html).not.toContain("IGST");
    expect(html).toContain("Place of supply: Maharashtra (27)");
    expect(html).toContain("GSTIN: " + MH);
    expect(html).toContain("1 contact unlock for the job Backend Engineer");
    expect(html).toContain("SAC: 998439");
  });

  it("uses IGST when the buyer is in another state", () => {
    const html = buildInvoiceHtml({ ...taxBase, buyer: { ...taxBase.buyer, gstin: KA } });
    expect(html).toContain("IGST @ 18%");
    expect(html).not.toContain("CGST");
    expect(html).toContain("Karnataka (29)");
  });

  it("renders the configured SAC, and without one the document is a receipt, not a tax invoice", () => {
    expect(buildInvoiceHtml({ ...taxBase, supplier: { ...taxSupplier, sac: "998599" } })).toContain("SAC: 998599");
    const noSac = buildInvoiceHtml({ ...taxBase, supplier: { ...taxSupplier, sac: "" } });
    expect(noSac).toContain("Payment receipt");
    expect(noSac).not.toContain("CGST");
  });

  it("taxes the full price and shows credit as a separate non-cash line", () => {
    const html = buildInvoiceHtml({ ...taxBase, cashPaise: 9800, creditPaise: 2000 });
    expect(html).toContain("₹100"); // taxable of 11800 total
  });

  it("never claims a tax breakup without a supplier GSTIN", () => {
    const html = buildInvoiceHtml({ ...base, cashPaise: 11800 });
    expect(html).toContain("Payment receipt");
    for (const word of ["CGST", "SGST", "IGST", "Taxable value", "Place of supply", "inclusive of GST"]) expect(html).not.toContain(word);
  });

  it("escapes job titles", () => {
    const html = buildInvoiceHtml({ ...taxBase, jobTitle: "<img src=x onerror=1>" });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

describe("credit note", () => {
  const cn: InvoiceInput = { ...taxBase, document: "credit_note", refunded: true, refundedAt: "2026-10-09T10:00:00Z" };

  it("is numbered CND-<invoice no> when no credit-note row exists, references the original and negates the same breakup", () => {
    const html = buildInvoiceHtml(cn);
    expect(html).toContain("<h1>Credit note</h1>");
    expect(html).toContain("No. CND-2610-0007");
    expect(html).toContain("against tax invoice HSX-2610-0007 dated 5 October 2026");
    expect(html).toContain("9 October 2026");
    expect(html).toContain("CGST @ 9%");
    expect(html).toMatch(/&minus;₹100/);
    expect(html).toMatch(/&minus;₹118/);
  });

  it("is offered only for refunded cash purchases with a tax invoice", () => {
    const p = { invoiceNo: "HSX-1", refundedAt: "2026-10-09" };
    expect(canIssueCreditNote(p, taxSupplier)).toBe(true);
    expect(canIssueCreditNote({ ...p, refundedAt: null, orderStatus: "refunded" }, taxSupplier)).toBe(true);
    expect(canIssueCreditNote({ ...p, refundedAt: null }, taxSupplier)).toBe(false);
    expect(canIssueCreditNote({ ...p, invoiceNo: null }, taxSupplier)).toBe(false);
    expect(canIssueCreditNote(p, { ...taxSupplier, gstin: "" })).toBe(false);
  });

  it("is also offered for a standing purchase that has a credit note on file (a match refunded as credit)", () => {
    const p = { invoiceNo: "HSX-1", refundedAt: null };
    expect(canIssueCreditNote(p, taxSupplier)).toBe(false);
    expect(canIssueCreditNote({ ...p, creditNotes: [] }, taxSupplier)).toBe(false);
    expect(canIssueCreditNote({ ...p, creditNotes: [{}] }, taxSupplier)).toBe(true);
    expect(canIssueCreditNote({ ...p, invoiceNo: null, creditNotes: [{}] }, taxSupplier)).toBe(false);
  });

  it("points a refunded tax invoice at its credit note", () => {
    expect(buildInvoiceHtml({ ...taxBase, refunded: true })).toContain("see credit note CND-2610-0007");
  });
});

describe("credit-only purchases", () => {
  const redemption: InvoiceInput = { ...taxBase, invoiceNo: null, cashPaise: 0, creditPaise: 5900, orderId: "credit_1" };

  it("is a credit redemption receipt without a document number", () => {
    expect(invoiceDocKind(redemption)).toBe("credit_redemption");
    const html = buildInvoiceHtml(redemption);
    expect(html).toContain("Credit redemption");
    expect(html).not.toContain("HSX-2610-0007");
    expect(html).not.toContain("No. ");
    expect(html).not.toContain("CGST");
    expect(html).not.toContain("Tax invoice");
  });

  it("never becomes a credit note while it has no invoice number", () => {
    expect(invoiceDocKind({ ...redemption, document: "credit_note" })).toBe("credit_redemption");
  });

  it("is a GST tax invoice once redemption has an invoice number, and can carry a credit note", () => {
    const numbered: InvoiceInput = { ...redemption, invoiceNo: "HSX-2610-0008" };
    expect(invoiceDocKind(numbered)).toBe("tax_invoice");
    const html = buildInvoiceHtml(numbered);
    expect(html).toContain("<h1>Tax invoice</h1>");
    expect(html).toContain("No. HSX-2610-0008");
    expect(html).toContain("CGST @ 9%");
    expect(html).toContain("Of which paid from account credit (not cash)");
    expect(invoiceDocKind({ ...numbered, document: "credit_note" })).toBe("credit_note");
    expect(invoiceDocKind({ ...numbered, supplier: { ...taxSupplier, gstin: "" } })).toBe("receipt");
  });
});

describe("one amount derivation for history and documents", () => {
  it("totals cash + credit in both", () => {
    const p = { amount: 3900, creditAppliedPaise: 2000 };
    expect(purchaseAmounts(p)).toEqual({ cashPaise: 3900, creditPaise: 2000, totalPaise: 5900 });
    expect(purchaseAmountLabel(p)).toContain("59");
    expect(purchaseAmountLabel({ amount: 0, creditAppliedPaise: 5900 })).toContain("from credit");
    expect(purchaseAmountLabel({ amount: 0 })).toBe("Complimentary");
    expect(purchaseAmountLabel({ amount: 5900 })).toBe(purchaseAmountLabel({ amount: 5900, creditAppliedPaise: 0 }));
  });
});

describe("isInvoicePending", () => {
  it("is true for a paid cash purchase with no number yet", () => {
    expect(isInvoicePending({ amount: 5900, invoiceNo: null })).toBe(true);
    expect(isInvoicePending({ amount: 5900 })).toBe(true);
  });
  it("is false once numbered, for a refunded purchase and for a purchase with no cash", () => {
    expect(isInvoicePending({ amount: 5900, invoiceNo: "HSX-2610-000001" })).toBe(false);
    expect(isInvoicePending({ amount: 5900, invoiceNo: null, refundedAt: "2026-10-11T00:00:00Z" })).toBe(false);
    expect(isInvoicePending({ amount: 5900, invoiceNo: null, orderStatus: "refunded" })).toBe(false);
    expect(isInvoicePending({ amount: 0, invoiceNo: null })).toBe(false);
  });
  it("the note carries no em dash", () => {
    expect(INVOICE_PENDING_NOTE).not.toContain("\u2014");
  });
});

describe("documentButtonLabel", () => {
  const when = "2026-10-05T10:00:00Z";
  it("names the candidates and the date so each row's button is distinguishable", () => {
    const label = documentButtonLabel("Download invoice", { invoiceNo: "HSX-2610-000001", createdAt: when, candidates: [{ name: "Priya" }, { name: "Ravi" }, { name: "Asha" }, { name: null }] });
    expect(label).toContain("Download invoice HSX-2610-000001 for Priya, Ravi and 1 more");
    expect(label).toContain("2026");
  });
  it("falls back to a candidate count when no names are known, and pluralises it", () => {
    expect(documentButtonLabel("Credit note", { createdAt: when, matchIds: ["a"] })).toMatch(/^Credit note for 1 candidate, /);
    expect(documentButtonLabel("Credit note", { createdAt: when, matchIds: ["a", "b"] })).toMatch(/^Credit note for 2 candidates, /);
  });
});

describe("openInvoice blob lifetime", () => {
  // A test that leaves a blob un-revoked must not leak its pagehide listener into the next one.
  afterEach(() => { window.dispatchEvent(new Event("pagehide")); vi.useRealTimers(); vi.restoreAllMocks(); });
  const realCreate = URL.createObjectURL;
  const realRevoke = URL.revokeObjectURL;
  afterEach(() => { URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; });
  const setup = () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:invoice-1");
    const revoke = vi.fn();
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    return { create, revoke, open };
  };

  it("opens the blob in a new tab and keeps it alive for a reload or print", () => {
    const { open, revoke } = setup();
    openInvoice(base);
    expect(open).toHaveBeenCalledWith("blob:invoice-1", "_blank", "noopener");
    vi.advanceTimersByTime(INVOICE_URL_TTL_MS - 1000);
    expect(revoke).not.toHaveBeenCalled();
  });

  it("revokes it after the TTL, once", () => {
    const { revoke } = setup();
    openInvoice(base);
    vi.advanceTimersByTime(INVOICE_URL_TTL_MS + 1);
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:invoice-1");
    window.dispatchEvent(new Event("pagehide"));
    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it("revokes it early when the page is left, and the timer then does nothing", () => {
    const { revoke } = setup();
    openInvoice(base);
    window.dispatchEvent(new Event("pagehide"));
    expect(revoke).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(INVOICE_URL_TTL_MS * 2);
    expect(revoke).toHaveBeenCalledTimes(1);
  });
});
