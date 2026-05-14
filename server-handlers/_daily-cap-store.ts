/* Daily per-user turn-cap backing store (2026-05-14).
 * ─────────────────────────────────────────────────────────────────────
 * Replaces the `turnsToday=0` placeholder in negotiate-turn.ts. Provides
 * an in-memory implementation with date-rollover that's good enough for
 * a single-region edge deployment. When `REDIS_URL` is set and an
 * `ioredis` (or compatible) client is available on disk, `getRedisClient`
 * lazily constructs a singleton and routes reads/writes through it;
 * otherwise it falls back to the in-memory map and logs ONCE so the
 * misconfiguration is visible without spamming.
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

declare const process: { env: Record<string, string | undefined> };

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

/* ─── Redis client singleton ─────────────────────────────────────────
 *
 * `getRedisClient` returns a client when (a) REDIS_URL is set and (b) a
 * runtime-loadable redis library is present. Today we look for ioredis;
 * if it's not in node_modules the dynamic import throws and we fall
 * back. The lazy-singleton + warning-once pattern means an operator
 * sees the misconfiguration without spamming the log on every turn.
 *
 * Typed as `unknown` because we cannot import the type at compile time
 * without adding ioredis to package.json — callers narrow to the small
 * surface they need via the `as unknown as T` bridge pattern. */
interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: string, ttlSec: number): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSec: number): Promise<unknown>;
}

let redisClient: RedisLike | null = null;
let redisInitTried = false;
let redisWarningLogged = false;

function logRedisWarning(message: string): void {
  if (redisWarningLogged) return;
  redisWarningLogged = true;
  console.warn(`[daily-cap-store] ${message}`);
}

async function getRedisClient(): Promise<RedisLike | null> {
  if (redisClient) return redisClient;
  if (redisInitTried) return null;
  redisInitTried = true;
  const url = process?.env?.REDIS_URL;
  if (!url) return null;
  try {
    /* Dynamic import — bundlers that can't resolve the module (e.g. edge
     * runtime without ioredis installed) will throw here. We catch and
     * fall back transparently. */
    /* String-built specifier prevents TS from resolving the dep at
     * compile time (ioredis is intentionally not in package.json — see
     * header). At runtime, if the module is installed, dynamic import
     * resolves it; otherwise the catch falls back to in-memory. */
    const ioredisName = "ioredis";
    const mod = (await (import(ioredisName) as Promise<unknown>).catch(() => null)) as
      | { default?: new (url: string) => RedisLike }
      | null;
    const Ctor = mod?.default;
    if (!Ctor) {
      logRedisWarning("REDIS_URL set but ioredis is not installed; using in-memory store.");
      return null;
    }
    redisClient = new Ctor(url);
    return redisClient;
  } catch (err) {
    logRedisWarning(
      `REDIS_URL set but Redis client init failed (${
        err instanceof Error ? err.message : String(err)
      }); using in-memory store.`,
    );
    return null;
  }
}

/** Test-only — re-initialise the Redis-detection state so tests that
 *  flip REDIS_URL mid-run can re-probe. */
export function __resetRedisClientForTests(): void {
  redisClient = null;
  redisInitTried = false;
  redisWarningLogged = false;
}

/** Read current turn count for the given user, scoped to today (UTC).
 *  Returns 0 if no entry exists or the entry is stale (different day).
 *  Async so the Redis implementation can swap in without touching
 *  callers. */
export async function getTurnsToday(userId: string | null | undefined): Promise<number> {
  const today = ymd();
  const client = await getRedisClient();
  if (client) {
    try {
      const raw = await client.get(redisKeyFor(userId, today));
      if (!raw) return 0;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      /* fall through to in-memory on Redis error — never block a turn
       * on transient infra problems. */
    }
  }
  const k = keyFor(userId);
  const e = STORE.get(k);
  if (!e || e.date !== today) return 0;
  return e.count;
}

/** Atomically (within this V8 isolate, or via Redis INCR) increment and
 *  return the new count. Rolls over to 1 when the stored entry is from
 *  a previous day. */
export async function incrementTurnsToday(
  userId: string | null | undefined,
): Promise<number> {
  const today = ymd();
  const client = await getRedisClient();
  if (client) {
    try {
      const key = redisKeyFor(userId, today);
      const next = await client.incr(key);
      /* Set the TTL on first-write only — INCR creates the key with no
       * TTL otherwise. EXPIRE is a no-op if a TTL already exists. */
      if (next === 1) await client.expire(key, REDIS_TTL_SEC);
      return next;
    } catch {
      /* fall through to in-memory */
    }
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

/** Test-only: reset the in-memory map. NOT exposed to handlers. */
export function __resetDailyCapStoreForTests(): void {
  STORE.clear();
  __resetRedisClientForTests();
}

/** Test-only — exposed so tests can swap in a fake RedisLike to exercise
 *  the Redis branch without standing up a real server. */
export function __setRedisClientForTests(client: RedisLike | null): void {
  redisClient = client;
  redisInitTried = true;
}
