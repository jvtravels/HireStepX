/* Pure connection state machine.
 *
 * `navigator.onLine` only says whether a network interface exists; on
 * captive portals, saturated 4G and "lie-fi" it stays true while nothing
 * reaches our servers. So we derive status from real request outcomes
 * (passive reports + an active heartbeat) and use `navigator.onLine` only as
 * a hard "offline" signal, which is the one thing it reports truthfully.
 *
 * Hysteresis: several consecutive failures to degrade/go offline, several
 * consecutive successes to recover, so a single dropped packet never flaps
 * the UI or trips the interview's hold-and-retry path.
 */

export type ConnectionStatus = "online" | "degraded" | "offline";

export interface ConnectionState {
  status: ConnectionStatus;
  browserOnline: boolean;
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  /** Epoch ms of the last observed server round-trip, or null if none yet. */
  lastOkAt: number | null;
  /** Epoch ms the current status began. */
  since: number;
  /** Failed probes since we left "online"; 0 while online. Real, not cosmetic. */
  attempt: number;
  /** Epoch ms of the next scheduled probe, or null when none is pending. */
  nextProbeAt: number | null;
}

export type ConnectionEvent =
  | { type: "browser-online"; now: number }
  | { type: "browser-offline"; now: number }
  | { type: "success"; now: number }
  | { type: "failure"; now: number; probe: boolean }
  | { type: "probe-scheduled"; at: number | null };

export const DEGRADE_AFTER_FAILURES = 2;
export const OFFLINE_AFTER_FAILURES = 3;
export const RECOVER_AFTER_SUCCESSES = 2;

export function initialConnectionState(now: number, browserOnline = true): ConnectionState {
  return {
    status: browserOnline ? "online" : "offline",
    browserOnline,
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    lastOkAt: null,
    since: now,
    attempt: 0,
    nextProbeAt: null,
  };
}

function withStatus(s: ConnectionState, status: ConnectionStatus, now: number): ConnectionState {
  return status === s.status ? s : { ...s, status, since: now };
}

export function reduceConnection(s: ConnectionState, e: ConnectionEvent): ConnectionState {
  switch (e.type) {
    case "browser-offline":
      // The browser is authoritative when it says there is no network.
      return withStatus(
        { ...s, browserOnline: false, consecutiveSuccesses: 0, consecutiveFailures: Math.max(s.consecutiveFailures, OFFLINE_AFTER_FAILURES) },
        "offline",
        e.now,
      );
    case "browser-online":
      // It only says an interface exists. Stay offline until a request lands,
      // but clear the failure streak so the next probe starts a fresh climb.
      return { ...s, browserOnline: true, consecutiveFailures: 0, consecutiveSuccesses: 0 };
    case "success": {
      const successes = s.consecutiveSuccesses + 1;
      const base: ConnectionState = {
        ...s,
        browserOnline: true,
        consecutiveFailures: 0,
        consecutiveSuccesses: successes,
        lastOkAt: e.now,
      };
      if (s.status === "online") return { ...base, attempt: 0 };
      if (successes >= RECOVER_AFTER_SUCCESSES) return withStatus({ ...base, attempt: 0, nextProbeAt: null }, "online", e.now);
      return withStatus(base, "degraded", e.now);
    }
    case "failure": {
      const failures = s.consecutiveFailures + 1;
      const next: ConnectionState = {
        ...s,
        consecutiveFailures: failures,
        consecutiveSuccesses: 0,
        attempt: e.probe && s.status !== "online" ? s.attempt + 1 : s.attempt,
      };
      if (failures >= OFFLINE_AFTER_FAILURES) return withStatus(next, "offline", e.now);
      if (failures >= DEGRADE_AFTER_FAILURES) return withStatus(next, s.status === "offline" ? "offline" : "degraded", e.now);
      return next;
    }
    case "probe-scheduled":
      return s.nextProbeAt === e.at ? s : { ...s, nextProbeAt: e.at };
  }
}

/** True when the last round-trip succeeded and the link isn't flagged offline. */
export function isReachable(s: ConnectionState): boolean {
  return s.status !== "offline" && s.consecutiveFailures === 0;
}

export interface ProbeTiming {
  /** Heartbeat interval while healthy. */
  healthyMs: number;
  /** Backoff ladder while degraded/offline. */
  ladderMs: readonly number[];
  /** Quick re-probe while recovering (one success banked, need another). */
  recoveringMs: number;
  jitter: number;
}

export const DEFAULT_PROBE_TIMING: ProbeTiming = {
  healthyMs: 30_000,
  ladderMs: [2_000, 4_000, 8_000, 15_000],
  recoveringMs: 1_000,
  jitter: 0.2,
};

/** Delay until the next heartbeat. `rand` is injectable so tests are exact. */
export function nextProbeDelay(
  s: ConnectionState,
  rand: () => number = Math.random,
  timing: ProbeTiming = DEFAULT_PROBE_TIMING,
): number {
  let base: number;
  if (s.status === "online" && s.consecutiveFailures === 0) base = timing.healthyMs;
  else if (s.consecutiveSuccesses > 0) base = timing.recoveringMs;
  else {
    const step = Math.max(s.attempt, s.consecutiveFailures - 1, 0);
    base = timing.ladderMs[Math.min(step, timing.ladderMs.length - 1)];
  }
  const spread = base * timing.jitter;
  return Math.max(250, Math.round(base - spread + rand() * spread * 2));
}

/** Passive classification of an app-API response. Returns null for "no signal". */
export function classifyOutcome(status: number, aborted: boolean): "success" | "failure" | null {
  if (aborted) return null;
  if (status === 0) return "failure";
  if (status >= 500) return null; // our server broke, not the user's link
  return "success";
}
