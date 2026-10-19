/* Paying for an unlock with employer credit.
 *
 * A credit-only unlock has no Razorpay order, so it is recorded as an
 * employer_unlock_orders row with a synthetic `credit_<uuid>` order ref and
 * amount 0, then pushed through the same fulfillUnlockOrder() as cash orders
 * with a synthetic captured payment. The credit itself lives in the credit
 * ledger (spend rows keyed by that order ref), so "was this order paid?" is
 * answered by the ledger, which also makes retries and the reconciler safe. */

import { creditSpentOnOrders, CREDIT_ORDER_PREFIX, isCreditOrderRef } from "./_employer-credit";
import { fulfillUnlockOrder, type CapturedPayment, type FulfillResult, type UnlockOrderRow } from "./_unlock-fulfillment";
import type { NotifyInput } from "./_notify";

const PREFIX = CREDIT_ORDER_PREFIX;

export { isCreditOrderRef };

export function newCreditOrderRef(): string {
  return `${PREFIX}${crypto.randomUUID()}`;
}

export function creditPayment(orderRef: string): CapturedPayment {
  return { id: `credit_pay_${orderRef.slice(PREFIX.length)}`, status: "captured", amount: 0, orderId: orderRef, currency: "INR" };
}

export type SettleResult = FulfillResult | { kind: "no_credit" } | { kind: "ledger_unavailable" };

/** Fulfils a credit-only order once credit has actually been spent on it. */
export async function settleCreditOrder(p: {
  supabaseUrl: string;
  headers: Record<string, string>;
  order: Pick<UnlockOrderRow, "razorpay_order_id" | "employer_id">;
  expectEmployerId?: string;
  fetchImpl?: typeof fetch;
  notifyImpl?: (input: NotifyInput) => Promise<void>;
  now?: () => Date;
}): Promise<SettleResult> {
  const ref = p.order.razorpay_order_id;
  const spent = await creditSpentOnOrders(p.supabaseUrl, p.headers, p.order.employer_id, [ref], p.fetchImpl);
  if (!spent) return { kind: "ledger_unavailable" };
  if ((spent.get(ref) ?? 0) <= 0) return { kind: "no_credit" };
  return fulfillUnlockOrder({
    supabaseUrl: p.supabaseUrl, headers: p.headers, razorpayOrderId: ref, payment: creditPayment(ref),
    expectEmployerId: p.expectEmployerId, fetchImpl: p.fetchImpl, notifyImpl: p.notifyImpl, now: p.now,
  });
}
