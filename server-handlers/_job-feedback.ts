/* Pure pieces behind the candidate job page's feedback: where a candidate's
   fit sits in the pool matched to a role, and the answered-request history that
   feeds the shared timeline. Only aggregates ever leave the server. */

import type { CandidateRequestRow } from "./_candidate-request-helpers";

/** Below this many matched candidates a percentile says nothing and could
 *  point at individuals, so it is not shown. */
export const MIN_STANDING_POOL = 5;

export interface FitStanding {
  pool: number;
  /** Whole percent of the other candidates this fit score is above. */
  beatenPct: number;
}

/** `scores` is every match score for the role, the candidate's own included. */
export function fitStanding(own: number, scores: readonly number[]): FitStanding | null {
  if (scores.length < MIN_STANDING_POOL || !Number.isFinite(own)) return null;
  const others = scores.length - 1;
  let beaten = 0;
  let skippedSelf = false;
  for (const s of scores) {
    if (!skippedSelf && s === own) { skippedSelf = true; continue; }
    if (s < own) beaten += 1;
  }
  if (!skippedSelf) return null;
  return { pool: scores.length, beatenPct: Math.round((beaten / others) * 100) };
}

export interface AnsweredRequest {
  id: string;
  kind: CandidateRequestRow["kind"];
  headline: string;
  outcome: "fulfilled" | "declined";
  at: string;
}

/** Newest-first list of the requests a candidate has already answered, for one match. */
export function answeredRequests(
  rows: readonly CandidateRequestRow[],
  headlineOf: (r: CandidateRequestRow) => string,
  limit = 6,
): AnsweredRequest[] {
  return rows
    .filter((r) => (r.status === "fulfilled" || r.status === "declined") && !!r.resolved_at)
    .sort((a, b) => new Date(b.resolved_at as string).getTime() - new Date(a.resolved_at as string).getTime())
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      headline: headlineOf(r),
      outcome: r.status as "fulfilled" | "declined",
      at: r.resolved_at as string,
    }));
}
