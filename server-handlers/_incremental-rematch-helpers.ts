/* Pure helpers for the incremental candidate→requirement rematch path.
 *
 * Problem: `runMatching` (employer-requirements.ts) only runs when an
 * employer creates or edits a requirement — a candidate signing up (or
 * refreshing their resume) afterwards never gets scored against requirements
 * that already exist. This file picks WHICH open requirements an incremental
 * trigger should re-score, bounded by a per-call cap so a hot path like
 * update-profile never blocks on an unbounded fan-out. Requirements beyond
 * the cap are picked up by the nightly sweep cron instead.
 */

export interface RematchableRequirement {
  id: string;
  stage: string;
  status: string;
  last_matched_at: string | null;
}

/** Minimal requirement shape both the incremental trigger
 *  (rematchOpenRequirementsForNewResume) and the nightly sweep cron
 *  (cron-rematch-requirements.ts) select and feed into `runMatching`. */
export interface OpenRequirementForRematch extends RematchableRequirement {
  employer_id: string;
  title: string;
  location: string;
  description: string | null;
  skills: string[] | null;
  experience_min: number | null;
  experience_max: number | null;
  min_readiness_band: "strongHire" | "hire" | "leanHire" | null;
  min_star_completeness: number | null;
}

/** Stages where fresh candidates are still worth surfacing. Once an employer
 *  has moved a requirement into "interviewing" or "hired", injecting new
 *  candidates into the pipeline would be noise, not help. */
const OPEN_STAGES = new Set(["ai_matching", "ready_for_review"]);

export function isOpenForRematch(r: Pick<RematchableRequirement, "stage" | "status">): boolean {
  return r.status !== "closed" && OPEN_STAGES.has(r.stage);
}

/** Orders the least-recently-matched requirements first (nulls — never
 *  matched since this column existed — sort ahead of any real timestamp),
 *  then caps at `limit` so one candidate signup can only ever trigger a
 *  bounded burst of re-scoring. Rotates fairly across calls: each run picks
 *  up whichever requirements have gone longest without a pass. */
export function pickRequirementsToRematch<T extends RematchableRequirement>(
  rows: T[],
  limit: number,
): T[] {
  const open = rows.filter(isOpenForRematch);
  const sorted = [...open].sort((a, b) => {
    const at = a.last_matched_at ? new Date(a.last_matched_at).getTime() : -Infinity;
    const bt = b.last_matched_at ? new Date(b.last_matched_at).getTime() : -Infinity;
    return at - bt;
  });
  return sorted.slice(0, Math.max(0, limit));
}
