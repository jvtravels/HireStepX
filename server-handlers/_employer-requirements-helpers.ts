/* Pure request-shaping/aggregation pieces extracted from
 * employer-requirements.ts so they're unit-tested against the real code
 * rather than an inline copy. The scoring heuristic itself lives in
 * _requirement-match-helpers.ts.
 */

export interface RequirementRow {
  id: string;
  title: string;
  location: string;
  notice_period_pref: string;
  status: string;
  experience_min: number | null;
  experience_max: number | null;
  due_date: string | null;
  created_at: string;
}

/** Validated + length-capped read of a client-supplied field; returns "" for
 *  anything that isn't a string, so callers never propagate non-string JSON
 *  (numbers, objects, null) into a Postgres text column. */
export function asBoundedString(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** A requirement needs a real title and location before it's worth scoring
 *  against the candidate pool. */
export function isValidRequirementInput(title: string, location: string): boolean {
  return title.length >= 2 && location.length >= 1;
}

/** Validated read of a client-supplied years-of-experience field: whole
 *  numbers only, clamped to a plausible 0–40 range. Returns null for
 *  anything else so it stores as a real SQL NULL, not a fabricated 0. */
export function asBoundedExperience(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || !Number.isInteger(v)) return null;
  if (v < 0 || v > 40) return null;
  return v;
}

/** Validated read of a client-supplied due date: must be a real calendar
 *  date in strict YYYY-MM-DD form. Returns null for anything else — a
 *  malformed date is treated as "no due date", not a parse error. */
export function asBoundedDueDate(v: unknown): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const parsed = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : v;
}

/** Joins requirement rows with their match counts for the GET response,
 *  defaulting to 0 for requirements nothing has matched yet. */
export function buildRequirementsListResponse(
  rows: RequirementRow[],
  countsByRequirement: Map<string, number>,
): Array<{
  id: string;
  title: string;
  location: string;
  noticePeriodPref: string;
  status: string;
  experienceMin: number | null;
  experienceMax: number | null;
  dueDate: string | null;
  createdAt: string;
  candidateCount: number;
}> {
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    location: r.location,
    noticePeriodPref: r.notice_period_pref,
    status: r.status,
    experienceMin: r.experience_min ?? null,
    experienceMax: r.experience_max ?? null,
    dueDate: r.due_date ?? null,
    createdAt: r.created_at.slice(0, 10),
    candidateCount: countsByRequirement.get(r.id) || 0,
  }));
}

/** Tallies how many requirement_matches rows belong to each requirement, so
 *  the GET response can report a candidateCount per requirement. */
export function countMatchesByRequirement(
  matchRows: Array<{ requirement_id: string }>,
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const m of matchRows) counts.set(m.requirement_id, (counts.get(m.requirement_id) || 0) + 1);
  return counts;
}

/** Per-candidate average of their session scores — candidates with no
 *  sessions get no entry (the caller treats that as "no track record yet",
 *  not a zero). */
export function averageScoresByUser(
  sessionRows: Array<{ user_id: string; score: number }>,
): Map<string, number> {
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const s of sessionRows) {
    sums.set(s.user_id, (sums.get(s.user_id) || 0) + (s.score || 0));
    counts.set(s.user_id, (counts.get(s.user_id) || 0) + 1);
  }
  const averages = new Map<string, number>();
  for (const [uid, sum] of sums) averages.set(uid, sum / (counts.get(uid) || 1));
  return averages;
}

/** Days since the candidate's most recent practice session, from their
 *  practice_timestamps array (already sorted ascending by the caller's
 *  storage convention) — 999 stands in for "never practiced" so recency
 *  scoring treats them as maximally stale rather than crashing on a missing
 *  date. */
export function daysSinceLastActive(timestamps: string[], nowMs: number): number {
  if (timestamps.length === 0) return 999;
  const lastActive = timestamps[timestamps.length - 1];
  return Math.max(0, Math.round((nowMs - new Date(lastActive).getTime()) / 86_400_000));
}
