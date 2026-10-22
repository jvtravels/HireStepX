/* Vercel Edge Function — connectivity heartbeat target.
 *
 * Deliberately dependency-free: no auth, no DB, no third-party calls. The
 * client's connection monitor hits this to learn "can I reach HireStepX at
 * all?", so it must stay cheap and must never depend on a provider being up
 * (unlike /api/health, which returns 503 when any provider degrades). */

export const config = { runtime: "edge" };

export default async function handler(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
