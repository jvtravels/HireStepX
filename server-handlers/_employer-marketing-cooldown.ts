/* One shared per-employer cooldown across every lifecycle (marketing) email
 * cron. The nudge kinds (matches_waiting 3-10d, stale_job 14-45d) and the
 * win-back kinds (no_unlock 7-60d) have overlapping age windows, so without a
 * common gate a day-8 employer can get two mails the same morning.
 *
 * The slot is claimed with an atomic SET NX BEFORE sending and fails CLOSED:
 * if Redis is unreachable we cannot prove the employer was not mailed
 * recently, and Resend idempotency keys only last 24h, so a Redis outage with
 * a fail-open check re-sent 100-150 mails every day. Skipping is the safe side
 * for marketing mail; the next run picks the employer up again. */

export const MARKETING_COOLDOWN_SECONDS = 3 * 86_400;

export const marketingCooldownKey = (employerId: string) => `employer_mkt_cd:${employerId}`;

export type CooldownPipeline = (commands: Array<Array<string | number>>, timeoutMs?: number) => Promise<unknown[] | null>;
export type CooldownClaim = "claimed" | "cooling" | "unavailable";

const TIMEOUT_MS = 1500;

export async function claimMarketingCooldown(
  pipeline: CooldownPipeline,
  employerId: string,
  ttlSec = MARKETING_COOLDOWN_SECONDS,
): Promise<CooldownClaim> {
  const res = await pipeline([["SET", marketingCooldownKey(employerId), new Date().toISOString(), "EX", ttlSec, "NX"]], TIMEOUT_MS);
  if (!res) return "unavailable";
  return res[0] === "OK" ? "claimed" : "cooling";
}

/** Gives the slot back when the send failed, so a transient Resend error does not burn 3 days. Best-effort. */
export async function releaseMarketingCooldown(pipeline: CooldownPipeline, employerId: string): Promise<void> {
  await pipeline([["DEL", marketingCooldownKey(employerId)]], TIMEOUT_MS).catch(() => null);
}
