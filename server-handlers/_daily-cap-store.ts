/* Daily per-user turn-cap backing store (2026-05-14, Upstash-backed 2026-06-15).
 * ─────────────────────────────────────────────────────────────────────
 * Replaces the `turnsToday=0` placeholder in negotiate-turn.ts. Production
 * routes reads/writes through the project's already-provisioned Upstash
 * Redis (the same instance behind the IP rate-limiter and the
 * generate-questions response cache) via the shared REST helpers in
 * `_shared.ts` — `redisGet` + `redisIncrByWithExpiry`. This is the only
 * store that is shared across edge isolates / regions, so the daily cost
 * cap actually holds in a distributed Vercel deployment.
 *
 * When Upstash is not configured (local dev, or the REST helpers return
 * null on a transient failure) we fall back to an in-memory map with
 * date-rollover. That fallback is per-isolate — fine for local dev, but
 * it does NOT enforce a global cap, so Upstash must be configured in
 * production for the cap to mean anything.
 *
 * Tests can inject a `RedisLike` client via `__setRedisClientForTests`,
 * which takes precedence over both Upstash and the in-memory map.
 *
 * The store keys on (userId, ymd) so the count auto-resets at UTC
 * midnight. Anonymous traffic (no userId) is keyed on the string
 * "anon" — abuse mitigation for unauth flows happens upstream via the
 * IP rate-limiter in _shared.
 *
 * Redis key shape: `hsx:daily-cap:${userId}:${YYYY-MM-DD}` with a 36-hour
 * TTL (long enough that a request straddling midnight still sees its
 * own historical entry, short enough that abandoned keys don't pile
 * up). */

import { redisGet, redisIncrByWithExpiry } from "./_shared";

interface DailyEntry {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

const STORE: Map<string, DailyEntry> = new Map();

/** UTC YYYY-MM-DD for a given epoch ms (defaults to now). Pure. */
export function ymd(at: number = Date.now()): string {
  const d = new Date(at);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function keyFor(userId: string | null | undefined): string {
  return userId && typeof userId === "string" ? userId : "anon";
}

function redisKeyFor(userId: string | null | undefined, date: string): string {
  return `hsx:daily-cap:${keyFor(userId)}:${date}`;
}

/** 36 hours — see header comment. */
const REDIS_TTL_SEC = 36 * 60 * 60;

/* ─── Test-injectable Redis client ───────────────────────────────────
 *
 * Production does NOT use this — it goes straight to the Upstash REST
 * helpers. The injection seam exists only so unit tests can exercise
 * the "Redis present" and "Redis throws → fall back" branches without
 * standing up a real instance. When set, it takes precedence over
 * Upstash and the in-memory map. */
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, ttlSec: number): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSec: number): Promise<unknown>;
}

let injectedClient: RedisLike | null = null;

/** Test-only — reset the injected-client state. */
export function __resetRedisClientForTests(): void {
  injectedClient = null;
}

/** Test-only — swap in a fake RedisLike to exercise the Redis branch
 *  without standing up a real server. */
export function __setRedisClientForTests(client: RedisLike | null): void {
  injectedClient = client;
}

/** Read current turn count for the given user, scoped to today (UTC).
 *  Returns 0 if no entry exists or the entry is stale (different day).
 *  Async so the Redis implementation can swap in without touching
 *  callers. */
export async function getTurnsToday(userId: string | null | undefined): Promise<number> {
  const today = ymd();
  const key = redisKeyFor(userId, today);

  if (injectedClient) {
    try {
      const raw = await injectedClient.get(key);
      if (!raw) return 0;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      /* fall through to in-memory on error — never block a turn on
       * transient infra problems. */
    }
  } else {
    /* Production path: Upstash REST. `redisGet` returns null when
     * Upstash is unconfigured OR the key is genuinely absent; both
     * resolve to "0 today" (an absent key means no turns yet), so we
     * only trust a non-null, parseable value. */
    const raw = await redisGet(key);
    if (raw != null) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }

  const k = keyFor(userId);
  const e = STORE.get(k);
  if (!e || e.date !== today) return 0;
  return e.count;
}

/** Atomically increment and return the new count. Rolls over to 1 when
 *  the stored entry is from a previous day (Redis handles this via the
 *  date-scoped key + TTL; the in-memory fallback checks the stored date). */
export async function incrementTurnsToday(
  userId: string | null | undefined,
): Promise<number> {
  const today = ymd();
  const key = redisKeyFor(userId, today);

  if (injectedClient) {
    try {
      const next = await injectedClient.incr(key);
      /* Set the TTL on first-write only — INCR creates the key with no
       * TTL otherwise. EXPIRE is a no-op if a TTL already exists. */
      if (next === 1) await injectedClient.expire(key, REDIS_TTL_SEC);
      return next;
    } catch {
      /* fall through to in-memory */
    }
  } else {
    /* Production path: a single atomic INCRBY + EXPIRE(NX) over Upstash
     * REST. Returns null when Upstash is unconfigured or unreachable, in
     * which case we fall through to the per-isolate in-memory counter. */
    const next = await redisIncrByWithExpiry(key, 1, REDIS_TTL_SEC);
    if (next != null) return next;
  }

  const k = keyFor(userId);
  const e = STORE.get(k);
  if (!e || e.date !== today) {
    STORE.set(k, { date: today, count: 1 });
    return 1;
  }
  e.count += 1;
  STORE.set(k, e);
  return e.count;
}

/** Test-only: reset the in-memory map and injected client. NOT exposed
 *  to handlers. */
export function __resetDailyCapStoreForTests(): void {
  STORE.clear();
  __resetRedisClientForTests();
}
