/* Wave-3D (PDF #17 follow-up, 2026-05-15) — equity-instrument depth
 * flags. Four new candidate-profile asks covering vesting schedule,
 * cliff period, exercise terms, and buyback / liquidity events. */
import { describe, expect, it } from "vitest";
import {
  extractCandidateProfile,
  mergeCandidateProfile,
} from "../../server-handlers/_candidate-profile";

describe("Wave-3D — equityVestingScheduleAsk", () => {
  it("detects 'vesting schedule'", () => {
    expect(extractCandidateProfile("What's the vesting schedule?").equityVestingScheduleAsk).toBe(true);
  });
  it("detects 'how does vesting work'", () => {
    expect(extractCandidateProfile("How does vesting work here?").equityVestingScheduleAsk).toBe(true);
  });
  it("detects 'vesting cadence'", () => {
    expect(extractCandidateProfile("Tell me the vesting cadence.").equityVestingScheduleAsk).toBe(true);
  });
  it("detects 'vesting period'", () => {
    expect(extractCandidateProfile("What's the vesting period?").equityVestingScheduleAsk).toBe(true);
  });
});

describe("Wave-3D — equityCliffPeriodAsk", () => {
  it("detects 'cliff period'", () => {
    expect(extractCandidateProfile("Is there a cliff period?").equityCliffPeriodAsk).toBe(true);
  });
  it("detects '1-year cliff'", () => {
    expect(extractCandidateProfile("Standard 1-year cliff?").equityCliffPeriodAsk).toBe(true);
  });
  it("detects 'vesting cliff'", () => {
    expect(extractCandidateProfile("What's the vesting cliff length?").equityCliffPeriodAsk).toBe(true);
  });
});

describe("Wave-3D — equityExerciseTermsAsk", () => {
  it("detects 'exercise terms'", () => {
    expect(extractCandidateProfile("What are the exercise terms?").equityExerciseTermsAsk).toBe(true);
  });
  it("detects 'exercise window'", () => {
    expect(extractCandidateProfile("Post-termination exercise window?").equityExerciseTermsAsk).toBe(true);
  });
  it("detects 'strike price'", () => {
    expect(extractCandidateProfile("What's the strike price on the options?").equityExerciseTermsAsk).toBe(true);
  });
  it("detects 'exercise price'", () => {
    expect(extractCandidateProfile("And the exercise price?").equityExerciseTermsAsk).toBe(true);
  });
});

describe("Wave-3D — equityBuybackLiquidityAsk", () => {
  it("detects 'buyback'", () => {
    expect(extractCandidateProfile("Do you do buyback cycles?").equityBuybackLiquidityAsk).toBe(true);
  });
  it("detects 'liquidity event'", () => {
    expect(extractCandidateProfile("Any liquidity event planned?").equityBuybackLiquidityAsk).toBe(true);
  });
  it("detects 'secondary sale'", () => {
    expect(extractCandidateProfile("Have employees done a secondary sale?").equityBuybackLiquidityAsk).toBe(true);
  });
  it("detects 'tender offer'", () => {
    expect(extractCandidateProfile("Tender offer history?").equityBuybackLiquidityAsk).toBe(true);
  });
});

describe("Wave-3D — merge is monotone-up", () => {
  it("equityVestingScheduleAsk stays true after later turn without the ask", () => {
    const a = extractCandidateProfile("What's the vesting schedule?");
    const b = extractCandidateProfile("Tell me about WFH.");
    const merged = mergeCandidateProfile(a, b);
    expect(merged.equityVestingScheduleAsk).toBe(true);
  });

  it("equityCliffPeriodAsk stays true after later turn without the ask", () => {
    const a = extractCandidateProfile("Is there a cliff period?");
    const b = extractCandidateProfile("OK, sounds good.");
    const merged = mergeCandidateProfile(a, b);
    expect(merged.equityCliffPeriodAsk).toBe(true);
  });

  it("hasAny becomes true when any of the 4 fires", () => {
    const r = extractCandidateProfile("What's the exercise window?");
    expect(r.equityExerciseTermsAsk).toBe(true);
    expect(r.hasAny).toBe(true);
  });
});
