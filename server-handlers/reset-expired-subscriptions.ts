/* Vercel Cron Function — Downgrade expired subscriptions */
/* Runs daily at midnight UTC. Finds subscriptions that have expired and sets tier to 'free'. */
/* This ensures server-side enforcement even if users don't log in (frontend check is client-side only). */

import { verifyCronAuth } from "./_cron-auth";
import { recordCronResult } from "./_cron-heartbeat";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { mapPool, timeBudget } from "./_batch";
import { emailShell, title, para, b, button, dataCard, orderedList } from "./_email-theme";
import { captureServerEvent } from "./_posthog";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

const PAGE_SIZE = 200;
const MAX_PAGES = 25;
const CONCURRENCY = 4;
const RUN_BUDGET_MS = 45_000;

interface ExpiredProfile { id: string; name: string | null; email: string | null; subscription_tier: string; subscription_end: string }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyCronAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  try {
    const now = new Date().toISOString();

    // Downgraded users leave this result set, so re-querying the first page walks the backlog.
    const fetchExpiredPage = async (): Promise<{ ok: true; rows: ExpiredProfile[] } | { ok: false; status: number }> => {
      const expiredRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?subscription_tier=neq.free&subscription_end=lt.${now}&select=id,name,email,subscription_tier,subscription_end&order=id&limit=${PAGE_SIZE}`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      ).catch(() => null);
      if (!expiredRes || !expiredRes.ok) return { ok: false, status: expiredRes?.status ?? -1 };
      const json = await expiredRes.json();
      return { ok: true, rows: Array.isArray(json) ? json : [] };
    };

    const firstPage = await fetchExpiredPage();
    if (!firstPage.ok) {
      console.error(`[cron:reset-expired] CRITICAL: expired-query failed (${firstPage.status}) — paid users may not be downgraded today`);
      void captureServerEvent("cron_reset_expired_failed", undefined, { step: "query", status: firstPage.status });
      return res.status(500).json({ error: "Failed to query expired subscriptions" });
    }
    if (firstPage.rows.length === 0) {
      await recordCronResult("reset-expired-subscriptions", { errors: 0 });
      return res.status(200).json({ downgraded: 0, message: "No expired subscriptions" });
    }

    let downgraded = 0;
    let failed = 0;
    let emailsSent = 0;
    let emailsFailed = 0;
    const failedIds = new Set<string>();

    const processProfile = async (profile: ExpiredProfile) => {
      const updateRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(profile.id)}`,
        {
          method: "PATCH",
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({ subscription_tier: "free" }),
        },
      );

      if (updateRes.ok) {
        downgraded++;
        console.warn(`[cron] Downgraded ${profile.id.slice(0, 8)}... from ${profile.subscription_tier} (expired ${profile.subscription_end})`);

        // Send expiration notification email (non-blocking per user)
        if (RESEND_API_KEY && profile.email) {
          const renewUrl = `${APP_URL}/dashboard?tab=settings`;
          const safeName = escapeHtml(profile.name || "there");
          const safeTier = escapeHtml(profile.subscription_tier);
          const emailHtml = emailShell({
            preview: "You're on the free plan now. Your history is safe.",
            body:
              title("Your plan", { accentWord: "has ended." }) +
              para(`Hi ${safeName}, your HireStepX ${b(safeTier)} subscription has ended and your account has moved to the free plan. Nothing is lost, your session history and saved data are exactly where you left them.`) +
              dataCard("Still on the free plan", [
                ["AI mock interviews", "3 included"],
                ["Question types", "Behavioural"],
                ["Your data", "Fully preserved"],
              ]) +
              para(`Renew anytime to unlock unlimited sessions, every question type and full AI coaching:`) +
              orderedList([
                "Open your dashboard settings",
                "Pick the plan that fits",
                "Pick up right where you left off",
              ]) +
              button("Renew subscription", renewUrl) +
              para(`Questions about your billing? Just reply to this email and we'll help.`, { small: true, muted: true }),
          });

          try {
            const emailAc = new AbortController();
            const emailTimer = setTimeout(() => emailAc.abort(), 10_000);
            const emailRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              signal: emailAc.signal,
              body: JSON.stringify({
                from: FROM_EMAIL,
                to: [profile.email],
                subject: "Your HireStepX subscription has expired",
                html: emailHtml,
              }),
            });
            clearTimeout(emailTimer);

            if (emailRes.ok) {
              emailsSent++;
            } else {
              emailsFailed++;
              console.error(`[cron] Expiration email failed for ${profile.id.slice(0, 8)}...`);
            }
          } catch (emailErr) {
            emailsFailed++;
            console.error(`[cron] Expiration email error for ${profile.id.slice(0, 8)}...:`, emailErr);
          }
        }
      } else {
        failed++;
        failedIds.add(profile.id);
        console.error(`[cron] Failed to downgrade ${profile.id.slice(0, 8)}...`);
      }
    };

    const budget = timeBudget(RUN_BUDGET_MS);
    let total = 0;
    let truncated = false;
    let page: ExpiredProfile[] = firstPage.rows;
    for (let i = 0; i < MAX_PAGES; i++) {
      total += page.length;
      await mapPool(page, CONCURRENCY, processProfile);
      if (page.length < PAGE_SIZE) break;
      if (budget.expired() || i === MAX_PAGES - 1) { truncated = true; break; }
      const next = await fetchExpiredPage();
      if (!next.ok) { truncated = true; break; }
      // Only users that failed to downgrade can reappear; stop rather than spin on them.
      page = next.rows.filter(r => !failedIds.has(r.id));
      if (page.length === 0) break;
    }

    if (truncated) console.error(`[cron:reset-expired] WARNING: stopped early (downgraded=${downgraded}); remaining expired users are handled next run`);
    if (failed > 0) {
      void captureServerEvent("cron_reset_expired_failed", undefined, { step: "downgrade", failed, downgraded, total });
    }
    await recordCronResult("reset-expired-subscriptions", { errors: failed });
    return res.status(200).json({ downgraded, failed, emailsSent, emailsFailed, total, truncated });
  } catch (err) {
    console.error("Reset expired subscriptions error:", err);
    void captureServerEvent("cron_reset_expired_failed", undefined, { step: "unhandled_exception" });
    return res.status(500).json({ error: "Internal error" });
  }
}
