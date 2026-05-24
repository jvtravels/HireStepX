import { describe, it, expect, vi, beforeEach } from "vitest";

const captureMock = vi.fn();
vi.mock("../posthogClient", () => ({
  captureClientEvent: (...args: unknown[]) => captureMock(...args),
}));

import {
  startTtsAttempt,
  recordTtsAttempt,
  recordTtsAudioStarted,
  finalizeTtsAttempt,
} from "../_tts-telemetry";

beforeEach(() => {
  captureMock.mockClear();
});

describe("_tts-telemetry", () => {
  it("startTtsAttempt initializes with text length and voice metadata", () => {
    const a = startTtsAttempt({ text: "hello", voiceId: "v1", gender: "female" });
    expect(a.textLength).toBe(5);
    expect(a.voiceId).toBe("v1");
    expect(a.gender).toBe("female");
    expect(a.attempted).toEqual([]);
    expect(a.winner).toBeNull();
    expect(a.finalized).toBe(false);
  });

  it("recordTtsAttempt is idempotent for consecutive identical tiers", () => {
    const a = startTtsAttempt({ text: "x" });
    recordTtsAttempt(a, "sarvam");
    recordTtsAttempt(a, "sarvam");
    recordTtsAttempt(a, "cartesia-ws");
    recordTtsAttempt(a, "cartesia-ws");
    expect(a.attempted).toEqual(["sarvam", "cartesia-ws"]);
  });

  it("recordTtsAudioStarted sets winner once and ignores later calls", () => {
    const a = startTtsAttempt({ text: "x" });
    recordTtsAttempt(a, "sarvam");
    recordTtsAudioStarted(a, "sarvam");
    const firstAt = a.firstAudioAt;
    recordTtsAudioStarted(a, "cartesia-ws");
    expect(a.winner).toBe("sarvam");
    expect(a.firstAudioAt).toBe(firstAt);
  });

  it("recordTtsAudioStarted also records the tier as attempted", () => {
    const a = startTtsAttempt({ text: "x" });
    recordTtsAudioStarted(a, "azure");
    expect(a.attempted).toContain("azure");
  });

  it("finalizeTtsAttempt emits one event with full chain", () => {
    const a = startTtsAttempt({ text: "hello", voiceId: "v1", gender: "male" });
    recordTtsAttempt(a, "sarvam");
    recordTtsAttempt(a, "cartesia-ws");
    recordTtsAudioStarted(a, "cartesia-ws");
    finalizeTtsAttempt(a, "ok");

    expect(captureMock).toHaveBeenCalledTimes(1);
    const [event, props] = captureMock.mock.calls[0];
    expect(event).toBe("tts_provider_used");
    expect(props.winner).toBe("cartesia-ws");
    expect(props.attempted).toBe("sarvam>cartesia-ws");
    expect(props.fallbackHops).toBe(1);
    expect(props.outcome).toBe("ok");
    expect(props.textLength).toBe(5);
    expect(props.voiceId).toBe("v1");
    expect(props.gender).toBe("male");
  });

  it("finalize is idempotent (first call wins)", () => {
    const a = startTtsAttempt({ text: "x" });
    finalizeTtsAttempt(a, "ok");
    finalizeTtsAttempt(a, "error");
    finalizeTtsAttempt(a, "cancelled");
    expect(captureMock).toHaveBeenCalledTimes(1);
    expect(captureMock.mock.calls[0][1].outcome).toBe("ok");
  });

  it("emits winner=none and latencyMs=-1 when no audio ever started", () => {
    const a = startTtsAttempt({ text: "x" });
    recordTtsAttempt(a, "sarvam");
    recordTtsAttempt(a, "cartesia-ws");
    finalizeTtsAttempt(a, "error");
    const props = captureMock.mock.calls[0][1];
    expect(props.winner).toBe("none");
    expect(props.latencyMs).toBe(-1);
    expect(props.fallbackHops).toBe(1);
  });

  it("defaults voiceId and gender when omitted", () => {
    const a = startTtsAttempt({ text: "x" });
    finalizeTtsAttempt(a, "ok");
    const props = captureMock.mock.calls[0][1];
    expect(props.voiceId).toBe("default");
    expect(props.gender).toBe("unspecified");
  });

  it("computes non-negative latencyMs when audio started", async () => {
    const a = startTtsAttempt({ text: "x" });
    await new Promise((r) => setTimeout(r, 5));
    recordTtsAudioStarted(a, "sarvam");
    finalizeTtsAttempt(a, "ok");
    const props = captureMock.mock.calls[0][1];
    expect(props.latencyMs).toBeGreaterThanOrEqual(0);
    expect(props.totalMs).toBeGreaterThanOrEqual(props.latencyMs);
  });
});
