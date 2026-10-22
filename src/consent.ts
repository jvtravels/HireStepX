/* Cookie / tracking consent store.
 *
 * Stored as JSON {choice, version, timestamp} under one localStorage key so a
 * change in COOKIE_CONSENT_VERSION (new vendors / wording) re-asks the
 * visitor, and so the decision is auditable. Everything non-essential
 * must key off hasConsentFor("analytics" | "advertising"): GA4, PostHog and
 * Vercel Analytics/Speed Insights need "analytics", AdSense needs
 * "advertising". Nothing loads before an explicit opt-in.
 */
import { COOKIE_CONSENT_VERSION } from "../data/legal-versions";

export const CONSENT_KEY = "hirestepx_cookie_consent";
export const CONSENT_EVENT = "hirestepx:cookie-consent";
export const OPEN_SETTINGS_EVENT = "hirestepx:open-cookie-settings";

export type ConsentChoice = "accepted" | "rejected" | "custom";

/** The optional (non-essential) groups a visitor can allow independently.
 *  Essential cookies are always on and are not stored here. */
export interface ConsentCategories {
  analytics: boolean;
  advertising: boolean;
}
export type ConsentCategory = keyof ConsentCategories;

export interface StoredConsent extends ConsentCategories {
  choice: ConsentChoice;
  version: string;
  timestamp: string;
}

const NONE: ConsentCategories = { analytics: false, advertising: false };

function choiceFor(c: ConsentCategories): ConsentChoice {
  if (c.analytics && c.advertising) return "accepted";
  if (!c.analytics && !c.advertising) return "rejected";
  return "custom";
}

function categoriesFor(input: "accepted" | "rejected" | ConsentCategories): ConsentCategories {
  if (input === "accepted") return { analytics: true, advertising: true };
  if (input === "rejected") return NONE;
  return { analytics: input.analytics, advertising: input.advertising };
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
    if (typeof rec.version !== "string" || rec.version !== currentVersion) return null;
    const timestamp = typeof rec.timestamp === "string" ? rec.timestamp : "";
    if (typeof rec.analytics === "boolean" && typeof rec.advertising === "boolean") {
      const cats = { analytics: rec.analytics, advertising: rec.advertising };
      return { ...cats, choice: choiceFor(cats), version: rec.version, timestamp };
    }
    if (rec.choice === "accepted" || rec.choice === "rejected") {
      return { ...categoriesFor(rec.choice), choice: rec.choice, version: rec.version, timestamp };
    }
    return null;
  } catch {
    return null;
  }
}

export function serializeConsent(
  input: "accepted" | "rejected" | ConsentCategories,
  now: Date = new Date(),
  version: string = COOKIE_CONSENT_VERSION,
): string {
  const cats = categoriesFor(input);
  const rec: StoredConsent = { choice: choiceFor(cats), ...cats, version, timestamp: now.toISOString() };
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

/** What the visitor currently allows. Everything optional is off until they decide. */
export function getConsentCategories(): ConsentCategories {
  const s = getStoredConsent();
  return s ? { analytics: s.analytics, advertising: s.advertising } : NONE;
}

export function hasConsentFor(category: ConsentCategory): boolean {
  return getConsentCategories()[category];
}

/** Persist a decision and notify listeners (analytics/ads gates, banner). */
export function setCookieConsent(input: "accepted" | "rejected" | ConsentCategories): void {
  if (typeof window === "undefined") return;
  const cats = categoriesFor(input);
  try { localStorage.setItem(CONSENT_KEY, serializeConsent(input)); } catch { /* storage blocked: decision applies for this page view only */ }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: { accepted: choiceFor(cats) === "accepted", ...cats } }));
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
