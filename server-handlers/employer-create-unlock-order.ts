/* Vercel Serverless Function — Employer Contact-Unlock Order Creation
 *
 * POST /api/employer-create-unlock-order { matchId } → creates a Razorpay
 * order for unlocking one candidate's contact details. Node runtime (not
 * edge) to reuse the same Buffer-based Basic-auth + HMAC verification path
 * as create-order.ts/verify-payment.ts — there is no edge-compatible
 * precedent for Razorpay signature handling anywhere in this codebase.
 *
 * Price is tiered by match_score (see _unlock-pricing.ts) and resolved
 * server-side from the stored row — the client never supplies or confirms
 * an amount pre-charge.
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
import { unlockPriceForMatch } from "./_unlock-pricing";

const RAZORPAY_KEY_ID = (process.env.RAZORPAY_KEY_ID || "").trim();
const RAZORPAY_KEY_SECRET = (process.env.RAZORPAY_KEY_SECRET || "").trim();
const UPSTASH_URL = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const UPSTASH_TOKEN = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

const DEDUP_TTL = 90; // seconds — matches create-order.ts's double-click/retry window

interface MatchRow {
  id: string;
  requirement_id: string;
  candidate_user_id: string;
  match_score: number;
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
    console.error("Missing Razorpay env vars for employer unlock");
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

  const matchId = typeof req.body?.matchId === "string" ? req.body.matchId.slice(0, 64) : "";
  if (!matchId) {
    return res.status(400).json({ error: "matchId is required" });
  }

  try {
    const matchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/requirement_matches?id=eq.${encodeURIComponent(matchId)}&select=id,requirement_id,candidate_user_id,match_score,unlocked`,
      { headers: supabaseServiceHeaders() },
    );
    if (!matchRes.ok) throw new Error(`match read failed: ${matchRes.status}`);
    const matchRows = (await matchRes.json().catch(() => [])) as MatchRow[];
    const match = matchRows[0];
    if (!match) {
      return res.status(404).json({ error: "Match not found" });
    }
    if (match.unlocked) {
      return res.status(409).json({ error: "This candidate is already unlocked" });
    }

    const reqRes = await fetch(
      `${SUPABASE_URL}/rest/v1/employer_requirements?id=eq.${encodeURIComponent(match.requirement_id)}&employer_id=eq.${encodeURIComponent(employerId)}&select=id,status`,
      { headers: supabaseServiceHeaders() },
    );
    const reqRows = (await reqRes.json().catch(() => [])) as RequirementRow[];
    if (!reqRes.ok || !reqRows[0]) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (reqRows[0].status === "closed") {
      return res.status(409).json({ error: "This requirement is closed" });
    }

    const price = unlockPriceForMatch(match.match_score);
    const idempotencyKey = `order:${employerId}:unlock:${matchId}`;

    if (UPSTASH_URL && UPSTASH_TOKEN) {
      try {
        const lockRes = await fetch(`${UPSTASH_URL}/SET/${encodeURIComponent(idempotencyKey)}/pending/NX/EX/${DEDUP_TTL}`, {
          headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
        });
        if (lockRes.ok) {
          const lockData = await lockRes.json();
          if (lockData.result === null) {
            const oidRes = await fetch(`${UPSTASH_URL}/GET/${encodeURIComponent(`${idempotencyKey}:oid`)}`, {
              headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            });
            if (oidRes.ok) {
              const oidData = await oidRes.json();
              if (oidData.result) {
                return res.status(200).json({
                  orderId: oidData.result,
                  amount: price.amountPaise,
                  currency: "INR",
                  keyId: RAZORPAY_KEY_ID,
                  name: price.label,
                  description: "Employer contact unlock — HireStepX",
                });
              }
            }
            await new Promise((r) => setTimeout(r, 2000));
            const retryRes = await fetch(`${UPSTASH_URL}/GET/${encodeURIComponent(`${idempotencyKey}:oid`)}`, {
              headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
            });
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              if (retryData.result) {
                return res.status(200).json({
                  orderId: retryData.result,
                  amount: price.amountPaise,
                  currency: "INR",
                  keyId: RAZORPAY_KEY_ID,
                  name: price.label,
                  description: "Employer contact unlock — HireStepX",
                });
              }
            }
            return res.status(429).json({ error: "Order already in progress. Please wait a moment." });
          }
        }
      } catch (dedupErr) {
        console.warn("[employer-create-unlock-order] Idempotency check failed:", dedupErr);
      }
    }

    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString("base64");
    const receipt = `unlock_${Date.now()}`.slice(0, 40);
    const notes: Record<string, string> = { employerId, matchId };

    const ac = new AbortController();
    const acTimer = setTimeout(() => ac.abort(), 10_000);
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      signal: ac.signal,
      body: JSON.stringify({ amount: price.amountPaise, currency: "INR", receipt, notes }),
    });
    clearTimeout(acTimer);

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Razorpay error:", response.status, errText);
      const detail = response.status === 401
        ? "Payment gateway credentials are invalid. Please contact support."
        : "Could not create payment order. Please try again or contact support@hirestepx.com";
      return res.status(502).json({ error: detail });
    }

    const order = await response.json();

    if (UPSTASH_URL && UPSTASH_TOKEN) {
      fetch(`${UPSTASH_URL}/SET/${encodeURIComponent(`${idempotencyKey}:oid`)}/${encodeURIComponent(order.id)}?EX=${DEDUP_TTL}`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      }).catch(() => {});
    }

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID,
      name: price.label,
      description: "Employer contact unlock — HireStepX",
    });
  } catch (err) {
    console.error("employer-create-unlock-order error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
