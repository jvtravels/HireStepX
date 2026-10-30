"use client";

import { createContext, useContext, type ReactNode } from "react";

/* True only while at least one public role is live, so nav and footer never
   link to an empty /openings page. Set by the marketing layout (server side). */
const OpeningsFlag = createContext(false);

export function OpeningsFlagProvider({ live, children }: { live: boolean; children: ReactNode }) {
  return <OpeningsFlag.Provider value={live}>{children}</OpeningsFlag.Provider>;
}

export function useHasOpenings(): boolean {
  return useContext(OpeningsFlag);
}
