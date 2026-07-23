import { describe, it, expect } from "vitest";
import {
  getConcessionMultiplier,
  getWalkAwayThresholdMultiplier,
  inferMarketMode,
  inferCompanyMode,
  type CompanyMode,
} from "../../server-handlers/_market-mode";

describe("_market-mode — concession multiplier", () => {
  it("soft = 0.85×", () => {
    expect(getConcessionMultiplier("soft")).toBe(0.85);
  });
  it("neutral = 1.0× (legacy default)", () => {
    expect(getConcessionMultiplier("neutral")).toBe(1.0);
  });
  it("hot = 1.10×", () => {
    expect(getConcessionMultiplier("hot")).toBe(1.10);
  });
  it("undefined / null fall back to neutral 1.0×", () => {
    expect(getConcessionMultiplier(undefined)).toBe(1.0);
    expect(getConcessionMultiplier(null)).toBe(1.0);
  });
});

describe("_market-mode — walk-away threshold multiplier", () => {
  it("soft pulls walk-away up (1.05×)", () => {
    expect(getWalkAwayThresholdMultiplier("soft")).toBe(1.05);
  });
  it("hot pushes walk-away down (0.95×)", () => {
    expect(getWalkAwayThresholdMultiplier("hot")).toBe(0.95);
  });
  it("neutral = 1.0×", () => {
    expect(getWalkAwayThresholdMultiplier("neutral")).toBe(1.0);
  });
});

describe("_market-mode — inferMarketMode", () => {
  it("engineering + IT-services → soft", () => {
    expect(inferMarketMode({ roleFamily: "engineering", sector: "it-services" })).toBe("soft");
  });

  it("engineering + GCC → neutral", () => {
    expect(inferMarketMode({ roleFamily: "engineering", sector: "gcc" })).toBe("neutral");
  });

  it("AI/ML role forces hot regardless of sector", () => {
    expect(inferMarketMode({ roleFamily: "engineering", sector: "it-services", role: "Senior ML Engineer" })).toBe("hot");
    expect(inferMarketMode({ role: "Data Scientist" })).toBe("hot");
    expect(inferMarketMode({ role: "Generative AI Engineer", sector: "startup" })).toBe("hot");
  });

  it("data role-family forces hot", () => {
    expect(inferMarketMode({ roleFamily: "data", sector: "bfsi" })).toBe("hot");
  });

  it("sales + early-stage / startup → soft (funding winter)", () => {
    expect(inferMarketMode({ roleFamily: "sales", sector: "startup" })).toBe("soft");
    expect(inferMarketMode({ roleFamily: "sales", sector: "seed-stage" })).toBe("soft");
  });

  it("unknown sector falls back to neutral", () => {
    expect(inferMarketMode({ roleFamily: "marketing", sector: "unknown" })).toBe("neutral");
    expect(inferMarketMode({})).toBe("neutral");
  });

  it("yearMonth is accepted but does not break defaults", () => {
    expect(inferMarketMode({ yearMonth: "2026-05" })).toBe("neutral");
  });
});

describe("_market-mode — inferCompanyMode (ITEM 2)", () => {
  /* Five companies covering each mode bucket. */
  it("HDFC Bank → BFSI", () => {
    expect(inferCompanyMode("swe", "HDFC Bank")).toBe<CompanyMode>("BFSI");
  });

  it("JP Morgan GCC → GCC", () => {
    expect(inferCompanyMode("software engineer", "JPMorgan")).toBe<CompanyMode>("GCC");
  });

  it("Razorpay (Indian startup) → STARTUP", () => {
    expect(inferCompanyMode("backend engineer", "Razorpay")).toBe<CompanyMode>("STARTUP");
  });

  it("Google → MNC", () => {
    expect(inferCompanyMode("swe", "Google")).toBe<CompanyMode>("MNC");
  });

  it("Infosys → IT_SERVICES", () => {
    expect(inferCompanyMode("java developer", "Infosys")).toBe<CompanyMode>("IT_SERVICES");
  });

  it("unknown company defaults to IT_SERVICES", () => {
    expect(inferCompanyMode("developer", "AcmeCorp Unknown Ltd")).toBe<CompanyMode>("IT_SERVICES");
  });

  it("Wells Fargo India (GCC) → GCC", () => {
    expect(inferCompanyMode("data analyst", "Wells Fargo")).toBe<CompanyMode>("GCC");
  });

  it("role with 'series b' → STARTUP regardless of company name", () => {
    expect(inferCompanyMode("series b startup engineer", "Unknown Startup")).toBe<CompanyMode>("STARTUP");
  });

  /* S53-B3/S52-WL-B2 (2026-07-24): consulting firms and extended GCC companies
   * were falling through to IT_SERVICES → "soft" market. Both should be neutral. */
  it("McKinsey → CONSULTING (not IT_SERVICES)", () => {
    expect(inferCompanyMode("management consultant", "McKinsey")).toBe<CompanyMode>("CONSULTING");
    expect(inferCompanyMode("associate", "BCG")).toBe<CompanyMode>("CONSULTING");
    expect(inferCompanyMode("analyst", "Deloitte")).toBe<CompanyMode>("CONSULTING");
    expect(inferCompanyMode("senior consultant", "Accenture")).toBe<CompanyMode>("CONSULTING");
    expect(inferCompanyMode("consultant", "KPMG")).toBe<CompanyMode>("CONSULTING");
  });

  it("Walmart Labs / Adobe / Cisco → GCC (not IT_SERVICES)", () => {
    expect(inferCompanyMode("software engineer", "Walmart Labs")).toBe<CompanyMode>("GCC");
    expect(inferCompanyMode("product manager", "Adobe India")).toBe<CompanyMode>("GCC");
    expect(inferCompanyMode("backend engineer", "Cisco Systems")).toBe<CompanyMode>("GCC");
    expect(inferCompanyMode("data analyst", "Mastercard")).toBe<CompanyMode>("GCC");
  });
});
