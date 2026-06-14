/* Vercel Cron — Prune raw llm_usage rows older than the retention window.
 *
 * llm_usage gets 50–300 inserts per active user per day (one row per LLM call).
 * Left unbounded it becomes the single biggest driver of Supabase row/storage
 * cost. We only need the recent window for live cost dashboards and abuse
 * triage; longer-term trends live in PostHog. So we hard-delete rows older than
 * LLM_USAGE_RETENTION_DAYS (default 30) on a daily cron. Idempotent and safe to
 * re-run — a no-op once the tail is trimmed.
 *
 * Authenticated via Vercel Cron (x-vercel-cron) or Authorization: Bearer CRON_SECRET.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseUrl } from "./_shared";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";
const RETENTION_DAYS = Math.max(7, parseInt(process.env.LLM_USAGE_RETENTION_DAYS || "30", 10) || 30);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization || "";
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  const hasValidSecret = CRON_SECRET && authHeader === `Bearer ${CRON_SECRET}`;
  if (!isVercelCron && !hasValidSecret) {
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
      `${SUPABASE_URL}/rest/v1/llm_usage?created_at=lt.${encodedCutoff}`,
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
      console.error(`[cron:prune-llm-usage] CRITICAL: delete failed (${delRes.status})`, detail.slice(0, 200));
      return res.status(500).json({ error: "Prune failed", status: delRes.status });
    }

    // PostgREST returns the affected-row count in Content-Range (e.g. "*/123").
    const range = delRes.headers.get("content-range") || "";
    const pruned = parseInt(range.split("/")[1] || "0", 10) || 0;
    console.log(`[cron:prune-llm-usage] pruned ${pruned} rows older than ${RETENTION_DAYS}d (< ${cutoff})`);
    return res.status(200).json({ pruned, retentionDays: RETENTION_DAYS, cutoff });
  } catch (err) {
    console.error("[cron:prune-llm-usage] threw:", err);
    return res.status(500).json({ error: "Prune threw" });
  }
}
