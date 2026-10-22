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

const DAILY_MS = 26 * HOUR_MS; // one missed run plus scheduler jitter; a 10:00 UTC cron is 24.5h old at the 10:30 check
const WEEKLY_MS = 180 * HOUR_MS; // 7d plus the gap to the next 10:30 UTC check

/** Max silence before alerting, one entry per cron in vercel.json (cronHeartbeatHealth.test.ts
    fails when one is missing, and when a listed handler never records its heartbeat).
    Timing invariant: the uptime-check cron (vercel.json, 10:30 UTC) reads these, so a failed run
    surfaces at the first check after it goes stale. Tighten an entry when its schedule changes. */
export const CRON_MAX_SILENCE_MS: Record<string, number> = {
  "reset-expired-subscriptions": DAILY_MS, // 00:00 UTC, downgrades lapsed paid plans
  "cleanup-deleted-accounts": DAILY_MS, // 03:00 UTC, account-erasure (DPDP) SLA
  "send-renewal-reminders": DAILY_MS, // 09:00 UTC
  "cron-reconcile-unlock-orders": DAILY_MS, // money path
  "cron-credit-no-response": DAILY_MS, // money path
  "cron-rematch-requirements": DAILY_MS,
  "send-employer-nudges": DAILY_MS,
  "send-employer-winback": DAILY_MS,
  "send-interview-reminders": DAILY_MS,
  "re-engage-users": DAILY_MS,
  "send-abandonment-emails": DAILY_MS,
  "weekly-summary": DAILY_MS, // runs daily despite the name
  "aggregate-question-feedback": WEEKLY_MS, // Mondays 09:00 UTC
  "analyze-sessions-cron": DAILY_MS,
  "google-calendar-poll": DAILY_MS,
  "llm-model-watchdog": DAILY_MS,
  "llm-quality-drift": DAILY_MS,
  "prune-llm-usage": DAILY_MS,
  "prune-notifications": DAILY_MS,
  "send-onboarding-drip": DAILY_MS,
  "send-winback-emails": DAILY_MS,
  "send-activation-emails": DAILY_MS,
};

/** vercel.json cron path -> heartbeat name. null = deliberately has none: uptime-check is the
    reader of these heartbeats, so it cannot attest to its own liveness. */
export const CRON_PATH_HEARTBEAT: Record<string, string | null> = {
  "/api/send-renewal-reminders": "send-renewal-reminders",
  "/api/send-interview-reminders": "send-interview-reminders",
  "/api/reset-expired-subscriptions": "reset-expired-subscriptions",
  "/api/uptime-check": null,
  "/api/re-engage-users": "re-engage-users",
  "/api/cleanup-deleted-accounts": "cleanup-deleted-accounts",
  "/api/send-abandonment-emails": "send-abandonment-emails",
  "/api/cron/weekly-summary": "weekly-summary",
  "/api/aggregate-question-feedback": "aggregate-question-feedback",
  "/api/cron/analyze-sessions": "analyze-sessions-cron",
  "/api/calendar/google/poll": "google-calendar-poll",
  "/api/cron/llm-model-watchdog": "llm-model-watchdog",
  "/api/cron/llm-quality-drift": "llm-quality-drift",
  "/api/prune-llm-usage": "prune-llm-usage",
  "/api/send-onboarding-drip": "send-onboarding-drip",
  "/api/send-winback-emails": "send-winback-emails",
  "/api/send-activation-emails": "send-activation-emails",
  "/api/cron/rematch-requirements": "cron-rematch-requirements",
  "/api/prune-notifications": "prune-notifications",
  "/api/cron-reconcile-unlock-orders": "cron-reconcile-unlock-orders",
  "/api/cron-credit-no-response": "cron-credit-no-response",
  "/api/send-employer-nudges": "send-employer-nudges",
  "/api/send-employer-winback": "send-employer-winback",
};

/** Crons whose silence strands customer money or legal deadlines: a never-recorded heartbeat is
    critical here (they have reported for weeks, so it is not first-deploy noise); other crons
    only warn. */
export const CRITICAL_WHEN_MISSING = new Set(["cron-reconcile-unlock-orders", "cron-credit-no-response"]);

const key = (name: string) => `cron_hb:${name}`;

export async function recordCronSuccess(name: string, now = Date.now()): Promise<void> {
  await redisSetEx(key(name), HEARTBEAT_TTL_SEC, new Date(now).toISOString());
}

/** Records a heartbeat only for a run that finished without errors, so a cron
    that "succeeds" with a 200 while half its work failed still goes stale and
    alerts. Returns whether it recorded. */
export async function recordCronResult(name: string, result: { errors?: number }, now = Date.now()): Promise<boolean> {
  if ((result.errors ?? 0) > 0) return false;
  await recordCronSuccess(name, now);
  return true;
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
      const critical = CRITICAL_WHEN_MISSING.has(name);
      alerts.push({
        severity: critical ? "critical" : "warning",
        code: "cron_heartbeat_missing",
        message: `${name} has no recorded successful run in the last 14 days.`,
        action: critical
          ? `Check the ${name} cron in the Vercel dashboard (Crons tab) and its logs now: it settles customer payments.`
          : `Check the ${name} cron in the Vercel dashboard (Crons tab) and its logs. Ignore on the first day after this check was deployed.`,
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

/** Heartbeat alerts. Without Redis nothing can be recorded, so the one alert is
    that monitoring itself is off rather than a "missing" alarm per cron. */
export async function getCronHeartbeatAlerts(now = Date.now()): Promise<CronHeartbeatAlert[]> {
  if (!redisUrl() || !redisToken()) {
    return [{
      severity: "warning",
      code: "cron_heartbeat_unconfigured",
      message: "Cron heartbeats cannot be recorded or read because Redis is not configured.",
      action: "Set the Upstash Redis URL and token so stalled settlement and cleanup crons are noticed.",
    }];
  }
  const entries = await Promise.all(Object.keys(CRON_MAX_SILENCE_MS).map(async (n) => [n, await redisGet(key(n))] as const));
  return evaluateCronHeartbeats(Object.fromEntries(entries), now);
}
