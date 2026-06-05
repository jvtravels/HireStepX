/* Vercel Edge Function — Usage this month
 *
 * Aggregates the user's consumption for the current UTC calendar month
 * so the Settings → Plan & Data tab can render a real "X of Y" bar
 * per resource instead of a single hard-coded session count.
 *
 * Counts come from Supabase via `Prefer: count=exact` on the REST API
 * — no row payloads are pulled, just the header total. We hit two
 * tables in parallel: `sessions` for mock interview count and
 * `resume_versions` (joined through `resumes.user_id`) for parse count.
 *
 * Coach-insights count is intentionally null in the response: there's
 * no dedicated coach-messages table today, and conflating it with
 * `session_insights` (one row per session) would double-count the
 * mock-interview metric. Leaving the field null lets the UI hide that
 * row cleanly until a real source lands.
 *
 * GET /api/usage-this-month
 *   → { ok, period_start, period_end, mock: { count, cap },
 *        resume_parses: { count, cap }, coach_insights: null }
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import {
  capsForTier,
  countFromContentRange,
  monthWindow,
} from "./_usage-this-month-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function svcHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    Prefer: "count=exact",
  };
}

async function countSessions(userId: string, periodStart: string, periodEnd: string): Promise<number> {
  const q = `sessions?user_id=eq.${encodeURIComponent(userId)}&created_at=gte.${encodeURIComponent(periodStart)}&created_at=lt.${encodeURIComponent(periodEnd)}&select=id`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: svcHeaders() });
  if (!res.ok) return 0;
  return countFromContentRange(res.headers.get("content-range"));
}

async function countResumeParses(userId: string, periodStart: string, periodEnd: string): Promise<number> {
  // resume_versions.created_at + a join through resumes.user_id. PostgREST
  // exposes the join as a filter on the parent resource, which is the
  // safest cross-table count without a SQL view.
  const q = `resume_versions?created_at=gte.${encodeURIComponent(periodStart)}&created_at=lt.${encodeURIComponent(periodEnd)}&resumes.user_id=eq.${encodeURIComponent(userId)}&select=id,resumes!inner(user_id)`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, { headers: svcHeaders() });
  if (!res.ok) return 0;
  return countFromContentRange(res.headers.get("content-range"));
}

async function readTier(userId: string): Promise<string> {
  const q = `profiles?id=eq.${encodeURIComponent(userId)}&select=subscription_tier,subscription_end`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  if (!res.ok) return "free";
  const rows = (await res.json()) as Array<{ subscription_tier?: string; subscription_end?: string | null }>;
  const row = rows?.[0];
  if (!row) return "free";
  // Expired paid tiers fall back to free — same rule as checkSessionLimit.
  if (row.subscription_tier && row.subscription_tier !== "free" && row.subscription_end) {
    if (new Date(row.subscription_end) < new Date()) return "free";
  }
  return row.subscription_tier || "free";
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 503,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "usage-this-month",
    ipLimit: 60,
    userLimit: 30,
    maxBytes: 1_000,
    checkQuota: false,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;
  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  const { periodStart, periodEnd } = monthWindow(new Date());
  const tier = await readTier(auth.userId);
  const caps = capsForTier(tier);

  // Fan out the two count queries in parallel; the auth + tier lookup
  // already cost two roundtrips so we don't want to serialise these.
  const [mock, parses] = await Promise.all([
    countSessions(auth.userId, periodStart, periodEnd),
    countResumeParses(auth.userId, periodStart, periodEnd),
  ]);

  // Infinity isn't valid JSON — surface unlimited caps as null so the
  // UI can branch on "no cap" cleanly.
  const capValue = (n: number) => (Number.isFinite(n) ? n : null);

  return new Response(
    JSON.stringify({
      ok: true,
      tier,
      period_start: periodStart,
      period_end: periodEnd,
      mock: { count: mock, cap: capValue(caps.mock) },
      resume_parses: { count: parses, cap: capValue(caps.resumeParses) },
      coach_insights: null,
    }),
    { status: 200, headers: { ...headers, "Cache-Control": "private, max-age=60" } },
  );
}
