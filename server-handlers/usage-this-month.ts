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

import { withAuthAndRateLimit, corsHeaders, withRequestId, redisGet, redisSetEx } from "./_shared";
import {
  capsForTier,
  countFromContentRange,
  monthWindow,
  packWindow,
} from "./_usage-this-month-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

/** 60-second TTL for per-user usage cache — short enough to feel live, long
 *  enough to absorb rapid Settings tab refreshes and mobile back-navigation. */
const USAGE_CACHE_TTL_SEC = 60;

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

interface ProfileWindow {
  tier: string;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
}

async function readProfile(userId: string): Promise<ProfileWindow> {
  const none: ProfileWindow = { tier: "free", subscriptionStart: null, subscriptionEnd: null };
  const q = `profiles?id=eq.${encodeURIComponent(userId)}&select=subscription_tier,subscription_start,subscription_end`;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${q}`, {
    headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
  });
  if (!res.ok) return none;
  const rows = (await res.json()) as Array<{
    subscription_tier?: string; subscription_start?: string | null; subscription_end?: string | null;
  }>;
  const row = rows?.[0];
  if (!row) return none;
  // Expired paid tiers fall back to free — same rule as checkSessionLimit.
  if (row.subscription_tier && row.subscription_tier !== "free" && row.subscription_end) {
    if (new Date(row.subscription_end) < new Date()) return none;
  }
  return {
    tier: row.subscription_tier || "free",
    subscriptionStart: row.subscription_start ?? null,
    subscriptionEnd: row.subscription_end ?? null,
  };
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

  // Redis cache: return a short-lived cached response on cache hit to avoid
  // repeated Supabase roundtrips on rapid Settings tab refreshes. Only active
  // when UPSTASH credentials are present (same guard used across all handlers).
  const cacheKey = `utm:${auth.userId}`;
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      const cached = await redisGet(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as Record<string, unknown>;
        return new Response(JSON.stringify({ ...parsed, _cached: true }), {
          status: 200,
          headers: { ...headers, "Cache-Control": "private, max-age=60" },
        });
      }
    } catch { /* malformed cache entry — fall through to live path */ }
  }

  const now = new Date();
  const profile = await readProfile(auth.userId);
  const tier = profile.tier;
  // Starter is a one-off Sprint Pack counted from the purchase date, not the
  // calendar month — mirror the server gate so Settings, the sidebar, and the
  // enforced limit all agree. Pro/free stay on the monthly window.
  const { periodStart, periodEnd } = tier === "starter"
    ? packWindow(profile.subscriptionStart, profile.subscriptionEnd, now)
    : monthWindow(now);
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

  const responseBody = {
    ok: true,
    tier,
    period_start: periodStart,
    period_end: periodEnd,
    mock: { count: mock, cap: capValue(caps.mock) },
    resume_parses: { count: parses, cap: capValue(caps.resumeParses) },
    coach_insights: null,
  };

  // Best-effort cache store — fire-and-forget so a Redis write failure
  // never blocks the response.
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    void redisSetEx(cacheKey, USAGE_CACHE_TTL_SEC, JSON.stringify(responseBody));
  }

  return new Response(
    JSON.stringify(responseBody),
    { status: 200, headers: { ...headers, "Cache-Control": "private, max-age=60" } },
  );
}
