/* Vercel Serverless Function — Razorpay Payment Verification */
/* Server-side signature verification + Supabase subscription update */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac } from "crypto";
import {
  applyCorsHeaders,
  handlePreflightAndMethod,
  isRateLimited,
  getVercelClientIp,
  escapeHtml,
  supabaseUrl,
  supabaseAnonKey,
} from "./_shared";
import { grantSessionCredits } from "./_session-credits";
import {
  PLAN_TIER,
  PLAN_AMOUNT,
  PLAN_LABEL,
  TIER_RANK,
  buildSignaturePayload,
  verifyRazorpaySignature,
  computeSubscriptionEnd,
} from "./_payment-verification";

/** Fetch with AbortController timeout (default 8s) */
function fetchWithTimeout(url: string, opts: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = 8000, ...fetchOpts } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  return fetch(url, { ...fetchOpts, signal: controller.signal }).finally(() => clearTimeout(timer));
}

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();
// Razorpay plan IDs — used to validate that the subscription_id returned by the
// client actually belongs to the plan they claim. An attacker could otherwise
// submit a weekly subscription_id with plan:"monthly" and get Pro for free.
const RAZORPAY_PLAN_WEEKLY  = (process.env.RAZORPAY_PLAN_WEEKLY  || "").trim();
const RAZORPAY_PLAN_MONTHLY = (process.env.RAZORPAY_PLAN_MONTHLY || "").trim();
// Map internal plan keys → Razorpay plan IDs for cross-validation
const RAZORPAY_PLAN_ID_MAP: Record<string, string> = Object.fromEntries(
  Object.entries({ weekly: RAZORPAY_PLAN_WEEKLY, monthly: RAZORPAY_PLAN_MONTHLY })
    .filter(([, v]) => v !== ""),
);
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const RESEND_API_KEY = (process.env.RESEND_API_KEY || "").trim();
const FROM_EMAIL = process.env.FROM_EMAIL || "HireStepX <onboarding@resend.dev>";
const APP_URL = (process.env.APP_URL || "https://hirestepx.vercel.app").replace(/\/$/, "");
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
// PAYMENT_ID_HASH_SECRET — used to HMAC-hash payment IDs before sending to analytics.
// Must be set in Vercel env vars. If absent, hashPaymentId() returns "" and we skip
// analytics hashing rather than shipping a known weak key in source (C-2 fix).
const PAYMENT_ID_HASH_SECRET = (process.env.PAYMENT_ID_HASH_SECRET || "").trim();

import { captureServerEvent } from "./_posthog";
import { emailShell, title, para, b, button, dataCard, mono } from "./_email-theme";

/** Hash a Razorpay payment id before sending it to analytics. The full id
 * is a financial identifier (DPDP-sensitive) — we never want it to leave
 * our infrastructure in plaintext. SHA-256 + first 12 chars is enough to
 * correlate events without being reversible. */
function hashPaymentId(id: unknown): string {
  if (typeof id !== "string" || !id) return "";
  // Skip hashing if the secret is not configured — return "" so the event
  // is fired without a payment_id field rather than using a known weak key.
  if (!PAYMENT_ID_HASH_SECRET) return "";
  return createHmac("sha256", PAYMENT_ID_HASH_SECRET).update(id).digest("hex").slice(0, 12);
}

/** Clear the payment-abandonment intent key so the cron doesn't email a paying user. */
async function clearPaymentIntent(orderId: string): Promise<void> {
  if (!UPSTASH_URL || !UPSTASH_TOKEN || !orderId) return;
  try {
    await fetch(`${UPSTASH_URL}/DEL/${encodeURIComponent(`pay_intent:${orderId}`)}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
  } catch { /* best effort */ }
}

// Plan catalog, signature check, and end-date math live in
// _payment-verification.ts so the money path is tested against real code.
// "single" stays on the free tier — it grants session credits, not a tier.

async function sendPaymentEmail(
  email: string,
  name: string,
  plan: string,
  tier: string,
  paymentId: string,
  startDate: string,
  endDate: string,
  amountOverride?: string,
) {
  if (!RESEND_API_KEY) return;
  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    console.error("Invalid email format, skipping payment email");
    return;
  }
  const planLabel = PLAN_LABEL[plan] || tier;
  const start = new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const end = new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const amountMap: Record<string, string> = { single: "₹9", weekly: "₹39", monthly: "₹149" };
  const amount = amountOverride ?? amountMap[plan] ?? "₹49";

  try {
    const emailAc = new AbortController();
    const emailTimer = setTimeout(() => emailAc.abort(), 10_000);
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
        // Resend dedupes identical sends within 24h by this key, so a retry
        // or a webhook race can never bill us for two confirmation emails.
        "Idempotency-Key": `payment-confirmation-${paymentId}`,
      },
      signal: emailAc.signal,
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [email],
        subject: `${amount} received, ${planLabel} is live`,
        html: emailShell({
          preview: `${planLabel} starts now. Valid until ${end}.`,
          body:
            title("You're", { accentWord: "in." }) +
            para(`Hi ${escapeHtml(name || "there")}, your payment went through and ${b(planLabel)} is active. ${tier === "pro" ? "Unlimited interview sessions, full AI coaching feedback, salary negotiation mode and performance analytics, all unlocked." : plan === "single" ? "Your session credit is ready — head to your dashboard to start your mock interview." : "7 interview sessions per week, all question types, detailed feedback, and resume analysis, all unlocked."}`) +
            dataCard("Receipt", [
              ["Plan", planLabel],
              ["Amount paid", mono(amount)],
              ["Valid from", start],
              ["Valid until", end],
              ["Payment ID", mono(paymentId)],
            ]) +
            button("Start practising", `${APP_URL}/dashboard`) +
            para(
              `This is your payment confirmation. If you didn't make this purchase, contact us immediately.`,
              { small: true, muted: true },
            ),
        }),
      }),
    });
    clearTimeout(emailTimer);
    if (!emailRes.ok) {
      const errBody = await emailRes.text().catch(() => "");
      console.error("Resend API error:", emailRes.status, errBody);
      logPaymentResendUsage("error", `HTTP ${emailRes.status}`);
      throw new Error(`Resend error ${emailRes.status}: ${errBody}`);
    }
    logPaymentResendUsage("success");
  } catch (err) {
    // Non-blocking — don't fail the payment if email fails
    console.error("Failed to send payment email:", err);
    logPaymentResendUsage("error", err instanceof Error ? err.message : "Unknown");
    throw err; // re-throw so Promise.allSettled captures it
  }
}

/** Fire-and-forget: log Resend email usage for payment emails */
function logPaymentResendUsage(status: "success" | "error", errorMessage?: string): void {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return;
  fetch(`${url}/rest/v1/service_usage`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}`, Prefer: "return=minimal" },
    body: JSON.stringify({ service: "resend_email", endpoint: "payment-confirmation", status, error_message: errorMessage?.slice(0, 500) || null }),
  }).catch(() => {});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = applyCorsHeaders(req, res);
  if (handlePreflightAndMethod(req, res)) return;

  // Body size check
  const bodyContentLength = parseInt((req.headers["content-length"] as string) || "0", 10);
  if (bodyContentLength > 1048576) {
    return res.status(413).json({ error: "Request too large" });
  }

  // CSRF: validate Origin header on state-changing requests
  if (!origin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const SUPABASE_URL = supabaseUrl();
  if (!RAZORPAY_KEY_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Payment verification not configured" });
  }

  // Rate limiting
  const ip = getVercelClientIp(req);
  if (await isRateLimited(ip, "verify-payment", 10, 60_000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please try again shortly.", retryAfter: 60 });
  }

  // Verify user auth
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const SUPABASE_ANON_KEY = supabaseAnonKey();
  const token = authHeader.slice(7);
  let userId: string;
  let userEmail = "";
  let userName = "";
  try {
    const authAc = new AbortController();
    const authTimer = setTimeout(() => authAc.abort(), 5000);
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
      signal: authAc.signal,
    });
    clearTimeout(authTimer);
    if (!userRes.ok) return res.status(401).json({ error: "Invalid auth token" });
    const userData = await userRes.json();
    userId = userData.id;
    userEmail = userData.email || "";
    userName = userData.user_metadata?.name || userData.user_metadata?.full_name || "";
  } catch (authErr) {
    if (authErr instanceof DOMException && authErr.name === "AbortError") {
      return res.status(504).json({ error: "Auth verification timed out" });
    }
    return res.status(401).json({ error: "Auth verification failed" });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, razorpay_subscription_id, plan } = req.body;

    if (!razorpay_payment_id || !razorpay_signature || !plan) {
      return res.status(400).json({ error: "Missing payment details", code: "MISSING_FIELDS" });
    }

    // For subscriptions, order_id may not be present — subscription_id is used instead
    if (!razorpay_order_id && !razorpay_subscription_id) {
      return res.status(400).json({ error: "Missing order or subscription ID", code: "MISSING_IDENTIFIER" });
    }

    // Validate format of Razorpay IDs (prevent injection)
    const razorpayIdPattern = /^[a-zA-Z0-9_]{6,50}$/;
    if (
      !razorpayIdPattern.test(razorpay_payment_id)
      || (razorpay_order_id && !razorpayIdPattern.test(razorpay_order_id))
      || (razorpay_subscription_id && !razorpayIdPattern.test(razorpay_subscription_id))
      || typeof razorpay_signature !== "string" || razorpay_signature.length > 128
    ) {
      return res.status(400).json({ error: "Invalid payment details format", code: "INVALID_FORMAT" });
    }

    if (typeof plan !== "string" || !PLAN_TIER[plan]) {
      return res.status(400).json({ error: "Invalid plan", code: "INVALID_PLAN" });
    }

    // 1. Verify Razorpay signature (HMAC-SHA256)
    // Subscriptions sign: subscription_id|payment_id; orders sign: order_id|payment_id
    const signPayload = buildSignaturePayload({
      orderId: razorpay_order_id,
      subscriptionId: razorpay_subscription_id,
      paymentId: razorpay_payment_id,
    });
    if (!verifyRazorpaySignature(signPayload, razorpay_signature, RAZORPAY_KEY_SECRET)) {
      console.error("Payment signature mismatch for", (razorpay_order_id || razorpay_subscription_id || "").slice(0, 8) + "...");
      return res.status(400).json({ error: "Payment signature verification failed", code: "SIGNATURE_MISMATCH" });
    }

    // 1b. Atomic idempotency lock — Razorpay can deliver retries for the same
    // payment_id (slow client, network blip, double-tap). The downstream DB
    // checks at lines 366/386 are read-then-write and race under concurrent
    // calls. SET NX EX 86400 means: first caller claims the lock for 24h,
    // duplicates return 200 immediately. Falls open if Redis is unavailable
    // (rare, monitored), so the legacy DB checks still serve as a safety net.
    if (UPSTASH_URL && UPSTASH_TOKEN) {
      try {
        const lockRes = await fetch(
          `${UPSTASH_URL}/SET/${encodeURIComponent(`pay_dedup:${razorpay_payment_id}`)}/1/NX/EX/86400`,
          { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } },
        );
        if (lockRes.ok) {
          const lockData = await lockRes.json();
          if (lockData.result === null) {
            console.warn(`[verify-payment] duplicate call for payment ${razorpay_payment_id.slice(0, 12)} — already processed`);
            // Return profile snapshot so the client can render the upgraded
            // state instead of a bare idempotent flag.
            try {
              const [snapRes, creditsRes] = await Promise.all([
                fetchWithTimeout(
                  `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=subscription_tier,subscription_start,subscription_end`,
                  { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
                ),
                fetchWithTimeout(
                  `${SUPABASE_URL}/rest/v1/session_credits?user_id=eq.${encodeURIComponent(userId)}&select=balance`,
                  { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
                ),
              ]);
              const rows = await snapRes.json();
              const snap = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
              const creditRows = await creditsRes.json();
              const credits = Array.isArray(creditRows) && creditRows.length > 0 ? (creditRows[0].balance ?? 0) : 0;
              return res.status(200).json({
                success: true,
                idempotent: true,
                credits,
                subscriptionTier: snap?.subscription_tier ?? null,
                subscriptionStart: snap?.subscription_start ?? null,
                subscriptionEnd: snap?.subscription_end ?? null,
              });
            } catch {
              return res.status(200).json({ success: true, idempotent: true });
            }
          }
        }
      } catch (lockErr) {
        console.warn("[verify-payment] dedup lock check failed, continuing:", lockErr instanceof Error ? lockErr.message : lockErr);
      }
    }

    // 2. Verify plan matches the actual order/subscription amount with Razorpay
    const rzpAuth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
    const rzpAc = new AbortController();
    const rzpTimer = setTimeout(() => rzpAc.abort(), 8000);
    let sessionQuantity = 1; // For single session multi-buy
    let promoCodeUsed = "";   // Set from the order's server-written notes.promo
    let promoDiscount = 0;    // Paise discount the order was actually created with
    try {
    if (razorpay_order_id) {
      const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
        headers: { Authorization: `Basic ${rzpAuth}` }, signal: rzpAc.signal,
      });
      if (!orderRes.ok) {
        return res.status(400).json({ error: "Could not verify order details", code: "ORDER_FETCH_FAILED" });
      }
      const orderData = await orderRes.json();
      // For single session purchases, quantity may multiply the base amount
      if (plan === "single" && orderData.notes?.quantity) {
        sessionQuantity = Math.min(Math.max(parseInt(orderData.notes.quantity, 10) || 1, 1), 10);
      }
      // create-order writes notes.promo + notes.discount server-side when a
      // valid code was applied. We recompute the expected amount FROM those
      // notes (not from any client input) so the discounted charge verifies,
      // and remember the code to consume exactly one use after activation.
      if (orderData.notes?.promo && orderData.notes?.discount) {
        const d = parseInt(orderData.notes.discount, 10);
        if (Number.isFinite(d) && d > 0) {
          promoDiscount = d;
          promoCodeUsed = String(orderData.notes.promo);
        }
      }
      const baseAmount = plan === "single" ? PLAN_AMOUNT[plan] * sessionQuantity : PLAN_AMOUNT[plan];
      const expectedAmount = Math.max(0, baseAmount - promoDiscount);
      if (orderData.amount !== expectedAmount) {
        console.error("Plan/amount mismatch for order", razorpay_order_id.slice(0, 8) + "...");
        return res.status(400).json({ error: "Plan does not match payment amount", code: "AMOUNT_MISMATCH" });
      }
    } else if (razorpay_subscription_id) {
      // For subscriptions, verify the subscription exists and is active
      const subRes = await fetch(`https://api.razorpay.com/v1/subscriptions/${razorpay_subscription_id}`, {
        headers: { Authorization: `Basic ${rzpAuth}` }, signal: rzpAc.signal,
      });
      if (!subRes.ok) {
        return res.status(400).json({ error: "Could not verify subscription details", code: "SUBSCRIPTION_FETCH_FAILED" });
      }
      const subData = await subRes.json();
      if (!["active", "authenticated", "created"].includes(subData.status)) {
        return res.status(400).json({ error: "Subscription is not active", code: "SUBSCRIPTION_INACTIVE" });
      }
      // C-3 (prior audit): Cross-validate that the subscription's Razorpay plan_id
      // matches the plan key the client claims. Without this check, an attacker
      // could submit a weekly (Sprint Pack ₹39) subscription_id with plan:"monthly"
      // and get upgraded to Pro tier without paying for it.
      // Only enforce when the env vars are configured — skip gracefully in envs
      // that haven't set RAZORPAY_PLAN_WEEKLY/MONTHLY to avoid false 403s on
      // existing deploys that aren't using subscription billing yet.
      const expectedRzpPlanId = RAZORPAY_PLAN_ID_MAP[plan];
      if (expectedRzpPlanId && subData.plan_id && subData.plan_id !== expectedRzpPlanId) {
        console.error("[verify-payment] Subscription plan_id mismatch — possible forgery:", {
          claimed_plan: plan,
          expected_plan_id: expectedRzpPlanId,
          actual_plan_id: subData.plan_id,
          subscription_id: razorpay_subscription_id.slice(0, 12),
        });
        return res.status(400).json({ error: "Subscription plan mismatch", code: "PLAN_ID_MISMATCH" });
      }
    }
    } catch (rzpErr) {
      if (rzpErr instanceof DOMException && rzpErr.name === "AbortError") {
        return res.status(504).json({ error: "Payment verification timed out. Please retry.", code: "RAZORPAY_TIMEOUT" });
      }
      throw rzpErr;
    } finally { clearTimeout(rzpTimer); }

    // Idempotent success helper — when this payment_id was already processed
    // (typically by the Razorpay webhook racing the client callback), the
    // user IS upgraded. Return their current subscription state so the
    // client treats the response as success, not a 409 error. UPI in
    // particular hits this path because the webhook fires while the
    // browser is still redirecting back from the bank's auth page.
    const respondIdempotent = async (source: string): Promise<void> => {
      try {
        const [snapRes, creditsRes] = await Promise.all([
          fetchWithTimeout(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=subscription_tier,subscription_start,subscription_end`,
            { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
          ),
          // Include credit balance so single-plan idempotent responses still
          // trigger onCreditPurchase on the client. Without this, the client
          // gets success:true but no credits field, so the balance never updates.
          fetchWithTimeout(
            `${SUPABASE_URL}/rest/v1/session_credits?user_id=eq.${encodeURIComponent(userId)}&select=balance`,
            { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
          ),
        ]);
        const rows = await snapRes.json();
        const snap = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
        const creditRows = await creditsRes.json();
        const credits = Array.isArray(creditRows) && creditRows.length > 0 ? (creditRows[0].balance ?? 0) : 0;
        void captureServerEvent("verify_payment_idempotent", userId, {
          payment_id_hash: hashPaymentId(razorpay_payment_id),
          source,
        });
        res.status(200).json({
          success: true,
          idempotent: true,
          credits,
          subscriptionTier: snap?.subscription_tier ?? null,
          subscriptionStart: snap?.subscription_start ?? null,
          subscriptionEnd: snap?.subscription_end ?? null,
        });
      } catch (snapErr) {
        console.warn("[verify-payment] idempotent profile fetch failed:", snapErr);
        res.status(200).json({ success: true, idempotent: true });
      }
    };

    // 3. Atomic duplicate check — INSERT with ON CONFLICT to prevent race conditions
    // Try inserting a dedup record first; if it already exists, payment was already processed
    const dedupRes = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/payment_dedup`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ razorpay_payment_id }),
    });
    // 409 = unique constraint violation = already processed (typically webhook beat us)
    if (dedupRes.status === 409) {
      await respondIdempotent("payment_dedup_409");
      return;
    }
    // 201 = successfully inserted dedup record = new payment, proceed
    if (dedupRes.status === 201) {
      // Dedup succeeded — continue processing below
    } else {
      // Non-201, non-409: Supabase error (500, timeout, etc.)
      // Fallback: check payments table (legacy check) to avoid blocking legitimate retries
      // of payments that were already fully processed before the dedup table existed
      console.error("[verify-payment] Dedup INSERT returned unexpected status:", dedupRes.status);
      const dupCheck = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/payments?razorpay_payment_id=eq.${encodeURIComponent(razorpay_payment_id)}&select=id`,
        { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
      );
      const dupRows = await dupCheck.json();
      if (Array.isArray(dupRows) && dupRows.length > 0) {
        await respondIdempotent("payments_legacy_dup");
        return;
      }
      // Payment not in legacy table either. The Razorpay signature is
      // already verified at this point — the user HAS been charged. If we
      // 503 here, they're billed-but-not-activated and have to email
      // support. Worse-case for them.
      //
      // Trade-off: fall through to activation. The profile-level
      // razorpay_payment_id check below (line ~407) is a backstop against
      // double-activation if a second attempt squeezes through while
      // dedup is recovering. PostHog event lets ops monitor frequency.
      console.warn("[verify-payment] Dedup table unavailable but payment is signature-verified. Proceeding with activation to avoid leaving the user charged-but-unactivated.");
      void captureServerEvent("verify_payment_dedup_degraded", userId, {
        payment_id_hash: hashPaymentId(razorpay_payment_id),
        dedup_status: dedupRes.status,
      });
      // Intentionally fall through — no return here.
    }

    // 3b. Check profile for duplicate + subscription state
    const profileRes = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=subscription_tier,subscription_start,subscription_end,razorpay_payment_id`,
      { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
    );
    const profiles = await profileRes.json();
    const current = Array.isArray(profiles) && profiles.length > 0 ? profiles[0] : null;
    if (current) {
      if (current.razorpay_payment_id === razorpay_payment_id) {
        await respondIdempotent("profile_payment_id_match");
        return;
      }
      const currentEnd = current.subscription_end ? new Date(current.subscription_end) : null;
      const isActive = currentEnd && currentEnd > new Date();
      const newTier = PLAN_TIER[plan];
      // Single-session credit top-ups are tier-neutral, so they're never a
      // "downgrade" even when the buyer holds an active paid plan.
      if (plan !== "single" && isActive && (TIER_RANK[current.subscription_tier] || 0) > (TIER_RANK[newTier] || 0)) {
        return res.status(400).json({ error: `You already have an active ${current.subscription_tier} plan. Downgrading is not supported — wait for it to expire or contact support.` });
      }
    }

    // 4a. Single-session purchase — grants session credits, no tier change.
    // Credits go to the service-role-only session_credits ledger (NOT a
    // profiles column), so the balance stays unforgeable. See _session-credits.ts.
    if (plan === "single") {
      const nowSingle = new Date();
      const purchaseAmount = PLAN_AMOUNT.single * sessionQuantity;
      const paymentRecordRes = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/payments`, {
        method: "POST",
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ id: crypto.randomUUID(), user_id: userId, razorpay_payment_id, razorpay_order_id, plan: "single", tier: "free", amount: purchaseAmount, currency: "INR", status: "completed", subscription_start: nowSingle.toISOString(), subscription_end: nowSingle.toISOString() }),
      });
      if (!paymentRecordRes.ok) {
        console.error("[verify-payment] single payment record save failed:", paymentRecordRes.status);
        return res.status(500).json({ error: "Failed to save payment record" });
      }
      // Money-critical: the payment is already captured, so retry the grant
      // through transient Supabase failures before giving up.
      const newBalance = await grantSessionCredits(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, userId, sessionQuantity, fetch, 3);
      if (newBalance === null) {
        console.error("[verify-payment] credit grant failed after retries for", userId.slice(0, 8));
        // The dedup row was inserted BEFORE this grant, so leaving it in place
        // would make a client retry short-circuit at the 409/idempotent path and
        // return "success" without ever granting the credit — a permanent loss.
        // Roll it back (best-effort) so a genuine retry can re-process cleanly.
        await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/payment_dedup?razorpay_payment_id=eq.${encodeURIComponent(razorpay_payment_id)}`, {
          method: "DELETE",
          headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, Prefer: "return=minimal" },
        }).catch(() => {});
        void captureServerEvent("verify_payment_credit_grant_failed", userId, {
          payment_id_hash: hashPaymentId(razorpay_payment_id), quantity: sessionQuantity,
        });
        return res.status(500).json({ error: "Could not add your session credit. Your payment was received — please retry in a moment or contact support@hirestepx.com." });
      }
      // Idempotency backstop: record this payment_id on the profile so a
      // replayed callback short-circuits at the profile_payment_id_match check.
      await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ razorpay_payment_id }),
      }).catch(() => {});
      if (userEmail) {
        try { await sendPaymentEmail(userEmail, userName || "Customer", "single", "free", razorpay_payment_id, nowSingle.toISOString(), nowSingle.toISOString(), `₹${purchaseAmount / 100}`); } catch (e) { console.warn("[verify-payment] single email failed:", e); }
      }
      if (razorpay_order_id) await clearPaymentIntent(razorpay_order_id);
      await captureServerEvent("payment_completed", userId, {
        // tier reflects the user's actual subscription at purchase time — credits
        // are a universal top-up available to all tiers, not just free users.
        plan: "single", tier: current?.subscription_tier || "free", amount: purchaseAmount, currency: "INR", payment_id: razorpay_payment_id, quantity: sessionQuantity, credits_after: newBalance,
      });
      return res.status(200).json({
        success: true,
        plan: "single",
        credits: newBalance,
        quantity: sessionQuantity,
        subscriptionTier: current?.subscription_tier || "free",
        subscriptionStart: null,
        subscriptionEnd: current?.subscription_end ?? null,
      });
    }

    // 4. Calculate subscription dates with mid-cycle upgrade proration.
    // The duration + price for proration are derived from the current plan's
    // REAL dates (not the tier alone) inside _payment-verification, so yearly
    // upgraders are no longer over-credited. See _proration-helpers.ts.
    const now = new Date();
    const tier = PLAN_TIER[plan];
    const dates = computeSubscriptionEnd({
      plan,
      now,
      currentStartMs: current?.subscription_start ? new Date(current.subscription_start).getTime() : null,
      currentEndMs: current?.subscription_end ? new Date(current.subscription_end).getTime() : null,
      currentTier: current?.subscription_tier ?? null,
    });
    if (!dates) {
      return res.status(400).json({ error: "Invalid plan duration", code: "INVALID_PLAN" });
    }
    const { end, proratedDays } = dates;

    // 5. Store payment record FIRST (critical — must succeed before activating subscription)
    const paymentRecordRes = await fetchWithTimeout(`${SUPABASE_URL}/rest/v1/payments`, {
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
        razorpay_payment_id,
        razorpay_order_id,
        plan,
        tier,
        // Store the actual charged amount (list price minus any promo discount).
        // promoDiscount is server-derived from Razorpay order notes (set by create-order.ts).
        amount: Math.max(0, PLAN_AMOUNT[plan] - promoDiscount),
        currency: "INR",
        status: "completed",
        subscription_start: now.toISOString(),
        subscription_end: end.toISOString(),
      }),
    });

    if (!paymentRecordRes.ok) {
      const errText = await paymentRecordRes.text().catch(() => "");
      console.error("Payment record save failed:", paymentRecordRes.status, errText);
      return res.status(500).json({ error: "Failed to save payment record" });
    }

    // 6. Update profile (service role key bypasses RLS)
    const updateRes = await fetchWithTimeout(
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
          razorpay_payment_id,
          ...(razorpay_subscription_id ? { razorpay_subscription_id } : {}),
          cancel_at_period_end: false,
        }),
      },
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text().catch(() => "");
      console.error("Supabase update error:", updateRes.status, errText);
      return res.status(500).json({ error: "Failed to activate subscription" });
    }

    // 6a. Consume exactly one promo use — only now, after the charge cleared and
    // the subscription is live. A single RPC call (consume_promo_code) does the
    // SELECT + UPDATE atomically inside a Postgres transaction, eliminating the
    // read-then-write race that the previous SELECT+PATCH pattern had under
    // concurrent Razorpay webhook + client-callback delivery. Best-effort: a
    // failed call must not fail an already-activated payment.
    if (promoCodeUsed) {
      try {
        const promoRpcRes = await fetchWithTimeout(
          `${SUPABASE_URL}/rest/v1/rpc/consume_promo_code`,
          {
            method: "POST",
            headers: {
              apikey: SUPABASE_SERVICE_ROLE_KEY,
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": "application/json",
            },
            // Pass p_user_id so the updated RPC records a per-user redemption row
            // in promo_redemptions and enforces max_uses_per_user if set.
            body: JSON.stringify({ p_code: promoCodeUsed, p_user_id: userId }),
          },
        );
        const promoResult = await promoRpcRes.json().catch(() => null);
        if (promoResult === null || (Array.isArray(promoResult) && promoResult.length === 0)) {
          console.warn("[verify-payment] consume_promo_code returned null/empty — code exhausted or not found:", promoCodeUsed);
        }
      } catch (promoErr) {
        console.warn("[verify-payment] promo consumption failed (non-fatal):", promoErr);
      }
    }

    // 6b. Send confirmation email with retry (non-critical — don't fail payment if email fails)
    let emailSent = false;
    if (userEmail) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await sendPaymentEmail(userEmail, userName, plan, tier, razorpay_payment_id, now.toISOString(), end.toISOString());
          emailSent = true;
          break;
        } catch (emailErr) {
          console.error(`Confirmation email attempt ${attempt + 1} failed:`, emailErr);
          if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
        }
      }
      if (!emailSent) {
        console.error(`[verify-payment] Email permanently failed for user ${userId.slice(0, 8)}, payment ${razorpay_payment_id.slice(0, 8)}`);
      }
    }

    // Fetch receipt/invoice URL from Razorpay payment (best-effort).
    // Low-severity nitpick: these two sequential calls had no timeout, unlike
    // the earlier rzpAc-guarded calls. Wrap in a shared AbortController so a
    // slow Razorpay response can't stall the verify-payment reply indefinitely.
    let receiptUrl: string | null = null;
    try {
      const receiptAc = new AbortController();
      const receiptTimer = setTimeout(() => receiptAc.abort(), 6000);
      const paymentRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
        headers: { Authorization: `Basic ${rzpAuth}` },
        signal: receiptAc.signal,
      });
      if (paymentRes.ok) {
        const paymentData = await paymentRes.json();
        if (paymentData.invoice_id) {
          const invoiceRes = await fetch(`https://api.razorpay.com/v1/invoices/${paymentData.invoice_id}`, {
            headers: { Authorization: `Basic ${rzpAuth}` },
            signal: receiptAc.signal,
          });
          if (invoiceRes.ok) {
            const invoiceData = await invoiceRes.json();
            receiptUrl = invoiceData.short_url || null;
          }
        }
      }
      clearTimeout(receiptTimer);
    } catch (receiptErr) { console.warn("[verify-payment] Receipt fetch failed:", receiptErr); }

    // Persist receipt URL to payment record (best-effort)
    if (receiptUrl) {
      try {
        await fetchWithTimeout(
          `${SUPABASE_URL}/rest/v1/payments?razorpay_payment_id=eq.${encodeURIComponent(razorpay_payment_id)}`,
          {
            method: "PATCH",
            headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify({ receipt_url: receiptUrl }),
          },
        );
      } catch (e) { console.warn("[verify-payment] Receipt URL persist failed:", e); }
    }

    if (razorpay_order_id) await clearPaymentIntent(razorpay_order_id);
    await captureServerEvent("payment_completed", userId, {
      plan,
      tier,
      payment_id_hash: hashPaymentId(razorpay_payment_id),
      subscription_end: end.toISOString(),
      prorated_days: proratedDays,
    });
    return res.status(200).json({
      success: true,
      subscriptionTier: tier,
      subscriptionStart: now.toISOString(),
      subscriptionEnd: end.toISOString(),
      paymentId: razorpay_payment_id,
      emailSent,
      receiptUrl,
      ...(proratedDays > 0 ? { proratedBonusDays: proratedDays } : {}),
    });
  } catch (err) {
    console.error("Payment verification error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
