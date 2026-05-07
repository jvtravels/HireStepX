/**
 * End-to-end pipeline smoke tests.
 *
 * Threads the full chain (company classification → role inference →
 * salary band → question retrieval → grounding rules) for representative
 * (focus × company × role × YOE) scenarios. Asserts each stage produces
 * a sensible, non-broken result.
 *
 * Each scenario simulates a real candidate journey end-to-end, without
 * actually calling the LLM. Covers the major focus types + role
 * families to catch regressions that single-layer tests miss.
 */

import { describe, it, expect } from "vitest";
import { generateNegotiationBand } from "../../data/salary-lookup";
import { matchRoleKey } from "../../data/salaries";
import { getCompanyTier } from "../../data/company-tiers";
import { classifyCompanyType } from "../../data/company-guidance";
import { matchRoleKey as matchCompetencyKey } from "../../data/role-competencies";
import {
  retrieveReferenceQuestions,
  formatReferencesForPrompt,
  inferRoleFamily,
  normaliseFocus,
  normaliseCompany,
} from "../../server-handlers/_question-retrieval";
import { getCompanyBandOverride } from "../../data/company-salary-overrides";
import { getKnownFacts, formatKnownFactsForPrompt } from "../../data/company-known-facts";

interface Scenario {
  label: string;
  role: string;
  company: string;
  focus: string;
  experienceLevel: string;
}

const SCENARIOS: Scenario[] = [
  /* Top-tier verified path. */
  { label: "Senior SWE @ Razorpay (8 yr)", role: "Senior Software Engineer", company: "Razorpay", focus: "salary-negotiation", experienceLevel: "senior" },
  /* Long-tail catch-all. */
  { label: "Audiologist @ Apollo Hospitals (5 yr)", role: "Audiologist", company: "Apollo Hospitals", focus: "behavioral", experienceLevel: "5 years" },
  /* Sales family. */
  { label: "AE @ Freshworks (3 yr)", role: "Account Executive", company: "Freshworks", focus: "behavioral", experienceLevel: "mid" },
  /* BFSI sales. */
  { label: "RM @ ICICI (8 yr)", role: "Relationship Manager", company: "ICICI Bank", focus: "behavioral", experienceLevel: "senior" },
  /* Finance family. */
  { label: "IB Analyst @ Goldman (1 yr)", role: "Investment Banking Analyst", company: "Goldman Sachs", focus: "case-study", experienceLevel: "entry" },
  /* Marketing family. */
  { label: "Brand Manager @ HUL (UFLP MT)", role: "Brand Manager", company: "HUL", focus: "case-study", experienceLevel: "management trainee" },
  /* Govt/PSU. */
  { label: "IAS aspirant @ UPSC", role: "IAS Officer", company: "UPSC (Indian Administrative Service)", focus: "government-psu", experienceLevel: "entry" },
  /* Quant. */
  { label: "Quant @ Jane Street (fresher)", role: "Quantitative Researcher", company: "Jane Street", focus: "technical", experienceLevel: "fresher" },
  /* Catch-all unknown company. */
  { label: "PM @ Unknown Co XYZ (6 yr)", role: "Product Manager", company: "Some Unknown Co XYZ", focus: "case-study", experienceLevel: "6 years" },
  /* Senior exec — 18 YOE. */
  { label: "CTO @ Razorpay (18 yr)", role: "CTO", company: "Razorpay", focus: "strategic", experienceLevel: "18 years" },
];

describe("end-to-end pipeline smoke tests", () => {
  for (const scenario of SCENARIOS) {
    it(`resolves the full pipeline cleanly for: ${scenario.label}`, () => {
      /* Stage 1 — company classification. */
      const tier = getCompanyTier(scenario.company);
      const sectorKey = classifyCompanyType(scenario.company)?.key;
      const knownFacts = getKnownFacts(scenario.company);
      /* At least one of these must resolve. */
      expect(tier || sectorKey || knownFacts).toBeTruthy();

      /* Stage 2 — role inference. */
      const roleKey = matchRoleKey(scenario.role);
      const roleFamily = inferRoleFamily(scenario.role);
      const competencyKey = matchCompetencyKey(scenario.role).key;
      /* Role-key must resolve to one of the salaries.ts RoleKey union. */
      expect(roleKey).toBeTruthy();
      expect(roleFamily).toBeTruthy();

      /* Stage 3 — salary band. */
      const band = generateNegotiationBand({
        role: scenario.role,
        company: scenario.company,
        experienceLevel: scenario.experienceLevel,
      });
      /* Band must produce a sensible offer (>0, <₹1000L). */
      expect(band.initialOffer).toBeGreaterThan(0);
      expect(band.initialOffer).toBeLessThan(1000);
      /* Min ≤ initial ≤ max. */
      expect(band.minOffer).toBeLessThanOrEqual(band.initialOffer);
      expect(band.initialOffer).toBeLessThanOrEqual(band.maxStretch);
      /* Walkaway above max. */
      expect(band.walkAway).toBeGreaterThanOrEqual(band.maxStretch);
      /* Band-context must be non-empty and cite a source. */
      expect(band.bandContext.length).toBeGreaterThan(50);
      expect(band.bandContext).toMatch(/(verified|median|tier|source|Levels|AmbitionBox|Glassdoor|7th CPC|UGC|InsideIIM|Naukri)/i);

      /* Stage 4 — question retrieval. */
      const result = retrieveReferenceQuestions({
        company: scenario.company,
        roleFamily: inferRoleFamily(scenario.role) ?? undefined,
        focus: normaliseFocus(scenario.focus) ?? undefined,
      });
      /* Tier 1-3 should hit something OR tier-4 emits the grounding warning. */
      const promptBlock = formatReferencesForPrompt(result);
      expect(promptBlock.length).toBeGreaterThan(0);
      /* If tier-4 (no match), prompt must explicitly tell LLM to stay generic. */
      if (result.tier === 4) {
        expect(promptBlock).toMatch(/no verified reference questions/i);
        expect(promptBlock).toMatch(/DO NOT invent/);
      }

      /* Stage 5 — known-facts whitelist (when applicable). */
      if (knownFacts) {
        const factBlock = formatKnownFactsForPrompt(knownFacts, scenario.company);
        expect(factBlock).toMatch(/VERIFIED COMPANY FACTS/);
      }
    });
  }

  it("normaliseCompany roundtrips correctly across the full set", () => {
    for (const scenario of SCENARIOS) {
      const normalized = normaliseCompany(scenario.company);
      /* Either a CompanyKey or null — should never throw. */
      expect(normalized === null || typeof normalized === "string").toBe(true);
    }
  });

  it("every scenario produces a band-context with specific numbers", () => {
    for (const scenario of SCENARIOS) {
      const band = generateNegotiationBand({
        role: scenario.role,
        company: scenario.company,
        experienceLevel: scenario.experienceLevel,
      });
      /* Must emit specific numbers (not placeholder ranges). The
         band-context template DOES mention "TBD" / "[amount]" as
         forbidden-words to the LLM, so we don't check for those
         literally — instead verify there's at least one specific
         rupee figure. */
      expect(band.bandContext).toMatch(/₹\s*\d+(\.\d+)?\s*(LPA|L\b)/);
    }
  });
});
