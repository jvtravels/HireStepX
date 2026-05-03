import { describe, it, expect } from "vitest";
import { setProsodyEnabled } from "../tts";

/* The TTS pipeline is too coupled (audio context, fetch, WS) to unit-
   test end-to-end in jsdom. These tests cover the safety-of-call
   surface only: the public toggle must never throw, regardless of
   whether localStorage is available, blocked, or shimmed. */

describe("setProsodyEnabled", () => {
  it("doesn't throw when called with true", () => {
    expect(() => setProsodyEnabled(true)).not.toThrow();
  });
  it("doesn't throw when called with false", () => {
    expect(() => setProsodyEnabled(false)).not.toThrow();
  });
  it("is callable repeatedly without throwing", () => {
    expect(() => {
      for (let i = 0; i < 5; i++) {
        setProsodyEnabled(true);
        setProsodyEnabled(false);
      }
    }).not.toThrow();
  });
});
