/* Global Deepgram credit guardrail — mirrors _sarvam-credit-guard.ts. Deepgram
 * gave a $200 startup-credit grant, shared across every user, not a per-user
 * allowance. stt-token.ts's per-user daily cap stops one runaway account, but
 * nothing stops a traffic spike from burning the whole grant in a few days.
 * This tracks *estimated* spend (via the same per-call rate the admin cost
 * dashboard uses) against the grant in a single Redis counter and signals
 * callers to fail over to the browser Web Speech API once the buffer
 * threshold is crossed — before Deepgram itself would start hard-rejecting
 * requests.
 *
 * Deepgram bills in USD, so unlike the Sarvam guard (INR) this tracks USD
 * cents directly — no currency conversion needed. */

import { redisIncrByWithExpiry, redisGet } from "./_shared";
import { DEFAULT_COST_RATES } from "./_cost-helpers";

declare const process: { env: Record<string, string | undefined> };

const DEEPGRAM_MONTHLY_CREDIT_CAP_USD = parseFloat(process.env.DEEPGRAM_MONTHLY_CREDIT_CAP_USD || "200");
/** Stop at 90% spent — leaves a buffer instead of racing Deepgram's own cutoff. */
const DEEPGRAM_CREDIT_ALERT_FRACTION = 0.9;
/** Counter key is scoped to the calendar month, so it self-resets; TTL is a
 * generous 32 days rather than an exact month-end so a delayed request near
 * midnight on the last day still lands in the right bucket. */
const TTL_SECONDS = 32 * 86_400;

function monthKey(): string {
  return `deepgram_credits_used_cents:${new Date().toISOString().slice(0, 7)}`; // YYYY-MM
}

/** Record one Deepgram STT session (token issuance ≈ one session). Returns
 * true if the program's monthly credit grant is now past its buffer
 * threshold and this (and further) calls should fail over to the browser
 * Web Speech API. */
export async function recordDeepgramSpendAndCheckCap(): Promise<boolean> {
  // Redis INCRBY requires an integer, so track cents rather than fractional dollars.
  const cents = Math.max(0, Math.round(DEFAULT_COST_RATES.sttUsdPerCall * 100));
  const used = await redisIncrByWithExpiry(monthKey(), cents, TTL_SECONDS);
  if (used === null) return false; // fail open on a Redis outage — don't kill voice for everyone
  return used > DEEPGRAM_MONTHLY_CREDIT_CAP_USD * 100 * DEEPGRAM_CREDIT_ALERT_FRACTION;
}

/** Read-only snapshot for the admin dashboard. */
export async function getDeepgramMonthlySpend(): Promise<{ usedUsd: number; capUsd: number }> {
  const raw = await redisGet(monthKey());
  const usedCents = raw ? parseInt(raw, 10) || 0 : 0;
  return { usedUsd: Math.round(usedCents) / 100, capUsd: DEEPGRAM_MONTHLY_CREDIT_CAP_USD };
}
