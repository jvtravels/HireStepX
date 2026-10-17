import { formatPaise } from "../../server-handlers/_unlock-pricing";

export interface InvoiceSupplier {
  name: string;
  address: string;
  gstin: string;
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
  supplier: InvoiceSupplier;
  buyer: InvoiceBuyer;
}

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = (v: string): string => v.replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** A document is only a GST tax invoice when the seller has a GSTIN; until then
 *  it is a payment receipt that still carries the buyer's GSTIN. */
export function isTaxInvoice(supplier: InvoiceSupplier): boolean {
  return supplier.gstin.trim() !== "";
}

export function buildInvoiceHtml(i: InvoiceInput): string {
  const tax = isTaxInvoice(i.supplier);
  const title = tax ? "Tax invoice" : "Payment receipt";
  const date = new Date(i.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const buyerName = i.buyer.billingName.trim() || i.buyer.companyName;
  const supplierName = i.supplier.name.trim() || "HireStepX";
  const total = i.cashPaise + i.creditPaise;
  const described = i.candidateNames.length > 0 ? i.candidateNames.join(", ") : `${i.candidateCount} candidate${i.candidateCount === 1 ? "" : "s"}`;
  const row = (label: string, value: string) => `<tr><td class="k">${escapeHtml(label)}</td><td class="v">${value}</td></tr>`;

  const party = (heading: string, lines: Array<string | null>) =>
    `<div class="party"><h2>${escapeHtml(heading)}</h2>${lines.filter((l): l is string => !!l).map((l) => `<p>${l}</p>`).join("")}</div>`;

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} ${escapeHtml(i.invoiceNo ?? "")}</title>
<style>
body{font:14px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1c1917;margin:0;padding:40px 24px;background:#fff}
main{max-width:720px;margin:0 auto}
h1{font-size:24px;margin:0 0 4px}h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#78716c;margin:0 0 6px}
p{margin:0}.meta{color:#57534e;margin-bottom:28px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}td{padding:10px 0;border-bottom:1px solid #e7e5e4;vertical-align:top}
td.v{text-align:right;font-variant-numeric:tabular-nums}.total td{font-weight:600;border-bottom:0}
.note{color:#57534e;font-size:12px}button{margin-top:24px;padding:10px 16px;font:inherit;border:1px solid #d6d3d1;border-radius:8px;background:#fff;cursor:pointer}
@media print{button{display:none}body{padding:0}}
</style></head><body><main>
<h1>${escapeHtml(title)}</h1>
<p class="meta">${i.invoiceNo ? `No. ${escapeHtml(i.invoiceNo)} · ` : ""}${escapeHtml(date)}${i.orderId && !i.orderId.startsWith("credit_") ? ` · Order ${escapeHtml(i.orderId)}` : ""}</p>
<div class="parties">
${party("From", [`<strong>${escapeHtml(supplierName)}</strong>`, i.supplier.address ? escapeHtml(i.supplier.address) : null, tax ? `GSTIN: ${escapeHtml(i.supplier.gstin)}` : null])}
${party("Billed to", [`<strong>${escapeHtml(buyerName)}</strong>`, i.buyer.gstin ? `GSTIN: ${escapeHtml(i.buyer.gstin)}` : null])}
</div>
<table>
${row("Candidate contact unlock: " + described, escapeHtml(formatPaise(total)))}
${i.creditPaise > 0 ? row("Paid from account credit", `&minus;${escapeHtml(formatPaise(i.creditPaise))}`) : ""}
<tr class="total"><td class="k">Paid by card / UPI</td><td class="v">${escapeHtml(formatPaise(i.cashPaise))}</td></tr>
</table>
${tax ? `<p class="note">Amount shown is inclusive of GST.</p>` : `<p class="note">${escapeHtml(supplierName)} is not yet registered for GST, so this is a payment receipt and not a GST tax invoice.</p>`}
${i.refunded ? `<p class="note">This payment was refunded.</p>` : ""}
<button onclick="window.print()">Print or save as PDF</button>
</main></body></html>`;
}

export function openInvoice(input: InvoiceInput): void {
  const url = URL.createObjectURL(new Blob([buildInvoiceHtml(input)], { type: "text/html" }));
  window.open(url, "_blank", "noopener");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
