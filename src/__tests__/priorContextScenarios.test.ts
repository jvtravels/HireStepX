/* Prior-context scenarios (2026-05-29).
 *
 * Covers the four new NextAction kinds driven by caller-declared
 * priorContext at session init:
 *   - acknowledge-existing-offer
 *   - acknowledge-retention-offer
 *   - match-existing-offer-prose
 *   - retention-trump-warning
 *
 * Each is verified to (a) fire under the declared context on the
 * correct turn / state, and (b) NOT fire when the context block is
 * absent or its preconditions are unmet. The sub-planner
 * `maybePlanPriorContextAction` is exercised directly so the suite
 * doesn't couple to the upstream cascade order.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
  type PriorContext,
  type DiscoveryTopic,
} from "../../server-handlers/_negotiation-kernel";
import {
  maybePlanPriorContextAction,
  planNextAction,
} from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: true,
};

const make = (
  priorContext?: PriorContext,
  overrides: Partial<NegotiationState> = {},
): NegotiationState => ({
  ...initState({
    sessionId: "prior-ctx-test",
    role: "swe",
    company: "acme",
    band: BAND,
    priorContext,
  }),
  ...overrides,
});

describe("acknowledge-existing-offer", () => {
  it("fires on turn 1 when priorContext.existingCompetingOffer is declared", () => {
    const s = make(
      {
        existingCompetingOffer: {
          company: "PhonePe",
          amountLpa: 26,
          signed: true,
        },
      },
      { turnIndex: 1 },
    );
    const a = maybePlanPriorContextAction(s);
    expect(a).not.toBeNull();
    expect(a!.kind).toBe("acknowledge-existing-offer");
    if (a!.kind === "acknowledge-existing-offer") {
      expect(a!.company).toBe("PhonePe");
      expect(a!.amountLpa).toBe(26);
      expect(a!.signed).toBe(true);
    }
  });

  it("does NOT fire when priorContext is absent", () => {
    const s = make(undefined, { turnIndex: 1 });
    const a = maybePlanPriorContextAction(s);
    expect(a).toBeNull();
  });

  it("does NOT re-fire once stamped in reactiveFollowupsFired", () => {
    const s = make(
      {
        existingCompetingOffer: {
          company: "PhonePe",
          amountLpa: 26,
          signed: false,
        },
      },
      {
        turnIndex: 2,
        reactiveFollowupsFired: ["acknowledge-existing-offer" as DiscoveryTopic],
      },
    );
    const a = maybePlanPriorContextAction(s);
    expect(a?.kind).not.toBe("acknowledge-existing-offer");
  });
});

describe("acknowledge-retention-offer", () => {
  it("fires on turn 1 when priorContext.retentionOffer is declared", () => {
    const s = make(
      {
        retentionOffer: {
          fromCurrentEmployer: true,
          amountLpa: 22,
          tenure: "immediate",
        },
      },
      { turnIndex: 1 },
    );
    const a = maybePlanPriorContextAction(s);
    expect(a).not.toBeNull();
    expect(a!.kind).toBe("acknowledge-retention-offer");
    if (a!.kind === "acknowledge-retention-offer") {
      expect(a!.amountLpa).toBe(22);
      expect(a!.tenure).toBe("immediate");
    }
  });

  it("does NOT fire when only existingCompetingOffer is declared (retention absent)", () => {
    const s = make(
      {
        existingCompetingOffer: {
          company: "PhonePe",
          amountLpa: 26,
          signed: false,
        },
      },
      {
        turnIndex: 1,
        /* Pretend existing-offer ack already fired so we can see whether
         * retention-ack falls through — it shouldn't because retention
         * isn't declared. */
        reactiveFollowupsFired: ["acknowledge-existing-offer" as DiscoveryTopic],
      },
    );
    const a = maybePlanPriorContextAction(s);
    expect(a?.kind).not.toBe("acknowledge-retention-offer");
  });
});

describe("retention-trump-warning", () => {
  it("fires mid-stage when retentionOffer.amountLpa >= currentCtc * 1.25", () => {
    const s = make(
      {
        retentionOffer: {
          fromCurrentEmployer: true,
          amountLpa: 25, // 25 / 20 = 1.25
          tenure: "cycleEnd",
        },
      },
      {
        turnIndex: 4,
        candidateCurrentCtc: 20,
        /* Suppress the turn-1-2 ack arm so the gate falls through to
         * the mid-stage warning. */
        reactiveFollowupsFired: ["acknowledge-retention-offer" as DiscoveryTopic],
      },
    );
    const a = maybePlanPriorContextAction(s);
    expect(a).not.toBeNull();
    expect(a!.kind).toBe("retention-trump-warning");
    if (a!.kind === "retention-trump-warning") {
      expect(a!.retentionLpa).toBe(25);
      expect(a!.currentCtcLpa).toBe(20);
    }
  });

  it("does NOT fire when retention is below 1.25× currentCtc", () => {
    const s = make(
      {
        retentionOffer: {
          fromCurrentEmployer: true,
          amountLpa: 22, // 22 / 20 = 1.1 — below threshold
          tenure: "midYear",
        },
      },
      {
        turnIndex: 4,
        candidateCurrentCtc: 20,
        reactiveFollowupsFired: ["acknowledge-retention-offer" as DiscoveryTopic],
      },
    );
    const a = maybePlanPriorContextAction(s);
    expect(a?.kind).not.toBe("retention-trump-warning");
  });
});

describe("match-existing-offer-prose", () => {
  it("fires mid-stage when candidate cites the existing offer (pushback)", () => {
    const s = make(
      {
        existingCompetingOffer: {
          company: "PhonePe",
          amountLpa: 26,
          signed: true,
        },
      },
      {
        turnIndex: 4,
        candidateCurrentCtc: 20,
        candidateTarget: 28,
        reactiveFollowupsFired: ["acknowledge-existing-offer" as DiscoveryTopic],
        conversationLog: [
          {
            speaker: "candidate",
            text: "I already have an offer from PhonePe at 26 LPA, can you match it?",
          },
        ],
      },
    );
    const a = maybePlanPriorContextAction(s);
    expect(a).not.toBeNull();
    expect(a!.kind).toBe("match-existing-offer-prose");
    if (a!.kind === "match-existing-offer-prose") {
      expect(a!.competingAmountLpa).toBe(26);
      expect(a!.withinBand).toBe(true); // 26 <= maxStretch 28
    }
  });

  it("emits withinBand=false when competing amount sits above band.maxStretch", () => {
    const s = make(
      {
        existingCompetingOffer: {
          company: "PhonePe",
          amountLpa: 40, // above maxStretch 28
          signed: true,
        },
      },
      {
        turnIndex: 4,
        candidateCurrentCtc: 20,
        reactiveFollowupsFired: ["acknowledge-existing-offer" as DiscoveryTopic],
        conversationLog: [
          {
            speaker: "candidate",
            text: "But I already have PhonePe at 40 LPA — you'll have to match it.",
          },
        ],
      },
    );
    const a = maybePlanPriorContextAction(s);
    expect(a?.kind).toBe("match-existing-offer-prose");
    if (a?.kind === "match-existing-offer-prose") {
      expect(a.withinBand).toBe(false);
    }
  });

  it("does NOT fire when the candidate utterance doesn't reference the offer", () => {
    const s = make(
      {
        existingCompetingOffer: {
          company: "PhonePe",
          amountLpa: 26,
          signed: true,
        },
      },
      {
        turnIndex: 4,
        candidateCurrentCtc: 20,
        reactiveFollowupsFired: ["acknowledge-existing-offer" as DiscoveryTopic],
        conversationLog: [
          {
            speaker: "candidate",
            text: "What is the notice period for this role?",
          },
        ],
      },
    );
    const a = maybePlanPriorContextAction(s);
    expect(a?.kind).not.toBe("match-existing-offer-prose");
  });
});

describe("planNextAction integration — priorContext shapes the early turns", () => {
  it("returns acknowledge-existing-offer through the top-level planner on turn 1", () => {
    const s = make(
      {
        existingCompetingOffer: {
          company: "Razorpay",
          amountLpa: 24,
          signed: false,
          deadline: "Friday",
        },
      },
      { turnIndex: 1 },
    );
    const action = planNextAction(s);
    expect(action.kind).toBe("acknowledge-existing-offer");
  });

  it("falls through to the normal cascade when no priorContext is declared", () => {
    const s = make(undefined, { turnIndex: 1 });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("acknowledge-existing-offer");
    expect(action.kind).not.toBe("acknowledge-retention-offer");
    expect(action.kind).not.toBe("retention-trump-warning");
    expect(action.kind).not.toBe("match-existing-offer-prose");
  });
});
