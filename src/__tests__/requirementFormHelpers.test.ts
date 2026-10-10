import { describe, it, expect } from "vitest";
import {
  EXPERIENCE_PRESETS,
  allErrors,
  convertBudget,
  describeExperience,
  describeSalary,
  digitsOnly,
  errorsForStep,
  hasAdvancedValues,
  initialDraft,
  isDraftMeaningful,
  needsDuration,
  normalizeNoticePeriod,
  parseStoredDraft,
  presetIsActive,
  validateDraft,
} from "../employer/_requirementFormHelpers";
import type { RequirementDraft } from "../employer/_requirementPayload";

const TODAY = "2026-10-10";

const valid = (over: Partial<RequirementDraft> = {}): RequirementDraft => ({
  ...initialDraft(),
  title: "Senior Engineer",
  locations: ["Mumbai"],
  description: "Build and own backend services for our hiring platform.",
  ...over,
});

describe("validateDraft", () => {
  it("accepts a minimal valid draft", () => {
    expect(validateDraft(valid(), TODAY)).toEqual({});
  });

  it("requires title, location and a long enough description", () => {
    const e = validateDraft(valid({ title: " ", locations: [], description: "short" }), TODAY);
    expect(e.title).toBeTruthy();
    expect(e.locations).toBeTruthy();
    expect(e.description).toMatch(/more characters/);
  });

  it("asks for a description when empty", () => {
    expect(validateDraft(valid({ description: "" }), TODAY).description).toMatch(/at least 20/);
  });

  it("rejects decimal, oversized and inverted experience", () => {
    expect(validateDraft(valid({ experienceMin: "2.5" }), TODAY).experience).toMatch(/whole number/);
    expect(validateDraft(valid({ experienceMax: "41" }), TODAY).experience).toMatch(/more than 40/);
    expect(validateDraft(valid({ experienceMin: "6", experienceMax: "3" }), TODAY).experience).toMatch(/higher than the maximum/);
    expect(validateDraft(valid({ experienceMin: "3", experienceMax: "3" }), TODAY).experience).toBeUndefined();
  });

  it("applies per-unit salary limits", () => {
    expect(validateDraft(valid({ salaryType: "per-annum", budgetMax: "1001" }), TODAY).budget).toMatch(/LPA/);
    expect(validateDraft(valid({ salaryType: "per-annum", budgetMax: "1000" }), TODAY).budget).toBeUndefined();
    expect(validateDraft(valid({ salaryType: "per-month", budgetMax: "150000" }), TODAY).budget).toBeUndefined();
    expect(validateDraft(valid({ salaryType: "per-month", budgetMax: "100000001" }), TODAY).budget).toMatch(/rupees/);
  });

  it("validates open positions between 1 and 500", () => {
    expect(validateDraft(valid({ openPositions: "0" }), TODAY).openPositions).toBeTruthy();
    expect(validateDraft(valid({ openPositions: "501" }), TODAY).openPositions).toBeTruthy();
    expect(validateDraft(valid({ openPositions: "500" }), TODAY).openPositions).toBeUndefined();
    expect(validateDraft(valid({ openPositions: "" }), TODAY).openPositions).toBeUndefined();
  });

  it("only validates duration and hours for non full-time roles", () => {
    const bad = { durationWeeks: "200", hoursPerWeek: "99" };
    expect(validateDraft(valid({ employmentType: "full-time", ...bad }), TODAY)).toEqual({});
    const e = validateDraft(valid({ employmentType: "contract", ...bad }), TODAY);
    expect(e.durationWeeks).toBeTruthy();
    expect(e.hoursPerWeek).toBeTruthy();
  });

  it("rejects past deadlines but allows today", () => {
    expect(validateDraft(valid({ dueDate: "2026-10-09" }), TODAY).dueDate).toBeTruthy();
    expect(validateDraft(valid({ dueDate: TODAY }), TODAY).dueDate).toBeUndefined();
  });

  it("keeps STAR completeness within 0 to 100", () => {
    expect(validateDraft(valid({ minStarCompleteness: "101" }), TODAY).minStarCompleteness).toBeTruthy();
    expect(validateDraft(valid({ minStarCompleteness: "100" }), TODAY).minStarCompleteness).toBeUndefined();
  });
});

describe("errorsForStep / allErrors", () => {
  const errors = validateDraft(valid({ title: "", description: "", minStarCompleteness: "500" }), TODAY);

  it("groups errors by wizard step", () => {
    expect(errorsForStep(errors, 1).map(([k]) => k)).toEqual(["title"]);
    expect(errorsForStep(errors, 2).map(([k]) => k)).toEqual(["description"]);
    expect(errorsForStep(errors, 3).map(([k]) => k)).toEqual(["minStarCompleteness"]);
  });

  it("returns every error in step order", () => {
    expect(allErrors(errors).map(([k]) => k)).toEqual(["title", "description", "minStarCompleteness"]);
  });
});

describe("inputs", () => {
  it("digitsOnly strips non digits and caps length", () => {
    expect(digitsOnly("1a2.5e3")).toBe("1253");
    expect(digitsOnly("123456", 3)).toBe("123");
  });

  it("needsDuration is false only for full-time", () => {
    expect(needsDuration("full-time")).toBe(false);
    expect(needsDuration("contract")).toBe(true);
    expect(needsDuration("internship")).toBe(true);
    expect(needsDuration("part-time")).toBe(true);
  });
});

describe("experience presets", () => {
  it("matches the active preset exactly", () => {
    const three = EXPERIENCE_PRESETS.find((p) => p.label === "3 to 5 yrs")!;
    expect(presetIsActive(three, "3", "5")).toBe(true);
    expect(presetIsActive(three, "3", "6")).toBe(false);
    const open = EXPERIENCE_PRESETS.find((p) => p.label === "12+ yrs")!;
    expect(presetIsActive(open, "12", "")).toBe(true);
  });

  it("describes ranges in plain language", () => {
    expect(describeExperience("", "")).toBe("Any experience level");
    expect(describeExperience("2", "5")).toBe("2 to 5 years");
    expect(describeExperience("12", "")).toBe("12+ years");
    expect(describeExperience("", "1")).toBe("Up to 1 year");
    expect(describeExperience("1", "1")).toBe("1 year");
  });
});

describe("salary", () => {
  it("converts LPA to a rounded monthly figure and back", () => {
    expect(convertBudget("12", "per-annum", "per-month")).toBe("100000");
    expect(convertBudget("100000", "per-month", "per-annum")).toBe("12");
  });

  it("clamps converted annual values to the LPA limits", () => {
    expect(convertBudget("1", "per-month", "per-annum")).toBe("1");
    expect(convertBudget("99999999", "per-month", "per-annum")).toBe("1000");
  });

  it("leaves blanks, non numbers and same-unit values alone", () => {
    expect(convertBudget("", "per-annum", "per-month")).toBe("");
    expect(convertBudget("abc", "per-annum", "per-month")).toBe("abc");
    expect(convertBudget("12", "per-annum", "per-annum")).toBe("12");
    expect(convertBudget("50000", "per-month", "fixed")).toBe("50000");
  });

  it("reads salary back with Indian digit grouping", () => {
    expect(describeSalary("12", "18", "per-annum")).toBe("₹12,00,000 to ₹18,00,000 a year");
    expect(describeSalary("80000", "", "per-month")).toBe("From ₹80,000 a month");
    expect(describeSalary("", "60000", "fixed")).toBe("Up to ₹60,000 fixed");
    expect(describeSalary("10", "10", "per-annum")).toBe("₹10,00,000 a year");
    expect(describeSalary("", "", "per-annum")).toBeNull();
  });
});

describe("initialDraft", () => {
  it("defaults a new requirement to 1 position, remote, full-time", () => {
    const d = initialDraft();
    expect(d.openPositions).toBe("1");
    expect(d.workMode).toBe("remote");
    expect(d.employmentType).toBe("full-time");
    expect(d.noticePeriodPref).toBe("Any");
  });

  it("maps legacy notice period labels to current options", () => {
    expect(normalizeNoticePeriod("Immediate–30 days")).toBe("Up to 30 days");
    expect(normalizeNoticePeriod("Up to 60 days")).toBe("Up to 60 days");
    expect(normalizeNoticePeriod("Custom")).toBe("Custom");
  });
});

describe("hasAdvancedValues", () => {
  it("is false for a fresh draft and true once any advanced field is set", () => {
    expect(hasAdvancedValues(initialDraft())).toBe(false);
    expect(hasAdvancedValues(valid({ preferredIndustry: "Fintech" }))).toBe(true);
    expect(hasAdvancedValues(valid({ portfolioRequired: true }))).toBe(true);
    expect(hasAdvancedValues(valid({ customSkillSets: ["Bespoke"] }))).toBe(true);
  });
});

describe("stored drafts", () => {
  it("round trips a draft", () => {
    const draft = valid({ title: "Designer" });
    const parsed = parseStoredDraft(JSON.stringify({ savedAt: 5, draft }));
    expect(parsed?.savedAt).toBe(5);
    expect(parsed?.draft.title).toBe("Designer");
  });

  it("fills fields missing from an older draft", () => {
    const parsed = parseStoredDraft(JSON.stringify({ savedAt: 1, draft: { title: "Old" } }));
    expect(parsed?.draft.skills).toEqual([]);
    expect(parsed?.draft.openPositions).toBe("1");
  });

  it("rejects corrupt input", () => {
    expect(parseStoredDraft(null)).toBeNull();
    expect(parseStoredDraft("not json")).toBeNull();
    expect(parseStoredDraft("42")).toBeNull();
    expect(parseStoredDraft(JSON.stringify({ draft: {} }))).toBeNull();
  });

  it("only offers a draft the user actually typed into", () => {
    expect(isDraftMeaningful(initialDraft())).toBe(false);
    expect(isDraftMeaningful(valid({ title: "x" }))).toBe(true);
    expect(isDraftMeaningful({ ...initialDraft(), skills: ["React"] })).toBe(true);
  });
});
