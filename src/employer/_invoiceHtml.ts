import { isTaxInvoiceReady } from "../../data/legal-entity";
import { formatPaise } from "../../server-handlers/_unlock-pricing";
import { creditNoteNumber, gstBreakup, GST_RATE_PERCENT, type InvoiceSnapshot } from "../../server-handlers/_unlock-tax";

// The tax maths lives in server-handlers/_unlock-tax.ts so fulfilment can freeze it into the ledger row.
export { GST_RATE_PERCENT, splitInclusiveGst, gstBreakup, creditNoteNumber, PLACE_OF_SUPPLY_WITHOUT_BUYER_GSTIN } from "../../server-handlers/_unlock-tax";
export type { GstBreakup, InvoiceSnapshot } from "../../server-handlers/_unlock-tax";

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
  /** When a partial refund happened; dates the credit note when no explicit one is passed. */
  partialRefundAt?: string | null;
  /** Job the unlock was bought for, when known. */
  jobTitle?: string | null;
  /** "credit_note" renders the credit note for a refunded purchase. */
  document?: "invoice" | "credit_note";
  /** Cumulative paise refunded on a purchase that was only partly refunded; the credit note covers this amount. */
  partialRefundPaise?: number;
  /** The specific credit note to render (one row per refund). Its number, date and amount win over the
   *  derived ones; omitted for legacy rows, which fall back to `creditNoteNumber(invoiceNo)`. */
  creditNote?: { no: string; amountPaise: number; issuedAt: string } | null;
  /** Frozen supplier/buyer/tax data from fulfilment (migration 0045). When present it wins over
   *  `supplier`/`buyer`, so a later env or profile change cannot rewrite an issued document.
   *  Absent on legacy rows, which render from the live values. */
  snapshot?: InvoiceSnapshot | null;
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

/** Refunded in part only: some money went back but the purchase still stands. */
export function isPartiallyRefundedPurchase(p: { refundedAt?: string | null; orderStatus?: string | null; partialRefundPaise?: number | null }): boolean {
  return !isRefundedPurchase(p) && (p.partialRefundPaise ?? 0) > 0;
}

export type InvoiceDocKind = "tax_invoice" | "credit_note" | "receipt" | "credit_redemption";

export function invoiceDocKind(i: Pick<InvoiceInput, "invoiceNo" | "cashPaise" | "supplier" | "document" | "snapshot">): InvoiceDocKind {
  // A credit-only purchase carries an invoice number once redemption became a taxed supply; older ones have none.
  if (i.cashPaise <= 0 && !i.invoiceNo) return "credit_redemption";
  if (!isTaxInvoice(i.snapshot?.supplier ?? i.supplier)) return "receipt";
  return i.document === "credit_note" && i.invoiceNo ? "credit_note" : "tax_invoice";
}

/** A credit note exists for a refunded purchase, or one with a credit note on file (a match refunded as
 *  credit leaves the purchase standing), that carries a real tax invoice. Credit-only purchases qualify
 *  too: their invoice number is the proof they were taxed.
 *  Pass the snapshot's supplier when the row has one, so the decision matches what was issued. */
export function canIssueCreditNote(
  p: { invoiceNo?: string | null; refundedAt?: string | null; orderStatus?: string | null; partialRefundPaise?: number | null; creditNotes?: readonly unknown[] | null },
  supplier: InvoiceSupplier,
): boolean {
  return !!p.invoiceNo && isTaxInvoice(supplier) && (isRefundedPurchase(p) || isPartiallyRefundedPurchase(p) || (p.creditNotes?.length ?? 0) > 0);
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (v: string): string => v.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** A document is only a GST tax invoice when the seller has a valid GSTIN, name, address and SAC;
 *  until then it is a payment receipt that still carries the buyer's GSTIN. */
export function isTaxInvoice(supplier: InvoiceSupplier): boolean {
  return isTaxInvoiceReady(supplier);
}

export function buildInvoiceHtml(i: InvoiceInput): string {
  const kind = invoiceDocKind(i);
  const snap = i.snapshot ?? null;
  const supplier = snap ? snap.supplier : i.supplier;
  const buyer = snap ? { companyName: snap.buyer.name, billingName: snap.buyer.name, gstin: snap.buyer.gstin } : i.buyer;
  const ratePercent = snap?.ratePercent ?? GST_RATE_PERCENT;
  const taxDoc = kind === "tax_invoice" || kind === "credit_note";
  const creditNote = kind === "credit_note";
  const title = { tax_invoice: "Tax invoice", credit_note: "Credit note", receipt: "Payment receipt", credit_redemption: "Credit redemption" }[kind];
  // Pinned to IST: the invoice number's YYMM is the IST month, so the printed date must agree with it
  // whatever timezone the viewer's browser is in.
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const note = i.creditNote ?? null;
  const docDate = fmtDate(creditNote ? note?.issuedAt || i.refundedAt || i.partialRefundAt || i.createdAt : i.createdAt);
  const derivedNoteNo = creditNoteNumber(i.invoiceNo ?? "");
  const docNo = creditNote ? note?.no ?? derivedNoteNo : kind === "credit_redemption" ? null : i.invoiceNo;
  const buyerName = buyer.billingName.trim() || buyer.companyName;
  const supplierName = supplier.name.trim() || "HireStepX";
  const invoiceTotal = i.cashPaise + i.creditPaise;
  const noteAmount = note ? note.amountPaise : i.refunded ? 0 : i.partialRefundPaise ?? 0;
  const partial = creditNote && noteAmount > 0 && noteAmount < invoiceTotal;
  // A partial credit note reverses only the refunded amount; a full one reverses the whole invoice.
  const total = partial ? noteAmount : invoiceTotal;
  const sign = creditNote ? "&minus;" : "";
  const money = (paise: number) => `${sign}${escapeHtml(formatPaise(paise))}`;
  const unlocks = `${i.candidateCount} contact unlock${i.candidateCount === 1 ? "" : "s"}`;
  const described = i.candidateNames.length > 0 ? `${unlocks} (${i.candidateNames.join(", ")})` : unlocks;
  const forJob = i.jobTitle?.trim() ? ` for the job ${i.jobTitle.trim()}` : "";
  const itemLabel = `Candidate ${described}${forJob}`;
  const sac = taxDoc && supplier.sac?.trim() ? supplier.sac.trim() : "";

  const party = (heading: string, lines: Array<string | null>) =>
    `<div class="party"><h2>${escapeHtml(heading)}</h2>${lines.filter((l): l is string => !!l).map((l) => `<p>${l}</p>`).join("")}</div>`;

  let rows: string;
  let notes: string;
  if (taxDoc) {
    // The frozen breakup is exact for the original invoice; a partial credit note needs its own split.
    const g = snap && !partial ? snap.breakup : gstBreakup(total, supplier.gstin, buyer.gstin, ratePercent);
    const pos = g.placeOfSupply;
    const posText = pos.name
      ? `${pos.name} (${pos.code})${pos.basis === "buyer_gstin" ? ", the state of the buyer's GSTIN" : ", the supplier's state (the buyer has no GSTIN)"}`
      : "not determined";
    rows = `<tr><td class="k">${escapeHtml(itemLabel)}${sac ? `<br><span class="note">SAC: ${escapeHtml(sac)}</span>` : ""}</td><td class="v">${money(g.taxablePaise)}</td></tr>
<tr><td class="k">Taxable value</td><td class="v">${money(g.taxablePaise)}</td></tr>
${g.lines.map((l) => `<tr><td class="k">${escapeHtml(l.label)}</td><td class="v">${money(l.paise)}</td></tr>`).join("\n")}
<tr class="total"><td class="k">${creditNote ? "Credit note total (GST inclusive)" : "Invoice total (GST inclusive)"}</td><td class="v">${money(total)}</td></tr>
${i.creditPaise > 0 && !partial ? `<tr><td class="k">Of which paid from account credit (not cash)</td><td class="v">${money(i.creditPaise)}</td></tr>` : ""}
<tr><td class="k">${creditNote ? "Cash refunded or returned as credit" : "Paid by card / UPI"}</td><td class="v">${money(partial ? total : i.cashPaise)}</td></tr>`;
    notes = `<p class="note">Place of supply: ${escapeHtml(posText)}.</p>`
      + (creditNote ? `<p class="note">Credit note against tax invoice ${escapeHtml(i.invoiceNo ?? "")} dated ${escapeHtml(fmtDate(i.createdAt))}. ${partial ? "Amounts reverse the part of that invoice that was refunded." : "All amounts reverse that invoice."}</p>` : "")
      + (!creditNote && i.refunded ? `<p class="note">This payment was refunded; see credit note ${escapeHtml(note?.no ?? derivedNoteNo)}.</p>` : "")
      + (!creditNote && !i.refunded && (i.partialRefundPaise ?? 0) > 0 ? `<p class="note">This payment was partially refunded (${escapeHtml(formatPaise(i.partialRefundPaise ?? 0))}); see credit note ${escapeHtml(note?.no ?? derivedNoteNo)}.</p>` : "");
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
${party("From", [`<strong>${escapeHtml(supplierName)}</strong>`, supplier.address ? escapeHtml(supplier.address) : null, taxDoc ? `GSTIN: ${escapeHtml(supplier.gstin)}` : null])}
${party("Billed to", [`<strong>${escapeHtml(buyerName)}</strong>`, buyer.gstin ? `GSTIN: ${escapeHtml(buyer.gstin)}` : null])}
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
