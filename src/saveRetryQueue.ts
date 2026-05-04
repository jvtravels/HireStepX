/* HireStepX — Session-save retry queue.
   ─────────────────────────────────────────────────────────────────────
   When the cloud save at end-of-interview fails or hits the 10s timeout
   (slow networks, transient Supabase outages, fetch wrappers from
   browser extensions stalling the round-trip), the user previously
   ended up with a local-only session that could be permanently lost on
   cache clear / device switch.

   This queue persists those payloads to IndexedDB and retries them
   transparently on:
     • App mount (when user is signed in)
     • The browser's `online` event firing
     • A 5-minute background poll (covers the case where the user
       came online before mount and we missed the event)

   Retry policy:
     • Up to 5 attempts per record
     • Exponential backoff (60s, 5m, 30m, 3h, 24h since last attempt)
     • Records older than 14 days are pruned regardless

   The queue is local-first (IndexedDB), survives across tabs, and never
   blocks the UI — every operation is non-await fire-and-forget from the
   caller's perspective. Uses raw IndexedDB (no idb wrapper dependency)
   to keep bundle weight at zero. */

import type { SessionResult } from "./interviewAPI";

const DB_NAME = "hirestepx_save_queue";
const DB_VERSION = 1;
const STORE = "pending_saves";
const MAX_ATTEMPTS = 5;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

/** Backoff window from `lastAttemptAt`. attempt is 0-indexed (0 = first
 *  retry). Sequence: 1m → 5m → 30m → 3h → 24h. */
const BACKOFF_MS = [
  60_000,
  5 * 60_000,
  30 * 60_000,
  3 * 60 * 60_000,
  24 * 60 * 60_000,
];

interface PendingSave {
  /** Session UUID — primary key. Also doubles as dedupe key (re-enqueue
   *  of the same session overwrites the prior record). */
  id: string;
  payload: SessionResult;
  userId: string;
  attempts: number;
  /** Last error message, truncated to 200 chars for storage hygiene. */
  lastError?: string;
  queuedAt: number;
  lastAttemptAt: number;
}

/* ─── IndexedDB primitives ──────────────────────────────────────────── */

let _dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn("[saveRetryQueue] IDB open failed:", req.error?.message);
        resolve(null);
      };
      req.onblocked = () => {
        console.warn("[saveRetryQueue] IDB open blocked (another tab holding upgrade)");
        resolve(null);
      };
    } catch (err) {
      console.warn("[saveRetryQueue] IDB open threw:", err instanceof Error ? err.message : err);
      resolve(null);
    }
  });
  return _dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore | null> {
  return openDB().then((db) => {
    if (!db) return null;
    try {
      return db.transaction(STORE, mode).objectStore(STORE);
    } catch (err) {
      console.warn("[saveRetryQueue] tx failed:", err instanceof Error ? err.message : err);
      return null;
    }
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ─── Queue API ──────────────────────────────────────────────────────── */

export async function enqueueSave(
  payload: SessionResult,
  userId: string,
  errorMessage?: string,
): Promise<void> {
  const store = await tx("readwrite");
  if (!store) return;
  const record: PendingSave = {
    id: payload.id,
    payload,
    userId,
    attempts: 0,
    lastError: errorMessage ? errorMessage.slice(0, 200) : undefined,
    queuedAt: Date.now(),
    lastAttemptAt: 0, // 0 = never attempted, ready to drain immediately
  };
  try {
    await reqToPromise(store.put(record));
  } catch (err) {
    console.warn("[saveRetryQueue] enqueue failed:", err instanceof Error ? err.message : err);
  }
}

export async function listPendingSaves(): Promise<PendingSave[]> {
  const store = await tx("readonly");
  if (!store) return [];
  try {
    return await reqToPromise(store.getAll() as IDBRequest<PendingSave[]>);
  } catch {
    return [];
  }
}

export async function removeFromQueue(id: string): Promise<void> {
  const store = await tx("readwrite");
  if (!store) return;
  try {
    await reqToPromise(store.delete(id));
  } catch { /* best-effort */ }
}

async function updateAttempt(record: PendingSave, errorMessage?: string): Promise<void> {
  const store = await tx("readwrite");
  if (!store) return;
  const next: PendingSave = {
    ...record,
    attempts: record.attempts + 1,
    lastAttemptAt: Date.now(),
    lastError: errorMessage ? errorMessage.slice(0, 200) : record.lastError,
  };
  try {
    await reqToPromise(store.put(next));
  } catch { /* best-effort */ }
}

/* ─── Drain ─────────────────────────────────────────────────────────── */

/** Returns true when this record is ready for the next attempt based on
 *  its backoff window. attempts==0 means never tried → always ready. */
export function isReadyForRetry(record: PendingSave, now = Date.now()): boolean {
  if (record.attempts === 0) return true;
  if (record.attempts >= MAX_ATTEMPTS) return false;
  const backoffIdx = Math.min(record.attempts - 1, BACKOFF_MS.length - 1);
  return now - record.lastAttemptAt >= BACKOFF_MS[backoffIdx];
}

let _draining = false;

/**
 * Drain any pending saves whose backoff window has elapsed. Safe to call
 * repeatedly — short-circuits when already draining. Caller passes the
 * actual save function so this module stays decoupled from interviewAPI's
 * import surface (avoids circular imports).
 */
export async function drainQueue(
  saveFn: (payload: SessionResult, userId: string) => Promise<{ cloudOk: boolean }>,
): Promise<{ tried: number; succeeded: number; failed: number; pruned: number }> {
  if (_draining) return { tried: 0, succeeded: 0, failed: 0, pruned: 0 };
  _draining = true;
  let tried = 0;
  let succeeded = 0;
  let failed = 0;
  let pruned = 0;
  try {
    const all = await listPendingSaves();
    const now = Date.now();
    for (const rec of all) {
      // Prune ancient records (gave up trying)
      if (now - rec.queuedAt > MAX_AGE_MS || rec.attempts >= MAX_ATTEMPTS) {
        await removeFromQueue(rec.id);
        pruned++;
        continue;
      }
      if (!isReadyForRetry(rec, now)) continue;
      tried++;
      try {
        const result = await saveFn(rec.payload, rec.userId);
        if (result.cloudOk) {
          await removeFromQueue(rec.id);
          succeeded++;
        } else {
          await updateAttempt(rec, "save returned cloudOk=false");
          failed++;
        }
      } catch (err) {
        await updateAttempt(rec, err instanceof Error ? err.message : String(err));
        failed++;
      }
    }
  } finally {
    _draining = false;
  }
  if (tried > 0 || pruned > 0) {
    console.warn(`[saveRetryQueue] drain: tried=${tried} succeeded=${succeeded} failed=${failed} pruned=${pruned}`);
  }
  return { tried, succeeded, failed, pruned };
}

/* ─── Auto-drain wiring ────────────────────────────────────────────── */

let _autoDrainInstalled = false;

/** Install the auto-drain triggers: online event + 5-minute poll. The
 *  caller (AuthContext) provides the `saveFn` so we don't import
 *  interviewAPI here. Idempotent — repeated calls no-op. */
export function installAutoDrain(
  saveFn: (payload: SessionResult, userId: string) => Promise<{ cloudOk: boolean }>,
): () => void {
  if (typeof window === "undefined" || _autoDrainInstalled) {
    return () => { /* no-op */ };
  }
  _autoDrainInstalled = true;
  const drain = () => { drainQueue(saveFn).catch(() => { /* best-effort */ }); };

  // Initial drain on install
  drain();

  // Drain when the browser comes back online
  window.addEventListener("online", drain);

  // Polled fallback — covers cases where the online event missed
  // (e.g., user was already online when the listener was added).
  const intervalId = window.setInterval(drain, 5 * 60_000);

  return () => {
    window.removeEventListener("online", drain);
    window.clearInterval(intervalId);
    _autoDrainInstalled = false;
  };
}
