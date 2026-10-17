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

export const LEGAL_ENTITY: LegalEntity = {
  name: clean(process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME),
  address: clean(process.env.NEXT_PUBLIC_LEGAL_ADDRESS),
  phone: clean(process.env.NEXT_PUBLIC_LEGAL_PHONE),
  gstin: clean(process.env.NEXT_PUBLIC_LEGAL_GSTIN),
  cin: clean(process.env.NEXT_PUBLIC_LEGAL_CIN),
  sac: clean(process.env.NEXT_PUBLIC_LEGAL_SAC),
};

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
