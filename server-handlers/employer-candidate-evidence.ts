/* Vercel Edge Function — Employer Candidate Evidence
 *
 * GET /api/employer-candidate-evidence?matchId=...
 *
 * Surfaces a candidate's ACTUAL per-skill scores from their most recent
 * completed practice session — never fabricated role-specific dimensions.
 * Reuses the RISkill shape already persisted at sessions.report_json.skills
 * (see _readiness-core.ts / sessionReport/types.ts) rather than inventing a
 * new one; extraction lives in _employer-candidate-evidence-helpers.ts so
 * it's unit-tested against the real code.
 *
 * Ownership is never taken on trust from the client: the match's parent
 * employer_requirements row is looked up and its employer_id compared
 * against the authenticated caller before any session data is read.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { extractEvidenceSkills, latestSessionByUser, type SessionRow } from "./_employer-candidate-evidence-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req, { allowGet: true }) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req, { allowGet: true })),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-candidate-evidence",
    ipLimit: 60,
    userLimit: 30,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });
  }

  const url = new URL(req.url);
  const matchId = url.searchParams.get("matchId") || "";
  if (!matchId) {
    return new Response(JSON.stringify({ error: "matchId is required" }), { status: 400, headers });
  }

  try {
    const matchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}&select=id,requirement_id,candidate_user_id`,
      { headers: serviceHeaders() },
    );
    const matchRows = (await matchRes.json().catch(() => [])) as Array<{ id: string; requirement_id: string; candidate_user_id: string }>;
    if (!matchRes.ok || !matchRows[0]) {
      return new Response(JSON.stringify({ error: "Candidate match not found" }), { status: 404, headers });
    }
    const { requirement_id: requirementId, candidate_user_id: candidateUserId } = matchRows[0];

    const reqRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(auth.userId)}&select=id`,
      { headers: serviceHeaders() },
    );
    const reqRows = (await reqRes.json().catch(() => [])) as Array<{ id: string }>;
    if (!reqRes.ok || !reqRows[0]) {
      return new Response(JSON.stringify({ error: "Candidate match not found" }), { status: 404, headers });
    }

    /* limit=20, not 1: the most recent session overall is frequently a
       salary-negotiation practice run, which latestSessionByUser() skips.
       Fetching a batch lets it fall through to the most recent session
       that's actually interview evidence instead of returning none. */
    const sessionsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/sessions?user_id=eq.${encodeURIComponent(candidateUserId)}&select=user_id,created_at,report_json,type&order=created_at.desc&limit=20`,
      { headers: serviceHeaders() },
    );
    const sessionRows = (await sessionsRes.json().catch(() => [])) as SessionRow[];
    const latest = latestSessionByUser(sessionRows).get(candidateUserId);

    return new Response(
      JSON.stringify({
        matchId,
        skills: latest ? extractEvidenceSkills(latest.report_json) : [],
        sessionDate: latest?.created_at ?? null,
      }),
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-candidate-evidence threw", { code: "employer_candidate_evidence_unexpected_error", error: msg.slice(0, 200), userId: auth.userId, matchId });
    return new Response(JSON.stringify({ error: "Failed to load evidence" }), { status: 500, headers });
  }
}
