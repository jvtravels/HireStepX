"use client";

import { useSyncExternalStore } from "react";
import { getCookieConsent, subscribeConsent, type ConsentChoice } from "./consent";

/** Live consent state. null on the server and until the visitor decides. */
export function useCookieConsent(): ConsentChoice | null {
  return useSyncExternalStore(subscribeConsent, getCookieConsent, () => null);
}
