/* Vercel Edge Function — Employer Unlock Candidate
 *
 * POST /api/employer-unlock-candidate { matchId } → marks a
 * requirement_matches row unlocked (ownership-verified via its parent
 * requirement's employer_id) and returns the candidate's contact details.
 *
 * Razorpay is explicitly out of scope for this pass — unlocking is free.
 * The client-facing copy still shows a price because that's the intended
 * real behavior once payment is wired in; no charge happens here yet.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503, headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "employer-unlock-candidate",
    ipLimit: 20,
    userLimit: 15,
    maxBytes: 2_000,
    checkQuota: false,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  let body: { matchId?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }
  const matchId = typeof body.matchId === "string" ? body.matchId.slice(0, 64) : "";
  if (!matchId) {
    return new Response(JSON.stringify({ error: "matchId is required" }), { status: 400, headers });
  }

  try {
    const matchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}&select=id,requirement_id,candidate_user_id,unlocked`,
      { headers: serviceHeaders() },
    );
    if (!matchRes.ok) throw new Error(`match read failed: ${matchRes.status}`);
    const matchRows = (await matchRes.json().catch(() => [])) as Array<{ id: string; requirement_id: string; candidate_user_id: string; unlocked: boolean }>;
    const match = matchRows[0];
    if (!match) {
      return new Response(JSON.stringify({ error: "Match not found" }), { status: 404, headers });
    }

    const reqRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(match.requirement_id)}&employer_id=eq.${encodeURIComponent(auth.userId)}&select=id,status`,
      { headers: serviceHeaders() },
    );
    const reqRows = (await reqRes.json().catch(() => [])) as Array<{ id: string; status: string }>;
    if (!reqRes.ok || !reqRows[0]) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers });
    }
    if (reqRows[0].status === "closed") {
      return new Response(JSON.stringify({ error: "This requirement is closed" }), { status: 409, headers });
    }

    if (!match.unlocked) {
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}`,
        {
          method: "PATCH",
          headers: { ...serviceHeaders(), "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ unlocked: true, unlocked_at: new Date().toISOString() }),
        },
      );
      if (!patchRes.ok) {
        const t = await patchRes.text().catch(() => "");
        slog.error("employer-unlock-candidate patch failed", { code: "employer_unlock_patch_failed", httpStatus: patchRes.status, body: t.slice(0, 200), userId: auth.userId, matchId });
        return new Response(JSON.stringify({ error: "Failed to unlock candidate" }), { status: 500, headers });
      }
    }

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(match.candidate_user_id)}&select=name,email`,
      { headers: serviceHeaders() },
    );
    const profileRows = (await profileRes.json().catch(() => [])) as Array<{ name: string; email: string }>;
    const profile = profileRows[0];

    return new Response(
      JSON.stringify({ matchId, unlocked: true, name: profile?.name || "Candidate", contact: { email: profile?.email || "" } }),
      { status: 200, headers },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-unlock-candidate threw", { code: "employer_unlock_unexpected_error", error: msg.slice(0, 200), userId: auth.userId, matchId });
    return new Response(JSON.stringify({ error: "Failed to unlock candidate" }), { status: 500, headers });
  }
}
