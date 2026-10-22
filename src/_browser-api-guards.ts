/* Browser API type guards — central typed access to vendor-prefixed and
 * partially-supported globals. Replaces scattered `as unknown as` casts
 * (which CLAUDE.md prohibits in production code) with one shared module
 * that documents *why* each fallback exists. */

/* ─── AudioContext (webkit prefix on Safari < 14) ─── */

export function getAudioContextCtor(): typeof AudioContext | null {
  if (typeof window === "undefined") return null;
  // Standard first; fall through to Safari's prefixed variant.
  const std = window.AudioContext;
  if (std) return std;
  const w = window as Window & { webkitAudioContext?: typeof AudioContext };
  return w.webkitAudioContext || null;
}

/* ─── SpeechRecognition (Chromium ships only the webkit prefix) ─── */

interface SpeechRecognitionCtor {
  new (): unknown;
}

export function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/* ─── navigator.connection — Network Information API
 *
 * Available in Chromium-based browsers; Safari / Firefox return undefined.
 * effectiveType buckets the user's connection ("4g" / "3g" / "2g" / "slow-2g")
 * which we use to skip optional resume rehydration on slow networks. */

export interface NetworkInformationLike {
  effectiveType?: "4g" | "3g" | "2g" | "slow-2g";
  saveData?: boolean;
  downlink?: number;
  rtt?: number;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}

export function getNetworkInfo(): NetworkInformationLike | null {
  if (typeof navigator === "undefined") return null;
  const n = navigator as Navigator & { connection?: NetworkInformationLike };
  return n.connection || null;
}

export function isSlowConnection(): boolean {
  const info = getNetworkInfo();
  if (!info?.effectiveType) return false;
  return info.effectiveType === "2g" || info.effectiveType === "slow-2g";
}

/* ─── scheduler.yield — Task scheduling API (Chrome 129+)
 *
 * Lets us cooperatively yield to the main thread inside hot loops without
 * the setTimeout(0) hack. Falls back to a 0ms timeout when unavailable. */

export function yieldToMainThread(): Promise<void> {
  if (typeof globalThis === "undefined") return Promise.resolve();
  const g = globalThis as typeof globalThis & {
    scheduler?: { yield?: () => Promise<void> };
  };
  if (g.scheduler?.yield) return g.scheduler.yield();
  return new Promise((r) => setTimeout(r, 0));
}

/* ─── gtag — GA4, Consent Mode v2
 *
 * gtag.js is NOT loaded until the visitor accepts (see
 * app/ConsentGatedTelemetry.tsx); window.gtag therefore doesn't exist
 * pre-consent and sendGtagEvent safely no-ops via optional chaining. On
 * withdrawal updateGtagConsent(false) flips all four Consent Mode v2 signals
 * back to denied and sets Google's documented `ga-disable-<ID>` kill switch,
 * because denied-mode gtag still sends cookieless pings unless disabled. */

type GtagFn = (...args: unknown[]) => void;

export type GtagConsentSignals = {
  ad_storage: "granted" | "denied";
  analytics_storage: "granted" | "denied";
  ad_user_data: "granted" | "denied";
  ad_personalization: "granted" | "denied";
};

/** analytics_storage follows the analytics choice; the three ad_* signals follow the advertising choice. */
export function gtagConsentSignals(analytics: boolean, advertising: boolean = analytics): GtagConsentSignals {
  const a = analytics ? "granted" : "denied";
  const ad = analytics && advertising ? "granted" : "denied";
  return { ad_storage: ad, analytics_storage: a, ad_user_data: ad, ad_personalization: ad };
}

export function sendGtagEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { gtag?: GtagFn };
  w.gtag?.("event", name, params);
}

export function updateGtagConsent(granted: boolean, gaId?: string, advertising: boolean = granted): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { gtag?: GtagFn };
  if (gaId) Reflect.set(window, `ga-disable-${gaId}`, !granted);
  w.gtag?.("consent", "update", gtagConsentSignals(granted, advertising));
}
