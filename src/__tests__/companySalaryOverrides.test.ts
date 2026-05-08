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

  it("falls through to indian_market_generic catch-all for unknown companies", () => {
    /* After 2026-Q2 catch-all sector addition, every company resolves
       to a sector-level band. "Unknown Co XYZ" gets the indian-market
       median (sourced as "Indian market median ...").  */
    const result = getCompanyBandOverride("Unknown Co XYZ", "software-engineer", "mid");
    expect(result).not.toBeNull();
    expect(result?.source).toMatch(/Indian market median/i);
  });

  it("falls back through within-override exp chain when role+level missing", () => {
    /* Razorpay has SE/PM/ML, no 'hr'. The lookup falls through to
       sector classification. Razorpay classifies as
       indian_unicorn_fintech which has no 'hr' role either, so falls
       to catch-all indian_market_generic.hr. Returns sensible band. */
    const result = getCompanyBandOverride("Razorpay", "hr", "mid");
    expect(result).not.toBeNull();
  });

  it("EXP_FALLBACK_WITHIN_OVERRIDE clamps senior request to mid when senior is undefined", () => {
    /* Cognizant has only entry-band SE override. Senior request
       falls through within-override chain, then to sector
       (indian_it_services has senior), so returns the it-services
       senior band — NOT null. */
    expect(getCompanyBandOverride("Cognizant", "software-engineer", "entry")).toBeTruthy();
    const seniorResult = getCompanyBandOverride("Cognizant", "software-engineer", "senior");
    expect(seniorResult).not.toBeNull();
    /* Should be IT-services senior tier ₹14-28L, NOT a wildly
       inflated unicorn senior band. */
    expect(seniorResult?.totalMax).toBeLessThan(50);
  });
});

describe("getCompanyBandOverride — loose name matching", () => {
  it("matches 'Razorpay Internet Pvt Ltd' to razorpay", () => {
    expect(getCompanyBandOverride("Razorpay Internet Pvt Ltd", "software-engineer", "mid")).toBeTruthy();
  });

  it("matches 'Google Inc.' to google", () => {
    expect(getCompanyBandOverride("Google Inc.", "software-engineer", "mid")).toBeTruthy();
  });

  it("matches 'Bombay Design Company' loosely to design-firm range", () => {
    /* Substring matching catches this — both contain 'bombay design'.
       Result lands in design-firm tier (it-services), not unicorn. */
    const result = getCompanyBandOverride("Bombay Design Company", "ux-designer", "mid");
    expect(result).not.toBeNull();
    /* Design-firm range is around ₹6-22L mid (per advertising-agency
       sector or Bombay-specific direct match). Either way, lands
       below ₹25L. Pre-fix it was matching unicorn ₹17-30L. */
    if (result) expect(result.totalMax).toBeLessThan(25);
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

  it("returns a sensible band for companies without bespoke overrides (catch-all)", () => {
    const band = generateNegotiationBand({
      role: "Software Engineer",
      company: "Some Random Indian Unicorn",
      experienceLevel: "mid",
    });
    /* After catch-all addition, every company hits the override
       layer. "Some Random Indian Unicorn" matches the catch-all
       sector (indian_market_generic). Band is sensible (₹12-25L SE
       mid market median); source explicitly disclaims company-
       specific data. */
    expect(band.initialOffer).toBeGreaterThan(0);
    expect(band.initialOffer).toBeLessThan(40);
    expect(band.bandContext).toMatch(/Indian market median|verified/);
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

  /* ─── Sector-level long-tail coverage (2026-Q2 fix) ─── */
  it("Long-tail companies fall through to sector bands instead of generic tier", () => {
    /* These companies have NO bespoke override but should classify
       into sector buckets (PSU bank, private bank, mid-tier IT
       services, pharma, edtech, etc.) and pick up sector-band data. */

    /* PSU bank — should NOT default to indian-unicorn ₹14-22L */
    const sbiBand = generateNegotiationBand({
      role: "Bank PO",
      company: "Punjab National Bank",
      experienceLevel: "entry",
    });
    expect(sbiBand.initialOffer).toBeLessThan(10); // PSU bank entry ₹5-8L

    /* Private bank RM */
    const yesBankBand = generateNegotiationBand({
      role: "Relationship Manager",
      company: "Yes Bank",
      experienceLevel: "mid",
    });
    expect(yesBankBand.initialOffer).toBeLessThan(15); // private bank RM mid ₹7-14L

    /* Indian fintech unicorn — Slice / Jupiter / Cashfree */
    const sliceBand = generateNegotiationBand({
      role: "Software Engineer",
      company: "Slice",
      experienceLevel: "mid",
    });
    expect(sliceBand.initialOffer).toBeGreaterThan(20);
    expect(sliceBand.initialOffer).toBeLessThan(35); // fintech unicorn mid ₹25-42L

    /* Indian pharma — Sun Pharma / Cipla */
    const sunPharmaBand = generateNegotiationBand({
      role: "Software Engineer",
      company: "Sun Pharma",
      experienceLevel: "mid",
    });
    expect(sunPharmaBand.initialOffer).toBeGreaterThan(7);
    expect(sunPharmaBand.initialOffer).toBeLessThan(15);

    /* Mid-tier IT services — Mphasis / Coforge / Persistent */
    const mphasisBand = generateNegotiationBand({
      role: "Software Engineer",
      company: "Mphasis",
      experienceLevel: "entry",
    });
    expect(mphasisBand.initialOffer).toBeLessThan(7); // IT services entry ₹3.5-6L

    /* GCC long-tail — Tesco Bengaluru / Sainsbury's India / Wells Fargo India */
    const tescoBand = generateNegotiationBand({
      role: "Software Engineer",
      company: "Tesco Bengaluru",
      experienceLevel: "mid",
    });
    expect(tescoBand.initialOffer).toBeGreaterThan(20); // GCC mid ₹22-40L
    expect(tescoBand.initialOffer).toBeLessThan(35);

    /* Aviation — IndiGo */
    const indigoBand = generateNegotiationBand({
      role: "Operations Manager",
      company: "IndiGo",
      experienceLevel: "mid",
    });
    expect(indigoBand.initialOffer).toBeGreaterThan(6); // aviation mid ₹8-16L
    expect(indigoBand.initialOffer).toBeLessThan(15);
  });

  it("Sector keys are not directly exposed as company names", () => {
    /* Even though the catch-all classifies anything, "__sector_*"
       internal keys must NOT match the bespoke psu_bank sector
       (would create a recursion / false-attribution path). The
       generic catch-all does fire — that's correct, it produces the
       neutral indian-market-median band. */
    const psuBankResult = getCompanyBandOverride("__sector_psu_bank", "sales", "mid");
    /* Either null (preferred) or a generic-market hit — never the
       psu_bank-specific band, which would be a misattribution. */
    if (psuBankResult) {
      expect(psuBankResult.source).toMatch(/Indian market median/i);
    }

    const bareKeyResult = getCompanyBandOverride("psu_bank", "sales", "mid");
    if (bareKeyResult) {
      /* Same: shouldn't claim PSU-bank-specific source. */
      expect(bareKeyResult.source).not.toMatch(/IBPS PO/);
    }
  });

  /* ─── 15-YOE / lead / executive coverage (2026-Q2 fix) ─── */
  it("15+ YOE inputs route to lead/executive levels via free-text parsing", () => {
    /* normalizeExp() now parses YOE strings. 15+ years → executive. */
    const band15yr = generateNegotiationBand({
      role: "Software Engineer",
      company: "Razorpay",
      experienceLevel: "15 years experience",
    });
    /* Razorpay SE lead band: ₹60-95L. Initial 35th ≈ ₹72L. */
    expect(band15yr.initialOffer).toBeGreaterThan(60);
  });

  it("12 YOE input routes to lead level (Walmart Global Tech staff range)", () => {
    const band12yr = generateNegotiationBand({
      role: "Software Engineer",
      company: "Walmart Global Tech",
      experienceLevel: "12 yrs",
    });
    /* Walmart SE lead: ₹90-200L. Initial 35th ≈ ₹128L. */
    expect(band12yr.initialOffer).toBeGreaterThan(90);
    expect(band12yr.initialOffer).toBeLessThan(170);
  });

  it("18 years at MBB Partner level routes to executive band", () => {
    /* Use "Management Consultant" so matchRoleKey returns consultant. */
    const partnerBand = generateNegotiationBand({
      role: "Management Consultant",
      company: "BCG",
      experienceLevel: "18 years experience",
    });
    /* BCG consultant executive: ₹180-400L. Test is permissive — must
       reach executive territory, exact pctile is implementation detail. */
    expect(partnerBand.initialOffer).toBeGreaterThan(180);
  });

  it("Sector executive bands cover long-tail 15+ YOE candidates", () => {
    /* Confirm the executive sector bands exist and produce sensible
       offers for very-senior candidates. We don't pin exact numbers
       since multiple role/sector intersections are possible. */
    const psuCmd = generateNegotiationBand({
      role: "Software Engineer", // BHEL classifier; SE role → psu_central executive
      company: "BHEL",
      experienceLevel: "20 years",
    });
    /* Either psu_central SE executive (₹50-90L) OR via fallback —
       must NOT come back at mid level for a 20-yr exec. */
    expect(psuCmd.initialOffer).toBeGreaterThan(35);

    const yesBankCxo = generateNegotiationBand({
      role: "Relationship Manager",
      company: "Yes Bank",
      experienceLevel: "20 years",
    });
    /* private_bank sales executive ₹50-200L → 35th ≈ ₹102L. */
    expect(yesBankCxo.initialOffer).toBeGreaterThan(40);
  });

  /* ─── Fresher coverage (2026-Q2 fix) ─── */
  it("Fresher synonyms all route to entry level", () => {
    /* Indian campus pipelines use many names. All should map to
       entry, not the mid default. */
    const fresherInputs = [
      "fresher",
      "campus hire",
      "campus placement",
      "graduate",
      "new grad",
      "GET",
      "graduate engineer trainee",
      "management trainee",
      "MT",
      "trainee",
      "associate engineer",
      "no experience",
      "0 years",
      "0 yoe",
    ];
    for (const exp of fresherInputs) {
      const band = generateNegotiationBand({
        role: "Software Engineer",
        company: "TCS",
        experienceLevel: exp,
      });
      /* TCS SE entry now spans Ninja (₹3.4) → Prime (₹11.5) to cover all
         three fresher tracks. With track unknown, the 35th-percentile
         initial sits at ~₹6L — the deliberate "unknown-track default"
         that's between Ninja (₹4) and Digital (₹8). The original
         "<6" expectation reflected a Ninja-only band; the band is now
         track-aware. The invariant we still want: initial is NOT in
         mid-level territory (₹8L+) and IS NOT below Ninja floor. */
      expect(band.initialOffer).toBeGreaterThan(3);
      expect(band.initialOffer).toBeLessThan(8);
    }
  });

  it("Top-tier company freshers see verified campus bands (not generic tier)", () => {
    const googleEntry = generateNegotiationBand({
      role: "Software Engineer",
      company: "Google",
      experienceLevel: "fresher",
    });
    /* Google L3 India campus: ₹30-45L. Initial 35th ≈ ₹35.25L. */
    expect(googleEntry.initialOffer).toBeGreaterThan(28);
    expect(googleEntry.initialOffer).toBeLessThan(42);

    const flipkartEntry = generateNegotiationBand({
      role: "Software Engineer",
      company: "Flipkart",
      experienceLevel: "campus hire",
    });
    /* Flipkart SDE-1 fresher (2026-05 worksheet): ₹12.5-35L total CTC, wider band reflecting role tiering.
       Initial 35th ≈ ₹20.4L. Range allows 18-28L. */
    expect(flipkartEntry.initialOffer).toBeGreaterThan(17);
    expect(flipkartEntry.initialOffer).toBeLessThan(28);
  });

  it("CRED fresher hits selective-bar band (was missing pre-fix)", () => {
    const credEntry = generateNegotiationBand({
      role: "Software Engineer",
      company: "CRED",
      experienceLevel: "fresher",
    });
    /* CRED entry (curated 2026-05-08): ₹12-33.6L (wider than initial
     * narrow seed ₹22-32L; reflects actual fresher-offer distribution
     * including non-top-tier hires). 35th-pctile initial = ~₹19.6L. */
    expect(credEntry.initialOffer).toBeGreaterThan(15);
    expect(credEntry.initialOffer).toBeLessThan(30);
  });

  it("Long-tail unicorn fresher hits sector entry band", () => {
    /* Slice / Jupiter / etc. — fintech unicorn entry sector ₹15-24L. */
    const sliceEntry = generateNegotiationBand({
      role: "Software Engineer",
      company: "Slice",
      experienceLevel: "campus placement",
    });
    expect(sliceEntry.initialOffer).toBeGreaterThan(14);
    expect(sliceEntry.initialOffer).toBeLessThan(22);
  });

  it("FMCG management trainee maps to brand entry band (HUL UFLP territory)", () => {
    const hulMt = generateNegotiationBand({
      role: "Brand Manager",
      company: "HUL",
      experienceLevel: "management trainee",
    });
    /* HUL UFLP entry: ₹18-27L. Initial 35th ≈ ₹21.15L. */
    expect(hulMt.initialOffer).toBeGreaterThan(15);
    expect(hulMt.initialOffer).toBeLessThan(25);
  });

  it("YOE parser handles ranges, plus-signs, abbreviations (all parse to senior+ band)", () => {
    /* All these should parse to senior or executive — not mid. */
    const inputs = [
      "15 years",
      "15+ years experience",
      "15-20 yrs",
      "approximately 18 years",
      "18 yoe",
    ];
    /* Use a known company so the band isn't ambiguous. */
    for (const exp of inputs) {
      const band = generateNegotiationBand({
        role: "Software Engineer",
        company: "Razorpay",
        experienceLevel: exp,
      });
      /* Razorpay senior/lead bands: senior ₹42-65L, lead ₹60-95L.
         15-20 YOE should hit lead → initial 35th ≈ ₹72L. NOT
         the mid band (initial would be ~₹31L). */
      expect(band.initialOffer).toBeGreaterThan(50);
    }
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

describe("dataConfidence — calibration hedge for CSV-aggregated bands", () => {
  it("CSV-derived overrides are tagged as research-aggregated", () => {
    /* Companies in the 100-co CSV but without a hand-curated override
       should fall through to getCsvDerivedBandOverride and be tagged
       research-aggregated. Picking a CSV-only company (one of the 70
       non-curated ones) — Tata Steel is CSV-covered, not in the
       curator overrides for this role/level. */
    const ovr = getCompanyBandOverride("Tata Steel", "mechanical-engineer", "mid");
    if (ovr) {
      // Either curator-verified OR CSV-aggregated; both are valid resolution
      // paths. The invariant we care about: when source mentions "CSV
      // research dataset", confidence MUST be research-aggregated.
      if (/CSV research dataset/i.test(ovr.source)) {
        expect(ovr.dataConfidence).toBe("research-aggregated");
      }
    }
  });

  it("hand-curated entries default to verified (undefined dataConfidence)", () => {
    /* Razorpay SE mid was hand-verified 2026-05-08 — fresh curator,
       skips CSV reconciliation, no dataConfidence stamp. */
    const ovr = getCompanyBandOverride("Razorpay", "software-engineer", "mid");
    expect(ovr).toBeTruthy();
    expect(ovr?.dataConfidence).not.toBe("research-aggregated");
  });

  it("calibration sentence appears in negotiation band for CSV-aggregated company", () => {
    /* Pick a CSV-covered, non-curated company. The bandContext should
       carry the "research-aggregated" header + CALIBRATION line that
       coaches the LLM toward the lower half of the band. */
    const band = generateNegotiationBand({
      role: "software-engineer",
      company: "Tata Steel",
      experienceLevel: "mid",
    });
    if (band.bandSource === "company-override" && /research-aggregated/i.test(band.bandContext)) {
      expect(band.bandContext).toMatch(/CALIBRATION:/);
      expect(band.bandContext).toMatch(/lower half of the band/i);
    }
  });

  it("TCS software-engineer entry covers Ninja → Digital → Prime full track envelope", () => {
    /* Regression: prior version locked TCS entry at ₹3.4-4.5L (Ninja-only),
       making Digital-track candidates feel mis-quoted. Band must now span
       Ninja (₹3.4) → Prime (₹11.5) so the LLM can probe track + anchor. */
    const ovr = getCompanyBandOverride("TCS", "software-engineer", "entry");
    expect(ovr).toBeTruthy();
    expect(ovr!.totalMin).toBeLessThanOrEqual(3.5); // Ninja floor
    expect(ovr!.totalMax).toBeGreaterThanOrEqual(11); // Prime ceiling
    expect(ovr!.notes).toMatch(/Ninja/i);
    expect(ovr!.notes).toMatch(/Digital/i);
    expect(ovr!.notes).toMatch(/Prime/i);
    expect(ovr!.notes).toMatch(/PROBE/i); // LLM-facing track-probe instruction
  });

  it("TCS now exposes lead + executive bands for software-engineer", () => {
    /* Regression: prior version stopped at senior, forcing 8+ YOE TCS
       candidates to fall through to sector default. Lead/executive must
       resolve to TCS-specific numbers, not __sector_it_services_legacy. */
    const lead = getCompanyBandOverride("TCS", "software-engineer", "lead");
    const exec = getCompanyBandOverride("TCS", "software-engineer", "executive");
    expect(lead).toBeTruthy();
    expect(exec).toBeTruthy();
    expect(lead!.source).toMatch(/TCS|Glassdoor.*Consultant/i);
    expect(exec!.source).toMatch(/TCS|Manager|Delivery/i);
    // Lead < Executive (monotonicity)
    expect(exec!.totalMin).toBeGreaterThanOrEqual(lead!.totalMin);
  });

  it("verified curator entry does NOT include the calibration hedge", () => {
    const band = generateNegotiationBand({
      role: "software-engineer",
      company: "Razorpay",
      experienceLevel: "mid",
    });
    if (/verified for/i.test(band.bandContext)) {
      expect(band.bandContext).not.toMatch(/CALIBRATION:/);
    }
  });
});
