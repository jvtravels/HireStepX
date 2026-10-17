/* Employer credit: pay-as-you-go refunds that come back as platform credit.
 *
 * When a candidate an employer paid for turns out to be unreachable (declines,
 * withdraws, blocks the company, or never answers an interview invite) the
 * unlock price of that candidate is credited back, once, and applied to the
 * employer's next unlock. It is NOT a Razorpay cash refund and it does NOT
 * relock the candidate (the employer keeps what they unlocked).
 *
 * Money model: employer_credit_ledger holds signed paise rows; balance = sum.
 * Pure rules (eligibility, share value, how much credit to apply) live at the
 * top of this file; the I/O below uses plain PostgREST fetches so it runs on
 * both the edge (candidate handlers) and Node (cron, order creation). Every
 * function tolerates migration 0041 being unapplied and never throws into the
 * caller's primary action.
 */

import { slog } from "./_shared";
import { notify as defaultNotify, type NotifyInput } from "./_notify";

export type CreditReason = "declined" | "withdrew" | "blocked" | "no_response" | "unavailable";

/** Days an interview invite may go unanswered before the unlock is credited back. */
export const NO_RESPONSE_DAYS = 14;
/** Only candidates the employer is still waiting on are refundable. Once an
 *  interview is underway, hired, or the employer passed, the unlock delivered. */
const REFUNDABLE_STATUSES: ReadonlySet<string> = new Set(["shortlisted", "interview_invited"]);

export function isRefundableStatus(status: string | null | undefined): boolean {
  return REFUNDABLE_STATUSES.has(status ?? "shortlisted");
}

/** Paise credited for one candidate of a paid order: their equal share of
 *  everything the employer paid for it, cash and credit alike. */
export function creditShare(orderCashPaise: number, creditSpentPaise: number, matchCount: number): number {
  if (matchCount <= 0) return 0;
  return Math.max(0, Math.floor((orderCashPaise + creditSpentPaise) / matchCount));
}

export function creditReasonLabel(reason: CreditReason | string | null | undefined): string {
  switch (reason) {
    case "declined": return "Candidate declined";
    case "withdrew": return "Candidate withdrew";
    case "blocked": return "Candidate blocked your company";
    case "no_response": return `No reply within ${NO_RESPONSE_DAYS} days`;
    case "unavailable": return "Candidate unavailable at unlock";
    default: return "Credit";
  }
}

export interface CreditRow {
  amount: number;
  kind: "refund" | "spend" | "release";
  reason: CreditReason | null;
  match_id: string | null;
  order_ref: string | null;
  created_at: string;
}

type Headers = Record<string, string>;

function isMissing(status: number, text: string): boolean {
  return status === 404 || /PGRST205|PGRST202|42P01|does not exist|could not find the function/i.test(text);
}

/* ── Balance, spend, release ── */

/** Current balance in paise. null when the ledger is unavailable (callers treat that as no credit). */
export async function creditBalance(base: string, headers: Headers, employerId: string, f: typeof fetch = fetch): Promise<number | null> {
  try {
    const res = await f(
      `${base}/rest/v1/employer_credit_ledger?employer_id=eq.${encodeURIComponent(employerId)}&select=amount&limit=5000`,
      { headers },
    );
    if (!res.ok) {
      if (!isMissing(res.status, await res.text().catch(() => ""))) slog.error("credit balance read failed", { status: res.status });
      return null;
    }
    const rows = (await res.json().catch(() => null)) as Array<{ amount: number }> | null;
    if (!Array.isArray(rows)) return null;
    return rows.reduce((s, r) => s + (Number.isInteger(r.amount) ? r.amount : 0), 0);
  } catch {
    return null;
  }
}

/** Atomically spends credit for `orderRef`. Returns paise spent (0 when the balance no longer covers it). */
export async function spendCredit(
  base: string, headers: Headers, employerId: string, amountPaise: number, orderRef: string, f: typeof fetch = fetch,
): Promise<number> {
  if (amountPaise <= 0) return 0;
  try {
    const res = await f(`${base}/rest/v1/rpc/spend_employer_credit`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ p_employer: employerId, p_amount: amountPaise, p_order_ref: orderRef }),
    });
    if (!res.ok) {
      slog.error("credit spend failed", { status: res.status, orderRef });
      return 0;
    }
    const n = await res.json().catch(() => 0);
    return typeof n === "number" && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Net credit spent per order (spend minus anything already released), in paise. null on a read failure. */
export async function creditSpentOnOrders(
  base: string, headers: Headers, employerId: string, orderRefs: string[], f: typeof fetch = fetch,
): Promise<Map<string, number> | null> {
  const out = new Map<string, number>();
  if (orderRefs.length === 0) return out;
  try {
    const refs = orderRefs.map((r) => encodeURIComponent(`"${r}"`)).join(",");
    const res = await f(
      `${base}/rest/v1/employer_credit_ledger?employer_id=eq.${encodeURIComponent(employerId)}&kind=in.(spend,release)&order_ref=in.(${refs})&select=amount,order_ref`,
      { headers },
    );
    if (!res.ok) return isMissing(res.status, await res.text().catch(() => "")) ? out : null;
    const rows = (await res.json().catch(() => null)) as Array<{ amount: number; order_ref: string }> | null;
    if (!Array.isArray(rows)) return null;
    for (const r of rows) out.set(r.order_ref, (out.get(r.order_ref) ?? 0) - r.amount);
    return out;
  } catch {
    return null;
  }
}

/** Returns credit spent on an order that never completed. Idempotent (one release per order). */
export async function releaseCredit(
  base: string, headers: Headers, employerId: string, orderRef: string, f: typeof fetch = fetch,
): Promise<void> {
  try {
    const spent = (await creditSpentOnOrders(base, headers, employerId, [orderRef], f))?.get(orderRef) ?? 0;
    if (spent <= 0) return;
    const res = await f(`${base}/rest/v1/employer_credit_ledger`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ employer_id: employerId, amount: spent, kind: "release", order_ref: orderRef }),
    });
    if (!res.ok && res.status !== 409) slog.error("credit release failed", { status: res.status, orderRef });
  } catch (err) {
    slog.error("credit release threw", { orderRef, err: err instanceof Error ? err.message : String(err) });
  }
}

/* ── Refund as credit ── */

interface PaidOrder {
  razorpay_order_id: string;
  employer_id: string;
  amount: number;
  match_ids: string[];
}

export interface RefundParams {
  base: string;
  headers: Headers;
  matchIds: string[];
  reason: CreditReason;
  /** Restricts to one employer (block/report); omitted when the candidate withdrew from every employer. */
  employerId?: string;
  fetchImpl?: typeof fetch;
  notifyImpl?: (input: NotifyInput) => Promise<void>;
}

export interface RefundResult {
  credited: Array<{ employerId: string; matchId: string; amountPaise: number }>;
}

function inList(ids: string[]): string {
  return ids.map(encodeURIComponent).join(",");
}

/** Credits back every refundable, paid, still-unresolved match in `matchIds`.
 *  Safe to call repeatedly from any trigger: eligibility is re-checked and the
 *  ledger's unique index on refunded matches makes the credit land once. */
export async function creditRefundForMatches(p: RefundParams): Promise<RefundResult> {
  const f = p.fetchImpl ?? fetch;
  const notifyFn = p.notifyImpl ?? defaultNotify;
  const result: RefundResult = { credited: [] };
  const ids = Array.from(new Set(p.matchIds)).slice(0, 200);
  if (ids.length === 0) return result;

  try {
    const matchRes = await f(
      `${p.base}/rest/v1/requirement_matches?id=in.(${inList(ids)})&unlocked=eq.true&select=id,candidate_status`,
      { headers: p.headers },
    );
    if (!matchRes.ok) return result;
    const matches = (await matchRes.json().catch(() => [])) as Array<{ id: string; candidate_status: string | null }>;
    const eligible = matches.filter((m) => isRefundableStatus(m.candidate_status));
    if (eligible.length === 0) return result;
    const eligibleIds = eligible.map((m) => m.id);

    const employerFilter = p.employerId ? `&employer_id=eq.${encodeURIComponent(p.employerId)}` : "";
    const orderRes = await f(
      `${p.base}/rest/v1/employer_unlock_orders?status=in.(fulfilled,partial)&match_ids=ov.{${eligibleIds.join(",")}}${employerFilter}` +
        `&select=razorpay_order_id,employer_id,amount,match_ids&order=created_at.desc&limit=400`,
      { headers: p.headers },
    );
    if (!orderRes.ok) return result;
    const orders = (await orderRes.json().catch(() => [])) as PaidOrder[];
    if (orders.length === 0) return result;

    const spentByEmployer = new Map<string, Map<string, number>>();
    for (const employerId of new Set(orders.map((o) => o.employer_id))) {
      const refs = orders.filter((o) => o.employer_id === employerId).map((o) => o.razorpay_order_id);
      const spent = await creditSpentOnOrders(p.base, p.headers, employerId, refs, f);
      if (!spent) return result;
      spentByEmployer.set(employerId, spent);
    }

    for (const matchId of eligibleIds) {
      const order = orders.find((o) => o.match_ids.includes(matchId));
      if (!order) continue;
      const amountPaise = creditShare(order.amount, spentByEmployer.get(order.employer_id)?.get(order.razorpay_order_id) ?? 0, order.match_ids.length);
      if (amountPaise <= 0) continue;

      const ins = await f(`${p.base}/rest/v1/employer_credit_ledger`, {
        method: "POST",
        headers: { ...p.headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ employer_id: order.employer_id, amount: amountPaise, kind: "refund", reason: p.reason, match_id: matchId, order_ref: order.razorpay_order_id }),
      });
      if (ins.ok) result.credited.push({ employerId: order.employer_id, matchId, amountPaise });
      else if (ins.status !== 409 && !isMissing(ins.status, await ins.text().catch(() => ""))) {
        slog.error("credit refund insert failed", { status: ins.status, matchId });
      }
    }

    const byEmployer = new Map<string, { total: number; count: number }>();
    for (const c of result.credited) {
      const cur = byEmployer.get(c.employerId) ?? { total: 0, count: 0 };
      cur.total += c.amountPaise;
      cur.count += 1;
      byEmployer.set(c.employerId, cur);
    }
    for (const [employerId, s] of byEmployer) {
      void notifyFn({
        userId: employerId,
        type: "credit_refunded",
        title: "Credit added to your account",
        body: `${s.count === 1 ? "A candidate you unlocked can't be reached" : `${s.count} candidates you unlocked can't be reached`} (${creditReasonLabel(p.reason).toLowerCase()}). ₹${(s.total / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })} was added as credit and applies to your next unlock.`,
        link: "/employer/settings",
        groupKey: `credit_refunded:${employerId}`,
      });
    }
  } catch (err) {
    slog.error("credit refund threw", { reason: p.reason, err: err instanceof Error ? err.message : String(err) });
  }
  return result;
}

/** Credit spent on a paid order comes straight back when some of its
 *  candidates could not be unlocked (the cash share stays with the existing
 *  refund-owed path). Idempotent: one refund row per match. */
export async function returnCreditForUnavailable(p: {
  base: string; headers: Headers; employerId: string; orderRef: string; orderMatchCount: number; failedMatchIds: string[]; fetchImpl?: typeof fetch;
}): Promise<number> {
  const f = p.fetchImpl ?? fetch;
  if (p.failedMatchIds.length === 0 || p.orderMatchCount <= 0) return 0;
  try {
    const spent = (await creditSpentOnOrders(p.base, p.headers, p.employerId, [p.orderRef], f))?.get(p.orderRef) ?? 0;
    const share = creditShare(0, spent, p.orderMatchCount);
    if (share <= 0) return 0;
    let returned = 0;
    for (const matchId of p.failedMatchIds) {
      const ins = await f(`${p.base}/rest/v1/employer_credit_ledger`, {
        method: "POST",
        headers: { ...p.headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ employer_id: p.employerId, amount: share, kind: "refund", reason: "unavailable", match_id: matchId, order_ref: p.orderRef }),
      });
      if (ins.ok) returned += share;
      else if (ins.status !== 409) slog.error("credit return insert failed", { status: ins.status, matchId });
    }
    return returned;
  } catch (err) {
    slog.error("credit return threw", { orderRef: p.orderRef, err: err instanceof Error ? err.message : String(err) });
    return 0;
  }
}

/** Unlocked match ids one candidate shares with one employer, for block/report triggers. */
export async function matchIdsForEmployerCandidate(
  base: string, headers: Headers, employerId: string, candidateUserId: string, f: typeof fetch = fetch,
): Promise<string[]> {
  try {
    const res = await f(
      `${base}/rest/v1/requirement_matches?candidate_user_id=eq.${encodeURIComponent(candidateUserId)}&unlocked=eq.true` +
        `&select=id,employer_requirements!inner(employer_id)&employer_requirements.employer_id=eq.${encodeURIComponent(employerId)}&limit=200`,
      { headers },
    );
    if (!res.ok) return [];
    const rows = (await res.json().catch(() => [])) as Array<{ id: string }>;
    return Array.isArray(rows) ? rows.map((r) => r.id) : [];
  } catch {
    return [];
  }
}

/** Every unlocked match of a candidate, across employers, for the visibility-off trigger. */
export async function unlockedMatchIdsForCandidate(
  base: string, headers: Headers, candidateUserId: string, f: typeof fetch = fetch,
): Promise<string[]> {
  try {
    const res = await f(
      `${base}/rest/v1/requirement_matches?candidate_user_id=eq.${encodeURIComponent(candidateUserId)}&unlocked=eq.true&select=id&limit=500`,
      { headers },
    );
    if (!res.ok) return [];
    const rows = (await res.json().catch(() => [])) as Array<{ id: string }>;
    return Array.isArray(rows) ? rows.map((r) => r.id) : [];
  } catch {
    return [];
  }
}

/* ── History ── */

export interface CreditEvent {
  kind: "refund" | "spend" | "release";
  amountPaise: number;
  reason: CreditReason | null;
  label: string;
  createdAt: string;
}

export function toCreditEvents(rows: CreditRow[]): CreditEvent[] {
  return rows.map((r) => ({
    kind: r.kind,
    amountPaise: r.amount,
    reason: r.reason,
    label: r.kind === "refund" ? creditReasonLabel(r.reason) : r.kind === "spend" ? "Applied to an unlock" : "Returned: unlock not completed",
    createdAt: r.created_at,
  }));
}

export async function loadCreditRows(base: string, headers: Headers, employerId: string, f: typeof fetch = fetch): Promise<CreditRow[] | null> {
  try {
    const res = await f(
      `${base}/rest/v1/employer_credit_ledger?employer_id=eq.${encodeURIComponent(employerId)}&select=amount,kind,reason,match_id,order_ref,created_at&order=created_at.desc&limit=500`,
      { headers },
    );
    if (!res.ok) return null;
    const rows = (await res.json().catch(() => null)) as CreditRow[] | null;
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  }
}
