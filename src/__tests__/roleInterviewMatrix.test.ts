/* Role → Interview-focus matrix sanity tests. The full matrix has too
   many cells to enumerate; these spot-check the highest-frequency role
   strings and the obvious-wrong combinations the user complained
   about (junior roles seeing Strategic; CS reps seeing Tech Leadership;
   etc.). */

import { describe, it, expect } from "vitest";
import {
  inferRoleFamily,
  inferSeniority,
  getRelevantFocuses,
  profileFromRole,
} from "../roleInterviewMatrix";

describe("inferRoleFamily", () => {
  it.each([
    ["Senior Engineering Manager",            "em"],
    ["Engineering Manager",                   "em"],
    ["Tech Lead",                             "em"],
    ["Software Engineer",                     "swe"],
    ["Senior SDE",                            "swe"],
    ["Backend Developer",                     "swe"],
    ["Frontend Engineer",                     "swe"],
    ["Product Manager",                       "pm"],
    ["Senior Product Manager",                "pm"],
    ["APM",                                   "pm"],
    ["Group Product Manager",                 "pm"],
    ["Product Designer",                      "designer"],
    ["UX Researcher",                         "designer"],
    ["Design Manager",                        "designer"],
    ["Data Scientist",                        "data"],
    ["ML Engineer",                           "data"],
    ["Applied Scientist",                     "data"],
    ["DevOps Engineer",                       "devops"],
    ["SRE",                                   "devops"],
    ["Site Reliability Engineer",             "devops"],
    ["QA Engineer",                           "qa"],
    ["SDET",                                  "qa"],
    ["Sales Manager",                         "sales"],
    ["Account Executive",                     "sales"],
    ["Marketing Manager",                     "marketing"],
    ["Performance Marketing Lead",            "marketing"],
    ["Product Marketing Manager",             "marketing"],
    ["Finance Manager",                       "finance"],
    ["Investment Banking Analyst",            "finance"],
    ["Chartered Accountant",                  "finance"],
    ["Strategy Consultant",                   "consulting"],
    ["Associate Consultant at McKinsey",      "consulting"],
    ["Customer Success Manager",              "cs"],
    ["Technical Support",                     "cs"],
    ["HR Business Partner",                   "hr"],
    ["Talent Acquisition",                    "hr"],
    ["Legal Counsel",                         "legal"],
    ["Corporate Lawyer",                      "legal"],
    ["Founder",                               "founder"],
    ["Co-founder",                            "founder"],
    ["CTO",                                   "founder"],
    ["UPSC aspirant",                         "psu"],
    ["Bank PO",                               "psu"],
    ["IAS officer trainee",                   "psu"],
    ["Fresher Software Engineer",             "student"],
    ["Campus placement candidate",            "student"],
    ["Intern",                                "student"],
    ["",                                      "other"],
    ["random unknown role",                   "other"],
  ])("classifies %s as %s", (role, expected) => {
    expect(inferRoleFamily(role)).toBe(expected);
  });

  it("does not misclassify Engineering Manager as SWE", () => {
    expect(inferRoleFamily("Engineering Manager")).toBe("em");
  });

  it("PM beats general 'manager' pattern", () => {
    expect(inferRoleFamily("Product Manager")).toBe("pm");
  });
});

describe("inferSeniority", () => {
  it.each([
    ["Senior Software Engineer",   "senior"],
    ["Sr. Engineer",               "senior"],
    ["Staff Engineer",             "lead"],
    ["Principal Engineer",         "lead"],
    ["Director of Engineering",    "exec"],
    ["VP of Engineering",          "exec"],
    ["Head of Product",            "exec"],
    ["Junior Developer",           "junior"],
    ["Associate Product Manager",  "junior"],
    ["Fresher",                    "fresher"],
    ["Intern",                     "fresher"],
    ["Software Engineer",          "mid"],   // default
    ["",                           "mid"],
  ])("infers seniority of %s as %s", (role, expected) => {
    expect(inferSeniority(role)).toBe(expected);
  });
});

describe("getRelevantFocuses — anti-patterns from bug report", () => {
  it("Junior SDE does NOT get Strategic", () => {
    const focuses = getRelevantFocuses("swe", "junior");
    expect(focuses).not.toContain("Strategic");
  });

  it("Customer Success rep does NOT get Technical Leadership", () => {
    const focuses = getRelevantFocuses("cs", "mid");
    expect(focuses).not.toContain("Technical Leadership");
  });

  it("Senior Engineering Manager does NOT get Campus Placement", () => {
    const focuses = getRelevantFocuses("em", "senior");
    expect(focuses).not.toContain("Campus Placement");
  });

  it("UPSC aspirant gets ONLY PSU-relevant focuses", () => {
    const focuses = getRelevantFocuses("psu", "mid");
    expect(focuses).toContain("Government / PSU");
    expect(focuses).not.toContain("Salary Negotiation");
    expect(focuses).not.toContain("Technical Leadership");
    expect(focuses).not.toContain("Case Study");
  });

  it("Junior SWE gets the working set", () => {
    const focuses = getRelevantFocuses("swe", "junior");
    expect(focuses).toEqual(
      expect.arrayContaining(["Behavioral", "HR Round", "Salary Negotiation"]),
    );
  });

  it("Fresher gets Campus Placement, no Salary Negotiation", () => {
    const focuses = getRelevantFocuses("swe", "fresher");
    expect(focuses).toContain("Campus Placement");
    expect(focuses).not.toContain("Salary Negotiation");
  });

  it("Founder has Strategic but no HR Round", () => {
    const focuses = getRelevantFocuses("founder", "exec");
    expect(focuses).toContain("Strategic");
    expect(focuses).not.toContain("HR Round");
  });

  it("Senior PM gets Case Study + Strategic + Management", () => {
    const focuses = getRelevantFocuses("pm", "senior");
    expect(focuses).toEqual(
      expect.arrayContaining(["Case Study", "Strategic", "Management"]),
    );
  });

  it("Junior PM gets Case Study but not Strategic", () => {
    const focuses = getRelevantFocuses("pm", "junior");
    expect(focuses).toContain("Case Study");
    expect(focuses).not.toContain("Strategic");
  });

  it("Behavioral is universal (except none-PSU)", () => {
    const families = [
      "swe", "em", "pm", "designer", "data", "qa", "devops",
      "sales", "marketing", "finance", "ops", "consulting",
      "cs", "hr", "legal", "founder", "psu", "student",
    ] as const;
    for (const f of families) {
      expect(getRelevantFocuses(f, "mid")).toContain("Behavioral");
    }
  });
});

describe("profileFromRole integration", () => {
  it("produces a complete profile for a typical role", () => {
    const p = profileFromRole("Senior Product Manager");
    expect(p.family).toBe("pm");
    expect(p.seniority).toBe("senior");
    expect(p.focuses).toContain("Behavioral");
    expect(p.focuses).toContain("Case Study");
    expect(p.focuses).toContain("Strategic");
    expect(p.focuses).toContain("Management");
    expect(p.focuses).not.toContain("Campus Placement");
    expect(p.focuses).not.toContain("Government / PSU");
  });

  it("handles empty role", () => {
    const p = profileFromRole("");
    expect(p.family).toBe("other");
    expect(p.seniority).toBe("mid");
    expect(p.focuses).toContain("Behavioral");
  });
});
