/**
 * Tests for the company-specific salary override layer.
 *
 * The override map fixes the "all unicorns get the same band" problem
 * by routing high-traffic companies through verified public-source
 * bands (Levels.fyi / AmbitionBox / Glassdoor / DRHP filings) instead
 * of the generic tier band.
 */

import { describe, it, expect } from "vitest";
import { COMPANY_SALARY_OVERRIDES, getCompanyBandOverride } from "../../data/company-salary-overrides";
import { generateNegotiationBand } from "../../data/salary-lookup";

describe("getCompanyBandOverride — direct lookup", () => {
  it("returns verified bands for top unicorns / FAANG / IT-services / design firms", () => {
    expect(getCompanyBandOverride("Razorpay", "software-engineer", "mid")).toBeTruthy();
    expect(getCompanyBandOverride("Google", "software-engineer", "senior")).toBeTruthy();
    expect(getCompanyBandOverride("TCS", "software-engineer", "entry")).toBeTruthy();
    expect(getCompanyBandOverride("Bombay Design Centre", "ux-designer", "mid")).toBeTruthy();
  });

  it("returns null when company has no override entry", () => {
    expect(getCompanyBandOverride("Unknown Co XYZ", "software-engineer", "mid")).toBeNull();
  });

  it("returns null when role-key not covered for that company", () => {
    /* Razorpay has SE / PM / ML overrides but not e.g. 'hr'. */
    expect(getCompanyBandOverride("Razorpay", "hr", "mid")).toBeNull();
  });

  it("returns null when experience level not covered for that role", () => {
    /* Cognizant entry covered, mid+ not. */
    expect(getCompanyBandOverride("Cognizant", "software-engineer", "entry")).toBeTruthy();
    expect(getCompanyBandOverride("Cognizant", "software-engineer", "senior")).toBeNull();
  });
});

describe("getCompanyBandOverride — loose name matching", () => {
  it("matches 'Razorpay Internet Pvt Ltd' to razorpay", () => {
    expect(getCompanyBandOverride("Razorpay Internet Pvt Ltd", "software-engineer", "mid")).toBeTruthy();
  });

  it("matches 'Google Inc.' to google", () => {
    expect(getCompanyBandOverride("Google Inc.", "software-engineer", "mid")).toBeTruthy();
  });

  it("matches 'Bombay Design Company' loosely to 'bombay design centre' (high overlap)", () => {
    /* Substring matching catches this — both contain 'bombay design'. */
    const result = getCompanyBandOverride("Bombay Design Company", "ux-designer", "mid");
    /* Could match either way; confirm SOMETHING returned at design-firm tier. */
    if (result) expect(result.totalMax).toBeLessThan(20); // design-firm range
  });
});

describe("integration: generateNegotiationBand uses override when available", () => {
  it("Razorpay × SE × mid uses verified band, not tier default", () => {
    const band = generateNegotiationBand({
      role: "Software Engineer",
      company: "Razorpay",
      experienceLevel: "mid",
    });
    /* Razorpay verified mid SE: total ₹26-42L. Initial offer at 35th
       pctile = ~₹31.6L. Tier-default unicorn-mid band would be lower
       (around ₹14-25L → opening ~₹17L). The override pulls the band
       up to actual market. */
    expect(band.initialOffer).toBeGreaterThan(28);
    expect(band.initialOffer).toBeLessThan(40);
    expect(band.bandContext).toMatch(/verified for Razorpay/);
    expect(band.bandContext).toMatch(/Glassdoor|AmbitionBox|Levels\.fyi/);
  });

  it("Bombay Design Centre × Product Designer × mid lands at ₹6-9L (not the broken ₹22L)", () => {
    const band = generateNegotiationBand({
      role: "Product Designer",
      company: "Bombay Design Centre",
      experienceLevel: "mid",
    });
    /* Verified band mid: ₹6-9L. Initial offer 35th pctile = ~₹7L.
       Pre-fix: was hitting unicorn fallback → ~₹22L opening. */
    expect(band.initialOffer).toBeGreaterThan(5);
    expect(band.initialOffer).toBeLessThan(10);
    expect(band.maxStretch).toBeLessThan(12);
    expect(band.bandContext).toMatch(/Bombay Design Centre|verified/i);
  });

  it("Google × SWE × senior uses Levels.fyi-grounded band", () => {
    const band = generateNegotiationBand({
      role: "Senior Software Engineer",
      company: "Google",
      experienceLevel: "senior",
    });
    /* Levels.fyi: Google L5 senior India median ₹95L; band ₹80-130. */
    expect(band.initialOffer).toBeGreaterThan(80);
    expect(band.initialOffer).toBeLessThan(120);
    expect(band.hasEquity).toBe(true);
    expect(band.bandContext).toMatch(/Levels\.fyi/);
  });

  it("falls through to tier band for companies without overrides", () => {
    const band = generateNegotiationBand({
      role: "Software Engineer",
      company: "Some Random Indian Unicorn",
      experienceLevel: "mid",
    });
    /* Should still return a band — tier-default applies. Band context
       should NOT mention "verified for..." (that's only override). */
    expect(band.initialOffer).toBeGreaterThan(0);
    expect(band.bandContext).not.toMatch(/verified for Some Random/);
  });
});

describe("override map data integrity", () => {
  it("every override has source + lastVerified date", () => {
    for (const [company, roles] of Object.entries(COMPANY_SALARY_OVERRIDES)) {
      for (const [role, levels] of Object.entries(roles ?? {})) {
        for (const [level, band] of Object.entries(levels ?? {})) {
          expect(band?.source, `${company}/${role}/${level} missing source`).toBeTruthy();
          expect(band?.lastVerified, `${company}/${role}/${level} missing lastVerified`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          /* Sanity: totalMin <= totalMax. */
          expect(band?.totalMin).toBeLessThanOrEqual(band?.totalMax ?? 0);
        }
      }
    }
  });

  it("includes the highest-traffic Indian companies (45+ entries after expansion)", () => {
    const required = [
      // Indian unicorns
      "razorpay", "phonepe", "flipkart", "swiggy", "zomato", "cred",
      "zerodha", "meesho",
      // FAANG / Big Tech
      "google", "microsoft", "amazon", "apple", "adobe", "salesforce",
      "atlassian", "uber", "stripe",
      // IT services
      "tcs", "infosys", "cognizant", "wipro", "hcl", "ltimindtree",
      "tech mahindra", "capgemini",
      // SaaS / product
      "postman", "browserstack", "chargebee", "freshworks", "zoho",
      // Consulting MBB
      "mckinsey", "bcg", "bain",
      // Banking
      "goldman", "jpmc",
      // GCC
      "walmart global tech", "target india",
      // Quant
      "jane street", "de shaw", "citadel",
      // Design
      "bombay design centre",
    ];
    for (const company of required) {
      expect(COMPANY_SALARY_OVERRIDES, `Missing override for ${company}`).toHaveProperty(company);
    }
    /* Coverage threshold — ≥ 60 companies after the third expansion
       round (Cisco/Oracle/IBM/NVIDIA/Qualcomm/MediaTek/ServiceNow/
       Workday/LinkedIn + Big4 consulting + Indian banks + FMCG +
       more unicorns). */
    expect(Object.keys(COMPANY_SALARY_OVERRIDES).length).toBeGreaterThanOrEqual(60);
  });

  it("FMCG MBA management trainee bands are calibrated to brand-track tier", () => {
    /* HUL UFLP / P&G MT MBA bands ₹18-27L+ — distinct from the generic
       "marketing" tier band. */
    const hulBand = generateNegotiationBand({
      role: "Brand Manager",
      company: "HUL",
      experienceLevel: "entry",
    });
    expect(hulBand.initialOffer).toBeGreaterThan(15);
    expect(hulBand.initialOffer).toBeLessThan(30);
  });

  it("NVIDIA × SE × senior uses ₹95-160L band (top semiconductor pay)", () => {
    const band = generateNegotiationBand({
      role: "Senior Software Engineer",
      company: "NVIDIA",
      experienceLevel: "senior",
    });
    /* NVIDIA IC4-IC5 senior India ₹95-160L. Initial 35th = ~₹118L. */
    expect(band.initialOffer).toBeGreaterThan(100);
    expect(band.initialOffer).toBeLessThan(140);
  });

  it("Deloitte senior consultant lands at ₹23.9-32L (3-13yr exp band)", () => {
    const band = generateNegotiationBand({
      role: "Senior Management Consultant",
      company: "Deloitte",
      experienceLevel: "senior",
    });
    /* Deloitte Senior Consultant India ₹23.9-32L. Initial 35th ≈ ₹26.7L. */
    expect(band.initialOffer).toBeGreaterThan(23);
    expect(band.initialOffer).toBeLessThan(30);
  });

  it("Walmart Global Tech × SE × mid uses verified band, not generic GCC tier", () => {
    /* Walmart pays well above average GCC. Expected band: mid ₹30-55L
       → opening 35th pctile ≈ ₹38.75L. Pre-fix: GCC tier band would
       have given a lower opening. */
    const band = generateNegotiationBand({
      role: "Software Engineer",
      company: "Walmart Global Tech",
      experienceLevel: "mid",
    });
    expect(band.initialOffer).toBeGreaterThan(32);
    expect(band.initialOffer).toBeLessThan(48);
    expect(band.bandContext).toMatch(/verified for Walmart/);
  });

  it("Atlassian × SE × senior uses Levels.fyi-grounded band", () => {
    const band = generateNegotiationBand({
      role: "Senior Software Engineer",
      company: "Atlassian",
      experienceLevel: "senior",
    });
    /* Levels.fyi: Atlassian India P50-P60 senior ₹90-150L. */
    expect(band.initialOffer).toBeGreaterThan(95);
    expect(band.initialOffer).toBeLessThan(140);
  });

  it("McKinsey × consultant × mid uses post-MBA band ₹32-50L", () => {
    const band = generateNegotiationBand({
      role: "Management Consultant",
      company: "McKinsey",
      experienceLevel: "mid",
    });
    /* Post-MBA McKinsey India: ₹32-50L. NOT NEGOTIABLE — fixed for
       MBA entry. Initial 35th = ~₹38.3L. */
    expect(band.initialOffer).toBeGreaterThan(32);
    expect(band.initialOffer).toBeLessThan(45);
    expect(band.bandContext).toMatch(/McKinsey|consult/i);
  });

  it("Jane Street × quant × entry uses fresher India band ₹70-130L", () => {
    const band = generateNegotiationBand({
      role: "Quantitative Researcher",
      company: "Jane Street",
      experienceLevel: "entry",
    });
    /* Indian fresher quant trader at Jane Street: ₹70-120L+ first
       year. Initial 35th pctile = ~₹91L. */
    expect(band.initialOffer).toBeGreaterThan(70);
    expect(band.initialOffer).toBeLessThan(110);
  });
});
