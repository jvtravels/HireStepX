import { describe, it, expect } from "vitest";
import { parseCandidateAnswer } from "../../server-handlers/_negotiation-kernel";
import {
  lookupCompanyBenefits,
  formatBenefitsForPrompt,
  GENERIC_INDIA_BENEFITS,
  COMPANY_FACTS,
} from "../../data/company-facts";

/**
 * Bug report 11 follow-up E (2026-05-14): the candidate's "can you let
 * me know what are the benefits for this role?" ask was unhandled —
 * the AI re-served close-acceptance. New `benefits-overview` info
 * intent + company-aware lookup fixes the root cause.
 */
describe("benefits-overview detection", () => {
  it("detects 'what are the benefits for this role?'", () => {
    const r = parseCandidateAnswer("Can you let me know what are the benefits for this role you are offering?");
    expect(r.infoAsked).toContain("benefits-overview");
  });

  it("detects bare 'for the benefits.' follow-up", () => {
    const r = parseCandidateAnswer("for the benefits.");
    expect(r.infoAsked).toContain("benefits-overview");
  });

  it("detects 'what perks do you offer?'", () => {
    const r = parseCandidateAnswer("what perks do you offer at this role?");
    expect(r.infoAsked).toContain("benefits-overview");
  });

  it("detects 'tell me about the benefits'", () => {
    const r = parseCandidateAnswer("Could you tell me about the benefits?");
    expect(r.infoAsked).toContain("benefits-overview");
  });

  it("detects 'what do I get besides salary?'", () => {
    const r = parseCandidateAnswer("And what do I get apart from base?");
    expect(r.infoAsked).toContain("benefits-overview");
  });

  it("does NOT trip on the unrelated word 'benefits' in non-interrogative context", () => {
    /* Sanity: a sentence mentioning "benefits" in passing without the
     * question shape shouldn't fire the intent. */
    const r = parseCandidateAnswer("I already counted the benefits.");
    expect(r.infoAsked).not.toContain("benefits-overview");
  });

  /* ── Session 12 bug regressions (2026-05-14) ─────────────────────── */

  it("[session 12] 'Can you let me know all the benefits of the oral CTC?'", () => {
    const r = parseCandidateAnswer("Can you let me know all the benefits of the oral CTC?");
    expect(r.infoAsked).toContain("benefits-overview");
  });

  it("[session 12] 'give me details about benefits and variable components'", () => {
    const r = parseCandidateAnswer("give me details about benefits and variable components");
    expect(r.infoAsked).toContain("benefits-overview");
  });

  it("[session 12 verbatim] 'for the benefits.'", () => {
    const r = parseCandidateAnswer("for the benefits.");
    expect(r.infoAsked).toContain("benefits-overview");
  });

  it("does NOT trip on declarative 'I counted the benefits.'", () => {
    /* Re-asserted negative case: this verbatim phrase must not fire. */
    const r = parseCandidateAnswer("I counted the benefits.");
    expect(r.infoAsked).not.toContain("benefits-overview");
  });
});

describe("lookupCompanyBenefits", () => {
  it("returns generic fallback for unknown company", () => {
    expect(lookupCompanyBenefits("SomeRandomNonsenseCorp")).toBe(GENERIC_INDIA_BENEFITS);
  });

  it("returns generic fallback for empty / null company", () => {
    expect(lookupCompanyBenefits("")).toBe(GENERIC_INDIA_BENEFITS);
    expect(lookupCompanyBenefits(null)).toBe(GENERIC_INDIA_BENEFITS);
    expect(lookupCompanyBenefits(undefined)).toBe(GENERIC_INDIA_BENEFITS);
  });

  it("matches case-insensitively", () => {
    expect(lookupCompanyBenefits("accenture")).toBe(COMPANY_FACTS.accenture.benefits);
    expect(lookupCompanyBenefits("ACCENTURE")).toBe(COMPANY_FACTS.accenture.benefits);
  });

  it("matches substring (company suffix tolerated)", () => {
    expect(lookupCompanyBenefits("Accenture Solutions Pvt Ltd")).toBe(COMPANY_FACTS.accenture.benefits);
    expect(lookupCompanyBenefits("TCS Bangalore")).toBe(COMPANY_FACTS.tcs.benefits);
  });

  it("covers the documented company list", () => {
    const expected = ["accenture", "tcs", "infosys", "wipro", "google", "microsoft", "amazon", "flipkart", "swiggy", "zomato", "razorpay"];
    for (const c of expected) {
      expect(COMPANY_FACTS[c]?.benefits, `missing benefits override for ${c}`).toBeDefined();
    }
  });

  it("every benefits package has all required fields", () => {
    for (const [name, facts] of Object.entries(COMPANY_FACTS)) {
      const pkg = facts.benefits;
      if (!pkg) continue;
      expect(pkg.healthInsurance, `${name}.healthInsurance`).toBeTruthy();
      expect(pkg.providentFund, `${name}.providentFund`).toBeTruthy();
      expect(pkg.gratuity, `${name}.gratuity`).toBeTruthy();
      expect(pkg.paidTimeOff, `${name}.paidTimeOff`).toBeTruthy();
      expect(pkg.performanceBonus, `${name}.performanceBonus`).toBeTruthy();
      expect(pkg.learningBudget, `${name}.learningBudget`).toBeTruthy();
      expect(pkg.workMode, `${name}.workMode`).toBeTruthy();
    }
  });
});

describe("formatBenefitsForPrompt", () => {
  it("formats the generic package as bulleted prose", () => {
    const s = formatBenefitsForPrompt(GENERIC_INDIA_BENEFITS);
    expect(s).toContain("Health insurance");
    expect(s).toContain("Provident Fund");
    expect(s).toContain("Gratuity");
    expect(s).toContain("Paid time off");
    expect(s).toContain("Performance bonus");
    expect(s).toContain("Learning budget");
    expect(s).toContain("Work mode");
  });

  it("includes signature perks when present (Google)", () => {
    const s = formatBenefitsForPrompt(COMPANY_FACTS.google.benefits!);
    expect(s).toContain("Other perks");
  });

  it("omits signature perks when absent (generic)", () => {
    expect(formatBenefitsForPrompt(GENERIC_INDIA_BENEFITS)).not.toContain("Other perks");
  });
});
