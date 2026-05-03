import { describe, it, expect } from "vitest";
import { setBackchannelsEnabled } from "../_backchannels";

/* The hook itself needs React + audio/timer mocks to test in
   isolation — too much surface for this slice. These tests cover the
   safety-of-call surface only: the public toggle must never throw,
   regardless of whether localStorage is available, blocked (Safari
   private mode), or shimmed by the test environment. */

describe("setBackchannelsEnabled", () => {
  it("doesn't throw when called with true", () => {
    expect(() => setBackchannelsEnabled(true)).not.toThrow();
  });
  it("doesn't throw when called with false", () => {
    expect(() => setBackchannelsEnabled(false)).not.toThrow();
  });
  it("is callable repeatedly without throwing", () => {
    expect(() => {
      for (let i = 0; i < 5; i++) {
        setBackchannelsEnabled(true);
        setBackchannelsEnabled(false);
      }
    }).not.toThrow();
  });
});
