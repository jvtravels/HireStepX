import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { extractCandidateStance } from "../../server-handlers/_candidate-stance";
import { detectRedFlags, type RedFlagCode } from "../../server-handlers/_red-flags";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s1", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});
const emptyStance = extractCandidateStance("");

function codes(state: NegotiationState, stance = emptyStance, utterance = ""): RedFlagCode[] {
  return detectRedFlags({ state, stance, utterance }).map((f) => f.code);
}

describe("detectRedFlags — no-current-ctc", () => {
  it("fires after 2+ turns with no current CTC", () => {
    expect(codes(baseState({ turnIndex: 3 }))).toContain("no-current-ctc");
  });

  it("suppresses when current CTC is known", () => {
    expect(codes(baseState({ turnIndex: 3, candidateCurrentCtc: 18 }))).not.toContain("no-current-ctc");
  });

  it("suppresses early (turn 0)", () => {
    expect(codes(baseState({ turnIndex: 0 }))).not.toContain("no-current-ctc");
  });
});

describe("detectRedFlags — no-fixed-variable-breakup", () => {
  it("fires when CTC stated but breakdown absent", () => {
    expect(codes(baseState({ candidateCurrentCtc: 18 }))).toContain("no-fixed-variable-breakup");
  });

  it("suppresses when breakdown is known", () => {
    const state = baseState({
      candidateCurrentCtc: 18,
      candidateComponentBreakdown: { base: 14, variable: 4, equity: null, hasAny: true },
    });
    expect(codes(state)).not.toContain("no-fixed-variable-breakup");
  });
});

describe("detectRedFlags — ctc-inhand-confusion", () => {
  it("fires on monthly-only figure in annual context", () => {
    expect(codes(baseState(), emptyStance, "I'm earning 80k per month")).toContain("ctc-inhand-confusion");
  });

  it("suppresses when annual context is paired", () => {
    expect(
      codes(baseState(), emptyStance, "I earn 80k per month which is about 9.6 LPA"),
    ).not.toContain("ctc-inhand-confusion");
  });
});

describe("detectRedFlags — huge-hike-no-rationale", () => {
  it("fires on +60% hike with no rationale", () => {
    expect(codes(baseState({ hikePercent: 60 }))).toContain("huge-hike-no-rationale");
  });

  it("suppresses when rationale present", () => {
    const state = baseState({
      hikePercent: 60,
      rationale: { kind: "skill", evidence: "ML" } as never,
    });
    expect(codes(state)).not.toContain("huge-hike-no-rationale");
  });
});

describe("detectRedFlags — stance-derived flags", () => {
  it("salary-only-factor", () => {
    const stance = extractCandidateStance("salary is the only thing");
    expect(codes(baseState(), stance)).toContain("salary-only-factor");
  });

  it("sounds-desperate", () => {
    const stance = extractCandidateStance("I really need this job");
    expect(codes(baseState(), stance)).toContain("sounds-desperate");
  });

  it("badmouths-current", () => {
    const stance = extractCandidateStance("my current company is toxic");
    expect(codes(baseState(), stance)).toContain("badmouths-current");
  });

  it("shares-confidential", () => {
    const stance = extractCandidateStance("off the record, the budget was 60 LPA");
    expect(codes(baseState(), stance)).toContain("shares-confidential");
  });

  it("demands-no-flex", () => {
    const stance = extractCandidateStance("non-negotiable");
    expect(codes(baseState(), stance)).toContain("demands-no-flex");
  });

  it("treats-equity-as-cash", () => {
    const stance = extractCandidateStance("I'm counting the ESOP as cash");
    expect(codes(baseState(), stance)).toContain("treats-equity-as-cash");
  });
});

describe("detectRedFlags — lies-about-offer (narrow heuristic)", () => {
  it("fires when competing offer claimed but proof refused", () => {
    const state = baseState({
      competingOffer: 32,
      miscSignals: { candidateFloor: null, salaryReviewMonths: null, proofOfCtcShareable: false, internalCounterRisk: null, hasAny: true },
      competingOfferDetail: { company: null, status: null, stage: null, letterShareOffered: false, onHold: false, hasAny: false },
    });
    const flags = detectRedFlags({ state, stance: emptyStance, utterance: "" });
    const lies = flags.find((f) => f.code === "lies-about-offer");
    expect(lies).toBeDefined();
    expect(lies?.severity).toBe("blocker");
  });
});

describe("detectRedFlags — overcommits-joining", () => {
  it("fires when early-join + 60-day notice + no buyout", () => {
    const state = baseState({
      noticeJoining: { noticePeriodDays: 60, buyoutRequested: false, joiningBonusAsk: null, earlyJoinPreferred: true, joiningBonusClawbackDiscussed: false, lastWorkingDayText: null, hasAny: true },
    });
    expect(codes(state)).toContain("overcommits-joining");
  });

  it("suppresses when buyout is on the table", () => {
    const state = baseState({
      noticeJoining: { noticePeriodDays: 60, buyoutRequested: true, joiningBonusAsk: null, earlyJoinPreferred: true, joiningBonusClawbackDiscussed: false, lastWorkingDayText: null, hasAny: true },
    });
    expect(codes(state)).not.toContain("overcommits-joining");
  });
});

describe("detectRedFlags — ignores-variable-risk", () => {
  it("fires when target == base+variable and variable >= 15pct", () => {
    const state = baseState({
      candidateTarget: 30,
      candidateComponentBreakdown: { base: 24, variable: 6, equity: null, hasAny: true },
    });
    expect(codes(state)).toContain("ignores-variable-risk");
  });

  it("suppresses when target reflects a haircut", () => {
    const state = baseState({
      candidateTarget: 27, // below base+variable=30
      candidateComponentBreakdown: { base: 24, variable: 6, equity: null, hasAny: true },
    });
    expect(codes(state)).not.toContain("ignores-variable-risk");
  });
});

describe("detectRedFlags — verbal-accept-no-breakup", () => {
  it("fires when verbalAcceptanceTurn set but breakdown empty", () => {
    const state = baseState({ verbalAcceptanceTurn: 3 });
    expect(codes(state)).toContain("verbal-accept-no-breakup");
  });
});

describe("detectRedFlags — empty case", () => {
  it("no flags on fresh state with empty utterance", () => {
    expect(codes(baseState())).toEqual([]);
  });
});

describe("detectRedFlags — Phase 20 rewrite suggestions", () => {
  it("every fired flag carries a non-empty rewriteSuggestion", () => {
    const flags = detectRedFlags({
      state: baseState({ turnIndex: 3 }),
      stance: emptyStance,
      utterance: "",
    });
    expect(flags.length).toBeGreaterThan(0);
    for (const f of flags) {
      expect(f.rewriteSuggestion, `flag ${f.code} missing rewriteSuggestion`).toBeTruthy();
      expect(f.rewriteSuggestion.length).toBeGreaterThan(15);
    }
  });

  it("rewrite for sounds-desperate starts with 'Say:' and is candidate-voiced", () => {
    const text = "I really need this job, please consider me.";
    const stance = extractCandidateStance(text);
    const flags = detectRedFlags({ state: baseState({ turnIndex: 1 }), stance, utterance: text });
    const desperate = flags.find((f) => f.code === "sounds-desperate");
    expect(desperate).toBeDefined();
    expect(desperate!.rewriteSuggestion).toMatch(/^Say:/);
    /* Sanity: rewrite should not contain the desperation language. */
    expect(desperate!.rewriteSuggestion).not.toMatch(/\b(?:desperately|please consider me|really need)\b/i);
  });
});

describe("detectRedFlags — Phase 20 Hinglish coverage", () => {
  it("'isse kam nahi' triggers rigid → demands-no-flex", () => {
    const text = "Mera target ₹25L hai, isse kam nahi.";
    const stance = extractCandidateStance(text);
    expect(stance.flexibilityPosture).toBe("rigid");
  });

  it("'aap decide kar lijiye' triggers avoidsAnchor → avoids-anchor", () => {
    const text = "Salary ke baare mein aap decide kar lijiye, mujhe koi specific number nahi pata.";
    const stance = extractCandidateStance(text);
    expect(stance.avoidsAnchor).toBe(true);
  });

  it("'job ki bahut zaroorat hai' triggers desperation", () => {
    const text = "Sir, mujhe is job ki bahut zaroorat hai.";
    const stance = extractCandidateStance(text);
    expect(stance.soundsDesperate).toBe(true);
  });

  it("'flexible hoon' triggers flexible posture", () => {
    const text = "Main flexible hoon, hum baat kar sakte hain.";
    const stance = extractCandidateStance(text);
    expect(stance.flexibilityPosture).toBe("flexible");
  });
});

describe("detectRedFlags — Phase 22 comp structure", () => {
  it("'OTE ₹40L' alone fires ote-as-guaranteed", () => {
    const text = "My package is ₹40L OTE.";
    const flags = codes(baseState(), emptyStance, text);
    expect(flags).toContain("ote-as-guaranteed");
  });

  it("OTE + base (no attainment) fires no-attainment-history, NOT ote-as-guaranteed", () => {
    const text = "OTE of ₹40L with base of ₹25L.";
    const flags = codes(baseState(), emptyStance, text);
    expect(flags).toContain("no-attainment-history");
    expect(flags).not.toContain("ote-as-guaranteed");
  });

  it("OTE + base + attainment fires neither comp-structure flag", () => {
    const text = "OTE of ₹40L, base of ₹25L, I hit 110% last year.";
    const flags = codes(baseState(), emptyStance, text);
    expect(flags).not.toContain("ote-as-guaranteed");
    expect(flags).not.toContain("no-attainment-history");
  });

  it("day rate annualised without utilization fires day-rate-fte-confusion", () => {
    const text = "I charge ₹10K/day so that's ₹25L per year as FTE.";
    const flags = codes(baseState(), emptyStance, text);
    expect(flags).toContain("day-rate-fte-confusion");
  });

  it("day rate with utilization does NOT fire day-rate-fte-confusion", () => {
    const text = "₹10K/day at 85% utilization works out to ₹25L per year.";
    const flags = codes(baseState(), emptyStance, text);
    expect(flags).not.toContain("day-rate-fte-confusion");
  });

  it("Phase 22 flags carry rewrite suggestions", () => {
    const flags = detectRedFlags({
      state: baseState(),
      stance: emptyStance,
      utterance: "My package is ₹40L OTE.",
    });
    const ote = flags.find((f) => f.code === "ote-as-guaranteed");
    expect(ote).toBeDefined();
    expect(ote!.rewriteSuggestion).toMatch(/base|attainment/i);
  });
});

describe("Phase 25 — target-drifted-upward", () => {
  it("fires when target rose >10% above first anchor", () => {
    const state = baseState({ firstAnchoredTarget: 28, candidateTarget: 33 });
    expect(codes(state)).toContain("target-drifted-upward");
  });

  it("does NOT fire on small drift within 10%", () => {
    const state = baseState({ firstAnchoredTarget: 28, candidateTarget: 30 });
    expect(codes(state)).not.toContain("target-drifted-upward");
  });

  it("does NOT fire when no first anchor recorded", () => {
    const state = baseState({ firstAnchoredTarget: null, candidateTarget: 35 });
    expect(codes(state)).not.toContain("target-drifted-upward");
  });

  it("does NOT fire when target moved DOWN", () => {
    const state = baseState({ firstAnchoredTarget: 30, candidateTarget: 26 });
    expect(codes(state)).not.toContain("target-drifted-upward");
  });
});

describe("Phase 25 — domain-pivot-full-rate", () => {
  it("fires when pivoting domain and asking >30% hike", () => {
    const state = baseState({
      hikePercent: 50,
      candidateProfile: {
        careerGapMonths: null, careerGapActivity: null, tenureSignal: null,
        levelMismatch: null, domainPivot: true, transferableSkillsClaimed: true,
        compensationHistoryIssue: null, serviceBondAccepted: false, probationCompMentioned: false, internshipConversion: false, collegeTier: null, earlySwitcher: false, lowCtcAlert: false, priorInternshipNonConversion: false, serviceCompanyBackground: false, compBreakupUnknown: false, recentLayoff: false, hotDomainPremium: false, pipDisclosed: false, verbalOnlyOffer: false, culturalJoiningConstraint: false,
        peopleManagementClaimed: false,
        crossBorderAnchor: false,
        unvestedEquityLossClaim: false,
        explodingOfferPressure: false,
        postAcceptanceRenege: false,
        quotaAttainmentClaimed: false,
        gardenLeaveDisclosed: false,
        nonCompeteFlagged: false,
        relocationBonusAsked: false, hasAny: true,
      },
    });
    expect(codes(state)).toContain("domain-pivot-full-rate");
  });

  it("does NOT fire when domain pivot but modest hike", () => {
    const state = baseState({
      hikePercent: 20,
      candidateProfile: {
        careerGapMonths: null, careerGapActivity: null, tenureSignal: null,
        levelMismatch: null, domainPivot: true, transferableSkillsClaimed: true,
        compensationHistoryIssue: null, serviceBondAccepted: false, probationCompMentioned: false, internshipConversion: false, collegeTier: null, earlySwitcher: false, lowCtcAlert: false, priorInternshipNonConversion: false, serviceCompanyBackground: false, compBreakupUnknown: false, recentLayoff: false, hotDomainPremium: false, pipDisclosed: false, verbalOnlyOffer: false, culturalJoiningConstraint: false,
        peopleManagementClaimed: false,
        crossBorderAnchor: false,
        unvestedEquityLossClaim: false,
        explodingOfferPressure: false,
        postAcceptanceRenege: false,
        quotaAttainmentClaimed: false,
        gardenLeaveDisclosed: false,
        nonCompeteFlagged: false,
        relocationBonusAsked: false, hasAny: true,
      },
    });
    expect(codes(state)).not.toContain("domain-pivot-full-rate");
  });

  it("does NOT fire when no domain pivot", () => {
    const state = baseState({ hikePercent: 50 });
    expect(codes(state)).not.toContain("domain-pivot-full-rate");
  });
});

describe("Phase 25 — compensation-history-issue", () => {
  it("fires when delayed-salary recorded on profile", () => {
    const state = baseState({
      candidateProfile: {
        careerGapMonths: null, careerGapActivity: null, tenureSignal: null,
        levelMismatch: null, domainPivot: false, transferableSkillsClaimed: false,
        compensationHistoryIssue: "delayed", serviceBondAccepted: false, probationCompMentioned: false, internshipConversion: false, collegeTier: null, earlySwitcher: false, lowCtcAlert: false, priorInternshipNonConversion: false, serviceCompanyBackground: false, compBreakupUnknown: false, recentLayoff: false, hotDomainPremium: false, pipDisclosed: false, verbalOnlyOffer: false, culturalJoiningConstraint: false,
        peopleManagementClaimed: false,
        crossBorderAnchor: false,
        unvestedEquityLossClaim: false,
        explodingOfferPressure: false,
        postAcceptanceRenege: false,
        quotaAttainmentClaimed: false,
        gardenLeaveDisclosed: false,
        nonCompeteFlagged: false,
        relocationBonusAsked: false, hasAny: true,
      },
    });
    expect(codes(state)).toContain("compensation-history-issue");
  });

  it("fires when unpaid-salary recorded", () => {
    const state = baseState({
      candidateProfile: {
        careerGapMonths: null, careerGapActivity: null, tenureSignal: null,
        levelMismatch: null, domainPivot: false, transferableSkillsClaimed: false,
        compensationHistoryIssue: "unpaid", serviceBondAccepted: false, probationCompMentioned: false, internshipConversion: false, collegeTier: null, earlySwitcher: false, lowCtcAlert: false, priorInternshipNonConversion: false, serviceCompanyBackground: false, compBreakupUnknown: false, recentLayoff: false, hotDomainPremium: false, pipDisclosed: false, verbalOnlyOffer: false, culturalJoiningConstraint: false,
        peopleManagementClaimed: false,
        crossBorderAnchor: false,
        unvestedEquityLossClaim: false,
        explodingOfferPressure: false,
        postAcceptanceRenege: false,
        quotaAttainmentClaimed: false,
        gardenLeaveDisclosed: false,
        nonCompeteFlagged: false,
        relocationBonusAsked: false, hasAny: true,
      },
    });
    expect(codes(state)).toContain("compensation-history-issue");
  });

  it("does NOT fire when issue is null", () => {
    expect(codes(baseState())).not.toContain("compensation-history-issue");
  });
});

describe("Phase 25 — rigid-no-range", () => {
  it("fires on 'nothing below ₹25L'", () => {
    expect(codes(baseState(), emptyStance, "Nothing below ₹25L works for me."))
      .toContain("rigid-no-range");
  });

  it("fires on 'minimum 25 LPA'", () => {
    expect(codes(baseState(), emptyStance, "Minimum 25 LPA is my floor."))
      .toContain("rigid-no-range");
  });

  it("does NOT fire when a range is also present", () => {
    expect(codes(baseState(), emptyStance, "Nothing below ₹25L; I'm targeting ₹25-30 LPA."))
      .not.toContain("rigid-no-range");
  });

  it("does NOT fire on neutral text", () => {
    expect(codes(baseState(), emptyStance, "I'm flexible on structure."))
      .not.toContain("rigid-no-range");
  });
});

describe("Phase 25 — offer-no-company-disclosure", () => {
  it("fires when competing offer amount stated but company null after turn 2", () => {
    const state = baseState({
      turnIndex: 3,
      competingOffer: 28,
      competingOfferDetail: {
        company: null, status: null, stage: null, letterShareOffered: false, onHold: false, hasAny: true,
      },
    });
    expect(codes(state)).toContain("offer-no-company-disclosure");
  });

  it("does NOT fire when company is disclosed", () => {
    const state = baseState({
      turnIndex: 3,
      competingOffer: 28,
      competingOfferDetail: {
        company: "Razorpay", status: "verbal", stage: "offered", letterShareOffered: false, onHold: false, hasAny: true,
      },
    });
    expect(codes(state)).not.toContain("offer-no-company-disclosure");
  });

  it("does NOT fire early (turn 0/1)", () => {
    const state = baseState({
      turnIndex: 1,
      competingOffer: 28,
      competingOfferDetail: {
        company: null, status: null, stage: null, letterShareOffered: false, onHold: false, hasAny: true,
      },
    });
    expect(codes(state)).not.toContain("offer-no-company-disclosure");
  });
});

describe("Phase 26 — offer-drop-risk", () => {
  it("fires when competing offer is already accepted", () => {
    const state = baseState({
      competingOffer: 30,
      competingOfferDetail: {
        company: "Razorpay", status: "signed", stage: "accepted", letterShareOffered: false, onHold: false, hasAny: true,
      },
    });
    expect(codes(state)).toContain("offer-drop-risk");
  });

  it("does NOT fire when stage is offered (still deciding)", () => {
    const state = baseState({
      competingOffer: 30,
      competingOfferDetail: {
        company: "Razorpay", status: "letter", stage: "offered", letterShareOffered: false, onHold: false, hasAny: true,
      },
    });
    expect(codes(state)).not.toContain("offer-drop-risk");
  });
});

describe("Phase 26 — buyout-amount-unspecified", () => {
  it("fires when buyout discussed but no amount in utterance", () => {
    const state = baseState({
      noticeJoining: {
        noticePeriodDays: 90, buyoutRequested: true, joiningBonusAsk: null,
        earlyJoinPreferred: false, joiningBonusClawbackDiscussed: false,
        lastWorkingDayText: null, hasAny: true,
      },
    });
    expect(codes(state, emptyStance, "I'd like a notice buyout but need to check the amount."))
      .toContain("buyout-amount-unspecified");
  });

  it("does NOT fire when buyout utterance names ₹ amount", () => {
    const state = baseState({
      noticeJoining: {
        noticePeriodDays: 90, buyoutRequested: true, joiningBonusAsk: null,
        earlyJoinPreferred: false, joiningBonusClawbackDiscussed: false,
        lastWorkingDayText: null, hasAny: true,
      },
    });
    expect(codes(state, emptyStance, "My notice buyout is ₹3L based on last-drawn."))
      .not.toContain("buyout-amount-unspecified");
  });

  it("does NOT fire when buyout not requested at all", () => {
    expect(codes(baseState(), emptyStance, "I'll serve full notice."))
      .not.toContain("buyout-amount-unspecified");
  });
});

describe("Phase 26 — service-bond-unverified", () => {
  it("fires when candidate raised service-bond on profile", () => {
    const state = baseState({
      candidateProfile: {
        careerGapMonths: null, careerGapActivity: null, tenureSignal: null,
        levelMismatch: null, domainPivot: false, transferableSkillsClaimed: false,
        compensationHistoryIssue: null, serviceBondAccepted: true,
        probationCompMentioned: false, internshipConversion: false, collegeTier: null, earlySwitcher: false, lowCtcAlert: false, priorInternshipNonConversion: false, serviceCompanyBackground: false, compBreakupUnknown: false, recentLayoff: false, hotDomainPremium: false, pipDisclosed: false, verbalOnlyOffer: false, culturalJoiningConstraint: false,
        peopleManagementClaimed: false,
        crossBorderAnchor: false,
        unvestedEquityLossClaim: false,
        explodingOfferPressure: false,
        postAcceptanceRenege: false,
        quotaAttainmentClaimed: false,
        gardenLeaveDisclosed: false,
        nonCompeteFlagged: false,
        relocationBonusAsked: false, hasAny: true,
      },
    });
    expect(codes(state)).toContain("service-bond-unverified");
  });

  it("does NOT fire when bond never raised", () => {
    expect(codes(baseState())).not.toContain("service-bond-unverified");
  });
});

describe("Phase 26 — probation-comp-unclarified", () => {
  it("fires when probation comp surfaced", () => {
    const state = baseState({
      candidateProfile: {
        careerGapMonths: null, careerGapActivity: null, tenureSignal: null,
        levelMismatch: null, domainPivot: false, transferableSkillsClaimed: false,
        compensationHistoryIssue: null, serviceBondAccepted: false,
        probationCompMentioned: true, internshipConversion: false, collegeTier: null, earlySwitcher: false, lowCtcAlert: false, priorInternshipNonConversion: false, serviceCompanyBackground: false, compBreakupUnknown: false, recentLayoff: false, hotDomainPremium: false, pipDisclosed: false, verbalOnlyOffer: false, culturalJoiningConstraint: false,
        peopleManagementClaimed: false,
        crossBorderAnchor: false,
        unvestedEquityLossClaim: false,
        explodingOfferPressure: false,
        postAcceptanceRenege: false,
        quotaAttainmentClaimed: false,
        gardenLeaveDisclosed: false,
        nonCompeteFlagged: false,
        relocationBonusAsked: false, hasAny: true,
      },
    });
    expect(codes(state)).toContain("probation-comp-unclarified");
  });

  it("does NOT fire when probation never raised", () => {
    expect(codes(baseState())).not.toContain("probation-comp-unclarified");
  });
});

describe("Phase 27 — retention-counter-trap", () => {
  it("fires as concern when retention counter is on the table (not declined)", () => {
    const state = baseState({
      retentionCounter: { amountLpa: 35, declined: false, hasAny: true },
    });
    const flags = detectRedFlags({ state, stance: emptyStance, utterance: "" });
    const rc = flags.find((f) => f.code === "retention-counter-trap");
    expect(rc).toBeDefined();
    expect(rc!.severity).toBe("concern");
  });

  it("fires as info when candidate has declined the retention counter", () => {
    const state = baseState({
      retentionCounter: { amountLpa: 35, declined: true, hasAny: true },
    });
    const flags = detectRedFlags({ state, stance: emptyStance, utterance: "" });
    const rc = flags.find((f) => f.code === "retention-counter-trap");
    expect(rc).toBeDefined();
    expect(rc!.severity).toBe("info");
  });

  it("does NOT fire when no retention counter", () => {
    expect(codes(baseState())).not.toContain("retention-counter-trap");
  });
});

describe("Phase 27 — competing-offer-on-hold", () => {
  it("fires when competingOfferDetail.onHold is true", () => {
    const state = baseState({
      competingOffer: 28,
      competingOfferDetail: {
        company: "flipkart", status: null, stage: "offered",
        letterShareOffered: false, onHold: true, hasAny: true,
      },
    });
    expect(codes(state)).toContain("competing-offer-on-hold");
  });

  it("does NOT fire when onHold false", () => {
    const state = baseState({
      competingOffer: 28,
      competingOfferDetail: {
        company: "flipkart", status: "letter", stage: "offered",
        letterShareOffered: false, onHold: false, hasAny: true,
      },
    });
    expect(codes(state)).not.toContain("competing-offer-on-hold");
  });
});

describe("Phase 27 — fbp-not-discussed", () => {
  it("fires when deep into negotiation but no FBP tokens in candidate log", () => {
    const state = baseState({
      phase: "counter-offer",
      conversationLog: [
        { speaker: "candidate", text: "I'm looking for 28 LPA fixed." },
        { speaker: "candidate", text: "My current is 22 LPA." },
      ],
    });
    expect(codes(state)).toContain("fbp-not-discussed");
  });

  it("does NOT fire when candidate mentioned HRA", () => {
    const state = baseState({
      phase: "counter-offer",
      conversationLog: [
        { speaker: "candidate", text: "How is the HRA structured?" },
      ],
    });
    expect(codes(state)).not.toContain("fbp-not-discussed");
  });

  it("does NOT fire when candidate mentioned in-hand", () => {
    const state = baseState({
      phase: "accepted",
      conversationLog: [
        { speaker: "candidate", text: "I'd like to confirm in-hand monthly." },
      ],
    });
    expect(codes(state)).not.toContain("fbp-not-discussed");
  });

  it("does NOT fire in early phases (probe-expectations)", () => {
    const state = baseState({
      phase: "probe-expectations",
      conversationLog: [
        { speaker: "candidate", text: "I'm looking for 28 LPA." },
      ],
    });
    expect(codes(state)).not.toContain("fbp-not-discussed");
  });
});
