import { describe, it, expect, vi } from "vitest";
import { EVAL_STAGES, EVAL_STEP_LABELS, evalStageMessage, evalStageStep, mergeEvalStage, parseEvalStage } from "../_eval-progress";
import { clearEvalStage, evalStageKey, getEvalStage, parseProgressSessionId, setEvalStage } from "../../server-handlers/_eval-progress";

describe("parseEvalStage", () => {
  it("accepts known stages only", () => {
    for (const s of EVAL_STAGES) expect(parseEvalStage(s)).toBe(s);
    expect(parseEvalStage("scoring")).toBeNull();
    expect(parseEvalStage(null)).toBeNull();
    expect(parseEvalStage(42)).toBeNull();
  });
});

describe("mergeEvalStage", () => {
  it("moves forward and ignores a stale earlier stage", () => {
    expect(mergeEvalStage(null, "preparing")).toBe("preparing");
    expect(mergeEvalStage("preparing", "generating")).toBe("generating");
    expect(mergeEvalStage("finalising", "generating")).toBe("finalising");
  });
  it("keeps the previous stage when the poll returned nothing", () => {
    expect(mergeEvalStage("generating", null)).toBe("generating");
    expect(mergeEvalStage(null, null)).toBeNull();
  });
});

describe("stage presentation", () => {
  it("maps stages onto the three visible steps, keeping a retry on the scoring step", () => {
    expect(evalStageStep("preparing")).toBe(0);
    expect(evalStageStep("generating")).toBe(1);
    expect(evalStageStep("retrying")).toBe(1);
    expect(evalStageStep("finalising")).toBe(2);
    expect(EVAL_STEP_LABELS).toHaveLength(3);
  });
  it("has copy for every stage", () => {
    for (const s of EVAL_STAGES) expect(evalStageMessage(s).length).toBeGreaterThan(5);
  });
});

describe("server stage store", () => {
  it("scopes the key to the user and expires it", async () => {
    const redis = vi.fn().mockResolvedValue([{ result: "OK" }]);
    await setEvalStage("u1", "sess-0001", "generating", { redis });
    expect(redis).toHaveBeenCalledWith([["SET", "eval-stage:u1:sess-0001", "generating", "EX", 120]]);
    expect(evalStageKey("u2", "sess-0001")).not.toBe(evalStageKey("u1", "sess-0001"));
  });
  it("reads a valid stage and rejects garbage or an unavailable store", async () => {
    expect(await getEvalStage("u1", "s", { redis: vi.fn().mockResolvedValue([{ result: "finalising" }]) })).toBe("finalising");
    expect(await getEvalStage("u1", "s", { redis: vi.fn().mockResolvedValue([{ result: "bogus" }]) })).toBeNull();
    expect(await getEvalStage("u1", "s", { redis: vi.fn().mockResolvedValue([{ result: null }]) })).toBeNull();
    expect(await getEvalStage("u1", "s", { redis: vi.fn().mockResolvedValue(null) })).toBeNull();
  });
  it("clears the key", async () => {
    const redis = vi.fn().mockResolvedValue([{ result: 1 }]);
    await clearEvalStage("u1", "sess-0001", { redis });
    expect(redis).toHaveBeenCalledWith([["DEL", "eval-stage:u1:sess-0001"]]);
  });
});

describe("parseProgressSessionId", () => {
  it("accepts uuids and rejects key-injection shapes", () => {
    expect(parseProgressSessionId("3f2b8a1e-9c4d-4e6a-8b1f-2d7c5a9e0f13")).not.toBeNull();
    expect(parseProgressSessionId("a:b")).toBeNull();
    expect(parseProgressSessionId("short")).toBeNull();
    expect(parseProgressSessionId("x".repeat(65))).toBeNull();
    expect(parseProgressSessionId(undefined)).toBeNull();
  });
});
