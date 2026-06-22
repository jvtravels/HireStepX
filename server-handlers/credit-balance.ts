/* GET /api/credit-balance
 *
 * Returns the authenticated user's purchased session-credit balance by reading
 * directly via the service role (bypasses RLS). The supabase-js client-side
 * read via the anon key + user JWT was silently returning 0 in some browser
 * environments because auth.uid() wasn't being resolved correctly in the RLS
 * policy context. Reading server-side with the service role is authoritative.
 *
 * ENV VAR PRECEDENCE:
 *   SUPABASE_URL (server-only, always set in Vercel server env)
 *   falls back to NEXT_PUBLIC_SUPABASE_URL (baked in at build time).
 *
 * BUG FIXED: Previously only checked NEXT_PUBLIC_SUPABASE_URL. If that env var
 * is absent or empty in the Edge runtime (e.g. only the server-only SUPABASE_URL
 * is configured in Vercel), the handler silently returned { balance: 0 } for
 * every user — exactly what we observed. Now prefers SUPABASE_URL.
 *
 * ERROR TRANSPARENCY:
 *   - Missing env vars → 503 (not 200/0) so the client knows to retry
 *   - DB read error   → 502 (not 200/0) so the client knows to retry
 *   - Genuine 0 balance is the ONLY case that returns 200 with balance: 0
 */
export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders } from "./_shared";
import { getSessionCredits } from "./_session-credits";

declare const process: { env: Record<string, string | undefined> };

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "credit-balance",
    ipLimit: 60,
    userLimit: 30,
    maxBytes: 0,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  // Prefer the server-only SUPABASE_URL; fall back to the Next.js public build-time
  // bake so both env var naming conventions work without a re-deploy.
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  // Override headers to include GET in Allow-Methods.
  const getHeaders = { ...headers, ...corsHeaders(req, { allowGet: true }) };

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    // Configuration missing — tell the client so it can show a retry prompt rather
    // than silently treating the user as having 0 credits.
    console.error("[credit-balance] SUPABASE_URL or SERVICE_ROLE_KEY missing from env");
    return new Response(
      JSON.stringify({ balance: null, error: "service_unavailable" }),
      { status: 503, headers: getHeaders },
    );
  }

  const userId = auth.userId ?? "";
  if (!userId) {
    return new Response(
      JSON.stringify({ balance: null, error: "unauthorized" }),
      { status: 401, headers: getHeaders },
    );
  }

  try {
    const balance = await getSessionCredits(SUPABASE_URL, SERVICE_ROLE_KEY, userId);
    return new Response(JSON.stringify({ balance }), { status: 200, headers: getHeaders });
  } catch (err) {
    // DB read failure — do NOT return balance:0 (indistinguishable from no credits).
    // Return 502 so the client knows to retry rather than blocking the user.
    console.error("[credit-balance] getSessionCredits failed:", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ balance: null, error: "read_failed" }),
      { status: 502, headers: getHeaders },
    );
  }
}
