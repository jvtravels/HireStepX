/* V2 canary ramp test (2026-06-09).
 *
 * Pure decision-layer tests. No env, no I/O — every call passes the
 * env explicitly so the test is deterministic. */

import { describe, it, expect } from "vitest";
import { shouldRouteV2, sessionBucket, describeDecision } from "../../../server-handlers/v2/ramp";

describe("v2 ramp — sessionBucket is deterministic", () => {
  it("same sessionId always hashes to the same bucket", () => {
    const a = sessionBucket("session-abc-123");
    const b = sessionBucket("session-abc-123");
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(100);
  });

  it("different sessionIds spread across buckets (sanity, not uniformity)", () => {
    const buckets = new Set<number>();
    for (let i = 0; i < 200; i++) buckets.add(sessionBucket(`s-${i}`));
    expect(buckets.size).toBeGreaterThan(50);
  });
});

describe("v2 ramp — kill switch dominates", () => {
  it("kill=1 forces v1 even at 100% ramp", () => {
    const d = shouldRouteV2("s-1", { kill: "1", rampPct: "100" });
    expect(d.routeV2).toBe(false);
    expect(d.reason).toBe("kill-switch");
  });

  it("kill=1 forces v1 even for allowlisted sessions", () => {
    const d = shouldRouteV2("internal-qa-jay", { kill: "1", allowlist: "internal-qa-" });
    expect(d.routeV2).toBe(false);
    expect(d.reason).toBe("kill-switch");
  });
});

describe("v2 ramp — allowlist overrides percent", () => {
  it("allowlisted session routed to v2 even at 0% ramp", () => {
    const d = shouldRouteV2("internal-qa-jay", {
      rampPct: "0",
      allowlist: "internal-qa-",
    });
    expect(d.routeV2).toBe(true);
    expect(d.reason).toBe("allowlist");
  });

  it("non-allowlisted at 0% ramp stays on v1", () => {
    const d = shouldRouteV2("real-user-xyz", {
      rampPct: "0",
      allowlist: "internal-qa-",
    });
    expect(d.routeV2).toBe(false);
    expect(d.reason).toBe("ramp-zero");
  });
});

describe("v2 ramp — percent cohort", () => {
  it("0% routes nothing", () => {
    const d = shouldRouteV2("any-session", { rampPct: "0" });
    expect(d.routeV2).toBe(false);
    expect(d.reason).toBe("ramp-zero");
  });

  it("100% routes everything", () => {
    for (let i = 0; i < 50; i++) {
      const d = shouldRouteV2(`s-${i}`, { rampPct: "100" });
      expect(d.routeV2).toBe(true);
      expect(d.reason).toBe("in-cohort");
    }
  });

  it("5% routes roughly 5% of sessions (within tolerance over 1000 ids)", () => {
    let in_ = 0;
    for (let i = 0; i < 1000; i++) {
      const d = shouldRouteV2(`s-${i}`, { rampPct: "5" });
      if (d.routeV2) in_++;
    }
    /* Loose tolerance — FNV-1a on short strings isn't perfectly uniform.
     * 5% target → expect 30-80 of 1000. */
    expect(in_).toBeGreaterThan(30);
    expect(in_).toBeLessThan(80);
  });

  it("decision is stable for a session — calling twice returns the same answer", () => {
    const a = shouldRouteV2("user-abc", { rampPct: "20" });
    const b = shouldRouteV2("user-abc", { rampPct: "20" });
    expect(a.routeV2).toBe(b.routeV2);
    expect(a.bucket).toBe(b.bucket);
  });
});

describe("v2 ramp — malformed env", () => {
  it("missing rampPct defaults to 0", () => {
    const d = shouldRouteV2("s-1", {});
    expect(d.routeV2).toBe(false);
    expect(d.rampPct).toBe(0);
  });

  it("non-numeric rampPct defaults to 0", () => {
    const d = shouldRouteV2("s-1", { rampPct: "fifty" });
    expect(d.rampPct).toBe(0);
  });

  it("rampPct > 100 clamps to 100", () => {
    const d = shouldRouteV2("s-1", { rampPct: "150" });
    expect(d.rampPct).toBe(100);
  });

  it("negative rampPct clamps to 0", () => {
    const d = shouldRouteV2("s-1", { rampPct: "-10" });
    expect(d.rampPct).toBe(0);
  });
});

describe("v2 ramp — describeDecision payload shape", () => {
  it("flattens to a telemetry-ready payload", () => {
    const d = shouldRouteV2("s-1", { rampPct: "100" });
    const payload = describeDecision(d);
    expect(payload).toMatchObject({
      v2_routed: true,
      v2_route_reason: "in-cohort",
      v2_ramp_pct: 100,
    });
    expect(typeof payload.v2_route_bucket).toBe("number");
  });
});
