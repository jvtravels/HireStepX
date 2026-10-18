/* Vercel Serverless Function — Employer Contact-Unlock Payment Verification
 *
 * POST /api/employer-verify-unlock-payment { razorpay_order_id,
 * razorpay_payment_id, razorpay_signature } → verifies the Razorpay HMAC
 * signature, re-fetches the payment from Razorpay and requires it to be
 * "captured" for THIS order, then delegates to the shared
 * fulfillUnlockOrder() (_unlock-fulfillment.ts) — the same function the
 * Razorpay webhook and the reconciliation cron call. The browser callback is
 * therefore only a fast path: if the tab is closed after paying, the webhook
 * fulfils the order anyway.
 *
 * Node runtime — reuses the crypto.createHmac/timingSafeEqual path from
 * verify-payment.ts via _payment-verification.ts.
 *
 * Response (200): { unlocked: true, candidates: [{ matchId, name, contact }],
 * orderId, orderStatus, invoiceNo } plus, when some candidates could not be
 * unlocked (blocked / opted out / removed since the order was created):
 * { partial: true, message, failed: [{ matchId, reason }],
 * refundDueEstimatePaise }. `candidates` is always an array.
 * 409 { code: "payment_not_captured", pending } — payment authorised but not
 * captured yet; the webhook will unlock it, the client may retry.
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
import { verifyRazorpaySignature, buildSignaturePayload } from "./_payment-verification";
import {
  validatePaymentIdsFormat,
  isOversizedRequest,
  buildBatchUnlockResponsePayload,
} from "./_employer-unlock-verify-helpers";
import {
  fulfillUnlockOrder,
  fetchRazorpayPayment,
  fetchRazorpayOrder,
  loadUnlockOrder,
  backfillLegacyUnlockOrder,
  alertUnlockProblem,
  type CapturedPayment,
} from "./_unlock-fulfillment";

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();

/** Authorised-but-not-yet-captured is common for a second or two on UPI/card;
 *  look once more before telling the buyer to wait for the webhook. */
async function fetchPaymentWithCaptureRetry(paymentId: string): Promise<CapturedPayment | null> {
  let payment = await fetchRazorpayPayment(paymentId, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET);
  if (payment && payment.status !== "captured" && (payment.status === "authorized" || payment.status === "created")) {
    await new Promise((r) => setTimeout(r, 1_500));
    payment = (await fetchRazorpayPayment(paymentId, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) ?? payment;
  }
  return payment;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = applyCorsHeaders(req, res);
  const requestId = withRequestId({})["X-Request-ID"];
  res.setHeader("X-Request-ID", requestId);
  if (handlePreflightAndMethod(req, res)) return;

  const bodyContentLength = parseInt((req.headers["content-length"] as string) || "0", 10);
  const bodyBytes = req.body != null ? Buffer.byteLength(JSON.stringify(req.body), "utf8") : 0;
  if (isOversizedRequest(bodyContentLength, bodyBytes, 4_096)) {
    return res.status(413).json({ error: "Request too large" });
  }

  if (!origin) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const ip = getVercelClientIp(req);
  if (await isRateLimited(ip, "employer-verify-unlock-payment", 10, 60_000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please try again shortly.", retryAfter: 60 });
  }

  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    slog.error("Missing Razorpay env vars for employer unlock verification", { code: "unlock_verify_not_configured", requestId });
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
  // IPs, exceed the intended per-account cap on payment verification — pair
  // it with a per-employer bucket the same way every edge-runtime endpoint
  // does via withAuthAndRateLimit.
  if (await isRateLimited(`user:${employerId}`, "employer-verify-unlock-payment", 15, 60_000)) {
    res.setHeader("Retry-After", "60");
    return res.status(429).json({ error: "Too many requests. Please try again shortly.", retryAfter: 60 });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Missing payment details" });
    }
    if (!validatePaymentIdsFormat({ orderId: razorpay_order_id, paymentId: razorpay_payment_id, signature: razorpay_signature })) {
      return res.status(400).json({ error: "Invalid payment details format" });
    }

    const signPayload = buildSignaturePayload({ orderId: razorpay_order_id, paymentId: razorpay_payment_id });
    if (!verifyRazorpaySignature(signPayload, razorpay_signature, RAZORPAY_KEY_SECRET)) {
      slog.warn("Employer unlock signature mismatch", { code: "unlock_verify_signature_mismatch", requestId, employerId, orderRef: razorpay_order_id.slice(0, 8) });
      return res.status(400).json({ error: "Payment signature verification failed" });
    }

    const sh = supabaseServiceHeaders();

    // The payment must exist at Razorpay, belong to this order and be
    // captured — a valid signature alone only proves the checkout completed.
    const payment = await fetchPaymentWithCaptureRetry(razorpay_payment_id);
    if (!payment) {
      return res.status(502).json({ error: "Could not confirm the payment with the gateway. Please retry in a moment." });
    }
    if (payment.orderId && payment.orderId !== razorpay_order_id) {
      slog.warn("Employer unlock payment/order mismatch", { code: "unlock_verify_order_mismatch", requestId, employerId, orderRef: razorpay_order_id.slice(0, 8) });
      return res.status(400).json({ error: "Invalid payment details" });
    }
    if (payment.status !== "captured") {
      const pending = payment.status === "authorized" || payment.status === "created";
      return res.status(409).json({
        error: pending
          ? "Your payment is still being confirmed. Your contact unlock will complete automatically within a few minutes."
          : "This payment was not completed.",
        code: "payment_not_captured",
        pending,
        orderId: razorpay_order_id,
      });
    }

    let order = await loadUnlockOrder(SUPABASE_URL, sh, razorpay_order_id);
    if (order === "error") return res.status(500).json({ error: "Internal error" });
    if (!order) {
      // Created before employer_unlock_orders existed — rebuild the row from
      // the order's server-written notes (never from the client body).
      const rzpOrder = await fetchRazorpayOrder(razorpay_order_id, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET);
      order = rzpOrder
        ? await backfillLegacyUnlockOrder({
            supabaseUrl: SUPABASE_URL, headers: sh, razorpayOrderId: razorpay_order_id,
            amount: rzpOrder.amount, notes: rzpOrder.notes, employerId,
          })
        : null;
      if (!order) {
        slog.warn("Employer unlock order not found / not owned", { code: "unlock_verify_order_not_owned", requestId, employerId, orderRef: razorpay_order_id.slice(0, 8) });
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    const result = await fulfillUnlockOrder({
      supabaseUrl: SUPABASE_URL,
      headers: sh,
      razorpayOrderId: razorpay_order_id,
      payment,
      expectEmployerId: employerId,
    });
    slog.info("employer unlock verify", { code: "unlock_verify_result", requestId, employerId, orderId: razorpay_order_id, result: result.kind });

    switch (result.kind) {
      case "fulfilled":
      case "partial": {
        // Fulfilment already masks the name and drops the email for a candidate who has since withdrawn, declined or
        // blocked this employer (or when the employer is suspended); an empty contact is what the client sees.
        const profileByMatchId = new Map(result.candidates.map((c) => [c.matchId, { name: c.name, email: c.email }]));
        const payload = buildBatchUnlockResponsePayload({ matchIds: result.unlockedMatchIds, profileByMatchId });
        const base = { ...payload, orderId: razorpay_order_id, orderStatus: result.kind, invoiceNo: result.invoiceNo };
        if (result.kind === "partial") {
          return res.status(200).json({
            ...base,
            partial: true,
            failed: result.failed,
            refundDueEstimatePaise: result.refundDueEstimatePaise,
            message: `Payment received. ${result.failed.length} of ${result.order.match_ids.length} candidate${result.order.match_ids.length === 1 ? "" : "s"} could not be unlocked (the candidate withdrew, blocked this account, or the job was edited). ${result.returnedCreditPaise > 0 ? "The value of that portion was added to your account credit and applies to your next unlock" : "We will refund that portion"}; contact support@hirestepx.com with order id ${razorpay_order_id} if you do not see it.`,
          });
        }
        return res.status(200).json(base);
      }
      case "refunded":
      case "disputed":
        return res.status(409).json({
          error: result.kind === "refunded" ? "This payment has been refunded." : "This payment is under dispute.",
          code: `order_${result.kind}`,
          orderId: razorpay_order_id,
        });
      case "converted_to_credit":
        // A late payment whose credit could not be re-applied: nothing was unlocked, the cash is now account credit.
        return res.status(409).json({
          error: "Your payment arrived after this order expired, so it was added to your account credit instead. Unlock the candidates again to use it.",
          code: "order_converted_to_credit",
          creditPaise: result.creditPaise,
          orderId: razorpay_order_id,
        });
      case "not_found":
        return res.status(403).json({ error: "Forbidden" });
      case "not_captured":
        return res.status(409).json({ error: "Payment not captured yet", code: "payment_not_captured", pending: true, orderId: razorpay_order_id });
      case "error":
        if (result.code === "forbidden") return res.status(403).json({ error: "Forbidden" });
        if (result.code === "amount_mismatch" || result.code === "currency_mismatch" || result.code === "order_mismatch" || result.code === "duplicate_payment") {
          await alertUnlockProblem({
            kind: "unlock_not_fulfilled", key: razorpay_order_id,
            subject: "Payment captured but not fulfilled",
            detail: `Employer unlock order ${razorpay_order_id} (payment ${razorpay_payment_id}) is captured but was rejected: ${result.code}. Manual review or refund needed.`,
            distinctId: employerId,
          });
          return res.status(400).json({ error: "Invalid order", orderId: razorpay_order_id });
        }
        slog.error("employer unlock fulfilment failed", { code: "unlock_verify_fulfilment_failed", requestId, employerId, orderId: razorpay_order_id, message: result.message });
        await alertUnlockProblem({
          kind: "unlock_not_fulfilled", key: razorpay_order_id,
          subject: "Payment captured but not fulfilled",
          detail: `Employer unlock order ${razorpay_order_id} (payment ${razorpay_payment_id}) was captured but fulfilment failed (${result.message}). The webhook and reconciler retry; check it completes.`,
          distinctId: employerId,
        });
        // The order stays 'paid' and the webhook/reconciler retries — tell the buyer so.
        return res.status(500).json({ error: "Payment received but the unlock could not be completed yet. It will be retried automatically.", orderId: razorpay_order_id });
    }
  } catch (err) {
    slog.error("employer-verify-unlock-payment threw", { code: "unlock_verify_unexpected_error", requestId, employerId, err: err instanceof Error ? err.message : String(err) });
    return res.status(500).json({ error: "Internal error" });
  }
}
