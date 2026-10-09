/* SLOs + event-driven burn-rate alerting.
 *
 * Each SLI event INCRs a 5-minute Upstash bucket. On a BAD event we read
 * the trailing windows and apply the Google SRE multi-window burn-rate rule
 * (30-day budget):
 *   critical: 1h burn ≥ 14.4 AND 5m burn ≥ 14.4  (2% of budget in an hour)
 *   warning:  6h burn ≥ 6    AND 30m burn ≥ 6    (5% of budget in 6 hours)
 * The short window confirms the burn is still happening, so an alert stops
 * firing soon after recovery. Alerts are deduped per SLO+severity for an
 * hour via SET NX and fan out to slog.error (→ Sentry), email (Resend), and
 * an optional Slack webhook.
 *
 * Detection runs on the failing request itself, so alerting is near-real-
 * time without a sub-daily cron. Total outages with zero traffic are
 * covered by /api/uptime-check. Everything here fails open: SLO
 * bookkeeping must never break or noticeably slow a request. */

import { slog } from "./_shared";

declare const process: { env: Record<string, string | undefined> };

export const SLOS = {
  llm_availability: {
    objective: 0.995,
    description: "LLM calls answered by any provider (Groq → Gemini → Cerebras)",
    minEvents: 20,
  },
  llm_primary: {
    objective: 0.9,
    description: "LLM calls answered by the first provider in the chain (fallbacks are slower and ~2.3× costlier)",
    minEvents: 30,
  },
  session_evaluation: {
    objective: 0.98,
    description: "Session evaluations that produce a scored report",
    minEvents: 10,
  },
  payment_verification: {
    objective: 0.995,
    description: "Signature-valid Razorpay payments that are recorded and activate the plan",
    minEvents: 3,
  },
} as const;

export type SloName = keyof typeof SLOS;
export type AlertSeverity = "critical" | "warning";

const BUCKET_MS = 5 * 60_000;
const BUCKET_TTL_SEC = 7 * 3600;
const ALERT_DEDUPE_SEC = 3600;

const WINDOWS: ReadonlyArray<{ severity: AlertSeverity; longBuckets: number; shortBuckets: number; threshold: number }> = [
  { severity: "critical", longBuckets: 12, shortBuckets: 1, threshold: 14.4 },
  { severity: "warning", longBuckets: 72, shortBuckets: 6, threshold: 6 },
];
const MAX_BUCKETS = 72;

export interface BucketCounts { good: number; bad: number }

export function burnRate({ good, bad }: BucketCounts, objective: number): number {
  const total = good + bad;
  if (total === 0) return 0;
  return bad / total / (1 - objective);
}

function sum(buckets: BucketCounts[]): BucketCounts {
  return buckets.reduce((acc, b) => ({ good: acc.good + b.good, bad: acc.bad + b.bad }), { good: 0, bad: 0 });
}

/** buckets[0] is the current 5-minute bucket, buckets[i] is i buckets ago. */
export function evaluateBurn(
  name: SloName,
  buckets: BucketCounts[],
): { severity: AlertSeverity; longBurn: number; shortBurn: number; long: BucketCounts } | null {
  const { objective, minEvents } = SLOS[name];
  for (const w of WINDOWS) {
    const long = sum(buckets.slice(0, w.longBuckets));
    if (long.good + long.bad < minEvents) continue;
    const longBurn = burnRate(long, objective);
    const shortBurn = burnRate(sum(buckets.slice(0, w.shortBuckets)), objective);
    if (longBurn >= w.threshold && shortBurn >= w.threshold) {
      return { severity: w.severity, longBurn, shortBurn, long };
    }
  }
  return null;
}

/* ── Effects (injectable for tests) ── */

type RedisCmd = Array<string | number>;
export interface SloDeps {
  redis: (cmds: RedisCmd[]) => Promise<Array<{ result?: unknown }> | null>;
  alert: (subject: string, text: string) => Promise<void>;
  now: () => number;
}

async function upstashPipeline(cmds: RedisCmd[]): Promise<Array<{ result?: unknown }> | null> {
  const url = (process.env.UPSTASH_REDIS_REST_URL || "").trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN || "").trim();
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds.map((c) => c.map(String))),
      signal: AbortSignal.timeout(1500),
    });
    return res.ok ? ((await res.json()) as Array<{ result?: unknown }>) : null;
  } catch {
    return null;
  }
}

async function sendAlert(subject: string, text: string): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    tasks.push(fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "HireStepX Alerts <alerts@hirestepx.com>",
        to: [process.env.ALERT_EMAIL || "support@hirestepx.com"],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(3000),
    }));
  }
  const slack = process.env.SLACK_ALERT_WEBHOOK_URL;
  if (slack) {
    tasks.push(fetch(slack, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `*${subject}*\n${text}` }),
      signal: AbortSignal.timeout(3000),
    }));
  }
  await Promise.allSettled(tasks);
}

const defaultDeps: SloDeps = { redis: upstashPipeline, alert: sendAlert, now: Date.now };

const bucketKey = (name: SloName, bucket: number, kind: "g" | "b") => `slo:${name}:${bucket}:${kind}`;

const toCount = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};

/** Record one SLI event. Never throws. */
export async function recordSlo(name: SloName, good: boolean, deps: SloDeps = defaultDeps): Promise<void> {
  try {
    const bucket = Math.floor(deps.now() / BUCKET_MS);
    const key = bucketKey(name, bucket, good ? "g" : "b");
    const wrote = await deps.redis([["INCR", key], ["EXPIRE", key, BUCKET_TTL_SEC, "NX"]]);
    if (good || !wrote) return;

    const keys: string[] = [];
    for (let i = 0; i < MAX_BUCKETS; i++) keys.push(bucketKey(name, bucket - i, "g"), bucketKey(name, bucket - i, "b"));
    const read = await deps.redis([["MGET", ...keys]]);
    const values = read?.[0]?.result;
    if (!Array.isArray(values)) return;
    const buckets: BucketCounts[] = [];
    for (let i = 0; i < MAX_BUCKETS; i++) buckets.push({ good: toCount(values[2 * i]), bad: toCount(values[2 * i + 1]) });

    const verdict = evaluateBurn(name, buckets);
    if (!verdict) return;

    const claim = await deps.redis([["SET", `slo-alert:${name}:${verdict.severity}`, "1", "NX", "EX", ALERT_DEDUPE_SEC]]);
    if (claim?.[0]?.result !== "OK") return;

    const slo = SLOS[name];
    const total = verdict.long.good + verdict.long.bad;
    const errorPct = ((verdict.long.bad / total) * 100).toFixed(1);
    const subject = `[${verdict.severity.toUpperCase()}] SLO burn: ${name}`;
    const text = [
      `${slo.description}`,
      `Objective ${(slo.objective * 100).toFixed(1)}%. Error rate ${errorPct}% (${verdict.long.bad}/${total} events) in the alert window.`,
      `Burn rate ${verdict.longBurn.toFixed(1)}× long window, ${verdict.shortBurn.toFixed(1)}× short window.`,
      `Deduped for 1h. Check Sentry and provider status pages.`,
    ].join("\n");
    slog.error(`slo: ${name} burning error budget`, {
      slo: name,
      severity: verdict.severity,
      longBurn: verdict.longBurn,
      shortBurn: verdict.shortBurn,
      bad: verdict.long.bad,
      total,
    });
    await deps.alert(subject, text);
  } catch {
    /* SLO bookkeeping must never break a request */
  }
}
