/* Single-flight guard for session grading. The eager grade (fired by
 * save-session) and the report page's own request can overlap; without a lock
 * both run the full ~10K-token LLM prompt and burn the provider's daily quota
 * twice. Fails open: with no Redis, grading proceeds unguarded. */

declare const process: { env: Record<string, string | undefined> };

type RedisCmd = Array<string | number>;
export interface EvalLockDeps {
  redis: (cmds: RedisCmd[]) => Promise<Array<{ result?: unknown }> | null>;
}

const LOCK_TTL_SEC = 110;

async function upstash(cmds: RedisCmd[]): Promise<Array<{ result?: unknown }> | null> {
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

const lockKey = (sessionId: string) => `eval-lock:${sessionId}`;

/** True when this caller now owns grading for the session (or Redis is unavailable). */
export async function acquireEvalLock(sessionId: string, deps: EvalLockDeps = { redis: upstash }): Promise<boolean> {
  const out = await deps.redis([["SET", lockKey(sessionId), "1", "NX", "EX", LOCK_TTL_SEC]]);
  if (!out) return true;
  return out[0]?.result === "OK";
}

export async function releaseEvalLock(sessionId: string, deps: EvalLockDeps = { redis: upstash }): Promise<void> {
  await deps.redis([["DEL", lockKey(sessionId)]]);
}

/** Poll for the lock holder's result. Returns the first non-null value, or null on timeout. */
export async function waitForResult<T>(
  poll: () => Promise<T | null>,
  { intervalMs, maxMs, sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)) }: { intervalMs: number; maxMs: number; sleep?: (ms: number) => Promise<void> },
): Promise<T | null> {
  for (let waited = 0; waited < maxMs; waited += intervalMs) {
    await sleep(intervalMs);
    const hit = await poll();
    if (hit) return hit;
  }
  return null;
}
