import { describe, it, expect } from "vitest";
import { recommendFocus, resolveFocusDefaults } from "../setupFocus";
import { profileFromRole } from "../roleInterviewMatrix";

const soon = new Set(["Technical Leadership", "Strategic", "Management", "Case Study", "Panel Interview", "Government / PSU"]);
const isComingSoon = (f: string) => soon.has(f);
const rel = (role: string) => new Set<string>(profileFromRole(role).focuses);
const pick = (role: string, extra: { experienceLevel?: string; stage?: string | null } = {}) =>
  recommendFocus({ role, relevant: role ? rel(role) : null, isComingSoon, ...extra }).focus;

describe("recommendFocus", () => {
  it("never recommends a locked focus, whatever the role", () => {
    for (const role of ["Software Engineer", "Product Manager", "Engineering Manager", "Management Consultant", "Data Analyst", "Head of Sales", "IAS Officer"]) {
      expect(isComingSoon(pick(role))).toBe(false);
    }
  });
  it("freshers and students start with campus placement", () => {
    expect(pick("Software Engineer", { experienceLevel: "fresher" })).toBe("Campus Placement");
    expect(pick("Graduate Trainee")).toBe("Campus Placement");
  });
  it("experienced candidates start with behavioral, empty role included", () => {
    expect(pick("Senior Software Engineer")).toBe("Behavioral");
    expect(recommendFocus({ role: "", relevant: null, isComingSoon }).focus).toBe("Behavioral");
  });
  it("an invite to a first round points at the HR screen, later rounds at behavioral", () => {
    expect(pick("Product Manager", { stage: "interview_invited" })).toBe("HR Round");
    expect(pick("Product Manager", { stage: "interviewing" })).toBe("Behavioral");
  });
  it("a fresher invite stays on campus placement", () => {
    expect(pick("Software Engineer Intern", { stage: "interview_invited" })).toBe("Campus Placement");
  });
  it("salary negotiation is only recommended once selected, and never for freshers", () => {
    expect(pick("Senior Product Manager", { stage: "hired" })).toBe("Salary Negotiation");
    expect(pick("Senior Product Manager")).not.toBe("Salary Negotiation");
    expect(pick("Software Engineer Intern", { stage: "hired" })).not.toBe("Salary Negotiation");
  });
  it("skips a stage pick the role filter hides or the flag locks", () => {
    const locked = (f: string) => isComingSoon(f) || f === "Salary Negotiation";
    const r = recommendFocus({ role: "Senior Product Manager", stage: "hired", relevant: rel("Senior Product Manager"), isComingSoon: locked });
    expect(r.focus).toBe("Behavioral");
  });
  it("falls back to the first open relevant focus when nothing in order is allowed", () => {
    const r = recommendFocus({ role: "x", experienceLevel: "fresher", relevant: new Set(["Technical Leadership", "Panel Interview", "Case Study", "Management"]), isComingSoon: () => false });
    expect(r.focus).toBe("Technical Leadership");
  });
  it("always gives a reason for the live focuses", () => {
    expect(pick("Software Engineer")).toBeTruthy();
    expect(recommendFocus({ role: "Product Manager", stage: "interview_invited", relevant: null, isComingSoon }).reason).toMatch(/HR screen/);
  });
});

describe("resolveFocusDefaults", () => {
  it("badge and default agree", () => {
    const r = resolveFocusDefaults({ role: "", experienceLevel: "fresher", relevant: null, isComingSoon });
    expect(r.recommended).toBe("Campus Placement");
    expect(r.defaultFocus).toBe(r.recommended);
    expect(r.reason).toMatch(/first-job/);
  });
});
