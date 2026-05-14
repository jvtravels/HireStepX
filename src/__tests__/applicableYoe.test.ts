import { describe, it, expect } from "vitest";
import {
  computeApplicableYoe,
  experienceLevelFromYoe,
} from "../../server-handlers/_candidate-profile";

describe("experienceLevelFromYoe — bucket mapping", () => {
  it("returns null for null/undefined/NaN", () => {
    expect(experienceLevelFromYoe(null)).toBe(null);
    expect(experienceLevelFromYoe(undefined)).toBe(null);
    expect(experienceLevelFromYoe(Number.NaN)).toBe(null);
  });

  it("0 and 1 map to entry", () => {
    expect(experienceLevelFromYoe(0)).toBe("entry");
    expect(experienceLevelFromYoe(0.5)).toBe("entry");
    expect(experienceLevelFromYoe(1)).toBe("entry");
  });

  it("2-4 map to mid", () => {
    expect(experienceLevelFromYoe(2)).toBe("mid");
    expect(experienceLevelFromYoe(3)).toBe("mid");
    expect(experienceLevelFromYoe(4)).toBe("mid");
  });

  it("5-8 map to senior", () => {
    expect(experienceLevelFromYoe(5)).toBe("senior");
    expect(experienceLevelFromYoe(6)).toBe("senior");
    expect(experienceLevelFromYoe(8)).toBe("senior");
  });

  it("9+ maps to staff", () => {
    expect(experienceLevelFromYoe(9)).toBe("staff");
    expect(experienceLevelFromYoe(12)).toBe("staff");
    expect(experienceLevelFromYoe(20)).toBe("staff");
  });
});

describe("computeApplicableYoe — domain-pivot vs match vs adjacent", () => {
  it("null totalYoe → applicableYoe null, relation 'unknown'", () => {
    const r = computeApplicableYoe({
      totalYoe: null,
      primaryDomain: "Product Designer",
      targetRole: "Java Developer",
    });
    expect(r.applicableYoe).toBe(null);
    expect(r.relation).toBe("unknown");
  });

  it("Senior Product Designer (6y) → Java Developer → pivot, applicableYoe=0", () => {
    const r = computeApplicableYoe({
      totalYoe: 6,
      primaryDomain: "Senior Product Designer",
      targetRole: "Java Developer",
    });
    expect(r.applicableYoe).toBe(0);
    expect(r.relation).toBe("pivot");
  });

  it("Backend engineer (5y) → Backend Developer → match, applicableYoe=totalYoe", () => {
    const r = computeApplicableYoe({
      totalYoe: 5,
      primaryDomain: "Backend Engineer",
      targetRole: "Backend Developer",
    });
    expect(r.applicableYoe).toBe(5);
    expect(r.relation).toBe("match");
  });

  it("Data Scientist (4y) → Data Engineer → adjacent, applicableYoe=totalYoe*0.5", () => {
    const r = computeApplicableYoe({
      totalYoe: 4,
      primaryDomain: "Data Scientist",
      targetRole: "Data Engineer",
    });
    expect(r.relation).toBe("adjacent");
    expect(r.applicableYoe).toBe(2);
  });

  it("unclassifiable domains + domainPivot=true → applicableYoe=0, relation 'pivot'", () => {
    const r = computeApplicableYoe({
      totalYoe: 8,
      primaryDomain: "Astrophysicist",
      targetRole: "Underwater Basket Weaver",
      domainPivot: true,
    });
    expect(r.applicableYoe).toBe(0);
    expect(r.relation).toBe("pivot");
  });

  it("unclassifiable domains → pivot (applicableYoe=0), even with no explicit pivot signal", () => {
    /* Bug-report 14 (2026-05-14) — pre-fix this returned applicableYoe=8
     * with relation="unknown", which let a senior candidate's YoE
     * anchor a senior-tier band for an unrecognised target role. The
     * correct conservative default is pivot — see the long comment in
     * computeApplicableYoe for why band-aiding via keyword additions
     * was the wrong fix for Bug-13 and would have left Bug-14 exposed. */
    const r = computeApplicableYoe({
      totalYoe: 8,
      primaryDomain: "Astrophysicist",
      targetRole: "Underwater Basket Weaver",
    });
    expect(r.applicableYoe).toBe(0);
    expect(r.relation).toBe("pivot");
  });

  it("end-to-end pipeline: Senior Product Designer 6y → Java → entry-level band", () => {
    const r = computeApplicableYoe({
      totalYoe: 6,
      primaryDomain: "Senior Product Designer",
      targetRole: "Java Developer",
    });
    expect(experienceLevelFromYoe(r.applicableYoe)).toBe("entry");
    expect(experienceLevelFromYoe(6)).toBe("senior"); // contrast with raw total
  });
});
