import { describe, it, expect } from "vitest";
import {
  COMPANY_NEGOTIATION_CONTEXT,
  getCompanyNegotiationContext,
  formatCompanyNegotiationContext,
} from "../../data/company-negotiation-context";
import { buildSalaryNegotiationGuidance } from "../../data/salary-lookup";

describe("getCompanyNegotiationContext", () => {
  it("returns context for each curated company (case + suffix tolerant)", () => {
    expect(getCompanyNegotiationContext("Meesho")).toBeTruthy();
    expect(getCompanyNegotiationContext("MYNTRA")).toBeTruthy();
    expect(getCompanyNegotiationContext("Nykaa Inc.")).toBeTruthy();
    expect(getCompanyNegotiationContext("Paytm")).toBeTruthy();
    expect(getCompanyNegotiationContext("Acko General Insurance")).toBeTruthy();
    expect(getCompanyNegotiationContext("Cars24")).toBeTruthy();
  });

  it("returns null for unknown company", () => {
    expect(getCompanyNegotiationContext("Some Random Co XYZ")).toBeNull();
    expect(getCompanyNegotiationContext("")).toBeNull();
    expect(getCompanyNegotiationContext(undefined)).toBeNull();
  });

  it("every entry carries the four load-bearing fields", () => {
    for (const [key, ctx] of Object.entries(COMPANY_NEGOTIATION_CONTEXT)) {
      expect(ctx.liquidityRisk, `${key}.liquidityRisk`).toMatch(/^(low|medium|medium-high|high)$/);
      expect(ctx.candidateShouldAsk.length, `${key}.candidateShouldAsk`).toBeGreaterThan(0);
      expect(ctx.likelyBenefits.length, `${key}.likelyBenefits`).toBeGreaterThan(0);
      expect(ctx.negotiationFocusGrid.length, `${key}.negotiationFocusGrid`).toBeGreaterThan(0);
      // Grid lines must follow "<role> <Junior|Mid|Senior>: <focus>" so the
      // LLM can pattern-match the candidate's role + level.
      for (const line of ctx.negotiationFocusGrid) {
        expect(line, `${key} grid line`).toMatch(/(Junior|Mid|Senior)[^:]*:\s.+/);
      }
    }
  });
});

describe("formatCompanyNegotiationContext", () => {
  it("renders all four sections when context is present", () => {
    const out = formatCompanyNegotiationContext(
      getCompanyNegotiationContext("Acko"),
      "Acko",
    );
    expect(out).toContain("liquidity risk: medium-high");
    expect(out).toContain("Candidate should ask HR");
    expect(out).toContain("Likely benefits");
    expect(out).toContain("Negotiation focus by role");
    expect(out).toContain("Actuarial Analyst");
  });

  it("returns empty string when no context", () => {
    expect(formatCompanyNegotiationContext(null, "Foo")).toBe("");
    expect(formatCompanyNegotiationContext(getCompanyNegotiationContext("Acko"), undefined)).toBe("");
  });
});

describe("buildSalaryNegotiationGuidance — wires curated context into the LLM prompt", () => {
  it("Meesho prompt contains Meesho-specific negotiation grid + ask list", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      company: "Meesho",
      experienceLevel: "mid",
    });
    expect(prompt).toContain("COMPANY-SPECIFIC NEGOTIATION CONTEXT for Meesho");
    expect(prompt).toContain("Software Engineer Mid: Fixed + ESOP clarity");
    expect(prompt).toContain("ESOP strike price vs current FMV");
  });

  it("Cars24 prompt surfaces dealer-relations + inspection-engineer grid", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Operations Manager",
      company: "Cars24",
      experienceLevel: "senior",
    });
    expect(prompt).toContain("Operations Manager Senior: Team ownership");
    expect(prompt).toContain("Inspection Engineer");
    expect(prompt).toContain("Dealer Relations");
  });

  it("falls back gracefully (no curated block) for unknown companies", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      company: "Unknown Co XYZ",
      experienceLevel: "mid",
    });
    expect(prompt).not.toContain("COMPANY-SPECIFIC NEGOTIATION CONTEXT");
  });
});
