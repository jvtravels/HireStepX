import { describe, it, expect } from "vitest";
import { markRecovered, endpointFamily, percentile, successLatency } from "../../server-handlers/_llm-slo";

const row = (o: Partial<{ user_id: string | null; endpoint: string; status: string; latency_ms: number; created_at: string }>) => ({
  user_id: "u1", endpoint: "evaluate-session", status: "success", latency_ms: 1000, created_at: "2026-10-18T12:00:00Z", ...o,
});

describe("endpointFamily", () => {
  it("folds retry tiers into the base endpoint", () => {
    expect(endpointFamily("evaluate-session-retry")).toBe("evaluate-session");
    expect(endpointFamily("evaluate-session-fast")).toBe("evaluate-session");
    expect(endpointFamily("evaluate-session-core")).toBe("evaluate-session");
    expect(endpointFamily("evaluate-session-pq")).toBe("evaluate-session");
    expect(endpointFamily("generate-questions")).toBe("generate-questions");
  });
});

describe("markRecovered", () => {
  it("marks a timeout recovered when a later success follows within the window", () => {
    const out = markRecovered([row({ status: "timeout", created_at: "2026-10-18T12:00:00Z" }), row({ endpoint: "evaluate-session-retry", created_at: "2026-10-18T12:00:40Z" })]);
    expect(out[0].recovered).toBe(true);
  });
  it("leaves a failure unrecovered when nothing succeeds after it", () => {
    const out = markRecovered([row({ status: "error", created_at: "2026-10-18T12:00:00Z" })]);
    expect(out[0].recovered).toBe(false);
  });
  it("ignores a success that predates the failure", () => {
    const out = markRecovered([row({ status: "timeout", created_at: "2026-10-18T12:05:00Z" }), row({ created_at: "2026-10-18T12:00:00Z" })]);
    expect(out[0].recovered).toBe(false);
  });
  it("ignores a success outside the window or from another user", () => {
    const out = markRecovered([
      row({ status: "timeout", created_at: "2026-10-18T12:00:00Z" }),
      row({ created_at: "2026-10-18T12:10:00Z" }),
      row({ user_id: "u2", created_at: "2026-10-18T12:00:10Z" }),
    ]);
    expect(out[0].recovered).toBe(false);
  });
  it("never marks successes as recovered", () => {
    expect(markRecovered([row({})])[0].recovered).toBe(false);
  });
});

describe("latency percentiles", () => {
  it("computes nearest-rank percentiles", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 50)).toBe(5);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([], 95)).toBe(0);
  });
  it("uses only successful calls with latency", () => {
    const l = successLatency([row({ latency_ms: 10000 }), row({ latency_ms: 20000 }), row({ status: "timeout", latency_ms: 50000 }), row({ latency_ms: 0 })]);
    expect(l).toEqual({ p50: 10000, p95: 20000 });
  });
});
