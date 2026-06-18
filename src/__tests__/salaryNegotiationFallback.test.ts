/* Salary-negotiation LLM-down fallback — unit tests (2026-06-19).
 *
 * Root-cause regression lock. When both LLM providers are exhausted,
 * /api/generate-questions used to refuse any salary-negotiation fallback
 * and return 500. That dead-ended the client's band fetch (the band lives
 * ONLY in this response), so the kernel bailed to the non-adaptive static
 * script that never names a number → the deal-summary extractor found
 * nothing → the report rendered "0 of 5 stages" over what should have been
 * a real close.
 *
 * The fix returns a 200 with the deterministic band + the canonical kernel
 * opener. These tests pin the shape the engine + kernel depend on:
 *  - a valid 3-step array (intro + opener + closing) — passes
 *    validateQuestionShape, so no blank avatar bubbles;
 *  - the opener carries content (a real discovery probe, NOT a blank/stub);
 *  - the consumer fields the UI actually reads (aiText/aiTextDisplay) are
 *    populated on every step;
 *  - it never throws, even for degenerate band inputs.
 */

import { describe, it, expect } from "vitest";
import {
  buildSalaryNegotiationFallbackQuestions,
  validateQuestionShape,
} from "../../server-handlers/_generate-questions-helpers";

const BAND = { initialOffer: 28, maxStretch: 35, walkAway: 22, hasEquity: true };

describe("buildSalaryNegotiationFallbackQuestions", () => {
  it("returns exactly intro + opener + closing", () => {
    const q = buildSalaryNegotiationFallbackQuestions({
      role: "Product Designer",
      company: "Acme",
      band: BAND,
    });
    expect(q).toHaveLength(3);
    expect(q[0].type).toBe("intro");
    expect(q[1].type).toBe("question");
    expect(q[2].type).toBe("closing");
  });

  it("produces a shape validateQuestionShape accepts (no blank bubbles)", () => {
    const q = buildSalaryNegotiationFallbackQuestions({
      role: "SDE-3",
      company: "Flipkart",
      band: BAND,
    });
    expect(validateQuestionShape(q)).toBe(true);
  });

  it("populates every consumer field the UI reads on each step", () => {
    const q = buildSalaryNegotiationFallbackQuestions({
      role: "PM",
      company: "Razorpay",
      band: BAND,
    });
    for (const step of q) {
      expect(step.aiText.length).toBeGreaterThan(10);
      expect(step.aiTextDisplay).toBe(step.aiText);
      expect(step.question).toBe(step.aiText);
      expect(step.text).toBe(step.aiText);
    }
  });

  it("the opener carries a real discovery probe (not a blank/degenerate stub)", () => {
    const q = buildSalaryNegotiationFallbackQuestions({
      role: "Product Designer",
      company: "Acme",
      band: BAND,
    });
    const opener = q[1].aiText;
    // The canonical open-with-offer prose is a question-bearing discovery
    // probe; the safe fallback greeting is too. Either way it must be a
    // non-trivial line that ends by inviting the candidate to respond.
    expect(opener.length).toBeGreaterThan(20);
    expect(opener).toMatch(/\?/);
  });

  it("does not throw on degenerate band inputs (missing equity, zero stretch)", () => {
    expect(() =>
      buildSalaryNegotiationFallbackQuestions({
        role: "",
        company: "",
        band: { initialOffer: 0, maxStretch: 0, walkAway: 0 },
      }),
    ).not.toThrow();
    const q = buildSalaryNegotiationFallbackQuestions({
      role: "",
      company: "",
      band: { initialOffer: 0, maxStretch: 0, walkAway: 0 },
    });
    expect(validateQuestionShape(q)).toBe(true);
  });

  it("respects an explicit marketMode without throwing", () => {
    for (const marketMode of ["soft", "neutral", "hot"] as const) {
      const q = buildSalaryNegotiationFallbackQuestions({
        role: "Data Scientist",
        company: "Swiggy",
        band: { ...BAND, marketMode },
      });
      expect(validateQuestionShape(q)).toBe(true);
    }
  });
});
