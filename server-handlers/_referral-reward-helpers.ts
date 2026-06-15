/* Referral reward — pure-ish core (PRI-37 / growth Plan 1).
 *
 * The referral *loop* only closes if redeeming a code instantly rewards BOTH
 * sides. This module owns that logic so the handler stays a thin shell and the
 * load-bearing semantics (idempotent compare-and-swap, abuse caps, code
 * normalisation) are unit-testable with a mocked fetch.
 *
 * Why CAS, not a boolean flip: the apply path can fire more than once for the
 * same referral (client retry, a second SIGNED_IN on a new device re-POSTing a
 * still-cached ?ref code). A naive "if not rewarded, grant" read-then-write
 * races into a double credit. Instead we PATCH with a `reward_granted_at is
 * null` filter and ask PostgREST to return the affected rows: exactly one row
 * back means THIS call won the claim and may pay out; zero rows means someone
 * else already did. The grant is therefore exactly-once under concurrency.
 *
 * Failure philosophy mirrors _session-credits.ts: a credit is worth cents of
 * LLM/TTS, never a charge. If a credit write fails after the claim we log and
 * move on rather than rolling back — at worst one side misses a free session,
 * which a support nudge fixes; we never double-charge or double-grant.
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

const CODE_RE = /^HSX-[A-Z0-9]{4,8}$/;

/** Normalise an untrusted referral code (URL param, localStorage, body) to the
 *  canonical `HSX-XXXXXX` form, or null if it isn't a well-formed code. */
export function normalizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
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

export interface ReferralRewardInput {
  baseUrl: string;
  serviceKey: string;
  referralId: string;
  referrerId: string;
  referredId: string;
  nowIso: string;
  sinceIso: string;
}

export interface ReferralRewardResult {
  granted: boolean;
  reason?: "capped" | "already_claimed" | "ok";
  referrerCredited?: boolean;
  referredCredited?: boolean;
}

/** Grant the double-sided referral reward, exactly once.
 *
 *  Order is deliberate: cap-check → CAS-claim → credit both sides. The claim is
 *  the dedup gate, so it must precede the credits; a crash between claim and
 *  credit loses at most one free session (logged, never a charge). Credits use
 *  the retry-capable grantSessionCredits since they're the payout. */
export async function grantReferralReward(
  input: ReferralRewardInput,
  fetchImpl: FetchImpl = fetch,
): Promise<ReferralRewardResult> {
  const { baseUrl, serviceKey, referralId, referrerId, referredId, nowIso, sinceIso } = input;

  const recent = await countRecentReferralRewards(baseUrl, serviceKey, referrerId, sinceIso, fetchImpl);
  if (recent >= REFERRAL_REWARD_DAILY_CAP) {
    return { granted: false, reason: "capped" };
  }

  const claimed = await claimReferralReward(baseUrl, serviceKey, referralId, nowIso, fetchImpl);
  if (!claimed) return { granted: false, reason: "already_claimed" };

  const referrerCredited =
    (await grantSessionCredits(baseUrl, serviceKey, referrerId, REFERRAL_REWARD_CREDITS, fetchImpl, 2)) != null;
  const referredCredited =
    (await grantSessionCredits(baseUrl, serviceKey, referredId, REFERRAL_REWARD_CREDITS, fetchImpl, 2)) != null;

  return { granted: true, reason: "ok", referrerCredited, referredCredited };
}
