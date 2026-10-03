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

/* ─── gtag — GA4, loaded for every visitor via Consent Mode v2
 *
 * ConsentGatedAnalytics/MarketingAnalytics always mount the gtag.js
 * <Script>; the inline init script sets Consent Mode's default storage
 * state from localStorage directly (see _ga4-script.ts), so window.gtag
 * exists immediately regardless of consent. sendGtagEvent still no-ops
 * safely via optional chaining if it somehow hasn't loaded yet. */

type GtagFn = (...args: unknown[]) => void;

export function sendGtagEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { gtag?: GtagFn };
  w.gtag?.("event", name, params);
}

export function updateGtagConsent(granted: boolean): void {
  if (typeof window === "undefined") return;
  const w = window as Window & { gtag?: GtagFn };
  w.gtag?.("consent", "update", { analytics_storage: granted ? "granted" : "denied" });
}
