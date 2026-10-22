/* Vercel Edge Function — Product satisfaction rating
 *
 * Records a candidate's 1-5 star rating of HireStepX itself, prompted
 * once per session on the report screen. One row per (user, session);
 * resubmitting upserts. Mirrors credibility-dispute.ts in shape — same
 * auth preamble, same REST upsert pattern, same fire-and-forget contract
 * on persist failure. Schema lives in `product_ratings`
 * (supabase-schema.sql). This is the only write path backing the
 * schema.org aggregateRating on /pricing (see
 * _product-rating-helpers.ts, read at render time via service role).
 *
 * POST /api/product-rating
 *   { sessionId, rating }   rating: integer 1-5
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import { isValidRating } from "./_product-rating-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

interface RatingBody {
  sessionId?: unknown;
  rating?: unknown;
}

function asString(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
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

  /* Per-user limit ~6 — a candidate rates at most once per session and
     won't plausibly finish more than a handful of sessions in the rate
     window. IP limit guards against scripted noise inflating the public
     aggregate. */
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "product-rating",
    ipLimit: 30,
    userLimit: 12,
    maxBytes: 2_000,
    checkQuota: false,
  });
  if (pre instanceof Response) return pre;
  const { headers, auth } = pre;

  if (!auth.userId || typeof auth.userId !== "string") {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }

  let body: RatingBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers });
  }

  const sessionId = asString(body.sessionId, 64);
  const rating = body.rating;

  if (!sessionId || !isValidRating(rating)) {
    return new Response(JSON.stringify({
      error: "Required: sessionId, rating (integer 1-5)",
    }), { status: 400, headers });
  }

  try {
    const url = `${SUPABASE_URL}/rest/v1/product_ratings?on_conflict=user_id,session_id`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        user_id: auth.userId,
        session_id: sessionId,
        rating,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[product-rating] supabase error: HTTP ${res.status}: ${errText.slice(0, 200)}`);
      /* Soft-fail like credibility-dispute — this is a fire-and-forget
         action client-side; returning 500 would surface a scary toast
         for a low-stakes rating widget. */
      return new Response(JSON.stringify({ ok: false, persisted: false }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ ok: true, persisted: true }), { status: 200, headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[product-rating] threw: ${msg.slice(0, 200)}`);
    return new Response(JSON.stringify({ ok: false, persisted: false, error: msg }), { status: 200, headers });
  }
}
