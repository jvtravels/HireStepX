import { describe, it, expect } from "vitest";
import { parseCandidateAnswer } from "../../server-handlers/_negotiation-kernel";
import {
  lookupCompanyCompStructure,
  formatCompStructureForPrompt,
  GENERIC_INDIA_COMP,
  COMPANY_COMP,
} from "../../data/company-compensation-structure";

/**
 * Session 12 bug (2026-05-14): candidate utterances like
 *   "The variable components, can you explain"
 *   "give me details about benefits and variable components"
 *   "ESOP details?"
 * had no handler — the recruiter looped close-acceptance. New
 * `compensation-breakdown` info intent + company-aware structure
 * disclosure fixes the root cause.
 */
describe("compensation-breakdown detection", () => {
  it("detects 'The variable components, can you explain'", () => {
    const r = parseCandidateAnswer("The variable components, can you explain");
    expect(r.infoAsked).toContain("compensation-breakdown");
  });

  it("detects 'give me details about benefits and variable components' as BOTH intents", () => {
    const r = parseCandidateAnswer("give me details about benefits and variable components");
    expect(r.infoAsked).toContain("benefits-overview");
    expect(r.infoAsked).toContain("compensation-breakdown");
  });

  it("detects 'ESOP details?'", () => {
    const r = parseCandidateAnswer("ESOP details?");
    expect(r.infoAsked).toContain("compensation-breakdown");
  });

  it("detects 'what is the bonus structure?'", () => {
    const r = parseCandidateAnswer("what is the bonus structure?");
    expect(r.infoAsked).toContain("compensation-breakdown");
  });

  it("detects 'explain the equity component'", () => {
    const r = parseCandidateAnswer("explain the equity component");
    expect(r.infoAsked).toContain("compensation-breakdown");
  });

  it("detects 'tell me about OTE'", () => {
    const r = parseCandidateAnswer("tell me about OTE");
    expect(r.infoAsked).toContain("compensation-breakdown");
  });

  it("does NOT trip on declarative 'the variable was 12% last year.'", () => {
    /* No interrogative shape; no imperative cue; ends with `.`. */
    const r = parseCandidateAnswer("the variable was 12% last year.");
    expect(r.infoAsked).not.toContain("compensation-breakdown");
  });

  it("does NOT trip on declarative 'I counted the benefits.'", () => {
    const r = parseCandidateAnswer("I counted the benefits.");
    expect(r.infoAsked).not.toContain("benefits-overview");
    expect(r.infoAsked).not.toContain("compensation-breakdown");
  });
});

describe("lookupCompanyCompStructure", () => {
  it("returns generic fallback for unknown company", () => {
    expect(lookupCompanyCompStructure("SomeRandomNonsenseCorp")).toBe(GENERIC_INDIA_COMP);
  });

  it("returns generic fallback for empty / null company", () => {
    expect(lookupCompanyCompStructure("")).toBe(GENERIC_INDIA_COMP);
    expect(lookupCompanyCompStructure(null)).toBe(GENERIC_INDIA_COMP);
    expect(lookupCompanyCompStructure(undefined)).toBe(GENERIC_INDIA_COMP);
  });

  it("matches Razorpay with expected ratios", () => {
    const r = lookupCompanyCompStructure("Razorpay");
    expect(r.baseRatio).toBe(0.75);
    expect(r.variableRatio).toBe(0.15);
    expect(r.equityRatio).toBe(0.10);
    expect(r.bonusFrequency).toBe("annual");
    expect(r.vestingSchedule).toBe("4-year, 1-year cliff");
  });

  it("matches case-insensitively and on substrings", () => {
    expect(lookupCompanyCompStructure("RAZORPAY")).toBe(COMPANY_COMP.razorpay);
    expect(lookupCompanyCompStructure("Accenture India Pvt Ltd")).toBe(COMPANY_COMP.accenture);
  });

  it("covers all 11 documented companies", () => {
    const expected = [
      "razorpay", "accenture", "tcs", "google", "microsoft",
      "amazon", "flipkart", "swiggy", "zomato", "infosys", "wipro",
    ];
    for (const c of expected) {
      expect(COMPANY_COMP[c], `missing override for ${c}`).toBeDefined();
    }
    expect(Object.keys(COMPANY_COMP).length).toBe(11);
  });

  it("every entry's ratios are well-formed (each 0-1 and sum ≤ 1.05)", () => {
    for (const [name, s] of Object.entries(COMPANY_COMP)) {
      expect(s.baseRatio, `${name}.baseRatio`).toBeGreaterThanOrEqual(0);
      expect(s.baseRatio, `${name}.baseRatio`).toBeLessThanOrEqual(1);
      expect(s.variableRatio, `${name}.variableRatio`).toBeGreaterThanOrEqual(0);
      expect(s.equityRatio, `${name}.equityRatio`).toBeGreaterThanOrEqual(0);
      const sum = s.baseRatio + s.variableRatio + s.equityRatio;
      expect(sum, `${name} ratios sum`).toBeLessThanOrEqual(1.05);
      expect(sum, `${name} ratios sum`).toBeGreaterThanOrEqual(0.95);
    }
  });
});

describe("formatCompStructureForPrompt", () => {
  it("includes rupee figures when totalCtc > 0", () => {
    const s = formatCompStructureForPrompt(COMPANY_COMP.razorpay, 40);
    expect(s).toContain("Base: ₹30 LPA");
    expect(s).toContain("(75%");
    expect(s).toContain("Variable / performance bonus");
    expect(s).toContain("Equity (annualised): ₹4 LPA");
    expect(s).toContain("Bonus frequency: annual");
    expect(s).toContain("Vesting schedule: 4-year, 1-year cliff");
  });

  it("omits rupee figures when totalCtc is 0", () => {
    const s = formatCompStructureForPrompt(COMPANY_COMP.razorpay, 0);
    expect(s).toContain("Base: 75% of CTC");
    expect(s).not.toContain("Base: ₹");
  });

  it("flags 'not part of standard hires' for zero-equity companies", () => {
    const s = formatCompStructureForPrompt(COMPANY_COMP.tcs, 12);
    expect(s).toContain("Equity: not part of standard hires");
  });

  it("omits notes line when notes is empty string", () => {
    const s = formatCompStructureForPrompt(COMPANY_COMP.swiggy, 25);
    expect(s).not.toContain("Notes:");
  });
});
