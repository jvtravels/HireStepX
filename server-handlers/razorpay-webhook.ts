/* Vercel Serverless Function — Razorpay Webhook Handler */
/* Receives payment.captured events from Razorpay and activates subscriptions server-side. */
/* This is a safety net: if the client's verify-payment call fails after payment, the webhook */
/* ensures the subscription is still activated. */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "crypto";
import { escapeHtml } from "./_shared";
import { captureServerEvent } from "./_posthog";
import { emailShell, title, para, b, button, dataCard } from "./_email-theme";


const RAZORPAY_WEBHOOK_SECRET = (process.env.RAZORPAY_WEBHOOK_SECRET || "").trim();
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <onboarding@resend.dev>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");

const PLAN_DURATION: Record<string, number> = { weekly: 7, monthly: 30, "yearly-starter": 365, "yearly-pro": 365 };
const PLAN_TIER: Record<string, string> = { weekly: "starter", monthly: "pro", "yearly-starter": "starter", "yearly-pro": "pro" };
const PLAN_AMOUNT: Record<string, number> = { weekly: 4900, monthly: 14900, "yearly-starter": 203900, "yearly-pro": 143000 };

const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

// In-memory event dedup — fallback when Redis is unavailable
const _processedEvents = new Set<string>();
const DEDUP_MAX = 500;
function markProcessedInMemory(eventId: string): boolean {
  if (_processedEvents.has(eventId)) return false; // already processed
  if (_processedEvents.size >= DEDUP_MAX) _processedEvents.clear();
  _processedEvents.add(eventId);
  return true; // first time
}

/** Check Redis-backed dedup (24h TTL). Returns "new" | "duplicate" | "redis_unavailable". */
async function checkDedup(dedupKey: string): Promise<"new" | "duplicate" | "redis_unavailable"> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return "redis_unavailable";
  try {
    const setRes = await fetch(
      `${UPSTASH_URL}/SET/${encodeURIComponent(`webhook:${dedupKey}`)}/1/NX/EX/86400`,
      { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } },
    );
    if (!setRes.ok) return "redis_unavailable";
    const setData = await setRes.json();
    // SET NX returns null when key already existed (duplicate)
    return setData.result === null ? "duplicate" : "new";
  } catch (err) {
    console.warn("[webhook] Redis dedup check failed, falling back to in-memory:", err);
    return "redis_unavailable";
  }
}

// Vercel config: disable body parsing so we can access raw body for signature verification
export const config = { api: { bodyParser: false } };

function getRawBody(req: VercelRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Global timeout — ensure we respond before Vercel's 10s limit
  const globalTimeout = setTimeout(() => {
    if (res.headersSent) return;
    console.error("[webhook] Global timeout reached (8s)");
    res.status(504).json({ error: "Processing timeout" });
  }, 8000);

  // Webhooks are POST only, no CORS needed (server-to-server)
  if (req.method !== "POST") { clearTimeout(globalTimeout); return res.status(405).json({ error: "Method not allowed" }); }

  if (!RAZORPAY_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    clearTimeout(globalTimeout);
    return res.status(503).json({ error: "Webhook not configured" });
  }

  // Verify Razorpay webhook signature using raw body (preserves original key order)
  const signature = req.headers["x-razorpay-signature"] as string;
  if (!signature) {
    clearTimeout(globalTimeout);
    return res.status(400).json({ error: "Missing signature" });
  }

  let rawBody: string;
  try {
    // If bodyParser is disabled, read raw stream; otherwise fall back to stringified body
    rawBody = typeof req.body === "string" ? req.body
      : req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)
        ? JSON.stringify(req.body) // fallback if bodyParser wasn't actually disabled
        : await getRawBody(req);
  } catch (bodyErr) {
    clearTimeout(globalTimeout);
    console.error("[webhook] Failed to read body:", bodyErr);
    return res.status(400).json({ error: "Invalid body" });
  }

  if (rawBody.length > 1048576) {
    clearTimeout(globalTimeout);
    return res.status(413).json({ error: "Body too large" });
  }

  const expectedSignature = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");

  // Use timing-safe comparison to prevent timing attacks on signature verification
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    clearTimeout(globalTimeout);
    console.error("[webhook] Signature mismatch");
    return res.status(400).json({ error: "Invalid signature" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Razorpay webhook payload is dynamic external data
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    clearTimeout(globalTimeout);
    return res.status(400).json({ error: "Invalid JSON" });
  }
  const eventType = event?.event;
  const eventId = event?.entity?.id || event?.payload?.payment?.entity?.id || event?.payload?.subscription?.entity?.id || "";
  const dedupKey = `${eventType}:${eventId}`;
  if (dedupKey.length > 5) {
    const dedupResult = await checkDedup(dedupKey);
    if (dedupResult === "duplicate") {
      clearTimeout(globalTimeout);
      return res.status(200).json({ received: true, skipped: "duplicate" });
    }
    if (dedupResult === "redis_unavailable") {
      // Fall back to in-memory dedup (better than nothing on cold starts)
      if (!markProcessedInMemory(dedupKey)) {
        clearTimeout(globalTimeout);
        return res.status(200).json({ received: true, skipped: "duplicate" });
      }
    }
  }

  const HANDLED_EVENTS = [
    "payment.captured",
    "subscription.activated",
    "subscription.charged",
    "subscription.halted",
    "subscription.cancelled",
    "subscription.completed",
    "subscription.paused",
    "subscription.resumed",
  ];

  if (!HANDLED_EVENTS.includes(eventType)) {
    return res.status(200).json({ received: true, skipped: eventType });
  }

  try {
    // ─── Subscription lifecycle events ───
    if (eventType.startsWith("subscription.")) {
      const subscription = event?.payload?.subscription?.entity;
      if (!subscription) return res.status(400).json({ error: "Missing subscription entity" });

      const subscriptionId = subscription.id;
      if (typeof subscriptionId !== "string" || !/^sub_[A-Za-z0-9]+$/.test(subscriptionId)) {
        console.error("[webhook] Invalid subscription ID format:", subscriptionId);
        return res.status(400).json({ error: "Invalid subscription ID format" });
      }
      const notes = subscription.notes || {};
      const plan = notes.plan;
      const userId = notes.userId;

      if (!userId) {
        console.error("[webhook] Missing userId in subscription notes:", { subscriptionId });
        return res.status(200).json({ received: true, skipped: "missing_userId" });
      }

      const dbHeaders = { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` };

      if (eventType === "subscription.activated") {
        // First activation — save subscription ID and activate tier
        const tier = PLAN_TIER[plan] || "starter";
        const now = new Date();
        const end = new Date(now);
        end.setDate(end.getDate() + (PLAN_DURATION[plan] || 30));

        const activateRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { ...dbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            subscription_tier: tier,
            subscription_start: now.toISOString(),
            subscription_end: end.toISOString(),
            razorpay_subscription_id: subscriptionId,
            cancel_at_period_end: false,
          }),
        });

        if (!activateRes.ok) {
          console.error("[webhook] subscription.activated profile update failed:", activateRes.status);
          return res.status(500).json({ error: "Profile update failed" });
        }

        console.warn(`[webhook] subscription.activated: ${tier} for user ${userId.slice(0, 8)}`);
        return res.status(200).json({ received: true, activated: true, tier });
      }

      if (eventType === "subscription.charged") {
        // Recurring payment succeeded — extend subscription
        const payment = event?.payload?.payment?.entity;
        const paymentId = payment?.id;

        if (paymentId) {
          // Idempotency check
          const dupCheck = await fetch(
            `${SUPABASE_URL}/rest/v1/payments?razorpay_payment_id=eq.${encodeURIComponent(paymentId)}&select=id`,
            { headers: dbHeaders },
          );
          const dupRows = await dupCheck.json();
          if (Array.isArray(dupRows) && dupRows.length > 0) {
            return res.status(200).json({ received: true, already_processed: true });
          }
        }

        const tier = PLAN_TIER[plan] || "starter";
        const now = new Date();
        // Extend from current end if still active
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=subscription_end,email,name`,
          { headers: dbHeaders },
        );
        const profileRows = await profileRes.json();
        const currentEnd = Array.isArray(profileRows) && profileRows[0]?.subscription_end ? new Date(profileRows[0].subscription_end) : null;
        const base = currentEnd && currentEnd > now ? currentEnd : now;
        const end = new Date(base);
        end.setDate(end.getDate() + (PLAN_DURATION[plan] || 30));

        const renewRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { ...dbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            subscription_tier: tier,
            subscription_start: now.toISOString(),
            subscription_end: end.toISOString(),
            razorpay_payment_id: paymentId || undefined,
            cancel_at_period_end: false,
          }),
        });

        if (!renewRes.ok) {
          console.error("[webhook] subscription.charged profile update failed:", renewRes.status);
          return res.status(500).json({ error: "Profile update failed" });
        }

        // Log payment record
        if (paymentId) {
          await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
            method: "POST",
            headers: { ...dbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({
              id: crypto.randomUUID(),
              user_id: userId,
              razorpay_payment_id: paymentId,
              razorpay_order_id: payment?.order_id || "",
              plan: plan || "monthly",
              tier,
              amount: payment?.amount || PLAN_AMOUNT[plan] || 14900,
              currency: "INR",
              status: "completed",
              subscription_start: now.toISOString(),
              subscription_end: end.toISOString(),
            }),
          }).catch(err => console.error("[webhook] Payment record insert failed:", err));
        }

        // Send renewal confirmation email (best-effort)
        const profileEmail = Array.isArray(profileRows) && profileRows[0]?.email;
        const profileName = Array.isArray(profileRows) && profileRows[0]?.name;
        if (RESEND_API_KEY && profileEmail) {
          const safeName = escapeHtml(profileName || "there");
          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: FROM_EMAIL,
                to: [profileEmail],
                subject: `${tier} plan renewed`,
                html: emailShell({
                  preview: `Auto-renewed and active until ${end.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`,
                  body:
                    title("Renewed,", { accentWord: "nothing to do." }) +
                    para(`Hi ${safeName}, your HireStepX ${b(tier)} plan auto-renewed and is active until ${b(end.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }))}. Keep practising, your unlimited sessions roll right on.`) +
                    button("Continue practising", `${APP_URL}/dashboard`),
                }),
              }),
            });
          } catch (emailErr) { console.error("[webhook] Renewal email failed:", emailErr); }
        }

        await captureServerEvent("subscription_renewed", userId, {
          tier,
          subscription_end: end.toISOString(),
          source: "razorpay_webhook",
        });

        console.warn(`[webhook] subscription.charged: renewed ${tier} for user ${userId.slice(0, 8)}`);
        return res.status(200).json({ received: true, renewed: true, tier });
      }

      if (eventType === "subscription.halted") {
        // Payment failed after all retries — downgrade to free
        // Fetch profile first to get email, name, and previous tier for the notification
        const profileRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=email,name,subscription_tier`,
          { headers: dbHeaders },
        );
        const profileRows = await profileRes.json();
        const profileEmail = Array.isArray(profileRows) && profileRows[0]?.email;
        const profileName = Array.isArray(profileRows) && profileRows[0]?.name;
        const previousTier: string = (Array.isArray(profileRows) && profileRows[0]?.subscription_tier) || "starter";

        const haltRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { ...dbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            subscription_tier: "free",
            razorpay_subscription_id: null,
          }),
        });

        if (!haltRes.ok) {
          console.error("[webhook] subscription.halted profile update failed:", haltRes.status);
          return res.status(500).json({ error: "Profile update failed" });
        }

        // Send payment-failed notification email (best-effort, non-blocking)
        if (RESEND_API_KEY && profileEmail) {
          const safeName = escapeHtml(profileName || "there");
          const lostRows: [string, string][] = previousTier === "pro"
            ? [
                ["Unlimited sessions", "Removed"],
                ["Full AI coaching feedback", "Removed"],
                ["Performance analytics", "Removed"],
                ["Priority support", "Removed"],
              ]
            : [
                ["10 sessions per week", "Removed"],
                ["All question types", "Removed"],
                ["Detailed feedback", "Removed"],
                ["Resume analysis", "Removed"],
              ];

          try {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: FROM_EMAIL,
                to: [profileEmail],
                subject: "Payment failed, your plan is paused",
                html: emailShell({
                  preview: "Update your payment method to restore your plan.",
                  body:
                    title("We couldn't", { accentWord: "renew." }) +
                    para(`Hi ${safeName}, your recent payment attempt was unsuccessful, so your subscription has been moved to the ${b("free tier")} for now. Your previous ${b(previousTier)} plan benefits have been paused. Your data and history are safe.`) +
                    dataCard("Features paused", lostRows, { tone: "error" }) +
                    button("Update payment method", `${APP_URL}/dashboard?tab=settings`) +
                    para(
                      `We'll restore everything as soon as your payment goes through. If you believe this is an error, contact us at ${`<a href="mailto:support@hirestepx.com" style="color:#312E81;text-decoration:none;border-bottom:1px solid #312E81;">support@hirestepx.com</a>`}.`,
                      { small: true, muted: true },
                    ),
                }),
              }),
            });
          } catch (emailErr) { console.error("[webhook] Payment-failed email failed:", emailErr); }
        }

        await captureServerEvent("payment_failed", userId, {
          previous_tier: previousTier,
          downgraded_to: "free",
          source: "razorpay_webhook",
        });

        console.warn(`[webhook] subscription.halted: downgraded user ${userId.slice(0, 8)} to free`);
        return res.status(200).json({ received: true, downgraded: true });
      }

      if (eventType === "subscription.cancelled" || eventType === "subscription.completed") {
        // User cancelled or all charges completed — mark cancel_at_period_end
        const cancelRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { ...dbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            cancel_at_period_end: true,
            razorpay_subscription_id: null,
          }),
        });

        if (!cancelRes.ok) {
          console.error(`[webhook] ${eventType} profile update failed:`, cancelRes.status);
          return res.status(500).json({ error: "Profile update failed" });
        }

        console.warn(`[webhook] ${eventType}: user ${userId.slice(0, 8)} subscription ending at period end`);
        return res.status(200).json({ received: true, cancelled: true });
      }

      if (eventType === "subscription.paused" || eventType === "subscription.resumed") {
        const paused = eventType === "subscription.paused";
        const pauseRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { ...dbHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ subscription_paused: paused }),
        });

        if (!pauseRes.ok) {
          console.error(`[webhook] ${eventType} profile update failed:`, pauseRes.status);
          return res.status(500).json({ error: "Profile update failed" });
        }

        console.warn(`[webhook] ${eventType}: user ${userId.slice(0, 8)} subscription ${paused ? "paused" : "resumed"}`);
        return res.status(200).json({ received: true, paused });
      }

      return res.status(200).json({ received: true });
    }

    // ─── One-time payment.captured (backward compatibility) ───
    const payment = event?.payload?.payment?.entity;
    if (!payment) {
      return res.status(400).json({ error: "Missing payment entity" });
    }

    const paymentId = payment.id;
    if (typeof paymentId !== "string" || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
      console.error("[webhook] Invalid payment ID format:", paymentId);
      return res.status(400).json({ error: "Invalid payment ID format" });
    }
    const orderId = payment.order_id;
    const amount = payment.amount;
    const notes = payment.notes || {};
    const plan = notes.plan;
    const userId = notes.userId;

    if (!plan || !userId || !PLAN_TIER[plan]) {
      console.error("[webhook] Missing plan or userId in notes:", { plan, userId: userId?.slice(0, 8) });
      return res.status(200).json({ received: true, skipped: "missing_notes" });
    }

    if (amount !== PLAN_AMOUNT[plan]) {
      console.error("[webhook] Amount mismatch:", { amount, expected: PLAN_AMOUNT[plan] });
      return res.status(200).json({ received: true, skipped: "amount_mismatch" });
    }

    // Idempotency check
    const dupCheck = await fetch(
      `${SUPABASE_URL}/rest/v1/payments?razorpay_payment_id=eq.${encodeURIComponent(paymentId)}&select=id`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
    );
    const dupRows = await dupCheck.json();
    if (Array.isArray(dupRows) && dupRows.length > 0) {
      return res.status(200).json({ received: true, already_processed: true });
    }

    const now = new Date();
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=subscription_end`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
    );
    const profileRows = await profileRes.json();
    const currentEnd = Array.isArray(profileRows) && profileRows[0]?.subscription_end ? new Date(profileRows[0].subscription_end) : null;
    const base = currentEnd && currentEnd > now ? currentEnd : now;
    const end = new Date(base);
    end.setDate(end.getDate() + PLAN_DURATION[plan]);
    const tier = PLAN_TIER[plan];

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
          subscription_tier: tier,
          subscription_start: now.toISOString(),
          subscription_end: end.toISOString(),
          razorpay_payment_id: paymentId,
        }),
      },
    );

    if (!updateRes.ok) {
      console.error("[webhook] Profile update failed:", updateRes.status);
      return res.status(500).json({ error: "Profile update failed" });
    }

    await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        user_id: userId,
        razorpay_payment_id: paymentId,
        razorpay_order_id: orderId,
        plan,
        tier,
        amount,
        currency: "INR",
        status: "completed",
        subscription_start: now.toISOString(),
        subscription_end: end.toISOString(),
      }),
    }).catch(err => console.error("[webhook] Payment record insert failed:", err));

    if (RESEND_API_KEY && notes.email) {
      const safeName = escapeHtml(notes.userName || "there");
      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: FROM_EMAIL,
            to: [notes.email],
            subject: `${tier} plan activated`,
            html: emailShell({
              preview: `Your ${tier} plan is live until ${end.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.`,
              body:
                title(`${tier} is`, { accentWord: "live." }) +
                para(`Hi ${safeName}, your HireStepX ${b(tier)} plan is now active until ${b(end.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }))}. We'll renew it automatically so your practice never pauses.`) +
                button("Start practising", `${APP_URL}/dashboard`),
            }),
          }),
        });
      } catch (emailErr) { console.error("[webhook] Payment email failed:", emailErr); }
    }

    console.warn(`[webhook] Activated ${tier} for user ${userId.slice(0, 8)}...`);
    return res.status(200).json({ received: true, activated: true, tier });
  } catch (err) {
    console.error("[webhook] Error:", err);
    return res.status(500).json({ error: "Internal error" });
  } finally {
    clearTimeout(globalTimeout);
  }
}
