import { describe, it, expect, beforeEach } from "vitest";
import {
  micConstraints, getPreferredMicId, setPreferredMicId,
  getPreferredSpeakerId, setPreferredSpeakerId, supportsSpeakerSelection, applySpeaker,
} from "../audioDevices";

describe("audioDevices", () => {
  beforeEach(() => localStorage.clear());

  it("uses plain audio:true when no mic is chosen", () => {
    expect(micConstraints()).toBe(true);
  });

  it("requests the saved mic as an ideal (soft) constraint so a missing device falls back", () => {
    setPreferredMicId("abc");
    expect(getPreferredMicId()).toBe("abc");
    expect(micConstraints()).toEqual({ deviceId: { ideal: "abc" } });
  });

  it("clears the saved device when reset to system default", () => {
    setPreferredMicId("abc");
    setPreferredMicId(null);
    expect(micConstraints()).toBe(true);
    setPreferredSpeakerId("spk");
    expect(getPreferredSpeakerId()).toBe("spk");
    setPreferredSpeakerId(null);
    expect(getPreferredSpeakerId()).toBeNull();
  });

  it("applySpeaker is a no-op without a saved speaker or browser support", () => {
    let called = false;
    const el = { setSinkId: () => { called = true; return Promise.resolve(); } } as unknown as HTMLMediaElement;
    applySpeaker(el);
    expect(called).toBe(false);
    setPreferredSpeakerId("spk");
    if (!supportsSpeakerSelection()) {
      applySpeaker(el);
      expect(called).toBe(false);
    }
  });
});
