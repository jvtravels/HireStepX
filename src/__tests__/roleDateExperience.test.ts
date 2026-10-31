import { describe, expect, it } from "vitest";
import { experienceMonthsOf, formatExperience, roleDateMonths } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers";

const NOW = new Date(2026, 9, 31);

describe("role-date experience (owner decision, Oct 31 2026)", () => {
  it("adds up role dates", () => {
    expect(roleDateMonths([{ period: "Jan 2024 – Jul 2024" }, { period: "Sep 2024 – Mar 2025" }], NOW)).toBe(12);
  });
  it("counts overlapping roles once", () => {
    expect(roleDateMonths([{ period: "Jan 2024 – Dec 2024" }, { period: "Jun 2024 – Dec 2025" }], NOW)).toBe(23);
  });
  it("returns null when no period is readable", () => {
    expect(roleDateMonths([{ period: "recently" }, { period: "" }], NOW)).toBeNull();
  });
  it("prefers role dates over the stored whole years", () => {
    expect(experienceMonthsOf({ experience: [{ period: "Jan 2024 – May 2025" }], yearsExperience: 2 })).toBe(16);
  });
  it("falls back to stored years when no dates can be read", () => {
    expect(experienceMonthsOf({ experience: [{ period: "" }], yearsExperience: 2 })).toBe(24);
    expect(experienceMonthsOf({ experience: [], yearsExperience: null })).toBeNull();
    expect(experienceMonthsOf(null)).toBeNull();
  });
  it("formats whole years and mixed spans", () => {
    expect(formatExperience(24)).toBe("2 years");
    expect(formatExperience(16)).toBe("1 yr 4 mo");
    expect(formatExperience(7)).toBe("7 mo");
  });
});
