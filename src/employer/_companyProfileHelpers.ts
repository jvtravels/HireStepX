export const LOGO_MAX_MB = 2;
export const LOGO_ACCEPTED_TYPES = "image/png,image/jpeg,image/webp";
export const LOGO_CONTENT_TYPE_ALLOWLIST = new Set(["image/png", "image/jpeg", "image/webp"]);

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* Mirrors the server's check in server-handlers/employer-profile.ts so the
   form never blocks a value the server would accept (a bare "acme.com" is
   fine) nor lets through one it will 400. The server stays the authority —
   its message is shown when it still disagrees. */
const WEBSITE_PATTERN = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i;

export const WEBSITE_FORMAT_MESSAGE = "Enter a valid company website, e.g. acme.com";

export function isPlausibleWebsite(value: string): boolean {
  return WEBSITE_PATTERN.test(value.trim());
}

/** Splits a `data:<mime>;base64,<payload>` URL into the two fields
 *  POST /api/employer-profile takes. Returns empty fields for no logo. */
export function splitLogoDataUrl(dataUrl: string | null): { logoBase64?: string; logoContentType?: string } {
  if (!dataUrl) return {};
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return {};
  const mime = dataUrl.slice(0, comma).match(/^data:(.+);base64$/)?.[1];
  return { logoBase64: dataUrl.slice(comma + 1), logoContentType: mime };
}

const PLACEHOLDER_NAMES = new Set(["test", "demo", "sample", "company", "my company", "abc", "xyz", "na", "n/a"]);

/** A name or website candidates would read as filler. Empty values return false: they mean "not loaded yet" more often than "left blank". */
export function looksLikePlaceholderProfile(companyName: string, website: string): boolean {
  const name = companyName.trim().toLowerCase();
  if (name && (name.length < 3 || PLACEHOLDER_NAMES.has(name))) return true;
  const host = website.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  return host === "hirestepx.com";
}
