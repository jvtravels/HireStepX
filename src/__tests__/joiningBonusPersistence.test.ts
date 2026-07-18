/* S4S5-B3 + S4S5-B4 regression suite (2026-07-18).
 *
 * Root cause: when a recruiter offered a joining bonus during negotiation,
 * the kernel tracked it in `state.lastJoiningBonusOffered` but the value was
 * dropped at three points:
 *   1. save-session.ts sanitizer didn't persist it → lost after DB save/reload
 *   2. DealSummaryCard (live session) showed "Final Package ₹X LPA" with no
 *      mention of the joining bonus
 *   3. CounterOfferLetterPanel accepted email said "accepted at ₹X LPA CTC"
 *      with no mention of the bonus (the actual deal included ₹Y more)
 *
 * Fixes:
 *   (a) `_negotiation-metrics.ts` now carries `lastJoiningBonusOffered` through
 *   (b) `save-session.ts` sanitizer persists it
 *   (c) `adapter.ts adoptKernelOutcome` surfaces it as `joiningBonusLpa`
 *   (d) `CounterOfferLetterPanel` amends the acceptance line when JB is present
 *   (e) `SessionReport.tsx` derives and passes `offerNetValue` so
 *       `OfferEconomicsPanel` finally renders
 *   (f) `DealSummaryCard` accepts `joiningBonusLpa` prop and shows the full deal
 */
import { describe, it, expect } from "vitest";
import { sanitizeNegotiationMetrics } from "../../server-handlers/save-session";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const STANDARD_BAND: NegotiationBand = {
  initialOffer: 30,
  maxStretch: 45,
  walkAway: 20,
  hasEquity: true,
};

describe("S4S5-B3 — joining bonus persists through save-session sanitizer", () => {
  it("sanitizeNegotiationMetrics preserves lastJoiningBonusOffered when present", () => {
    const raw = {
      outcome: "accepted" as const,
      anchorTurn: 2,
      leverDiversity: 3,
      lpaGained: 4,
      lpaPerTurn: 0.5,
      bandTraversal: 0.7,
      overBandViolation: false,
      totalTurns: 6,
      score: 80,
      initialOfferLpa: 30,
      finalOfferLpa: 38,
      candidateAskLpa: 42,
      offerTrajectoryLpa: [30, 34, 38],
      lastJoiningBonusOffered: 3,
    };
    const result = sanitizeNegotiationMetrics(raw);
    expect(result).not.toBeNull();
    expect(result!.lastJoiningBonusOffered).toBe(3);
  });

  it("sanitizeNegotiationMetrics omits lastJoiningBonusOffered when null", () => {
    const raw = {
      outcome: "accepted" as const,
      anchorTurn: 1,
      leverDiversity: 2,
      lpaGained: 2,
      lpaPerTurn: 0.4,
      bandTraversal: 0.5,
      overBandViolation: false,
      totalTurns: 4,
      score: 70,
      initialOfferLpa: 30,
      finalOfferLpa: 35,
      candidateAskLpa: 38,
      offerTrajectoryLpa: [30, 35],
      lastJoiningBonusOffered: null,
    };
    const result = sanitizeNegotiationMetrics(raw);
    expect(result).not.toBeNull();
    expect(result!.lastJoiningBonusOffered).toBeUndefined();
  });

  it("sanitizeNegotiationMetrics clamps lastJoiningBonusOffered to [0, 500]", () => {
    const raw = {
      outcome: "accepted" as const,
      anchorTurn: 1,
      leverDiversity: 2,
      lpaGained: 2,
      lpaPerTurn: 0.4,
      bandTraversal: 0.5,
      overBandViolation: false,
      totalTurns: 4,
      score: 70,
      initialOfferLpa: 30,
      finalOfferLpa: 35,
      candidateAskLpa: 38,
      offerTrajectoryLpa: [30, 35],
      lastJoiningBonusOffered: 9999,
    };
    const result = sanitizeNegotiationMetrics(raw);
    expect(result!.lastJoiningBonusOffered).toBe(500);
  });
});

describe("S4S5-B3 — kernel tracks lastJoiningBonusOffered end-to-end", () => {
  it("applyCandidateAnswer on a JB-stamped state preserves lastJoiningBonusOffered", () => {
    /* Mirror the approach from closeRecapFormal.test.ts: set the field
       directly on the init state (avoids the applyAiMove DiscoveryTopic
       validator which is stricter in non-production test runs). */
    const base = initState({
      sessionId: "jb-e2e-1",
      role: "Software Engineer",
      company: "Flipkart",
      band: STANDARD_BAND,
    });
    const stateWithJb = { ...base, lastJoiningBonusOffered: 3, highestOfferMade: 32 } as typeof base;

    /* A candidate turn after JB was offered — state should carry through. */
    const next = applyCandidateAnswer(
      stateWithJb,
      "That joining bonus helps a lot, I can accept the offer.",
    );

    expect(next.lastJoiningBonusOffered).toBe(3);
  });

  it("lastJoiningBonusOffered is null at initState when no joining bonus offered", () => {
    const state = initState({
      sessionId: "jb-e2e-2",
      role: "Software Engineer",
      company: "TCS",
      band: STANDARD_BAND,
    });
    expect(state.lastJoiningBonusOffered).toBeNull();
  });
});

describe("S4S5-B3 — computeNegotiationMetrics surfaces lastJoiningBonusOffered", () => {
  it("includes lastJoiningBonusOffered in returned metrics when JB was offered", async () => {
    const { computeNegotiationMetrics } = await import(
      "../../server-handlers/_negotiation-metrics"
    );
    const base = initState({
      sessionId: "jb-metrics-1",
      role: "PM",
      company: "Razorpay",
      band: STANDARD_BAND,
    });
    const finalState = { ...base, lastJoiningBonusOffered: 5, highestOfferMade: 32 } as typeof base;

    const metrics = computeNegotiationMetrics({
      finalState,
      moves: [
        { lever: "initial-offer" as const, newTotalLpa: 30, turnIndex: 1, candidateTargetAtTurn: null },
        { lever: "joining-bonus" as const, newTotalLpa: null, turnIndex: 2, candidateTargetAtTurn: null },
      ],
    });

    expect(metrics.lastJoiningBonusOffered).toBe(5);
  });

  it("returns null for lastJoiningBonusOffered when no JB offered", async () => {
    const { computeNegotiationMetrics } = await import(
      "../../server-handlers/_negotiation-metrics"
    );
    const finalState = initState({
      sessionId: "jb-metrics-2",
      role: "PM",
      company: "Infosys",
      band: STANDARD_BAND,
    });

    const metrics = computeNegotiationMetrics({
      finalState,
      moves: [
        { lever: "initial-offer" as const, newTotalLpa: 30, turnIndex: 1, candidateTargetAtTurn: null },
      ],
    });

    expect(metrics.lastJoiningBonusOffered).toBeNull();
  });
});
