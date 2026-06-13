/* Admin: trigger the analyze-sessions cron immediately.
 *
 * Auth via admin token. Internally proxies to /api/cron/analyze-sessions
 * with CRON_SECRET so the analyzer + digest pipeline runs end-to-end.
 * Avoids logic duplication — same exact code path the nightly cron uses.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { verifyAdminToken as verifyToken } from "./_admin-auth";

const CRON_SECRET = process.env.CRON_SECRET || "";

/**
 * Resolve the absolute URL for /api/cron/analyze-sessions in the same
 * deployment. Vercel sets VERCEL_URL automatically; locally we fall
 * back to the request's host header.
 */
function resolveCronUrl(req: VercelRequest): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "";
  if (explicit) return `${explicit.replace(/\/$/, "")}/api/cron/analyze-sessions`;
  const vercel = process.env.VERCEL_URL || "";
  if (vercel) return `https://${vercel}/api/cron/analyze-sessions`;
  const host = (req.headers["x-forwarded-host"] || req.headers.host) as string | undefined;
  const proto = (req.headers["x-forwarded-proto"] as string | undefined) || "https";
  if (host) return `${proto}://${host}/api/cron/analyze-sessions`;
  return "/api/cron/analyze-sessions";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "x-admin-token, content-type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.status(200).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }
  if (!CRON_SECRET) {
    res.status(503).json({ error: "Server misconfigured (CRON_SECRET missing)" });
    return;
  }
  const token = req.headers["x-admin-token"];
  if (typeof token !== "string" || !verifyToken(token)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // Optional body params: { force_reanalyze: bool, lookback_hours: number }.
  // force_reanalyze=true bypasses the "already has insight" filter and the
  // analyzer-version staleness check — re-runs every session in the window
  // through the current analyzer. Use after deploying analyzer changes
  // when you want yesterday's sessions to surface today's flags.
  const body = (req.body || {}) as { force_reanalyze?: boolean; lookback_hours?: number };
  const params = new URLSearchParams();
  if (body.force_reanalyze) params.set("force_reanalyze", "1");
  if (body.lookback_hours && Number.isFinite(body.lookback_hours)) {
    params.set("lookback_hours", String(Math.min(Math.max(body.lookback_hours, 1), 720)));
  }
  const cronUrl = resolveCronUrl(req) + (params.toString() ? `?${params.toString()}` : "");
  const t0 = Date.now();
  try {
    const upstream = await fetch(cronUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    const text = await upstream.text();
    let parsed: Record<string, unknown> | null = null;
    try { parsed = JSON.parse(text) as Record<string, unknown>; } catch { /* empty */ }
    if (!upstream.ok) {
      res.status(502).json({ error: "Cron pipeline failed", status: upstream.status, body: text.slice(0, 500) });
      return;
    }
    res.status(200).json({
      ok: true,
      duration_ms: Date.now() - t0,
      cron_response: parsed || { raw: text.slice(0, 500) },
    });
  } catch (e) {
    res.status(502).json({ error: "Failed to reach cron handler", details: String((e as Error).message || e).slice(0, 300) });
  }
}
