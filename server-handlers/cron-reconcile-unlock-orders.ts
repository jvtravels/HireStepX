/* Vercel Cron — Reconcile employer contact-unlock orders
 *
 * Backstop for the Razorpay webhook + browser verify call: fulfils orders that
 * were paid but never unlocked, retries orders left 'paid' by a failed
 * fulfilment, and expires 'created' orders that were never paid within 24h.
 * See _employer-unlock-reconcile.ts for the sweep.
 *
 * Auth: CRON_SECRET in the Authorization header — fail closed when unset
 * (same rule as send-renewal-reminders.ts).
 */

export const config = { runtime: "nodejs" };

import { slog, supabaseUrl, supabaseServiceHeaders } from "./_shared";
import { reconcileUnlockOrders } from "./_employer-unlock-reconcile";

declare const process: { env: Record<string, string | undefined> };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export default async function handler(req: Request): Promise<Response> {
  const cronSecret = (process.env.CRON_SECRET || "").trim();
  if (!cronSecret || (req.headers.get("authorization") || "") !== `Bearer ${cronSecret}`) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const keyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
  const base = supabaseUrl();
  if (!base || !keyId || !keySecret) return jsonResponse({ error: "Not configured" }, 503);

  const t0 = Date.now();
  try {
    const summary = await reconcileUnlockOrders({
      supabaseUrl: base,
      headers: supabaseServiceHeaders(),
      razorpayKeyId: keyId,
      razorpayKeySecret: keySecret,
    });
    if (summary.errors > 0) slog.warn("unlock reconcile finished with errors", { code: "unlock_reconcile_errors", ...summary });
    return jsonResponse({ ok: true, ...summary, duration_ms: Date.now() - t0 });
  } catch (err) {
    slog.error("unlock reconcile failed", { code: "unlock_reconcile_failed", err: err instanceof Error ? err.message : String(err) });
    return jsonResponse({ error: "Reconcile failed" }, 500);
  }
}
