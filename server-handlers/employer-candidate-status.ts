/* Vercel Edge Function — Employer Candidate Status
 *
 * PATCH /api/employer-candidate-status
 * { matchId: string, candidateStatus: CandidateStatus, note?: string, interviewScheduledAt?: string }
 *
 * Moves one candidate (a requirement_matches row) through the per-candidate
 * hiring pipeline — shortlisted through hired/rejected — independent of the
 * requirement-level `stage` in employer-requirement-detail.ts, which tracks
 * the posting as a whole rather than any one candidate.
 *
 * Ownership is never taken on trust from the client: the match's parent
 * employer_requirements row is looked up and its employer_id compared
 * against the authenticated caller before any write happens.
 *
 * Reused by the outcome-feedback page (app/(employer)/employer/
 * requirements/[id]/outcome/page.tsx) to persist the final hiring outcome
 * that page collects — "Hired" -> hired, "Interviewing" -> interviewing,
 * "Not a fit" -> not_a_fit, "No response yet" -> no_response, with the
 * employer's notes going to `note`.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import {
  asCandidateStatus,
  asCandidateStatusNote,
  asInterviewScheduledAt,
  type RequirementMatchRow,
} from "./_employer-candidate-status-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

function toResponseShape(row: RequirementMatchRow) {
  return {
    id: row.id,
    requirementId: row.requirement_id,
    candidateStatus: row.candidate_status,
    candidateStatusNote: row.candidate_status_note,
    candidateStatusUpdatedAt: row.candidate_status_updated_at,
    interviewScheduledAt: row.interview_scheduled_at,
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, { allowPatch: true }) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req, { allowPatch: true })),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-candidate-status",
    ipLimit: 40,
    userLimit: 20,
    maxBytes: 10_000,
    checkQuota: false,
    allowPatch: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowPatch: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  if (req.method !== "PATCH") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  let body: { matchId?: unknown; candidateStatus?: unknown; note?: unknown; interviewScheduledAt?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const matchId = typeof body.matchId === "string" ? body.matchId : "";
  const candidateStatus = asCandidateStatus(body.candidateStatus);
  const note = asCandidateStatusNote(body.note);
  const interviewScheduledAt = asInterviewScheduledAt(body.interviewScheduledAt);

  if (!matchId) {
    return new Response(JSON.stringify({ error: "matchId is required" }), { status: 400, headers });
  }
  if (!candidateStatus) {
    return new Response(JSON.stringify({ error: "Invalid candidateStatus" }), { status: 400, headers });
  }

  try {
    // Ownership check: the match must belong to a requirement this employer
    // owns. Never trust a client-supplied requirement id for this — resolve
    // it from the match row itself, then verify the parent's employer_id.
    const matchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}&select=id,requirement_id`,
      { headers: serviceHeaders() },
    );
    const matchRows = (await matchRes.json().catch(() => [])) as Array<{ id: string; requirement_id: string }>;
    if (!matchRes.ok || !matchRows[0]) {
      return new Response(JSON.stringify({ error: "Candidate match not found" }), { status: 404, headers });
    }
    const requirementId = matchRows[0].requirement_id;

    const reqRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(auth.userId)}&select=id`,
      { headers: serviceHeaders() },
    );
    const reqRows = (await reqRes.json().catch(() => [])) as Array<{ id: string }>;
    if (!reqRes.ok || !reqRows[0]) {
      return new Response(JSON.stringify({ error: "Candidate match not found" }), { status: 404, headers });
    }

    const patchBody: Record<string, unknown> = {
      candidate_status: candidateStatus,
      candidate_status_updated_at: new Date().toISOString(),
    };
    if (note !== null) patchBody.candidate_status_note = note;
    if (interviewScheduledAt !== null) patchBody.interview_scheduled_at = interviewScheduledAt;

    const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(patchBody),
    });
    if (!patchRes.ok) {
      const t = await patchRes.text().catch(() => "");
      slog.error("employer-candidate-status PATCH failed", { code: "employer_candidate_status_patch_failed", httpStatus: patchRes.status, body: t.slice(0, 200), userId: auth.userId, matchId });
      return new Response(JSON.stringify({ error: "Failed to update candidate status" }), { status: 500, headers });
    }
    const updated = (await patchRes.json().catch(() => [])) as RequirementMatchRow[];
    const row = updated[0];
    if (!row) {
      return new Response(JSON.stringify({ error: "Failed to update candidate status" }), { status: 500, headers });
    }

    return new Response(JSON.stringify(toResponseShape(row)), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-candidate-status threw", { code: "employer_candidate_status_unexpected_error", error: msg.slice(0, 200), userId: auth.userId, matchId });
    return new Response(JSON.stringify({ error: "Failed to update candidate status" }), { status: 500, headers });
  }
}
