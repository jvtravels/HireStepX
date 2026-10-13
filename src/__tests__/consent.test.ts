// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CONSENT_KEY,
  getConsentCategories,
  getCookieConsent,
  hasConsentFor,
  openCookieSettings,
  OPEN_SETTINGS_EVENT,
  parseStoredConsent,
  serializeConsent,
  setCookieConsent,
  CONSENT_EVENT,
} from "../consent";
import { gtagConsentSignals } from "../_browser-api-guards";
import { buildGa4InitScript } from "../../app/_ga4-script";
import { COOKIE_CONSENT_VERSION } from "../../data/legal-versions";

beforeEach(() => localStorage.clear());

describe("parseStoredConsent / serializeConsent", () => {
  it("round-trips choice, version and timestamp", () => {
    const now = new Date("2026-10-11T10:00:00Z");
    const raw = serializeConsent("accepted", now);
    expect(JSON.parse(raw)).toEqual({ choice: "accepted", analytics: true, advertising: true, version: COOKIE_CONSENT_VERSION, timestamp: now.toISOString() });
    expect(parseStoredConsent(raw)).toEqual({ choice: "accepted", analytics: true, advertising: true, version: COOKIE_CONSENT_VERSION, timestamp: now.toISOString() });
  });

  it("re-asks (null) when the stored version is stale", () => {
    const raw = serializeConsent("accepted", new Date(), "2020-01-01");
    expect(parseStoredConsent(raw)).toBeNull();
  });

  it("treats the legacy unversioned strings and garbage as undecided", () => {
    expect(parseStoredConsent("accepted")).toBeNull();
    expect(parseStoredConsent("rejected")).toBeNull();
    expect(parseStoredConsent("{not json")).toBeNull();
    expect(parseStoredConsent(JSON.stringify({ choice: "maybe", version: COOKIE_CONSENT_VERSION }))).toBeNull();
    expect(parseStoredConsent(null)).toBeNull();
  });
});

describe("granular categories", () => {
  it("accepted/rejected map to both/neither category and custom is derived", () => {
    expect(parseStoredConsent(serializeConsent("accepted"))).toMatchObject({ choice: "accepted", analytics: true, advertising: true });
    expect(parseStoredConsent(serializeConsent("rejected"))).toMatchObject({ choice: "rejected", analytics: false, advertising: false });
    expect(parseStoredConsent(serializeConsent({ analytics: true, advertising: false }))).toMatchObject({ choice: "custom", analytics: true, advertising: false });
    expect(parseStoredConsent(serializeConsent({ analytics: true, advertising: true }))?.choice).toBe("accepted");
    expect(parseStoredConsent(serializeConsent({ analytics: false, advertising: false }))?.choice).toBe("rejected");
  });

  it("a current-version record with only a legacy choice still resolves to categories; custom without booleans is rejected", () => {
    const base = { version: COOKIE_CONSENT_VERSION, timestamp: "t" };
    expect(parseStoredConsent(JSON.stringify({ ...base, choice: "accepted" }))).toMatchObject({ analytics: true, advertising: true });
    expect(parseStoredConsent(JSON.stringify({ ...base, choice: "custom" }))).toBeNull();
    expect(parseStoredConsent(JSON.stringify({ ...base, analytics: "yes", advertising: true }))).toBeNull();
  });

  it("setCookieConsent stores categories, getConsentCategories/hasConsentFor read them and the event carries them", () => {
    const listener = vi.fn();
    window.addEventListener(CONSENT_EVENT, listener);
    expect(getConsentCategories()).toEqual({ analytics: false, advertising: false });
    setCookieConsent({ analytics: true, advertising: false });
    expect(getCookieConsent()).toBe("custom");
    expect(hasConsentFor("analytics")).toBe(true);
    expect(hasConsentFor("advertising")).toBe(false);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ accepted: false, analytics: true, advertising: false });
    window.removeEventListener(CONSENT_EVENT, listener);
  });
});

describe("browser store", () => {
  it("setCookieConsent persists, notifies listeners and getCookieConsent reads it back", () => {
    const listener = vi.fn();
    window.addEventListener(CONSENT_EVENT, listener);
    setCookieConsent("rejected");
    expect(getCookieConsent()).toBe("rejected");
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({ accepted: false, analytics: false, advertising: false });
    setCookieConsent("accepted");
    expect(getCookieConsent()).toBe("accepted");
    window.removeEventListener(CONSENT_EVENT, listener);
  });

  it("ignores a stale-version record stored in localStorage", () => {
    localStorage.setItem(CONSENT_KEY, serializeConsent("accepted", new Date(), "old"));
    expect(getCookieConsent()).toBeNull();
  });

  it("openCookieSettings dispatches the reopen event", () => {
    const listener = vi.fn();
    window.addEventListener(OPEN_SETTINGS_EVENT, listener);
    openCookieSettings();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(OPEN_SETTINGS_EVENT, listener);
  });
});

describe("Consent Mode v2 wiring", () => {
  it("maps accept/withdraw onto all four signals", () => {
    expect(gtagConsentSignals(true)).toEqual({ ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
    expect(gtagConsentSignals(false)).toEqual({ ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  });

  it("analytics-only keeps the three ad signals denied; advertising never grants without analytics", () => {
    expect(gtagConsentSignals(true, false)).toEqual({ ad_storage: "denied", analytics_storage: "granted", ad_user_data: "denied", ad_personalization: "denied" });
    expect(gtagConsentSignals(false, true).ad_storage).toBe("denied");
  });

  it("GA4 init snippet defaults all four signals to denied before the grant update", () => {
    const script = buildGa4InitScript("G-TEST123");
    const def = script.indexOf("'consent', 'default'");
    const upd = script.indexOf("'consent', 'update'");
    const cfg = script.indexOf("'config'");
    expect(def).toBeGreaterThan(-1);
    expect(def).toBeLessThan(upd);
    expect(upd).toBeLessThan(cfg);
    for (const k of ["ad_storage", "analytics_storage", "ad_user_data", "ad_personalization"]) {
      expect(script.slice(def, upd)).toContain(`${k}: 'denied'`);
    }
    expect(script).toContain("G-TEST123");
    expect(script.slice(def, cfg)).toContain(`'${CONSENT_KEY}'`);
  });
});
