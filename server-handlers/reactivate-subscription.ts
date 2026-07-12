/* Vercel Serverless Function — Reactivate Subscription (undo cancel-at-period-end) */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  applyCorsHeaders,
  handlePreflightAndMethod,
  supabaseUrl,
  supabaseAnonKey,
  escapeHtml,
  isRateLimited,
  getClientIp,
  rateLimitResponse,
} from "./_shared";
import { captureServerEvent } from "./_posthog";
import { emailShell, title, para, button, dataCard } from "./_email-theme";

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <noreply@hirestepx.com>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = applyCorsHeaders(req, res);
  if (handlePreflightAndMethod(req, res)) return;

  const bodyLen = parseInt((req.headers["content-length"] as string) || "0", 10);
  if (bodyLen > 1048576) return res.status(413).json({ error: "Request too large" });
  if (!origin) return res.status(403).json({ error: "Forbidden" });

  // Rate limit: 5 reactivation attempts per IP per minute
  const clientIp = getClientIp(req as unknown as Request);
  const corsHeaders = { "Access-Control-Allow-Origin": origin };
  if (await isRateLimited(clientIp, "reactivate-subscription", 5, 60)) {
    return rateLimitResponse(corsHeaders);
  }

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
        // Step 1: fetch current subscription status from Razorpay
        const statusRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
          headers: { Authorization: `Basic ${auth}` },
        });

        if (!statusRes.ok) {
          const errText = await statusRes.text().catch(() => "");
          console.warn(`[reactivate] Razorpay GET subscription failed (${statusRes.status}): ${errText}`);
          // Non-blocking — still clear the DB flag so the user is unblocked.
        } else {
          const subData = await statusRes.json();

          if (subData.status === "active") {
            // Subscription is still active (cancel_at_cycle_end = 1 was set).
            // Call PATCH with cancel_at_cycle_end: 0 to remove the scheduled cancellation,
            // so Razorpay will auto-renew at period end as normal.
            const patchRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
              method: "PATCH",
              headers: {
                Authorization: `Basic ${auth}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ cancel_at_cycle_end: 0 }),
            });

            if (patchRes.ok) {
              console.info(`[reactivate] Razorpay subscription ${subscriptionId} un-cancelled successfully`);
            } else {
              // PATCH failed — Razorpay may not support this for the current plan type,
              // or the subscription is in a non-patchable state. We still clear the DB
              // flag (the subscription is active until period end either way), but log
              // the failure so we can investigate whether Option B is needed.
              const patchErr = await patchRes.text().catch(() => "");
              console.warn(
                `[reactivate] Razorpay PATCH cancel_at_cycle_end=0 failed (${patchRes.status}): ${patchErr}. ` +
                `Subscription will still cancel at period end — consider notifying the user.`
              );
            }
          } else if (subData.status === "cancelled" || subData.status === "completed") {
            // Subscription is already terminated on Razorpay's side — reactivation is not
            // possible. Return 400 so the client shows the correct message instead of
            // misleading the user with "Reactivated" when auto-renewal will never resume.
            console.warn(
              `[reactivate] Razorpay subscription ${subscriptionId} is already '${subData.status}'. ` +
              `Rejecting reactivation — user must purchase a new plan.`
            );
            return res.status(400).json({
              error: "Your subscription has already ended on the payment provider's side. Please purchase a new plan to continue.",
              code: "subscription_terminated",
            });
          } else {
            // Unexpected status (e.g. 'halted', 'pending') — log and continue.
            console.warn(`[reactivate] Razorpay subscription ${subscriptionId} has unexpected status '${subData.status}' — clearing DB flag only.`);
          }
        }
      } catch (err) {
        // Network error or JSON parse failure — non-blocking. DB flag still clears
        // so the user sees the reactivation succeed on our side. The next Razorpay
        // webhook will reconcile the real state.
        console.warn("[reactivate] Razorpay API call failed (continuing with DB update):", err);
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
