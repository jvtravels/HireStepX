/* Connection monitor — single source of truth for "can we reach the server?".
 *
 * Signals combined:
 *   - browser online/offline events (hard offline only; see _connection-state)
 *   - passive request outcomes reported by apiFetch
 *   - an active heartbeat to /api/ping while at least one lease is held (an
 *     interview, a held turn), plus recovery probes during an incident. A
 *     healthy idle tab never polls.
 *
 * Probing uses XHR, not fetch, for the same reason apiFetch does: extension
 * fetch-wrappers can hang and would make a healthy link look dead.
 */

import { useSyncExternalStore } from "react";
import {
  classifyOutcome,
  initialConnectionState,
  isReachable,
  nextProbeDelay,
  reduceConnection,
  type ConnectionEvent,
  type ConnectionState,
} from "./_connection-state";
import { captureClientEvent } from "./posthogClient";

const PING_PATH = "/api/ping";
const PROBE_TIMEOUT_MS = 5_000;

type Listener = (state: ConnectionState, prev: ConnectionState) => void;

const SERVER_STATE: ConnectionState = initialConnectionState(0, true);

let state: ConnectionState = SERVER_STATE;
let booted = false;
const listeners = new Set<Listener>();
let leases = 0;
let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probeInFlight: Promise<boolean> | null = null;

function dispatch(e: ConnectionEvent): void {
  const prev = state;
  const next = reduceConnection(prev, e);
  if (next === prev) return;
  state = next;
  if (next.status !== prev.status) {
    captureClientEvent("connection_status_changed", {
      from: prev.status,
      to: next.status,
      outage_ms: next.status === "online" ? Date.now() - prev.since : undefined,
    });
  }
  for (const l of [...listeners]) {
    try { l(next, prev); } catch { /* a bad listener must not break the monitor */ }
  }
}

function probeOnce(): Promise<boolean> {
  if (probeInFlight) return probeInFlight;
  probeInFlight = new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      probeInFlight = null;
      dispatch(ok ? { type: "success", now: Date.now() } : { type: "failure", now: Date.now(), probe: true });
      resolve(ok);
    };
    try {
      const xhr = new XMLHttpRequest();
      xhr.open("GET", `${PING_PATH}?t=${Date.now()}`, true);
      xhr.timeout = PROBE_TIMEOUT_MS;
      xhr.onload = () => finish(xhr.status > 0 && xhr.status < 500);
      xhr.onerror = () => finish(false);
      xhr.ontimeout = () => finish(false);
      xhr.onabort = () => finish(false);
      xhr.send();
    } catch {
      finish(false);
    }
  });
  return probeInFlight;
}

function scheduleProbe(): void {
  if (probeTimer) { clearTimeout(probeTimer); probeTimer = null; }
  // Heartbeat while a lease is held; otherwise only probe to recover from an
  // incident, so an idle healthy tab never polls.
  if (leases <= 0 && isReachable(state)) { dispatch({ type: "probe-scheduled", at: null }); return; }
  const delay = nextProbeDelay(state);
  dispatch({ type: "probe-scheduled", at: Date.now() + delay });
  probeTimer = setTimeout(() => {
    probeTimer = null;
    void probeOnce().then(scheduleProbe);
  }, delay);
}

function onBrowserOffline(): void {
  dispatch({ type: "browser-offline", now: Date.now() });
  scheduleProbe();
}

function onBrowserOnline(): void {
  dispatch({ type: "browser-online", now: Date.now() });
  // The OS says a link exists; verify it right away instead of waiting out a
  // backoff step. This is the lie-fi check.
  void probeOnce().then(scheduleProbe);
}

function boot(): void {
  if (booted || typeof window === "undefined") return;
  booted = true;
  state = initialConnectionState(Date.now(), navigator.onLine !== false);
  window.addEventListener("offline", onBrowserOffline);
  window.addEventListener("online", onBrowserOnline);
}

export function getConnectionState(): ConnectionState {
  boot();
  return state;
}

export function subscribeConnection(l: Listener): () => void {
  boot();
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** Hold while the app has something worth probing for (live interview, held turn). */
export function acquireHeartbeat(): () => void {
  boot();
  leases += 1;
  if (leases === 1) scheduleProbe();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    leases = Math.max(0, leases - 1);
    if (leases === 0) scheduleProbe();
  };
}

/** Called by apiFetch after every request so real traffic informs status for free. */
export function reportRequestOutcome(status: number, errorKind: string | null): void {
  if (typeof window === "undefined") return;
  boot();
  const outcome = classifyOutcome(status, errorKind === "aborted");
  if (!outcome) return;
  if (outcome === "success") dispatch({ type: "success", now: Date.now() });
  else dispatch({ type: "failure", now: Date.now(), probe: false });
  if (outcome === "failure" && !probeTimer) scheduleProbe();
}

/** Skip the backoff wait and probe now ("Retry now" button). */
export async function retryNow(): Promise<boolean> {
  boot();
  const ok = await probeOnce();
  scheduleProbe();
  return ok;
}

/**
 * Resolves true as soon as a round-trip succeeds (see isReachable),
 * false if `timeoutMs` elapses or the signal aborts first. Holds a heartbeat
 * lease for the duration so the wait itself drives recovery detection.
 */
export function waitForReachable(opts: { timeoutMs?: number; signal?: AbortSignal } = {}): Promise<boolean> {
  boot();
  if (isReachable(getConnectionState())) return Promise.resolve(true);
  if (opts.signal?.aborted) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const release = acquireHeartbeat();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const finish = (v: boolean) => {
      unsub();
      release();
      if (timer) clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
      resolve(v);
    };
    const onAbort = () => finish(false);
    const unsub = subscribeConnection((s) => { if (isReachable(s)) finish(true); });
    if (opts.timeoutMs !== undefined) timer = setTimeout(() => finish(false), opts.timeoutMs);
    opts.signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function useConnectionState(): ConnectionState {
  return useSyncExternalStore(
    (cb) => subscribeConnection(() => cb()),
    getConnectionState,
    () => SERVER_STATE,
  );
}

/** Test seam: reset module state between tests. */
export function __resetConnectionMonitorForTests(): void {
  if (typeof window !== "undefined" && booted) {
    window.removeEventListener("offline", onBrowserOffline);
    window.removeEventListener("online", onBrowserOnline);
  }
  if (probeTimer) clearTimeout(probeTimer);
  probeTimer = null;
  probeInFlight = null;
  leases = 0;
  listeners.clear();
  booted = false;
  state = SERVER_STATE;
}
