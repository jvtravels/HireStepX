export const LOGO_MAX_MB = 2;
export const LOGO_ACCEPTED_TYPES = "image/png,image/jpeg,image/webp";
export const LOGO_CONTENT_TYPE_ALLOWLIST = new Set(["image/png", "image/jpeg", "image/webp"]);

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* A pragmatic website check, not a full RFC 3986 parser: catches the two
   real-world mistakes (missing scheme, no dot in the host) without
   rejecting valid domains our regex doesn't fully understand. */
export function isPlausibleWebsite(value: string): boolean {
  const v = value.trim();
  if (!/^https?:\/\//i.test(v)) return false;
  try {
    const host = new URL(v).hostname;
    return host.includes(".") && host.length > 3;
  } catch {
    return false;
  }
}

/* GSTIN is optional at signup (admin approval doesn't hard-require it —
   a website is enough to review), but if the employer enters one, validate
   the real 15-char format: 2-digit state code, 10-char PAN, 1-char entity
   number, 'Z' by convention, 1-char checksum. */
export function isPlausibleGstin(value: string): boolean {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value.trim().toUpperCase());
}
