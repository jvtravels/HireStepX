/* Vercel Serverless Function — Razorpay Order Creation */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  applyCorsHeaders,
  handlePreflightAndMethod,
  isRateLimited,
  getVercelClientIp,
  supabaseUrl,
  supabaseAnonKey,
} from "./_shared";
import { captureServerEvent } from "./_posthog";
import { checkPromoValidity, computeDiscountAmount } from "./_promo";

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

/** 24-hour TTL for payment-intent dedup keys (distinct from DEDUP_TTL which is 90s idempotency) */
const INTENT_KEY_TTL_SEC = 86_400;

const PRICE_MAP: Record<string, { amount: number; name: string; description: string }> = {
  single:           { amount: 900,    name: "HireStepX Single Session",   description: "Single mock interview session — ₹9" },
  weekly:           { amount: 3900,   name: "HireStepX Sprint Pack",      description: "Interview Sprint Pack — ₹39 · 5 sessions · 30-day validity" },
};

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

  // Rate limiting: 5 order creations per minute per IP
  const ip = getVercelClientIp(req);
  if (await isRateLimited(ip, "create-order", 5, 60_000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please try again shortly.", retryAfter: 60 });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.error("Missing Razorpay env vars:", { hasKeyId: !!RAZORPAY_KEY_ID, hasKeySecret: !!RAZORPAY_KEY_SECRET });
    return res.status(503).json({ error: "Payments not configured. Please contact support@hirestepx.com" });
  }

  // Verify auth — always required. Never fall back to a client-supplied userId;
  // if Supabase is unreachable or misconfigured, fail hard so an attacker
  // cannot forge orders under another user's identity by supplying their UUID
  // in the request body (C-1 fix).
  const SUPABASE_URL = supabaseUrl();
  const SUPABASE_ANON_KEY = supabaseAnonKey();
  let authenticatedUserId: string | undefined;
  const authToken = (req.headers.authorization || "").replace("Bearer ", "");
  if (authToken && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${authToken}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!authRes.ok) return res.status(401).json({ error: "Unauthorized" });
    try {
      const userData = await authRes.json();
      authenticatedUserId = userData.id;
    } catch {
      return res.status(401).json({ error: "Auth verification failed" });
    }
  }
  // Guard: reject if auth was not satisfied — covers missing token, missing env
  // vars, or any soft-failure path above. No fallback to req.body.userId.
  if (!authenticatedUserId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    // userId is intentionally omitted — we use authenticatedUserId (server-verified)
    // and never trust a client-supplied userId field (C-1 fix).
    const { plan, email, quantity: rawQty, promoCode: rawPromo } = req.body;
    if (typeof plan !== "string" || !PRICE_MAP[plan]) {
      return res.status(400).json({ error: "Invalid plan" });
    }
    const price = PRICE_MAP[plan];
    if (!price) return res.status(400).json({ error: "Invalid plan" });

    // Single-session is the only quantity-variable plan: a user can buy 1–10
    // credits in one order. Every other plan is a fixed-price subscription.
    let quantity = 1;
    if (plan === "single") {
      const q = typeof rawQty === "number" ? rawQty : parseInt(String(rawQty ?? "1"), 10);
      quantity = Math.min(Math.max(Number.isFinite(q) ? Math.trunc(q) : 1, 1), 10);
    }

    // Apply a promo code to the charge — server-authoritative. We re-validate
    // against the ACTUAL plan (so a code previewed for one plan can't underpay
    // another) and apply the discount to the Razorpay order amount, which is
    // what the user confirms in checkout. The code is CONSUMED later, exactly
    // once, in verify-payment after a successful charge — never here, so
    // abandoned checkouts don't burn a use. Promos don't apply to single.
    let promoCode = "";
    let promoDiscount = 0;
    const promoInput = typeof rawPromo === "string" ? rawPromo.trim().toUpperCase().slice(0, 40) : "";
    if (promoInput && plan !== "single" && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      try {
        const promoRes = await fetch(
          `${SUPABASE_URL}/rest/v1/promo_codes?code=eq.${encodeURIComponent(promoInput)}&select=*`,
          { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } },
        );
        const promoRows = await promoRes.json().catch(() => []);
        const promo = Array.isArray(promoRows) && promoRows[0] ? promoRows[0] : null;
        if (promo && checkPromoValidity(promo, plan, Date.now()).valid) {
          const d = computeDiscountAmount(promo, price.amount);
          if (d > 0) { promoDiscount = d; promoCode = promoInput; }
        }
      } catch (promoErr) {
        // Fail open: an unreachable promo table must not block checkout. The
        // user is simply charged full price (which Razorpay shows them).
        console.warn("[create-order] promo lookup failed:", promoErr);
      }
    }

    const finalAmount = Math.max(0, price.amount * quantity - promoDiscount);
    const finalDescription = quantity > 1 ? `${price.description} × ${quantity}` : price.description;

    // Idempotency: atomic lock to prevent duplicate orders for the same
    // user+plan from racing simultaneous clicks (double-click, fast retry).
    //
    // TTL covers slow-network round-trips on Indian 3G/4G (Razorpay's
    // hosted checkout regularly takes 30-60s on poor signal). Too short
    // and a double-tap during a stuck request bills the card twice; too
    // long and a human retry after a failed checkout reuses a stale
    // order_id that Razorpay marks non-attemptable. 90s threads that
    // needle. See PostHog `checkout_cache_hit`.
    const DEDUP_TTL = 90;
    // authenticatedUserId is guaranteed non-undefined here (guard above).
    const resolvedUserId = authenticatedUserId;
    const idempotencyKey = `order:${resolvedUserId}:${plan}${plan === "single" ? `:${quantity}` : ""}${promoCode ? `:${promoCode}` : ""}`;
    if (UPSTASH_URL && UPSTASH_TOKEN && resolvedUserId) {
      try {
        // Atomic: SET NX returns OK if key was set (we got the lock), null if it existed (duplicate)
        const lockRes = await fetch(`${UPSTASH_URL}/SET/${encodeURIComponent(idempotencyKey)}/pending/NX/EX/${DEDUP_TTL}`, {
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
        if (lockRes.ok) {
          const lockData = await lockRes.json();
          if (lockData.result === null) {
            // Key already existed — another request is in flight. Wait briefly
            // for its order_id, then return it (this is a true race within
            // the same checkout click, not a stale post-failure retry).
            const oidRes = await fetch(`${UPSTASH_URL}/GET/${encodeURIComponent(`${idempotencyKey}:oid`)}`, {
              headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            });
            if (oidRes.ok) {
              const oidData = await oidRes.json();
              if (oidData.result) {
                await captureServerEvent("checkout_cache_hit", resolvedUserId, { plan, order_id: oidData.result, branch: "fast" });
                return res.status(200).json({
                  orderId: oidData.result,
                  amount: finalAmount,
                  currency: "INR",
                  keyId: RAZORPAY_KEY_ID,
                  name: price.name,
                  description: finalDescription,
                });
              }
            }
            // Lock exists but no order yet — peer is mid-flight. Wait briefly.
            await new Promise(r => setTimeout(r, 2000));
            const retryRes = await fetch(`${UPSTASH_URL}/GET/${encodeURIComponent(`${idempotencyKey}:oid`)}`, {
              headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              if (retryData.result) {
                await captureServerEvent("checkout_cache_hit", resolvedUserId, { plan, order_id: retryData.result, branch: "waited" });
                return res.status(200).json({
                  orderId: retryData.result,
                  amount: finalAmount,
                  currency: "INR",
                  keyId: RAZORPAY_KEY_ID,
                  name: price.name,
                  description: finalDescription,
                });
              }
            }
            return res.status(429).json({ error: "Order already in progress. Please wait a moment." });
          }
        }
      } catch (dedupErr) { console.warn("[create-order] Idempotency check failed:", dedupErr); }
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
    const receipt = `${plan}_${Date.now()}`.slice(0, 40);

    const notes: Record<string, string> = { plan };
    // verify-payment reads notes.quantity to recompute the expected amount and
    // to grant the right number of credits for single-session purchases.
    if (plan === "single") notes.quantity = String(quantity);
    // verify-payment reads notes.promo + notes.discount to (a) recompute the
    // expected discounted amount and (b) consume exactly one promo use after a
    // successful charge. Both are server-set here, never client-trusted.
    if (promoCode && promoDiscount > 0) {
      notes.promo = promoCode;
      notes.discount = String(promoDiscount);
    }
    if (resolvedUserId.length > 0 && resolvedUserId.length <= 200) notes.userId = resolvedUserId;
    if (typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) notes.email = email;

    const ac = new AbortController();
    const acTimer = setTimeout(() => ac.abort(), 10_000);
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      signal: ac.signal,
      body: JSON.stringify({ amount: finalAmount, currency: "INR", receipt, notes }),
    });
    clearTimeout(acTimer);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Razorpay error:", response.status, errText);
      const detail = response.status === 401
        ? "Payment gateway credentials are invalid. Please contact support."
        : "Could not create payment order. Please try again or contact support@hirestepx.com";
      return res.status(502).json({ error: detail });
    }

    const order = await response.json();

    // Cache order ID for idempotency dedup (matches DEDUP_TTL above)
    if (UPSTASH_URL && UPSTASH_TOKEN && resolvedUserId) {
      fetch(`${UPSTASH_URL}/SET/${encodeURIComponent(`${idempotencyKey}:oid`)}/${encodeURIComponent(order.id)}?EX=${DEDUP_TTL}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      }).catch(() => {});
    }

    // Payment abandonment tracking — store intent with 25h TTL.
    // Cron (/api/send-abandonment-emails) queries keys older than 1h, sends
    // recovery email, and deletes the key. verify-payment.ts deletes the
    // key on successful payment so we never email paying users.
    if (UPSTASH_URL && UPSTASH_TOKEN && resolvedUserId && typeof email === "string" && email.length > 0) {
      const intentKey = `pay_intent:${order.id}`;
      const intentValue = JSON.stringify({
        userId: resolvedUserId,
        email,
        plan,
        amount: finalAmount,
        planName: price.name,
        createdAt: Date.now(),
      });
      fetch(`${UPSTASH_URL}/SET/${encodeURIComponent(intentKey)}/${encodeURIComponent(intentValue)}?EX=${INTENT_KEY_TTL_SEC}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      }).catch(() => {});
    }

    await captureServerEvent("checkout_started", resolvedUserId || "anonymous", {
      plan,
      amount: order.amount,
      currency: order.currency,
      order_id: order.id,
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
      name: price.name,
      description: finalDescription,
    });
  } catch (err) {
    console.error("Order creation error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
