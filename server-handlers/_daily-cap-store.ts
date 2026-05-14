/* Daily per-user turn-cap backing store (2026-05-14).
 * ─────────────────────────────────────────────────────────────────────
 * Replaces the `turnsToday=0` placeholder in negotiate-turn.ts. Provides
 * an in-memory implementation with date-rollover that's good enough for
 * a single-region edge deployment; if REDIS_URL is set we log a TODO
 * stub but still read/write the in-memory map (so behaviour is
 * deterministic in tests).
 *
 * The store keys on (userId, ymd) so the count auto-resets at UTC
 * midnight. Anonymous traffic (no userId) is keyed on the string
 * "anon" — abuse mitigation for unauth flows happens upstream via the
 * IP rate-limiter in _shared. */

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

let redisStubLogged = false;
function maybeLogRedisStub(): void {
  if (redisStubLogged) return;
  if (process?.env?.REDIS_URL) {
    redisStubLogged = true;
    /* eslint-disable-next-line no-console */
    console.warn("[daily-cap-store] TODO: wire to Redis here (REDIS_URL is set)");
  }
}

/** Read current turn count for the given user, scoped to today (UTC).
 *  Returns 0 if no entry exists or the entry is stale (different day).
 *  Async so a future Redis implementation can swap in without touching
 *  callers. */
export async function getTurnsToday(userId: string | null | undefined): Promise<number> {
  maybeLogRedisStub();
  const today = ymd();
  const k = keyFor(userId);
  const e = STORE.get(k);
  if (!e || e.date !== today) return 0;
  return e.count;
}

/** Atomically (within this V8 isolate) increment and return the new
 *  count. Rolls over to 1 when the stored entry is from a previous
 *  day. */
export async function incrementTurnsToday(
  userId: string | null | undefined,
): Promise<number> {
  maybeLogRedisStub();
  const today = ymd();
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
  redisStubLogged = false;
}
