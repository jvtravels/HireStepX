import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getAudioContextCtor,
  getSpeechRecognitionCtor,
  getNetworkInfo,
  isSlowConnection,
  yieldToMainThread,
} from "../_browser-api-guards";

/* These guards replaced ~8 `as unknown as` casts across SessionSetup,
 * speechRecognition, AuthContext, and resumeParser. The contract: each
 * helper either returns a usable value or null; never throws on missing
 * APIs (Safari, headless Node, etc.). */

describe("getAudioContextCtor", () => {
  const orig = window.AudioContext;
  afterEach(() => {
    Object.defineProperty(window, "AudioContext", { value: orig, configurable: true, writable: true });
    delete (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext;
  });

  it("returns the standard constructor when present", () => {
    const fakeCtor = function FakeAC() { /* no-op */ } as unknown as typeof AudioContext;
    Object.defineProperty(window, "AudioContext", { value: fakeCtor, configurable: true, writable: true });
    expect(getAudioContextCtor()).toBe(fakeCtor);
  });

  it("falls back to webkitAudioContext when standard is absent", () => {
    Object.defineProperty(window, "AudioContext", { value: undefined, configurable: true, writable: true });
    const fakeWebkit = function FakeWebkit() { /* no-op */ } as unknown as typeof AudioContext;
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext = fakeWebkit;
    expect(getAudioContextCtor()).toBe(fakeWebkit);
  });

  it("returns null when neither is present", () => {
    Object.defineProperty(window, "AudioContext", { value: undefined, configurable: true, writable: true });
    delete (window as Window & { webkitAudioContext?: unknown }).webkitAudioContext;
    expect(getAudioContextCtor()).toBeNull();
  });
});

describe("getSpeechRecognitionCtor", () => {
  type SRWindow = Window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  afterEach(() => {
    delete (window as SRWindow).SpeechRecognition;
    delete (window as SRWindow).webkitSpeechRecognition;
  });

  it("prefers SpeechRecognition over webkit prefix", () => {
    const std = function StdSR() { /* no-op */ };
    const webkit = function WebkitSR() { /* no-op */ };
    (window as SRWindow).SpeechRecognition = std;
    (window as SRWindow).webkitSpeechRecognition = webkit;
    expect(getSpeechRecognitionCtor()).toBe(std);
  });

  it("uses webkitSpeechRecognition when standard absent", () => {
    const webkit = function WebkitSR() { /* no-op */ };
    (window as SRWindow).webkitSpeechRecognition = webkit;
    expect(getSpeechRecognitionCtor()).toBe(webkit);
  });

  it("returns null when neither is present", () => {
    expect(getSpeechRecognitionCtor()).toBeNull();
  });
});

describe("getNetworkInfo / isSlowConnection", () => {
  type NavWithConn = Navigator & { connection?: { effectiveType?: string } };
  beforeEach(() => {
    delete (navigator as NavWithConn).connection;
  });
  afterEach(() => {
    delete (navigator as NavWithConn).connection;
  });

  it("returns null when navigator.connection is missing", () => {
    expect(getNetworkInfo()).toBeNull();
    expect(isSlowConnection()).toBe(false);
  });

  it("flags 2g as slow", () => {
    (navigator as NavWithConn).connection = { effectiveType: "2g" };
    expect(isSlowConnection()).toBe(true);
  });

  it("flags slow-2g as slow", () => {
    (navigator as NavWithConn).connection = { effectiveType: "slow-2g" };
    expect(isSlowConnection()).toBe(true);
  });

  it("does NOT flag 4g as slow", () => {
    (navigator as NavWithConn).connection = { effectiveType: "4g" };
    expect(isSlowConnection()).toBe(false);
  });
});

describe("yieldToMainThread", () => {
  it("resolves on the standard scheduler.yield path", async () => {
    type GThis = typeof globalThis & { scheduler?: { yield?: () => Promise<void> } };
    const g = globalThis as GThis;
    const orig = g.scheduler;
    let yieldCalled = false;
    g.scheduler = { yield: () => { yieldCalled = true; return Promise.resolve(); } };
    try {
      await yieldToMainThread();
      expect(yieldCalled).toBe(true);
    } finally {
      if (orig === undefined) delete g.scheduler;
      else g.scheduler = orig;
    }
  });

  it("falls back to setTimeout 0 when scheduler.yield is missing", async () => {
    type GThis = typeof globalThis & { scheduler?: { yield?: () => Promise<void> } };
    const g = globalThis as GThis;
    const orig = g.scheduler;
    delete g.scheduler;
    try {
      const start = Date.now();
      await yieldToMainThread();
      // Just verify it resolves without throwing; timing varies.
      expect(Date.now() - start).toBeGreaterThanOrEqual(0);
    } finally {
      if (orig !== undefined) g.scheduler = orig;
    }
  });
});
