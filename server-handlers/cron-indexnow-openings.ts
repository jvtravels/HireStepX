/* Vercel Cron: daily IndexNow ping for the live public roles, so Bing and friends
 * pick up a newly listed role within a day. Closed or expired roles drop out of the
 * sitemap on their own. Auth: CRON_SECRET bearer, same gate as every cron. */

export const config = { runtime: "edge" };

import { verifyCronAuth } from "./_cron-auth";
import { fetchLiveOpenings } from "./_public-openings-fetch";
import { pingIndexNow } from "./_indexnow";

export default async function handler(req: Request): Promise<Response> {
  if (!verifyCronAuth(req)) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } });
  const openings = await fetchLiveOpenings();
  const paths = openings.length ? ["/openings", ...openings.map((o) => `/openings/${o.slug}`)] : [];
  try {
    const r = await pingIndexNow(paths);
    return new Response(JSON.stringify(r), { status: r.ok ? 200 : 502, headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "ping failed" }), { status: 502, headers: { "Content-Type": "application/json" } });
  }
}
