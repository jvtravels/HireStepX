/* Vercel Edge Function — Candidate actions on an employer match
 *
 * POST /api/candidate-employer-actions
 *   { action: "block" | "report" | "respond", matchId, reason?, note?, response? }
 *
 *   block   -> employer_blocks upsert; the employer can no longer reach this candidate (see _entitlements.ts)
 *   report  -> employer_reports insert (+ block); 3 distinct reporters auto-suspend the employer
 *   respond -> requirement_matches.candidate_response = interested | declined, audit event, employer notified
 *
 * The caller must BE the candidate of the match; the employer id is derived
 * from the match's requirement, never taken from the client. A match that
 * belongs to someone else answers 404 (not 403) so ids can't be probed. */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, slog, supabaseUrl, supabaseServiceHeaders } from "./_shared";
import { notify } from "./_notify";
import { maskedCandidateName } from "./_employer-trust";
import {
  asCandidateResponse,
  asEmployerAction,
  countDistinctReporters,
  decideAutoSuspension,
  isReportReason,
  isUuid,
  respondNotificationText,
  sanitizeNote,
  type CandidateResponse,
  type ReportReason,
} from "./_candidate-consent-helpers";

interface MatchRow {
  id: string;
  requirement_id: string;
  candidate_user_id: string;
  candidate_status: string | null;
  candidate_response: string | null;
  employer_requirements: {
    employer_id: string;
    title: string | null;
    employers: { suspended_at: string | null } | null;
  } | null;
}

type Failure = { ok: false; status: number; error: string };
type Done<T = Record<string, unknown>> = { ok: true } & T;

const MATCH_SELECT = "id,requirement_id,candidate_user_id,candidate_status,candidate_response,employer_requirements(employer_id,title,employers(suspended_at))";

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

function writeHeaders(prefer: string): Record<string, string> {
  return { ...supabaseServiceHeaders(), "Content-Type": "application/json", Prefer: prefer };
}

/** Loads the match only if the caller is its candidate. */
export async function loadOwnMatch(base: string, matchId: string, userId: string, f: typeof fetch): Promise<MatchRow | "not_found" | "error"> {
  const res = await f(`${base}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}&select=${MATCH_SELECT}&limit=1`, {
    headers: supabaseServiceHeaders(),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return "error";
  const rows = (await res.json().catch(() => [])) as MatchRow[];
  const row = rows[0];
  if (!row || row.candidate_user_id !== userId || !row.employer_requirements?.employer_id) return "not_found";
  return row;
}

async function upsertBlock(base: string, userId: string, employerId: string, f: typeof fetch): Promise<boolean> {
  const res = await f(`${base}/rest/v1/employer_blocks?on_conflict=candidate_user_id,employer_id`, {
    method: "POST",
    headers: writeHeaders("resolution=ignore-duplicates,return=minimal"),
    body: JSON.stringify({ candidate_user_id: userId, employer_id: employerId }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  return !!res && res.ok;
}

export async function doBlock(base: string, match: MatchRow, userId: string, f: typeof fetch): Promise<Done<{ blocked: true }> | Failure> {
  const employerId = match.employer_requirements!.employer_id;
  if (!(await upsertBlock(base, userId, employerId, f))) return { ok: false, status: 500, error: "Could not block this employer" };
  return { ok: true, blocked: true };
}

export async function doReport(
  base: string,
  match: MatchRow,
  userId: string,
  input: { reason: ReportReason; note: string | null },
  f: typeof fetch,
): Promise<Done<{ blocked: true; reported: true; alreadyReported: boolean }> | Failure> {
  const employerId = match.employer_requirements!.employer_id;

  const insertRes = await f(`${base}/rest/v1/employer_reports`, {
    method: "POST",
    headers: writeHeaders("return=minimal"),
    body: JSON.stringify({ reporter_user_id: userId, employer_id: employerId, match_id: match.id, reason: input.reason, note: input.note }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!insertRes) return { ok: false, status: 500, error: "Could not file the report" };
  // unique (reporter_user_id, employer_id): a second report is a no-op success.
  const alreadyReported = insertRes.status === 409;
  if (!insertRes.ok && !alreadyReported) {
    slog.error("candidate-employer-actions: report insert failed", { status: insertRes.status });
    return { ok: false, status: 500, error: "Could not file the report" };
  }

  // Reporting always implies blocking: the candidate should not hear from them again.
  if (!(await upsertBlock(base, userId, employerId, f))) {
    return { ok: false, status: 500, error: "Report filed but the employer could not be blocked. Please try Block again." };
  }

  // Dismissed reports (admin judged them unfounded) don't count toward suspension.
  const countRes = await f(
    `${base}/rest/v1/employer_reports?employer_id=eq.${encodeURIComponent(employerId)}&status=neq.dismissed&select=reporter_user_id&limit=1000`,
    { headers: supabaseServiceHeaders(), signal: AbortSignal.timeout(6000) },
  ).catch(() => null);
  if (countRes && countRes.ok) {
    const rows = (await countRes.json().catch(() => [])) as Array<{ reporter_user_id?: unknown }>;
    const distinct = countDistinctReporters(rows);
    const decision = decideAutoSuspension(distinct, !!match.employer_requirements?.employers?.suspended_at);
    if (decision.suspend) {
      // `suspended_at=is.null` keeps a concurrent admin suspension's reason/timestamp.
      const susRes = await f(`${base}/rest/v1/employers?id=eq.${encodeURIComponent(employerId)}&suspended_at=is.null`, {
        method: "PATCH",
        headers: writeHeaders("return=minimal"),
        body: JSON.stringify({ suspended_at: new Date().toISOString(), suspended_reason: decision.reason }),
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      if (susRes && susRes.ok) {
        slog.warn("candidate-employer-actions: employer auto-suspended", { employerId, distinctReporters: distinct });
      } else {
        slog.error("candidate-employer-actions: auto-suspend PATCH failed", { employerId, status: susRes?.status ?? 0 });
      }
    }
  } else {
    slog.warn("candidate-employer-actions: report count lookup failed", { employerId });
  }

  return { ok: true, blocked: true, reported: true, alreadyReported };
}

export async function doRespond(
  base: string,
  match: MatchRow,
  userId: string,
  response: CandidateResponse,
  f: typeof fetch,
): Promise<Done<{ response: CandidateResponse; respondedAt: string | null; changed: boolean }> | Failure> {
  const previous = match.candidate_response ?? "none";
  if (previous === response) return { ok: true, response, respondedAt: null, changed: false };

  const respondedAt = new Date().toISOString();
  // Candidate-scoped PATCH (belt and braces on top of the ownership check above).
  const patchRes = await f(
    `${base}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(match.id)}&candidate_user_id=eq.${encodeURIComponent(userId)}`,
    {
      method: "PATCH",
      headers: writeHeaders("return=representation"),
      body: JSON.stringify({ candidate_response: response, candidate_responded_at: respondedAt }),
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);
  if (!patchRes || !patchRes.ok) {
    slog.error("candidate-employer-actions: respond PATCH failed", { status: patchRes?.status ?? 0 });
    return { ok: false, status: 500, error: "Could not save your response" };
  }
  const updated = (await patchRes.json().catch(() => [])) as unknown[];
  if (updated.length === 0) return { ok: false, status: 404, error: "Match not found" };

  const employerId = match.employer_requirements!.employer_id;
  // Timeline vocabulary: actor='candidate' rows use to_status candidate_<response>
  // (the employer pipeline's own statuses — shortlisted, hired… — stay untouched).
  const eventRes = await f(`${base}/rest/v1/match_status_events`, {
    method: "POST",
    headers: writeHeaders("return=minimal"),
    body: JSON.stringify({
      match_id: match.id,
      requirement_id: match.requirement_id,
      employer_id: employerId,
      candidate_user_id: userId,
      from_status: previous === "none" ? null : `candidate_${previous}`,
      to_status: `candidate_${response}`,
      actor: "candidate",
      note: null,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!eventRes || !eventRes.ok) {
    slog.error("candidate-employer-actions: status event insert failed", { status: eventRes?.status ?? 0, matchId: match.id });
  }

  // Name stays masked: the candidate's real identity is only ever revealed by the unlock flow.
  const text = respondNotificationText(response, maskedCandidateName(match.id), match.employer_requirements?.title ?? null);
  await notify({
    userId: employerId,
    type: "candidate_responded",
    title: text.title,
    body: text.body,
    link: `/employer/requirements/${match.requirement_id}`,
  });

  return { ok: true, response, respondedAt, changed: true };
}

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "candidate-employer-actions",
    ipLimit: 30,
    userLimit: 15,
    maxBytes: 4_000,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req) };

  if (!auth.userId) return json({ error: "Unauthorized" }, 401, headers);
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, headers);
  const base = supabaseUrl();
  if (!base || !supabaseServiceHeaders().apikey) return json({ error: "Server misconfigured" }, 503, headers);

  let body: { action?: unknown; matchId?: unknown; reason?: unknown; note?: unknown; response?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400, headers);
  }

  const action = asEmployerAction(body?.action);
  if (!action) return json({ error: "action must be block, report or respond" }, 400, headers);
  if (!isUuid(body.matchId)) return json({ error: "matchId is required" }, 400, headers);

  let reason: ReportReason | null = null;
  let response: CandidateResponse | null = null;
  if (action === "report") {
    if (!isReportReason(body.reason)) return json({ error: "A valid reason is required" }, 400, headers);
    reason = body.reason;
  }
  if (action === "respond") {
    response = asCandidateResponse(body.response);
    if (!response) return json({ error: "response must be interested or declined" }, 400, headers);
  }

  try {
    const match = await loadOwnMatch(base, body.matchId, auth.userId, fetch);
    if (match === "error") return json({ error: "Could not load this match" }, 502, headers);
    if (match === "not_found") return json({ error: "Match not found" }, 404, headers);

    const result =
      action === "block" ? await doBlock(base, match, auth.userId, fetch)
      : action === "report" ? await doReport(base, match, auth.userId, { reason: reason!, note: sanitizeNote(body.note) }, fetch)
      : await doRespond(base, match, auth.userId, response!, fetch);

    if (!result.ok) return json({ error: result.error }, result.status, headers);
    return json(result, 200, headers);
  } catch (err) {
    slog.error("candidate-employer-actions: unexpected error", { error: err instanceof Error ? err.message : String(err), action });
    return json({ error: "Internal error" }, 500, headers);
  }
}
