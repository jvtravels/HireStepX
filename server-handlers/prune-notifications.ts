/* Vercel Cron — Prune old notifications rows.
 *
 * The notifications table has no TTL: every streak milestone, new-message,
 * profile-view, etc. inserts a row that nothing ever deletes. Reads are
 * capped at 50 (notifications-list.ts) so the feed itself never looked
 * broken, but the table grows unbounded per user forever. Mirrors
 * prune-llm-usage.ts's pattern: hard-delete rows older than
 * NOTIFICATIONS_RETENTION_DAYS (default 90) on a daily cron. Idempotent and
 * safe to re-run.
 *
 * Authenticated via Authorization: Bearer CRON_SECRET only (fails closed).
 */

import { verifyCronAuth } from "./_cron-auth";
import { recordCronResult } from "./_cron-heartbeat";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseUrl } from "./_shared";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RETENTION_DAYS = Math.max(14, parseInt(process.env.NOTIFICATIONS_RETENTION_DAYS || "90", 10) || 90);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SUPABASE_URL = supabaseUrl();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const encodedCutoff = encodeURIComponent(cutoff);

  try {
    const delRes = await fetch(
      `${SUPABASE_URL}/rest/v1/notifications?created_at=lt.${encodedCutoff}`,
      {
        method: "DELETE",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "count=exact",
        },
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!delRes.ok) {
      const detail = await delRes.text().catch(() => "");
      console.error(`[cron:prune-notifications] CRITICAL: delete failed (${delRes.status})`, detail.slice(0, 200));
      return res.status(500).json({ error: "Prune failed", status: delRes.status });
    }

    const range = delRes.headers.get("content-range") || "";
    const pruned = parseInt(range.split("/")[1] || "0", 10) || 0;
    console.log(`[cron:prune-notifications] pruned ${pruned} rows older than ${RETENTION_DAYS}d (< ${cutoff})`);
    await recordCronResult("prune-notifications", { errors: 0 });
    return res.status(200).json({ pruned, retentionDays: RETENTION_DAYS, cutoff });
  } catch (err) {
    console.error("[cron:prune-notifications] threw:", err);
    return res.status(500).json({ error: "Prune threw" });
  }
}
