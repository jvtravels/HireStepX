/* Pure decision logic for the Razorpay webhook's one-time `payment.captured`
 * path, extracted so the money-recovery rules are unit-tested against the real
 * code rather than an inline branch.
 *
 * The webhook is the safety net for when the browser's verify-payment callback
 * never fires (UPI redirects routinely drop the return trip on Indian mobile
 * networks). For that net to actually catch every product it must mirror what
 * create-order/verify-payment do, not just full-price subscriptions:
 *   - single-session (₹9 × quantity) grants credits, not a tier
 *   - promo-discounted weekly/monthly captures less than list price
 * Both used to be silently skipped ("missing_notes" / "amount_mismatch"),
 * leaving the buyer charged-but-not-served. resolveCapturedPayment encodes the
 * correct expected-amount math for all three so the handler can branch cleanly.
 */

export const WEBHOOK_PLAN_TIER: Record<string, string> = { single: "free", weekly: "starter", monthly: "pro" };
export const WEBHOOK_PLAN_AMOUNT: Record<string, number> = { single: 900, weekly: 3900, monthly: 14900 }; // weekly = Sprint Pack ₹39
/** Term length in days for the tier plans. "single" has no term (credits). */
export const WEBHOOK_PLAN_DURATION: Record<string, number> = { weekly: 30, monthly: 30 }; // weekly = Sprint Pack 30-day validity

/** Parse a server-written note that should be a non-negative integer (paise
 *  discount, quantity). Notes arrive as strings on the Razorpay entity; anything
 *  unparseable or negative collapses to 0 so it can never inflate the expected
 *  amount or grant. */
function parseNonNegInt(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? ""), 10);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/** Single-session multi-buy is 1–10 credits; clamp like create-order does. */
function clampQuantity(raw: unknown): number {
  const n = parseNonNegInt(raw);
  return Math.min(Math.max(n || 1, 1), 10);
}

export type CapturedPayment =
  | { kind: "credits"; quantity: number }
  | { kind: "subscription"; tier: string; planDays: number }
  | { kind: "reject"; reason: "unknown_plan" | "invalid_amount" | "amount_mismatch" };

/** Decide what a captured one-time payment should do, validating the amount
 *  against server-authoritative pricing (NOT the captured value alone).
 *
 *  `notes` is the same object the handler already reads `plan`/`userId` from —
 *  create-order writes `quantity` (single) and `discount` (promo) onto the order
 *  notes alongside them, so reading them here is consistent with the existing
 *  trust model. Promos never apply to single (create-order enforces that), so a
 *  stray discount note on a single order is ignored. */
export function resolveCapturedPayment(args: {
  plan: unknown;
  amount: unknown;
  notes: Record<string, unknown>;
}): CapturedPayment {
  const { plan, amount, notes } = args;

  if (typeof plan !== "string" || !(plan in WEBHOOK_PLAN_AMOUNT)) {
    return { kind: "reject", reason: "unknown_plan" };
  }
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    return { kind: "reject", reason: "invalid_amount" };
  }

  const isSingle = plan === "single";
  const quantity = isSingle ? clampQuantity(notes.quantity) : 1;
  // Promos never apply to single; ignore any discount note on it.
  const discount = isSingle ? 0 : parseNonNegInt(notes.discount);
  const expected = Math.max(0, WEBHOOK_PLAN_AMOUNT[plan] * quantity - discount);

  if (amount !== expected) {
    return { kind: "reject", reason: "amount_mismatch" };
  }

  if (isSingle) {
    return { kind: "credits", quantity };
  }
  return { kind: "subscription", tier: WEBHOOK_PLAN_TIER[plan], planDays: WEBHOOK_PLAN_DURATION[plan] };
}
