/* Write-ahead outbox for live interview turns.
 *
 * Every turn is persisted locally FIRST (IndexedDB, in-memory fallback), then
 * drained to /api/interview-turns in batches. Server inserts are idempotent
 * on the turn id, so re-sending after a lost response is always safe. This
 * replaces the old direct supabase-js insert whose failures were re-queued in
 * localStorage and, because a replay hit a 409 on the primary key, looped
 * forever.
 */

import { apiFetch } from "./apiClient";
import { getConnectionState, subscribeConnection } from "./connectionMonitor";
import { isReachable } from "./_connection-state";
import type { InterviewTurn } from "./supabase";

export type OutboxTurn = Omit<InterviewTurn, "created_at">;

interface OutboxRecord {
  turn: OutboxTurn;
  queuedAt: number;
  attempts: number;
}

export interface TurnStore {
  put(rec: OutboxRecord): Promise<void>;
  getAll(): Promise<OutboxRecord[]>;
  remove(ids: string[]): Promise<void>;
}

const LEGACY_KEY = "hirestepx_pending_turns";
const BATCH = 100;
const MAX_RECORDS = 2000;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_SESSION_MISSING_ATTEMPTS = 30;
const REQUEST_TIMEOUT_MS = 12_000;
const FAILURE_BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

/* ── Stores ── */

export function createMemoryStore(): TurnStore {
  const m = new Map<string, OutboxRecord>();
  return {
    async put(rec) { m.set(rec.turn.id, rec); },
    async getAll() { return [...m.values()]; },
    async remove(ids) { for (const id of ids) m.delete(id); },
  };
}

function createIdbStore(): TurnStore | null {
  if (typeof indexedDB === "undefined") return null;
  const DB = "hirestepx_turn_outbox";
  const STORE = "turns";
  let dbp: Promise<IDBDatabase> | null = null;
  const open = () => {
    if (!dbp) {
      dbp = new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "turn.id" });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error("idb blocked"));
      });
      dbp.catch(() => { dbp = null; });
    }
    return dbp;
  };
  const done = (tx: IDBTransaction) => new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
  return {
    async put(rec) {
      const tx = (await open()).transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(rec);
      await done(tx);
    },
    async getAll() {
      const tx = (await open()).transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll() as IDBRequest<OutboxRecord[]>;
      await done(tx);
      return req.result;
    },
    async remove(ids) {
      if (ids.length === 0) return;
      const tx = (await open()).transaction(STORE, "readwrite");
      for (const id of ids) tx.objectStore(STORE).delete(id);
      await done(tx);
    },
  };
}

/** Falls back to memory per-operation if IDB throws (private mode, quota). */
function createDefaultStore(): TurnStore {
  const idb = createIdbStore();
  const mem = createMemoryStore();
  if (!idb) return mem;
  return {
    async put(rec) { try { await idb.put(rec); } catch { await mem.put(rec); } },
    async getAll() {
      const [a, b] = await Promise.all([idb.getAll().catch(() => [] as OutboxRecord[]), mem.getAll()]);
      return [...a, ...b];
    },
    async remove(ids) { await Promise.all([idb.remove(ids).catch(() => {}), mem.remove(ids)]); },
  };
}

let store: TurnStore | null = null;
const getStore = () => (store ??= createDefaultStore());

/* ── Legacy localStorage queue migration (one-shot) ── */

let migrated = false;
async function migrateLegacyQueue(): Promise<void> {
  if (migrated) return;
  migrated = true;
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw) as OutboxTurn[];
    if (Array.isArray(legacy)) {
      for (const turn of legacy) {
        if (turn && typeof turn.id === "string") await getStore().put({ turn, queuedAt: Date.now(), attempts: 0 });
      }
    }
    localStorage.removeItem(LEGACY_KEY);
  } catch { /* corrupt legacy queue — drop it rather than retry forever */
    try { localStorage.removeItem(LEGACY_KEY); } catch { /* ignore */ }
  }
}

/* ── Flush ── */

interface IngestResponse { ok: boolean; saved: string[]; retry: string[]; dropped: string[] }

let flushing: Promise<{ flushed: number; failed: number }> | null = null;
let consecutiveFailures = 0;
let blockedUntil = 0;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;

async function runFlush(force: boolean): Promise<{ flushed: number; failed: number }> {
  await migrateLegacyQueue();
  const now = Date.now();
  if (!force && now < blockedUntil) return { flushed: 0, failed: 0 };

  const all = await getStore().getAll();
  if (all.length === 0) return { flushed: 0, failed: 0 };

  const expired = all.filter((r) => now - r.queuedAt > MAX_AGE_MS || r.attempts >= MAX_SESSION_MISSING_ATTEMPTS).map((r) => r.turn.id);
  if (expired.length) await getStore().remove(expired);
  const expiredSet = new Set(expired);
  const live = all
    .filter((r) => !expiredSet.has(r.turn.id))
    .sort((a, b) => a.queuedAt - b.queuedAt || a.turn.turn_index - b.turn.turn_index);

  if (live.length > MAX_RECORDS) {
    const overflow = live.splice(0, live.length - MAX_RECORDS);
    await getStore().remove(overflow.map((r) => r.turn.id));
  }

  let flushed = 0;
  let remaining = live.length;
  for (let i = 0; i < live.length; i += BATCH) {
    const batch = live.slice(i, i + BATCH);
    const res = await apiFetch<IngestResponse>("/api/interview-turns", { turns: batch.map((r) => r.turn) }, { timeoutMs: REQUEST_TIMEOUT_MS });
    if (!res.ok || !res.data) {
      // 4xx other than 429 means this payload is permanently rejected — don't loop.
      if (res.status >= 400 && res.status < 500 && res.status !== 429 && res.status !== 401 && res.status !== 408) {
        await getStore().remove(batch.map((r) => r.turn.id));
        remaining -= batch.length;
        continue;
      }
      consecutiveFailures++;
      blockedUntil = Date.now() + FAILURE_BACKOFF_MS[Math.min(consecutiveFailures - 1, FAILURE_BACKOFF_MS.length - 1)];
      scheduleBackoffFlush();
      return { flushed, failed: remaining };
    }
    consecutiveFailures = 0;
    const done = new Set([...res.data.saved, ...res.data.dropped]);
    await getStore().remove([...done]);
    flushed += res.data.saved.length;
    remaining -= done.size;
    const retry = new Set(res.data.retry);
    for (const r of batch) if (retry.has(r.turn.id)) await getStore().put({ ...r, attempts: r.attempts + 1 });
  }
  blockedUntil = 0;
  return { flushed, failed: remaining };
}

function scheduleBackoffFlush(): void {
  if (backoffTimer || typeof window === "undefined") return;
  const wait = Math.max(500, blockedUntil - Date.now());
  backoffTimer = setTimeout(() => { backoffTimer = null; void flushPendingTurns(); }, wait);
}

/** Single-flight drain of the outbox. Safe to call from anywhere, any time. */
export function flushPendingTurns(opts: { force?: boolean } = {}): Promise<{ flushed: number; failed: number }> {
  if (flushing) return flushing;
  flushing = runFlush(!!opts.force)
    .catch(() => ({ flushed: 0, failed: 0 }))
    .finally(() => { flushing = null; });
  return flushing;
}

/** Persist locally first, then try to ship. Resolves once the turn is durable on this device. */
export async function saveInterviewTurn(turn: OutboxTurn): Promise<{ ok: boolean; error?: string }> {
  try {
    await getStore().put({ turn, queuedAt: Date.now(), attempts: 0 });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "outbox write failed" };
  }
  if (isReachable(getConnectionState())) void flushPendingTurns();
  return { ok: true };
}

/** Drain everything that can be recovered after a connectivity gap: turns + queued session saves. */
export async function flushSessionOutbox(): Promise<void> {
  const tasks: Array<Promise<unknown>> = [flushPendingTurns({ force: true })];
  tasks.push(
    Promise.all([import("./saveRetryQueue"), import("./interviewAPI")])
      .then(([{ drainQueue }, { saveSessionResult }]) =>
        drainQueue((payload, uid) => saveSessionResult(payload, uid).then((r) => ({ cloudOk: r.cloudOk }))))
      .catch(() => { /* module load / IDB unavailable */ }),
  );
  await Promise.allSettled(tasks);
}

let wired = false;
/** Drain on connectivity recovery and when the tab becomes visible again. Idempotent. */
export function installTurnOutboxDrain(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  // Ask the browser not to evict the outbox under storage pressure (best-effort; may be denied).
  try { void navigator.storage?.persist?.(); } catch { /* unsupported */ }
  let prevReachable = isReachable(getConnectionState());
  subscribeConnection(() => {
    const now = isReachable(getConnectionState());
    if (now && !prevReachable) void flushPendingTurns({ force: true });
    prevReachable = now;
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void flushPendingTurns();
  });
}

export function __setTurnStoreForTests(s: TurnStore | null): void {
  store = s;
  migrated = false;
  flushing = null;
  consecutiveFailures = 0;
  blockedUntil = 0;
  if (backoffTimer) { clearTimeout(backoffTimer); backoffTimer = null; }
}
