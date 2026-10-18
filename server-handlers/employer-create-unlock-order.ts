/* Vercel Serverless Function — Employer Contact-Unlock Order Creation
 *
 * POST /api/employer-create-unlock-order { mode: "single", matchId } or
 * { mode: "batch", requirementId } → creates a Razorpay order for
 * unlocking contact details. Node runtime (not edge) to reuse the same
 * Buffer-based Basic-auth + HMAC verification path as
 * create-order.ts/verify-payment.ts — there is no edge-compatible
 * precedent for Razorpay signature handling anywhere in this codebase.
 *
 * "single" charges UNLOCK_SINGLE_PRICE_PAISE for exactly one match.
 * "batch" always targets the requirement's next not-fully-unlocked batch
 * of UNLOCK_BUNDLE_SIZE candidates (by match_score rank) and charges the
 * flat UNLOCK_BATCH_PRICE_PAISE for it — see _unlock-pricing.ts, the sole
 * source of truth for amounts. The client never supplies or confirms an
 * amount pre-charge; which matches a batch order actually covers is
 * server-derived and written into the order's notes for verification to
 * unlock later.
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  applyCorsHeaders,
  handlePreflightAndMethod,
  isRateLimited,
  getVercelClientIp,
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceHeaders,
  verifyEmployerAuthToken,
  withRequestId,
  slog,
} from "./_shared";
import { singleUnlockPrice, batchUnlockPrice, formatPaise, creditToApply } from "./_unlock-pricing";
import { loadRankedVisibleMatches, nextUnlockBatchQuote } from "./_employer-matching-helpers";
import { razorpayBasicAuth } from "./_razorpay-auth";
import { loadEmployerMatchAccess, loadAuthIdentity, DENIED_STATUS } from "./_entitlements";
import { deriveEmployerTier, isSuspended, type EmployerTier } from "./_employer-trust";
import {
  isUuid,
  decideUnlockLimit,
  pendingOrderMatchCount,
  findReusableOrder,
  findOverlappingOrder,
  loadOpenOrders,
  countUnlocksLast24h,
  insertUnlockOrder,
  tryCreateLock,
  releaseCreateLock,
} from "./_employer-unlock-order";
import type { UnlockOrderRow } from "./_unlock-fulfillment";
import { creditBalance, spendCreditDetailed, releaseCredit } from "./_employer-credit";
import { captureServerEvent } from "./_posthog";
import { isCreditOrderRef, newCreditOrderRef, settleCreditOrder } from "./_employer-credit-unlock";

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

// Double-click guard only (optimisation). Correctness for duplicate orders is
// the DB's partial unique index on employer_unlock_orders, which still holds
// when Upstash is down.
const LOCK_TTL = 15; // seconds

interface RequirementRow {
  id: string;
  status: string;
  employers?: { website?: string | null; suspended_at?: string | null; verification_tier?: string | null } | null;
}

function orderResponse(order: Pick<UnlockOrderRow, "razorpay_order_id" | "amount" | "currency" | "mode" | "match_ids">, extra: Record<string, unknown> = {}) {
  const price = order.mode === "single" ? singleUnlockPrice() : batchUnlockPrice(order.match_ids.length);
  return {
    orderId: order.razorpay_order_id,
    amount: order.amount,
    currency: order.currency,
    keyId: RAZORPAY_KEY_ID,
    name: price.label,
    description: "Employer contact unlock — HireStepX",
    creditAppliedPaise: Math.max(0, price.amountPaise - order.amount),
    ...extra,
  };
}

/** Finishes a credit-only order (new or retried) and shapes the response the
 *  verify endpoint would have produced for a paid one. */
async function creditOrderResponse(
  supabaseUrl: string, headers: Record<string, string>, order: UnlockOrderRow,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const settled = await settleCreditOrder({ supabaseUrl, headers, order, expectEmployerId: order.employer_id });
  if (settled.kind === "fulfilled" || settled.kind === "partial") {
    // settleCreditOrder -> fulfillUnlockOrder already blanks the email and masks the name of a candidate who has
    // since withdrawn, declined or blocked this employer (or when the employer is suspended), including on a replay.
    const candidates = settled.candidates.map((c) => ({ matchId: c.matchId, name: c.name || "Candidate", contact: { email: c.email || "" } }));
    const creditAppliedPaise = (order.mode === "single" ? singleUnlockPrice() : batchUnlockPrice(order.match_ids.length)).amountPaise;
    return {
      status: 200,
      body: {
        ...orderResponse(order, { paidWithCredit: true }),
        unlocked: true,
        candidates,
        orderStatus: settled.kind,
        invoiceNo: settled.invoiceNo,
        creditAppliedPaise,
        ...(settled.kind === "partial"
          ? { partial: true, failed: settled.failed, message: `${settled.failed.length} of ${order.match_ids.length} candidate${order.match_ids.length === 1 ? "" : "s"} could not be unlocked. The credit for them was returned to your balance.` }
          : {}),
      },
    };
  }
  if (settled.kind === "no_credit") {
    return { status: 409, body: { error: "Your credit balance changed. Please review the price and try again.", code: "credit_changed" } };
  }
  return { status: 500, body: { error: "The unlock could not be completed yet. It will be retried automatically." } };
}

/** Closes an order whose credit could not be taken. Any credit that WAS taken (a spend whose
 *  response was lost) is released, so a failed order never holds the employer's credit. */
async function markOrderFailed(
  supabaseUrl: string, headers: Record<string, string>, orderRef: string, employerId: string, reason: string,
): Promise<void> {
  void captureServerEvent("employer_unlock_failed", employerId, { orderId: orderRef, reason });
  await fetch(`${supabaseUrl}/rest/v1/employer_unlock_orders?razorpay_order_id=eq.${encodeURIComponent(orderRef)}&status=eq.created`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ status: "failed", updated_at: new Date().toISOString() }),
  }).catch(() => null);
  await releaseCredit(supabaseUrl, headers, employerId, orderRef);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = applyCorsHeaders(req, res);
  const requestId = withRequestId({})["X-Request-ID"];
  res.setHeader("X-Request-ID", requestId);
  if (handlePreflightAndMethod(req, res)) return;

  const bodyContentLength = parseInt((req.headers["content-length"] as string) || "0", 10);
  const bodyBytes = req.body != null ? Buffer.byteLength(JSON.stringify(req.body), "utf8") : 0;
  if (bodyContentLength > 4_096 || bodyBytes > 4_096) {
    return res.status(413).json({ error: "Request too large" });
  }

  if (!origin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const ip = getVercelClientIp(req);
  if (await isRateLimited(ip, "employer-create-unlock-order", 10, 60_000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please try again shortly.", retryAfter: 60 });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    slog.error("Missing Razorpay env vars for employer unlock", { code: "unlock_create_not_configured", requestId });
    return res.status(503).json({ error: "Payments not configured. Please contact support@hirestepx.com" });
  }

  const SUPABASE_URL = supabaseUrl();
  const SUPABASE_ANON_KEY = supabaseAnonKey();
  let employerId: string | undefined;
  const authToken = (req.headers.authorization || "").replace("Bearer ", "");
  if (authToken && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const authResult = await verifyEmployerAuthToken(authToken, SUPABASE_URL, SUPABASE_ANON_KEY);
    if (authResult.kind === "auth-fail") return res.status(401).json({ error: "Unauthorized" });
    if (authResult.kind === "transient") return res.status(401).json({ error: "Auth verification failed" });
    employerId = authResult.employerId;
  }
  if (!employerId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  // IP-only limiting lets one employer account, spread across a handful of
  // IPs (corporate NAT, mobile network switches), exceed the intended
  // per-account cap on order creation — pair it with a per-employer bucket
  // the same way every edge-runtime endpoint does via withAuthAndRateLimit.
  if (await isRateLimited(`user:${employerId}`, "employer-create-unlock-order", 15, 60_000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please try again shortly.", retryAfter: 60 });
  }

  const mode = req.body?.mode === "batch" ? "batch" : "single";
  const matchId = typeof req.body?.matchId === "string" ? req.body.matchId.slice(0, 64) : "";
  const expectedAmountPaise = Number.isInteger(req.body?.expectedAmountPaise) ? (req.body.expectedAmountPaise as number) : null;
  const requirementId = typeof req.body?.requirementId === "string" ? req.body.requirementId.slice(0, 64) : "";
  if (mode === "single" && !matchId) {
    return res.status(400).json({ error: "matchId is required" });
  }
  if (mode === "batch" && !requirementId) {
    return res.status(400).json({ error: "requirementId is required" });
  }
  if ((mode === "single" && !isUuid(matchId)) || (mode === "batch" && !isUuid(requirementId))) {
    return res.status(400).json({ error: "Invalid id" });
  }

  const sh = supabaseServiceHeaders();
  let lockKey = "";
  try {
    const identity = await loadAuthIdentity(SUPABASE_URL, sh, employerId);
    let tier: EmployerTier;
    let orderRequirementId: string;
    let targetMatchIds: string[];

    if (mode === "single") {
      const decision = await loadEmployerMatchAccess({
        supabaseUrl: SUPABASE_URL, headers: sh, employerId, matchId,
        authEmail: identity.email, emailConfirmed: identity.emailConfirmed,
      });
      if (!decision.ok) {
        if (decision.reason === "error") throw new Error("match read failed");
        const denied = DENIED_STATUS[decision.reason];
        return res.status(denied.status).json({ error: denied.error, code: decision.reason });
      }
      const { access } = decision;
      if (access.unlocked) {
        return res.status(409).json({ error: "This candidate is already unlocked" });
      }
      if (!access.requirementOpen) {
        return res.status(409).json({ error: "This requirement is closed" });
      }
      tier = access.tier;
      orderRequirementId = access.match.requirement_id;
      targetMatchIds = [matchId];
    } else {
      const reqRes = await fetch(
        `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(requirementId)}&employer_id=eq.${encodeURIComponent(employerId)}` +
          `&select=id,status,employers(website,suspended_at,verification_tier)`,
        { headers: sh },
      );
      const reqRows = (await reqRes.json().catch(() => [])) as RequirementRow[];
      if (!reqRes.ok || !reqRows[0]) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (isSuspended(reqRows[0].employers)) {
        return res.status(403).json({ error: DENIED_STATUS.suspended.error, code: "suspended" });
      }
      if (reqRows[0].status === "closed") {
        return res.status(409).json({ error: "This requirement is closed" });
      }
      tier = deriveEmployerTier({
        storedTier: reqRows[0].employers?.verification_tier,
        email: identity.email,
        emailConfirmed: identity.emailConfirmed,
        website: reqRows[0].employers?.website ?? null,
      });

      const matchesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&select=id,candidate_user_id,match_score,unlocked,candidate_status,candidate_status_note,interview_scheduled_at&order=match_score.desc,id.asc&limit=5000`,
        { headers: sh },
      );
      if (!matchesRes.ok) throw new Error(`matches read failed: ${matchesRes.status}`);
      const matches = (await matchesRes.json().catch(() => [])) as Array<{
        id: string; candidate_user_id: string; match_score: number; unlocked: boolean;
        candidate_status: string | null; candidate_status_note: string | null; interview_scheduled_at: string | null;
      }>;

      // Same visible ranked list the requirement page shows, so the batch
      // window and price here match the "Unlock N–M" button the employer saw.
      const gated = await loadRankedVisibleMatches(SUPABASE_URL, sh, employerId, matches);
      if (!gated) throw new Error("candidate consent read failed");
      const quote = nextUnlockBatchQuote(gated.ranked);
      if (!quote) {
        if (matches.some((m) => !m.unlocked)) {
          return res.status(409).json({
            error: "None of the candidates in this batch are currently available to unlock",
            code: "no_eligible_candidates",
          });
        }
        return res.status(409).json({ error: "All candidates are already unlocked" });
      }
      // Never charge for a candidate the employer can't actually reach (opted
      // out, blocked) — they are dropped from this batch and from its price.
      const decisions = await Promise.all(
        quote.matchIds.map((id) =>
          loadEmployerMatchAccess({
            supabaseUrl: SUPABASE_URL, headers: sh, employerId, matchId: id,
            authEmail: identity.email, emailConfirmed: identity.emailConfirmed,
          }),
        ),
      );
      if (decisions.some((d) => !d.ok && d.reason === "error")) throw new Error("match access read failed");
      targetMatchIds = quote.matchIds.filter((_, i) => decisions[i].ok);
      if (targetMatchIds.length === 0) {
        return res.status(409).json({
          error: "None of the candidates in this batch are currently available to unlock",
          code: "no_eligible_candidates",
        });
      }
      orderRequirementId = requirementId;

      // The client states the amount it showed the employer; if the batch
      // changed underneath them (candidate withdrew, rows re-ranked) refuse
      // and hand back the fresh quote rather than charge a different sum.
      const actual = batchUnlockPrice(targetMatchIds.length);
      if (expectedAmountPaise !== null && expectedAmountPaise !== actual.amountPaise) {
        return res.status(409).json({
          error: `This batch is now ${formatPaise(actual.amountPaise)} for ${targetMatchIds.length} candidate${targetMatchIds.length === 1 ? "" : "s"} (it was ${formatPaise(expectedAmountPaise)}). Close this and review the updated price.`,
          code: "price_changed",
          quote: { start: quote.start, end: quote.end, count: targetMatchIds.length, amountPaise: actual.amountPaise },
        });
      }
    }

    const nowMs = Date.now();
    const openOrders = await loadOpenOrders(SUPABASE_URL, sh, employerId);
    if (!openOrders) {
      slog.error("employer-create-unlock-order open-order lookup failed", { code: "unlock_create_open_order_lookup_failed", requestId, employerId });
      return res.status(503).json({ error: "Payments are temporarily unavailable. Please try again shortly." });
    }

    // Retry / double-click / second tab: hand back the existing unpaid order.
    const reusable = findReusableOrder(openOrders, mode, targetMatchIds);
    if (reusable) {
      if (isCreditOrderRef(reusable.razorpay_order_id)) {
        const done = await creditOrderResponse(SUPABASE_URL, sh, reusable);
        return res.status(done.status).json(done.body);
      }
      return res.status(200).json(orderResponse(reusable, { reused: true }));
    }

    const overlapping = findOverlappingOrder(openOrders, targetMatchIds, nowMs);
    if (overlapping) {
      return res.status(409).json({
        error: overlapping.status === "paid"
          ? "A payment for this candidate is already being processed. Refresh in a moment."
          : "Another unlock order covering this candidate is already open. Complete or wait for it to expire.",
        code: "order_in_progress",
      });
    }

    const unlockedToday = await countUnlocksLast24h(SUPABASE_URL, sh, employerId, nowMs);
    if (unlockedToday === null) {
      slog.error("employer-create-unlock-order daily unlock count failed", { code: "unlock_create_daily_count_failed", requestId, employerId });
      return res.status(503).json({ error: "Payments are temporarily unavailable. Please try again shortly." });
    }
    const limit = decideUnlockLimit({
      tier,
      used: unlockedToday + pendingOrderMatchCount(openOrders, nowMs),
      requested: targetMatchIds.length,
    });
    if (!limit.ok) {
      res.setHeader("Retry-After", "3600");
      return res.status(429).json({
        error: limit.message,
        code: "unlock_daily_limit",
        limit: limit.limit,
        remaining: limit.remaining,
        tier,
      });
    }

    const price = mode === "single" ? singleUnlockPrice() : batchUnlockPrice(targetMatchIds.length);
    const balance = await creditBalance(SUPABASE_URL, sh, employerId);
    const creditPaise = creditToApply(price.amountPaise, balance ?? 0);
    const cashPaise = price.amountPaise - creditPaise;

    lockKey = `order:${employerId}:unlock:${mode}:${targetMatchIds.slice().sort().join(",")}`;
    const redis = { url: UPSTASH_URL, token: UPSTASH_TOKEN };
    if ((await tryCreateLock(lockKey, redis, LOCK_TTL)) === "held") {
      // Another request is creating this exact order — give it a moment, then
      // reuse its row. If it never appears we proceed anyway: the unique index
      // (single) / reuse check (batch) are what actually prevent duplicates.
      for (let i = 0; i < 3; i++) {
        await new Promise((r) => setTimeout(r, 600));
        const again = await loadOpenOrders(SUPABASE_URL, sh, employerId);
        const hit = again && findReusableOrder(again, mode, targetMatchIds);
        if (hit) return res.status(200).json(orderResponse(hit, { reused: true }));
      }
    }

    if (cashPaise === 0) {
      const inserted = await insertUnlockOrder(SUPABASE_URL, sh, {
        razorpayOrderId: newCreditOrderRef(), employerId, requirementId: orderRequirementId,
        mode, matchIds: targetMatchIds, amount: 0, currency: "INR", creditAppliedPaise: price.amountPaise,
      });
      if (inserted.kind === "conflict" && inserted.order) {
        const done = isCreditOrderRef(inserted.order.razorpay_order_id)
          ? await creditOrderResponse(SUPABASE_URL, sh, inserted.order)
          : { status: 200, body: orderResponse(inserted.order, { reused: true }) };
        return res.status(done.status).json(done.body);
      }
      if (inserted.kind !== "inserted") {
        slog.error("credit unlock order insert failed", { code: "unlock_create_credit_order_insert_failed", requestId, employerId, detail: inserted.kind === "error" ? inserted.detail : "conflict without winner" });
        return res.status(500).json({ error: "Could not start the unlock. Please try again." });
      }
      const spent = await spendCreditDetailed(SUPABASE_URL, sh, employerId, price.amountPaise, inserted.order.razorpay_order_id);
      if (spent.outcome !== "spent") {
        await markOrderFailed(SUPABASE_URL, sh, inserted.order.razorpay_order_id, employerId, spent.outcome === "error" ? "credit_spend_error" : "credit_changed");
        return spent.outcome === "error"
          ? res.status(503).json({ error: "Your credit could not be applied right now. Please try again shortly." })
          : res.status(409).json({ error: "Your credit balance changed. Please review the price and try again.", code: "credit_changed" });
      }
      void captureServerEvent("employer_credit_spent", employerId, { orderId: inserted.order.razorpay_order_id, amountPaise: spent.spent, creditOnly: true });
      const done = await creditOrderResponse(SUPABASE_URL, sh, inserted.order);
      return res.status(done.status).json(done.body);
    }

    const auth = razorpayBasicAuth(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET);
    const receipt = `unlock_${Date.now()}`.slice(0, 40);
    // Razorpay caps note values at 256 chars; a batch's 10 uuids exceed that,
    // so batch notes carry only counts — employer_unlock_orders.match_ids is
    // the authoritative record of which matches an order covers.
    const orderNotes: Record<string, string> = mode === "single"
      ? { employerId, mode, requirementId: orderRequirementId, matchIds: targetMatchIds[0] }
      : { employerId, mode, requirementId: orderRequirementId, matchCount: String(targetMatchIds.length) };

    const ac = new AbortController();
    const acTimer = setTimeout(() => ac.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({ amount: cashPaise, currency: "INR", receipt, notes: orderNotes }),
      });
    } finally {
      clearTimeout(acTimer);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      slog.error("Razorpay order creation failed", { code: "unlock_create_razorpay_failed", requestId, employerId, status: response.status, detail: errText.slice(0, 200) });
      const detail = response.status === 401
        ? "Payment gateway credentials are invalid. Please contact support."
        : "Could not create payment order. Please try again or contact support@hirestepx.com";
      return res.status(502).json({ error: detail });
    }

    const order = await response.json();

    // Persist BEFORE the client can pay: the webhook and the reconciler find
    // the order by razorpay_order_id, so a closed tab after paying still
    // unlocks. The partial unique index turns a racing duplicate single order
    // into a 409 here; we hand back the winner's order instead.
    const inserted = await insertUnlockOrder(SUPABASE_URL, sh, {
      razorpayOrderId: order.id,
      employerId,
      requirementId: orderRequirementId,
      mode,
      matchIds: targetMatchIds,
      amount: order.amount,
      currency: order.currency || "INR",
      creditAppliedPaise: creditPaise,
    });
    if (inserted.kind === "inserted") {
      if (creditPaise > 0) {
        const spent = await spendCreditDetailed(SUPABASE_URL, sh, employerId, creditPaise, inserted.order.razorpay_order_id);
        if (spent.outcome !== "spent") {
          await markOrderFailed(SUPABASE_URL, sh, inserted.order.razorpay_order_id, employerId, spent.outcome === "error" ? "credit_spend_error" : "credit_changed");
          return spent.outcome === "error"
            ? res.status(503).json({ error: "Your credit could not be applied right now. Please try again shortly." })
            : res.status(409).json({ error: "Your credit balance changed. Please review the price and try again.", code: "credit_changed" });
        }
        void captureServerEvent("employer_credit_spent", employerId, { orderId: inserted.order.razorpay_order_id, amountPaise: spent.spent, creditOnly: false });
      }
      return res.status(200).json(orderResponse(inserted.order));
    }
    if (inserted.kind === "conflict" && inserted.order) {
      return res.status(200).json(orderResponse(inserted.order, { reused: true }));
    }
    slog.error("employer_unlock_orders insert failed", { code: "unlock_create_order_insert_failed", requestId, employerId, detail: inserted.kind === "error" ? inserted.detail : "conflict without winner" });
    return res.status(500).json({ error: "Could not start the payment. Please try again." });
  } catch (err) {
    slog.error("employer-create-unlock-order threw", { code: "unlock_create_unexpected_error", requestId, employerId, err: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ error: "Internal error" });
  } finally {
    if (lockKey) void releaseCreateLock(lockKey, { url: UPSTASH_URL, token: UPSTASH_TOKEN });
  }
}
