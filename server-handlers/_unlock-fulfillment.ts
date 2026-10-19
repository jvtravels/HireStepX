/* Shared fulfilment for employer contact-unlock orders.
 *
 * ONE function — fulfillUnlockOrder() — is called by the browser verify
 * endpoint, the Razorpay webhook (payment.captured / order.paid) and the
 * reconciliation cron, so what a paid order does can never drift between
 * them. Razorpay's webhook is the source of truth; the browser callback is
 * only a hint.
 *
 * PostgREST has no multi-statement transactions, so safety under concurrent
 * calls comes from idempotent steps instead:
 *   1. order row compare-and-swap  created|expired|failed -> paid
 *   2. employer_unlock_payments insert — razorpay_payment_id is UNIQUE, a 409
 *      means "already recorded" (success). Only the call that wins the insert
 *      sends the notification.
 *   3. requirement_matches flipped by patchMatchUnlocked (idempotent)
 *   4. order row compare-and-swap  open -> fulfilled|partial
 * Any failure between 1 and 4 leaves the order in 'paid', which the
 * reconciler retries — a captured payment is never silently dropped.
 *
 * A payment Razorpay has already fully refunded never fulfils an order, on any
 * path (verify, webhook, reconciler): an unfulfilled order is closed as
 * 'refunded' and its held credit released; a fulfilled one is left to the
 * refund webhook (relock + clawback).
 *
 * Invoice numbers are assigned here, once a cash purchase actually unlocked
 * someone (assign_unlock_invoice_no, migration 0045), and the invoice-relevant
 * fields are frozen onto the ledger row (invoice_snapshot) so a later profile
 * or env change cannot rewrite a past invoice. Both degrade to the old
 * behaviour while 0045 is unapplied.
 *
 * A match is NOT unlocked when the candidate blocked the employer or turned
 * employer visibility off between order creation and fulfilment; the order
 * becomes 'partial', the failed ids are returned/logged, and their full share
 * (cash and credit) is returned automatically as account credit (also
 * persisted as employer_unlock_orders.refund_due_paise when migration 0042 is
 * applied), with an in-app notification.
 *
 * Before exposing anything, a cash order priced with credit has that credit
 * verified (ensureCreditSpent). A payment that arrives after the order expired
 * re-spends the released credit; if it can't, the order is NOT fulfilled and
 * the cash is kept as credit instead (kind "converted_to_credit").
 */

import { patchMatchUnlocked } from "./_unlock-apply";
import { notify as defaultNotify, type NotifyInput } from "./_notify";
import { razorpayBasicAuth } from "./_razorpay-auth";
import { slog, redisPipeline } from "./_shared";
import { captureServerEvent, captureServerException } from "./_posthog";
import { sendOpsAlert } from "./_ops-alert";
import {
  returnCreditForUnavailableDetailed, splitPaise, ensureCreditSpent, clawbackOrderCredit, assignCreditNote, creditSpentOnOrders, isCreditOrderRef,
} from "./_employer-credit";

export { assignCreditNote, type CreditNoteRow } from "./_employer-credit";
import { maskedCandidateName, isSuspended } from "./_employer-trust";
import { sendUnlockReceiptEmail } from "./_unlock-receipt-email";
import { buildInvoiceSnapshot } from "./_unlock-tax";
import { readLegalEntity } from "../data/legal-entity";

export type UnlockOrderStatus =
  | "created" | "paid" | "fulfilled" | "partial" | "refunded" | "disputed" | "expired" | "failed";

export interface UnlockOrderRow {
  id: string;
  razorpay_order_id: string;
  employer_id: string;
  requirement_id: string | null;
  mode: "single" | "batch";
  match_ids: string[];
  /** Paise — the same unit Razorpay charges and employer_unlock_payments stores. */
  amount: number;
  currency: string;
  status: UnlockOrderStatus;
  razorpay_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
}

export const ORDER_SELECT =
  "id,razorpay_order_id,employer_id,requirement_id,mode,match_ids,amount,currency,status,razorpay_payment_id,created_at,paid_at,fulfilled_at";

/** The slice of a Razorpay payment entity fulfilment needs. */
export interface CapturedPayment {
  id: string;
  status: string;
  amount: number;
  orderId?: string | null;
  /** Razorpay's refund_status: null | "partial" | "full". */
  refundStatus?: string | null;
  /** Paise already refunded (amount_refunded). */
  amountRefunded?: number;
  /** ISO currency code; only INR is ever sold, so anything else, including absent, is rejected (currency_mismatch). */
  currency?: string | null;
}

export interface FailedMatch {
  matchId: string;
  reason: "gone" | "blocked" | "candidate_opted_out" | "employer_suspended";
}

/** Why an unlocked candidate's contact must not reach the employer right now. */
export type CandidateWithheld = "withdrew" | "declined" | "blocked" | "employer_suspended";

export interface FulfilledCandidate {
  matchId: string;
  /** Masked ("Candidate ab12") when `withheld` is set. */
  name: string | null;
  /** null when `withheld` is set. */
  email: string | null;
  withheld?: CandidateWithheld | null;
}

export type FulfillResult =
  | {
      kind: "fulfilled" | "partial";
      order: UnlockOrderRow;
      requirementId: string | null;
      unlockedMatchIds: string[];
      failed: FailedMatch[];
      candidates: FulfilledCandidate[];
      invoiceNo: string | null;
      /** True only for the call that recorded the ledger row (notifies once). */
      firstFulfilment: boolean;
      /** Paise owed back for the matches that could not be unlocked. */
      refundDueEstimatePaise: number;
      /** Paise this call returned as account credit for the unavailable matches (0 on a replay or when the ledger is unavailable). */
      returnedCreditPaise: number;
    }
  | { kind: "refunded" | "disputed"; order: UnlockOrderRow }
  /** Late cash payment whose credit could no longer be re-spent: kept as account credit, nothing unlocked. */
  | { kind: "converted_to_credit"; order: UnlockOrderRow; creditPaise: number }
  | { kind: "not_found" }
  | { kind: "not_captured"; paymentStatus: string }
  | { kind: "error"; code: "amount_mismatch" | "currency_mismatch" | "order_mismatch" | "forbidden" | "duplicate_payment" | "db_error"; message: string };

/** Statuses an order may move to 'paid' from (not 'paid' itself: that is the retry path). */
const PAYABLE_STATUSES = "created,expired,failed";
const OPEN_STATUSES = "created,paid,expired,failed";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Parses a Razorpay payment entity (webhook payload or REST response). */
export function toCapturedPayment(entity: unknown): CapturedPayment | null {
  if (!isRecord(entity)) return null;
  const { id, status, amount, order_id, refund_status, amount_refunded, currency } = entity;
  if (typeof id !== "string" || typeof status !== "string" || typeof amount !== "number") return null;
  return {
    id, status, amount,
    orderId: typeof order_id === "string" ? order_id : null,
    refundStatus: typeof refund_status === "string" ? refund_status : null,
    amountRefunded: typeof amount_refunded === "number" ? amount_refunded : 0,
    currency: typeof currency === "string" ? currency : null,
  };
}

/** Razorpay keeps a fully refunded payment's status as "captured" and only
 *  flips refund_status to "full" (amount_refunded reaches amount), so status
 *  alone cannot tell a refunded payment from a live one. */
export function isFullyRefundedPayment(p: CapturedPayment): boolean {
  return p.refundStatus === "full" || (p.amount > 0 && (p.amountRefunded ?? 0) >= p.amount);
}

/* ── Ops alerting ── */

const ALERT_WINDOW_SEC = 3_600;
const ALERT_MAX_WAIT_MS = 1_200;
const alertedInMemory = new Map<string, number>();

/** True once per key per hour: Redis SET NX EX, with a per-instance map when Redis is down so an
 *  outage cannot turn one failure into an alert storm. */
async function claimAlertSlot(key: string): Promise<boolean> {
  try {
    const out = await redisPipeline([["SET", `opsalert:${key}`, "1", "NX", "EX", ALERT_WINDOW_SEC]]);
    if (out) return out[0] === "OK";
  } catch { /* fall through to the in-memory guard */ }
  const nowMs = Date.now();
  const last = alertedInMemory.get(key);
  if (last !== undefined && nowMs - last < ALERT_WINDOW_SEC * 1_000) return false;
  alertedInMemory.set(key, nowMs);
  if (alertedInMemory.size > 500) for (const [k, t] of alertedInMemory) if (nowMs - t > ALERT_WINDOW_SEC * 1_000) alertedInMemory.delete(k);
  return true;
}

/** Tells the founder now (PostHog exception + email/Slack ops alert) instead of ~24h later via the
 *  daily digest. Alerts at most once per `key` per hour. Never throws, and waits at most ~1.2s so it
 *  cannot stall the response it is reporting a failure on. */
export async function alertUnlockProblem(p: {
  kind: string; key: string; subject: string; detail: string; error?: unknown; distinctId?: string;
}): Promise<void> {
  const work = (async () => {
    try {
      if (!(await claimAlertSlot(`${p.kind}:${p.key}`))) return;
      await Promise.allSettled([
        captureServerException(p.error ?? new Error(p.subject), p.distinctId, { kind: p.kind, key: p.key, detail: p.detail }),
        sendOpsAlert(p.subject, p.detail),
      ]);
    } catch { /* alerting must never break the payment path */ }
  })();
  await Promise.race([work, new Promise<void>((r) => setTimeout(r, ALERT_MAX_WAIT_MS))]);
}

/* ── Razorpay reads ── */

async function razorpayGet(
  path: string,
  keyId: string,
  keySecret: string,
  fetchImpl: typeof fetch,
  timeoutMs = 8_000,
): Promise<unknown | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`https://api.razorpay.com/v1${path}`, {
      headers: { Authorization: `Basic ${razorpayBasicAuth(keyId, keySecret)}` },
      signal: ac.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchRazorpayPayment(
  paymentId: string, keyId: string, keySecret: string, fetchImpl: typeof fetch = fetch,
): Promise<CapturedPayment | null> {
  return toCapturedPayment(await razorpayGet(`/payments/${encodeURIComponent(paymentId)}`, keyId, keySecret, fetchImpl));
}

export async function fetchRazorpayOrder(
  orderId: string, keyId: string, keySecret: string, fetchImpl: typeof fetch = fetch,
): Promise<{ amount: number; notes: Record<string, unknown> } | null> {
  const data = await razorpayGet(`/orders/${encodeURIComponent(orderId)}`, keyId, keySecret, fetchImpl);
  if (!isRecord(data) || typeof data.amount !== "number") return null;
  return { amount: data.amount, notes: isRecord(data.notes) ? data.notes : {} };
}

/** The captured payment on an order, if any. A live (not fully refunded) capture wins; a
 *  fully refunded one is still returned so the caller hands it to fulfillUnlockOrder, whose
 *  refund guard closes the order as refunded instead of letting it expire or fulfil.
 *  "error" when Razorpay could not be reached so callers retry instead of expiring. */
export async function findCapturedPaymentForOrder(
  orderId: string, keyId: string, keySecret: string, fetchImpl: typeof fetch = fetch,
): Promise<CapturedPayment | null | "error"> {
  const data = await razorpayGet(`/orders/${encodeURIComponent(orderId)}/payments`, keyId, keySecret, fetchImpl);
  if (!isRecord(data) || !Array.isArray(data.items)) return "error";
  let refunded: CapturedPayment | null = null;
  for (const item of data.items) {
    const p = toCapturedPayment(item);
    if (!p || p.status !== "captured") continue;
    const withOrder = { ...p, orderId: p.orderId ?? orderId };
    if (!isFullyRefundedPayment(p)) return withOrder;
    refunded ??= withOrder;
  }
  return refunded;
}

/* ── Supabase reads ── */

export async function loadUnlockOrder(
  supabaseUrl: string, headers: Record<string, string>, razorpayOrderId: string, fetchImpl: typeof fetch = fetch,
): Promise<UnlockOrderRow | null | "error"> {
  const res = await fetchImpl(
    `${supabaseUrl}/rest/v1/employer_unlock_orders?razorpay_order_id=eq.${encodeURIComponent(razorpayOrderId)}&select=${ORDER_SELECT}`,
    { headers },
  );
  if (!res.ok) return "error";
  const rows = (await res.json().catch(() => [])) as UnlockOrderRow[];
  return rows[0] ?? null;
}

interface MatchRowLite {
  id: string;
  requirement_id: string;
  candidate_user_id: string;
  unlocked: boolean;
  candidate_response?: string | null;
  unlocked_candidate_name?: string | null;
  unlocked_candidate_email?: string | null;
  profiles: { name: string | null; email: string | null; employer_visibility?: string | null } | null;
}

async function loadMatchesAndBlocks(
  supabaseUrl: string, headers: Record<string, string>, order: UnlockOrderRow, fetchImpl: typeof fetch,
): Promise<{ matches: MatchRowLite[]; blockedCandidateIds: Set<string> } | null> {
  const idParam = order.match_ids.map((id) => encodeURIComponent(id)).join(",");
  const matchRes = await fetchImpl(
    `${supabaseUrl}/rest/v1/requirement_matches?id=in.(${idParam})` +
      `&select=id,requirement_id,candidate_user_id,unlocked,candidate_response,unlocked_candidate_name,unlocked_candidate_email,profiles(name,email,employer_visibility)`,
    { headers },
  );
  if (!matchRes.ok) return null;
  const matches = (await matchRes.json().catch(() => null)) as MatchRowLite[] | null;
  if (!Array.isArray(matches)) return null;

  const blockedCandidateIds = new Set<string>();
  if (matches.length > 0) {
    const cidParam = Array.from(new Set(matches.map((m) => m.candidate_user_id))).map((id) => encodeURIComponent(id)).join(",");
    const blockRes = await fetchImpl(
      `${supabaseUrl}/rest/v1/employer_blocks?employer_id=eq.${encodeURIComponent(order.employer_id)}` +
        `&candidate_user_id=in.(${cidParam})&select=candidate_user_id`,
      { headers },
    );
    if (!blockRes.ok) return null;
    const blocks = (await blockRes.json().catch(() => null)) as Array<{ candidate_user_id: string }> | null;
    if (!Array.isArray(blocks)) return null;
    for (const b of blocks) blockedCandidateIds.add(b.candidate_user_id);
  }
  return { matches, blockedCandidateIds };
}

function rupees(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Why this match's contact may not be shown: the candidate withdrew visibility, declined,
 *  blocked the employer, or the employer is suspended. null = releasable. A paid unlock
 *  buys a snapshot, not a standing right to reach someone who has since opted out. */
function withheldReason(m: MatchRowLite, blocked: Set<string>, employerSuspended: boolean): CandidateWithheld | null {
  if (employerSuspended) return "employer_suspended";
  if (blocked.has(m.candidate_user_id)) return "blocked";
  if (m.profiles?.employer_visibility === "off") return "withdrew";
  if (m.candidate_response === "declined") return "declined";
  return null;
}

function candidateOf(m: MatchRowLite, withheld: CandidateWithheld | null = null): FulfilledCandidate {
  if (withheld) return { matchId: m.id, name: maskedCandidateName(m.id), email: null, withheld };
  return {
    matchId: m.id,
    name: m.profiles?.name ?? m.unlocked_candidate_name ?? null,
    email: m.profiles?.email ?? m.unlocked_candidate_email ?? null,
  };
}

/** Cash-only estimate of what the failed matches were worth: the sum of their exact
 *  largest-remainder shares, so it agrees with creditShare / the credit actually returned. */
function refundShare(order: UnlockOrderRow, failedIndexes: number[]): number {
  const n = order.match_ids.length;
  if (failedIndexes.length === 0 || n === 0) return 0;
  const shares = splitPaise(order.amount, n);
  return failedIndexes.reduce((sum, i) => sum + (shares[i] ?? 0), 0);
}

function failedIndexesOf(order: UnlockOrderRow, failedIds: string[]): number[] {
  const set = new Set(failedIds);
  return order.match_ids.flatMap((id, i) => (set.has(id) ? [i] : []));
}

/** employers.suspended_at: a suspended employer's paid order is not unlocked and is returned as
 *  credit. "error" on a failed read (the caller retries); a missing column reads as not suspended. */
async function loadEmployerSuspended(
  supabaseUrl: string, headers: Record<string, string>, employerId: string, f: typeof fetch,
): Promise<boolean | "error"> {
  try {
    const res = await f(
      `${supabaseUrl}/rest/v1/employers?id=eq.${encodeURIComponent(employerId)}&select=suspended_at`,
      { headers },
    );
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return isMissingColumn(res.status, t) ? false : "error";
    }
    const rows = (await res.json().catch(() => null)) as Array<{ suspended_at?: string | null }> | null;
    if (!Array.isArray(rows)) return "error";
    return isSuspended(rows[0]);
  } catch {
    return "error";
  }
}

async function patchOrder(
  supabaseUrl: string, headers: Record<string, string>, razorpayOrderId: string, fromStatuses: string,
  body: Record<string, unknown>, fetchImpl: typeof fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/employer_unlock_orders?razorpay_order_id=eq.${encodeURIComponent(razorpayOrderId)}&status=in.(${fromStatuses})`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

/** CAS close of the order. Returns how many rows matched (0 = another call closed it first),
 *  or null when the write failed. */
async function patchOrderRows(
  supabaseUrl: string, headers: Record<string, string>, razorpayOrderId: string, fromStatuses: string,
  body: Record<string, unknown>, fetchImpl: typeof fetch,
): Promise<number | null> {
  try {
    const res = await fetchImpl(
      `${supabaseUrl}/rest/v1/employer_unlock_orders?razorpay_order_id=eq.${encodeURIComponent(razorpayOrderId)}&status=in.(${fromStatuses})`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ ...body, updated_at: new Date().toISOString() }),
      },
    );
    if (!res.ok) return null;
    const rows: unknown = await res.json().catch(() => null);
    return Array.isArray(rows) ? rows.length : null;
  } catch {
    return null;
  }
}

/** Records the ledger row. "inserted" = this call owns the first fulfilment. */
async function recordLedger(
  supabaseUrl: string, headers: Record<string, string>, order: UnlockOrderRow, paymentId: string, fetchImpl: typeof fetch,
): Promise<{ state: "inserted" | "exists"; invoiceNo: string | null } | { state: "error"; detail: string }> {
  const base = {
    employer_id: order.employer_id,
    razorpay_payment_id: paymentId,
    razorpay_order_id: order.razorpay_order_id,
    amount: order.amount,
    currency: order.currency || "INR",
    requirement_id: order.requirement_id,
  };
  const body = order.mode === "batch" ? { match_ids: order.match_ids, ...base } : { match_id: order.match_ids[0], ...base };
  const res = await fetchImpl(`${supabaseUrl}/rest/v1/employer_unlock_payments`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (res.status === 201 || res.ok) {
    const rows = (await res.json().catch(() => [])) as Array<{ invoice_no?: string | null }> | null;
    return { state: "inserted", invoiceNo: (Array.isArray(rows) && rows[0]?.invoice_no) || null };
  }
  if (res.status === 409) {
    let invoiceNo: string | null = null;
    try {
      const r = await fetchImpl(
        `${supabaseUrl}/rest/v1/employer_unlock_payments?razorpay_payment_id=eq.${encodeURIComponent(paymentId)}&select=invoice_no`,
        { headers },
      );
      if (r.ok) {
        const rows = (await r.json().catch(() => [])) as Array<{ invoice_no?: string | null }>;
        invoiceNo = (Array.isArray(rows) && rows[0]?.invoice_no) || null;
      }
    } catch { /* invoice number is a display nicety on the replay path */ }
    return { state: "exists", invoiceNo };
  }
  const t = await res.text().catch(() => "");
  return { state: "error", detail: `${res.status} ${t.slice(0, 160)}` };
}

export interface FulfillParams {
  supabaseUrl: string;
  headers: Record<string, string>;
  razorpayOrderId: string;
  /** Must already be a verified Razorpay payment entity (webhook payload, or a
   *  REST fetch) — fulfilment itself only accepts status "captured". */
  payment: CapturedPayment;
  /** Browser path: the authenticated employer must own the order. */
  expectEmployerId?: string;
  fetchImpl?: typeof fetch;
  notifyImpl?: (input: NotifyInput) => Promise<void>;
  now?: () => Date;
}

export async function fulfillUnlockOrder(p: FulfillParams): Promise<FulfillResult> {
  const f = p.fetchImpl ?? fetch;
  const notifyFn = p.notifyImpl ?? defaultNotify;
  const now = p.now ?? (() => new Date());

  if (p.payment.status !== "captured") return { kind: "not_captured", paymentStatus: p.payment.status };

  const loaded = await loadUnlockOrder(p.supabaseUrl, p.headers, p.razorpayOrderId, f);
  if (loaded === "error") return { kind: "error", code: "db_error", message: "order lookup failed" };
  if (!loaded) return { kind: "not_found" };
  const order = loaded;

  if (p.expectEmployerId && order.employer_id !== p.expectEmployerId) {
    return { kind: "error", code: "forbidden", message: "order belongs to another employer" };
  }
  if (p.payment.orderId && p.payment.orderId !== order.razorpay_order_id) {
    return { kind: "error", code: "order_mismatch", message: "payment belongs to a different order" };
  }
  if (p.payment.amount !== order.amount) {
    slog.error("unlock payment amount differs from order", {
      code: "unlock_amount_mismatch", orderId: order.razorpay_order_id, paid: p.payment.amount, expected: order.amount,
    });
    return { kind: "error", code: "amount_mismatch", message: "payment amount does not match the order" };
  }
  // A missing currency is rejected too: the entity is only ever INR, so absence means a malformed payload.
  if ((p.payment.currency ?? "").toUpperCase() !== "INR") {
    slog.error("unlock payment currency is not INR", {
      code: "unlock_currency_mismatch", orderId: order.razorpay_order_id, currency: p.payment.currency,
    });
    return { kind: "error", code: "currency_mismatch", message: "payment currency does not match the order" };
  }
  if (order.status === "refunded" || order.status === "disputed") return { kind: order.status, order };
  if (isFullyRefundedPayment(p.payment)) return closeRefundedPayment(p, order, f, now());

  const alreadyDone = order.status === "fulfilled" || order.status === "partial";
  if (order.razorpay_payment_id && order.razorpay_payment_id !== p.payment.id && order.status !== "created"
      && order.status !== "expired" && order.status !== "failed") {
    slog.error("second captured payment on an already-paid unlock order — manual refund needed", {
      code: "unlock_duplicate_payment", orderId: order.razorpay_order_id, firstPaymentId: order.razorpay_payment_id, secondPaymentId: p.payment.id,
    });
    return { kind: "error", code: "duplicate_payment", message: "order already paid with a different payment" };
  }

  const state = await loadMatchesAndBlocks(p.supabaseUrl, p.headers, order, f);
  if (!state) return { kind: "error", code: "db_error", message: "match lookup failed" };
  const suspended = await loadEmployerSuspended(p.supabaseUrl, p.headers, order.employer_id, f);
  if (suspended === "error") return { kind: "error", code: "db_error", message: "employer lookup failed" };
  const byId = new Map(state.matches.map((m) => [m.id, m]));
  const requirementId = order.requirement_id ?? state.matches[0]?.requirement_id ?? null;

  /* Replay of a finished order: report, never re-write contact. A candidate who has since
   * withdrawn, declined or blocked this employer (or a suspended employer) gets no contact back. */
  if (alreadyDone) {
    const unlockedRows = order.match_ids.map((id) => byId.get(id)).filter((m): m is MatchRowLite => !!m && m.unlocked);
    const failed: FailedMatch[] = order.match_ids
      .filter((id) => !byId.get(id)?.unlocked)
      .map((matchId) => ({ matchId, reason: byId.has(matchId) ? "candidate_opted_out" : "gone" }));
    let replayInvoiceNo = await invoiceFor(p.supabaseUrl, p.headers, p.payment.id, f);
    if (!replayInvoiceNo && invoiceEligible(order) && unlockedRows.length > 0) {
      replayInvoiceNo = await assignInvoiceNo(p.supabaseUrl, p.headers, p.payment.id, f);
    }
    // An order closed 'partial' by an older build may never have had its share returned (the return ran after the
    // status flip). Retrying is idempotent: the ledger's unique indexes make the credit land once.
    let returnedReplay = 0;
    const estimate = refundShare(order, failedIndexesOf(order, failed.map((x) => x.matchId)));
    if (order.status === "partial" && failed.length > 0) {
      const back = await returnCreditForUnavailableDetailed({
        base: p.supabaseUrl, headers: p.headers, employerId: order.employer_id, orderRef: order.razorpay_order_id,
        orderMatchCount: order.match_ids.length, failedMatchIds: failed.map((x) => x.matchId),
        orderMatchIds: order.match_ids, orderCashPaise: order.amount, fetchImpl: f,
      });
      if (back.ok) {
        returnedReplay = back.creditedPaise;
        if (replayInvoiceNo && back.creditedPaise > 0) {
          await assignCreditNote(p.supabaseUrl, p.headers, order.razorpay_order_id, `unavailable:${order.razorpay_order_id}`, back.creditedPaise, f);
        }
      }
    }
    return {
      kind: order.status === "partial" ? "partial" : "fulfilled",
      order, requirementId,
      unlockedMatchIds: unlockedRows.map((m) => m.id),
      failed,
      candidates: unlockedRows.map((m) => candidateOf(m, withheldReason(m, state.blockedCandidateIds, suspended))),
      invoiceNo: replayInvoiceNo,
      firstFulfilment: false,
      refundDueEstimatePaise: estimate,
      returnedCreditPaise: returnedReplay,
    };
  }

  /* 0. a credit-priced cash order must really have had its credit spent. */
  let creditApplied = 0;
  if (order.amount > 0) {
    const ensured = await ensureCreditSpent({
      base: p.supabaseUrl, headers: p.headers,
      order: { razorpay_order_id: order.razorpay_order_id, employer_id: order.employer_id, amount: order.amount, requirement_id: order.requirement_id },
      fetchImpl: f,
    });
    if (ensured.state === "error") return { kind: "error", code: "db_error", message: "could not verify the credit applied to this order" };
    if (ensured.state === "converted") {
      // Record the capture and close the order so a webhook replay is a no-op ("refunded" short-circuits above).
      await patchOrder(p.supabaseUrl, p.headers, order.razorpay_order_id, "created,expired,failed,paid", {
        status: "refunded", razorpay_payment_id: p.payment.id, paid_at: now().toISOString(),
      }, f);
      void captureServerEvent("employer_unlock_failed", order.employer_id, {
        requirementId: order.requirement_id, orderId: order.razorpay_order_id, reason: "late_payment_credit_unavailable", amountPaise: order.amount,
      });
      void notifyFn({
        userId: order.employer_id,
        type: "credit_refunded",
        title: "Payment kept as credit",
        body: `Your payment of ${rupees(order.amount)} arrived after the order expired and the credit it relied on was no longer available. It was added to your account credit instead; unlock the candidates again to use it.`,
        link: "/employer/settings",
        groupKey: `credit_refunded:${order.employer_id}`,
      });
      return { kind: "converted_to_credit", order, creditPaise: ensured.creditPaise };
    }
    creditApplied = ensured.creditSpentPaise;
  }

  /* 1. created|expired|failed -> paid. Losing this race is fine. */
  if (order.status !== "paid") {
    const ok = await patchOrder(p.supabaseUrl, p.headers, order.razorpay_order_id, PAYABLE_STATUSES, {
      status: "paid", razorpay_payment_id: p.payment.id, paid_at: now().toISOString(),
    }, f);
    if (!ok) slog.warn("unlock order paid-transition failed (continuing)", { code: "unlock_order_paid_patch_failed", orderId: order.razorpay_order_id });
  }

  /* 2. ledger row — idempotent on razorpay_payment_id. */
  const ledger = await recordLedger(p.supabaseUrl, p.headers, order, p.payment.id, f);
  if (ledger.state === "error") {
    slog.error("unlock ledger insert failed", { code: "unlock_ledger_insert_failed", orderId: order.razorpay_order_id, detail: ledger.detail });
    return { kind: "error", code: "db_error", message: "failed to record payment" };
  }

  /* 3. decide + unlock. */
  const failed: FailedMatch[] = [];
  const toUnlock: MatchRowLite[] = [];
  const alreadyUnlocked: MatchRowLite[] = [];
  for (const id of order.match_ids) {
    const m = byId.get(id) as MatchRowLite | undefined;
    if (suspended) failed.push({ matchId: id, reason: "employer_suspended" });
    else if (!m) failed.push({ matchId: id, reason: "gone" });
    else if (m.unlocked) alreadyUnlocked.push(m);
    else if (state.blockedCandidateIds.has(m.candidate_user_id)) failed.push({ matchId: id, reason: "blocked" });
    else if (m.profiles?.employer_visibility === "off") failed.push({ matchId: id, reason: "candidate_opted_out" });
    else toUnlock.push(m);
  }

  const unlockedAt = now().toISOString();
  const results = await Promise.all(
    toUnlock.map((m) =>
      patchMatchUnlocked({
        supabaseUrl: p.supabaseUrl,
        headers: p.headers,
        matchId: m.id,
        unlockedAt,
        profile: m.profiles ? { name: m.profiles.name, email: m.profiles.email } : undefined,
        fetchImpl: f,
      }).catch(() => null),
    ),
  );
  if (results.some((r) => !r || !r.ok)) {
    slog.error("unlock patch failed — order left 'paid' for the reconciler", { code: "unlock_patch_failed", orderId: order.razorpay_order_id });
    return { kind: "error", code: "db_error", message: "failed to unlock candidate" };
  }

  const unlockedRows = [...alreadyUnlocked, ...toUnlock];
  const kind = failed.length > 0 ? "partial" : "fulfilled";
  const failedIndexes = failedIndexesOf(order, failed.map((x) => x.matchId));
  const refundDueEstimatePaise = refundShare(order, failedIndexes);

  /* 3b. return the unavailable share BEFORE closing the order. If this fails the order stays 'paid'
   * and the reconciler retries (the ledger's unique indexes make the credit land once). Doing it after
   * the status flip would strand the credit forever: a closed order is never revisited. */
  let returnedPaise = 0;
  if (failed.length > 0) {
    const back = await returnCreditForUnavailableDetailed({
      base: p.supabaseUrl, headers: p.headers, employerId: order.employer_id, orderRef: order.razorpay_order_id,
      orderMatchCount: order.match_ids.length, failedMatchIds: failed.map((x) => x.matchId),
      orderMatchIds: order.match_ids, orderCashPaise: order.amount,
      reason: suspended ? "employer_suspended" : "unavailable", fetchImpl: f,
    });
    if (!back.ok) {
      slog.error("unlock credit return failed — order left 'paid' for the reconciler", {
        code: "unlock_credit_return_failed", orderId: order.razorpay_order_id, employerId: order.employer_id,
      });
      return { kind: "error", code: "db_error", message: "failed to return credit for unavailable candidates" };
    }
    returnedPaise = back.creditedPaise;
  }

  /* 4. close the order. The call whose CAS matches a row owns the notifications. */
  const closed = await patchOrderRows(p.supabaseUrl, p.headers, order.razorpay_order_id, OPEN_STATUSES, {
    status: kind, fulfilled_at: unlockedAt, razorpay_payment_id: p.payment.id,
  }, f);
  if (closed === null) {
    slog.error("unlock order close failed — order left 'paid' for the reconciler", { code: "unlock_order_close_failed", orderId: order.razorpay_order_id });
    return { kind: "error", code: "db_error", message: "failed to close the order" };
  }
  const firstFulfilment = closed > 0;

  // A purchase that really unlocked someone is a tax invoice, cash or credit-only (the credit was never taxed
  // at purchase, so redemption is the supply). No number for 409 replays or an order where every candidate
  // turned out to be unavailable.
  let invoiceNo = ledger.invoiceNo;
  if (invoiceEligible(order) && unlockedRows.length > 0) {
    let creditForInvoice = creditApplied;
    if (order.amount === 0) {
      const spent = await creditSpentOnOrders(p.supabaseUrl, p.headers, order.employer_id, [order.razorpay_order_id], f);
      creditForInvoice = spent?.get(order.razorpay_order_id) ?? 0;
    }
    if (!invoiceNo) invoiceNo = await assignInvoiceNo(p.supabaseUrl, p.headers, p.payment.id, f);
    await writeInvoiceSnapshot({
      supabaseUrl: p.supabaseUrl, headers: p.headers, order, paymentId: p.payment.id, creditPaise: creditForInvoice, now: now(), f,
    });
    // The returned share is a credit against this invoice. Best effort: a missing note is repaired on the next replay.
    if (invoiceNo && returnedPaise > 0) {
      await assignCreditNote(p.supabaseUrl, p.headers, order.razorpay_order_id, `unavailable:${order.razorpay_order_id}`, returnedPaise, f);
    }
  }

  if (failed.length > 0) {
    if (refundDueEstimatePaise > 0) {
      // Best-effort: the column exists only once migration 0042 is applied. Records the cash share that went back as credit.
      await patchOrder(p.supabaseUrl, p.headers, order.razorpay_order_id, "partial", { refund_due_paise: refundDueEstimatePaise }, f);
    }
    slog.error("unlock order partially fulfilled — candidate(s) unavailable after payment; cash share returned as credit", {
      code: "unlock_order_partial",
      orderId: order.razorpay_order_id,
      paymentId: p.payment.id,
      employerId: order.employer_id,
      failed,
      refundDueEstimatePaise,
      returnedPaise,
    });
  }

  if (firstFulfilment) {
    // Here rather than in the verify handler: the webhook or reconciler can be the first to fulfil an
    // order. Gated on the order CAS (not the ledger insert) so a retry after a failed unlock still notifies.
    void captureServerEvent("employer_unlock_paid", order.employer_id, {
      requirementId,
      candidatesUnlocked: unlockedRows.length,
      candidatesFailed: failed.length,
      amountPaise: order.amount,
      mode: order.mode,
    });
    const n = unlockedRows.length;
    const invoice = invoiceNo ? ` Invoice ${invoiceNo}.` : "";
    const creditOnly = order.amount === 0;
    const partialNote = failed.length > 0
      ? creditOnly
        ? ` ${failed.length} candidate${failed.length === 1 ? " is" : "s are"} no longer available; that credit was returned to your balance.`
        : ` ${failed.length} candidate${failed.length === 1 ? " is" : "s are"} no longer available; ${returnedPaise > 0 ? `${rupees(returnedPaise)} was added to your account credit` : "we will refund that portion"} (order ${order.razorpay_order_id}).`
      : "";
    void notifyFn({
      userId: order.employer_id,
      type: "unlock_confirmed",
      title: order.mode === "batch" ? "Candidate contacts unlocked" : "Candidate contact unlocked",
      body: suspended
        ? `Payment received, but your account is suspended so no contact was unlocked. ${returnedPaise > 0 ? `${rupees(returnedPaise)} was added to your account credit` : "We will refund this payment"} (order ${order.razorpay_order_id}).`
        : n === 0
        ? creditOnly
          ? "The candidate is no longer available, so your credit was returned to your balance."
          : `Payment received, but the candidate is no longer available. ${returnedPaise > 0 ? `${rupees(returnedPaise)} was added to your account credit` : "We will refund this payment"} (order ${order.razorpay_order_id}).`
        : order.mode === "batch"
          ? `Payment confirmed — ${n} candidate contact${n === 1 ? "" : "s"} unlocked.${invoice}${partialNote}`
          : `Payment confirmed — the candidate's contact details are ready.${invoice}`,
      link: requirementId ? `/employer/requirements/${requirementId}` : undefined,
    });
    if (!creditOnly && n > 0) {
      void sendUnlockReceiptEmail({
        supabaseUrl: p.supabaseUrl, headers: p.headers, fetchImpl: f,
        receipt: {
          employerId: order.employer_id, orderId: order.razorpay_order_id, paymentId: p.payment.id,
          amountPaise: order.amount, creditPaise: creditApplied, candidates: n, invoiceNo,
        },
      });
    }
  }

  return {
    kind, order, requirementId,
    unlockedMatchIds: suspended ? [] : unlockedRows.map((m) => m.id),
    failed,
    candidates: suspended ? [] : unlockedRows.map((m) => candidateOf(m, withheldReason(m, state.blockedCandidateIds, false))),
    invoiceNo,
    firstFulfilment,
    refundDueEstimatePaise,
    returnedCreditPaise: returnedPaise,
  };
}

/** A cash order, or an order paid wholly from credit. Admin grants never reach here. */
export function invoiceEligible(order: Pick<UnlockOrderRow, "amount" | "razorpay_order_id">): boolean {
  return order.amount > 0 || isCreditOrderRef(order.razorpay_order_id);
}

async function invoiceFor(
  supabaseUrl: string, headers: Record<string, string>, paymentId: string, f: typeof fetch,
): Promise<string | null> {
  try {
    const r = await f(
      `${supabaseUrl}/rest/v1/employer_unlock_payments?razorpay_payment_id=eq.${encodeURIComponent(paymentId)}&select=invoice_no`,
      { headers },
    );
    if (!r.ok) return null;
    const rows = (await r.json().catch(() => [])) as Array<{ invoice_no?: string | null }>;
    return (Array.isArray(rows) && rows[0]?.invoice_no) || null;
  } catch {
    return null;
  }
}

const isMissingColumn = (status: number, text: string) =>
  status === 400 && /PGRST204|42703|column/i.test(text);

/** Assigns the tax-invoice number for a cash purchase that unlocked someone.
 *  The RPC is idempotent (only fills a null invoice_no), so a lost race returns
 *  null and we read the winner's number. null when migration 0045 is unapplied
 *  (the column default numbered the row at insert instead) or the call failed;
 *  the reconciler's invoice back-fill sweep numbers any fulfilled cash order left without one. */
export async function assignInvoiceNo(
  supabaseUrl: string, headers: Record<string, string>, paymentId: string, f: typeof fetch,
): Promise<string | null> {
  try {
    const res = await f(`${supabaseUrl}/rest/v1/rpc/assign_unlock_invoice_no`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ p_payment_id: paymentId }),
    });
    if (res.ok) {
      const v: unknown = await res.json().catch(() => null);
      return typeof v === "string" && v ? v : await invoiceFor(supabaseUrl, headers, paymentId, f);
    }
    if (res.status !== 404) slog.warn("unlock invoice number assignment failed", { code: "unlock_invoice_assign_failed", paymentId, status: res.status });
  } catch { /* retried by the reconciler's invoice back-fill */ }
  return null;
}

/** Freezes supplier, buyer, tax rate and the tax breakup onto the ledger row. Best effort and
 *  write-once (only fills a null snapshot); rows without one render from live values. */
export async function writeInvoiceSnapshot(p: {
  supabaseUrl: string; headers: Record<string, string>; order: UnlockOrderRow; paymentId: string;
  creditPaise: number; now: Date; f: typeof fetch;
}): Promise<void> {
  try {
    const empRes = await p.f(
      `${p.supabaseUrl}/rest/v1/employers?id=eq.${encodeURIComponent(p.order.employer_id)}&select=company_name,billing_name,gstin`,
      { headers: p.headers },
    );
    if (!empRes.ok) return;
    const rows = (await empRes.json().catch(() => null)) as Array<{ company_name?: string | null; billing_name?: string | null; gstin?: string | null }> | null;
    if (!Array.isArray(rows) || !rows[0]) return;
    const snapshot = buildInvoiceSnapshot({
      supplier: readLegalEntity(),
      buyer: { companyName: rows[0].company_name ?? "", billingName: rows[0].billing_name ?? "", gstin: rows[0].gstin ?? "" },
      cashPaise: p.order.amount, creditPaise: p.creditPaise, now: p.now,
    });
    const res = await p.f(
      `${p.supabaseUrl}/rest/v1/employer_unlock_payments?razorpay_payment_id=eq.${encodeURIComponent(p.paymentId)}&invoice_snapshot=is.null`,
      {
        method: "PATCH",
        headers: { ...p.headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ invoice_snapshot: snapshot }),
      },
    );
    if (!res.ok && !isMissingColumn(res.status, await res.text().catch(() => ""))) {
      slog.warn("unlock invoice snapshot write failed", { code: "unlock_invoice_snapshot_failed", paymentId: p.paymentId, status: res.status });
    }
  } catch { /* the document falls back to live values */ }
}

/** A payment Razorpay already refunded in full must not grant anything. An order that
 *  was never fulfilled is closed as refunded and its held credit released (same
 *  clawback the refund webhook uses). A fulfilled/partial order is left to the refund
 *  webhook, which owns the relock and the credit clawback. */
async function closeRefundedPayment(
  p: FulfillParams, order: UnlockOrderRow, f: typeof fetch, now: Date,
): Promise<FulfillResult> {
  if (order.status === "fulfilled" || order.status === "partial") return { kind: "refunded", order };
  const clawback = await clawbackOrderCredit({
    base: p.supabaseUrl, headers: p.headers, order, reason: "payment_refunded", releaseSpent: true, fetchImpl: f,
  });
  if (!clawback.ok) return { kind: "error", code: "db_error", message: "credit release failed" };
  const ok = await patchOrder(p.supabaseUrl, p.headers, order.razorpay_order_id, "created,paid,expired,failed", {
    status: "refunded", razorpay_payment_id: p.payment.id, paid_at: now.toISOString(),
  }, f);
  if (!ok) return { kind: "error", code: "db_error", message: "order status update failed" };
  slog.warn("captured unlock payment was already fully refunded — order closed without unlocking", {
    code: "unlock_payment_already_refunded", orderId: order.razorpay_order_id, paymentId: p.payment.id,
  });
  return { kind: "refunded", order: { ...order, status: "refunded" } };
}

/** Orders created before employer_unlock_orders existed (in flight at deploy
 *  time) have no row; rebuild it from the Razorpay order's server-written
 *  notes so the browser verify path keeps working for them. Conflicts mean
 *  another call already backfilled it — fine. */
export async function backfillLegacyUnlockOrder(params: {
  supabaseUrl: string;
  headers: Record<string, string>;
  razorpayOrderId: string;
  amount: number;
  notes: Record<string, unknown>;
  employerId: string;
  fetchImpl?: typeof fetch;
}): Promise<UnlockOrderRow | null> {
  const f = params.fetchImpl ?? fetch;
  const notedEmployer = typeof params.notes.employerId === "string" ? params.notes.employerId : "";
  const rawIds = typeof params.notes.matchIds === "string" ? params.notes.matchIds : "";
  const matchIds = Array.from(new Set(rawIds.split(",").map((s) => s.trim()).filter(Boolean))).slice(0, 20);
  if (notedEmployer !== params.employerId || matchIds.length === 0) return null;

  let requirementId: string | null = null;
  try {
    const r = await f(
      `${params.supabaseUrl}/rest/v1/requirement_matches?id=in.(${matchIds.map(encodeURIComponent).join(",")})&select=id,requirement_id&limit=1`,
      { headers: params.headers },
    );
    if (r.ok) {
      const rows = (await r.json().catch(() => [])) as Array<{ requirement_id: string }>;
      requirementId = rows[0]?.requirement_id ?? null;
    }
  } catch { /* requirement_id is optional */ }

  const mode = params.notes.mode === "batch" ? "batch" : "single";
  await f(`${params.supabaseUrl}/rest/v1/employer_unlock_orders`, {
    method: "POST",
    headers: { ...params.headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      razorpay_order_id: params.razorpayOrderId,
      employer_id: params.employerId,
      requirement_id: requirementId,
      mode,
      match_ids: matchIds,
      amount: params.amount,
      currency: "INR",
      status: "created",
    }),
  }).catch(() => null);

  const row = await loadUnlockOrder(params.supabaseUrl, params.headers, params.razorpayOrderId, f);
  return row && row !== "error" ? row : null;
}
