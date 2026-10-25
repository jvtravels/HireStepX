/* ── Platform Stats ─────────────────────────────────────────────────────────
 * Public edge endpoint: returns rounded-down live totals (people, completed
 * sessions, employers, roles). Powers the UpgradeModal social proof and the
 * About page "By the numbers" cards.
 *
 * Flow:
 *   1. Redis hit  → return cached raw counts (TTL 1 h)
 *   2. Redis miss → HEAD /rest/v1/<table> with Prefer: count=exact for each
 *                   table (service-role key, reads content-range header)
 *   3. Any failure, or a count below its display floor → that field is null
 *      and the UI renders a dash / no line. Counts are never inflated.
 *      Only sessions with >= COMPLETED_SESSION_MIN_QUESTIONS answers count.
 *
 * No auth required — these are public aggregate stats. ───────────────────── */

export const config = { runtime: "edge" };

import { redisGet, redisSetEx, handleCorsPreflightOrMethod } from "./_shared";
import { COMPLETED_SESSION_MIN_QUESTIONS, parseRawCounts, toPublicStats, type RawPlatformCounts } from "./_platform-stats-helpers";

declare const process: { env: Record<string, string | undefined> };

const SUPABASE_URL        = process.env.SUPABASE_URL              ?? "";
const SERVICE_ROLE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const REDIS_KEY           = "stats:public_counts_v2";
const REDIS_TTL_SEC       = 3_600; // 1 hour
const DB_TIMEOUT_MS       = 5_000;

const NULL_STATS = { userCount: null, sessionCount: null, companyCount: null, jobCount: null };

async function countRows(path: string): Promise<number> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "HEAD",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      Prefer: "count=exact",
    },
    signal: AbortSignal.timeout(DB_TIMEOUT_MS),
  });
  // Supabase returns count in Content-Range: 0-99/523
  const total = res.headers.get("content-range")?.split("/")?.[1];
  const n = total ? parseInt(total, 10) : NaN;
  if (!res.ok || isNaN(n)) throw new Error(`count failed: ${path}`);
  return n;
}

export default async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflightOrMethod(req, { allowGet: true });
  if (preflight) return preflight;

  const respHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    // Allow CDN / browser to cache for 5 min but revalidate after
    "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
  };

  /* 1. Redis cache hit ---------------------------------------------------- */
  const cached = parseRawCounts(await redisGet(REDIS_KEY));
  if (cached) {
    return new Response(JSON.stringify({ ...toPublicStats(cached), _cached: true }), { status: 200, headers: respHeaders });
  }

  /* 2. Cache miss — query Supabase ---------------------------------------- */
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // Local dev without env vars — nulls so the UI uses its fallback
    return new Response(JSON.stringify(NULL_STATS), { status: 200, headers: respHeaders });
  }

  try {
    const [users, sessions, companies, jobs] = await Promise.all([
      countRows("profiles?select=id"),
      countRows(`sessions?select=id&questions=gte.${COMPLETED_SESSION_MIN_QUESTIONS}`),
      countRows("employers?select=id"),
      countRows("employer_requirements?select=id&status=neq.failed"),
    ]);
    const raw: RawPlatformCounts = { users, sessions, companies, jobs };
    // Persist raw counts; display rounding happens at read time
    await redisSetEx(REDIS_KEY, REDIS_TTL_SEC, JSON.stringify(raw));
    return new Response(JSON.stringify(toPublicStats(raw)), { status: 200, headers: respHeaders });
  } catch { /* network / timeout — fall through to nulls */ }

  /* 3. Failed — nulls so the UI keeps its fallback ------------------------- */
  return new Response(JSON.stringify(NULL_STATS), { status: 200, headers: respHeaders });
}
