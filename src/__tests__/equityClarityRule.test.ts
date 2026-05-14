/* PDF #17 architectural fix (2026-05-15) — equity-clarity
 * system-prompt rule + four-fields detector. */
import { describe, it, expect } from "vitest";
import { NEGOTIATION_SYSTEM_PROMPT } from "../../server-handlers/_negotiate-turn-helpers";
import { analyzeEquityClarity } from "../../server-handlers/_trial-close-detector";

describe("EQUITY CLARITY rule", () => {
  it("the negotiation system prompt includes the EQUITY CLARITY block", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/EQUITY CLARITY/);
  });

  it("the rule references all four mandatory disclosures", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/Included vs additional/i);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/Vesting schedule/i);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/FMV or strike/i);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/[Bb]uyback history/i);
  });

  it("analyzeEquityClarity flags allFourCovered on a complete reply", () => {
    const complete =
      "Equity is on top of CTC. 4-year vest with a 1-year cliff. FMV is ₹50 per share from our last 409A. We've had a buyback every 2 years.";
    const r = analyzeEquityClarity(complete);
    expect(r.includedVsAdditional).toBe(true);
    expect(r.vestingSchedule).toBe(true);
    expect(r.fmvOrStrike).toBe(true);
    expect(r.buybackHistory).toBe(true);
    expect(r.allFourCovered).toBe(true);
  });

  it("analyzeEquityClarity flags partial coverage", () => {
    const partial = "We offer equity for senior roles with a 4-year vest.";
    const r = analyzeEquityClarity(partial);
    expect(r.vestingSchedule).toBe(true);
    expect(r.allFourCovered).toBe(false);
  });
});
