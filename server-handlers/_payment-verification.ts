/* Pure payment-verification pieces extracted from verify-payment.ts so the
 * money path is unit-tested against the real code, not an inline copy.
 *
 * Node serverless only (uses node:crypto + Buffer) — not imported by any edge
 * handler. The mid-cycle proration math lives in _proration-helpers.ts; this
 * file owns the plan catalog, the Razorpay signature check, and the
 * subscription end-date calculation that the handler used to inline.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { computeProratedDays } from "./_proration-helpers";

/* Active, purchasable plans. Annual SKUs were removed from the product; legacy
 * yearly subscriptions are still credited correctly on upgrade because
 * _proration-helpers keeps the yearly amounts/durations for its measured-date
 * math. "single" is a one-off credit top-up (free tier), not a term plan. */
export const PLAN_TIER: Record<string, string> = { single: "free", weekly: "starter", monthly: "pro" };
export const PLAN_AMOUNT: Record<string, number> = { single: 900, weekly: 4900, monthly: 14900 };
export const PLAN_LABEL: Record<string, string> = { weekly: "Starter (₹49/week)", monthly: "Pro (₹149/month)" };

/** Subscription term length, in days, for the NEW plan. "single" has no term
 *  (it grants credits, not a tier), so it is absent — callers treat an absent
 *  entry as "not a term purchase". */
export const PLAN_DAYS: Record<string, number> = { weekly: 7, monthly: 30 };

export const TIER_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2 };

/** The payload Razorpay signs: subscriptions sign `subscription_id|payment_id`,
 *  one-time orders sign `order_id|payment_id`. */
export function buildSignaturePayload(args: {
  orderId?: string | null;
  subscriptionId?: string | null;
  paymentId: string;
}): string {
  const { orderId, subscriptionId, paymentId } = args;
  return subscriptionId ? `${subscriptionId}|${paymentId}` : `${orderId}|${paymentId}`;
}

/** Timing-safe Razorpay HMAC-SHA256 signature check. Returns true iff
 *  `signature` equals HMAC(secret, payload) as lowercase hex. */
export function verifyRazorpaySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || typeof signature !== "string" || signature.length === 0) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expected);
  return sigBuf.length === expBuf.length && timingSafeEqual(sigBuf, expBuf);
}

/** Whether buying `newPlan` while holding an active `currentTier` subscription
 *  is a tier upgrade (strictly higher tier, current sub not yet expired). */
export function isUpgrade(args: {
  currentTier?: string | null;
  currentEndMs: number | null;
  nowMs: number;
  newPlan: string;
}): boolean {
  const { currentTier, currentEndMs, nowMs, newPlan } = args;
  if (!currentTier || currentEndMs === null || !(currentEndMs > nowMs)) return false;
  return (TIER_RANK[currentTier] || 0) < (TIER_RANK[PLAN_TIER[newPlan]] || 0);
}

/** Subscription end date for a verified payment.
 *  - Upgrade: new term + prorated bonus days for the unused part of the old plan.
 *  - Renewal / new: extend from the later of the current end and now.
 *  Returns null for plans with no term (e.g. "single"), which the caller must
 *  reject or route to the credit path. */
export function computeSubscriptionEnd(args: {
  plan: string;
  now: Date;
  currentStartMs?: number | null;
  currentEndMs?: number | null;
  currentTier?: string | null;
}): { end: Date; proratedDays: number } | null {
  const { plan, now, currentStartMs, currentEndMs, currentTier } = args;
  const planDays = PLAN_DAYS[plan];
  if (planDays === undefined) return null;

  const nowMs = now.getTime();
  const endMs = currentEndMs ?? null;
  const upgrade = isUpgrade({ currentTier, currentEndMs: endMs, nowMs, newPlan: plan });

  if (upgrade && endMs !== null) {
    const proratedDays = computeProratedDays({
      nowMs,
      currentStartMs: currentStartMs ?? NaN,
      currentEndMs: endMs,
      currentTier: currentTier as string,
      newPlan: plan,
    });
    const end = new Date(now);
    end.setDate(end.getDate() + planDays + proratedDays);
    return { end, proratedDays };
  }

  // Renewal (still active) extends from the current end; otherwise from now.
  const base = endMs !== null && endMs > nowMs ? new Date(endMs) : new Date(now);
  base.setDate(base.getDate() + planDays);
  return { end: base, proratedDays: 0 };
}
