/* GSTIN validation. Format: 2-digit state code, 10-char PAN, entity number,
 * literal "Z", and a mod-36 check character. Checking the checksum catches
 * typos at entry, which matters because a wrong GSTIN on an invoice is useless
 * to the buyer for input-credit claims. */

const CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHAPE = /^(0[1-9]|[1-2][0-9]|3[0-8]|9[79])[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < first14.length; i++) {
    const v = CHARSET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

export function normalizeGstin(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function isValidGstin(raw: string): boolean {
  const g = normalizeGstin(raw);
  return SHAPE.test(g) && gstinCheckChar(g.slice(0, 14)) === g[14];
}

export type GstinParse = { ok: true; value: string | null } | { ok: false; error: string };

/** Empty input clears the field (GSTIN is optional); anything else must validate. */
export function parseGstinInput(raw: unknown): GstinParse {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "GSTIN must be text." };
  const g = normalizeGstin(raw);
  if (g === "") return { ok: true, value: null };
  if (!isValidGstin(g)) return { ok: false, error: "That GSTIN doesn't look right. It is 15 characters, like 27AAPFU0939F1ZV." };
  return { ok: true, value: g };
}

export function parseBillingNameInput(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw == null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "Billing name must be text." };
  const v = raw.replace(/\s+/g, " ").trim();
  if (v === "") return { ok: true, value: null };
  if (v.length > 120) return { ok: false, error: "Billing name must be 120 characters or fewer." };
  return { ok: true, value: v };
}

/* GST state codes (first two digits of a GSTIN). Used to decide CGST+SGST vs IGST. */
export const GST_STATE_NAMES: Readonly<Record<string, string>> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand",
  "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
  "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya",
  "18": "Assam", "19": "West Bengal", "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu", "27": "Maharashtra", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman and Nicobar Islands",
  "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory", "99": "Centre Jurisdiction",
};

/** State code of a GSTIN, or null when the text doesn't start with a known code. */
export function gstinStateCode(raw: string | null | undefined): string | null {
  const code = normalizeGstin(raw ?? "").slice(0, 2);
  return Object.prototype.hasOwnProperty.call(GST_STATE_NAMES, code) ? code : null;
}
