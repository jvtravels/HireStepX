/* Vercel Cron — Erase accounts soft-deleted 7+ days ago.
 * Runs daily. Invoked by Vercel Cron (Authorization: Bearer CRON_SECRET, fails closed).
 * The erasure itself is the shared eraseUserData routine (same one delete-account
 * uses for immediate deletes); accounts whose erasure fails keep their deleted_at
 * and are retried by the next run.
 */

import { verifyCronAuth } from "./_cron-auth";
import { recordCronResult } from "./_cron-heartbeat";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseUrl, slog } from "./_shared";
import { eraseUserData, posthogConfigFromEnv } from "./_erase-user";
import { sendErasureEmail } from "./_erase-user-email";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

const BATCH_SIZE = 25;
const TIME_BUDGET_MS = 45_000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SUPABASE_URL = supabaseUrl();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  // Cutoff: 7 days ago
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const encodedCutoff = encodeURIComponent(cutoff);

  try {
    // Never-attempted accounts first, then the least recently attempted, so accounts whose erasure
    // keeps failing rotate to the back instead of starving the queue. Falls back to deleted_at
    // ordering until migration 0056 adds the column.
    const queueQuery = (order: string) =>
      fetch(
        `${SUPABASE_URL}/rest/v1/profiles?deleted_at=not.is.null&deleted_at=lt.${encodedCutoff}&select=id&order=${order}&limit=${BATCH_SIZE}`,
        { headers, signal: AbortSignal.timeout(10_000) },
      );
    let findRes = await queueQuery("erasure_attempted_at.asc.nullsfirst,deleted_at.asc");
    if (findRes.status === 400) findRes = await queueQuery("deleted_at.asc");
    if (!findRes.ok) {
      console.error(`[cron:cleanup-deleted] CRITICAL: query failed (${findRes.status})`);
      return res.status(500).json({ error: "Failed to query profiles" });
    }
    const rows = (await findRes.json()) as { id: string }[];
    if (rows.length === 0) {
      await recordCronResult("cleanup-deleted-accounts", { errors: 0 });
      return res.status(200).json({ deleted: 0 });
    }

    let deleted = 0;
    let retained = 0;
    let failed = 0;
    let restored = 0;
    const started = Date.now();

    // The batch was read a while ago and each erasure takes seconds: an owner can restore the
    // account in between, and erasing a restored account is unrecoverable.
    const stillScheduled = async (id: string): Promise<boolean> => {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&deleted_at=not.is.null&deleted_at=lt.${encodedCutoff}&select=id`,
        { headers, signal: AbortSignal.timeout(10_000) },
      ).catch(() => null);
      if (!r || !r.ok) return false;
      const found = (await r.json().catch(() => [])) as { id?: string }[];
      return Array.isArray(found) && found.some((row) => row.id === id);
    };
    // Best-effort; the column is optional until migration 0056 is applied.
    const stampAttempt = (id: string) =>
      fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&deleted_at=not.is.null`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ erasure_attempted_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => undefined);

    for (const { id } of rows) {
      if (Date.now() - started > TIME_BUDGET_MS) break; // remaining accounts are picked up tomorrow
      if (!(await stillScheduled(id))) { restored++; continue; }
      await stampAttempt(id);
      try {
        const result = await eraseUserData(
          {
            fetchImpl: fetch,
            supabaseUrl: SUPABASE_URL,
            serviceKey: SUPABASE_SERVICE_ROLE_KEY,
            trigger: "scheduled",
            posthog: posthogConfigFromEnv(process.env),
            notify: (contact) => sendErasureEmail(fetch, { resendApiKey: RESEND_API_KEY, fromEmail: FROM_EMAIL, appUrl: APP_URL }, contact),
            // Counts only; never an id or email.
            log: (msg, fields) => slog.info(msg, fields),
          },
          id,
        );
        if (result.ok) {
          deleted++;
          if (result.retainedFinancialRecords) retained++;
        } else {
          failed++;
          console.error(`[cleanup-deleted-accounts] erasure incomplete, will retry: ${result.failedSteps.join(", ")}`);
        }
      } catch {
        failed++;
        console.error("[cleanup-deleted-accounts] erasure threw, will retry");
      }
    }

    slog.info("cleanup-deleted-accounts: run complete", { erased: deleted, retainedFinancial: retained, failed, skippedRestored: restored });
    // A stuck erasure is a DPDP deadline risk, so any failure keeps the heartbeat stale.
    await recordCronResult("cleanup-deleted-accounts", { errors: failed });
    return res.status(200).json({ deleted, retained, failed });
  } catch (err) {
    console.error("[cleanup-deleted-accounts] Error:", err instanceof Error ? err.message : "unknown");
    return res.status(500).json({ error: "Cleanup failed" });
  }
}
