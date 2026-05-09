/* Vercel Edge Function — Salary Offer Aggregator
 *
 * Read-side counterpart to /api/salary-offer. Returns p25/p50/p75 band
 * for a (company, role, level) bucket aggregated across all users who
 * opted in via may_share_aggregate=true.
 *
 * Privacy: enforces K_ANON_FLOOR (=5 distinct users) inside
 * aggregateOffers — below that, returns { aggregate: null } regardless
 * of how many rows match. Auth is required so anonymous probing can't
 * map sparse buckets.
 *
 * GET /api/salary-aggregate?company=X&role=Y&level=mid
 *   → { aggregate: OfferAggregate | null, k_anonymity_floor: 5 }
 */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, corsHeaders, withRequestId } from "./_shared";
import {
  fetchLiveAggregate,
  parseAggregateQuery,
  K_ANON_FLOOR,
} from "./_salary-aggregator-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: withRequestId(corsHeaders(req)),
    });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Not configured" }), {
      status: 503,
      headers: withRequestId(corsHeaders(req)),
    });
  }

  const pre = await withAuthAndRateLimit(req, {
    endpoint: "salary-aggregate",
    ipLimit: 30,
    userLimit: 60,
    checkQuota: false,
    maxBytes: 0,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { headers } = pre;

  const parsed = parseAggregateQuery(new URL(req.url));
  if (!parsed.ok) {
    return new Response(JSON.stringify({ error: parsed.error }), { status: 400, headers });
  }

  const aggregate = await fetchLiveAggregate(
    { company: parsed.company, role: parsed.role, level: parsed.level },
    { supabaseUrl: SUPABASE_URL, serviceKey: SUPABASE_SERVICE_KEY },
  );
  return new Response(
    JSON.stringify({ aggregate, k_anonymity_floor: K_ANON_FLOOR }),
    { status: 200, headers },
  );
}
