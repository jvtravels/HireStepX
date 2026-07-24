/* S55-B3/B4 (2026-07-24) — LLM mislabels recruiter's opening offer as
 * the candidate's "current CTC."
 *
 * Root cause: the factPack passed to buildAnswerCandidatePrompt contained
 * `budgetBand: { low: 58.9, ... }` alongside `candidateCurrentCtc: 45`.
 * The LLM, seeing the ambiguous key "low", sometimes emitted
 * "We have your current CTC at ₹58.9L" — reading the offer number as CTC.
 *
 * Fix: toLlmFactPack() renames the fields to unambiguous names before
 * JSON.stringify so the LLM cannot confuse them:
 *   candidateCurrentCtc        → candidateCurrentEmployerCtc_lpa
 *   budgetBand.low             → ourOfferBand.ourOpeningOffer_lpa
 *   budgetBand.high            → ourOfferBand.ourMaximumFlexibility_lpa
 *   budgetBand.walk            → ourOfferBand.ourWalkaway_lpa */
import { describe, it, expect } from "vitest";
import { toLlmFactPack, type FactPack } from "../../server-handlers/_fact-pack";

const BASE_PACK: FactPack = {
  role: "swe",
  company: "flipkart",
  marketMode: "hot",
  phase: "offer-presented",
  marketFacts: {} as FactPack["marketFacts"],
};

describe("S55-B3/B4 — toLlmFactPack renames ambiguous fields", () => {
  it("renames candidateCurrentCtc to candidateCurrentEmployerCtc_lpa", () => {
    const pack = { ...BASE_PACK, candidateCurrentCtc: 45 };
    const out = toLlmFactPack(pack);
    expect(out).not.toHaveProperty("candidateCurrentCtc");
    expect(out).toHaveProperty("candidateCurrentEmployerCtc_lpa", 45);
  });

  it("renames budgetBand sub-fields to unambiguous names", () => {
    const pack = { ...BASE_PACK, budgetBand: { low: 58.9, high: 70, walk: 40 } };
    const out = toLlmFactPack(pack);
    expect(out).not.toHaveProperty("budgetBand");
    const band = (out as { ourOfferBand?: Record<string, number> }).ourOfferBand;
    expect(band).toBeDefined();
    expect(band?.ourOpeningOffer_lpa).toBe(58.9);
    expect(band?.ourMaximumFlexibility_lpa).toBe(70);
    expect(band?.ourWalkaway_lpa).toBe(40);
  });

  it("the renamed JSON string cannot contain 'budgetBand' or ambiguous 'low'/'high'/'walk' keys at the offer level", () => {
    const pack = { ...BASE_PACK, candidateCurrentCtc: 45, budgetBand: { low: 58.9, high: 70, walk: 40 } };
    const json = JSON.stringify(toLlmFactPack(pack), null, 2);
    /* Key "budgetBand" must not appear as a JSON key. */
    expect(json).not.toMatch(/"budgetBand"/);
    /* Key "candidateCurrentCtc" must not appear (replaced by clearer name). */
    expect(json).not.toMatch(/"candidateCurrentCtc"/);
    /* The offer value (58.9) must appear only under ourOfferBand, not next to a "currentCtc" key. */
    expect(json).toContain("ourOpeningOffer_lpa");
    expect(json).toContain("candidateCurrentEmployerCtc_lpa");
  });

  it("preserves all other factPack fields unchanged", () => {
    const pack = {
      ...BASE_PACK,
      candidateExpectedCtc: 80,
      workMode: "hybrid" as const,
      teamSize: 12,
    };
    const out = toLlmFactPack(pack);
    expect(out).toHaveProperty("candidateExpectedCtc", 80);
    expect(out).toHaveProperty("workMode", "hybrid");
    expect(out).toHaveProperty("teamSize", 12);
  });

  it("omits undefined placeholders — no 'undefined' values in output", () => {
    const pack = { ...BASE_PACK };
    const out = toLlmFactPack(pack);
    for (const v of Object.values(out)) {
      expect(v).not.toBeUndefined();
    }
  });

  it("handles pack with no candidateCurrentCtc and no budgetBand gracefully", () => {
    const out = toLlmFactPack(BASE_PACK);
    expect(out).not.toHaveProperty("candidateCurrentCtc");
    expect(out).not.toHaveProperty("budgetBand");
    expect(out).not.toHaveProperty("candidateCurrentEmployerCtc_lpa");
    expect(out).not.toHaveProperty("ourOfferBand");
  });
});
