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
  aggregateOffers,
  parseAggregateQuery,
  K_ANON_FLOOR,
  type OfferAggregateInput,
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

  /* Filter on the server with the service role so RLS doesn't silently
   * narrow to the calling user's own rows. We still respect the
   * may_share_aggregate=true bit here — only opted-in offers feed
   * the aggregate. K-anonymity is enforced inside aggregateOffers. */
  const params = new URLSearchParams({
    select: "user_id,total_ctc_lpa,base_lpa,variable_lpa,joining_bonus_lpa",
    company: `eq.${parsed.company}`,
    role: `eq.${parsed.role}`,
    level: `eq.${parsed.level}`,
    may_share_aggregate: "eq.true",
    limit: "5000",
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/salary_offers?${params}`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    return new Response(JSON.stringify({ aggregate: null, k_anonymity_floor: K_ANON_FLOOR }), {
      status: 200,
      headers,
    });
  }
  const rows = (await res.json()) as OfferAggregateInput[];
  const aggregate = aggregateOffers(rows);
  return new Response(
    JSON.stringify({ aggregate, k_anonymity_floor: K_ANON_FLOOR }),
    { status: 200, headers },
  );
}
