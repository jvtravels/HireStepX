/* Vercel Edge Function — Team activity (audit log) feed
 *
 * GET /api/employer-team-activity?actor=<userId>&group=<members|jobs|candidates|company>&before=<iso>&limit=<n>
 *   → { events, nextBefore, summary }
 *
 * Owners and admins only (audit.read). `summary` is each member's event count
 * over the last 30 days, which is what the Team page shows as "activity".
 * Keyset-paginated on created_at so a long history stays cheap.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, slog } from "./_shared";
import { requireEmployerPermission } from "./_employer-team-helpers";
import { teamsEnabledFor } from "./_employer-team-gate";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const serviceHeaders = (): Record<string, string> => ({ apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` });

const GROUPS = new Set(["members", "jobs", "candidates", "company"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SUMMARY_DAYS = 30;

interface LogRow {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), { status: 503, headers: corsHeaders(req, { allowGet: true }) });
  }
  const pre = await withAuthAndRateLimit(req, { endpoint: "employer-team-activity", ipLimit: 60, userLimit: 40, checkQuota: false, allowGet: true });
  if (pre instanceof Response) return pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
  const userId = pre.auth.userId;
  if (!userId) return reply({ error: "Unauthorized" }, 401);
  if (req.method !== "GET") return reply({ error: "Method not allowed" }, 405);

  try {
    const gate = await requireEmployerPermission(SUPABASE_URL, serviceHeaders(), userId, "audit.read");
    if (!gate.ok) return reply({ error: gate.error }, gate.status);
    if (!(await teamsEnabledFor(gate.ctx.employerId))) return reply({ error: "Not found" }, 404);
    const eid = encodeURIComponent(gate.ctx.employerId);

    const q = new URL(req.url).searchParams;
    const limit = Math.min(Math.max(parseInt(q.get("limit") ?? "30", 10) || 30, 1), 100);
    let filter = `employer_id=eq.${eid}`;
    const actor = q.get("actor");
    if (actor && UUID.test(actor)) filter += `&actor_user_id=eq.${actor}`;
    const group = q.get("group");
    if (group && GROUPS.has(group)) filter += `&action=like.${group === "members" ? "member" : group === "jobs" ? "job" : group}.*`;
    const before = q.get("before");
    if (before && !Number.isNaN(Date.parse(before))) filter += `&created_at=lt.${encodeURIComponent(new Date(before).toISOString())}`;

    const since = new Date(Date.now() - SUMMARY_DAYS * 86_400_000).toISOString();
    const [logRes, sumRes, rosterRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/employer_audit_log?${filter}&select=id,actor_user_id,actor_email,action,entity_type,entity_id,meta,created_at&order=created_at.desc&limit=${limit + 1}`, { headers: serviceHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/employer_audit_log?employer_id=eq.${eid}&created_at=gte.${encodeURIComponent(since)}&select=actor_user_id,created_at&order=created_at.desc&limit=5000`, { headers: serviceHeaders() }),
      fetch(`${SUPABASE_URL}/rest/v1/employer_members?employer_id=eq.${eid}&select=user_id,name,email`, { headers: serviceHeaders() }),
    ]);
    if (!logRes.ok || !sumRes.ok || !rosterRes.ok) throw new Error(`activity read failed: ${logRes.status}/${sumRes.status}/${rosterRes.status}`);

    const rows = (await logRes.json()) as LogRow[];
    const roster = (await rosterRes.json()) as Array<{ user_id: string; name: string | null; email: string }>;
    const names = new Map(roster.map((m) => [m.user_id, m.name || m.email]));
    const page = rows.slice(0, limit);

    const counts = new Map<string, { count: number; lastAt: string }>();
    for (const r of (await sumRes.json()) as Array<{ actor_user_id: string | null; created_at: string }>) {
      if (!r.actor_user_id) continue;
      const cur = counts.get(r.actor_user_id);
      if (cur) cur.count++;
      else counts.set(r.actor_user_id, { count: 1, lastAt: r.created_at });
    }

    return reply({
      events: page.map((r) => ({
        id: r.id,
        at: r.created_at,
        action: r.action,
        entityType: r.entity_type,
        entityId: r.entity_id,
        meta: r.meta ?? {},
        actor: r.actor_user_id
          ? { userId: r.actor_user_id, name: names.get(r.actor_user_id) ?? r.actor_email ?? "Former member", removed: !names.has(r.actor_user_id) }
          : { userId: null, name: "System", removed: false },
      })),
      nextBefore: rows.length > limit ? page[page.length - 1].created_at : null,
      summary: Array.from(counts, ([id, v]) => ({ userId: id, count: v.count, lastAt: v.lastAt })),
      summaryDays: SUMMARY_DAYS,
    });
  } catch (err) {
    slog.error("employer-team-activity threw", { code: "employer_team_activity_error", error: String(err).slice(0, 200), userId });
    return reply({ error: "Couldn't load activity. Please try again." }, 500);
  }
}
