import { describe, it, expect } from "vitest";
import { buildRequirementPayload, type RequirementDraft } from "../employer/_requirementPayload";

const draft: RequirementDraft = {
  title: " Backend Engineer ", department: "Eng", locations: ["Pune"], noticePeriodPref: "Any",
  description: "Build services for hiring.", experienceMin: "2", experienceMax: "5", dueDate: "2026-12-01",
  budgetMin: "10", budgetMax: "20", openPositions: "2", workMode: "remote", employmentType: "full-time",
  skills: ["Go"], customSkillSets: [], responsibilities: "Ship", niceToHave: "K8s", preferredIndustry: "SaaS",
  preferredColleges: [], targetCompanies: [], perksAndBenefits: [], salaryType: "per-annum",
  preferredDomain: "Fintech", workSchedule: "9-6", availability: "Immediate", relevantExperience: "3y",
  portfolioRequired: false, durationWeeks: "12", hoursPerWeek: "40", minReadinessBand: "hire", minStarCompleteness: "60",
};

describe("buildRequirementPayload", () => {
  it("trims and parses filled values", () => {
    const p = buildRequirementPayload(draft);
    expect(p.title).toBe("Backend Engineer");
    expect(p.preferredIndustry).toBe("SaaS");
    expect(p.budgetMin).toBe(10);
    expect(p.minReadinessBand).toBe("hire");
  });

  it("sends null (not undefined) for every cleared optional field so JSON keeps the key", () => {
    const cleared = buildRequirementPayload({
      ...draft, department: " ", preferredIndustry: "", responsibilities: "", niceToHave: "", preferredDomain: "",
      workSchedule: "", availability: "", relevantExperience: "", dueDate: "", experienceMin: "", experienceMax: "",
      budgetMin: "", budgetMax: "", openPositions: "", durationWeeks: "", hoursPerWeek: "", minReadinessBand: "",
      minStarCompleteness: "",
    });
    const wire = JSON.parse(JSON.stringify(cleared)) as Record<string, unknown>;
    for (const key of [
      "department", "preferredIndustry", "responsibilities", "niceToHave", "preferredDomain", "workSchedule",
      "availability", "relevantExperience", "dueDate", "experienceMin", "experienceMax", "budgetMin", "budgetMax",
      "openPositions", "durationWeeks", "hoursPerWeek", "minReadinessBand", "minStarCompleteness",
    ]) {
      expect(key in wire, key).toBe(true);
      expect(wire[key], key).toBeNull();
    }
  });

  it("treats non-numeric text as cleared rather than NaN", () => {
    expect(buildRequirementPayload({ ...draft, budgetMin: "abc" }).budgetMin).toBeNull();
  });
});
