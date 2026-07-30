/* Global Sarvam credit guardrail — the startup-program grant is a fixed
 * monthly credit pool (1 credit ≈ ₹1) shared across every user, not a
 * per-user allowance. The per-user daily caps in sarvam-tts.ts and
 * sarvam-token.ts stop one runaway account, but nothing stops a traffic
 * spike from burning the whole month's grant in a few days. This tracks
 * *estimated* spend (via the same rate estimates the admin cost dashboard
 * uses) against the grant in a single Redis counter and signals callers to
 * fail over to the zero-cost fallback chain once the buffer threshold is
 * crossed — before Sarvam itself would start hard-rejecting requests.
 *
 * Only real upstream spend is recorded: TTS cache hits and STT-cap
 * rejections cost nothing, so callers should record only on an actual
 * Sarvam API call (TTS cache miss, STT token issuance). */

import { redisIncrByWithExpiry, redisGet } from "./_shared";
import { ttsInr, sttInr, DEFAULT_COST_RATES } from "./_cost-helpers";

declare const process: { env: Record<string, string | undefined> };

const SARVAM_MONTHLY_CREDIT_CAP = parseInt(process.env.SARVAM_MONTHLY_CREDIT_CAP || "25000", 10);
/** Stop at 90% spent — leaves a buffer instead of racing Sarvam's own cutoff. */
const SARVAM_CREDIT_ALERT_FRACTION = 0.9;
/** Counter key is scoped to the calendar month, so it self-resets; TTL is a
 * generous 32 days rather than an exact month-end so a delayed request near
 * midnight on the last day still lands in the right bucket. */
const TTL_SECONDS = 32 * 86_400;

function monthKey(): string {
  return `sarvam_credits_used_paise:${new Date().toISOString().slice(0, 7)}`; // YYYY-MM
}

async function recordAndCheck(inr: number): Promise<boolean> {
  // Redis INCRBY requires an integer, so track paise (INR / 100) rather than
  // fractional rupees.
  const paise = Math.max(0, Math.round(inr * 100));
  const used = await redisIncrByWithExpiry(monthKey(), paise, TTL_SECONDS);
  if (used === null) return false; // fail open on a Redis outage — don't kill voice for everyone
  return used > SARVAM_MONTHLY_CREDIT_CAP * 100 * SARVAM_CREDIT_ALERT_FRACTION;
}

/** Record one Sarvam TTS upstream call's estimated cost. Returns true if the
 * program's monthly credit pool is now past its buffer threshold and this
 * (and further) calls should fail over to the non-Sarvam TTS fallback chain. */
export async function recordTtsSpendAndCheckCap(chars: number): Promise<boolean> {
  return recordAndCheck(ttsInr(chars, DEFAULT_COST_RATES));
}

/** Record one Sarvam STT session (token issuance ≈ one streaming session). */
export async function recordSttSpendAndCheckCap(): Promise<boolean> {
  return recordAndCheck(sttInr(1, DEFAULT_COST_RATES));
}

/** Read-only snapshot for the admin dashboard. */
export async function getSarvamMonthlySpend(): Promise<{ usedCredits: number; capCredits: number }> {
  const raw = await redisGet(monthKey());
  const usedPaise = raw ? parseInt(raw, 10) || 0 : 0;
  return { usedCredits: Math.round(usedPaise) / 100, capCredits: SARVAM_MONTHLY_CREDIT_CAP };
}
