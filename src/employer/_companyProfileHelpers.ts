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
