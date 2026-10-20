import { describe, it, expect } from "vitest";
import { getRecommendedFocus, resolveFocusDefaults } from "../setupFocus";

const soon = new Set(["Technical Leadership", "Strategic", "Management", "Case Study"]);
const isComingSoon = (f: string) => soon.has(f);

describe("getRecommendedFocus", () => {
  it("fresher profile wins over role", () => {
    expect(getRecommendedFocus("Software Engineer", "fresher")).toBe("Campus Placement");
  });
  it("empty role falls back to Behavioral", () => {
    expect(getRecommendedFocus("", "mid")).toBe("Behavioral");
  });
});

describe("resolveFocusDefaults", () => {
  it("fresher with empty role: badge and default agree on Campus Placement", () => {
    const r = resolveFocusDefaults({ role: "", experienceLevel: "fresher", relevant: null, isComingSoon });
    expect(r).toEqual({ recommended: "Campus Placement", defaultFocus: "Campus Placement" });
  });
  it("coming-soon pick is dropped, no badge target and default is Behavioral", () => {
    const r = resolveFocusDefaults({ role: "Software Engineer", experienceLevel: "mid", relevant: null, isComingSoon });
    expect(r).toEqual({ recommended: "Behavioral", defaultFocus: "Behavioral" });
  });
  it("pick hidden by role filter falls to first open relevant focus", () => {
    const r = resolveFocusDefaults({ role: "x", experienceLevel: "fresher", relevant: new Set(["Technical Leadership", "HR Round"]), isComingSoon });
    expect(r.recommended).toBe("Behavioral");
    expect(r.defaultFocus).toBe("HR Round");
  });
});
