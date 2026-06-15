/* Vercel Edge Function — Referral code management.
 *
 * GET:  returns the caller's referral code (generating one on first call) plus
 *       their referral stats.
 * POST: applies a referral code for the caller (the referred user) and
 *       IMMEDIATELY rewards BOTH sides with a session credit. This is what
 *       closes the loop — see _referral-reward-helpers.ts for the exactly-once
 *       compare-and-swap semantics and abuse cap.
 *
 * Auth/rate-limit go through the shared withAuthAndRateLimit preamble (same as
 * every other handler) rather than a hand-rolled origin+auth check, so code
 * generation and apply are both IP/user rate-limited. */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, withRequestId } from "./_shared";
import {
  normalizeReferralCode,
  grantReferralReward,
  REFERRAL_REWARD_WINDOW_MS,
} from "./_referral-reward-helpers";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for clarity
  let code = "HSX-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export default async function handler(req: Request): Promise<Response> {
  const pre = await withAuthAndRateLimit(req, {
    endpoint: "referral",
    ipLimit: 40,
    userLimit: 20,
    maxBytes: 10_240,
    allowGet: true,
  });
  if (pre instanceof Response) return pre;
  const { auth } = pre;
  const headers = withRequestId(pre.headers);

  if (!auth.userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  }
  const userId = auth.userId;

  const dbHeaders = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };

  try {
    if (req.method === "GET") {
      // Get or create referral code for this user
      const profileRes = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=referral_code`,
        { headers: dbHeaders },
      );
      const profiles = await profileRes.json();
      let code = Array.isArray(profiles) && profiles[0]?.referral_code;

      if (!code) {
        // Generate a unique code with collision check (retry up to 5 times)
        for (let attempt = 0; attempt < 5; attempt++) {
          code = generateCode();
          const existsRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?referral_code=eq.${encodeURIComponent(code)}&select=id`,
            { headers: dbHeaders },
          );
          const existsRows = await existsRes.json();
          if (Array.isArray(existsRows) && existsRows.length === 0) break; // unique
          if (attempt === 4) {
            return new Response(JSON.stringify({ error: "Could not generate unique code, please retry" }), { status: 500, headers });
          }
        }
        const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
          method: "PATCH",
          headers: { ...dbHeaders, Prefer: "return=minimal" },
          body: JSON.stringify({ referral_code: code }),
        });
        if (!saveRes.ok) {
          return new Response(JSON.stringify({ error: "Failed to save referral code" }), { status: 500, headers });
        }
      }

      const refRes = await fetch(
        `${SUPABASE_URL}/rest/v1/referrals?referrer_id=eq.${encodeURIComponent(userId)}&select=id,status,created_at`,
        { headers: dbHeaders },
      );
      const referrals = await refRes.json();
      const list: Array<{ status: string }> = Array.isArray(referrals) ? referrals : [];
      const stats = {
        total: list.length,
        redeemed: list.filter((r) => r.status === "redeemed" || r.status === "rewarded").length,
        rewarded: list.filter((r) => r.status === "rewarded").length,
      };

      return new Response(JSON.stringify({ code, stats }), { status: 200, headers });
    }

    // POST — apply referral code
    const body = await req.json().catch(() => ({}));
    const referralCode = normalizeReferralCode((body as { code?: string }).code);
    if (!referralCode) {
      return new Response(JSON.stringify({ error: "Invalid referral code format" }), { status: 400, headers });
    }

    // Find the referrer
    const referrerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?referral_code=eq.${encodeURIComponent(referralCode)}&select=id`,
      { headers: dbHeaders },
    );
    const referrers = await referrerRes.json();
    if (!Array.isArray(referrers) || referrers.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid referral code" }), { status: 404, headers });
    }
    const referrerId = referrers[0].id;

    if (referrerId === userId) {
      return new Response(JSON.stringify({ error: "Cannot use your own referral code" }), { status: 400, headers });
    }

    // Already referred? (idempotent: a re-POST of a still-cached ?ref returns
    // cleanly instead of erroring — the reward was already granted on first apply.)
    const selfRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=referred_by,email`,
      { headers: dbHeaders },
    );
    const selfRows = await selfRes.json();
    const self = Array.isArray(selfRows) ? selfRows[0] : undefined;
    if (self?.referred_by) {
      return new Response(JSON.stringify({ success: true, alreadyReferred: true }), { status: 200, headers });
    }

    // Mark the referred user
    const applyRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { ...dbHeaders, Prefer: "return=minimal" },
      body: JSON.stringify({ referred_by: referralCode }),
    });
    if (!applyRes.ok) {
      console.error("[referral] Failed to apply referral:", applyRes.status);
      return new Response(JSON.stringify({ error: "Failed to apply referral code" }), { status: 500, headers });
    }

    // Create the referral row and read it back so we have its id for the
    // reward claim. The unique index on referred_id makes this insert the
    // race-safe dedup point: a concurrent double-apply 409s here, and we
    // recover by looking up the existing row.
    let referralId: string | undefined;
    const recordRes = await fetch(`${SUPABASE_URL}/rest/v1/referrals`, {
      method: "POST",
      headers: { ...dbHeaders, Prefer: "return=representation" },
      body: JSON.stringify({
        referrer_id: referrerId,
        referral_code: referralCode,
        referred_id: userId,
        referred_email: typeof self?.email === "string" ? self.email : null,
        status: "redeemed",
      }),
    });
    if (recordRes.ok) {
      const rows = await recordRes.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]?.id) referralId = rows[0].id;
    } else {
      // Likely a unique-violation from a concurrent apply — fetch the existing row.
      const existing = await fetch(
        `${SUPABASE_URL}/rest/v1/referrals?referred_id=eq.${encodeURIComponent(userId)}&select=id&limit=1`,
        { headers: dbHeaders },
      );
      const rows = await existing.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]?.id) referralId = rows[0].id;
    }

    // Close the loop — reward both sides immediately, exactly once.
    let rewarded = false;
    if (referralId) {
      const now = new Date();
      const result = await grantReferralReward({
        baseUrl: SUPABASE_URL,
        serviceKey: SUPABASE_SERVICE_ROLE_KEY,
        referralId,
        referrerId,
        referredId: userId,
        nowIso: now.toISOString(),
        sinceIso: new Date(now.getTime() - REFERRAL_REWARD_WINDOW_MS).toISOString(),
      });
      rewarded = result.granted;
    }

    return new Response(JSON.stringify({ success: true, rewarded }), { status: 200, headers });
  } catch (err) {
    console.error("[referral] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers });
  }
}
