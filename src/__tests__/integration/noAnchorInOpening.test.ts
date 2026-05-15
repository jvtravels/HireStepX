/* F6 (PDF#20 2026-05-15) — validateNoSpecificNumberInOpening critical validator.
 *
 * Problem: even after F1 removed the turnIndex >= 1 gate, if the LLM still
 * emits a specific number in the opening phase (e.g. "₹27 LPA"), no critical
 * validator fires — bad text ships.
 *
 * Fix: validateNoSpecificNumberInOpening returns valid:false when phase=opening
 * AND discovery is not complete AND the reply contains a specific number.
 * Tagged critical:true so F2 substitution engages.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { validateNoSpecificNumberInOpening } from "../../../server-handlers/_response-validators";
import { EMPTY_DISCOVERY_CHECKLIST } from "../../../server-handlers/_discovery-stage";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

const fresh = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "s-f6",
    role: "Software Engineer",
    company: "acme",
    band: BAND,
  }),
  ...overrides,
});

describe("F6 — validateNoSpecificNumberInOpening", () => {
  it("rejects a specific rupee anchor (₹27 LPA) in opening phase before discovery is complete", () => {
    const state = fresh();
    expect(state.phase).toBe("opening");
    const result = validateNoSpecificNumberInOpening("We would like to offer you ₹27 LPA for this role.", state);
    expect(result.valid).toBe(false);
    expect(result.critical).toBe(true);
    expect(result.reason).toMatch(/opening-phase anchor/i);
  });

  it("rejects plain numeric anchors with various units (18 LPA, 18.5L, 20 lakh)", () => {
    const state = fresh();
    for (const reply of [
      "We can offer you 18 LPA.",
      "The package would be 18.5L.",
      "We're looking at 20 lakh per annum.",
    ]) {
      const result = validateNoSpecificNumberInOpening(reply, state);
      expect(result.valid).toBe(false);
    }
  });

  it("rejects ₹ + digit patterns without unit (₹27)", () => {
    const state = fresh();
    const result = validateNoSpecificNumberInOpening("The offer is ₹27.", state);
    expect(result.valid).toBe(false);
  });

  it("passes when the reply has no specific number (discovery question)", () => {
    const state = fresh();
    const result = validateNoSpecificNumberInOpening(
      "Could you tell me about your current compensation and what you're targeting?",
      state,
    );
    expect(result.valid).toBe(true);
  });

  it("passes when phase is not opening (e.g. offer-presented)", () => {
    const state = fresh({ phase: "offer-presented" });
    const result = validateNoSpecificNumberInOpening("The offer is ₹27 LPA.", state);
    expect(result.valid).toBe(true);
  });

  it("passes when discovery is complete even in opening phase", () => {
    const state = fresh({
      discoveryChecklist: {
        ...EMPTY_DISCOVERY_CHECKLIST,
        currentCtcAnswered: true,
        fixedVariableSplitAnswered: true,
        noticePeriodAnswered: true,
        competingOffersAnswered: true,
        valueProofAnswered: true,
        targetAnswered: true,
      },
    });
    const result = validateNoSpecificNumberInOpening("The offer is ₹27 LPA.", state);
    expect(result.valid).toBe(true);
  });
});
