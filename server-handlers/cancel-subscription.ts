/* Vercel Serverless Function — Cancel Subscription */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withNodeAuthAndRateLimit, supabaseUrl } from "./_shared";
import { captureServerEvent } from "./_posthog";
import { razorpayBasicAuth } from "./_razorpay-auth";
import {
  parseSubscriptionProfile,
  formatSubscriptionEndDate,
  buildCancellationEmailHtml,
} from "./_cancel-subscription-helpers";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Request-ID", crypto.randomUUID());

  const pre = await withNodeAuthAndRateLimit(req, res, { endpoint: "cancel-subscription", ipLimit: 5 });
  if (pre.handled) return;
  const { userId } = pre;

  const SUPABASE_URL = supabaseUrl();
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  try {
    // Fetch profile to get subscription ID, email, name, and end date
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=razorpay_subscription_id,email,name,subscription_end,subscription_tier`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
    );
    const profiles = await profileRes.json();
    const profile = parseSubscriptionProfile(profiles);
    const subscriptionId = profile?.razorpay_subscription_id;

    // Cancel Razorpay subscription at cycle end (if active)
    if (subscriptionId && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      const auth = razorpayBasicAuth(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET);
      try {
        const cancelRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`, {
          method: "POST",
          headers: { "Authorization": `Basic ${auth}`, "Content-Type": "application/json" },
          body: JSON.stringify({ cancel_at_cycle_end: true }),
        });
        if (!cancelRes.ok) {
          console.warn(`[cancel] Razorpay cancel returned ${cancelRes.status} — DB will still be updated but subscription may auto-renew`);
        }
      } catch (err) {
        console.warn("[cancel] Razorpay API cancel failed (continuing with DB update):", err);
      }
    }

    // Mark subscription to cancel at period end (user keeps benefits until expiry)
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: {
          apikey: SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({
          cancel_at_period_end: true,
        }),
      },
    );

    if (!updateRes.ok) {
      return res.status(500).json({ error: "Failed to cancel subscription" });
    }

    // Send cancellation confirmation email (best-effort)
    if (RESEND_API_KEY && profile?.email) {
      const endDateText = formatSubscriptionEndDate(profile.subscription_end);
      const html = buildCancellationEmailHtml({
        userName: profile.name,
        tier: profile.subscription_tier,
        endDateText,
        appUrl: APP_URL,
      });
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [profile.email],
            subject: "Subscription cancellation confirmed",
            html,
          }),
        });
      } catch (emailErr) {
        console.warn("[cancel] Confirmation email failed (non-critical):", emailErr);
      }
    }

    await captureServerEvent("subscription_cancelled", userId, {
      tier: profile?.subscription_tier || "unknown",
      access_until: profile?.subscription_end || null,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Cancel subscription error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
