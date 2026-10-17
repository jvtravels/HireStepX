/* Vercel Cron — credit back paid candidates who can't be reached
 *
 * Runs daily. See _employer-credit-sweep.ts for the rules.
 *
 * Auth: CRON_SECRET in the Authorization header — fail closed when unset. */

export const config = { runtime: "nodejs" };

import { slog, supabaseUrl, supabaseServiceHeaders } from "./_shared";
import { sweepUnreachableCredits } from "./_employer-credit-sweep";
import { recordCronResult } from "./_cron-heartbeat";

declare const process: { env: Record<string, string | undefined> };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (!cronSecret || (req.headers.get("authorization") || "") !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const base = supabaseUrl();
  if (!base) return jsonResponse({ error: "Not configured" }, 503);

  const t0 = Date.now();
  try {
    const summary = await sweepUnreachableCredits({ base, headers: supabaseServiceHeaders() });
    // The sweep throws on read failures; a future per-match `errors` count also blocks the heartbeat.
    const errors = "errors" in summary && typeof summary.errors === "number" ? summary.errors : 0;
    await recordCronResult("cron-credit-no-response", { errors });
    return jsonResponse({ ok: errors === 0, ...summary, duration_ms: Date.now() - t0 }, errors === 0 ? 200 : 500);
  } catch (err) {
    slog.error("credit sweep failed", { code: "credit_sweep_failed", err: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: "Sweep failed" }, 500);
  }
}
