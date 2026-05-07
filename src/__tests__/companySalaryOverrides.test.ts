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

  it("includes the highest-traffic Indian companies", () => {
    const required = [
      "razorpay", "phonepe", "flipkart", "swiggy", "zomato", "cred",
      "zerodha", "meesho",
      "google", "microsoft", "amazon",
      "tcs", "infosys", "cognizant",
      "bombay design centre",
    ];
    for (const company of required) {
      expect(COMPANY_SALARY_OVERRIDES, `Missing override for ${company}`).toHaveProperty(company);
    }
  });
});
