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
  /** Stamped at the START of every matching attempt, success or not (migration
      0044). Absent when the column is not applied yet. */
  last_rematch_attempt_at?: string | null;
  /** YYYY-MM-DD; absent/null means no deadline. */
  due_date?: string | null;
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
  employment_type: string | null;
  duration_weeks: number | null;
  hours_per_week: number | null;
  custom_skill_sets?: string[] | null;
  work_mode?: string | null;
}

/** A requirement whose deadline passed more than this long ago is almost
 *  certainly abandoned (never archived); re-scoring the whole pool nightly
 *  for it is wasted work. It stays open and editable, and a manual edit still
 *  re-runs it. */
export const OVERDUE_REMATCH_GRACE_DAYS = 30;

export function isLongOverdue(dueDate: string | null | undefined, nowMs: number = Date.now()): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate).getTime();
  return Number.isFinite(due) && nowMs - due > OVERDUE_REMATCH_GRACE_DAYS * 86_400_000;
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
/** Columns the sweeps read; the attempt column is optional because it ships in
    its own migration. */
export const REMATCH_SELECT =
  "id,employer_id,title,location,description,skills,experience_min,experience_max,min_readiness_band,min_star_completeness,employment_type,duration_weeks,hours_per_week,custom_skill_sets,work_mode,due_date,stage,status,last_matched_at,employers!inner(suspended_at)";

/** PostgREST query for the open-requirement backlog. Long-overdue and
    suspended rows are filtered in SQL, and rows are ordered by the last
    ATTEMPT first: ordering on last_matched_at alone left requirements that
    keep failing (never stamped) as the stalest forever, so a capped read
    never reached the live ones behind them. */
export function buildRematchQuery(opts: { limit: number; withAttemptColumn: boolean; nowMs?: number }): string {
  const cutoff = new Date((opts.nowMs ?? Date.now()) - OVERDUE_REMATCH_GRACE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const select = opts.withAttemptColumn ? REMATCH_SELECT.replace("last_matched_at,", "last_matched_at,last_rematch_attempt_at,") : REMATCH_SELECT;
  const order = opts.withAttemptColumn
    ? "last_rematch_attempt_at.asc.nullsfirst,last_matched_at.asc.nullsfirst"
    : "last_matched_at.asc.nullsfirst";
  return `employer_requirements?stage=in.(ai_matching,ready_for_review)&status=neq.closed` +
    `&or=(due_date.is.null,due_date.gte.${cutoff})` +
    `&select=${select}&employers.suspended_at=is.null&order=${order}&limit=${opts.limit}`;
}

/** Reads the backlog, falling back to the pre-0044 query when the attempt
    column does not exist yet. Null when both reads fail. */
export async function fetchRematchBacklog(params: {
  supabaseUrl: string;
  headers: Record<string, string>;
  limit: number;
  fetchImpl?: typeof fetch;
}): Promise<Response | null> {
  const f = params.fetchImpl ?? fetch;
  for (const withAttemptColumn of [true, false]) {
    const res = await f(`${params.supabaseUrl}/rest/v1/${buildRematchQuery({ limit: params.limit, withAttemptColumn })}`, { headers: params.headers });
    if (res.ok) return res;
  }
  return null;
}

function attemptTime(r: RematchableRequirement): number {
  return r.last_rematch_attempt_at ? new Date(r.last_rematch_attempt_at).getTime() : -Infinity;
}

export function pickRequirementsToRematch<T extends RematchableRequirement>(
  rows: T[],
  limit: number,
  nowMs: number = Date.now(),
): T[] {
  const open = rows.filter((r) => isOpenForRematch(r) && !isLongOverdue(r.due_date, nowMs));
  const sorted = [...open].sort((a, b) => {
    const byAttempt = attemptTime(a) === attemptTime(b) ? 0 : attemptTime(a) < attemptTime(b) ? -1 : 1;
    if (byAttempt !== 0) return byAttempt;
    const at = a.last_matched_at ? new Date(a.last_matched_at).getTime() : -Infinity;
    const bt = b.last_matched_at ? new Date(b.last_matched_at).getTime() : -Infinity;
    return at === bt ? 0 : at < bt ? -1 : 1;
  });
  return sorted.slice(0, Math.max(0, limit));
}

/** A requirement nobody has touched and no candidate has changed for is still
    re-scored this often, because inputs the change stamp does not see (new
    graded sessions, a candidate who unlocked elsewhere, expiring hires) move
    scores slowly. */
export const REMATCH_MAX_AGE_MS = 7 * 86_400_000;

/** Latest time any candidate input to matching changed (migration 0057):
    a number, null when nothing has changed yet, or "unknown" when the column is
    not applied or the read failed, in which case every requirement counts as due. */
export type MatchingInputChange = number | null | "unknown";

export async function fetchLatestMatchingInputChange(params: {
  supabaseUrl: string;
  headers: Record<string, string>;
  fetchImpl?: typeof fetch;
}): Promise<MatchingInputChange> {
  const f = params.fetchImpl ?? fetch;
  try {
    const res = await f(
      `${params.supabaseUrl}/rest/v1/profiles?select=matching_inputs_changed_at&matching_inputs_changed_at=not.is.null&order=matching_inputs_changed_at.desc&limit=1`,
      { headers: params.headers },
    );
    if (!res.ok) return "unknown";
    const rows = (await res.json().catch(() => null)) as Array<{ matching_inputs_changed_at?: string | null }> | null;
    if (!Array.isArray(rows)) return "unknown";
    const at = rows[0]?.matching_inputs_changed_at ? new Date(rows[0].matching_inputs_changed_at).getTime() : NaN;
    return Number.isFinite(at) ? at : null;
  } catch {
    return "unknown";
  }
}

/** Whether the nightly sweep should re-score this requirement: never matched,
    older than the max age, or a candidate input changed after the pass began.
    The baseline is the earlier of the last attempt and the last success, so a
    profile edit that landed while a scan was running is not lost. */
export function isRematchDue(
  r: Pick<RematchableRequirement, "last_matched_at" | "last_rematch_attempt_at">,
  latestInputChange: MatchingInputChange,
  nowMs: number = Date.now(),
): boolean {
  if (latestInputChange === "unknown") return true;
  const matched = r.last_matched_at ? new Date(r.last_matched_at).getTime() : NaN;
  if (!Number.isFinite(matched)) return true;
  if (nowMs - matched > REMATCH_MAX_AGE_MS) return true;
  if (latestInputChange === null) return false;
  const attempt = r.last_rematch_attempt_at ? new Date(r.last_rematch_attempt_at).getTime() : NaN;
  const baseline = Number.isFinite(attempt) ? Math.min(attempt, matched) : matched;
  return latestInputChange > baseline;
}
