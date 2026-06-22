/* ── Platform Stats ─────────────────────────────────────────────────────────
 * Public edge endpoint: returns the total count of completed interview
 * sessions. Used by the UpgradeModal as live social proof.
 *
 * Flow:
 *   1. Redis hit  → return cached count (TTL 1 h, set on last DB read)
 *   2. Redis miss → HEAD /rest/v1/sessions with Prefer: count=exact
 *                   (service-role key, reads content-range response header)
 *   3. Any failure → return { sessionCount: null } so the UI falls back
 *      to its hardcoded "500+" string — never shows a broken widget.
 *
 * No auth required — this is a public aggregate stat. ────────────────────── */

export const config = { runtime: "edge" };

import { redisGet, redisSetEx, handleCorsPreflightOrMethod } from "./_shared";

declare const process: { env: Record<string, string | undefined> };

const SUPABASE_URL        = process.env.SUPABASE_URL              ?? "";
const SERVICE_ROLE_KEY    = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const REDIS_KEY           = "stats:session_count";
const REDIS_TTL_SEC       = 3_600; // 1 hour
const DB_TIMEOUT_MS       = 5_000;

/** Floor to nearest 10. Never returns < 10 (avoids "0+", "3+" embarrassment). */
function floorDisplay(n: number): number {
  return Math.max(10, Math.floor(n / 10) * 10);
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
  const cached = await redisGet(REDIS_KEY);
  if (cached !== null) {
    const count = parseInt(cached, 10);
    if (!isNaN(count)) {
      return new Response(
        JSON.stringify({ sessionCount: floorDisplay(count), _cached: true }),
        { status: 200, headers: respHeaders },
      );
    }
  }

  /* 2. Cache miss — query Supabase ---------------------------------------- */
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // Local dev without env vars — return null so UI uses fallback text
    return new Response(JSON.stringify({ sessionCount: null }), { status: 200, headers: respHeaders });
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sessions?select=id`, {
      method: "HEAD",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        Prefer: "count=exact",
      },
      signal: AbortSignal.timeout(DB_TIMEOUT_MS),
    });

    // Supabase returns count in Content-Range: 0-99/523
    const range = res.headers.get("content-range");
    const total = range?.split("/")?.[1];
    const count = total ? parseInt(total, 10) : NaN;

    if (!isNaN(count)) {
      // Persist raw count to cache; display rounding happens at read time
      await redisSetEx(REDIS_KEY, REDIS_TTL_SEC, String(count));
      return new Response(
        JSON.stringify({ sessionCount: floorDisplay(count) }),
        { status: 200, headers: respHeaders },
      );
    }
  } catch { /* network / timeout — fall through to null */ }

  /* 3. Both paths failed — return null so UI keeps its fallback ------------ */
  return new Response(JSON.stringify({ sessionCount: null }), { status: 200, headers: respHeaders });
}
