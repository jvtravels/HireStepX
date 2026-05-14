import { describe, it, expect, afterEach, vi } from "vitest";
import {
  extractCandidateProfile,
  __WAVE_FLAGS_INTERNAL,
} from "../../server-handlers/_candidate-profile";

/* A dense composition utterance that should fire flags across all four
 * waves simultaneously. Wave-2: parentInsuranceAsked, inHandTakehomeFocus,
 * agingParentCare, moonlightingDisclosed. Wave-3: referralReceived,
 * dietaryReligiousNeed, pregnancyDisclosed. Wave-4: signOnClawback,
 * paternityLeaveAsk, casteReservationContext, visaSponsorshipNeed. */
const DENSE_UTTERANCE = [
  "Quick few asks: parent insurance / parent floater coverage for my parents.",
  "Could you share the in-hand take-home monthly breakdown? I'd like the in-hand number.",
  "I'm taking care of my aging parents so flexibility matters.",
  "I want to keep moonlighting on a small side project.",
  "I was referred by an internal employee — Anita referred me.",
  "Vegetarian cafeteria / Jain food options available?",
  "I'm pregnant and due in 4 months.",
  "What about the sign-on bonus clawback if I leave early?",
  "Paternity leave policy?",
  "I'm an OBC reservation category candidate.",
  "I need visa sponsorship — H1B transfer.",
].join(" ");

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("wave kill-switch — env unset (baseline)", () => {
  it("fires Wave-2 / Wave-3 / Wave-4 flags on a dense composition utterance", () => {
    const p = extractCandidateProfile(DENSE_UTTERANCE);
    /* At least one flag from each wave must fire — these regex banks
       are conservative, so we don't pin every flag, only the high-
       confidence ones for each wave. */
    expect(p.parentInsuranceAsked || p.inHandTakehomeFocus || p.agingParentCare || p.moonlightingDisclosed).toBe(true);
    expect(p.referralReceived || p.dietaryReligiousNeed || p.pregnancyDisclosed).toBe(true);
    expect(p.signOnClawback || p.paternityLeaveAsk || p.casteReservationContext || p.visaSponsorshipNeed).toBe(true);
  });
});

describe("wave kill-switch — HSX_DISABLE_WAVE_4=1", () => {
  it("zeroes all Wave-4 flags even when their phrases are spoken", () => {
    vi.stubEnv("HSX_DISABLE_WAVE_4", "1");
    const p = extractCandidateProfile(DENSE_UTTERANCE);
    for (const k of __WAVE_FLAGS_INTERNAL.wave4) {
      expect((p as unknown as Record<string, unknown>)[k]).toBe(false);
    }
  });
});

describe("wave kill-switch — HSX_DISABLE_WAVE_3=1", () => {
  it("zeroes all Wave-3 flags", () => {
    vi.stubEnv("HSX_DISABLE_WAVE_3", "1");
    const p = extractCandidateProfile(DENSE_UTTERANCE);
    for (const k of __WAVE_FLAGS_INTERNAL.wave3) {
      expect((p as unknown as Record<string, unknown>)[k]).toBe(false);
    }
  });
});

describe("wave kill-switch — HSX_DISABLE_WAVE_2=1", () => {
  it("zeroes all Wave-2 flags", () => {
    vi.stubEnv("HSX_DISABLE_WAVE_2", "1");
    const p = extractCandidateProfile(DENSE_UTTERANCE);
    for (const k of __WAVE_FLAGS_INTERNAL.wave2) {
      expect((p as unknown as Record<string, unknown>)[k]).toBe(false);
    }
  });
});

describe("wave kill-switch — resetting env restores behavior", () => {
  it("after unstubAllEnvs, flags fire normally again", () => {
    vi.stubEnv("HSX_DISABLE_WAVE_4", "1");
    const blocked = extractCandidateProfile(DENSE_UTTERANCE);
    /* At least one Wave-4 flag was zeroed under env. */
    const someWave4WasBlocked = __WAVE_FLAGS_INTERNAL.wave4.some(
      (k) => (blocked as unknown as Record<string, unknown>)[k] === false,
    );
    expect(someWave4WasBlocked).toBe(true);
    vi.unstubAllEnvs();
    const restored = extractCandidateProfile(DENSE_UTTERANCE);
    /* Now at least one Wave-4 flag should fire on this dense utterance. */
    const someWave4Fires = __WAVE_FLAGS_INTERNAL.wave4.some(
      (k) => (restored as unknown as Record<string, unknown>)[k] === true,
    );
    expect(someWave4Fires).toBe(true);
  });
});
