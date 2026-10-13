/* Pure helpers for /api/record-consent (see record-consent.ts). */
import { TERMS_PRIVACY_PURPOSE, TERMS_PRIVACY_CONSENT_VERSION } from "../data/legal-versions";

export const CONSENT_PURPOSES: readonly string[] = [TERMS_PRIVACY_PURPOSE];

/** Versions a client may claim for each purpose — only the current one, so a
 *  forged/ancient version string can't be written into the consent ledger. */
const ACCEPTED_VERSIONS: Record<string, readonly string[]> = {
  [TERMS_PRIVACY_PURPOSE]: [TERMS_PRIVACY_CONSENT_VERSION],
};

export type ConsentBodyResult =
  | { ok: true; purpose: string; version: string }
  | { ok: false; error: string };

export function validateConsentBody(body: unknown): ConsentBodyResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "invalid_body" };
  const rec = body as Record<string, unknown>;
  const purpose = typeof rec.purpose === "string" ? rec.purpose : "";
  const version = typeof rec.version === "string" ? rec.version : "";
  if (!CONSENT_PURPOSES.includes(purpose)) return { ok: false, error: "unknown_purpose" };
  if (!ACCEPTED_VERSIONS[purpose]?.includes(version)) return { ok: false, error: "unknown_version" };
  return { ok: true, purpose, version };
}

/** The version string recorded for a purpose today (terms and privacy move together). */
export function currentConsentVersion(purpose: string): string | null {
  return ACCEPTED_VERSIONS[purpose]?.[0] ?? null;
}

/** Salted SHA-256 of the client IP. Returns null without a salt: an unsalted
 *  hash of an IPv4 address is trivially reversible, so we'd rather store none. */
export async function hashIp(ip: string, salt: string | undefined): Promise<string | null> {
  if (!salt || !ip || ip === "unknown") return null;
  const data = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface ConsentRow {
  user_id: string;
  purpose: string;
  version: string;
  ip_hash: string | null;
  user_agent: string | null;
}

export function buildConsentRow(args: { userId: string; purpose: string; version: string; ipHash: string | null; userAgent: string | null }): ConsentRow {
  return {
    user_id: args.userId,
    purpose: args.purpose,
    version: args.version,
    ip_hash: args.ipHash,
    user_agent: args.userAgent ? args.userAgent.slice(0, 300) : null,
  };
}

/** PostgREST answers 404 (PGRST205 / 42P01) when the table hasn't been migrated yet. */
export function isMissingTableError(status: number, bodyText: string): boolean {
  return status === 404 || /PGRST205|42P01|does not exist|schema cache/i.test(bodyText);
}
