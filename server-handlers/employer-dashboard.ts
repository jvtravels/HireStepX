/* Vercel Edge Function — Employer Dashboard aggregates
 *
 * GET /api/employer-dashboard?range=7|30|90
 * Pipeline counts per job, trend series for the stat cards, upcoming
 * interviews, recently recommended candidates and a recent-activity feed.
 * Counts that the jobs list already carries (open jobs, AI screening) are NOT
 * repeated here; this endpoint only adds what comes from requirement_matches
 * and the status/activity logs. Aggregation lives in _employer-dashboard-helpers.ts.
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId, slog } from "./_shared";
import { chunk, inList, fetchKeyset } from "./_employer-matching-helpers";
import { STRONG_MATCH_THRESHOLD } from "./_requirement-match-helpers";
import {
  asDashboardRange, buildTrend, summarizeJobs, selectUpcomingInterviews, selectRecentRecommended, rankForReview,
  buildActivityFeed, type DashboardMatchRow, type StatusEventRow,
} from "./_employer-dashboard-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function serviceHeaders(): Record<string, string> {
  return { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` };
}

const DAY_MS = 86_400_000;

async function readRows<T>(url: string): Promise<T[]> {
  const res = await fetch(url, { headers: serviceHeaders() });
  if (!res.ok) throw new Error(`dashboard read failed: ${res.status}`);
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? (rows as T[]) : [];
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
    endpoint: "employer-dashboard",
    ipLimit: 40,
    userLimit: 20,
    maxBytes: 0,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = { ...pre.headers, ...corsHeaders(req, { allowGet: true }) };

  if (!auth.userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  if (req.method !== "GET") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers });

  const range = asDashboardRange(new URL(req.url).searchParams.get("range"));
  const now = Date.now();
  const employer = encodeURIComponent(auth.userId);
  const since = new Date(now - 2 * range * DAY_MS).toISOString();

  try {
    const [requirements, events, activity] = await Promise.all([
      readRows<{ id: string; title: string; created_at: string }>(
        `${SUPABASE_URL}/rest/v1/employer_requirements?employer_id=eq.${employer}&select=id,title,created_at&order=created_at.desc&limit=500`,
      ),
      readRows<StatusEventRow>(
        `${SUPABASE_URL}/rest/v1/match_status_events?employer_id=eq.${employer}&created_at=gte.${encodeURIComponent(since)}&select=match_id,requirement_id,to_status,actor,note,created_at&order=created_at.desc&limit=2000`,
      ),
      readRows<{ requirement_id: string; created_at: string }>(
        `${SUPABASE_URL}/rest/v1/employer_requirement_activity?employer_id=eq.${employer}&select=requirement_id,created_at&order=created_at.desc&limit=500`,
      ),
    ]);

    const ids = requirements.map((r) => r.id);
    const matches: DashboardMatchRow[] = [];
    for (const batch of chunk(ids, 20)) {
      const r = await fetchKeyset<DashboardMatchRow & Record<string, unknown>>({
        baseUrl: `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=in.(${inList(batch)})&select=id,requirement_id,candidate_status,interview_scheduled_at,candidate_status_updated_at,created_at,unlocked,unlocked_candidate_name,match_score`,
        headers: serviceHeaders(), keyField: "id", pageSize: 1000, maxRows: 5000,
      });
      if (r.failed) throw new Error("dashboard matches read failed");
      matches.push(...r.rows);
    }

    const titleByRequirement = new Map(requirements.map((r) => [r.id, r.title]));
    const createdAtByRequirement = new Map(requirements.map((r) => [r.id, r.created_at]));
    const lastActivity = new Map<string, string>();
    for (const a of activity) if (!lastActivity.has(a.requirement_id)) lastActivity.set(a.requirement_id, a.created_at);
    const matchById = new Map(matches.map((m) => [m.id, m]));

    const eventTimes = (statuses: string[]) => events.filter((e) => statuses.includes(e.to_status)).map((e) => e.created_at);
    const upcoming = selectUpcomingInterviews(matches, titleByRequirement, now, Number.MAX_SAFE_INTEGER);
    const strongRefs = selectRecentRecommended(matches, STRONG_MATCH_THRESHOLD, 500);

    const body = {
      range,
      jobs: summarizeJobs(ids, matches, lastActivity, createdAtByRequirement),
      totals: {
        interviewsScheduled: upcoming.length,
        hired: matches.filter((m) => m.candidate_status === "hired").length,
        awaitingReview: strongRefs.length,
      },
      trends: {
        jobs: buildTrend(requirements.map((r) => r.created_at), now, range),
        recommended: buildTrend(matches.filter((m) => m.match_score >= STRONG_MATCH_THRESHOLD && m.created_at).map((m) => m.created_at as string), now, range),
        interviews: buildTrend(eventTimes(["interview_invited", "interviewing"]), now, range),
        hired: buildTrend(eventTimes(["hired"]), now, range),
      },
      upcomingInterviews: upcoming.slice(0, 4),
      recommended: rankForReview(strongRefs).slice(0, 12),
      activity: buildActivityFeed(events, matchById, 6),
    };
    return new Response(JSON.stringify(body), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    slog.error("employer-dashboard GET threw", { code: "employer_dashboard_unexpected_error", error: msg.slice(0, 200), userId: auth.userId });
    return new Response(JSON.stringify({ error: "Failed to load dashboard" }), { status: 500, headers });
  }
}
