import { formatPaise } from "../../server-handlers/_unlock-pricing";
import { GST_STATE_NAMES, gstinStateCode } from "../../server-handlers/_gstin";

/** GST rate on the unlock service, in percent. The single source for every tax figure. */
export const GST_RATE_PERCENT = 18;

export interface InvoiceSupplier {
  name: string;
  address: string;
  gstin: string;
  /** SAC code; rendered only when set, never defaulted. */
  sac?: string;
}

export interface InvoiceBuyer {
  companyName: string;
  billingName: string;
  gstin: string;
}

export interface InvoiceInput {
  invoiceNo: string | null;
  createdAt: string;
  orderId: string | null;
  candidateNames: string[];
  candidateCount: number;
  cashPaise: number;
  creditPaise: number;
  refunded: boolean;
  /** When the refund happened; the credit note is dated with it. */
  refundedAt?: string | null;
  /** Job the unlock was bought for, when known. */
  jobTitle?: string | null;
  /** "credit_note" renders the credit note for a refunded purchase. */
  document?: "invoice" | "credit_note";
  supplier: InvoiceSupplier;
  buyer: InvoiceBuyer;
}

/* ── Amounts (single derivation shared by billing history and the documents) ── */

/** The ledger `amount` is the cash part only; the price of the unlock is cash + account credit. */
export function purchaseAmounts(p: { amount: number; creditAppliedPaise?: number }): { cashPaise: number; creditPaise: number; totalPaise: number } {
  const cashPaise = Math.max(0, p.amount);
  const creditPaise = Math.max(0, p.creditAppliedPaise ?? 0);
  return { cashPaise, creditPaise, totalPaise: cashPaise + creditPaise };
}

/** What billing history shows in the Amount column; its total equals the document total. */
export function purchaseAmountLabel(p: { amount: number; creditAppliedPaise?: number }): string {
  const { cashPaise, creditPaise, totalPaise } = purchaseAmounts(p);
  if (totalPaise === 0) return "Complimentary";
  if (cashPaise === 0) return `${formatPaise(creditPaise)} from credit`;
  return creditPaise > 0 ? `${formatPaise(totalPaise)} (${formatPaise(cashPaise)} + ${formatPaise(creditPaise)} credit)` : formatPaise(cashPaise);
}

export function isRefundedPurchase(p: { refundedAt?: string | null; orderStatus?: string | null }): boolean {
  return !!p.refundedAt || p.orderStatus === "refunded";
}

/* ── GST ── */

/** Splits a GST-inclusive total into taxable value and tax, to the paise, so taxable + tax === total.
 *  Assumption for the CA: account credit is treated as a prepayment/discount, so the taxable base
 *  is the full price (cash + credit), not the cash part alone. */
export function splitInclusiveGst(totalPaise: number, ratePercent: number = GST_RATE_PERCENT): { taxablePaise: number; taxPaise: number } {
  const total = Math.max(0, Math.round(totalPaise));
  const divisor = 100 + ratePercent;
  // round-half-up of total * 100 / divisor, in integers so there is no float drift
  const taxablePaise = Math.floor((200 * total + divisor) / (2 * divisor));
  return { taxablePaise, taxPaise: total - taxablePaise };
}

export interface GstBreakup {
  taxablePaise: number;
  taxPaise: number;
  interState: boolean;
  lines: Array<{ label: string; paise: number }>;
  placeOfSupply: { code: string | null; name: string | null; basis: "buyer_gstin" | "supplier_state" | "unknown" };
}

/** Place of supply: the state of the buyer's GSTIN when there is one; otherwise the supplier's own
 *  state (the default for a buyer with no GSTIN). Same state as the supplier means CGST + SGST,
 *  anything else (or an unreadable supplier state) means IGST. */
export function gstBreakup(totalPaise: number, supplierGstin: string, buyerGstin: string): GstBreakup {
  const { taxablePaise, taxPaise } = splitInclusiveGst(totalPaise);
  const supplierState = gstinStateCode(supplierGstin);
  const buyerState = gstinStateCode(buyerGstin);
  const posCode = buyerState ?? supplierState;
  const interState = supplierState == null || posCode !== supplierState;
  const half = GST_RATE_PERCENT / 2;
  const cgst = Math.floor(taxPaise / 2);
  const lines = interState
    ? [{ label: `IGST @ ${GST_RATE_PERCENT}%`, paise: taxPaise }]
    : [{ label: `CGST @ ${half}%`, paise: cgst }, { label: `SGST @ ${half}%`, paise: taxPaise - cgst }];
  return {
    taxablePaise,
    taxPaise,
    interState,
    lines,
    placeOfSupply: {
      code: posCode,
      name: posCode ? GST_STATE_NAMES[posCode] ?? null : null,
      basis: buyerState ? "buyer_gstin" : supplierState ? "supplier_state" : "unknown",
    },
  };
}

export type InvoiceDocKind = "tax_invoice" | "credit_note" | "receipt" | "credit_redemption";

export function invoiceDocKind(i: Pick<InvoiceInput, "invoiceNo" | "cashPaise" | "supplier" | "document">): InvoiceDocKind {
  if (i.cashPaise <= 0) return "credit_redemption";
  if (!isTaxInvoice(i.supplier)) return "receipt";
  return i.document === "credit_note" && i.invoiceNo ? "credit_note" : "tax_invoice";
}

/** A credit note exists only for a refunded cash purchase that carries a real tax invoice. */
export function canIssueCreditNote(p: { invoiceNo?: string | null; amount: number; refundedAt?: string | null; orderStatus?: string | null }, supplier: InvoiceSupplier): boolean {
  return !!p.invoiceNo && p.amount > 0 && isTaxInvoice(supplier) && isRefundedPurchase(p);
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (v: string): string => v.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** A document is only a GST tax invoice when the seller has a GSTIN; until then
 *  it is a payment receipt that still carries the buyer's GSTIN. */
export function isTaxInvoice(supplier: InvoiceSupplier): boolean {
  return supplier.gstin.trim() !== "";
}

export function buildInvoiceHtml(i: InvoiceInput): string {
  const kind = invoiceDocKind(i);
  const taxDoc = kind === "tax_invoice" || kind === "credit_note";
  const creditNote = kind === "credit_note";
  const title = { tax_invoice: "Tax invoice", credit_note: "Credit note", receipt: "Payment receipt", credit_redemption: "Credit redemption" }[kind];
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const docDate = fmtDate(creditNote ? i.refundedAt || i.createdAt : i.createdAt);
  const docNo = creditNote ? `CN-${i.invoiceNo}` : kind === "credit_redemption" ? null : i.invoiceNo;
  const buyerName = i.buyer.billingName.trim() || i.buyer.companyName;
  const supplierName = i.supplier.name.trim() || "HireStepX";
  const total = i.cashPaise + i.creditPaise;
  const sign = creditNote ? "&minus;" : "";
  const money = (paise: number) => `${sign}${escapeHtml(formatPaise(paise))}`;
  const unlocks = `${i.candidateCount} contact unlock${i.candidateCount === 1 ? "" : "s"}`;
  const described = i.candidateNames.length > 0 ? `${unlocks} (${i.candidateNames.join(", ")})` : unlocks;
  const forJob = i.jobTitle?.trim() ? ` for the job ${i.jobTitle.trim()}` : "";
  const itemLabel = `Candidate ${described}${forJob}`;
  const sac = taxDoc && i.supplier.sac?.trim() ? i.supplier.sac.trim() : "";

  const party = (heading: string, lines: Array<string | null>) =>
    `<div class="party"><h2>${escapeHtml(heading)}</h2>${lines.filter((l): l is string => !!l).map((l) => `<p>${l}</p>`).join("")}</div>`;

  let rows: string;
  let notes: string;
  if (taxDoc) {
    const g = gstBreakup(total, i.supplier.gstin, i.buyer.gstin);
    const pos = g.placeOfSupply;
    const posText = pos.name
      ? `${pos.name} (${pos.code})${pos.basis === "buyer_gstin" ? ", the state of the buyer's GSTIN" : ", the supplier's state (the buyer has no GSTIN)"}`
      : "not determined";
    rows = `<tr><td class="k">${escapeHtml(itemLabel)}${sac ? `<br><span class="note">SAC: ${escapeHtml(sac)}</span>` : ""}</td><td class="v">${money(g.taxablePaise)}</td></tr>
<tr><td class="k">Taxable value</td><td class="v">${money(g.taxablePaise)}</td></tr>
${g.lines.map((l) => `<tr><td class="k">${escapeHtml(l.label)}</td><td class="v">${money(l.paise)}</td></tr>`).join("\n")}
<tr class="total"><td class="k">${creditNote ? "Credit note total (GST inclusive)" : "Invoice total (GST inclusive)"}</td><td class="v">${money(total)}</td></tr>
${i.creditPaise > 0 ? `<tr><td class="k">Of which paid from account credit (not cash)</td><td class="v">${money(i.creditPaise)}</td></tr>` : ""}
<tr><td class="k">${creditNote ? "Cash refunded or returned as credit" : "Paid by card / UPI"}</td><td class="v">${money(i.cashPaise)}</td></tr>`;
    notes = `<p class="note">Place of supply: ${escapeHtml(posText)}.</p>`
      + (creditNote ? `<p class="note">Credit note against tax invoice ${escapeHtml(i.invoiceNo ?? "")} dated ${escapeHtml(fmtDate(i.createdAt))}. All amounts reverse that invoice.</p>` : "")
      + (!creditNote && i.refunded ? `<p class="note">This payment was refunded; see credit note CN-${escapeHtml(i.invoiceNo ?? "")}.</p>` : "");
  } else if (kind === "credit_redemption") {
    rows = `<tr><td class="k">${escapeHtml(itemLabel)}</td><td class="v">${escapeHtml(formatPaise(total))}</td></tr>
<tr class="total"><td class="k">Paid from account credit (not cash)</td><td class="v">${escapeHtml(formatPaise(i.creditPaise))}</td></tr>`;
    notes = `<p class="note">Settled entirely from account credit; no new payment was taken. This is a receipt, not a tax invoice.</p>`
      + (i.refunded ? `<p class="note">This purchase was reversed.</p>` : "");
  } else {
    rows = `<tr><td class="k">${escapeHtml(itemLabel)}</td><td class="v">${escapeHtml(formatPaise(total))}</td></tr>
${i.creditPaise > 0 ? `<tr><td class="k">Paid from account credit (not cash)</td><td class="v">&minus;${escapeHtml(formatPaise(i.creditPaise))}</td></tr>` : ""}
<tr class="total"><td class="k">Paid by card / UPI</td><td class="v">${escapeHtml(formatPaise(i.cashPaise))}</td></tr>`;
    notes = `<p class="note">${escapeHtml(supplierName)} is not yet registered for GST, so this is a payment receipt and not a GST tax invoice.</p>`
      + (i.refunded ? `<p class="note">This payment was refunded.</p>` : "");
  }

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} ${escapeHtml(docNo ?? "")}</title>
<style>
body{font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917;margin:0;padding:40px 24px;background:#fff}
main{max-width:720px;margin:0 auto}
h1{font-size:24px;margin:0 0 4px}h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#78716c;margin:0 0 6px}
p{margin:0}.meta{color:#57534e;margin-bottom:28px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}td{padding:10px 0;border-bottom:1px solid #e7e5e4;vertical-align:top}
td.v{text-align:right;font-variant-numeric:tabular-nums}.total td{font-weight:600}
.note{color:#57534e;font-size:12px;margin-bottom:4px}button{margin-top:24px;padding:10px 16px;font:inherit;border:1px solid #d6d3d1;border-radius:8px;background:#fff;cursor:pointer}
@media print{button{display:none}body{padding:0}}
</style></head><body><main>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${docNo ? `No. ${escapeHtml(docNo)} · ` : ""}${escapeHtml(docDate)}${i.orderId && !i.orderId.startsWith("credit_") ? ` · Order ${escapeHtml(i.orderId)}` : ""}</p>
<div class="parties">
${party("From", [`<strong>${escapeHtml(supplierName)}</strong>`, i.supplier.address ? escapeHtml(i.supplier.address) : null, taxDoc ? `GSTIN: ${escapeHtml(i.supplier.gstin)}` : null])}
${party("Billed to", [`<strong>${escapeHtml(buyerName)}</strong>`, i.buyer.gstin ? `GSTIN: ${escapeHtml(i.buyer.gstin)}` : null])}
</div>
<table>
${rows}
</table>
${notes}
<button onclick="window.print()">Print or save as PDF</button>
</main></body></html>`;
}

export function openInvoice(input: InvoiceInput): void {
  const url = URL.createObjectURL(new Blob([buildInvoiceHtml(input)], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
