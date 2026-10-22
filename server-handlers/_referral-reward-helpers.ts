/* Referral reward — pure-ish core.
 *
 * Reward rule (matches the public referral page):
 *   - The referred friend gets REFERRAL_REWARD_CREDITS the moment a valid code
 *     is applied to a NEW account (see _referral-apply.ts).
 *   - The referrer gets REFERRAL_REWARD_CREDITS when that friend completes a
 *     real first session (payReferrerForReferral, called from save-session).
 *   Paying on activation rather than signup is the fraud backstop: a throwaway
 *   verified email alone no longer mints the referrer a session.
 *
 * Why CAS, not a boolean flip: the payout path can fire more than once for the
 * same referral (a second session save, a retry). A naive "if not rewarded,
 * grant" read-then-write races into a double credit. Instead we PATCH with a
 * `reward_granted_at is null` filter and ask PostgREST to return the affected
 * rows: exactly one row back means THIS call won the claim and may pay out.
 *
 * Failure philosophy: if the credit write fails after the claim we release the
 * claim so the next session save retries, rather than silently losing the
 * referrer's reward. A credit is worth cents of LLM/TTS, never a charge.
 */

import { grantSessionCredits } from "./_session-credits";

type FetchImpl = typeof fetch;

/** Credits granted to EACH side (referrer + referred) on a redeemed referral. */
export const REFERRAL_REWARD_CREDITS = 1;

/** Max referrals a single referrer may be rewarded for, per rolling window.
 *  Abuse backstop: farming fake signups to mint free sessions. Generous
 *  enough that no honest sharer ever hits it. */
export const REFERRAL_REWARD_DAILY_CAP = 20;
export const REFERRAL_REWARD_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Lifetime ceiling on rewarded referrals per referrer (so at most this many
 *  free sessions can be earned by inviting). */
export const REFERRAL_REWARD_LIFETIME_CAP = 50;

/** A referral code can only be applied to an account created within this
 *  window — stops existing users and account-pairs from redeeming codes. */
export const REFERRAL_NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Minimum answered questions in the referred user's session before the
 *  referrer is paid, so a one-click session can't trigger the payout. */
export const REFERRAL_PAYOUT_MIN_QUESTIONS = 3;

const CODE_RE = /^HSX-[A-Z0-9]{4,8}$/;

/** Normalise an untrusted referral code (URL param, localStorage, body) to the
 *  canonical `HSX-XXXXXX` form, or null if it isn't a well-formed code. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** True when the account was created recently enough to accept a referral. A
 *  missing/invalid timestamp fails closed. */
export function isNewAccount(createdAt: unknown, nowMs: number): boolean {
  if (typeof createdAt !== "string") return false;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return nowMs - t <= REFERRAL_NEW_ACCOUNT_WINDOW_MS;
}

/** "priya.sharma@gmail.com" → "p***@gmail.com". The referrer sees who joined
 *  without being handed the friend's full address. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const at = email.indexOf("@");
  if (at < 1) return "";
  return `${email[0]}***${email.slice(at)}`;
}

function authHeaders(serviceKey: string, extra?: Record<string, string>): Record<string, string> {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, ...(extra || {}) };
}

/** How many referrals this referrer has already been REWARDED for inside the
 *  rolling window. Used to enforce REFERRAL_REWARD_DAILY_CAP. Fail-open to 0 on
 *  a read error is deliberate: a transient blip should not block an honest
 *  reward (the CAS still prevents double-grant). */
export async function countRecentReferralRewards(
  baseUrl: string,
  serviceKey: string,
  referrerId: string,
  sinceIso: string,
  fetchImpl: FetchImpl = fetch,
): Promise<number> {
  try {
    const res = await fetchImpl(
      `${baseUrl}/rest/v1/referrals?referrer_id=eq.${encodeURIComponent(referrerId)}` +
        `&reward_granted_at=gte.${encodeURIComponent(sinceIso)}&select=id`,
      { headers: authHeaders(serviceKey) },
    );
    if (!res.ok) return 0;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

/** Atomically claim the reward for one referral row. Returns true iff THIS call
 *  flipped reward_granted_at from null → nowIso (i.e. we own the payout).
 *  Implemented as a conditional PATCH (`reward_granted_at is null`) returning
 *  the representation: exactly one row back = we claimed it. */
export async function claimReferralReward(
  baseUrl: string,
  serviceKey: string,
  referralId: string,
  nowIso: string,
  fetchImpl: FetchImpl = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(
      `${baseUrl}/rest/v1/referrals?id=eq.${encodeURIComponent(referralId)}&reward_granted_at=is.null`,
      {
        method: "PATCH",
        headers: authHeaders(serviceKey, {
          "Content-Type": "application/json",
          Prefer: "return=representation",
        }),
        body: JSON.stringify({
          status: "rewarded",
          reward_granted: true,
          reward_granted_at: nowIso,
        }),
      },
    );
    if (!res.ok) return false;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) && rows.length === 1;
  } catch {
    return false;
  }
}

/** Count rows from a PostgREST list URL. Fails open to 0: a transient read
 *  error must not block an honest reward (the CAS still prevents double-pay). */
async function countRows(url: string, serviceKey: string, fetchImpl: FetchImpl): Promise<number> {
  try {
    const res = await fetchImpl(url, { headers: authHeaders(serviceKey) });
    if (!res.ok) return 0;
    const rows = await res.json().catch(() => []);
    return Array.isArray(rows) ? rows.length : 0;
  } catch {
    return 0;
  }
}

/** Referrals this referrer has CREATED (any status) since `sinceIso` — the
 *  abuse backstop for the referred-side credit. */
export function countReferralsCreatedSince(
  baseUrl: string,
  serviceKey: string,
  referrerId: string,
  sinceIso: string,
  fetchImpl: FetchImpl = fetch,
): Promise<number> {
  return countRows(
    `${baseUrl}/rest/v1/referrals?referrer_id=eq.${encodeURIComponent(referrerId)}` +
      `&created_at=gte.${encodeURIComponent(sinceIso)}&select=id`,
    serviceKey,
    fetchImpl,
  );
}

/** Referrals this referrer has been PAID for in total. */
export function countReferralPayouts(
  baseUrl: string,
  serviceKey: string,
  referrerId: string,
  fetchImpl: FetchImpl = fetch,
): Promise<number> {
  return countRows(
    `${baseUrl}/rest/v1/referrals?referrer_id=eq.${encodeURIComponent(referrerId)}&reward_granted_at=not.is.null&select=id`,
    serviceKey,
    fetchImpl,
  );
}

/** Undo a claim after the credit write failed, so the next session save
 *  retries the payout instead of the reward being lost. Best-effort. */
async function releaseReferralClaim(
  baseUrl: string,
  serviceKey: string,
  referralId: string,
  claimedAtIso: string,
  fetchImpl: FetchImpl,
): Promise<void> {
  try {
    await fetchImpl(
      `${baseUrl}/rest/v1/referrals?id=eq.${encodeURIComponent(referralId)}&reward_granted_at=eq.${encodeURIComponent(claimedAtIso)}`,
      {
        method: "PATCH",
        headers: authHeaders(serviceKey, { "Content-Type": "application/json", Prefer: "return=minimal" }),
        body: JSON.stringify({ status: "redeemed", reward_granted: false, reward_granted_at: null }),
      },
    );
  } catch {
    console.error(`[referral] failed to release claim for ${referralId}`);
  }
}

export interface ReferrerPayoutInput {
  baseUrl: string;
  serviceKey: string;
  /** The referred user whose first real session just completed. */
  referredId: string;
  nowIso: string;
  sinceIso: string;
}

export interface ReferrerPayoutResult {
  paid: boolean;
  reason: "paid" | "no_pending" | "capped" | "already_claimed" | "credit_failed" | "error";
  referrerId?: string;
}

/** Pay the referrer for a referred user's first real session, exactly once.
 *  Order is deliberate: find pending row → cap checks → CAS-claim → credit. */
export async function payReferrerForReferral(
  input: ReferrerPayoutInput,
  fetchImpl: FetchImpl = fetch,
): Promise<ReferrerPayoutResult> {
  const { baseUrl, serviceKey, referredId, nowIso, sinceIso } = input;

  let pending: { id: string; referrer_id: string } | undefined;
  try {
    const res = await fetchImpl(
      `${baseUrl}/rest/v1/referrals?referred_id=eq.${encodeURIComponent(referredId)}&reward_granted_at=is.null&select=id,referrer_id&limit=1`,
      { headers: authHeaders(serviceKey) },
    );
    if (!res.ok) return { paid: false, reason: "error" };
    const rows = await res.json().catch(() => []);
    pending = Array.isArray(rows) ? rows[0] : undefined;
  } catch {
    return { paid: false, reason: "error" };
  }
  if (!pending?.id || !pending.referrer_id) return { paid: false, reason: "no_pending" };
  const referrerId = pending.referrer_id;

  const [recent, lifetime] = await Promise.all([
    countRecentReferralRewards(baseUrl, serviceKey, referrerId, sinceIso, fetchImpl),
    countReferralPayouts(baseUrl, serviceKey, referrerId, fetchImpl),
  ]);
  if (recent >= REFERRAL_REWARD_DAILY_CAP || lifetime >= REFERRAL_REWARD_LIFETIME_CAP) {
    return { paid: false, reason: "capped", referrerId };
  }

  const claimed = await claimReferralReward(baseUrl, serviceKey, pending.id, nowIso, fetchImpl);
  if (!claimed) return { paid: false, reason: "already_claimed", referrerId };

  const credited = await grantSessionCredits(baseUrl, serviceKey, referrerId, REFERRAL_REWARD_CREDITS, fetchImpl, 2);
  if (credited == null) {
    await releaseReferralClaim(baseUrl, serviceKey, pending.id, nowIso, fetchImpl);
    return { paid: false, reason: "credit_failed", referrerId };
  }
  return { paid: true, reason: "paid", referrerId };
}
