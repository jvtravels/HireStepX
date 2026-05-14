/* PDF #17 architectural fix (2026-05-15) — discovery-checklist
 * progression + anchor-gate tests. */
import { describe, it, expect } from "vitest";
import {
  EMPTY_DISCOVERY_CHECKLIST,
  backfillDiscoveryChecklist,
  getRequiredDiscoveryItems,
  isDiscoveryComplete,
  getNextDiscoveryQuestion,
  isValidDiscoveryStage,
  type DiscoveryChecklist,
} from "../../server-handlers/_discovery-stage";

describe("discovery checklist progression", () => {
  it("EMPTY checklist has every flag false", () => {
    for (const v of Object.values(EMPTY_DISCOVERY_CHECKLIST)) {
      expect(v).toBe(false);
    }
  });

  it("isDiscoveryComplete returns false for a fresh checklist", () => {
    expect(isDiscoveryComplete(EMPTY_DISCOVERY_CHECKLIST, "engineering")).toBe(
      false,
    );
  });

  it("isDiscoveryComplete returns true when all required items are answered (engineering)", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
      fixedVariableSplitAnswered: true,
      noticePeriodAnswered: true,
      valueProofAnswered: true,
      targetAnswered: true,
    };
    expect(isDiscoveryComplete(c, "engineering")).toBe(true);
  });

  it("CSM requires valueProof as a separate gate", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
      fixedVariableSplitAnswered: true,
      noticePeriodAnswered: true,
      targetAnswered: true,
    };
    // valueProof not yet answered
    expect(isDiscoveryComplete(c, "csm-cs")).toBe(false);
    c.valueProofAnswered = true;
    expect(isDiscoveryComplete(c, "csm-cs")).toBe(true);
  });

  it("marketing / data / ops do NOT require valueProof", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
      fixedVariableSplitAnswered: true,
      noticePeriodAnswered: true,
      targetAnswered: true,
    };
    expect(isDiscoveryComplete(c, "marketing")).toBe(true);
    expect(isDiscoveryComplete(c, "data")).toBe(true);
    expect(isDiscoveryComplete(c, "ops")).toBe(true);
  });

  it("getRequiredDiscoveryItems returns the 4 base items for marketing", () => {
    expect(getRequiredDiscoveryItems("marketing")).toEqual([
      "currentCtcAnswered",
      "fixedVariableSplitAnswered",
      "noticePeriodAnswered",
      "targetAnswered",
    ]);
  });

  it("getRequiredDiscoveryItems includes valueProof for sales", () => {
    expect(getRequiredDiscoveryItems("sales")).toContain("valueProofAnswered");
  });

  it("getNextDiscoveryQuestion asks currentCtc first", () => {
    const q = getNextDiscoveryQuestion(EMPTY_DISCOVERY_CHECKLIST, "engineering");
    expect(q?.item).toBe("currentCtcAsked");
    expect(q?.prompt).toMatch(/current\s+CTC/i);
  });

  it("getNextDiscoveryQuestion advances after currentCtc is asked", () => {
    const c: DiscoveryChecklist = { ...EMPTY_DISCOVERY_CHECKLIST, currentCtcAsked: true };
    const q = getNextDiscoveryQuestion(c, "engineering");
    expect(q?.item).toBe("fixedVariableSplitAsked");
  });

  it("getNextDiscoveryQuestion returns null when all items are asked", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAsked: true,
      fixedVariableSplitAsked: true,
      noticePeriodAsked: true,
      competingOffersAsked: true,
      valueProofAsked: true,
      targetAsked: true,
    };
    expect(getNextDiscoveryQuestion(c, "csm-cs")).toBeNull();
  });

  it("CSM value-proof prompt mentions ARR / book / retention", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAsked: true,
      fixedVariableSplitAsked: true,
      noticePeriodAsked: true,
      competingOffersAsked: true,
    };
    const q = getNextDiscoveryQuestion(c, "csm-cs");
    expect(q?.item).toBe("valueProofAsked");
    expect(q?.prompt.toLowerCase()).toMatch(/arr|book|retention/);
  });

  it("backfillDiscoveryChecklist coerces missing keys to false", () => {
    const partial = { currentCtcAsked: true };
    const c = backfillDiscoveryChecklist(partial);
    expect(c.currentCtcAsked).toBe(true);
    expect(c.fixedVariableSplitAsked).toBe(false);
    expect(c.commitmentValidationAsked).toBe(false);
  });

  it("isValidDiscoveryStage accepts the known stages", () => {
    for (const s of [
      "probe-mismatch",
      "discovery",
      "anchor",
      "negotiation",
      "commitment-test",
      "closing",
      "terminal",
    ]) {
      expect(isValidDiscoveryStage(s)).toBe(true);
    }
    expect(isValidDiscoveryStage("unknown")).toBe(false);
    expect(isValidDiscoveryStage(42)).toBe(false);
  });
});
