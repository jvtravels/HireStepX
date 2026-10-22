/* Once HireStepX has graded a session on the server (report_generated_at is
   set), its score and skill_scores belong to that report. Employers read those
   columns as evidence, so a client write after grading must not change them. */

export interface SessionOwnerRow {
  user_id: string;
  report_generated_at?: string | null;
}

export function isServerGraded(row: Pick<SessionOwnerRow, "report_generated_at"> | null | undefined): boolean {
  return !!row?.report_generated_at;
}

const LOCKED_FIELDS = ["score", "skill_scores"] as const;

/** Copy of `row` without the fields a graded session no longer accepts from the client. */
export function withoutGradedFields<T extends Record<string, unknown>>(row: T, graded: boolean): T {
  if (!graded) return row;
  const next: Record<string, unknown> = { ...row };
  for (const f of LOCKED_FIELDS) delete next[f];
  return next as T;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** Looks up the owner and graded state of a session. `report_generated_at` is
 *  optional on older databases, so a missing column falls back to owner only. */
export async function fetchSessionOwner(
  id: string,
  supabaseUrl: string,
  serviceKey: string,
  fetchImpl: FetchLike = fetch,
): Promise<{ ok: false } | { ok: true; row: SessionOwnerRow | null }> {
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const base = `${supabaseUrl}/rest/v1/sessions?id=eq.${encodeURIComponent(id)}`;
  let res = await fetchImpl(`${base}&select=user_id,report_generated_at`, { headers });
  if (!res.ok && res.status === 400) res = await fetchImpl(`${base}&select=user_id`, { headers });
  if (!res.ok) return { ok: false };
  const rows = await res.json().catch(() => []);
  return { ok: true, row: Array.isArray(rows) && rows[0] ? (rows[0] as SessionOwnerRow) : null };
}
