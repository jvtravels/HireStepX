import { describe, it, expect, vi } from "vitest";
import { runWithHold, createOnlineBudget } from "../_turn-retry";

function deps(over: Partial<Parameters<typeof runWithHold<string>>[0]> = {}) {
  let t = 0;
  return {
    attempt: vi.fn(async () => null as string | null),
    probe: vi.fn(async () => true),
    waitReachable: vi.fn(async () => true),
    sleep: vi.fn(async (ms: number) => { t += ms; }),
    now: () => t,
    ...over,
  };
}

describe("runWithHold", () => {
  it("returns immediately on success", async () => {
    const d = deps({ attempt: vi.fn(async () => "ok") });
    const r = await runWithHold(d);
    expect(r).toEqual({ value: "ok", attempts: 1, heldMs: 0 });
    expect(d.probe).not.toHaveBeenCalled();
  });

  it("holds without counting a failure while unreachable, then resumes and succeeds", async () => {
    const attempt = vi.fn<() => Promise<string | null>>().mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce("ok");
    const holds: boolean[] = [];
    const events: string[] = [];
    const d = deps({
      attempt,
      probe: vi.fn(async () => false),
      onHoldChange: (h) => holds.push(h),
      onEvent: (e) => events.push(e),
    });
    const r = await runWithHold(d);
    expect(r.value).toBe("ok");
    expect(r.attempts).toBe(3);
    expect(holds).toEqual([true, false, true, false]);
    expect(events.filter((e) => e === "held")).toHaveLength(2);
    expect(events).toContain("resumed");
  });

  it("gives up after maxServerFailures when the server is reachable", async () => {
    const events: Array<[string, Record<string, unknown>]> = [];
    const d = deps({ onEvent: (e, detail) => events.push([e, detail]) });
    const r = await runWithHold(d);
    expect(r.value).toBeNull();
    expect(r.attempts).toBe(2);
    expect(d.sleep).toHaveBeenCalledTimes(1);
    expect(events.at(-1)).toEqual(["gave_up", expect.objectContaining({ reason: "server_failures" })]);
  });

  it("gives up when the hold ceiling elapses", async () => {
    const d = deps({ probe: vi.fn(async () => false), waitReachable: vi.fn(async () => false), maxHoldMs: 1000 });
    const r = await runWithHold(d);
    expect(r.value).toBeNull();
    expect(d.waitReachable).toHaveBeenCalledWith({ timeoutMs: 1000 });
  });

  it("stops when cancelled", async () => {
    const d = deps({ isCancelled: () => true });
    const r = await runWithHold(d);
    expect(r.value).toBeNull();
    expect(d.probe).not.toHaveBeenCalled();
  });
});

describe("createOnlineBudget", () => {
  it("only counts down while reachable", async () => {
    vi.useFakeTimers();
    let reachable = false;
    const b = createOnlineBudget({ budgetMs: 1000, ceilingMs: 60_000, isReachable: () => reachable, tickMs: 100, now: () => Date.now() });
    let settled = false;
    void b.promise.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(5000);
    expect(settled).toBe(false);
    reachable = true;
    await vi.advanceTimersByTimeAsync(1200);
    expect(settled).toBe(true);
    vi.useRealTimers();
  });

  it("settles at the wall-clock ceiling even if never reachable", async () => {
    vi.useFakeTimers();
    const b = createOnlineBudget({ budgetMs: 1000, ceilingMs: 3000, isReachable: () => false, tickMs: 100, now: () => Date.now() });
    let settled = false;
    void b.promise.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(3200);
    expect(settled).toBe(true);
    vi.useRealTimers();
  });

  it("cancel stops the timer", async () => {
    vi.useFakeTimers();
    const b = createOnlineBudget({ budgetMs: 500, ceilingMs: 5000, isReachable: () => true, tickMs: 100, now: () => Date.now() });
    let settled = false;
    void b.promise.then(() => { settled = true; });
    b.cancel();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(settled).toBe(false);
    vi.useRealTimers();
  });
});
