/* Vercel Cron Function — Downgrade expired subscriptions */
/* Runs daily at midnight UTC. Finds subscriptions that have expired and sets tier to 'free'. */
/* This ensures server-side enforcement even if users don't log in (frontend check is client-side only). */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { emailShell, title, para, b, button, dataCard, orderedList } from "./_email-theme";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <onboarding@resend.dev>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  try {
    const now = new Date().toISOString();

    // Find all non-free profiles where subscription_end is in the past
    const expiredRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?subscription_tier=neq.free&subscription_end=lt.${now}&select=id,name,email,subscription_tier,subscription_end`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!expiredRes.ok) {
      console.error(`[cron:reset-expired] CRITICAL: expired-query failed (${expiredRes.status}) — paid users may not be downgraded today`);
      return res.status(500).json({ error: "Failed to query expired subscriptions" });
    }

    const expired = await expiredRes.json();
    if (!Array.isArray(expired) || expired.length === 0) {
      return res.status(200).json({ downgraded: 0, message: "No expired subscriptions" });
    }

    let downgraded = 0;
    let failed = 0;
    let emailsSent = 0;
    let emailsFailed = 0;

    for (const profile of expired) {
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
        console.error(`[cron] Failed to downgrade ${profile.id.slice(0, 8)}...`);
      }
    }

    return res.status(200).json({ downgraded, failed, emailsSent, emailsFailed, total: expired.length });
  } catch (err) {
    console.error("Reset expired subscriptions error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
