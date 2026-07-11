/* Vercel Cron Function — Google Calendar fallback poll + watch renewal (PRI-35)
 *
 * Runs daily. Push channels (watch) are the primary change signal, but they
 * expire (Google caps them at ~7 days) and a dropped notification would
 * otherwise go unnoticed. This cron is the safety net: for every connected
 * user it runs an incremental sync (cheap when nothing changed, thanks to the
 * stored syncToken) and re-registers any channel that is missing or within a
 * day of expiry.
 *
 * Inert until configured: returns early if the Google client env is unset.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { googleConfigured } from "./_google-calendar";
import { runIncrementalSync, ensureWatchChannel, type SyncRow } from "./_google-sync-runner";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

const RENEW_WINDOW_MS = 86_400_000; // re-register a channel within 1 day of expiry

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Require CRON_SECRET unconditionally. x-vercel-cron is NOT stripped by Vercel
  // on inbound external requests — any caller can spoof it, so it provides no auth.
  const hasSecret = CRON_SECRET && req.headers.authorization === `Bearer ${CRON_SECRET}`;
  if (!hasSecret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (!googleConfigured({ GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET })) {
    return res.status(200).json({ skipped: "google not configured" });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  try {
    const rowsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/google_calendar_sync?select=*&limit=1000`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }, signal: AbortSignal.timeout(10_000) },
    );
    if (!rowsRes.ok) {
      console.error(`[cron:google-poll] sync row query failed (${rowsRes.status})`);
      return res.status(500).json({ error: "Failed to query connections" });
    }
    const rows: SyncRow[] = await rowsRes.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(200).json({ synced: 0, message: "No connected calendars" });
    }

    const webhookUrl = `${APP_URL}/api/calendar/google/webhook`;
    const nowMs = Date.now();
    let synced = 0;
    let renewed = 0;
    let reconnectNeeded = 0;

    for (const row of rows) {
      try {
        const result = await runIncrementalSync(row);
        if (result.ok) synced++;
        else if (result.reconnect) reconnectNeeded++;

        const expMs = row.channel_expiry ? Date.parse(row.channel_expiry) : NaN;
        const needsChannel = !row.channel_id || Number.isNaN(expMs) || expMs - nowMs < RENEW_WINDOW_MS;
        if (result.ok && needsChannel) {
          await ensureWatchChannel(row, webhookUrl);
          renewed++;
        }
      } catch (e) {
        console.error(`[cron:google-poll] error for ${row.user_id}:`, e);
      }
    }

    return res.status(200).json({ connections: rows.length, synced, renewed, reconnectNeeded });
  } catch (err) {
    console.error("[cron:google-poll] fatal:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
