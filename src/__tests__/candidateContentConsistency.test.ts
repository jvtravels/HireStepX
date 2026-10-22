import { describe, it, expect } from "vitest";
import { computePracticeCoverage } from "../dashboardData";
import { practiceCoverageStatus } from "../practiceCoverageStatus";
import { computeATSScore } from "../resumeAts";
import { planUsageLabels } from "../planCardCopy";
import { atCompany } from "../sessionReport/roleLabel";

describe("practiceCoverageStatus", () => {
  it("maps counts to one shared label vocabulary", () => {
    expect(practiceCoverageStatus({ practicedCount: 0, totalAreas: 5 })).toEqual({ status: "not_started", label: "Not started" });
    expect(practiceCoverageStatus({ practicedCount: 3, totalAreas: 5 }).label).toBe("In progress");
    expect(practiceCoverageStatus({ practicedCount: 5, totalAreas: 5 }).label).toBe("Complete");
  });

  it("agrees with computePracticeCoverage output", () => {
    const skills = ["communication", "structure", "technicalDepth", "leadership", "problemSolving"].map(name => ({ name, score: 70, prev: 60 }));
    // SkillData shape is wider than this; only name/score matter to the helper.
    const cov = computePracticeCoverage(skills as unknown as Parameters<typeof computePracticeCoverage>[0]);
    expect(cov.practicedCount).toBe(5);
    expect(practiceCoverageStatus(cov).status).toBe("complete");
    expect(practiceCoverageStatus(computePracticeCoverage([])).status).toBe("not_started");
  });
});

describe("computeATSScore missing sections", () => {
  const flat = "Jane Doe jane@x.com Experience Acme Corp Software Engineer built and led things for 3 years Education BTech Skills React";

  it("lists missing sections without a doubled 'Missing:' prefix", () => {
    const res = computeATSScore("hello world");
    expect(res.missing.some(m => m.startsWith("Missing:"))).toBe(false);
    expect(res.missing).toContain("Work Experience section");
  });

  it("trusts structured experience when flattened text hides the heading", () => {
    expect(computeATSScore(flat).missing).toContain("Work Experience section");
    expect(computeATSScore(flat, undefined, { experience: true }).missing).not.toContain("Work Experience section");
    expect(computeATSScore(flat, undefined, { experience: true }).found).toContain("Work Experience");
  });
});

describe("planUsageLabels", () => {
  it("names plan allowance and purchased credits as separate pieces", () => {
    expect(planUsageLabels(false)).toEqual({ allowance: "Plan sessions used", credits: "Purchased sessions left" });
    expect(planUsageLabels(true).allowance).toBe("Pack sessions used");
  });
});

describe("atCompany", () => {
  it("omits the clause when there is no company", () => {
    expect(atCompany("")).toBe("");
    expect(atCompany(undefined)).toBe("");
    expect(atCompany("  ")).toBe("");
    expect(atCompany("Razorpay")).toBe(" at Razorpay");
  });
});
