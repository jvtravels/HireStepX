import { describe, it, expect } from "vitest";
import { generateNegotiationBand, lookupSalaryContext } from "../../data/salary-lookup";
import { companyTierUsesCityComp } from "../../data/company-tiers";

/**
 * Regression locks for the tier-gated city multiplier (commit 62ddbcf).
 *
 * Before the fix: tier-2 multiplier (0.86x) applied blanket — a
 * Microsoft Chennai offer was discounted 14% even though FAANG /
 * Big Tech / GCC / IT-services pay nationwide-uniform per the
 * AB recon (docs/SALARY_CITY_RECON.md).
 *
 * After: nationwide-uniform tiers clamp to tier1 internally.
 */

describe("companyTierUsesCityComp", () => {
  it("returns false for nationwide-uniform tiers", () => {
    expect(companyTierUsesCityComp("faang")).toBe(false);
    expect(companyTierUsesCityComp("big-tech")).toBe(false);
    expect(companyTierUsesCityComp("gcc")).toBe(false);
    expect(companyTierUsesCityComp("it-services")).toBe(false);
  });

  it("returns true for geo-varying tiers", () => {
    expect(companyTierUsesCityComp("indian-unicorn")).toBe(true);
    expect(companyTierUsesCityComp("startup-early")).toBe(true);
    expect(companyTierUsesCityComp("startup-growth")).toBe(true);
    expect(companyTierUsesCityComp("saas-product")).toBe(true);
    expect(companyTierUsesCityComp("bfsi-domestic")).toBe(true);
    expect(companyTierUsesCityComp("fmcg-mnc")).toBe(true);
  });

  it("treats null/undefined as geo-varying (conservative default)", () => {
    expect(companyTierUsesCityComp(null)).toBe(true);
    expect(companyTierUsesCityComp(undefined)).toBe(true);
  });
});

describe("generateNegotiationBand — city tier gating", () => {
  it("FAANG mid-level Bangalore vs Chennai produces identical bands (nationwide-uniform)", () => {
    const blr = generateNegotiationBand({
      role: "Software Engineer",
      company: "Microsoft",
      experienceLevel: "mid",
      jobCity: "Bangalore",
    });
    const che = generateNegotiationBand({
      role: "Software Engineer",
      company: "Microsoft",
      experienceLevel: "mid",
      jobCity: "Chennai",
    });
    expect(blr.initialOffer).toBe(che.initialOffer);
    expect(blr.maxStretch).toBe(che.maxStretch);
    expect(blr.walkAway).toBe(che.walkAway);
  });

  it("IT-services Bangalore vs Chennai produces identical bands", () => {
    const blr = generateNegotiationBand({
      role: "Software Engineer",
      company: "TCS",
      experienceLevel: "entry",
      jobCity: "Bangalore",
    });
    const che = generateNegotiationBand({
      role: "Software Engineer",
      company: "TCS",
      experienceLevel: "entry",
      jobCity: "Chennai",
    });
    expect(blr.maxStretch).toBe(che.maxStretch);
    expect(blr.walkAway).toBe(che.walkAway);
  });

  it("Indian-unicorn Bangalore beats Chennai (geo-varying)", () => {
    const blr = generateNegotiationBand({
      role: "Software Engineer",
      company: "Razorpay",
      experienceLevel: "mid",
      jobCity: "Bangalore",
    });
    const che = generateNegotiationBand({
      role: "Software Engineer",
      company: "Razorpay",
      experienceLevel: "mid",
      jobCity: "Chennai",
    });
    // Bangalore (tier1) ≥ Chennai (tier2) for unicorns.
    expect(blr.maxStretch).toBeGreaterThanOrEqual(che.maxStretch);
    expect(blr.walkAway).toBeGreaterThanOrEqual(che.walkAway);
  });
});

describe("lookupSalaryContext — city note", () => {
  it("FAANG in Chennai surfaces nationwide-uniform note (not Tier-1 relabel)", () => {
    const ctx = lookupSalaryContext({
      role: "Software Engineer",
      company: "Microsoft",
      experienceLevel: "mid",
      jobCity: "Chennai",
    });
    // Should mention the real tier and explicitly call out uniform pay.
    expect(ctx).toMatch(/Tier 2 city/);
    expect(ctx).toMatch(/nationwide-uniform/i);
  });

  it("Unicorn in Chennai shows the Tier-2 multiplier band", () => {
    const ctx = lookupSalaryContext({
      role: "Software Engineer",
      company: "Razorpay",
      experienceLevel: "mid",
      jobCity: "Chennai",
    });
    expect(ctx).toMatch(/Tier 2 city/);
    expect(ctx).toMatch(/Tier 1 rates/);
  });
});

describe("generateNegotiationBand — counter-offer playbook (bandContext)", () => {
  it("FAANG bandContext includes 8-15% playbook stretch", () => {
    const band = generateNegotiationBand({
      role: "Software Engineer",
      company: "Google",
      experienceLevel: "senior",
    });
    expect(band.bandContext).toMatch(/COUNTER-OFFER PLAYBOOK/);
    expect(band.bandContext).toMatch(/8-15%/);
  });

  it("IT-services bandContext includes the 3-5% tight playbook", () => {
    const band = generateNegotiationBand({
      role: "Software Engineer",
      company: "TCS",
      experienceLevel: "mid",
    });
    expect(band.bandContext).toMatch(/COUNTER-OFFER PLAYBOOK/);
    expect(band.bandContext).toMatch(/3-5%/);
  });

  it("Unicorn bandContext includes 10-25% room", () => {
    const band = generateNegotiationBand({
      role: "Software Engineer",
      company: "Razorpay",
      experienceLevel: "senior",
    });
    expect(band.bandContext).toMatch(/COUNTER-OFFER PLAYBOOK/);
    expect(band.bandContext).toMatch(/10-25%/);
  });

  it("PSU bandContext explicitly says no counter-offer flex", () => {
    const band = generateNegotiationBand({
      role: "Manager",
      company: "ONGC",
      experienceLevel: "senior",
    });
    expect(band.bandContext).toMatch(/ZERO counter-offer flex|Pay Commission/);
  });
});
