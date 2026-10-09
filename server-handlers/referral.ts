/* Vercel Edge Function — Referral code management.
 *
 * GET:  returns the caller's referral code (generating one on first call) plus
 *       their referral stats.
 * POST: applies a referral code for the caller (the referred user). Only NEW
 *       accounts can redeem; the friend is credited immediately and the
 *       referrer is paid when the friend completes a first real session
 *       (save-session). See _referral-apply.ts / _referral-reward-helpers.ts.
 *
 * Auth/rate-limit go through the shared withAuthAndRateLimit preamble. */

export const config = { runtime: "edge" };

import { withAuthAndRateLimit, withRequestId } from "./_shared";
import { normalizeReferralCode } from "./_referral-reward-helpers";
import { applyReferralCode } from "./_referral-apply";
import { notifyReferredWelcome, notifyReferrerJoined } from "./_referral-emails";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for clarity
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = "HSX-";
  for (const byte of bytes) code += chars[byte % chars.length];
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
        // Claim a fresh code only while the profile still has none (CAS), so two
        // concurrent first-loads can't overwrite each other; a unique collision
        // on the code itself just retries with a new one.
        for (let attempt = 0; attempt < 5 && !code; attempt++) {
          const candidate = generateCode();
          const saveRes = await fetch(
            `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&referral_code=is.null`,
            {
              method: "PATCH",
              headers: { ...dbHeaders, Prefer: "return=representation" },
              body: JSON.stringify({ referral_code: candidate }),
            },
          );
          if (saveRes.ok) {
            const saved = await saveRes.json().catch(() => []);
            if (Array.isArray(saved) && saved.length > 0) {
              code = candidate;
            } else {
              const again = await fetch(
                `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=referral_code`,
                { headers: dbHeaders },
              );
              const rows = await again.json().catch(() => []);
              code = Array.isArray(rows) && rows[0]?.referral_code;
              if (!code) break;
            }
          } else if (saveRes.status !== 409) {
            return new Response(JSON.stringify({ error: "Failed to save referral code" }), { status: 500, headers });
          }
        }
        if (!code) {
          return new Response(JSON.stringify({ error: "Could not generate unique code, please retry" }), { status: 500, headers });
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

    const result = await applyReferralCode({
      baseUrl: SUPABASE_URL,
      serviceKey: SUPABASE_SERVICE_ROLE_KEY,
      userId,
      code: referralCode,
      nowMs: Date.now(),
    });
    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.error }), { status: result.status, headers });
    }
    if (result.alreadyReferred) {
      return new Response(JSON.stringify({ success: true, alreadyReferred: true }), { status: 200, headers });
    }

    notifyReferrerJoined(result.referrerId);
    if (result.rewarded) {
      await notifyReferredWelcome(userId, result.referredEmail, result.referredName);
    }
    return new Response(
      JSON.stringify({ success: true, rewarded: result.rewarded, ...(result.reason ? { reason: result.reason } : {}) }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error("[referral] Error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers });
  }
}
