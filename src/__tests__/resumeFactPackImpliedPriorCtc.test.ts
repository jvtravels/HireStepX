/* ResumeFactPack track — Step 5 (2026-05-16).
 *
 * When the candidate withholds currentCtc, the kernel should fall back to
 * the resume-implied prior CTC as a counter-offer floor / hike-cap basis.
 * Without this, a strong-resume candidate who refuses to share currentCtc
 * could see the counter-base collapse toward the initial offer / anchor.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import type { ResumeFactPack } from "../../server-handlers/_resume-fact-pack";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 32,
  walkAway: 15,
  displayLabel: "",
  hasEquity: false,
};

function makePack(latestCompany: string, tier: ResumeFactPack["latestRole"] extends { companyTier: infer T } ? T : never): ResumeFactPack {
  return {
    priorCompanies: [{ name: latestCompany, tier, tenureMonths: 24 }],
    stackTags: ["react"],
    tenurePattern: "stable",
    mbaTier: null,
    leadershipClaimed: false,
    gapMonths: null,
    latestRole: { title: "SDE-2", companyName: latestCompany, companyTier: tier },
  };
}

function makeCounterState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  const base = initState({ sessionId: "s", role: "swe", company: "Acme", band: BAND });
  return {
    ...base,
    phase: "counter-offer",
    turnIndex: 3,
    highestOfferMade: 22,
    candidateTarget: 30,
    candidateCurrentCtc: null, // withheld
    /* satisfy probe-justification gate (it fires when target>5% over initial AND
     * no probe-justification AND no counter-base yet AND no currentCtc AND no
     * competing — we want to bypass that branch so the counter-base math runs).
     * Easiest: pretend probe-justification already fired. */
    leversUsed: ["probe-justification"],
    ...overrides,
  };
}

describe("ResumeFactPack — impliedPriorCtcFromResume as counter floor", () => {
  it("with no pack: floor = max(highestOffer, anchor); priorCtcFloor absent from rationale", () => {
    const s = makeCounterState();
    const action = planNextAction(s);
    expect(action.kind).toBe("counter-offer");
    if (action.kind === "counter-offer") {
      expect(action._move.rationale).not.toMatch(/priorCtcFloor/);
    }
  });

  it("with strong resume (FAANG-equivalent unicorn) AND withheld currentCtc: rationale records priorCtcFloor and counter is not below it", () => {
    const pack = makePack("Flipkart", "unicorn");
    const s = makeCounterState({
      resumeFactPack: pack,
      impliedPriorCtcFromResume: 26, // explicit so the test is independent of band-tier projection
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("counter-offer");
    if (action.kind === "counter-offer") {
      expect(action._move.rationale).toMatch(/priorCtcFloor ₹26/);
      // newTotal must respect the prior-ctc floor (>= 26)
      expect(action.counterTotalLpa).toBeGreaterThanOrEqual(26);
    }
  });

  it("stated currentCtc takes precedence over impliedPriorCtcFromResume (resume floor inert)", () => {
    const pack = makePack("Flipkart", "unicorn");
    const s = makeCounterState({
      resumeFactPack: pack,
      impliedPriorCtcFromResume: 26,
      candidateCurrentCtc: 18, // candidate disclosed lower — should NOT be overridden
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("counter-offer");
    if (action.kind === "counter-offer") {
      // priorCtcFloor only kicks in when candidateCurrentCtc is null
      expect(action._move.rationale).not.toMatch(/priorCtcFloor/);
    }
  });
});
