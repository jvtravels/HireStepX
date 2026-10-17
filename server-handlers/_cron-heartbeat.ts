/* Cron heartbeats: each employer cron records "last success" in Upstash on its
 * success exit; the daily health check alerts when one has gone quiet. A cron
 * that 500s (or is silently disabled) otherwise leaves no signal anywhere —
 * stuck unlock orders and uncredited refunds just pile up. Redis-only (no
 * schema); every helper degrades to "no data" rather than throwing. */

declare const process: { env: Record<string, string | undefined> };

// Deliberately not importing _shared: uptime-check (edge) pulls this in via
// _health-alerts and must stay under the edge bundle size limit.
const redisUrl = () => (process.env.UPSTASH_REDIS_REST_URL || "").trim();
const redisToken = () => (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();

async function redisGet(k: string): Promise<string | null> {
  if (!redisUrl() || !redisToken()) return null;
  try {
    const res = await fetch(`${redisUrl()}/get/${encodeURIComponent(k)}`, {
      headers: { Authorization: `Bearer ${redisToken()}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: unknown };
    return typeof data.result === "string" ? data.result : null;
  } catch { return null; }
}

async function redisSetEx(k: string, ttlSec: number, value: string): Promise<void> {
  if (!redisUrl() || !redisToken()) return;
  try {
    await fetch(`${redisUrl()}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${redisToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify([["SET", k, value, "EX", ttlSec]]),
      signal: AbortSignal.timeout(3000),
    });
  } catch { /* heartbeat is best-effort */ }
}

const HOUR_MS = 3_600_000;
// Long enough that "key missing" means the cron has not succeeded in weeks.
const HEARTBEAT_TTL_SEC = 14 * 24 * 3600;

/** Max silence before alerting. Daily crons get 25h (one missed run + jitter).
    Tighten the reconcile entry to 60 min when its vercel.json schedule becomes hourly. */
export const CRON_MAX_SILENCE_MS: Record<string, number> = {
  "cron-reconcile-unlock-orders": 25 * HOUR_MS,
  "cron-credit-no-response": 25 * HOUR_MS,
  "cron-rematch-requirements": 25 * HOUR_MS,
};

const key = (name: string) => `cron_hb:${name}`;

export async function recordCronSuccess(name: string, now = Date.now()): Promise<void> {
  await redisSetEx(key(name), HEARTBEAT_TTL_SEC, new Date(now).toISOString());
}

export interface CronHeartbeatAlert {
  severity: "critical" | "warning";
  code: string;
  message: string;
  action: string;
}

/** Pure: lastSuccess maps cron name -> ISO timestamp (or null when no key). */
export function evaluateCronHeartbeats(
  lastSuccess: Readonly<Record<string, string | null>>,
  now: number,
  limits: Readonly<Record<string, number>> = CRON_MAX_SILENCE_MS,
): CronHeartbeatAlert[] {
  const alerts: CronHeartbeatAlert[] = [];
  for (const [name, maxMs] of Object.entries(limits)) {
    const iso = lastSuccess[name];
    const at = iso ? new Date(iso).getTime() : NaN;
    if (!Number.isFinite(at)) {
      alerts.push({
        severity: "warning",
        code: "cron_heartbeat_missing",
        message: `${name} has no recorded successful run in the last 14 days.`,
        action: `Check the ${name} cron in the Vercel dashboard (Crons tab) and its logs. Ignore on the first day after this check was deployed.`,
      });
      continue;
    }
    const age = now - at;
    if (age > maxMs) {
      alerts.push({
        severity: "critical",
        code: "cron_stale",
        message: `${name} last succeeded ${Math.floor(age / HOUR_MS)}h ago (limit ${Math.round(maxMs / HOUR_MS)}h).`,
        action: `Open the ${name} run logs in Vercel; the job is failing, unauthorized (CRON_SECRET) or no longer scheduled.`,
      });
    }
  }
  return alerts;
}

/** Heartbeat alerts, or [] when Redis is not configured (nothing could have
    been recorded, so "missing" would be a permanent false alarm). */
export async function getCronHeartbeatAlerts(now = Date.now()): Promise<CronHeartbeatAlert[]> {
  if (!redisUrl() || !redisToken()) return [];
  const entries = await Promise.all(Object.keys(CRON_MAX_SILENCE_MS).map(async (n) => [n, await redisGet(key(n))] as const));
  return evaluateCronHeartbeats(Object.fromEntries(entries), now);
}
