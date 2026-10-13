/* Pure helpers for the signup-consent ledger (user_consents), used by
   AuthContext. The affirmation is captured on the signup form but the first
   authenticated session can happen later, possibly in another browser (the
   verification email opens elsewhere) — so the intent travels two ways:
   a pending localStorage flag (same-browser, also used for Google sign-in)
   and a version stamp in Supabase user_metadata (survives cross-device). */
import { TERMS_PRIVACY_CONSENT_VERSION, TERMS_PRIVACY_PURPOSE } from "../data/legal-versions";

export const PENDING_CONSENT_KEY = "hirestepx_pending_consent";
export const CONSENT_METADATA_KEY = "consent_terms_privacy_version";

export interface PendingConsent {
  purpose: string;
  version: string;
}

export function currentSignupConsent(): PendingConsent {
  return { purpose: TERMS_PRIVACY_PURPOSE, version: TERMS_PRIVACY_CONSENT_VERSION };
}

export function parsePendingConsent(raw: string | null): PendingConsent | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const rec = v as Record<string, unknown>;
    if (typeof rec.purpose !== "string" || typeof rec.version !== "string") return null;
    return { purpose: rec.purpose, version: rec.version };
  } catch {
    return null;
  }
}

export function consentFromUserMetadata(meta: unknown): PendingConsent | null {
  if (typeof meta !== "object" || meta === null) return null;
  const version = (meta as Record<string, unknown>)[CONSENT_METADATA_KEY];
  return typeof version === "string" && version ? { purpose: TERMS_PRIVACY_PURPOSE, version } : null;
}

/** What to POST to /api/record-consent for this session, if anything.
 *  The same-browser pending flag wins; otherwise the signup metadata stamp. */
export function resolveConsentToRecord(rawPending: string | null, userMetadata: unknown): PendingConsent | null {
  return parsePendingConsent(rawPending) ?? consentFromUserMetadata(userMetadata);
}

export function consentDoneKey(userId: string, c: PendingConsent): string {
  return `hirestepx_consent_recorded:${userId}:${c.purpose}:${c.version}`;
}
