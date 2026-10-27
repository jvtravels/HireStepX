/* Vercel Edge Function — Employer Requirement Activity
 *
 * GET /api/employer-requirement-activity?id=<requirementId>
 * Returns the activity log (created/updated/archived/reopened) for one
 * requirement owned by the caller, newest first — backs the "History"
 * action on the Jobs table's row menu. Rows are written by
 * logRequirementActivity() in employer-requirements.ts.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { requireEmployerPermission } from "./_employer-team-helpers";

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
    endpoint: "employer-requirement-activity",
    ipLimit: 40,
    userLimit: 20,
    maxBytes: 0,
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

  const requirementId = new URL(req.url).searchParams.get("id") || "";
  if (!requirementId) {
    return new Response(JSON.stringify({ error: "id is required" }), { status: 400, headers });
  }

  try {
    const gate = await requireEmployerPermission(SUPABASE_URL, serviceHeaders(), auth.userId, "jobs.read");
    if (!gate.ok) return new Response(JSON.stringify({ error: gate.error }), { status: gate.status, headers });
    const employerId = gate.ctx.employerId;
    const ownerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(employerId)}&select=id`,
      { headers: serviceHeaders() },
    );
    const ownerRows = (await ownerRes.json().catch(() => [])) as Array<{ id: string }>;
    if (!ownerRes.ok || !ownerRows[0]) {
      return new Response(JSON.stringify({ error: "Requirement not found" }), { status: 404, headers });
    }

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirement_activity?requirement_id=eq.${encodeURIComponent(requirementId)}&select=id,action,detail,actor_user_id,created_at&order=created_at.desc&limit=50`,
      { headers: serviceHeaders() },
    );
    if (!res.ok) throw new Error(`activity read failed: ${res.status}`);
    const rows = (await res.json().catch(() => [])) as Array<{ id: string; action: string; detail: string | null; actor_user_id: string | null; created_at: string }>;

    // Names come from the live roster; a removed member's past actions read "Former member".
    const rosterRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_members?employer_id=eq.${encodeURIComponent(employerId)}&select=user_id,name,email`,
      { headers: serviceHeaders() },
    ).catch(() => null);
    const roster = rosterRes?.ok ? ((await rosterRes.json().catch(() => [])) as Array<{ user_id: string; name: string | null; email: string }>) : [];
    const names = new Map(roster.map((m) => [m.user_id, m.name || m.email]));

    const activity = rows.map((r) => ({
      id: r.id, action: r.action, detail: r.detail, createdAt: r.created_at,
      actorName: r.actor_user_id ? names.get(r.actor_user_id) ?? "Former member" : null,
    }));
    return new Response(JSON.stringify({ activity }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-requirement-activity GET threw", { code: "employer_requirement_activity_unexpected_error", error: msg.slice(0, 200), userId: auth.userId, requirementId });
    return new Response(JSON.stringify({ error: "Failed to load history" }), { status: 500, headers });
  }
}
