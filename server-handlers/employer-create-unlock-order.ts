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
} from "./_shared";
import { singleUnlockPrice, batchUnlockPrice, batchIndexForRank } from "./_unlock-pricing";
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
  const label = order.mode === "single" ? singleUnlockPrice().label : batchUnlockPrice(order.match_ids.length).label;
  return {
    orderId: order.razorpay_order_id,
    amount: order.amount,
    currency: order.currency,
    keyId: RAZORPAY_KEY_ID,
    name: label,
    description: "Employer contact unlock — HireStepX",
    ...extra,
  };
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
        `${SUPABASE_URL}/rest/v1/requirement_matches?requirement_id=eq.${encodeURIComponent(requirementId)}&select=id,unlocked&order=match_score.desc,id.asc`,
        { headers: sh },
      );
      if (!matchesRes.ok) throw new Error(`matches read failed: ${matchesRes.status}`);
      const matches = (await matchesRes.json().catch(() => [])) as Array<{ id: string; unlocked: boolean }>;

      const batches = new Map<number, Array<{ id: string; unlocked: boolean }>>();
      matches.forEach((m, i) => {
        const b = batchIndexForRank(i);
        if (!batches.has(b)) batches.set(b, []);
        batches.get(b)!.push(m);
      });
      let nextBatch: Array<{ id: string; unlocked: boolean }> | null = null;
      for (const [, rows] of Array.from(batches.entries()).sort((a, b) => a[0] - b[0])) {
        if (rows.some((r) => !r.unlocked)) {
          nextBatch = rows;
          break;
        }
      }
      if (!nextBatch) {
        return res.status(409).json({ error: "All candidates are already unlocked" });
      }

      // Never charge for a candidate the employer can't actually reach (opted
      // out, blocked) — they are dropped from this batch and from its price.
      const locked = nextBatch.filter((r) => !r.unlocked);
      const decisions = await Promise.all(
        locked.map((r) =>
          loadEmployerMatchAccess({
            supabaseUrl: SUPABASE_URL, headers: sh, employerId, matchId: r.id,
            authEmail: identity.email, emailConfirmed: identity.emailConfirmed,
          }),
        ),
      );
      if (decisions.some((d) => !d.ok && d.reason === "error")) throw new Error("match access read failed");
      targetMatchIds = locked.filter((_, i) => decisions[i].ok).map((r) => r.id);
      if (targetMatchIds.length === 0) {
        return res.status(409).json({
          error: "None of the candidates in this batch are currently available to unlock",
          code: "no_eligible_candidates",
        });
      }
      orderRequirementId = requirementId;
    }

    const nowMs = Date.now();
    const openOrders = await loadOpenOrders(SUPABASE_URL, sh, employerId);
    if (!openOrders) {
      console.error("[employer-create-unlock-order] open-order lookup failed");
      return res.status(503).json({ error: "Payments are temporarily unavailable. Please try again shortly." });
    }

    // Retry / double-click / second tab: hand back the existing unpaid order.
    const reusable = findReusableOrder(openOrders, mode, targetMatchIds);
    if (reusable) return res.status(200).json(orderResponse(reusable, { reused: true }));

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
      console.error("[employer-create-unlock-order] daily unlock count failed");
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
        body: JSON.stringify({ amount: price.amountPaise, currency: "INR", receipt, notes: orderNotes }),
      });
    } finally {
      clearTimeout(acTimer);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("Razorpay error:", response.status, errText);
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
    });
    if (inserted.kind === "inserted") {
      return res.status(200).json(orderResponse(inserted.order));
    }
    if (inserted.kind === "conflict" && inserted.order) {
      return res.status(200).json(orderResponse(inserted.order, { reused: true }));
    }
    console.error("employer_unlock_orders insert failed:", inserted.kind === "error" ? inserted.detail : "conflict without winner");
    return res.status(500).json({ error: "Could not start the payment. Please try again." });
  } catch (err) {
    console.error("employer-create-unlock-order error:", err);
    return res.status(500).json({ error: "Internal error" });
  } finally {
    if (lockKey) void releaseCreateLock(lockKey, { url: UPSTASH_URL, token: UPSTASH_TOKEN });
  }
}
