/* Pure pieces for employer-request-contact.ts: validation of the requested
 * detail list and the wording shown to the candidate. */

export const CONTACT_REQUEST_FIELDS = ["phone", "email", "linkedin", "portfolio"] as const;
export type ContactRequestField = (typeof CONTACT_REQUEST_FIELDS)[number];

const FIELD_LABELS: Record<ContactRequestField, string> = {
  phone: "phone number",
  email: "email address",
  linkedin: "LinkedIn profile",
  portfolio: "portfolio or GitHub link",
};

/** Dedupes and validates the client-supplied list; returns null when it is
 *  not an array, empty, or contains anything outside the allowlist. */
export function asContactRequestFields(v: unknown): ContactRequestField[] | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const out: ContactRequestField[] = [];
  for (const item of v) {
    if (typeof item !== "string" || !(CONTACT_REQUEST_FIELDS as readonly string[]).includes(item)) return null;
    if (!out.includes(item as ContactRequestField)) out.push(item as ContactRequestField);
  }
  return out;
}

export function joinFieldLabels(fields: readonly ContactRequestField[]): string {
  const labels = CONTACT_REQUEST_FIELDS.filter((f) => fields.includes(f)).map((f) => FIELD_LABELS[f]);
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
