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
 * A match is NOT unlocked when the candidate blocked the employer or turned
 * employer visibility off between order creation and fulfilment; the order
 * becomes 'partial', the failed ids are returned/logged and a proportional
 * refund estimate is reported for support/the refund path.
 */

import { patchMatchUnlocked } from "./_unlock-apply";
import { notify as defaultNotify, type NotifyInput } from "./_notify";
import { razorpayBasicAuth } from "./_razorpay-auth";
import { slog } from "./_shared";

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
}

export interface FailedMatch {
  matchId: string;
  reason: "gone" | "blocked" | "candidate_opted_out";
}

export interface FulfilledCandidate {
  matchId: string;
  name: string | null;
  email: string | null;
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
    }
  | { kind: "refunded" | "disputed"; order: UnlockOrderRow }
  | { kind: "not_found" }
  | { kind: "not_captured"; paymentStatus: string }
  | { kind: "error"; code: "amount_mismatch" | "order_mismatch" | "forbidden" | "duplicate_payment" | "db_error"; message: string };

/** Statuses an order may move to 'paid' from (not 'paid' itself: that is the retry path). */
const PAYABLE_STATUSES = "created,expired,failed";
const OPEN_STATUSES = "created,paid,expired,failed";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

/** Parses a Razorpay payment entity (webhook payload or REST response). */
export function toCapturedPayment(entity: unknown): CapturedPayment | null {
  if (!isRecord(entity)) return null;
  const { id, status, amount, order_id } = entity;
  if (typeof id !== "string" || typeof status !== "string" || typeof amount !== "number") return null;
  return { id, status, amount, orderId: typeof order_id === "string" ? order_id : null };
}

/** Razorpay marks fully refunded payments with refund_status "full" — those
 *  must never fulfil an order. */
function isFullyRefunded(entity: unknown): boolean {
  return isRecord(entity) && entity.refund_status === "full";
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

/** The captured, not-fully-refunded payment on an order, if any. "error" when
 *  Razorpay could not be reached so callers retry instead of expiring. */
export async function findCapturedPaymentForOrder(
  orderId: string, keyId: string, keySecret: string, fetchImpl: typeof fetch = fetch,
): Promise<CapturedPayment | null | "error"> {
  const data = await razorpayGet(`/orders/${encodeURIComponent(orderId)}/payments`, keyId, keySecret, fetchImpl);
  if (!isRecord(data) || !Array.isArray(data.items)) return "error";
  for (const item of data.items) {
    const p = toCapturedPayment(item);
    if (p && p.status === "captured" && !isFullyRefunded(item)) return { ...p, orderId: p.orderId ?? orderId };
  }
  return null;
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
      `&select=id,requirement_id,candidate_user_id,unlocked,unlocked_candidate_name,unlocked_candidate_email,profiles(name,email,employer_visibility)`,
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

function candidateOf(m: MatchRowLite): FulfilledCandidate {
  return {
    matchId: m.id,
    name: m.profiles?.name ?? m.unlocked_candidate_name ?? null,
    email: m.profiles?.email ?? m.unlocked_candidate_email ?? null,
  };
}

function refundShare(order: UnlockOrderRow, failedCount: number): number {
  if (failedCount <= 0 || order.match_ids.length === 0) return 0;
  return Math.round((order.amount * Math.min(failedCount, order.match_ids.length)) / order.match_ids.length);
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
  if (order.status === "refunded" || order.status === "disputed") return { kind: order.status, order };

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
  const byId = new Map(state.matches.map((m) => [m.id, m]));
  const requirementId = order.requirement_id ?? state.matches[0]?.requirement_id ?? null;

  /* Replay of a finished order: report, never re-write. */
  if (alreadyDone) {
    const unlockedRows = order.match_ids.map((id) => byId.get(id)).filter((m): m is MatchRowLite => !!m && m.unlocked);
    const failed: FailedMatch[] = order.match_ids
      .filter((id) => !byId.get(id)?.unlocked)
      .map((matchId) => ({ matchId, reason: byId.has(matchId) ? "candidate_opted_out" : "gone" }));
    return {
      kind: order.status === "partial" ? "partial" : "fulfilled",
      order, requirementId,
      unlockedMatchIds: unlockedRows.map((m) => m.id),
      failed,
      candidates: unlockedRows.map(candidateOf),
      invoiceNo: await invoiceFor(p.supabaseUrl, p.headers, p.payment.id, f),
      firstFulfilment: false,
      refundDueEstimatePaise: refundShare(order, failed.length),
    };
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
    const m = byId.get(id);
    if (!m) failed.push({ matchId: id, reason: "gone" });
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

  /* 4. close the order. */
  await patchOrder(p.supabaseUrl, p.headers, order.razorpay_order_id, OPEN_STATUSES, {
    status: kind, fulfilled_at: unlockedAt, razorpay_payment_id: p.payment.id,
  }, f);

  const refundDueEstimatePaise = refundShare(order, failed.length);
  if (failed.length > 0) {
    slog.error("unlock order partially fulfilled — candidate(s) unavailable after payment; refund or credit owed", {
      code: "unlock_order_partial",
      orderId: order.razorpay_order_id,
      paymentId: p.payment.id,
      employerId: order.employer_id,
      failed,
      refundDueEstimatePaise,
    });
  }

  const firstFulfilment = ledger.state === "inserted";
  if (firstFulfilment) {
    const n = unlockedRows.length;
    const invoice = ledger.invoiceNo ? ` Invoice ${ledger.invoiceNo}.` : "";
    const partialNote = failed.length > 0
      ? ` ${failed.length} candidate${failed.length === 1 ? " is" : "s are"} no longer available; we will refund that portion (order ${order.razorpay_order_id}).`
      : "";
    void notifyFn({
      userId: order.employer_id,
      type: "unlock_confirmed",
      title: order.mode === "batch" ? "Candidate contacts unlocked" : "Candidate contact unlocked",
      body: n === 0
        ? `Payment received, but the candidate is no longer available. We will refund this payment (order ${order.razorpay_order_id}).`
        : order.mode === "batch"
          ? `Payment confirmed — ${n} candidate contact${n === 1 ? "" : "s"} unlocked.${invoice}${partialNote}`
          : `Payment confirmed — the candidate's contact details are ready.${invoice}`,
      link: requirementId ? `/employer/requirements/${requirementId}` : undefined,
    });
  }

  return {
    kind, order, requirementId,
    unlockedMatchIds: unlockedRows.map((m) => m.id),
    failed,
    candidates: unlockedRows.map(candidateOf),
    invoiceNo: ledger.invoiceNo,
    firstFulfilment,
    refundDueEstimatePaise,
  };
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
