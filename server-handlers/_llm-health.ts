/* Shared LLM provider health.
 *
 * The circuit breaker in _llm.ts lives in each serverless instance's memory,
 * so a fresh instance has no idea that another instance already watched
 * Gemini time out three times — and every user routed to it waits out the
 * full timeout again. This keeps rolling success/failure counts and hard
 * cooldowns in Upstash so the whole fleet reacts to an outage together.
 *
 * A degraded provider is moved to the back of the chain (not removed), so it
 * still serves as a last resort and recovers on its own once its counts age
 * out of the window. Everything fails open: no Redis, a slow Redis or a bad
 * payload yields "healthy" and the chain runs in its normal order. */

import { redisPipeline } from "./_shared";

const WINDOW_MS = 60_000;
const BUCKET_TTL_SEC = 180;
const MEMO_MS = 10_000;

export const DEGRADED_MIN_FAILURES = 4;
export const DEGRADED_FAILURE_RATE = 0.5;
/* The rate window above needs volume to trip, and at tens of calls an hour a
 * rung that times out almost every call never accumulates 4 failures in 2
 * minutes. A streak of consecutive failures (Envoy-style outlier ejection) has
 * no volume floor; any success clears it and the TTL doubles as the half-open
 * probe: once it lapses the rung is tried again first. */
export const STREAK_DEMOTE_AT = 2;
export const STREAK_TTL_SEC = 600;

export interface ProviderHealth {
  degraded: boolean;
  cooling: boolean;
}

const HEALTHY: ProviderHealth = { degraded: false, cooling: false };
const memo = new Map<string, { at: number; value: ProviderHealth }>();

export function resetHealthMemo(): void {
  memo.clear();
}

const bucketOf = (now: number) => Math.floor(now / WINDOW_MS);
const key = (kind: "f" | "s", name: string, bucket: number) => `llmh:${kind}:${name}:${bucket}`;
const coolKey = (name: string) => `llmh:cool:${name}`;
const streakKey = (name: string) => `llmh:streak:${name}`;

export function isDegraded(failures: number, successes: number): boolean {
  if (failures < DEGRADED_MIN_FAILURES) return false;
  return failures / (failures + successes) >= DEGRADED_FAILURE_RATE;
}

export async function recordProviderOutcome(name: string, ok: boolean, now = Date.now()): Promise<void> {
  const k = key(ok ? "s" : "f", name, bucketOf(now));
  memo.delete(name);
  await redisPipeline([
    ["INCR", k], ["EXPIRE", k, BUCKET_TTL_SEC, "NX"],
    ...(ok ? [["DEL", streakKey(name)]] : [["INCR", streakKey(name)], ["EXPIRE", streakKey(name), STREAK_TTL_SEC]]),
  ]);
}

export async function setSharedCooldown(name: string, durationMs: number): Promise<void> {
  memo.delete(name);
  await redisPipeline([["SET", coolKey(name), "1", "EX", Math.max(1, Math.ceil(durationMs / 1000))]]);
}

const num = (v: unknown) => (typeof v === "string" || typeof v === "number" ? Number(v) || 0 : 0);

export async function loadProviderHealth(names: string[], now = Date.now()): Promise<Map<string, ProviderHealth>> {
  const out = new Map<string, ProviderHealth>();
  const stale: string[] = [];
  for (const n of names) {
    const hit = memo.get(n);
    if (hit && now - hit.at < MEMO_MS) out.set(n, hit.value);
    else stale.push(n);
  }
  if (stale.length === 0) return out;

  const cur = bucketOf(now);
  const commands = stale.flatMap((n) => [
    ["GET", key("f", n, cur)], ["GET", key("f", n, cur - 1)],
    ["GET", key("s", n, cur)], ["GET", key("s", n, cur - 1)],
    ["GET", coolKey(n)], ["GET", streakKey(n)],
  ]);
  const results = await redisPipeline(commands);
  stale.forEach((n, i) => {
    let value = HEALTHY;
    if (results) {
      const r = results.slice(i * 6, i * 6 + 6);
      value = {
        degraded: isDegraded(num(r[0]) + num(r[1]), num(r[2]) + num(r[3])) || num(r[5]) >= STREAK_DEMOTE_AT,
        cooling: r[4] != null,
      };
      memo.set(n, { at: now, value });
    }
    out.set(n, value);
  });
  return out;
}

/** Stable partition: healthy providers keep their order and go first. */
export function orderByHealth<T extends { name: string }>(providers: T[], health: Map<string, ProviderHealth>): T[] {
  const isBad = (p: T) => health.get(p.name)?.degraded === true;
  return [...providers.filter((p) => !isBad(p)), ...providers.filter(isBad)];
}
