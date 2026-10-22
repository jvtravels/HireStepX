"use client";

import { useSyncExternalStore } from "react";
import { getCookieConsent, hasConsentFor, subscribeConsent, type ConsentCategory, type ConsentChoice } from "./consent";

/** Live consent state. null on the server and until the visitor decides. */
export function useCookieConsent(): ConsentChoice | null {
  return useSyncExternalStore(subscribeConsent, getCookieConsent, () => null);
}

/** Live "may this optional group run?" flag. false on the server and until the visitor allows it. */
export function useConsentCategory(category: ConsentCategory): boolean {
  return useSyncExternalStore(subscribeConsent, () => hasConsentFor(category), () => false);
}
