/* Operator / seller details required on legal pages (E-Commerce Rules 2020,
   rule 4(4); GST Act s.31 invoices) — owner-supplied, never invented.
   NEXT_PUBLIC_* must be referenced as literal `process.env.X` expressions so
   Next.js can inline them into client bundles. */

export interface LegalEntity {
  name: string;
  address: string;
  phone: string;
  gstin: string;
  cin: string;
  /** SAC for the unlock service, rendered on tax invoices only when the owner sets it. */
  sac?: string;
}

function clean(v: string | undefined): string {
  return (v ?? "").trim();
}

/** Re-reads the env on every call, for server code (fulfilment, receipt email)
 *  that must agree with the in-app documents without depending on import order. */
export function readLegalEntity(): LegalEntity {
  return {
    name: clean(process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME),
    address: clean(process.env.NEXT_PUBLIC_LEGAL_ADDRESS),
    phone: clean(process.env.NEXT_PUBLIC_LEGAL_PHONE),
    gstin: clean(process.env.NEXT_PUBLIC_LEGAL_GSTIN),
    cin: clean(process.env.NEXT_PUBLIC_LEGAL_CIN),
    sac: clean(process.env.NEXT_PUBLIC_LEGAL_SAC),
  };
}

export const LEGAL_ENTITY: LegalEntity = readLegalEntity();

const LABELS: ReadonlyArray<readonly [keyof LegalEntity, string]> = [
  ["name", "Operated by"],
  ["address", "Registered address"],
  ["phone", "Phone"],
  ["gstin", "GSTIN"],
  ["cin", "CIN"],
];

/** Only the fields that are actually set, in display order. */
export function legalEntityLines(entity: LegalEntity = LEGAL_ENTITY): Array<{ label: string; value: string }> {
  return LABELS.flatMap(([key, label]) => {
    const value = entity[key];
    return value ? [{ label, value }] : [];
  });
}

/** Footer copyright holder: the legal entity when set, else the brand. */
export function copyrightHolder(entity: LegalEntity = LEGAL_ENTITY): string {
  return entity.name || "HireStepX";
}

/** 15-character GSTIN layout: 2-digit state code, 10-character PAN, entity number, "Z", check character.
 *  Format only; the check character is validated where buyers' GSTINs are parsed (server-handlers/_gstin.ts). */
export const GSTIN_FORMAT = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** True only when the seller can lawfully issue a GST "Tax invoice" (GST Act s.31, Invoice Rules r.46):
 *  a well-formed GSTIN AND legal name, address and SAC. Setting NEXT_PUBLIC_LEGAL_GSTIN alone is not
 *  enough: a document missing the supplier's name, address or SAC is not a valid tax invoice, so
 *  invoice wording must fall back to "Payment receipt" until all four are configured.
 *  Invoice code (src/employer/_invoiceHtml.ts isTaxInvoice) should call this instead of testing GSTIN
 *  presence alone. */
export function isTaxInvoiceReady(entity: Pick<LegalEntity, "name" | "address" | "gstin" | "sac"> = LEGAL_ENTITY): boolean {
  return GSTIN_FORMAT.test(entity.gstin.trim().toUpperCase())
    && entity.name.trim() !== ""
    && entity.address.trim() !== ""
    && (entity.sac ?? "").trim() !== "";
}
