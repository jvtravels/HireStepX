/* GST maths and the immutable invoice snapshot for employer unlock purchases.
 *
 * Pure and shared: fulfilment writes the snapshot onto the ledger row, the
 * history endpoint returns it, and the invoice renderer (src/employer/_invoiceHtml.ts)
 * reads it, so a document never changes after it was issued even when the
 * supplier's env or the buyer's profile does. */

import { GST_STATE_NAMES, gstinStateCode } from "./_gstin";

/** GST rate on the unlock service, in percent. The single source for every tax figure. */
export const GST_RATE_PERCENT = 18;

export type PlaceOfSupplyBasis = "buyer_gstin" | "supplier_state" | "unknown";

/** Place of supply is the state of the buyer's GSTIN. A buyer with no GSTIN
 *  has no state on file, so we DEFAULT to the supplier's own state (CGST+SGST).
 *  This is a deliberate, unreviewed assumption: for an unregistered buyer in
 *  another state the law may require the buyer's address state (IGST) instead.
 *  Open question for the CA; change it here and nowhere else. */
export const PLACE_OF_SUPPLY_WITHOUT_BUYER_GSTIN: Exclude<PlaceOfSupplyBasis, "buyer_gstin" | "unknown"> = "supplier_state";

/** Tax treatments implemented as working assumptions that a chartered accountant has not signed off.
 *  Remove an entry only with that sign-off; the test pins the list so one cannot be dropped silently. */
export const TAX_TREATMENTS_PENDING_CA_REVIEW = [
  "place_of_supply_defaults_to_supplier_state_without_buyer_gstin",
  "account_credit_is_a_prepayment_so_taxable_base_is_cash_plus_credit",
  "credit_only_redemption_is_invoiced_when_the_unlock_happens",
  "refund_as_credit_is_reversed_by_a_credit_note",
] as const;

export function resolvePlaceOfSupply(supplierGstin: string, buyerGstin: string): { code: string | null; basis: PlaceOfSupplyBasis } {
  const buyerState = gstinStateCode(buyerGstin);
  if (buyerState) return { code: buyerState, basis: "buyer_gstin" };
  const supplierState = gstinStateCode(supplierGstin);
  return supplierState ? { code: supplierState, basis: PLACE_OF_SUPPLY_WITHOUT_BUYER_GSTIN } : { code: null, basis: "unknown" };
}

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
  placeOfSupply: { code: string | null; name: string | null; basis: PlaceOfSupplyBasis };
}

/** Same state as the supplier means CGST + SGST; anything else (or an unreadable supplier state) means IGST. */
export function gstBreakup(totalPaise: number, supplierGstin: string, buyerGstin: string, ratePercent: number = GST_RATE_PERCENT): GstBreakup {
  const { taxablePaise, taxPaise } = splitInclusiveGst(totalPaise, ratePercent);
  const supplierState = gstinStateCode(supplierGstin);
  const pos = resolvePlaceOfSupply(supplierGstin, buyerGstin);
  const interState = supplierState == null || pos.code !== supplierState;
  const half = ratePercent / 2;
  // An odd paisa of tax goes to CGST, so SGST is never the larger half (the two must still sum to the tax).
  const cgst = Math.ceil(taxPaise / 2);
  const lines = interState
    ? [{ label: `IGST @ ${ratePercent}%`, paise: taxPaise }]
    : [{ label: `CGST @ ${half}%`, paise: cgst }, { label: `SGST @ ${half}%`, paise: taxPaise - cgst }];
  return {
    taxablePaise,
    taxPaise,
    interState,
    lines,
    placeOfSupply: { code: pos.code, name: pos.code ? GST_STATE_NAMES[pos.code] ?? null : null, basis: pos.basis },
  };
}

/** Fallback number for a credit note that has no numbered row yet (migration 0047/0054 unapplied, or the
 *  assignment has not succeeded yet). Numbered notes come from the gap-free HCN-<FY>-NNNNNN series (0054) or,
 *  for notes issued earlier, the legacy CN-YYMM-NNNNNN sequence; this derived form uses its own CND- prefix so
 *  it can never equal either. GST rule 46 caps a document number at 16 characters, so the invoice's "HSX-"
 *  series prefix is dropped rather than stacked. */
export function creditNoteNumber(invoiceNo: string): string {
  return `CND-${invoiceNo.replace(/^HSX-/, "")}`.slice(0, 16);
}

/* ── Snapshot ── */

export interface InvoiceSnapshot {
  v: 1;
  supplier: { name: string; address: string; gstin: string; sac: string };
  buyer: { name: string; gstin: string };
  ratePercent: number;
  cashPaise: number;
  creditPaise: number;
  breakup: GstBreakup;
  takenAt: string;
}

export interface SnapshotInput {
  supplier: { name: string; address: string; gstin: string; sac?: string };
  buyer: { companyName: string; billingName: string; gstin: string };
  cashPaise: number;
  creditPaise: number;
  now: Date;
}

export function buildInvoiceSnapshot(i: SnapshotInput): InvoiceSnapshot {
  const supplier = {
    name: i.supplier.name.trim(), address: i.supplier.address.trim(),
    gstin: i.supplier.gstin.trim().toUpperCase(), sac: (i.supplier.sac ?? "").trim(),
  };
  const buyer = { name: i.buyer.billingName.trim() || i.buyer.companyName.trim(), gstin: i.buyer.gstin.trim().toUpperCase() };
  const cashPaise = Math.max(0, Math.round(i.cashPaise));
  const creditPaise = Math.max(0, Math.round(i.creditPaise));
  return {
    v: 1, supplier, buyer, ratePercent: GST_RATE_PERCENT, cashPaise, creditPaise,
    breakup: gstBreakup(cashPaise + creditPaise, supplier.gstin, buyer.gstin),
    takenAt: i.now.toISOString(),
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Validates the jsonb read back from the database / API; anything malformed is treated as absent. */
export function parseInvoiceSnapshot(raw: unknown): InvoiceSnapshot | null {
  if (!isObj(raw) || raw.v !== 1 || !isObj(raw.supplier) || !isObj(raw.buyer) || !isObj(raw.breakup)) return null;
  const { supplier, buyer, breakup } = raw;
  const pos = isObj(breakup.placeOfSupply) ? breakup.placeOfSupply : null;
  const basis = pos?.basis;
  const lines = Array.isArray(breakup.lines) ? breakup.lines : null;
  const fields = {
    sName: str(supplier.name), sAddr: str(supplier.address), sGstin: str(supplier.gstin), sSac: str(supplier.sac),
    bName: str(buyer.name), bGstin: str(buyer.gstin),
    rate: num(raw.ratePercent), cash: num(raw.cashPaise), credit: num(raw.creditPaise), takenAt: str(raw.takenAt),
    taxable: num(breakup.taxablePaise), tax: num(breakup.taxPaise),
  };
  if (Object.values(fields).some((v) => v === null) || !pos || !lines || typeof breakup.interState !== "boolean") return null;
  if (basis !== "buyer_gstin" && basis !== "supplier_state" && basis !== "unknown") return null;
  const parsedLines: Array<{ label: string; paise: number }> = [];
  for (const l of lines) {
    if (!isObj(l) || str(l.label) === null || num(l.paise) === null) return null;
    parsedLines.push({ label: l.label as string, paise: l.paise as number });
  }
  return {
    v: 1,
    supplier: { name: fields.sName as string, address: fields.sAddr as string, gstin: fields.sGstin as string, sac: fields.sSac as string },
    buyer: { name: fields.bName as string, gstin: fields.bGstin as string },
    ratePercent: fields.rate as number,
    cashPaise: fields.cash as number,
    creditPaise: fields.credit as number,
    breakup: {
      taxablePaise: fields.taxable as number,
      taxPaise: fields.tax as number,
      interState: breakup.interState,
      lines: parsedLines,
      placeOfSupply: { code: str(pos.code), name: str(pos.name), basis },
    },
    takenAt: fields.takenAt as string,
  };
}
