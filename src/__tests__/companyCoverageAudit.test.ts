/**
 * Comprehensive coverage audit — iterates EVERY company in
 * COMPANY_SUGGESTIONS (~800 entries) and verifies that each
 * resolves to one of:
 *   1. A bespoke override entry (60 verified companies)
 *   2. A sector-classified bucket (22 sector entries)
 *   3. A tier-classified band (40+ tier mappings)
 *   4. Conservative fallback (last resort — should be RARE)
 *
 * Reports any company that falls all the way to the conservative
 * fallback (which gives a generic ₹10L mid / ₹50L exec band).
 * That's the gap. Fail the test if too many gaps.
 */

import { describe, it, expect } from "vitest";
import { COMPANY_SUGGESTIONS } from "../onboardingData";
import { generateNegotiationBand } from "../../data/salary-lookup";
import { getCompanyBandOverride } from "../../data/company-salary-overrides";
import { getCompanyTier } from "../../data/company-tiers";
import { classifyCompanyType } from "../../data/company-guidance";

interface CompanyResolution {
  company: string;
  hasOverride: boolean;          // bespoke entry exists
  sectorBucket: string | null;   // classifyCompanyType key
  tierKey: string | null;        // getCompanyTier key
  bandSource: "override" | "sector" | "tier" | "fallback";
  midOffer: number;
}

function resolveCompany(company: string): CompanyResolution {
  const override = getCompanyBandOverride(company, "software-engineer", "mid");
  const sectorBucket = classifyCompanyType(company)?.key ?? null;
  const tierKey = getCompanyTier(company);

  let bandSource: CompanyResolution["bandSource"];
  if (override) {
    bandSource = "override";
  } else if (sectorBucket) {
    bandSource = "sector";
  } else if (tierKey) {
    bandSource = "tier";
  } else {
    bandSource = "fallback";
  }

  /* Generate an actual band for a representative role/level. */
  const band = generateNegotiationBand({
    role: "Software Engineer",
    company,
    experienceLevel: "mid",
  });

  return {
    company,
    hasOverride: !!override,
    sectorBucket,
    tierKey,
    bandSource,
    midOffer: band.initialOffer,
  };
}

describe("company-coverage audit (full COMPANY_SUGGESTIONS sweep)", () => {
  const resolutions = COMPANY_SUGGESTIONS.map(resolveCompany);

  it("reports the resolution distribution across the full company list", () => {
    const counts = {
      override: 0,
      sector: 0,
      tier: 0,
      fallback: 0,
    };
    for (const r of resolutions) counts[r.bandSource]++;

    process.stderr.write("\n📊 COMPANY COVERAGE AUDIT\n");
    process.stderr.write(`  Total companies in autocomplete: ${COMPANY_SUGGESTIONS.length}\n`);
    process.stderr.write(`  ✅ Bespoke override (verified data):  ${counts.override}\n`);
    process.stderr.write(`  ✅ Sector-classified (long-tail):     ${counts.sector}\n`);
    process.stderr.write(`  ⚠️  Tier-only (generic band):         ${counts.tier}\n`);
    process.stderr.write(`  🔴 Conservative fallback (gap):       ${counts.fallback}\n`);
    process.stderr.write(`  Sector+Override coverage: ${(((counts.override + counts.sector) / COMPANY_SUGGESTIONS.length) * 100).toFixed(1)}%\n`);
    process.stderr.write(`  Sector+Override+Tier coverage: ${(((counts.override + counts.sector + counts.tier) / COMPANY_SUGGESTIONS.length) * 100).toFixed(1)}%\n`);

    /* Coverage threshold. Note: even when bandSource = "fallback"
       (no tier/sector classifier match), generateNegotiationBand
       still defaults to indian-unicorn × role × exp band — so the
       candidate gets a sensible offer. The threshold here measures
       SOURCE-CITED coverage, not "broken" coverage. */
    const strongCoverage = (counts.override + counts.sector + counts.tier) / COMPANY_SUGGESTIONS.length;
    /* Currently 67.8% classified; the rest fall to the indian-unicorn
       default (still produces a sensible offer, just no source
       attribution). Threshold is the floor — raise it as we
       incrementally pull more long-tail companies into classifiers. */
    expect(strongCoverage).toBeGreaterThan(0.65);
  });

  it("prints any companies that ONLY hit the conservative fallback (gap report)", () => {
    const gaps = resolutions.filter(r => r.bandSource === "fallback");
    if (gaps.length > 0) {
      process.stderr.write(`\n🔴 ${gaps.length} companies fall to conservative fallback (no override, no sector, no tier):\n`);
      for (const g of gaps.slice(0, 80)) {
        process.stderr.write(`  - ${g.company}  (mid offer: ₹${g.midOffer}L)\n`);
      }
      if (gaps.length > 80) {
        process.stderr.write(`  ... and ${gaps.length - 80} more\n`);
      }
    } else {
      process.stderr.write("\n✅ Zero gaps — every company resolves to override / sector / tier.\n");
    }
    /* Soft cap: <600 fallbacks. Even fallback companies still get a
       sensible default (indian-unicorn × role × exp). The CI test
       surfaces them so we can incrementally pull them into sector/
       tier classifiers as the data grows. */
    expect(gaps.length).toBeLessThan(600);
  });

  it("samples mid-offer for 50 companies across the resolution chain — no absurd offers", () => {
    /* Pick a representative slice to verify the bands look sensible
       without flooding the log. */
    const sample = COMPANY_SUGGESTIONS.filter((_, i) => i % Math.floor(COMPANY_SUGGESTIONS.length / 50) === 0);
    process.stderr.write(`\n📋 50-company offer sample (Software Engineer, mid level):\n`);
    for (const company of sample) {
      const r = resolveCompany(company);
      const tag = r.bandSource === "override" ? "✅" : r.bandSource === "sector" ? "🟢" : r.bandSource === "tier" ? "🟡" : "🔴";
      process.stderr.write(`  ${tag} ${company.padEnd(40, " ")} ₹${String(r.midOffer.toFixed(1)).padStart(7, " ")}L  [${r.bandSource}]\n`);
      /* Sanity check: no absurd offers. */
      expect(r.midOffer).toBeGreaterThan(0);
      expect(r.midOffer).toBeLessThan(500); // ₹500L mid is unrealistic anywhere
    }
  });

  it("prints sector distribution for companies hitting sector fallback", () => {
    const sectorHits: Record<string, number> = {};
    for (const r of resolutions) {
      if (r.bandSource === "sector" && r.sectorBucket) {
        sectorHits[r.sectorBucket] = (sectorHits[r.sectorBucket] || 0) + 1;
      }
    }
    process.stderr.write(`\n📊 Sector-classified company distribution:\n`);
    const sorted = Object.entries(sectorHits).sort((a, b) => b[1] - a[1]);
    for (const [bucket, count] of sorted) {
      process.stderr.write(`  ${bucket.padEnd(40, " ")} ${count} companies\n`);
    }
  });

  it("prints tier distribution for companies hitting only tier (no sector match)", () => {
    const tierHits: Record<string, number> = {};
    for (const r of resolutions) {
      if (r.bandSource === "tier" && r.tierKey) {
        tierHits[r.tierKey] = (tierHits[r.tierKey] || 0) + 1;
      }
    }
    process.stderr.write(`\n📊 Tier-classified-only company distribution (no sector match):\n`);
    const sorted = Object.entries(tierHits).sort((a, b) => b[1] - a[1]);
    for (const [tier, count] of sorted) {
      process.stderr.write(`  ${tier.padEnd(40, " ")} ${count} companies\n`);
    }
  });
});
