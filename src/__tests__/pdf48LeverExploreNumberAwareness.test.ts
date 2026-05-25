/* PDF#48 B2 (2026-05-25) — number-aware lever-explore.
 *
 * Captured in the Flipkart Sr PD session: candidate counter-anchored
 * with "sure 46 LPA" after we anchored at ₹42.4L. Planner picked
 * lever-explore (counter above cash band) but the canonical
 * line emitted was generic — "Let me see what else we can structure
 * on the fitment." — with no engagement of the ₹46L number. Real
 * recruiters acknowledge the stated number before pivoting to
 * non-cash levers.
 *
 * Verifies that when state.lastCandidateCounterLpa is set, the
 * lever-explore canonical surfaces the number; when no counter is
 * on file, the generic line ships unchanged (regression guard for
 * the legacy callsites).
 */
import { describe, it, expect } from "vitest";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 44,
  walkAway: 36,
  hasEquity: true,
};

function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    ...initState({ sessionId: "s-pdf48", role: "sr-pd", company: "flipkart", band: BAND }),
    ...overrides,
  };
}

describe("PDF#48 B2 — lever-explore engages the candidate's counter number", () => {
  const action: NextAction = { kind: "lever-explore", from: "default" } as NextAction;

  it("acknowledges the ₹46L counter when lastCandidateCounterLpa is set", () => {
    const state = mkState({
      lastCandidateCounterLpa: 46,
      candidateTarget: 46,
      highestOfferMade: 42.4,
      phase: "counter-offer",
    });
    const prose = renderCanonicalProse(action, state);
    expect(prose).toContain("46");
    expect(prose).toMatch(/above the cash band|cash band/i);
    expect(prose).toMatch(/see what else|structure|put together/i);
  });

  it("ships the generic canonical when no candidate counter is on file", () => {
    const state = mkState({ lastCandidateCounterLpa: null });
    const prose = renderCanonicalProse(action, state);
    expect(prose).toBe("Let me see what else we can structure on the fitment.");
  });

  it("does not emit the banned drift phrase 'explore the fitment further'", () => {
    const state = mkState({ lastCandidateCounterLpa: 46 });
    const prose = renderCanonicalProse(action, state);
    expect(prose).not.toMatch(/explore the fitment further/i);
  });
});
