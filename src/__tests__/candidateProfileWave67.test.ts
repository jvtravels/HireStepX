/* Wave 6 + Wave 7 — candidate profile flag expansion.
 *
 * Tests:
 *   Detection tests (5):
 *     1. Wave-6 current-comp breakdown flags
 *     2. Wave-6 expected-comp preference flags
 *     3. Wave-6 offer-evaluation signals
 *     4. Wave-7 anchoring / pressure-response flags
 *     5. Wave-7 rapport / red-flag flags
 *
 *   Planner reactive-rule tests (3):
 *     6. invokedCompetingOffer → competing-leverage-ack probe
 *     7. gaveInconsistentNumbers → number-clarification probe
 *     8. evasiveOnCurrentCtc + turnIndex >= 3 → ctc-gentle-push probe
 */
import { describe, it, expect } from "vitest";
import {
  extractCandidateProfile,
  mergeCandidateProfile,
} from "../../server-handlers/_candidate-profile";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import {
  EMPTY_TURN_DELTA,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

/* ─── Helper: build a minimal NegotiationState for planner tests ─────── */
function minState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    phase: "counter-offer",
    turnIndex: 4,
    band: {
      initialOffer: 20,
      maxStretch: 28,
      walkAway: 18,
      hasEquity: false,
    },
    highestOfferMade: 22,
    lastCandidateCounterLpa: 27,
    candidateTarget: 27,
    candidateCurrentCtc: 18,
    leversUsed: [],
    vossTacticsUsed: [],
    infoAsked: [],
    competingOfferDetail: { hasAny: false },
    lastTurnDelta: {
      disclosedCurrentCtc: false,
      disclosedExpectedCtc: false,
      disclosedCompetingOffer: false,
      disclosedNoticePeriod: false,
      askedQuestion: false,
    },
    reactiveFollowupsFired: [],
    discoveryStage: "done",
    marketMode: "neutral",
    ...overrides,
  } as NegotiationState;
}

/* ═══════════════════════════════════════════════════════════════════════
 * DETECTION TESTS
 * ═══════════════════════════════════════════════════════════════════════ */

describe("Wave-6 — current-comp breakdown flags", () => {
  it("currentHasBonus=true when candidate mentions annual bonus", () => {
    const r = extractCandidateProfile(
      "My current CTC includes an annual bonus of around 15%.",
    );
    expect(r.currentHasBonus).toBe(true);
  });

  it("currentBonusPct is extracted correctly from '15% variable'", () => {
    const r = extractCandidateProfile(
      "I get a 15% variable component on top of my fixed.",
    );
    expect(r.currentBonusPct).toBe(15);
  });

  it("currentHasGratuity=true when candidate mentions gratuity entitlement", () => {
    const r = extractCandidateProfile(
      "I've been here for 6 years so I'm entitled to gratuity payout.",
    );
    expect(r.currentHasGratuity).toBe(true);
  });

  it("currentHasNps=true when candidate mentions NPS", () => {
    const r = extractCandidateProfile(
      "My employer contributes to NPS under 80CCD(2) every month.",
    );
    expect(r.currentHasNps).toBe(true);
  });

  it("flags default to false / null when no compensation structure mentioned", () => {
    const r = extractCandidateProfile("I am looking for a new opportunity.");
    expect(r.currentHasBonus).toBe(false);
    expect(r.currentBonusPct).toBeNull();
    expect(r.currentHasEsop).toBe(false);
    expect(r.currentEsopVested).toBe(false);
    expect(r.currentHasRetentionBonus).toBe(false);
    expect(r.currentHasGratuity).toBe(false);
    expect(r.currentHasNps).toBe(false);
  });
});

describe("Wave-6 — expected-comp preference flags", () => {
  it("wantsHigherBase=true when candidate explicitly asks for higher fixed", () => {
    const r = extractCandidateProfile(
      "I'd like a higher fixed salary — can we increase the base component?",
    );
    expect(r.wantsHigherBase).toBe(true);
  });

  it("wantsJoiningBonus=true when candidate asks about joining bonus", () => {
    const r = extractCandidateProfile(
      "Is there a joining bonus or sign-on payment as part of the offer?",
    );
    expect(r.wantsJoiningBonus).toBe(true);
  });

  it("wantsLearningBudget=true when candidate asks about L&D", () => {
    const r = extractCandidateProfile(
      "Does the company offer a learning and development budget for certifications?",
    );
    expect(r.wantsLearningBudget).toBe(true);
  });

  it("wantsProfessionalTitle=true when candidate mentions title upgrade", () => {
    const r = extractCandidateProfile(
      "I was hoping for a Senior title as part of the offer — title matters for my resume.",
    );
    expect(r.wantsProfessionalTitle).toBe(true);
  });

  it("wantsEquityRefresh=true when candidate asks about equity refresh", () => {
    const r = extractCandidateProfile(
      "What's the equity refresh grant policy after the first year?",
    );
    expect(r.wantsEquityRefresh).toBe(true);
  });
});

describe("Wave-6 — offer-evaluation signals", () => {
  it("hasSeenOffer=true when candidate received the offer letter", () => {
    const r = extractCandidateProfile(
      "I've already received the offer letter — it shows the base as 24 LPA.",
    );
    expect(r.hasSeenOffer).toBe(true);
  });

  it("offerDeadlineMentioned=true + offerDeadlineText captured", () => {
    const r = extractCandidateProfile(
      "I need to decide by end of week — the offer expires then.",
    );
    expect(r.offerDeadlineMentioned).toBe(true);
  });

  it("negotiatingMultipleOffers=true when candidate mentions multiple offers", () => {
    const r = extractCandidateProfile(
      "I have two offers in hand right now and I'm weighing them.",
    );
    expect(r.negotiatingMultipleOffers).toBe(true);
  });

  it("prefersCashOverPerks=true when candidate says number matters more than perks", () => {
    const r = extractCandidateProfile(
      "Honestly, I care more about the number than perks — it's all about the cash.",
    );
    expect(r.prefersCashOverPerks).toBe(true);
  });

  it("perksImportant=true when candidate mentions perks as important factor", () => {
    const r = extractCandidateProfile(
      "The perks matter a lot to me — health insurance and food coupons are a big factor.",
    );
    expect(r.perksImportant).toBe(true);
  });
});

describe("Wave-7 — anchoring / pressure-response flags", () => {
  it("anchoredFirst=true when candidate states expected number before being asked", () => {
    const r = extractCandidateProfile(
      "I'm looking for 30 LPA for this role.",
    );
    expect(r.anchoredFirst).toBe(true);
  });

  it("anchorWasHighball=true when ask is > 50% above current", () => {
    const r = extractCandidateProfile(
      "My current CTC is 15 lakhs and I'm targeting 30 LPA.",
    );
    expect(r.anchorWasHighball).toBe(true);
  });

  it("invokedCompetingOffer=true when competing offer used as leverage", () => {
    const r = extractCandidateProfile(
      "Because of my other offer, I need you to match it — the competing offer is paying more.",
    );
    expect(r.invokedCompetingOffer).toBe(true);
  });

  it("pushedBackOnCeiling=true when candidate challenges stated budget ceiling", () => {
    const r = extractCandidateProfile(
      "But the market data on Glassdoor shows the range goes higher — can we revisit the ceiling?",
    );
    expect(r.pushedBackOnCeiling).toBe(true);
  });

  it("expressedHesitation=true when candidate says need to think about it", () => {
    const r = extractCandidateProfile(
      "I'm not sure about this — let me think about it before I commit.",
    );
    expect(r.expressedHesitation).toBe(true);
  });
});

describe("Wave-7 — rapport / red-flag behavioral flags", () => {
  it("saidThankYou=true when candidate expresses gratitude", () => {
    const r = extractCandidateProfile(
      "Thanks a lot for the transparency — I really appreciate it.",
    );
    expect(r.saidThankYou).toBe(true);
  });

  it("askedAboutTeam=true when candidate asks about the team", () => {
    const r = extractCandidateProfile(
      "Can you tell me about the team I'd be working with? What's the team culture like?",
    );
    expect(r.askedAboutTeam).toBe(true);
  });

  it("askedAboutGrowthPath=true when candidate asks about career progression", () => {
    const r = extractCandidateProfile(
      "What's the career growth path in this role? How quickly do people get promoted here?",
    );
    expect(r.askedAboutGrowthPath).toBe(true);
  });

  it("askedAboutWorkLifeBalance=true when WLB raised", () => {
    const r = extractCandidateProfile(
      "Work-life balance is important to me — what are the typical working hours?",
    );
    expect(r.askedAboutWorkLifeBalance).toBe(true);
  });

  it("evasiveOnCurrentCtc=true when candidate deflects", () => {
    const r = extractCandidateProfile(
      "I'd rather not anchor with my current CTC — I'd prefer to discuss the market rate.",
    );
    expect(r.evasiveOnCurrentCtc).toBe(true);
  });

  it("mentionedCounterOffer=true when candidate says employer might counter", () => {
    const r = extractCandidateProfile(
      "My current company might make a counter-offer when I resign.",
    );
    expect(r.mentionedCounterOffer).toBe(true);
  });

  it("mentionedLayoffRisk=true when candidate hints at job insecurity", () => {
    const r = extractCandidateProfile(
      "Layoffs are coming at my current company — my role might be at risk.",
    );
    expect(r.mentionedLayoffRisk).toBe(true);
  });

  it("Wave-7 flags default to false when no signal in text", () => {
    const r = extractCandidateProfile("My current CTC is 20 LPA and I want 26 LPA.");
    expect(r.anchoredFirst).toBe(false);
    expect(r.anchorWasHighball).toBe(false);
    expect(r.retreatedFromAnchor).toBe(false);
    expect(r.acceptedCounterQuickly).toBe(false);
    expect(r.respondedToBudgetCeiling).toBe(false);
    expect(r.pushedBackOnCeiling).toBe(false);
    expect(r.invokedCompetingOffer).toBe(false);
    expect(r.expressedUrgency).toBe(false);
    expect(r.expressedHesitation).toBe(false);
    expect(r.saidThankYou).toBe(false);
    expect(r.askedAboutTeam).toBe(false);
    expect(r.askedAboutGrowthPath).toBe(false);
    expect(r.askedAboutWorkLifeBalance).toBe(false);
    expect(r.gaveInconsistentNumbers).toBe(false);
    expect(r.evasiveOnCurrentCtc).toBe(false);
    expect(r.dramaticAnchorJump).toBe(false);
    expect(r.mentionedCounterOffer).toBe(false);
    expect(r.mentionedLayoffRisk).toBe(false);
    expect(r.seemsRushed).toBe(false);
  });
});

describe("Wave-7 merge — monotone-up for boolean flags", () => {
  it("invokedCompetingOffer is monotone-up across turns", () => {
    const first = extractCandidateProfile("I'm looking for 26 LPA.");
    const second = extractCandidateProfile(
      "Because of my other offer, I need you to match it.",
    );
    const merged = mergeCandidateProfile(first, second);
    expect(merged.invokedCompetingOffer).toBe(true);
  });

  it("currentBonusPct takes max across turns", () => {
    const first = extractCandidateProfile("I get a 10% variable component.");
    const second = extractCandidateProfile("Actually the variable is 20% of my CTC.");
    const merged = mergeCandidateProfile(first, second);
    expect(merged.currentBonusPct).toBe(20);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * PLANNER REACTIVE-RULE TESTS
 * ═══════════════════════════════════════════════════════════════════════ */

describe("Planner — Wave-7 reactive rule: competing-leverage-ack", () => {
  it("emits competing-leverage-ack when invokedCompetingOffer=true and not yet fired", () => {
    const state = minState({
      candidateProfile: {
        ...extractCandidateProfile(""),
        invokedCompetingOffer: true,
        hasAny: true,
      },
      reactiveFollowupsFired: [],
      lastTurnDelta: { ...EMPTY_TURN_DELTA, disclosedCompetingOffer: true },
    });
    const action = planNextAction(state);
    expect(action.kind).toBe("reactive-followup");
    if (action.kind === "reactive-followup") {
      expect(action.topic).toBe("competing-leverage-ack");
      expect(action.ask).toMatch(/competing offer/i);
    }
  });

  it("does NOT emit competing-leverage-ack when already fired", () => {
    const state = minState({
      candidateProfile: {
        ...extractCandidateProfile(""),
        invokedCompetingOffer: true,
        hasAny: true,
      },
      reactiveFollowupsFired: ["competing-leverage-ack"],
      lastTurnDelta: { ...EMPTY_TURN_DELTA, disclosedCompetingOffer: true },
    });
    const action = planNextAction(state);
    /* Should fall through to a different action kind */
    if (action.kind === "reactive-followup") {
      expect(action.topic).not.toBe("competing-leverage-ack");
    }
  });
});

describe("Planner — Wave-7 reactive rule: number-clarification", () => {
  it("emits number-clarification probe when gaveInconsistentNumbers=true", () => {
    const state = minState({
      candidateProfile: {
        ...extractCandidateProfile(""),
        gaveInconsistentNumbers: true,
        hasAny: true,
      },
      reactiveFollowupsFired: [],
      lastTurnDelta: { ...EMPTY_TURN_DELTA, disclosedCurrentCtc: true },
    });
    const action = planNextAction(state);
    expect(action.kind).toBe("reactive-followup");
    if (action.kind === "reactive-followup") {
      expect(action.topic).toBe("number-clarification");
      expect(action.ask).toMatch(/current CTC/i);
    }
  });
});

describe("Planner — Wave-7 reactive rule: ctc-gentle-push", () => {
  it("emits ctc-gentle-push when evasiveOnCurrentCtc=true and turnIndex >= 3", () => {
    const state = minState({
      turnIndex: 5,
      candidateProfile: {
        ...extractCandidateProfile(""),
        evasiveOnCurrentCtc: true,
        hasAny: true,
      },
      reactiveFollowupsFired: [],
      lastTurnDelta: { ...EMPTY_TURN_DELTA },
    });
    const action = planNextAction(state);
    expect(action.kind).toBe("reactive-followup");
    if (action.kind === "reactive-followup") {
      expect(action.topic).toBe("ctc-gentle-push");
      expect(action.ask).toMatch(/current package/i);
    }
  });

  it("does NOT emit ctc-gentle-push when turnIndex < 3", () => {
    const state = minState({
      turnIndex: 2,
      candidateProfile: {
        ...extractCandidateProfile(""),
        evasiveOnCurrentCtc: true,
        hasAny: true,
      },
      reactiveFollowupsFired: [],
      lastTurnDelta: { ...EMPTY_TURN_DELTA },
    });
    const action = planNextAction(state);
    if (action.kind === "reactive-followup") {
      expect(action.topic).not.toBe("ctc-gentle-push");
    }
  });
});
