import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const play = vi.fn(() => Promise.resolve());
class FakeAudio {
  volume = 1;
  currentTime = 0;
  src: string;
  constructor(src: string) { this.src = src; }
  play = play;
}

describe("uiSounds", () => {
  beforeEach(async () => {
    vi.resetModules();
    play.mockClear();
    localStorage.clear();
    vi.stubGlobal("Audio", FakeAudio);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("plays a cue when enabled (default)", async () => {
    const { playUiSound } = await import("../uiSounds");
    playUiSound("notification");
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("is silent when the user turned sounds off", async () => {
    const { playUiSound, setUiSoundsEnabled, getUiSoundsEnabled } = await import("../uiSounds");
    setUiSoundsEnabled(false);
    expect(getUiSoundsEnabled()).toBe(false);
    playUiSound("send");
    expect(play).not.toHaveBeenCalled();
    setUiSoundsEnabled(true);
    playUiSound("send");
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("collapses a burst into a single sound, then allows the next one", async () => {
    const { playUiSound } = await import("../uiSounds");
    playUiSound("receive");
    playUiSound("notification");
    expect(play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    playUiSound("notification");
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("swallows autoplay rejections", async () => {
    play.mockImplementationOnce(() => Promise.reject(new Error("NotAllowedError")));
    const { playUiSound } = await import("../uiSounds");
    expect(() => playUiSound("send")).not.toThrow();
  });
});
