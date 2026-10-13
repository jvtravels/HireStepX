/* Cookie / tracking consent store.
 *
 * Stored as JSON {choice, version, timestamp} under one localStorage key so a
 * change in COOKIE_CONSENT_VERSION (new vendors / wording) re-asks the
 * visitor, and so the decision is auditable. Everything non-essential
 * (GA4, AdSense, PostHog, Vercel Analytics/Speed Insights) must key off
 * getCookieConsent() === "accepted" — nothing loads before an explicit opt-in.
 */
import { COOKIE_CONSENT_VERSION } from "../data/legal-versions";

export const CONSENT_KEY = "hirestepx_cookie_consent";
export const CONSENT_EVENT = "hirestepx:cookie-consent";
export const OPEN_SETTINGS_EVENT = "hirestepx:open-cookie-settings";

export type ConsentChoice = "accepted" | "rejected";

export interface StoredConsent {
  choice: ConsentChoice;
  version: string;
  timestamp: string;
}

/** Parse a stored value. Returns null for missing/corrupt values and for any
 *  value recorded against a different version (including the legacy bare
 *  "accepted"/"rejected" strings, which carry no version), so the caller
 *  treats it as "not yet decided" and re-asks. */
export function parseStoredConsent(raw: string | null, currentVersion: string = COOKIE_CONSENT_VERSION): StoredConsent | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const rec = v as Record<string, unknown>;
    if (rec.choice !== "accepted" && rec.choice !== "rejected") return null;
    if (typeof rec.version !== "string" || rec.version !== currentVersion) return null;
    const timestamp = typeof rec.timestamp === "string" ? rec.timestamp : "";
    return { choice: rec.choice, version: rec.version, timestamp };
  } catch {
    return null;
  }
}

export function serializeConsent(choice: ConsentChoice, now: Date = new Date(), version: string = COOKIE_CONSENT_VERSION): string {
  const rec: StoredConsent = { choice, version, timestamp: now.toISOString() };
  return JSON.stringify(rec);
}

export function getStoredConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;
  try {
    return parseStoredConsent(localStorage.getItem(CONSENT_KEY));
  } catch {
    return null;
  }
}

export function getCookieConsent(): ConsentChoice | null {
  return getStoredConsent()?.choice ?? null;
}

/** Persist a decision and notify listeners (analytics/ads gates, banner). */
export function setCookieConsent(choice: ConsentChoice): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(CONSENT_KEY, serializeConsent(choice)); } catch { /* storage blocked: decision applies for this page view only */ }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { accepted: choice === "accepted" } }));
  } catch { /* noop */ }
}

/** Reopen the banner (footer "Cookie settings" link). */
export function openCookieSettings(): void {
  if (typeof window === "undefined") return;
  try { window.dispatchEvent(new CustomEvent(OPEN_SETTINGS_EVENT)); } catch { /* noop */ }
}

/* useSyncExternalStore plumbing — shared by every consent-gated component. */
export function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
