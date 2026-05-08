import { describe, it, expect } from "vitest";
import { buildSalaryNegotiationGuidance } from "../../data/salary-lookup";

/* MARKET REALITY block lock. The salary-neg LLM prompt now embeds
 * grounded take-home, equity-discount, and recruiter-flexibility numbers
 * computed from _ctc-breakdown + _negotiation-math. If a future refactor
 * accidentally drops the block (or the helpers change shape), the LLM
 * silently regresses to coaching against stated CTC. This test fails
 * the build instead. */

describe("MARKET REALITY block in buildSalaryNegotiationGuidance", () => {
  it("includes the MARKET REALITY heading for a standard product-co prompt", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
      location: "Bengaluru",
    });
    expect(prompt).toMatch(/MARKET REALITY/);
  });

  it("references monthly take-home (₹k/mo)", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
      location: "Bengaluru",
    });
    expect(prompt).toMatch(/monthly take-home/i);
    expect(prompt).toMatch(/₹\d+k/);
  });

  it("references recruiter flexibility for the tier", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
      location: "Bengaluru",
    });
    expect(prompt).toMatch(/[Rr]ecruiter flexibility.*~?\d+%/);
  });

  it("notes equity discount when role offers equity", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "Razorpay",
      location: "Bengaluru",
    });
    expect(prompt).toMatch(/[Ee]quity discount|liquidity/);
  });

  it("does NOT mention equity in the MARKET REALITY block for PSU/govt roles", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "mid",
      company: "ONGC",
      location: "Delhi",
    });
    // The MARKET REALITY block is structured around stated→realistic,
    // not equity, for govt where equity_type is none.
    const reality = prompt.split("MARKET REALITY")[1] ?? "";
    expect(reality).not.toMatch(/Equity discount/);
  });

  it("instructs the LLM to track flexibility math, not match the full ask", () => {
    const prompt = buildSalaryNegotiationGuidance({
      role: "Software Engineer",
      experienceLevel: "senior",
      company: "Flipkart",
      location: "Bengaluru",
    });
    expect(prompt).toMatch(/realistic close|track this|do NOT contradict/i);
  });
});
