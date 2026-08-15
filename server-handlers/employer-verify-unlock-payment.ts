/* Vercel Serverless Function — Employer Contact-Unlock Payment Verification
 *
 * POST /api/employer-verify-unlock-payment { razorpay_order_id,
 * razorpay_payment_id, razorpay_signature } → verifies the Razorpay HMAC
 * signature, re-derives matchId/employerId from the order's server-written
 * notes (never the client body), re-checks ownership + closed status, then
 * unlocks the match and returns the candidate's contact details.
 *
 * Node runtime — reuses the same crypto.createHmac/timingSafeEqual path as
 * verify-payment.ts via _payment-verification.ts. employer_unlock_payments'
 * unique constraint on razorpay_payment_id is the dedup lock: a retried
 * verify call for an already-processed payment gets a 409 on insert and is
 * answered idempotently rather than double-unlocking.
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
} from "./_shared";
import { verifyRazorpaySignature, buildSignaturePayload } from "./_payment-verification";
import {
  validatePaymentIdsFormat,
  isOversizedRequest,
  verifyOrderOwnership,
  isClosedAndLocked,
  buildUnlockResponsePayload,
} from "./_employer-unlock-verify-helpers";

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();

interface MatchRow {
  id: string;
  requirement_id: string;
  candidate_user_id: string;
  unlocked: boolean;
}

interface RequirementRow {
  id: string;
  status: string;
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
    const authRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${authToken}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!authRes.ok) return res.status(401).json({ error: "Unauthorized" });
    try {
      const userData = await authRes.json();
      employerId = userData.id;
    } catch {
      return res.status(401).json({ error: "Auth verification failed" });
    }
  }
  if (!employerId) {
    return res.status(401).json({ error: "Authentication required" });
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
    const rzpAuth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
    const rzpAc = new AbortController();
    const rzpTimer = setTimeout(() => rzpAc.abort(), 8_000);
    let orderData: { amount: number; notes?: { employerId?: string; matchId?: string } };
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
    const matchId = orderData.notes?.matchId || "";
    if (!verifyOrderOwnership({ notedEmployerId, matchId, employerId })) {
      console.error("Employer unlock order/employer mismatch for order", razorpay_order_id.slice(0, 8) + "...");
      return res.status(403).json({ error: "Forbidden" });
    }

    const matchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}&select=id,requirement_id,candidate_user_id,unlocked`,
      { headers: supabaseServiceHeaders() },
    );
    const matchRows = (await matchRes.json().catch(() => [])) as MatchRow[];
    const match = matchRows[0];
    if (!matchRes.ok || !match) {
      return res.status(404).json({ error: "Match not found" });
    }

    const reqRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(match.requirement_id)}&employer_id=eq.${encodeURIComponent(employerId)}&select=id,status`,
      { headers: supabaseServiceHeaders() },
    );
    const reqRows = (await reqRes.json().catch(() => [])) as RequirementRow[];
    if (!reqRes.ok || !reqRows[0]) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (isClosedAndLocked(reqRows[0].status, match.unlocked)) {
      return res.status(409).json({ error: "This requirement is closed" });
    }

    // Dedup lock: employer_unlock_payments.razorpay_payment_id is unique.
    // A 409 here means this payment was already recorded — respond
    // idempotently with the current (already-unlocked) contact details
    // instead of unlocking/inserting a second time.
    const dedupRes = await fetch(`${SUPABASE_URL}/rest/v1/employer_unlock_payments`, {
      method: "POST",
      headers: { ...supabaseServiceHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({
        match_id: matchId,
        employer_id: employerId,
        razorpay_payment_id,
        razorpay_order_id,
        amount: orderData.amount,
        currency: "INR",
      }),
    });
    const alreadyProcessed = dedupRes.status === 409;
    if (!alreadyProcessed && dedupRes.status !== 201) {
      const t = await dedupRes.text().catch(() => "");
      console.error("employer_unlock_payments insert failed:", dedupRes.status, t.slice(0, 200));
      return res.status(500).json({ error: "Failed to record payment" });
    }

    if (!match.unlocked) {
      const patchRes = await fetch(
        `${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}`,
        {
          method: "PATCH",
          headers: { ...supabaseServiceHeaders(), Prefer: "return=minimal" },
          body: JSON.stringify({ unlocked: true, unlocked_at: new Date().toISOString() }),
        },
      );
      if (!patchRes.ok) {
        const t = await patchRes.text().catch(() => "");
        console.error("employer unlock patch failed:", patchRes.status, t.slice(0, 200));
        return res.status(500).json({ error: "Failed to unlock candidate" });
      }
    }

    const profileRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(match.candidate_user_id)}&select=name,email`,
      { headers: supabaseServiceHeaders() },
    );
    const profileRows = (await profileRes.json().catch(() => [])) as Array<{ name: string; email: string }>;
    const profile = profileRows[0];

    return res.status(200).json(buildUnlockResponsePayload({ matchId, profile }));
  } catch (err) {
    console.error("employer-verify-unlock-payment error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
