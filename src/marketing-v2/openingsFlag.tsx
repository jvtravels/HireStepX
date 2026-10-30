"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useStagingHost } from "../home2/stagingHost";

/* True only while at least one public role is live AND the page is on the
   staging host (open roles are staging-only for now), so nav and footer never
   link to an empty or hidden /openings page. Set by the marketing layout. */
const OpeningsFlag = createContext(false);

export function OpeningsFlagProvider({ live, children }: { live: boolean; children: ReactNode }) {
  return <OpeningsFlag.Provider value={live}>{children}</OpeningsFlag.Provider>;
}

export function useHasOpenings(): boolean {
  const staging = useStagingHost();
  return useContext(OpeningsFlag) && staging;
}

export function useWithOpenRoles(links: Array<[string, string]>): Array<[string, string]> {
  return useHasOpenings() ? [["Open roles", "/openings"], ...links] : links;
}
