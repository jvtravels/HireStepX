/* PDF #18 follow-up (2026-05-15) — strict ordered discovery sequence
 *
 * The default `getNextDiscoveryQuestion` is a priority-cascade over
 * the `Asked` flags. Per user-evaluation of PDF #18, the real-HR
 * sequence MUST run currentCtc → current-fix/var → expected →
 * expected-fix/var → notice → competing → valueProof and gate
 * strictly on the *answered* flag at each step. This test pins the
 * new ordered-by-answered helper to that contract. */
import { describe, it, expect } from "vitest";
import {
  EMPTY_DISCOVERY_CHECKLIST,
  DISCOVERY_SEQUENCE,
  getNextOrderedDiscoveryItem,
  getNextOrderedDiscoveryQuestion,
  isOrderedDiscoveryComplete,
  backfillDiscoveryChecklist,
  type DiscoveryChecklist,
} from "../../server-handlers/_discovery-stage";

describe("ordered discovery sequence", () => {
  it("DISCOVERY_SEQUENCE is the seven-item canonical order", () => {
    expect([...DISCOVERY_SEQUENCE]).toEqual([
      "currentCtcAnswered",
      "currentCtcFixedVariableSplitDisclosed",
      "targetAnswered",
      "expectedCtcFixedVariableSplitDisclosed",
      "noticePeriodAnswered",
      "competingOffersAnswered",
      "valueProofAnswered",
    ]);
  });

  it("starts with currentCtcAnswered on a fresh checklist", () => {
    expect(
      getNextOrderedDiscoveryItem(EMPTY_DISCOVERY_CHECKLIST, "engineering"),
    ).toBe("currentCtcAnswered");
  });

  it("does NOT advance past current CTC until current CTC is answered (even if later items are flagged)", () => {
    /* Even though the legacy checklist says competing has been
     * ANSWERED, the ordered helper still demands currentCtc first. */
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      competingOffersAnswered: true,
      noticePeriodAnswered: true,
    };
    expect(getNextOrderedDiscoveryItem(c, "engineering")).toBe(
      "currentCtcAnswered",
    );
  });

  it("after currentCtc answered, asks for current CTC fix/var split BEFORE expected/target", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
    };
    expect(getNextOrderedDiscoveryItem(c, "engineering")).toBe(
      "currentCtcFixedVariableSplitDisclosed",
    );
  });

  it("after current CTC + its split, asks for expected/target CTC", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
      currentCtcFixedVariableSplitDisclosed: true,
    };
    expect(getNextOrderedDiscoveryItem(c, "engineering")).toBe("targetAnswered");
  });

  it("legacy fixedVariableSplitAnswered satisfies BOTH split slots (back-compat)", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
      fixedVariableSplitAnswered: true,
      targetAnswered: true,
    };
    expect(getNextOrderedDiscoveryItem(c, "engineering")).toBe(
      "noticePeriodAnswered",
    );
  });

  it("never asks for expected/target split before target itself is known", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
      currentCtcFixedVariableSplitDisclosed: true,
    };
    /* targetAnswered === false, so the expected split is auto-satisfied
     * (we can't ask the split of an unknown number); next pending is
     * targetAnswered itself. */
    expect(getNextOrderedDiscoveryItem(c, "engineering")).toBe("targetAnswered");
  });

  it("notice → competing → valueProof in that order for engineering", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
      currentCtcFixedVariableSplitDisclosed: true,
      targetAnswered: true,
      expectedCtcFixedVariableSplitDisclosed: true,
    };
    expect(getNextOrderedDiscoveryItem(c, "engineering")).toBe(
      "noticePeriodAnswered",
    );
    c.noticePeriodAnswered = true;
    expect(getNextOrderedDiscoveryItem(c, "engineering")).toBe(
      "competingOffersAnswered",
    );
    c.competingOffersAnswered = true;
    expect(getNextOrderedDiscoveryItem(c, "engineering")).toBe(
      "valueProofAnswered",
    );
    c.valueProofAnswered = true;
    expect(getNextOrderedDiscoveryItem(c, "engineering")).toBeNull();
  });

  it("families that don't require valueProof terminate after competing", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
      currentCtcFixedVariableSplitDisclosed: true,
      targetAnswered: true,
      expectedCtcFixedVariableSplitDisclosed: true,
      noticePeriodAnswered: true,
      competingOffersAnswered: true,
    };
    expect(getNextOrderedDiscoveryItem(c, "marketing")).toBeNull();
    expect(isOrderedDiscoveryComplete(c, "marketing")).toBe(true);
    /* But for engineering, valueProof is still outstanding. */
    expect(getNextOrderedDiscoveryItem(c, "engineering")).toBe(
      "valueProofAnswered",
    );
    expect(isOrderedDiscoveryComplete(c, "engineering")).toBe(false);
  });

  it("getNextOrderedDiscoveryQuestion prompt mentions THAT package on current-split slot", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
    };
    const q = getNextOrderedDiscoveryQuestion(c, "engineering");
    expect(q?.prompt.toLowerCase()).toContain("current");
    expect(q?.prompt.toLowerCase()).toMatch(/fixed.*variable/);
  });

  it("getNextOrderedDiscoveryQuestion prompt distinguishes target-split from current-split", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
      currentCtcFixedVariableSplitDisclosed: true,
      targetAnswered: true,
    };
    const q = getNextOrderedDiscoveryQuestion(c, "engineering");
    expect(q?.prompt.toLowerCase()).toMatch(/target|expected/);
  });

  it("backfill round-trips both new optional flags", () => {
    const c = backfillDiscoveryChecklist({
      currentCtcFixedVariableSplitDisclosed: true,
      expectedCtcFixedVariableSplitDisclosed: false,
    });
    expect(c.currentCtcFixedVariableSplitDisclosed).toBe(true);
    expect(c.expectedCtcFixedVariableSplitDisclosed).toBe(false);
    /* Default empty backfill — both false. */
    const empty = backfillDiscoveryChecklist({});
    expect(empty.currentCtcFixedVariableSplitDisclosed).toBe(false);
    expect(empty.expectedCtcFixedVariableSplitDisclosed).toBe(false);
  });

  it("isOrderedDiscoveryComplete is true for a fully-cleared engineering session", () => {
    const c: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAnswered: true,
      currentCtcFixedVariableSplitDisclosed: true,
      targetAnswered: true,
      expectedCtcFixedVariableSplitDisclosed: true,
      noticePeriodAnswered: true,
      competingOffersAnswered: true,
      valueProofAnswered: true,
    };
    expect(isOrderedDiscoveryComplete(c, "engineering")).toBe(true);
    expect(isOrderedDiscoveryComplete(EMPTY_DISCOVERY_CHECKLIST, "engineering")).toBe(false);
  });
});
