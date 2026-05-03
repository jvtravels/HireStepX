import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useListeningInterjections } from "../_listening-interjections";

/* The hook itself is mostly useEffect side-effects with timers; full
   behavioural tests would need fake timers + a real React tree to drive
   phase changes. These tests cover the safety-of-call surface only:
   the public hook must mount without throwing in jsdom, return the
   coordination handle the engine expects, and not leak timers when
   unmounted while idle (phase !== "listening"). */

const makeRef = <T,>(initial: T) => ({ current: initial });

const baseConfig = () => ({
  phase: "thinking" as const,
  aiVoiceEnabled: true,
  currentStep: 0,
  currentTranscript: "",
  elapsed: 0,
  interviewerGender: "female" as const,
  interviewEndedRef: makeRef(false),
  textareaRef: makeRef(null),
  handleNextRef: makeRef<(() => void) | null>(null),
  setTranscript: () => {},
  speak: async () => ({ cancel: () => {} }),
  toast: () => {},
  formatTime: (s: number) => `${s}s`,
});

describe("useListeningInterjections", () => {
  it("mounts without throwing and returns the expected handle shape", () => {
    const { result } = renderHook(() => useListeningInterjections(baseConfig()));
    expect(typeof result.current.resetSilenceNudge).toBe("function");
    expect(result.current.ramblingFiredRef).toHaveProperty("current");
    expect(result.current.softTrackFiredRef).toHaveProperty("current");
  });

  it("resetSilenceNudge is callable repeatedly without throwing", () => {
    const { result } = renderHook(() => useListeningInterjections(baseConfig()));
    expect(() => {
      for (let i = 0; i < 5; i++) result.current.resetSilenceNudge();
    }).not.toThrow();
  });

  it("unmounts cleanly from a non-listening phase", () => {
    const { unmount } = renderHook(() => useListeningInterjections(baseConfig()));
    expect(() => unmount()).not.toThrow();
  });

  it("unmounts cleanly when phase is listening (timers armed)", () => {
    const cfg = { ...baseConfig(), phase: "listening" as const };
    const { unmount } = renderHook(() => useListeningInterjections(cfg));
    expect(() => unmount()).not.toThrow();
  });
});
