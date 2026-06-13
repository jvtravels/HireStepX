/* Vercel Serverless Function — Reactivate Subscription (undo cancel-at-period-end) */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  applyCorsHeaders,
  handlePreflightAndMethod,
  supabaseUrl,
  supabaseAnonKey,
  escapeHtml,
} from "./_shared";
import { captureServerEvent } from "./_posthog";
import { emailShell, title, para, button, dataCard } from "./_email-theme";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <onboarding@resend.dev>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = applyCorsHeaders(req, res);
  if (handlePreflightAndMethod(req, res)) return;

  const bodyLen = parseInt((req.headers["content-length"] as string) || "0", 10);
  if (bodyLen > 1048576) return res.status(413).json({ error: "Request too large" });
  if (!origin) return res.status(403).json({ error: "Forbidden" });

  const SUPABASE_URL = supabaseUrl();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Not configured" });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SUPABASE_ANON_KEY = supabaseAnonKey();
  const token = authHeader.slice(7);
  let userId: string;
  try {
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!userRes.ok) return res.status(401).json({ error: "Invalid auth token" });
    const userData = await userRes.json();
    userId = userData.id;
  } catch {
    return res.status(401).json({ error: "Auth verification failed" });
  }

  try {
    const dbHeaders = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };

    // Fetch profile to get razorpay_subscription_id
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=razorpay_subscription_id,subscription_end,cancel_at_period_end,email,name,subscription_tier`,
      { headers: dbHeaders },
    );
    const profiles = await profileRes.json();
    const profile = Array.isArray(profiles) && profiles[0];

    if (!profile?.cancel_at_period_end) {
      return res.status(400).json({ error: "Subscription is not pending cancellation" });
    }

    // Check subscription hasn't already expired
    if (profile.subscription_end && new Date(profile.subscription_end) < new Date()) {
      return res.status(400).json({ error: "Subscription has already expired. Please purchase a new plan." });
    }

    const subscriptionId = profile?.razorpay_subscription_id;

    // Re-activate on Razorpay if we have a subscription ID
    if (subscriptionId && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
      const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
      try {
        // Razorpay: resume a cancelled subscription by creating a new one with same plan
        // For subscriptions cancelled with cancel_at_cycle_end, we check status first
        const statusRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
          headers: { Authorization: `Basic ${auth}` },
        });
        if (statusRes.ok) {
          const subData = await statusRes.json();
          // If subscription is still active (cancel_at_cycle_end was used), it can be resumed
          if (subData.status === "active") {
            // Razorpay doesn't have a direct "un-cancel" API for cancel_at_cycle_end.
            // The subscription will continue normally — we just clear our DB flag.
            console.warn(`[reactivate] Razorpay subscription ${subscriptionId} is still active, clearing cancel flag`);
          } else if (subData.status === "cancelled" || subData.status === "completed") {
            console.warn(`[reactivate] Razorpay subscription ${subscriptionId} is ${subData.status} — user will need to re-subscribe at next period end`);
          }
        }
      } catch (err) {
        console.warn("[reactivate] Razorpay API check failed (continuing with DB update):", err);
      }
    }

    // Clear the cancel flag in DB
    const updateRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`,
      {
        method: "PATCH",
        headers: { ...dbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ cancel_at_period_end: false }),
      },
    );

    if (!updateRes.ok) {
      return res.status(500).json({ error: "Failed to reactivate subscription" });
    }

    // Send reactivation confirmation email (best-effort)
    if (RESEND_API_KEY && profile?.email) {
      const nextBilling = profile.subscription_end
        ? new Date(profile.subscription_end).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
        : "your next billing date";
      const safeName = escapeHtml(profile.name || "there");
      const tier = profile.subscription_tier || "paid";
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [profile.email],
            subject: "Your subscription is reactivated",
            html: emailShell({
              preview: "Everything's restored and running again.",
              body:
                title("Good to have you", { accentWord: "back." }) +
                para(`Hi ${safeName}, your HireStepX ${tier} plan is active again. Everything you had is right where you left it, and your sessions are open again.`) +
                dataCard(
                  "You're all set",
                  [
                    ["Plan", tier.charAt(0).toUpperCase() + tier.slice(1)],
                    ["Next billing date", nextBilling],
                  ],
                  { tone: "success" },
                ) +
                button("Pick up where you left off", `${APP_URL}/dashboard`) +
                para(`Your subscription renews automatically. Manage it anytime from your dashboard settings.`, { small: true, muted: true }),
            }),
          }),
        });
      } catch (emailErr) {
        console.warn("[reactivate] Confirmation email failed (non-critical):", emailErr);
      }
    }

    await captureServerEvent("subscription_reactivated", userId, {
      tier: profile?.subscription_tier || "unknown",
      next_billing: profile?.subscription_end || null,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Reactivate subscription error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
