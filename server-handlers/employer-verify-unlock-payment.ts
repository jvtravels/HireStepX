/* Vercel Serverless Function — Employer Contact-Unlock Payment Verification
 *
 * POST /api/employer-verify-unlock-payment { razorpay_order_id,
 * razorpay_payment_id, razorpay_signature } → verifies the Razorpay HMAC
 * signature, re-derives mode/matchIds/employerId from the order's
 * server-written notes (never the client body), re-checks ownership +
 * closed status, then unlocks every match the order covers (one for
 * "single" mode, up to UNLOCK_BUNDLE_SIZE for "batch") and returns their
 * contact details.
 *
 * Node runtime — reuses the same crypto.createHmac/timingSafeEqual path as
 * verify-payment.ts via _payment-verification.ts. employer_unlock_payments'
 * unique constraint on razorpay_payment_id is the dedup lock: a retried
 * verify call for an already-processed payment gets a 409 on insert and is
 * answered idempotently rather than double-unlocking. One row per payment
 * covers the whole set of matches (match_id for a single unlock, match_ids
 * for a batch — see supabase-migrations/0015).
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
} from "./_shared";
import { verifyRazorpaySignature, buildSignaturePayload } from "./_payment-verification";
import { razorpayBasicAuth } from "./_razorpay-auth";
import {
  validatePaymentIdsFormat,
  isOversizedRequest,
  verifyOrderOwnership,
  parseNotedMatchIds,
  buildBatchUnlockResponsePayload,
} from "./_employer-unlock-verify-helpers";
import { notify } from "./_notify";
import { patchMatchUnlocked } from "./_unlock-apply";

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();

interface MatchRow {
  id: string;
  requirement_id: string;
  candidate_user_id: string;
  unlocked: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = applyCorsHeaders(req, res);
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
    console.error("Missing Razorpay env vars for employer unlock verification");
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
      console.error("Employer unlock signature mismatch for order", razorpay_order_id.slice(0, 8) + "...");
      return res.status(400).json({ error: "Payment signature verification failed" });
    }

    // Re-fetch the order — notes.employerId/notes.matchId and the amount are
    // server-written at order-creation time and never trusted from the client.
    const rzpAuth = razorpayBasicAuth(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET);
    const rzpAc = new AbortController();
    const rzpTimer = setTimeout(() => rzpAc.abort(), 8_000);
    let orderData: { amount: number; notes?: { employerId?: string; mode?: string; matchIds?: string } };
    try {
      const orderRes = await fetch(`https://api.razorpay.com/v1/orders/${razorpay_order_id}`, {
        headers: { Authorization: `Basic ${rzpAuth}` },
        signal: rzpAc.signal,
      });
      if (!orderRes.ok) throw new Error(`order fetch failed: ${orderRes.status}`);
      orderData = await orderRes.json();
    } finally {
      clearTimeout(rzpTimer);
    }

    const notedEmployerId = orderData.notes?.employerId || "";
    const isBatch = orderData.notes?.mode === "batch";
    const matchIds = parseNotedMatchIds(orderData.notes?.matchIds || "");
    if (!verifyOrderOwnership({ notedEmployerId, matchId: matchIds.join(","), employerId }) || matchIds.length === 0) {
      console.error("Employer unlock order/employer mismatch for order", razorpay_order_id.slice(0, 8) + "...");
      return res.status(403).json({ error: "Forbidden" });
    }

    // Record the payment BEFORE touching match rows. Razorpay has already
    // captured the money by this point — a concurrent edit/reopen (which
    // re-runs matching) can delete or replace the exact match rows this
    // order's notes reference between order-creation and verification, and
    // that must never make a captured payment vanish without a database
    // record (C1). employer_unlock_payments.razorpay_payment_id's unique
    // constraint is the dedup lock: a 409 here means this payment was
    // already recorded — respond idempotently instead of double-processing.
    const dedupRes = await fetch(`${SUPABASE_URL}/rest/v1/employer_unlock_payments`, {
      method: "POST",
      headers: { ...supabaseServiceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify(
        isBatch
          ? { match_ids: matchIds, employer_id: employerId, razorpay_payment_id, razorpay_order_id, amount: orderData.amount, currency: "INR" }
          : { match_id: matchIds[0], employer_id: employerId, razorpay_payment_id, razorpay_order_id, amount: orderData.amount, currency: "INR" },
      ),
    });
    const alreadyProcessed = dedupRes.status === 409;
    if (!alreadyProcessed && dedupRes.status !== 201) {
      const t = await dedupRes.text().catch(() => "");
      console.error("employer_unlock_payments insert failed:", dedupRes.status, t.slice(0, 200));
      return res.status(500).json({ error: "Failed to record payment" });
    }

    const idParam = matchIds.map((id) => encodeURIComponent(id)).join(",");
    const matchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?id=in.(${idParam})&select=id,requirement_id,candidate_user_id,unlocked`,
      { headers: supabaseServiceHeaders() },
    );
    const matchRows = (await matchRes.json().catch(() => [])) as MatchRow[];
    if (!matchRes.ok || matchRows.length === 0) {
      // Payment is already recorded above — the matches it was meant to
      // unlock were removed from under it (e.g. a concurrent edit/reopen).
      // Surface this as a reconciliation case rather than a bare 404 that
      // implies nothing happened to the employer's money.
      console.error("Employer unlock payment recorded but target matches are gone for order", razorpay_order_id.slice(0, 8) + "...");
      return res.status(200).json({
        unlocked: [],
        partial: true,
        message: "Payment received, but these candidates are no longer available (the job may have been edited). Contact support@hirestepx.com with this order id for a refund or credit.",
        orderId: razorpay_order_id,
      });
    }
    const requirementId = matchRows[0].requirement_id;
    if (matchRows.some((m) => m.requirement_id !== requirementId)) {
      console.error("Employer unlock order spans multiple requirements for order", razorpay_order_id.slice(0, 8) + "...");
      return res.status(400).json({ error: "Invalid order" });
    }

    const missingCount = matchIds.length - matchRows.length;
    const stillLocked = matchRows.filter((m) => !m.unlocked).map((m) => m.id);

    // Fetch profiles before unlocking so the name/email snapshot below can
    // ride along in the same PATCH as the unlock flag — see
    // supabase-migrations/0026-unlock-candidate-snapshot.sql: without this,
    // a candidate later deleting their account cascades away the match row
    // and leaves the employer's unlock history unable to say who it was for.
    const candidateIdParam = matchRows.map((m) => encodeURIComponent(m.candidate_user_id)).join(",");
    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=in.(${candidateIdParam})&select=id,name,email`,
      { headers: supabaseServiceHeaders() },
    );
    const profileRows = (await profileRes.json().catch(() => [])) as Array<{ id: string; name: string; email: string }>;
    const profileById = new Map(profileRows.map((p) => [p.id, p]));
    const profileByMatchId = new Map(matchRows.map((m) => [m.id, profileById.get(m.candidate_user_id)]));

    if (stillLocked.length > 0) {
      const unlockedAt = new Date().toISOString();
      const patchResults = await Promise.all(
        stillLocked.map((matchId) =>
          patchMatchUnlocked({
            supabaseUrl: SUPABASE_URL,
            headers: supabaseServiceHeaders(),
            matchId,
            unlockedAt,
            profile: profileByMatchId.get(matchId),
          }),
        ),
      );
      const failed = patchResults.find((r) => !r.ok);
      if (failed) {
        const t = await failed.text().catch(() => "");
        console.error("employer unlock patch failed:", failed.status, t.slice(0, 200));
        return res.status(500).json({ error: "Failed to unlock candidate" });
      }
    }

    const payload = buildBatchUnlockResponsePayload({ matchIds: matchRows.map((m) => m.id), profileByMatchId });
    if (!alreadyProcessed) {
      void notify({
        userId: employerId,
        type: "unlock_confirmed",
        title: isBatch ? "Candidate contacts unlocked" : "Candidate contact unlocked",
        body: isBatch
          ? `Payment confirmed — ${matchRows.length} candidate contact${matchRows.length === 1 ? "" : "s"} unlocked.`
          : "Payment confirmed — the candidate's contact details are ready.",
        link: `/employer/requirements/${requirementId}`,
      });
    }
    if (missingCount > 0) {
      return res.status(200).json({
        ...payload,
        partial: true,
        message: `Payment received. ${missingCount} of ${matchIds.length} candidates could not be unlocked (the job may have been edited); contact support@hirestepx.com with this order id for a refund or credit on those.`,
        orderId: razorpay_order_id,
      });
    }
    return res.status(200).json(payload);
  } catch (err) {
    console.error("employer-verify-unlock-payment error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
