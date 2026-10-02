import { describe, it, expect } from "vitest";
import { computeSeverity } from "../../server-handlers/_digest-helpers";

describe("computeSeverity", () => {
  it("returns 'high' when any hallucination is present", () => {
    expect(computeSeverity({ hallucinationCount: 1, scoreDrift: 0, flagCount: 1 })).toBe("high");
  });

  it("returns 'high' when |score_drift| >= 10", () => {
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: -12, flagCount: 0 })).toBe("high");
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: 11, flagCount: 0 })).toBe("high");
  });

  it("returns 'medium' when there are flags but no hallucinations or large drift", () => {
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: 3, flagCount: 2 })).toBe("medium");
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: null, flagCount: 1 })).toBe("medium");
  });

  it("returns 'low' for clean sessions", () => {
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: null, flagCount: 0 })).toBe("low");
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: 1, flagCount: 0 })).toBe("low");
  });
});
