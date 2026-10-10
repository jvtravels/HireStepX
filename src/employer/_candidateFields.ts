import type { CandidateEvidence } from "./EmployerDataContext";
import type { Candidate } from "./mockData";

/* Readers for backend fields that ship in parallel with the UI. Each returns
   a safe default when the field is absent, so the UI never implies data the
   server did not return. Narrowing uses `in`, not casts. */

export type CandidateResponse = "none" | "interested" | "declined";

/** `null` means the server did not say (older API) — callers must render
 *  nothing rather than "no response yet". */
export function readCandidateResponse(c: Candidate | null | undefined): CandidateResponse | null {
  if (c && "candidateResponse" in c) {
    const v = c.candidateResponse;
    if (v === "interested" || v === "declined" || v === "none") return v;
  }
  return null;
}

/** Quotes are withheld pre-unlock. If the server did not say, treat an empty
 *  quotes list on a locked candidate as locked rather than as "no quotes". */
export function readQuotesLocked(ev: CandidateEvidence | null | undefined, unlocked: boolean): boolean {
  if (ev && "quotesLocked" in ev && typeof ev.quotesLocked === "boolean") return ev.quotesLocked;
  return !unlocked;
}
