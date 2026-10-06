/* Vercel Serverless Function — Razorpay Subscription Creation */
/* Creates a recurring subscription instead of a one-time order for auto-renewal */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { withNodeAuthAndRateLimit } from "./_shared";

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();
const RAZORPAY_PLAN_WEEKLY = (process.env.RAZORPAY_PLAN_WEEKLY || "").trim();

const PLAN_MAP: Record<string, { planId: string; name: string; description: string; amount: number }> = {
  weekly:  { planId: RAZORPAY_PLAN_WEEKLY,  name: "HireStepX Sprint Pack", description: "Sprint Pack — ₹39/month · 5 sessions · Auto-renews monthly", amount: 3900 },
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pre = await withNodeAuthAndRateLimit(req, res, { endpoint: "create-sub", ipLimit: 5 });
  if (pre.handled) return;
  const { userId: authenticatedUserId } = pre;

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(503).json({ error: "Payments not configured. Please contact support@hirestepx.com" });
  }

  try {
    const { plan, email } = req.body;
    if (typeof plan !== "string" || plan !== "weekly") {
      return res.status(400).json({ error: "Invalid plan" });
    }
    const planConfig = PLAN_MAP[plan];
    if (!planConfig || !planConfig.planId) {
      console.error(`[create-subscription] Missing Razorpay plan ID for "${plan}". Set RAZORPAY_PLAN_WEEKLY env var.`);
      return res.status(503).json({ error: "Subscription plans not configured. Please contact support@hirestepx.com" });
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
    // Never fall back to a client-supplied userId — if auth passed, we have
    // authenticatedUserId; if it didn't, we must reject, not trust the body.
    if (!authenticatedUserId) {
      return res.status(401).json({ error: "Authentication required" });
    }
    const resolvedUserId = authenticatedUserId;

    const ac = new AbortController();
    const acTimer = setTimeout(() => ac.abort(), 10_000);

    const subscriptionPayload: Record<string, unknown> = {
      plan_id: planConfig.planId,
      total_count: 12, // 12 billing cycles = 1 year (monthly for Sprint Pack, monthly for Pro)
      customer_notify: 1,
      notes: {
        plan,
        ...(resolvedUserId ? { userId: resolvedUserId } : {}),
        ...(typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? { email } : {}),
      },
    };

    const response = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      signal: ac.signal,
      body: JSON.stringify(subscriptionPayload),
    });
    clearTimeout(acTimer);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Razorpay subscription error:", response.status, errText);
      return res.status(502).json({ error: "Could not create subscription. Please try again or contact support@hirestepx.com" });
    }

    const subscription = await response.json();

    return res.status(200).json({
      subscriptionId: subscription.id,
      amount: planConfig.amount,
      currency: "INR",
      keyId: RAZORPAY_KEY_ID,
      name: planConfig.name,
      description: planConfig.description,
      status: subscription.status,
    });
  } catch (err) {
    console.error("Subscription creation error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
