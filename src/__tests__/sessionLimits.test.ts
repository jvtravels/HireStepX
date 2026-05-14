import { describe, it, expect, vi } from "vitest";
import {
  MAX_INPUT_CHARS,
  MAX_TURNS_PER_SESSION,
  MAX_TURNS_PER_USER_PER_DAY,
  MAX_OUTPUT_TOKENS,
  clampInput,
  checkSessionTurnLimit,
  checkUserDailyLimit,
  logTurnUsage,
} from "../../server-handlers/_session-limits";

describe("_session-limits — constants", () => {
  it("exposes the expected cap values", () => {
    expect(MAX_INPUT_CHARS).toBe(8000);
    expect(MAX_TURNS_PER_SESSION).toBe(60);
    expect(MAX_TURNS_PER_USER_PER_DAY).toBe(200);
    expect(MAX_OUTPUT_TOKENS).toBe(800);
  });
});

describe("_session-limits — clampInput", () => {
  it("passes through short text untouched", () => {
    const r = clampInput("hello world");
    expect(r.text).toBe("hello world");
    expect(r.truncated).toBe(false);
  });

  it("returns empty result on empty/null input", () => {
    expect(clampInput("")).toEqual({ text: "", truncated: false });
    expect(clampInput(undefined as unknown as string)).toEqual({ text: "", truncated: false });
    expect(clampInput(null as unknown as string)).toEqual({ text: "", truncated: false });
  });

  it("truncates input above MAX_INPUT_CHARS", () => {
    const big = "x".repeat(MAX_INPUT_CHARS + 100);
    const r = clampInput(big);
    expect(r.text.length).toBe(MAX_INPUT_CHARS);
    expect(r.truncated).toBe(true);
  });

  it("does NOT truncate at exactly MAX_INPUT_CHARS", () => {
    const exact = "y".repeat(MAX_INPUT_CHARS);
    const r = clampInput(exact);
    expect(r.text.length).toBe(MAX_INPUT_CHARS);
    expect(r.truncated).toBe(false);
  });
});

describe("_session-limits — checkSessionTurnLimit", () => {
  it("allows turns below the cap", () => {
    expect(checkSessionTurnLimit(0).allowed).toBe(true);
    expect(checkSessionTurnLimit(1).allowed).toBe(true);
    expect(checkSessionTurnLimit(MAX_TURNS_PER_SESSION - 1).allowed).toBe(true);
  });

  it("blocks at and above the cap", () => {
    const at = checkSessionTurnLimit(MAX_TURNS_PER_SESSION);
    expect(at.allowed).toBe(false);
    expect(at.reason).toBe("session-turn-cap");
    expect(checkSessionTurnLimit(MAX_TURNS_PER_SESSION + 5).allowed).toBe(false);
  });

  it("rejects negative / NaN / non-finite turn counts", () => {
    expect(checkSessionTurnLimit(-1).allowed).toBe(false);
    expect(checkSessionTurnLimit(Number.NaN).allowed).toBe(false);
    expect(checkSessionTurnLimit(Number.POSITIVE_INFINITY).allowed).toBe(false);
  });
});

describe("_session-limits — checkUserDailyLimit", () => {
  it("allows counts below the cap", () => {
    expect(checkUserDailyLimit(0).allowed).toBe(true);
    expect(checkUserDailyLimit(MAX_TURNS_PER_USER_PER_DAY - 1).allowed).toBe(true);
  });

  it("blocks at and above the cap", () => {
    const at = checkUserDailyLimit(MAX_TURNS_PER_USER_PER_DAY);
    expect(at.allowed).toBe(false);
    expect(at.reason).toBe("user-daily-cap");
    expect(checkUserDailyLimit(MAX_TURNS_PER_USER_PER_DAY + 100).allowed).toBe(false);
  });

  it("rejects negative / NaN inputs", () => {
    expect(checkUserDailyLimit(-1).allowed).toBe(false);
    expect(checkUserDailyLimit(Number.NaN).allowed).toBe(false);
  });
});

describe("_session-limits — logTurnUsage", () => {
  it("emits a single JSON stdout line and never throws", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(() =>
      logTurnUsage({
        sessionId: "sess_abc",
        userId: "user_1",
        inputChars: 120,
        outputTokens: 80,
        latencyMs: 250,
      }),
    ).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
    const arg = spy.mock.calls[0][0];
    expect(typeof arg).toBe("string");
    const parsed = JSON.parse(arg as string);
    expect(parsed.kind).toBe("kernel_turn_usage");
    expect(parsed.sessionId).toBe("sess_abc");
    expect(parsed.userId).toBe("user_1");
    expect(parsed.inputChars).toBe(120);
    expect(parsed.outputTokens).toBe(80);
    expect(parsed.latencyMs).toBe(250);
    spy.mockRestore();
  });

  it("tolerates missing optional fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logTurnUsage({ sessionId: "sess_x", inputChars: 0 });
    const parsed = JSON.parse(spy.mock.calls[0][0] as string);
    expect(parsed.userId).toBeNull();
    expect(parsed.outputTokens).toBeNull();
    expect(parsed.latencyMs).toBeNull();
    spy.mockRestore();
  });

  it("swallows logger errors", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => { throw new Error("boom"); });
    expect(() => logTurnUsage({ sessionId: "s", inputChars: 1 })).not.toThrow();
    spy.mockRestore();
  });
});
