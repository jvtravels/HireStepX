import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../posthogClient", () => ({ captureClientEvent: vi.fn() }));

const mon = await import("../connectionMonitor");

let nextStatus: number | "error" = 204;
class FakeXHR {
  static calls = 0;
  timeout = 0;
  status = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeout: (() => void) | null = null;
  onabort: (() => void) | null = null;
  open() {}
  send() {
    FakeXHR.calls++;
    queueMicrotask(() => {
      if (nextStatus === "error") this.onerror?.();
      else { this.status = nextStatus; this.onload?.(); }
    });
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  FakeXHR.calls = 0;
  nextStatus = 204;
  vi.stubGlobal("XMLHttpRequest", FakeXHR);
  mon.__resetConnectionMonitorForTests();
});
afterEach(() => {
  mon.__resetConnectionMonitorForTests();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("connectionMonitor", () => {
  it("does not poll while idle and healthy", async () => {
    mon.getConnectionState();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeXHR.calls).toBe(0);
  });

  it("heartbeats only while a lease is held", async () => {
    const release = mon.acquireHeartbeat();
    await vi.advanceTimersByTimeAsync(40_000);
    expect(FakeXHR.calls).toBeGreaterThan(0);
    release();
    const before = FakeXHR.calls;
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeXHR.calls).toBe(before);
  });

  it("detects lie-fi: browser says online but probes fail, then recovers", async () => {
    const release = mon.acquireHeartbeat();
    nextStatus = "error";
    for (let i = 0; i < 6; i++) await vi.advanceTimersByTimeAsync(40_000);
    expect(mon.getConnectionState().status).toBe("offline");
    expect(navigator.onLine).toBe(true);
    nextStatus = 204;
    await mon.retryNow();
    await mon.retryNow();
    expect(mon.getConnectionState().status).toBe("online");
    release();
  });

  it("passive failures reported by apiFetch drive state, server 5xx do not", () => {
    mon.getConnectionState();
    mon.reportRequestOutcome(503, null);
    mon.reportRequestOutcome(503, null);
    mon.reportRequestOutcome(503, null);
    expect(mon.getConnectionState().status).toBe("online");
    mon.reportRequestOutcome(0, "Network error");
    mon.reportRequestOutcome(0, "Network error");
    expect(mon.getConnectionState().status).toBe("degraded");
  });

  it("browser offline event flips to offline immediately", () => {
    mon.getConnectionState();
    window.dispatchEvent(new Event("offline"));
    expect(mon.getConnectionState().status).toBe("offline");
  });

  it("waitForReachable resolves true once connectivity returns, false on timeout", async () => {
    mon.getConnectionState();
    window.dispatchEvent(new Event("offline"));
    const timedOut = mon.waitForReachable({ timeoutMs: 500 });
    await vi.advanceTimersByTimeAsync(600);
    expect(await timedOut).toBe(false);

    const p = mon.waitForReachable({ timeoutMs: 120_000 });
    nextStatus = 204;
    for (let i = 0; i < 8; i++) await vi.advanceTimersByTimeAsync(5_000);
    expect(await p).toBe(true);
  });

  it("waitForReachable resolves true immediately when reachable", async () => {
    mon.getConnectionState();
    expect(await mon.waitForReachable({ timeoutMs: 10 })).toBe(true);
  });
});
