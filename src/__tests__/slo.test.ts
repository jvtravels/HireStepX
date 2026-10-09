import { describe, it, expect, vi } from "vitest";
import { burnRate, evaluateBurn, recordSlo, type BucketCounts, type SloDeps } from "../../server-handlers/_slo";

const empty = (n: number): BucketCounts[] => Array.from({ length: n }, () => ({ good: 0, bad: 0 }));

describe("burnRate", () => {
  it("is error rate divided by error budget", () => {
    expect(burnRate({ good: 90, bad: 10 }, 0.9)).toBeCloseTo(1);
    expect(burnRate({ good: 0, bad: 10 }, 0.995)).toBeCloseTo(200);
    expect(burnRate({ good: 0, bad: 0 }, 0.99)).toBe(0);
  });
});

describe("evaluateBurn", () => {
  it("pages (critical) when both 1h and 5m windows burn fast", () => {
    const b = empty(72);
    b[0] = { good: 5, bad: 5 };
    b[3] = { good: 5, bad: 10 };
    expect(evaluateBurn("llm_availability", b)?.severity).toBe("critical");
  });

  it("does not page once the short window has recovered", () => {
    const b = empty(72);
    b[0] = { good: 50, bad: 0 };
    b[8] = { good: 0, bad: 20 }; // outside the 30m window, inside 1h
    expect(evaluateBurn("llm_availability", b)).toBeNull();
  });

  it("ignores low-volume windows (minEvents)", () => {
    const b = empty(72);
    b[0] = { good: 0, bad: 3 };
    expect(evaluateBurn("llm_availability", b)).toBeNull();
  });

  it("raises a warning for a slow sustained burn outside the 1h window", () => {
    const b = empty(72);
    // llm_primary objective 0.9 → budget 10%; 70% fallback = 7× burn (≥6, <14.4)
    for (let i = 0; i < 6; i++) b[i] = { good: 3, bad: 7 };
    expect(evaluateBurn("llm_primary", b)?.severity).toBe("warning");
  });
});

describe("recordSlo", () => {
  const mkDeps = (mget: Array<string | null>, setResult = "OK") => {
    const redis = vi.fn(async (cmds: Array<Array<string | number>>) => {
      const op = cmds[0][0];
      if (op === "INCR") return [{ result: 1 }, { result: 1 }];
      if (op === "MGET") return [{ result: mget }];
      if (op === "SET") return [{ result: setResult }];
      return null;
    });
    const alert = vi.fn<SloDeps["alert"]>(async () => {});
    const deps: SloDeps = { redis, alert, now: () => 1_000_000_000 };
    return { deps, redis, alert };
  };
  const burning = (): Array<string | null> => {
    const v: Array<string | null> = new Array(144).fill(null);
    v[0] = "2"; v[1] = "30"; // current bucket: 2 good, 30 bad
    return v;
  };

  it("good events only INCR (no window read)", async () => {
    const { deps, redis, alert } = mkDeps([]);
    await recordSlo("payment_verification", true, deps);
    expect(redis).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();
  });

  it("alerts once when the budget is burning", async () => {
    const { deps, alert } = mkDeps(burning());
    await recordSlo("llm_availability", false, deps);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toContain("[CRITICAL] SLO burn: llm_availability");
  });

  it("dedupes when the alert key already exists", async () => {
    const { deps, alert } = mkDeps(burning(), null as unknown as string);
    await recordSlo("llm_availability", false, deps);
    expect(alert).not.toHaveBeenCalled();
  });

  it("fails open when Redis is unavailable or throws", async () => {
    const alert = vi.fn<SloDeps["alert"]>(async () => {});
    await expect(recordSlo("llm_availability", false, { redis: async () => null, alert, now: Date.now })).resolves.toBeUndefined();
    await expect(recordSlo("llm_availability", false, { redis: async () => { throw new Error("down"); }, alert, now: Date.now })).resolves.toBeUndefined();
    expect(alert).not.toHaveBeenCalled();
  });
});
