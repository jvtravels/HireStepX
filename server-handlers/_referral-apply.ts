/* Apply a referral code for the referred (new) user.
 *
 * Extracted from referral.ts so the load-bearing ordering is unit-testable:
 *   1. the account must be new (existing users can't redeem a code),
 *   2. the referrals row is created FIRST (unique index on referred_id makes it
 *      the idempotent dedup point) so a later failure can never leave a user
 *      marked "referred" with no row for the referrer to be paid against,
 *   3. profiles.referred_by is then claimed with a compare-and-swap
 *      (`referred_by is null`); the single winner owns the referred-side credit,
 *   4. if that credit write fails the claim is rolled back so a retry can pay.
 * The referrer is NOT paid here — see payReferrerForReferral (first session). */

import { grantSessionCredits } from "./_session-credits";
import {
  REFERRAL_REWARD_CREDITS,
  REFERRAL_REWARD_DAILY_CAP,
  REFERRAL_REWARD_WINDOW_MS,
  countReferralsCreatedSince,
  isNewAccount,
} from "./_referral-reward-helpers";

type FetchImpl = typeof fetch;

export interface ApplyReferralInput {
  baseUrl: string;
  serviceKey: string;
  userId: string;
  code: string;
  nowMs: number;
}

export type ApplyReferralResult =
  | { ok: false; status: number; error: string }
  | { ok: true; alreadyReferred: true }
  | {
      ok: true;
      alreadyReferred: false;
      rewarded: boolean;
      reason?: "capped";
      referrerId: string;
      referredEmail: string | null;
      referredName: string | null;
    };

interface SelfRow {
  referred_by: string | null;
  email: string | null;
  name: string | null;
  created_at: string | null;
}

export async function applyReferralCode(
  input: ApplyReferralInput,
  fetchImpl: FetchImpl = fetch,
): Promise<ApplyReferralResult> {
  const { baseUrl, serviceKey, userId, code, nowMs } = input;
  const db = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const json = { ...db, "Content-Type": "application/json" };
  const enc = encodeURIComponent;

  const referrerRes = await fetchImpl(`${baseUrl}/rest/v1/profiles?referral_code=eq.${enc(code)}&select=id`, { headers: db });
  const referrers = await referrerRes.json().catch(() => []);
  if (!referrerRes.ok || !Array.isArray(referrers) || referrers.length === 0) {
    return { ok: false, status: 404, error: "Invalid referral code" };
  }
  const referrerId = referrers[0].id as string;
  if (referrerId === userId) return { ok: false, status: 400, error: "Cannot use your own referral code" };

  const selfRes = await fetchImpl(
    `${baseUrl}/rest/v1/profiles?id=eq.${enc(userId)}&select=referred_by,email,name,created_at`,
    { headers: db },
  );
  const selfRows = await selfRes.json().catch(() => []);
  if (!selfRes.ok || !Array.isArray(selfRows) || !selfRows[0]) {
    return { ok: false, status: 503, error: "Profile not ready, please retry" };
  }
  const self = selfRows[0] as SelfRow;
  if (self.referred_by) return { ok: true, alreadyReferred: true };
  if (!isNewAccount(self.created_at, nowMs)) {
    return { ok: false, status: 403, error: "Referral codes can only be applied to new accounts" };
  }

  const sinceIso = new Date(nowMs - REFERRAL_REWARD_WINDOW_MS).toISOString();
  const createdToday = await countReferralsCreatedSince(baseUrl, serviceKey, referrerId, sinceIso, fetchImpl);
  const capped = createdToday >= REFERRAL_REWARD_DAILY_CAP;

  const insertRes = await fetchImpl(`${baseUrl}/rest/v1/referrals`, {
    method: "POST",
    headers: { ...json, Prefer: "return=minimal" },
    body: JSON.stringify({
      referrer_id: referrerId,
      referral_code: code,
      referred_id: userId,
      referred_email: self.email ?? null,
      status: "redeemed",
    }),
  });
  if (!insertRes.ok) {
    const existing = await fetchImpl(`${baseUrl}/rest/v1/referrals?referred_id=eq.${enc(userId)}&select=id&limit=1`, { headers: db });
    const rows = await existing.json().catch(() => []);
    if (!existing.ok || !Array.isArray(rows) || rows.length === 0) {
      return { ok: false, status: 500, error: "Failed to record referral" };
    }
  }

  const claimRes = await fetchImpl(`${baseUrl}/rest/v1/profiles?id=eq.${enc(userId)}&referred_by=is.null`, {
    method: "PATCH",
    headers: { ...json, Prefer: "return=representation" },
    body: JSON.stringify({ referred_by: code }),
  });
  if (!claimRes.ok) return { ok: false, status: 500, error: "Failed to apply referral code" };
  const claimed = await claimRes.json().catch(() => []);
  if (!Array.isArray(claimed) || claimed.length !== 1) return { ok: true, alreadyReferred: true };

  const base = { alreadyReferred: false as const, referrerId, referredEmail: self.email ?? null, referredName: self.name ?? null };
  if (capped) return { ok: true, ...base, rewarded: false, reason: "capped" };

  const credited = await grantSessionCredits(baseUrl, serviceKey, userId, REFERRAL_REWARD_CREDITS, fetchImpl, 2);
  if (credited == null) {
    await fetchImpl(`${baseUrl}/rest/v1/profiles?id=eq.${enc(userId)}&referred_by=eq.${enc(code)}`, {
      method: "PATCH",
      headers: { ...json, Prefer: "return=minimal" },
      body: JSON.stringify({ referred_by: null }),
    }).catch(() => null);
    return { ok: false, status: 502, error: "Could not credit your free session, please retry" };
  }
  return { ok: true, ...base, rewarded: true };
}
