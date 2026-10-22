/* Which unlock order "owns" a match, and the refund arithmetic that depends on it.
 *
 * Two orders can end up covering the same match (a batch overlapping another order, a retry that raced a
 * fresh purchase). The match is charged once: the order that unlocked it keeps it, any other order returns its
 * share as credit. After that, only the owner may relock it on a refund, and a candidate-triggered credit
 * refund must be priced against the owner, never an order that already handed the match back.
 *
 * Pure functions first (unit-tested), then the two small PostgREST reads they need. Every read is
 * fail-closed: null means "could not tell", and the caller must retry rather than guess. */

type Headers = Record<string, string>;

/** The slice of an order the ownership rules need. */
export interface LiveOrderLite {
  razorpay_order_id: string;
  match_ids: string[];
}

/** Ledger reasons for a refund row an order wrote because it could NOT deliver the match (as opposed to a
 *  candidate declining after delivery). Such an order never owned the match. */
export const NOT_DELIVERED_REASONS = ["unavailable", "employer_suspended"] as const;

export const ownershipKey = (matchId: string, orderRef: string): string => `${matchId}|${orderRef}`;

/** Matches in `matchIds` that another live order still owns: it lists the match and did not hand it back. */
export function heldByOtherOrders(matchIds: string[], others: LiveOrderLite[], notDelivered: ReadonlySet<string>): Set<string> {
  const held = new Set<string>();
  for (const id of matchIds) {
    if (others.some((o) => o.match_ids.includes(id) && !notDelivered.has(ownershipKey(id, o.razorpay_order_id)))) held.add(id);
  }
  return held;
}

/** On a refund of `order`, the matches that may be relocked: ones this order delivered, that no other live
 *  order also owns. Relocking a match another order paid for would take away contact the employer paid for. */
export function relockableMatchIds(order: LiveOrderLite, others: LiveOrderLite[], notDelivered: ReadonlySet<string>): string[] {
  const held = heldByOtherOrders(order.match_ids, others, notDelivered);
  return order.match_ids.filter((id) => !held.has(id) && !notDelivered.has(ownershipKey(id, order.razorpay_order_id)));
}

/** Paise of value still returnable on an order: everything paid (cash + credit spent) minus what already went
 *  back as a cash partial refund and as credit. Never negative. */
export function remainingReturnablePaise(p: {
  cashPaise: number; creditSpentPaise: number; cashRefundedPaise: number; creditReturnedPaise: number;
}): number {
  return Math.max(0, p.cashPaise + p.creditSpentPaise - Math.max(0, p.cashRefundedPaise) - Math.max(0, p.creditReturnedPaise));
}

/** Paise by which a cash partial refund plus the credit already returned exceed what the order was worth.
 *  This is the part of the credit that has to be taken back (or the credit note capped to). */
export function refundOverlapPaise(p: {
  cashPaise: number; creditSpentPaise: number; cashRefundedTotalPaise: number; creditReturnedPaise: number;
}): number {
  return Math.max(0, Math.max(0, p.cashRefundedTotalPaise) + Math.max(0, p.creditReturnedPaise) - (p.cashPaise + p.creditSpentPaise));
}

/** Part of `amountPaise` (one refund) that is not an overlap: the credit note must not exceed what the
 *  order could still give back, or the same value is credit-noted twice. */
export function creditNoteAmountForCashRefund(p: {
  refundPaise: number; cashPaise: number; creditSpentPaise: number; cashRefundedBeforePaise: number; creditReturnedPaise: number;
}): number {
  const room = remainingReturnablePaise({
    cashPaise: p.cashPaise, creditSpentPaise: p.creditSpentPaise,
    cashRefundedPaise: p.cashRefundedBeforePaise, creditReturnedPaise: p.creditReturnedPaise,
  });
  return Math.max(0, Math.min(Math.round(p.refundPaise), room));
}

/** Overlap newly caused by this refund, given the overlap already clawed back by earlier refunds. */
export function incrementalOverlapPaise(overlapNowPaise: number, alreadyClawedBackPaise: number): number {
  return Math.max(0, Math.round(overlapNowPaise) - Math.max(0, Math.round(alreadyClawedBackPaise)));
}

/* ── Reads ── */

const inList = (ids: string[]): string => ids.map(encodeURIComponent).join(",");

/** Other fulfilled/partial orders that list any of `order.match_ids`. null when the read fails. */
export async function loadOtherLiveOrders(
  base: string, headers: Headers, order: LiveOrderLite, f: typeof fetch,
): Promise<LiveOrderLite[] | null> {
  if (order.match_ids.length === 0) return [];
  try {
    const res = await f(
      `${base}/rest/v1/employer_unlock_orders?status=in.(fulfilled,partial)&razorpay_order_id=neq.${encodeURIComponent(order.razorpay_order_id)}` +
        `&match_ids=ov.{${inList(order.match_ids)}}&select=razorpay_order_id,match_ids&limit=100`,
      { headers },
    );
    if (!res.ok) return null;
    const rows = (await res.json().catch(() => null)) as LiveOrderLite[] | null;
    return Array.isArray(rows) ? rows.filter((r) => typeof r.razorpay_order_id === "string" && Array.isArray(r.match_ids)) : null;
  } catch {
    return null;
  }
}

/** `match|order` keys for refund rows written because an order could not deliver the match. An absent
 *  ledger (migration unapplied) reads as no such rows. null when the read fails. */
export async function loadNotDeliveredKeys(
  base: string, headers: Headers, matchIds: string[], orderRefs: string[], f: typeof fetch,
): Promise<Set<string> | null> {
  const keys = new Set<string>();
  if (matchIds.length === 0 || orderRefs.length === 0) return keys;
  try {
    const refs = orderRefs.map((r) => encodeURIComponent(`"${r}"`)).join(",");
    const res = await f(
      `${base}/rest/v1/employer_credit_ledger?kind=eq.refund&reason=in.(${NOT_DELIVERED_REASONS.join(",")})` +
        `&match_id=in.(${inList(matchIds)})&order_ref=in.(${refs})&select=match_id,order_ref&limit=1000`,
      { headers },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return res.status === 404 || /PGRST205|42P01|does not exist/i.test(text) ? keys : null;
    }
    const rows = (await res.json().catch(() => null)) as Array<{ match_id: string | null; order_ref: string | null }> | null;
    if (!Array.isArray(rows)) return null;
    for (const r of rows) if (r.match_id && r.order_ref) keys.add(ownershipKey(r.match_id, r.order_ref));
    return keys;
  } catch {
    return null;
  }
}

/** Everything the ownership rules need for one order, in two reads. null = could not tell. */
export async function loadOwnership(
  base: string, headers: Headers, order: LiveOrderLite, f: typeof fetch,
): Promise<{ others: LiveOrderLite[]; notDelivered: Set<string> } | null> {
  const others = await loadOtherLiveOrders(base, headers, order, f);
  if (!others) return null;
  if (others.length === 0) return { others, notDelivered: new Set() };
  const notDelivered = await loadNotDeliveredKeys(base, headers, order.match_ids, [order.razorpay_order_id, ...others.map((o) => o.razorpay_order_id)], f);
  return notDelivered ? { others, notDelivered } : null;
}
