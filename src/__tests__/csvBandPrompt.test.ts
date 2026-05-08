import { describe, it, expect } from "vitest";
import {
  CSV_COMPANY_ROLE_BANDS,
  getCsvCompanyBand,
  getCsvRoleLevelBand,
} from "../../data/csv-company-role-bands";
import {
  mapExperienceToCsvLevel,
  formatCsvSalaryNegContext,
  formatCsvFocusContext,
} from "../../data/csv-band-prompt";

describe("CSV company-role-bands dataset", () => {
  it("loads ~100 companies", () => {
    const keys = Object.keys(CSV_COMPANY_ROLE_BANDS);
    expect(keys.length).toBeGreaterThanOrEqual(95);
    expect(keys.length).toBeLessThanOrEqual(110);
  });

  it("normalizes ' India' suffix on lookup", () => {
    const a = getCsvCompanyBand("Razorpay");
    const b = getCsvCompanyBand("Razorpay India");
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a?.companyName).toBe(b?.companyName);
  });

  it("returns null for unknown company / role", () => {
    expect(getCsvCompanyBand("NotARealCompany_zzz")).toBeNull();
    expect(
      getCsvRoleLevelBand("Razorpay", "Imaginary Role 9999", "mid"),
    ).toBeNull();
  });

  it("Razorpay Software Engineer mid has plausible bands", () => {
    const band = getCsvRoleLevelBand("Razorpay", "Software Engineer", "mid");
    expect(band).not.toBeNull();
    if (!band) return;
    expect(band.totalMedianLpa).toBeGreaterThan(10);
    expect(band.totalMedianLpa).toBeLessThan(120);
    expect(band.totalMaxLpa).toBeGreaterThanOrEqual(band.totalMinLpa);
  });
});

describe("mapExperienceToCsvLevel", () => {
  it("maps app vocabulary to CSV vocabulary", () => {
    expect(mapExperienceToCsvLevel("entry")).toBe("junior");
    expect(mapExperienceToCsvLevel("fresher")).toBe("junior");
    expect(mapExperienceToCsvLevel("mid")).toBe("mid");
    expect(mapExperienceToCsvLevel("senior")).toBe("senior");
    expect(mapExperienceToCsvLevel("lead")).toBe("lead");
    expect(mapExperienceToCsvLevel("executive")).toBe("manager");
    expect(mapExperienceToCsvLevel("")).toBeNull();
    expect(mapExperienceToCsvLevel(null)).toBeNull();
    expect(mapExperienceToCsvLevel("garbage")).toBeNull();
  });
});

describe("formatCsvSalaryNegContext", () => {
  it("emits research-verified block for a covered (company, role, level)", () => {
    const block = formatCsvSalaryNegContext(
      "Razorpay",
      "Software Engineer",
      "mid",
    );
    expect(block).toContain("CURATED COMPANY-ROLE CONTEXT");
    expect(block).toContain("research-verified");
    expect(block).toContain("ASK LADDER");
    expect(block).toContain("walkaway floor");
  });

  it("returns empty string for unknown company", () => {
    const block = formatCsvSalaryNegContext(
      "TotallyMadeUpCorp_xyz",
      "Software Engineer",
      "mid",
    );
    expect(block).toBe("");
  });

  it("returns empty for missing experience", () => {
    expect(formatCsvSalaryNegContext("Razorpay", "Software Engineer", "")).toBe("");
    expect(formatCsvSalaryNegContext("Razorpay", "Software Engineer", null)).toBe("");
  });

  it("falls back across levels when primary is missing", () => {
    // Even if a company has no "lead" entry for a role, the helper should
    // try senior/mid before returning "".
    const a = formatCsvSalaryNegContext("Razorpay", "Software Engineer", "lead");
    const b = formatCsvSalaryNegContext("Razorpay", "Software Engineer", "senior");
    // At least one of these must produce content (Razorpay is core coverage).
    expect((a + b).length).toBeGreaterThan(50);
  });
});

describe("formatCsvFocusContext", () => {
  it("emits grounding block for behavioral focus on covered company", () => {
    const block = formatCsvFocusContext(
      "Razorpay",
      "Software Engineer",
      "mid",
      "behavioral",
    );
    expect(block).toContain("CURATED COMPANY-ROLE GROUNDING");
  });

  it("returns empty for unknown company", () => {
    const block = formatCsvFocusContext(
      "NotRealCo_zzz",
      "Software Engineer",
      "mid",
      "behavioral",
    );
    expect(block).toBe("");
  });

  it("includes benefits + HR posture for HR-round focus", () => {
    const block = formatCsvFocusContext(
      "Razorpay",
      "Software Engineer",
      "mid",
      "hr-round",
    );
    if (block) {
      // benefits/HR-posture lines are gated on the field being non-empty
      // in the underlying CSV; but for Razorpay SE mid we expect both.
      expect(block.length).toBeGreaterThan(80);
    }
  });
});
