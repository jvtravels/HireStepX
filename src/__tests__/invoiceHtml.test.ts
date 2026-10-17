import { describe, it, expect } from "vitest";
import { buildInvoiceHtml, isTaxInvoice, type InvoiceInput } from "../employer/_invoiceHtml";

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
    const html = buildInvoiceHtml({ ...base, supplier: { name: "HireStepX Pvt Ltd", address: "Pune", gstin: "29AABCT1332L1ZA" } });
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
