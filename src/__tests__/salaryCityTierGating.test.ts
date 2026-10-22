import { describe, it, expect } from "vitest";
import { generateNegotiationBand, lookupSalaryContext } from "../../data/salary-lookup";
import { companyTierUsesCityComp, companyUsesCityComp } from "../../data/company-tiers";

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

  it("returns false for MBB / Big-4 / PSU / global BFSI (Phase 4 expansion)", () => {
    expect(companyTierUsesCityComp("consulting-mbb")).toBe(false);
    expect(companyTierUsesCityComp("consulting-big4")).toBe(false);
    expect(companyTierUsesCityComp("government-psu")).toBe(false);
    expect(companyTierUsesCityComp("bfsi-global")).toBe(false);
  });
});

describe("companyUsesCityComp — per-company overrides", () => {
  it("Zoho overrides saas-product geo-varying default to nationwide-uniform", () => {
    expect(companyTierUsesCityComp("saas-product")).toBe(true);
    expect(companyUsesCityComp("Zoho", "saas-product")).toBe(false);
    expect(companyUsesCityComp("zoho", "saas-product")).toBe(false);
    expect(companyUsesCityComp("  Zoho  ", "saas-product")).toBe(false);
  });

  it("Freshworks overrides saas-product to nationwide-uniform", () => {
    expect(companyUsesCityComp("Freshworks", "saas-product")).toBe(false);
  });

  it("falls through to tier default when no per-company override", () => {
    expect(companyUsesCityComp("Razorpay", "indian-unicorn")).toBe(true);
    expect(companyUsesCityComp("Microsoft", "faang")).toBe(false);
    expect(companyUsesCityComp(null, "indian-unicorn")).toBe(true);
    expect(companyUsesCityComp(undefined, "faang")).toBe(false);
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

describe("seed→AB flip — engineering-track entry/mid", () => {
  it("Accenture SDE entry: pass-2 yoe-bucket AB beats seed-multiplier curator at n>=150", () => {
    // Seed curator put Accenture SDE entry at ~₹10.5L (1.05x baseline);
    // AB pass-2 0-1y bucket has the real ~₹4.4L fresher cohort. The
    // looser n≥150 threshold for engineering-track entry/mid IT-services
    // should flip the runtime to AB. Reality is ~₹4.5-6L (Accenture
    // fresher disclosure).
    const ctx = lookupSalaryContext({
      role: "Software Engineer",
      company: "Accenture",
      experienceLevel: "entry",
    });
    // The flipped band's source URL points to AB, not "Seed dataset".
    expect(ctx).toMatch(/ambitionbox\.com/i);
    expect(ctx).not.toMatch(/Seed dataset.*accenture.*software-engineer/);
  });

  it("Phase 6: Accenture SE lead flips to AB (it-services engineering lead w/ pass-2)", () => {
    // Seed curator puts Accenture SDE lead at ~₹60L via 0.62x multiplier
    // of a ₹100L baseline. AB pass-2 "Senior SE 9-12y" cohort puts it
    // at ~₹15-16L, matching realized comp for tenured IT-services SDEs.
    const ctx = lookupSalaryContext({
      role: "Software Engineer",
      company: "Accenture",
      experienceLevel: "lead",
    });
    expect(ctx).toMatch(/ambitionbox\.com/i);
  });

  it("Phase 6: Wipro PM lead flips to AB (it-services PM/BA/QA seniorTrack)", () => {
    const ctx = lookupSalaryContext({
      role: "Project Manager",
      company: "Wipro",
      experienceLevel: "lead",
    });
    expect(ctx).toMatch(/ambitionbox\.com/i);
  });

  it("Phase 6: HCL PM executive flips to AB", () => {
    const ctx = lookupSalaryContext({
      role: "Project Manager",
      company: "HCL",
      experienceLevel: "executive",
    });
    expect(ctx).toMatch(/ambitionbox\.com/i);
  });

  it("Phase 6: HDFC Bank BA lead flips to AB (bfsi-domestic non-eng senior track)", () => {
    const ctx = lookupSalaryContext({
      role: "Business Analyst",
      company: "HDFC Bank",
      experienceLevel: "lead",
    });
    expect(ctx).toMatch(/ambitionbox\.com/i);
  });

  it("Phase 6: Paytm PM mid flips to AB (indian-unicorn PM/BA seed-flip)", () => {
    const ctx = lookupSalaryContext({
      role: "Product Manager",
      company: "Paytm",
      experienceLevel: "mid",
    });
    expect(ctx).toMatch(/ambitionbox\.com/i);
  });

  it("Phase 6: Zomato PM mid flips to AB even on pass-1 (regardless-flip set)", () => {
    const ctx = lookupSalaryContext({
      role: "Product Manager",
      company: "Zomato",
      experienceLevel: "mid",
    });
    expect(ctx).toMatch(/ambitionbox\.com/i);
  });

  it("Phase 6: Meesho BA entry KEEPS curator (n=31 below 50-floor)", () => {
    // Validates the audit/runtime alignment fix — n<50 means we don't
    // flip even though the company is on the unicorn flip list.
    const ctx = lookupSalaryContext({
      role: "Business Analyst",
      company: "Meesho",
      experienceLevel: "entry",
    });
    // Curator (Seed dataset) wins; not AB.
    expect(ctx).not.toMatch(/ambitionbox\.com\/salaries\/meesho/i);
  });

  it("Phase 6: JPMC tier-classification fix — bfsi-global keep-curator path", () => {
    // Before the fix, getCompanyTier("jpmc") returned null and the
    // bfsi-global undercount-protection rule never fired. Now JPMC
    // resolves to bfsi-global; SE senior keeps the Glassdoor curator.
    const ctx = lookupSalaryContext({
      role: "Software Engineer",
      company: "JPMC",
      experienceLevel: "senior",
    });
    expect(ctx).toMatch(/Glassdoor|JPMC/);
  });

  it("Accenture business-analyst entry: still keeps curator (loose threshold gates by role)", () => {
    // Engineering-track gate excludes business-analyst — AB cohort for
    // BA at IT-services skews mid-career retitlings, not real freshers.
    // Curator (even seed-multiplier) stays in.
    const ctx = lookupSalaryContext({
      role: "Business Analyst",
      company: "Accenture",
      experienceLevel: "entry",
    });
    expect(ctx).toMatch(/Seed dataset|Accenture/);
  });
});

describe("lookupSalaryContext — sample-size confidence", () => {
  it("surfaces n=count + tier label when an AB-imported override is in effect", () => {
    // Accenture SE entry flips to AB-imported (n=5192). Confirms the
    // Sample line surfaces real scrape sample size when flip fires.
    const ctx = lookupSalaryContext({
      role: "Software Engineer",
      company: "Accenture",
      experienceLevel: "entry",
    });
    expect(ctx).toMatch(/Sample: [\d,]+ self-reports/);
    expect(ctx).toMatch(/low-confidence|medium-confidence|high-confidence/);
  });

  it("emits no Sample line when no override is matched (curator-only path)", () => {
    // ONGC senior comes from PSU curator entry without embedded n=.
    const ctx = lookupSalaryContext({
      role: "Manager",
      company: "ONGC",
      experienceLevel: "senior",
    });
    expect(ctx).not.toMatch(/Sample: \d+ self-reports/);
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
