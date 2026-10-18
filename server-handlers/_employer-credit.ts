/* Employer credit: pay-as-you-go refunds that come back as platform credit.
 *
 * When a candidate an employer paid for turns out to be unreachable (declines,
 * withdraws, blocks the company, or never answers an interview invite) the
 * unlock price of that candidate is credited back, once, and applied to the
 * employer's next unlock. It is NOT a Razorpay cash refund. The match is
 * RELOCKED when the credit lands: money back means the contact is no longer
 * the employer's, so a candidate can't be both refunded and still reachable.
 * (A candidate who later turns visibility back on stays locked until the
 * employer pays again; one refund per match, ever, via the unique index.)
 *
 * Money model: employer_credit_ledger holds signed paise rows; balance = sum.
 * Kinds: refund (+), spend (-), release (+, an unfinished order's spend coming
 * back), clawback (-, credit reversed because the Razorpay payment behind it
 * was refunded or lost in a dispute), conversion (+, a captured payment that
 * could not fulfil its order, kept as credit). A clawback can land after the
 * credit was already spent, so the balance MAY GO NEGATIVE: that is a debt the
 * employer works off, spending is blocked until the sum is positive again and
 * the UI shows a clamped balance. Clawbacks are never skipped to avoid it.
 * Pure rules (eligibility, share value, how much credit to apply) live at the
 * top of this file; the I/O below uses plain PostgREST fetches so it runs on
 * both the edge (candidate handlers) and Node (cron, order creation). Every
 * function tolerates migration 0041 being unapplied and never throws into the
 * caller's primary action.
 */

import { slog } from "./_shared";
import { notify as defaultNotify, type NotifyInput } from "./_notify";
import { captureServerEvent } from "./_posthog";

export type CreditReason =
  | "declined" | "withdrew" | "blocked" | "no_response" | "unavailable"
  | "payment_refunded" | "payment_disputed" | "late_payment" | "employer_suspended";
/** Reasons where the candidate acted after the employer may already have engaged:
 *  an employer who messaged them got what the unlock pays for. */
const MESSAGE_SKIP_REASONS: ReadonlySet<string> = new Set(["declined", "withdrew", "blocked"]);
/** Suffix of the ledger ref for credit re-spent on an order paid after it expired. */
const LATE_SUFFIX = ":late";

/** Days an interview invite may go unanswered before the unlock is credited back. */
export const NO_RESPONSE_DAYS = 14;
/** Only candidates the employer is still waiting on are refundable. Once an
 *  interview is underway, hired, or the employer passed, the unlock delivered. */
const REFUNDABLE_STATUSES: ReadonlySet<string> = new Set(["shortlisted", "interview_invited"]);

export function isRefundableStatus(status: string | null | undefined): boolean {
  return REFUNDABLE_STATUSES.has(status ?? "shortlisted");
}

/** Splits `totalPaise` into `count` whole-paise shares that add up to the total exactly.
 *  Largest-remainder: every share is floor(total / count) and the leftover paise go one each
 *  to the first shares (all fractional parts are equal, so ties break by position). A plain
 *  floor lost up to count-1 paise per order and Math.round could overshoot it. */
export function splitPaise(totalPaise: number, count: number): number[] {
  if (count <= 0) return [];
  const total = Math.max(0, Math.floor(totalPaise));
  const base = Math.floor(total / count);
  const extra = total - base * count;
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0));
}

/** Paise credited for the candidate at `index` of a paid order: their share of
 *  everything the employer paid for it, cash and credit alike. The shares of all
 *  `matchCount` candidates (index 0..matchCount-1) sum to cash + credit exactly. */
export function creditShare(orderCashPaise: number, creditSpentPaise: number, matchCount: number, index = 0): number {
  if (matchCount <= 0) return 0;
  return splitPaise(orderCashPaise + creditSpentPaise, matchCount)[Math.min(Math.max(0, index), matchCount - 1)] ?? 0;
}

export function creditReasonLabel(reason: CreditReason | string | null | undefined): string {
  switch (reason) {
    case "declined": return "Candidate declined";
    case "withdrew": return "Candidate withdrew";
    case "blocked": return "Candidate blocked your company";
    case "no_response": return `No reply within ${NO_RESPONSE_DAYS} days`;
    case "unavailable": return "Candidate unavailable at unlock";
    case "payment_refunded": return "Payment refunded";
    case "payment_disputed": return "Payment disputed";
    case "late_payment": return "Late payment kept as credit";
    case "employer_suspended": return "Account suspended at unlock";
    default: return "Credit";
  }
}

export type CreditKind = "refund" | "spend" | "release" | "clawback" | "conversion";

export interface CreditRow {
  amount: number;
  kind: CreditKind;
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

const BALANCE_PAGE = 1000;
/** Ceiling on pages read (1M ledger rows); beyond it the balance is unknown, not truncated. */
const BALANCE_MAX_PAGES = 1000;

/** Current balance in paise. null when the ledger is unavailable (callers treat that as no credit).
 *  Keyset-pages by id so every row is counted: an unordered capped read would
 *  silently under- or over-state the balance once a ledger outgrows the cap. */
export async function creditBalance(base: string, headers: Headers, employerId: string, f: typeof fetch = fetch): Promise<number | null> {
  try {
    let total = 0;
    let cursor: string | null = null;
    for (let page = 0; page < BALANCE_MAX_PAGES; page += 1) {
      const res: Response = await f(
        `${base}/rest/v1/employer_credit_ledger?employer_id=eq.${encodeURIComponent(employerId)}&select=id,amount&order=id.asc&limit=${BALANCE_PAGE}` +
          (cursor !== null ? `&id=gt.${encodeURIComponent(cursor)}` : ""),
        { headers },
      );
      if (!res.ok) {
        if (!isMissing(res.status, await res.text().catch(() => ""))) slog.error("credit balance read failed", { status: res.status });
        return null;
      }
      const rows = (await res.json().catch(() => null)) as Array<{ id?: string; amount: number }> | null;
      if (!Array.isArray(rows)) return null;
      for (const r of rows) total += Number.isInteger(r.amount) ? r.amount : 0;
      if (rows.length < BALANCE_PAGE) return total;
      const last = rows[rows.length - 1].id;
      if (typeof last !== "string") return null;
      cursor = last;
    }
    slog.error("credit balance exceeded page ceiling", { employerId });
    return null;
  } catch {
    return null;
  }
}

export type SpendOutcome = { spent: number; outcome: "spent" | "insufficient" | "error" };

/** Atomically spends credit for `orderRef` (idempotent per ref in the RPC).
 *  A transport/HTTP failure is not trusted: the RPC may have committed before
 *  the response was lost, so the ledger is re-read for an existing spend row
 *  before this reports failure. */
export async function spendCreditDetailed(
  base: string, headers: Headers, employerId: string, amountPaise: number, orderRef: string, f: typeof fetch = fetch,
): Promise<SpendOutcome> {
  if (amountPaise <= 0) return { spent: 0, outcome: "insufficient" };
  try {
    const res = await f(`${base}/rest/v1/rpc/spend_employer_credit`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ p_employer: employerId, p_amount: amountPaise, p_order_ref: orderRef }),
    });
    if (res.ok) {
      const n = await res.json().catch(() => 0);
      const spent = typeof n === "number" && n > 0 ? n : 0;
      return { spent, outcome: spent > 0 ? "spent" : "insufficient" };
    }
    slog.error("credit spend failed", { status: res.status, orderRef });
  } catch { /* fall through to the ledger re-check */ }
  const existing = (await creditSpentOnOrders(base, headers, employerId, [orderRef], f))?.get(orderRef) ?? 0;
  return existing > 0 ? { spent: existing, outcome: "spent" } : { spent: 0, outcome: "error" };
}

/** Paise spent (0 on insufficient balance or failure). Callers that must tell those apart use spendCreditDetailed. */
export async function spendCredit(
  base: string, headers: Headers, employerId: string, amountPaise: number, orderRef: string, f: typeof fetch = fetch,
): Promise<number> {
  return (await spendCreditDetailed(base, headers, employerId, amountPaise, orderRef, f)).spent;
}

/** Net credit spent per physical ledger ref (spend minus anything released). null on a read failure. */
async function ledgerSpentByRef(
  base: string, headers: Headers, employerId: string, refs: string[], f: typeof fetch,
): Promise<Map<string, number> | null> {
  const out = new Map<string, number>();
  if (refs.length === 0) return out;
  try {
    const list = refs.map((r) => encodeURIComponent(`"${r}"`)).join(",");
    const res = await f(
      `${base}/rest/v1/employer_credit_ledger?employer_id=eq.${encodeURIComponent(employerId)}&kind=in.(spend,release)&order_ref=in.(${list})&select=amount,order_ref`,
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

/** Net credit spent per order, in paise, folding in credit re-spent after the
 *  order expired (`<ref>:late`). null on a read failure. */
export async function creditSpentOnOrders(
  base: string, headers: Headers, employerId: string, orderRefs: string[], f: typeof fetch = fetch,
): Promise<Map<string, number> | null> {
  if (orderRefs.length === 0) return new Map();
  const physical = await ledgerSpentByRef(base, headers, employerId, orderRefs.flatMap((r) => [r, `${r}${LATE_SUFFIX}`]), f);
  if (!physical) return null;
  const out = new Map<string, number>();
  for (const ref of orderRefs) {
    const net = (physical.get(ref) ?? 0) + (physical.get(`${ref}${LATE_SUFFIX}`) ?? 0);
    if (physical.has(ref) || physical.has(`${ref}${LATE_SUFFIX}`)) out.set(ref, net);
  }
  return out;
}

/** Returns credit spent on an order that never completed. Idempotent: one
 *  release per physical spend (the original and the late re-spend each get theirs). */
export async function releaseCredit(
  base: string, headers: Headers, employerId: string, orderRef: string, f: typeof fetch = fetch,
): Promise<void> {
  try {
    const refs = [orderRef, `${orderRef}${LATE_SUFFIX}`];
    const physical = await ledgerSpentByRef(base, headers, employerId, refs, f);
    if (!physical) return;
    for (const ref of refs) {
      const spent = physical.get(ref) ?? 0;
      if (spent <= 0) continue;
      const res = await f(`${base}/rest/v1/employer_credit_ledger`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ employer_id: employerId, amount: spent, kind: "release", order_ref: ref }),
      });
      if (!res.ok && res.status !== 409) slog.error("credit release failed", { status: res.status, orderRef: ref });
    }
  } catch (err) {
    slog.error("credit release threw", { orderRef, err: err instanceof Error ? err.message : String(err) });
  }
}

/** The credit an order was priced with (migration 0042), null when unknown or the column is absent. */
export async function loadOrderCreditApplied(
  base: string, headers: Headers, orderRef: string, f: typeof fetch = fetch,
): Promise<number | null> {
  try {
    const res = await f(
      `${base}/rest/v1/employer_unlock_orders?razorpay_order_id=eq.${encodeURIComponent(orderRef)}&select=credit_applied_paise`,
      { headers },
    );
    if (!res.ok) return null;
    const rows = (await res.json().catch(() => null)) as Array<{ credit_applied_paise?: number | null }> | null;
    const v = Array.isArray(rows) ? rows[0]?.credit_applied_paise : null;
    return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
  } catch {
    return null;
  }
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

async function insertLedger(
  base: string, headers: Headers, row: Record<string, unknown>, f: typeof fetch,
): Promise<"inserted" | "duplicate" | "unsupported" | "error"> {
  const ins = await f(`${base}/rest/v1/employer_credit_ledger`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (ins.ok) return "inserted";
  if (ins.status === 409) return "duplicate";
  const text = await ins.text().catch(() => "");
  if (isMissing(ins.status, text)) return "unsupported";
  // Migration 0042 (clawback/conversion kinds) not applied yet: a check-constraint violation.
  if (ins.status === 400 && /23514|check constraint|violates/i.test(text)) return "unsupported";
  slog.error("credit ledger insert failed", { status: ins.status, kind: row.kind });
  return "error";
}

/* ── Clawback (payment refunded / lost in a dispute) ── */

export interface ClawbackParams {
  base: string;
  headers: Headers;
  order: { razorpay_order_id: string; employer_id: string; requirement_id?: string | null };
  reason: "payment_refunded" | "payment_disputed";
  /** Full cash refund: also give back the credit that was spent on the order. */
  releaseSpent: boolean;
  fetchImpl?: typeof fetch;
}

export interface ClawbackResult {
  /** false when a write failed and the caller should let the event be redelivered. */
  ok: boolean;
  clawedBackPaise: number;
  rows: number;
}

/** Reverses the credit an order generated (per-candidate refund rows, including
 *  'unavailable' returns, and a late-payment conversion). Idempotent: every
 *  clawback has its own synthetic ref under a unique index. */
export async function clawbackOrderCredit(p: ClawbackParams): Promise<ClawbackResult> {
  const f = p.fetchImpl ?? fetch;
  const ref = p.order.razorpay_order_id;
  const employerId = p.order.employer_id;
  const result: ClawbackResult = { ok: true, clawedBackPaise: 0, rows: 0 };
  try {
    const res = await f(
      `${p.base}/rest/v1/employer_credit_ledger?employer_id=eq.${encodeURIComponent(employerId)}` +
        `&order_ref=in.(${encodeURIComponent(`"${ref}"`)},${encodeURIComponent(`"${ref}:convert"`)})&kind=in.(refund,conversion)&select=amount,match_id,order_ref`,
      { headers: p.headers },
    );
    if (!res.ok) {
      if (isMissing(res.status, await res.text().catch(() => ""))) return result;
      return { ...result, ok: false };
    }
    const rows = (await res.json().catch(() => null)) as Array<{ amount: number; match_id: string | null }> | null;
    if (!Array.isArray(rows)) return { ...result, ok: false };

    for (const row of rows) {
      if (!Number.isInteger(row.amount) || row.amount <= 0) continue;
      const state = await insertLedger(p.base, p.headers, {
        employer_id: employerId, amount: -row.amount, kind: "clawback", reason: p.reason,
        match_id: row.match_id, order_ref: `clawback:${ref}:${row.match_id ?? "convert"}`,
      }, f);
      if (state === "inserted") { result.clawedBackPaise += row.amount; result.rows += 1; }
      else if (state === "unsupported") {
        slog.error("credit clawback skipped: migration 0042 not applied — reverse this credit manually", {
          code: "credit_clawback_unsupported", orderId: ref, employerId, amountPaise: row.amount,
        });
      } else if (state === "error") result.ok = false;
    }
    if (p.releaseSpent) await releaseCredit(p.base, p.headers, employerId, ref, f);
  } catch (err) {
    slog.error("credit clawback threw", { orderId: ref, err: err instanceof Error ? err.message : String(err) });
    return { ...result, ok: false };
  }
  if (result.rows > 0) {
    slog.warn("employer credit clawed back", { code: "credit_clawed_back", orderId: ref, employerId, reason: p.reason, paise: result.clawedBackPaise });
    void captureServerEvent("employer_credit_clawed_back", employerId, {
      requirementId: p.order.requirement_id ?? null, orderId: ref, amountPaise: result.clawedBackPaise, reason: p.reason,
    });
  }
  return result;
}

/* ── Late payment (order expired, credit released, then the cash arrived) ── */

export type EnsureCreditResult =
  | { state: "ok"; creditSpentPaise: number }
  | { state: "converted"; creditPaise: number }
  | { state: "error" };

/** Before a captured cash payment fulfils its order, verifies the credit the
 *  order was priced with is really spent. A reconciler-expired order released
 *  that credit, so it is re-spent (ref `<order>:late`). If the balance can no
 *  longer cover it, fulfilling would hand out candidates for less than the
 *  price: instead the order is left unfulfilled and the cash payment is kept as
 *  credit (conversion row) with any partial spend released, so the employer is
 *  made whole and can unlock again. Orders without a stored credit_applied_paise
 *  (legacy / migration unapplied) are not checked: deriving it from today's
 *  price could wrongly block a legitimately paid order. */
export async function ensureCreditSpent(p: {
  base: string; headers: Headers;
  order: { razorpay_order_id: string; employer_id: string; amount: number; requirement_id?: string | null };
  fetchImpl?: typeof fetch;
}): Promise<EnsureCreditResult> {
  const f = p.fetchImpl ?? fetch;
  const ref = p.order.razorpay_order_id;
  const employerId = p.order.employer_id;
  const intended = await loadOrderCreditApplied(p.base, p.headers, ref, f);
  if (!intended) return { state: "ok", creditSpentPaise: 0 };

  const spentMap = await creditSpentOnOrders(p.base, p.headers, employerId, [ref], f);
  if (!spentMap) return { state: "error" };
  const spent = spentMap.get(ref) ?? 0;
  if (spent >= intended) return { state: "ok", creditSpentPaise: spent };

  const late = await spendCreditDetailed(p.base, p.headers, employerId, intended - spent, `${ref}${LATE_SUFFIX}`, f);
  if (late.outcome === "spent") {
    void captureServerEvent("employer_credit_spent", employerId, { orderId: ref, amountPaise: late.spent, late: true });
    return { state: "ok", creditSpentPaise: spent + late.spent };
  }
  if (late.outcome === "error") return { state: "error" };

  if (p.order.amount <= 0) return { state: "error" };
  const state = await insertLedger(p.base, p.headers, {
    employer_id: employerId, amount: p.order.amount, kind: "conversion", reason: "late_payment", order_ref: `${ref}:convert`,
  }, f);
  if (state === "error" || state === "unsupported") {
    slog.error("late unlock payment could not be fulfilled or converted to credit — manual refund needed", {
      code: "unlock_late_payment_unresolved", orderId: ref, employerId, cashPaise: p.order.amount, creditShortfallPaise: intended - spent,
    });
    return { state: "error" };
  }
  await releaseCredit(p.base, p.headers, employerId, ref, f);
  slog.error("late unlock payment converted to credit — credit it relied on is no longer available", {
    code: "unlock_late_payment_converted", orderId: ref, employerId, cashPaise: p.order.amount, creditShortfallPaise: intended - spent,
  });
  void captureServerEvent("employer_credit_granted", employerId, {
    requirementId: p.order.requirement_id ?? null, orderId: ref, amountPaise: p.order.amount, reason: "late_payment",
  });
  return { state: "converted", creditPaise: p.order.amount };
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
  /** Matches left uncredited because the employer already messaged the candidate. */
  skippedEmployerMessaged?: string[];
}

function inList(ids: string[]): string {
  return ids.map(encodeURIComponent).join(",");
}

/** Takes the contact back: money returned means the employer no longer holds it. */
export async function relockMatches(base: string, headers: Headers, matchIds: string[], f: typeof fetch = fetch): Promise<boolean> {
  if (matchIds.length === 0) return true;
  const url = `${base}/rest/v1/requirement_matches?id=in.(${inList(matchIds)})&unlocked=eq.true`;
  const patchHeaders = { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" };
  try {
    const full = await f(url, {
      method: "PATCH", headers: patchHeaders,
      body: JSON.stringify({ unlocked: false, unlocked_at: null, unlocked_candidate_name: null, unlocked_candidate_email: null }),
    });
    if (full.ok) return true;
    // Snapshot columns may be missing on older schemas (migration 0026); the relock itself must still happen.
    const core = await f(url, { method: "PATCH", headers: patchHeaders, body: JSON.stringify({ unlocked: false, unlocked_at: null }) });
    return core.ok;
  } catch {
    return false;
  }
}

/** Matches whose conversation holds a message from the employer. null when the
 *  read fails: the caller must then credit nothing, because crediting a match
 *  the employer did reach would pay out for a candidate they are talking to. */
async function matchesEmployerMessaged(base: string, headers: Headers, matchIds: string[], f: typeof fetch): Promise<Set<string> | null> {
  const messaged = new Set<string>();
  if (matchIds.length === 0) return messaged;
  try {
    const convRes = await f(`${base}/rest/v1/conversations?match_id=in.(${inList(matchIds)})&select=id,match_id`, { headers });
    if (!convRes.ok) {
      slog.error("credit reachability read failed", { code: "credit_reachability_read_failed", stage: "conversations", status: convRes.status });
      return null;
    }
    const convs = (await convRes.json().catch(() => null)) as Array<{ id: string; match_id: string }> | null;
    if (!Array.isArray(convs)) return null;
    if (convs.length === 0) return messaged;
    const msgRes = await f(
      `${base}/rest/v1/conversation_messages?conversation_id=in.(${convs.map((c) => encodeURIComponent(c.id)).join(",")})&sender_role=eq.employer&select=conversation_id&limit=1000`,
      { headers },
    );
    if (!msgRes.ok) {
      slog.error("credit reachability read failed", { code: "credit_reachability_read_failed", stage: "messages", status: msgRes.status });
      return null;
    }
    const msgs = (await msgRes.json().catch(() => null)) as Array<{ conversation_id: string }> | null;
    if (!Array.isArray(msgs)) return null;
    if (msgs.length >= 1000) {
      // A capped read could hide the employer's message; treat as unknown rather than reachable-or-not.
      slog.error("credit reachability read truncated", { code: "credit_reachability_read_failed", stage: "messages_truncated" });
      return null;
    }
    const convToMatch = new Map(convs.map((c) => [c.id, c.match_id]));
    for (const m of msgs) {
      const matchId = convToMatch.get(m.conversation_id);
      if (matchId) messaged.add(matchId);
    }
  } catch (err) {
    slog.error("credit reachability read threw", { code: "credit_reachability_read_failed", err: err instanceof Error ? err.message : String(err) });
    return null;
  }
  return messaged;
}

const ABUSE_WINDOW_DAYS = 30;
const ABUSE_MIN_REFUNDS = 3;
const ABUSE_SHARE = 0.6;

/** Soft abuse signal: an employer whose refund credit over 30 days exceeds 60%
 *  of their cash spend (and has 3+ refunds). Credit is still granted — this only
 *  slog.warns so support can look. Never throws. */
export async function flagCreditAbuse(p: {
  base: string; headers: Headers; employerId: string; now?: Date; fetchImpl?: typeof fetch;
}): Promise<boolean> {
  const f = p.fetchImpl ?? fetch;
  const since = encodeURIComponent(new Date((p.now ?? new Date()).getTime() - ABUSE_WINDOW_DAYS * 86_400_000).toISOString());
  const emp = encodeURIComponent(p.employerId);
  try {
    const [credRes, payRes] = await Promise.all([
      f(`${p.base}/rest/v1/employer_credit_ledger?employer_id=eq.${emp}&kind=eq.refund&created_at=gte.${since}&select=amount&limit=1000`, { headers: p.headers }),
      f(`${p.base}/rest/v1/employer_unlock_payments?employer_id=eq.${emp}&refunded_at=is.null&created_at=gte.${since}&select=amount&limit=1000`, { headers: p.headers }),
    ]);
    if (!credRes.ok || !payRes.ok) return false;
    const cred = (await credRes.json().catch(() => null)) as Array<{ amount: number }> | null;
    const pay = (await payRes.json().catch(() => null)) as Array<{ amount: number }> | null;
    if (!Array.isArray(cred) || !Array.isArray(pay)) return false;
    const credited = cred.reduce((n, r) => n + (r.amount || 0), 0);
    const paid = pay.reduce((n, r) => n + (r.amount || 0), 0);
    if (cred.length < ABUSE_MIN_REFUNDS || credited <= paid * ABUSE_SHARE) return false;
    slog.warn("employer credit refunds exceed 60% of paid spend over 30 days — review for decline abuse", {
      code: "employer_credit_abuse_flag", employerId: p.employerId, refunds: cred.length, creditedPaise: credited, paidPaise: paid,
    });
    return true;
  } catch {
    return false;
  }
}

/** Credits back every refundable, paid, still-unresolved match in `matchIds`.
 *  Safe to call repeatedly from any trigger: eligibility is re-checked and the
 *  ledger's unique index on refunded matches makes the credit land once. When
 *  credit lands the match is relocked. Not applied for reports (see
 *  candidate-employer-actions): only decline / withdraw / block / no-reply. */
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
    let eligibleIds = eligible.map((m) => m.id);

    if (MESSAGE_SKIP_REASONS.has(p.reason)) {
      const messaged = await matchesEmployerMessaged(p.base, p.headers, eligibleIds, f);
      // Fail closed: the next trigger (or the daily sweep) retries once reads recover.
      if (!messaged) return result;
      if (messaged.size > 0) {
        result.skippedEmployerMessaged = eligibleIds.filter((id) => messaged.has(id));
        eligibleIds = eligibleIds.filter((id) => !messaged.has(id));
        if (eligibleIds.length === 0) return result;
      }
    }

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

    const toRelock: string[] = [];
    for (const matchId of eligibleIds) {
      const order = orders.find((o) => o.match_ids.includes(matchId));
      if (!order) continue;
      const amountPaise = creditShare(
        order.amount, spentByEmployer.get(order.employer_id)?.get(order.razorpay_order_id) ?? 0, order.match_ids.length, order.match_ids.indexOf(matchId),
      );
      if (amountPaise <= 0) continue;

      const state = await insertLedger(p.base, p.headers, {
        employer_id: order.employer_id, amount: amountPaise, kind: "refund", reason: p.reason, match_id: matchId, order_ref: order.razorpay_order_id,
      }, f);
      if (state === "inserted") {
        result.credited.push({ employerId: order.employer_id, matchId, amountPaise });
        toRelock.push(matchId);
      } else if (state === "duplicate") {
        // Credit already landed; finish a relock that a crash may have skipped, but only
        // when the existing refund belongs to THIS order (a repurchased match is live again).
        const prior = await f(`${p.base}/rest/v1/employer_credit_ledger?match_id=eq.${encodeURIComponent(matchId)}&kind=eq.refund&select=order_ref&limit=1`, { headers: p.headers });
        const rows = prior.ok ? ((await prior.json().catch(() => [])) as Array<{ order_ref: string | null }>) : [];
        if (Array.isArray(rows) && rows[0]?.order_ref === order.razorpay_order_id) toRelock.push(matchId);
      }
    }

    if (toRelock.length > 0 && !(await relockMatches(p.base, p.headers, toRelock, f))) {
      slog.error("credit refunded but relock failed — will retry on the next trigger", { code: "credit_relock_failed", matchIds: toRelock });
    }

    const byEmployer = new Map<string, { total: number; count: number }>();
    for (const c of result.credited) {
      const cur = byEmployer.get(c.employerId) ?? { total: 0, count: 0 };
      cur.total += c.amountPaise;
      cur.count += 1;
      byEmployer.set(c.employerId, cur);
    }
    for (const [employerId, s] of byEmployer) {
      void captureServerEvent("employer_credit_granted", employerId, { amountPaise: s.total, matches: s.count, reason: p.reason });
      void notifyFn({
        userId: employerId,
        type: "credit_refunded",
        title: "Credit added to your account",
        body: `${s.count === 1 ? "A candidate you unlocked can't be reached" : `${s.count} candidates you unlocked can't be reached`} (${creditReasonLabel(p.reason).toLowerCase()}). ${rupees(s.total)} was added as credit and applies to your next unlock; their contact details are locked again.`,
        link: "/employer/settings",
        groupKey: `credit_refunded:${employerId}`,
      });
      await flagCreditAbuse({ base: p.base, headers: p.headers, employerId, fetchImpl: f });
    }
  } catch (err) {
    slog.error("credit refund threw", { reason: p.reason, err: err instanceof Error ? err.message : String(err) });
  }
  return result;
}

export interface UnavailableReturn {
  /** false when a read or write failed: the caller must leave the order retriable. */
  ok: boolean;
  /** Paise newly credited by this call (0 on a replay). */
  returnedPaise: number;
  /** Paise credited on the order for these matches in total, whichever call wrote them. */
  creditedPaise: number;
}

/** Candidates that could not be unlocked after payment: their full share of
 *  what was paid on the order, CREDIT SPENT AND CASH, comes back as credit
 *  automatically, so the cash share no longer depends on support reading a log
 *  line. Idempotent (one refund row per match) and safe to re-run until `ok`.
 *  `orderMatchIds` fixes each match's position in the largest-remainder split so
 *  a retry computes the same share. `reason` defaults to "unavailable". */
export async function returnCreditForUnavailableDetailed(p: {
  base: string; headers: Headers; employerId: string; orderRef: string; orderMatchCount: number; failedMatchIds: string[];
  orderMatchIds?: string[];
  /** Cash paid on the order (employer_unlock_orders.amount). */
  orderCashPaise?: number;
  reason?: "unavailable" | "employer_suspended";
  fetchImpl?: typeof fetch;
}): Promise<UnavailableReturn> {
  const f = p.fetchImpl ?? fetch;
  if (p.failedMatchIds.length === 0 || p.orderMatchCount <= 0) return { ok: true, returnedPaise: 0, creditedPaise: 0 };
  try {
    const spentMap = await creditSpentOnOrders(p.base, p.headers, p.employerId, [p.orderRef], f);
    // An unreadable ledger must not be mistaken for "no credit was spent": that would under-credit.
    if (!spentMap) return { ok: false, returnedPaise: 0, creditedPaise: 0 };
    const shares = splitPaise((p.orderCashPaise ?? 0) + (spentMap.get(p.orderRef) ?? 0), p.orderMatchCount);
    let returned = 0;
    let ok = true;
    for (let i = 0; i < p.failedMatchIds.length; i += 1) {
      const matchId = p.failedMatchIds[i];
      const pos = p.orderMatchIds?.indexOf(matchId) ?? -1;
      const share = shares[pos >= 0 ? pos : i] ?? 0;
      if (share <= 0) continue;
      const row = { employer_id: p.employerId, amount: share, kind: "refund", match_id: matchId, order_ref: p.orderRef };
      let state = await insertLedger(p.base, p.headers, { ...row, reason: p.reason ?? "unavailable" }, f);
      // Migration 0047 (the employer_suspended reason) not applied: a plain "unavailable" credit is better than none.
      if (state === "unsupported" && p.reason === "employer_suspended") {
        state = await insertLedger(p.base, p.headers, { ...row, reason: "unavailable" }, f);
      }
      if (state === "inserted") returned += share;
      else if (state === "error") ok = false;
    }
    // What the ledger now holds for THESE matches under THIS order (a duplicate may belong to another order).
    let credited = returned;
    const idList = p.failedMatchIds.map(encodeURIComponent).join(",");
    const back = await f(
      `${p.base}/rest/v1/employer_credit_ledger?employer_id=eq.${encodeURIComponent(p.employerId)}&kind=eq.refund` +
        `&order_ref=eq.${encodeURIComponent(p.orderRef)}&match_id=in.(${idList})&select=amount`,
      { headers: p.headers },
    );
    if (back.ok) {
      const rows = (await back.json().catch(() => null)) as Array<{ amount: number }> | null;
      if (Array.isArray(rows)) credited = rows.reduce((n, r) => n + (Number.isInteger(r.amount) ? r.amount : 0), 0);
      else ok = false;
    } else if (!isMissing(back.status, await back.text().catch(() => ""))) ok = false;
    if (returned > 0) {
      void captureServerEvent("employer_credit_granted", p.employerId, { orderId: p.orderRef, amountPaise: returned, matches: p.failedMatchIds.length, reason: p.reason ?? "unavailable" });
    }
    return { ok, returnedPaise: returned, creditedPaise: credited };
  } catch (err) {
    slog.error("credit return threw", { orderRef: p.orderRef, err: err instanceof Error ? err.message : String(err) });
    return { ok: false, returnedPaise: 0, creditedPaise: 0 };
  }
}

/** Paise newly returned by this call; see returnCreditForUnavailableDetailed for the retriable form. */
export async function returnCreditForUnavailable(p: Parameters<typeof returnCreditForUnavailableDetailed>[0]): Promise<number> {
  return (await returnCreditForUnavailableDetailed(p)).returnedPaise;
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
  kind: CreditKind;
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
    label: r.kind === "refund" || r.kind === "clawback" || r.kind === "conversion"
      ? (r.kind === "clawback" ? "Reversed: " : "") + creditReasonLabel(r.reason)
      : r.kind === "spend" ? "Applied to an unlock" : "Returned: unlock not completed",
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
