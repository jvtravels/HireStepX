/* Vercel Cron Function — Send subscription renewal reminder emails */
/* Runs daily at 9 AM UTC. Sends reminders to users whose subscription expires within 3 days. */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { escapeHtml } from "./_shared";
import { emailShell, title, para, b, button, dataCard } from "./_email-theme";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const CRON_SECRET = (process.env.CRON_SECRET || "").trim();
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Protect cron endpoint — fail closed: require CRON_SECRET to be set
  if (!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  try {
    // Fire exactly ONE reminder per expiry. The daily cron previously used a
    // 3-day-wide window (gte now, lte now+3d), so a subscription expiring in 3
    // days matched on day-3, day-2 AND day-1 — three emails (and three Resend
    // charges) for one renewal. A half-open 24h band [now+2d, now+3d) is
    // exactly one cron-interval wide, so each expiry lands in it on a single
    // run. The Idempotency-Key below is belt-and-suspenders for cron retries.
    const now = new Date();
    const twoDaysLater = new Date(now);
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);
    const threeDaysLater = new Date(now);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?subscription_tier=neq.free&subscription_end=gte.${twoDaysLater.toISOString()}&subscription_end=lt.${threeDaysLater.toISOString()}&select=id,name,email,subscription_tier,subscription_end&limit=200`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        // 10s timeout — without this, an unresponsive Supabase hangs the cron
        // until Vercel's function timeout (60s+), wasting the run window.
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!profilesRes.ok) {
      console.error(`[cron:renewal-reminders] CRITICAL: profile query failed (${profilesRes.status})`);
      return res.status(500).json({ error: "Failed to query profiles" });
    }

    const profiles = await profilesRes.json();
    if (!Array.isArray(profiles) || profiles.length === 0) {
      return res.status(200).json({ sent: 0, message: "No expiring subscriptions" });
    }

    let sent = 0;
    let failed = 0;
    for (const profile of profiles) {
      if (!profile.email) continue;

      const endDate = new Date(profile.subscription_end);
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86400000);
      const tier = profile.subscription_tier;
      const renewUrl = `${APP_URL}/dashboard?plan=weekly`;

      const emailBody = JSON.stringify({
        from: FROM_EMAIL,
        to: [profile.email],
        subject: `Your ${tier} plan expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
        html: emailShell({
          preview: "Renew to keep unlimited practice without a gap.",
          body:
            title(`${daysLeft} day${daysLeft !== 1 ? "s" : ""}`, { accentWord: "left." }) +
            para(`Hi ${escapeHtml(profile.name || "there")}, your HireStepX ${b(tier)} plan expires on ${b(endDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }))}. Renew before then to keep unlimited sessions, AI coaching and analytics running without a break.`) +
            dataCard("Current plan", [
              ["Plan", tier],
              ["Expires", endDate.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })],
              ["Days left", String(daysLeft)],
            ]) +
            button("Renew now", renewUrl) +
            para(`Not renewing? You'll move to the free plan automatically, your history and reports stay exactly where they are.`, { small: true, muted: true }),
        }),
      });

      const sendEmail = async (): Promise<boolean> => {
        const emailAc = new AbortController();
        const emailTimer = setTimeout(() => emailAc.abort(), 10_000);
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
            // Stable per (user, expiry-date): the in-handler retry below and any
            // cron re-run within 24h dedupe to a single Resend charge.
            "Idempotency-Key": `renewal-reminder-${profile.id}-${endDate.toISOString().slice(0, 10)}`,
          },
          signal: emailAc.signal,
          body: emailBody,
        });
        clearTimeout(emailTimer);
        return emailRes.ok;
      };

      try {
        let ok = await sendEmail();
        // Single retry after 1s on failure
        if (!ok) {
          await new Promise((r) => setTimeout(r, 1000));
          ok = await sendEmail();
        }
        if (ok) {
          sent++;
        } else {
          failed++;
          console.error(`Resend API error for ${profile.email} after retry`);
        }
      } catch (err) {
        failed++;
        console.error(`Failed to send reminder to ${profile.email}:`, err);
      }
    }

    return res.status(200).json({ sent, failed, total: profiles.length });
  } catch (err) {
    console.error("Renewal reminder error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
