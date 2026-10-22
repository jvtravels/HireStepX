import { describe, it, expect } from "vitest";
import {
  initialConnectionState, reduceConnection, isReachable, nextProbeDelay, classifyOutcome,
  DEFAULT_PROBE_TIMING, type ConnectionState, type ConnectionEvent,
} from "../_connection-state";

const run = (s: ConnectionState, ...evs: ConnectionEvent[]) => evs.reduce(reduceConnection, s);
const fail = (probe = false): ConnectionEvent => ({ type: "failure", now: 10, probe });
const ok: ConnectionEvent = { type: "success", now: 20 };

describe("reduceConnection", () => {
  it("starts online (or offline when the browser says so)", () => {
    expect(initialConnectionState(0).status).toBe("online");
    expect(initialConnectionState(0, false).status).toBe("offline");
  });

  it("a single failure does not flap the status", () => {
    const s = run(initialConnectionState(0), fail());
    expect(s.status).toBe("online");
    expect(isReachable(s)).toBe(false);
  });

  it("degrades after 2 failures and goes offline after 3", () => {
    const s0 = initialConnectionState(0);
    expect(run(s0, fail(), fail()).status).toBe("degraded");
    expect(run(s0, fail(), fail(), fail()).status).toBe("offline");
  });

  it("needs 2 consecutive successes to recover from offline", () => {
    const off = run(initialConnectionState(0), fail(), fail(), fail());
    const one = run(off, ok);
    expect(one.status).toBe("degraded");
    const two = run(one, ok);
    expect(two.status).toBe("online");
    expect(two.attempt).toBe(0);
    expect(two.nextProbeAt).toBeNull();
  });

  it("a failure between successes resets the recovery streak", () => {
    const off = run(initialConnectionState(0), fail(), fail(), fail());
    const s = run(off, ok, fail(), ok);
    expect(s.status).not.toBe("online");
  });

  it("browser-offline is a hard offline signal", () => {
    const s = run(initialConnectionState(0), { type: "browser-offline", now: 5 });
    expect(s.status).toBe("offline");
    expect(s.browserOnline).toBe(false);
  });

  it("browser-online alone does not recover; it only clears the failure streak", () => {
    const off = run(initialConnectionState(0), { type: "browser-offline", now: 5 });
    const s = run(off, { type: "browser-online", now: 6 });
    expect(s.status).toBe("offline");
    expect(s.consecutiveFailures).toBe(0);
  });

  it("counts only probe failures toward attempt while not online", () => {
    const off = run(initialConnectionState(0), fail(), fail(), fail());
    expect(run(off, fail(true), fail(true)).attempt).toBe(2);
    expect(run(initialConnectionState(0), fail(true)).attempt).toBe(0);
  });

  it("records lastOkAt and tracks scheduled probes", () => {
    const s = run(initialConnectionState(0), ok, { type: "probe-scheduled", at: 99 });
    expect(s.lastOkAt).toBe(20);
    expect(s.nextProbeAt).toBe(99);
  });
});

describe("nextProbeDelay", () => {
  const mid = () => 0.5; // zero jitter offset
  it("is the healthy interval when online", () => {
    expect(nextProbeDelay(initialConnectionState(0), mid)).toBe(DEFAULT_PROBE_TIMING.healthyMs);
  });
  it("climbs the backoff ladder and caps", () => {
    let s = run(initialConnectionState(0), fail(), fail(), fail());
    const delays: number[] = [];
    for (let i = 0; i < 6; i++) { delays.push(nextProbeDelay(s, mid)); s = run(s, fail(true)); }
    expect(delays[0]).toBeLessThanOrEqual(delays[3]);
    expect(delays[5]).toBe(DEFAULT_PROBE_TIMING.ladderMs[DEFAULT_PROBE_TIMING.ladderMs.length - 1]);
  });
  it("probes quickly while recovering", () => {
    const s = run(initialConnectionState(0), fail(), fail(), fail(), ok);
    expect(nextProbeDelay(s, mid)).toBe(DEFAULT_PROBE_TIMING.recoveringMs);
  });
  it("stays within the jitter band", () => {
    const s = initialConnectionState(0);
    const lo = nextProbeDelay(s, () => 0);
    const hi = nextProbeDelay(s, () => 1);
    expect(lo).toBe(24_000);
    expect(hi).toBe(36_000);
  });
});

describe("classifyOutcome", () => {
  it("ignores aborts and server errors, counts network failures and normal responses", () => {
    expect(classifyOutcome(0, true)).toBeNull();
    expect(classifyOutcome(0, false)).toBe("failure");
    expect(classifyOutcome(503, false)).toBeNull();
    expect(classifyOutcome(200, false)).toBe("success");
    expect(classifyOutcome(401, false)).toBe("success");
    expect(classifyOutcome(429, false)).toBe("success");
  });
});
