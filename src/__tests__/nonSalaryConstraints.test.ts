import { describe, it, expect } from "vitest";
import {
  extractNonSalaryConstraints,
  mergeNonSalaryConstraints,
  hasAnyNonSalaryConstraint,
  formatNonSalaryConstraintsBrief,
} from "../../server-handlers/_non-salary-constraints";

describe("_non-salary-constraints — WFH days extraction", () => {
  it("'3 days WFH' → 3", () => {
    expect(extractNonSalaryConstraints("I need 3 days WFH").wfhDaysRequired).toBe(3);
  });
  it("'WFH 2 days' → 2", () => {
    expect(extractNonSalaryConstraints("Looking for WFH 2 days a week").wfhDaysRequired).toBe(2);
  });
  it("'hybrid 3 days' → 3", () => {
    expect(extractNonSalaryConstraints("we offer hybrid 3 days").wfhDaysRequired).toBe(3);
  });
  it("'2/3 hybrid' → 2", () => {
    expect(extractNonSalaryConstraints("how about 2/3 hybrid?").wfhDaysRequired).toBe(2);
  });
  it("'work from home for 4 days' → 4", () => {
    expect(extractNonSalaryConstraints("work from home for 4 days").wfhDaysRequired).toBe(4);
  });
  it("no WFH mention → undefined", () => {
    expect(extractNonSalaryConstraints("I want a big base").wfhDaysRequired).toBeUndefined();
  });
});

describe("_non-salary-constraints — parent-care lock", () => {
  it("'aging parents' fires", () => {
    expect(extractNonSalaryConstraints("I have aging parents at home").parentCareLocationLock).toBe(true);
  });
  it("'parents need care' fires", () => {
    expect(extractNonSalaryConstraints("my parents need care").parentCareLocationLock).toBe(true);
  });
  it("'caring for my parents' fires", () => {
    expect(extractNonSalaryConstraints("caring for my parents is my priority").parentCareLocationLock).toBe(true);
  });
  it("'parent-care' compound fires", () => {
    expect(extractNonSalaryConstraints("parent-care obligations").parentCareLocationLock).toBe(true);
  });
  it("no match → undefined", () => {
    expect(extractNonSalaryConstraints("just plain salary talk").parentCareLocationLock).toBeUndefined();
  });
});

describe("_non-salary-constraints — specific office location", () => {
  it("'Whitefield specifically' fires", () => {
    const r = extractNonSalaryConstraints("must be Whitefield specifically");
    expect(r.specificOfficeLocation).toMatch(/Whitefield/);
  });
  it("'only work in Powai' fires", () => {
    const r = extractNonSalaryConstraints("I will only work in Powai please");
    expect(r.specificOfficeLocation).toMatch(/Powai/);
  });
});

describe("_non-salary-constraints — merge / helpers", () => {
  it("merge preserves prior, applies last-stated-wins", () => {
    const a = { wfhDaysRequired: 2 };
    const b = { wfhDaysRequired: 3, parentCareLocationLock: true };
    expect(mergeNonSalaryConstraints(a, b)).toEqual({
      wfhDaysRequired: 3,
      parentCareLocationLock: true,
    });
  });

  it("merge monotone-up for boolean (true never reverts)", () => {
    const a = { parentCareLocationLock: true };
    const b = {};
    expect(mergeNonSalaryConstraints(a, b).parentCareLocationLock).toBe(true);
  });

  it("hasAnyNonSalaryConstraint reflects population", () => {
    expect(hasAnyNonSalaryConstraint(null)).toBe(false);
    expect(hasAnyNonSalaryConstraint({})).toBe(false);
    expect(hasAnyNonSalaryConstraint({ wfhDaysRequired: 2 })).toBe(true);
  });

  it("formatNonSalaryConstraintsBrief returns null when empty", () => {
    expect(formatNonSalaryConstraintsBrief({})).toBeNull();
    expect(formatNonSalaryConstraintsBrief(null)).toBeNull();
  });

  it("formatNonSalaryConstraintsBrief produces a bracketed advisory", () => {
    const s = formatNonSalaryConstraintsBrief({
      wfhDaysRequired: 3,
      parentCareLocationLock: true,
      specificOfficeLocation: "Whitefield",
    });
    expect(s).toMatch(/^\[NON-SALARY CONSTRAINTS:/);
    expect(s).toMatch(/3 WFH days/);
    expect(s).toMatch(/parent-care/);
    expect(s).toMatch(/Whitefield/);
  });
});
