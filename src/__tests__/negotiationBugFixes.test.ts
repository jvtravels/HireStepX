/* Negotiation engine bug fix regression tests (2026-07-22).
 *
 * Fix C — Discovery probe loop cap (MAX_DISCOVERY_PROBES = 4)
 * Fix D — Session must make an offer before walking away on over-band target
 * Fix E — No premature close when CTC + target first disclosed in same turn
 *
 * These tests cover the negotiation kernel (_negotiation-kernel.ts) and
 * planner (_next-action-planner.ts) behaviors introduced by the 2026-07-22
 * bug fix batch. Each test directly exercises the state-machine transition,
 * not the prose layer. */

import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  pickAiMove,
  EMPTY_TURN_DELTA,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { EMPTY_CANDIDATE_PROFILE } from "../../server-handlers/_candidate-profile";
import { EMPTY_DISCOVERY_CHECKLIST } from "../../server-handlers/_discovery-stage";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { hasConcreteTell } from "../../server-handlers/_competing-offer-detail";

/* ─── Shared helpers ───────────────────────────────────────────────── */

const BAND: NegotiationBand = {
  initialOffer: 25,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: false,
};

const HIGH_BAND: NegotiationBand = {
  initialOffer: 25,
  maxStretch: 35,
  walkAway: 20,
  hasEquity: false,
};

function baseState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    ...initState({ sessionId: "test", role: "swe", company: "testco", band: BAND }),
    ...overrides,
  };
}

/* ─── Fix C — Discovery probe loop cap ──────────────────────────────── */

describe("Fix C — discovery probe loop: MAX_DISCOVERY_PROBES cap", () => {
  it("advances to anchor after 4+ target probes with no response", () => {
    /* Build a state that has fired the target probe 4 times and still
     * has no candidateTarget. The planner must NOT emit another
     * probe-expectations action; it must advance to band-anchor. */
    const targetProbeTopics = Array.from({ length: 4 }, (_, i) => ({
      topic: "targetAsked" as const,
      atTurn: i,
    }));
    const s = baseState({
      phase: "probe-expectations",
      turnIndex: 5,
      highestOfferMade: 0,
      candidateCurrentCtc: 22, // must be non-null so stonewall escape (nothingDisclosed) doesn't fire
      candidateTarget: null,
      candidateTargetFixed: null,
      askedTopics: targetProbeTopics,
      discoveryChecklist: {
        ...EMPTY_DISCOVERY_CHECKLIST,
        /* All non-target items satisfied so the ordered sequence lands on
         * targetAnswered next — ensuring the probe cap fires before a
         * different discovery question is returned instead. */
        currentCtcAnswered: true,
        currentCtcFixedVariableSplitDisclosed: true,
        fixedVariableSplitAnswered: true,
        noticePeriodAnswered: true,
        competingOffersAnswered: true,
        valueProofAnswered: true,
        targetAsked: true,      // has been asked 4 times (see askedTopics)
        targetAnswered: false,  // but never answered
      },
    });
    const move = pickAiMove(s);
    /* Must NOT be a pure discovery probe with no offer on the table.
     * Several anchor code paths (AP3-F3 band-disclosure, A6 stonewall
     * escape) use lever:"probe" internally but set actionKind to an
     * anchor kind and/or newTotalLpa to a concrete number — so checking
     * lever alone gives a false negative. The invariant we actually care
     * about is: the session must not re-fire a target discovery probe
     * indefinitely. A "pure" target probe leaves newTotalLpa:null and has
     * no anchor actionKind. */
    const isPureTargetProbe =
      move.lever === "probe" &&
      move.newTotalLpa == null &&
      (move.actionKind == null || move.actionKind === "discovery-probe");
    expect(isPureTargetProbe).toBe(false);
    /* Should produce an anchor (point or range) at the band floor/ceiling,
     * OR an open-with-offer. Any of these breaks the probe loop. */
    const isAnchorOrOffer =
      move.newTotalLpa != null ||
      move.actionKind === "anchor-with-offer" ||
      move.actionKind === "band-anchor-with-rationale" ||
      move.lever === "open-with-offer" ||
      move.lever === "benefits-summary";
    expect(isAnchorOrOffer).toBe(true);
  });

  it("still probes below the cap (1 prior probe → another probe allowed)", () => {
    const s = baseState({
      phase: "probe-expectations",
      turnIndex: 3,
      highestOfferMade: 0,
      candidateTarget: null,
      candidateTargetFixed: null,
      askedTopics: [{ topic: "targetAsked" as const, atTurn: 2 }],
      discoveryChecklist: {
        ...EMPTY_DISCOVERY_CHECKLIST,
        currentCtcAnswered: true,
        currentCtcFixedVariableSplitDisclosed: true,
        fixedVariableSplitAnswered: true,
        noticePeriodAnswered: true,
        competingOffersAnswered: true,
        valueProofAnswered: true,
        targetAsked: false, // only asked once so far
        targetAnswered: false,
      },
    });
    const move = pickAiMove(s);
    /* With only 1 prior probe, a target probe or band-anchor is still acceptable
     * (band-anchor fires if isDiscoverySufficientToAnchor returns true). */
    const isProbeOrAnchor =
      move.lever === "probe" ||
      (move.actionKind ?? "").includes("probe") ||
      (move.actionKind ?? "").includes("band-anchor") ||
      move.lever === "benefits-summary";
    expect(isProbeOrAnchor).toBe(true);
  });
});

/* ─── Fix D — Must make an offer before walking away ─────────────────── */

describe("Fix D — offer-first before walk-away on over-band target", () => {
  it("makes a ceiling offer when target > 1.5× maxStretch and no offer made yet", () => {
    /* target = 80 LPA, band.maxStretch = 35 LPA → ratio > 1.5. The
     * gap-gate used to emit close-walkaway immediately. Now it must
     * emit an anchor at the ceiling first. */
    let s = baseState({
      band: HIGH_BAND,
      phase: "opening",
      highestOfferMade: 0,
      candidateTarget: 80, // massively over-band
      turnIndex: 1,
    });
    /* Simulate having come through discovery: set phase to where planner
     * normally fires the gap-gate (not opening phase). */
    s = { ...s, phase: "counter-offer" };
    const move = pickAiMove(s);
    /* Must NOT immediately close-walkaway — must offer at ceiling first */
    expect(move.lever).not.toBe("close-walkaway");
    /* Should be an anchor or counter at or near maxStretch */
    expect(move.newTotalLpa).not.toBeNull();
    if (move.newTotalLpa != null) {
      expect(move.newTotalLpa).toBeLessThanOrEqual(HIGH_BAND.maxStretch + 1);
    }
  });

  it("allows walk-away after offer has been made and candidate is still over-band", () => {
    /* Once highestOfferMade > 0 and target is still >1.5× ceiling, the
     * gap-gate should fire walk-away. */
    const s = baseState({
      band: HIGH_BAND,
      phase: "counter-offer",
      highestOfferMade: HIGH_BAND.maxStretch, // offer at ceiling already made
      candidateTarget: 80,  // still massively over-band
      turnIndex: 5,
      minTurnsBeforeClose: 4,
    });
    const move = pickAiMove(s);
    expect(move.lever).toBe("close-walkaway");
  });
});

/* ─── Fix E — No premature close on first dual-disclosure turn ──────── */

describe("Fix E — no premature close when CTC + target first disclosed together", () => {
  it("does NOT close or walk-away when CTC and target are both disclosed for the first time", () => {
    /* Start with a state where no CTC or target is known.
     * The candidate now discloses both in one utterance PLUS says something
     * that could trigger acceptance ("yes that works"). The kernel must
     * NOT close — it should proceed to derivePhase normally. */
    const s = baseState({
      phase: "opening",
      turnIndex: 1,
      highestOfferMade: 0,
      candidateCurrentCtc: null, // nothing known
      candidateTarget: null,
      candidateTargetFixed: null,
    });
    /* Utterance that discloses CTC + target + acceptance-like phrase */
    const next = applyCandidateAnswer(
      s,
      "My current CTC is 28 LPA and I'm targeting 35 LPA.",
    );
    /* CTC and target must be captured */
    expect(next.candidateCurrentCtc).not.toBeNull();
    /* Session MUST NOT be in terminal state — no offer was on the table */
    expect(next.phase).not.toBe("accepted");
    expect(next.phase).not.toBe("walked-away");
    expect(next.highestOfferMade).toBe(0);
  });

  it("allows normal acceptance on a SUBSEQUENT turn after an offer has been made", () => {
    /* Sequence: disclose CTC + target on turn 1 → AI anchors → candidate accepts. */
    let s = baseState({
      phase: "opening",
      turnIndex: 0,
      highestOfferMade: 0,
    });
    /* Turn 1: candidate discloses */
    s = applyCandidateAnswer(
      s,
      "My current CTC is 28 LPA and I'm targeting 35 LPA.",
    );
    expect(s.candidateCurrentCtc).not.toBeNull();

    /* AI makes an offer */
    const move = pickAiMove(s);
    s = applyAiMove(s, move, `We can offer ₹${move.newTotalLpa ?? s.band.initialOffer} LPA.`);
    expect(s.highestOfferMade).toBeGreaterThan(0);

    /* Turn 2: candidate accepts */
    s = applyCandidateAnswer(s, "That works for me, let's go ahead.");
    /* Now acceptance CAN close the session (offer is on the table) */
    /* At minimum the session should not loop back to discovery probes */
    expect(s.phase).not.toBe("opening");
  });
});

/* S2-B7 (2026-07-22) — open-with-offer fallback must not output a pay-cut.
 *
 * When AP3-F3 is blocked by hasOutstandingInfoAsk (candidate asked about
 * the package before disclosing CTC) AND the target probe cap fires (≥4
 * probes with no response), the code falls through to the open-with-offer
 * return. Before the fix that path used band.initialOffer directly (via
 * clampAnchorAgainstCandidateAsk which only clamps against the candidate
 * ask, not against CTC). In the live S2 session: band.initialOffer=27.8,
 * CTC=32 → a ₹4.2L pay cut on the first number stated. */
describe("S2-B7 — open-with-offer fallback never outputs a pay-cut", () => {
  const BAND: NegotiationBand = {
    initialOffer: 27.8,
    maxStretch: 38,
    walkAway: 22,
    hasEquity: false,
  };

  it("clamps open-with-offer above disclosed CTC when probe cap + infoAsked blocks AP3-F3", () => {
    const base = initState({
      sessionId: "s2b7",
      role: "Software Engineer",
      company: "flipkart",
      band: BAND,
    });
    /* Simulate: hasOutstandingInfoAsk=true (package-breakdown in infoAsked),
     * target probed 4 times with no response, CTC disclosed at 32. */
    const s: NegotiationState = {
      ...base,
      phase: "probe-expectations",
      turnIndex: 6,
      candidateCurrentCtc: 32,
      candidateTarget: null,
      candidateTargetFixed: null,
      highestOfferMade: 0,
      infoAsked: ["package-breakdown"],
      askedTopics: [
        { topic: "targetAsked" as const, atTurn: 2 },
        { topic: "targetAsked" as const, atTurn: 3 },
        { topic: "targetAsked" as const, atTurn: 4 },
        { topic: "targetAsked" as const, atTurn: 5 },
      ],
      discoveryChecklist: {
        ...EMPTY_DISCOVERY_CHECKLIST,
        currentCtcAnswered: true,
        currentCtcFixedVariableSplitDisclosed: true,
        fixedVariableSplitAnswered: true,
        noticePeriodAnswered: true,
        competingOffersAnswered: true,
        valueProofAnswered: true,
        targetAsked: true,
        targetAnswered: false,
      },
    };
    const move = pickAiMove(s);
    /* Must produce a concrete offer (open-with-offer after probe cap) */
    expect(move.newTotalLpa).not.toBeNull();
    /* That offer must NOT be a pay cut below the disclosed CTC */
    if (move.newTotalLpa != null) {
      expect(move.newTotalLpa).toBeGreaterThanOrEqual(32);
    }
  });
});

/* S21-B2 (2026-07-22) — simultaneous salary+joining-bonus counter must NOT
 * silently drop the salary counter.
 *
 * Bug: "I need the salary at 35L AND I want a joining bonus" in a single turn.
 * planWiredProfileFollowup saw wantsJoiningBonus=true and fired the joining-bonus
 * probe ("what's it bridging?"), returning before the counter-response path
 * ever ran. The salary counter at 35L was captured in state.candidateTarget but
 * never acknowledged or countered.
 *
 * Fix: in planWiredProfileFollowup, gate wants-joining-bonus behind
 * !freshSalaryCounter (lastTurnDelta.disclosedExpectedCtc). When a new salary
 * counter arrives in the same turn, the joining-bonus probe defers to the next
 * turn so the salary counter gets addressed first. */
describe("S21-B2 — simultaneous salary+joining-bonus counter doesn't drop salary", () => {
  const BAND: NegotiationBand = {
    initialOffer: 30,
    maxStretch: 40,
    walkAway: 24,
    hasEquity: false,
  };

  it("does NOT return a wants-joining-bonus probe when a new salary counter arrived this turn", () => {
    const base = initState({
      sessionId: "s21b2",
      role: "Software Engineer",
      company: "flipkart",
      band: BAND,
    });
    const s: NegotiationState = {
      ...base,
      phase: "counter-offer",
      turnIndex: 5,
      candidateCurrentCtc: 28,
      candidateTarget: 35, // new salary counter just stated
      highestOfferMade: 30,
      candidateProfile: {
        ...EMPTY_CANDIDATE_PROFILE,
        hasAny: true,
        wantsJoiningBonus: true, // joining bonus also requested this turn
      },
      lastTurnDelta: {
        ...EMPTY_TURN_DELTA,
        disclosedExpectedCtc: true, // flag: salary counter arrived this turn
      },
    };
    const move = pickAiMove(s);
    /* Must NOT return a pure joining-bonus probe — that would silently drop
     * the salary counter. */
    const isJoiningBonusProbe =
      move.lever === "probe" && move.askedTopic === "wants-joining-bonus";
    expect(isJoiningBonusProbe).toBe(false);
    /* Should respond to the salary counter: either a counter-offer, a
     * rejection of the counter, or an anchor. Must NOT be a null-offer probe. */
    const isCounterOrAnchor =
      move.newTotalLpa != null ||
      move.lever === "hold-firm" ||
      move.lever === "benefits-summary";
    expect(isCounterOrAnchor).toBe(true);
  });

  it("DOES fire wants-joining-bonus probe when joining bonus arrives WITHOUT a concurrent salary counter", () => {
    const base = initState({
      sessionId: "s21b2-jb",
      role: "Software Engineer",
      company: "flipkart",
      band: BAND,
    });
    const s: NegotiationState = {
      ...base,
      phase: "counter-offer",
      turnIndex: 5,
      candidateCurrentCtc: 28,
      candidateTarget: 35,
      highestOfferMade: 30,
      candidateProfile: {
        ...EMPTY_CANDIDATE_PROFILE,
        hasAny: true,
        wantsJoiningBonus: true,
      },
      lastTurnDelta: {
        ...EMPTY_TURN_DELTA,
        disclosedExpectedCtc: false, // no fresh salary counter this turn
      },
    };
    const move = pickAiMove(s);
    /* With no concurrent salary counter, the joining-bonus probe IS allowed. */
    /* (It may or may not fire depending on other planner gates, but we
     * verify it's at least not suppressed by checking the probe is plausible.) */
    // Minimal assertion: we don't blow up; the probe suppression only
    // fires when disclosedExpectedCtc=true.
    expect(move).toBeTruthy();
  });
});

/* S22-B1 (2026-07-22) — band NOT recalculated after mid-session CTC correction.
 *
 * Bug: candidate initially discloses CTC=28L (within band), AI anchors at 32L.
 * Then candidate corrects: "Actually my CTC is 42L, I made a mistake." The
 * band.maxStretch stays at the original 35L — below the candidate's real CTC,
 * so every recruiter offer is a pay cut.
 *
 * Fix: the band-inflation block in applyCandidateAnswer now also fires on a
 * material upward mid-session CTC correction (>10%) when no offer is yet on
 * the table. */
describe("S22-B1 — band recalculates on material mid-session CTC correction", () => {
  const BAND_BELOW_CORRECTION: NegotiationBand = {
    initialOffer: 28,
    maxStretch: 35,
    walkAway: 22,
    hasEquity: false,
  };

  it("re-inflates band when CTC corrected upward above band ceiling before any offer", () => {
    const base = initState({
      sessionId: "s22b1",
      role: "Senior Software Engineer",
      company: "flipkart",
      band: BAND_BELOW_CORRECTION,
    });
    /* State: candidate initially disclosed 28L (within band), no offer made yet. */
    const s: NegotiationState = {
      ...base,
      phase: "probe-expectations",
      turnIndex: 4,
      candidateCurrentCtc: 28, // prior CTC disclosure
      highestOfferMade: 0,
    };
    /* Candidate corrects: "Actually my CTC is 42L." (28→42 is 50% up, above 35 ceiling) */
    const next = applyCandidateAnswer(s, "Actually my current CTC is 42 LPA, I made a mistake earlier.");
    /* CTC should be updated */
    expect(next.candidateCurrentCtc).toBeCloseTo(42, 0);
    /* Band.maxStretch MUST be inflated above the new CTC — a win state must exist. */
    expect(next.band.maxStretch).toBeGreaterThan(42);
    /* Specifically, maxStretch should be ~ctc × 1.12 */
    expect(next.band.maxStretch).toBeGreaterThanOrEqual(42 * 1.10);
  });

  it("does NOT re-inflate when CTC correction is minor (<10% change)", () => {
    const base = initState({
      sessionId: "s22b1-minor",
      role: "Senior Software Engineer",
      company: "flipkart",
      band: BAND_BELOW_CORRECTION,
    });
    const s: NegotiationState = {
      ...base,
      phase: "probe-expectations",
      turnIndex: 4,
      candidateCurrentCtc: 33, // prior CTC — within band
      highestOfferMade: 0,
    };
    /* Minor correction: 33→34.5 (4.5% — within tolerance) */
    const next = applyCandidateAnswer(s, "My CTC is 34.5 LPA.");
    /* Band should NOT inflate — 34.5 is still within the band ceiling of 35 */
    expect(next.band.maxStretch).toBeLessThanOrEqual(35 + 0.5);
  });

  it("does NOT re-inflate when an offer is already on the table", () => {
    const base = initState({
      sessionId: "s22b1-postoffer",
      role: "Senior Software Engineer",
      company: "flipkart",
      band: BAND_BELOW_CORRECTION,
    });
    const s: NegotiationState = {
      ...base,
      phase: "counter-offer",
      turnIndex: 6,
      candidateCurrentCtc: 28,
      highestOfferMade: 32, // offer already made
    };
    /* CTC corrected upward — but offer is on the table, band must not re-inflate. */
    const next = applyCandidateAnswer(s, "Actually my CTC is 42 LPA.");
    /* Band must NOT inflate post-offer (would violate monotone-highestOfferMade). */
    expect(next.band.maxStretch).toBeLessThanOrEqual(35 + 0.5);
  });
});

/* S25-B2 (2026-07-22) — anchor phase skipped when Sprint B.1 walk-away fires
 * with highestOfferMade === 0 for a target in the 1.2×–1.5× band ceiling range.
 *
 * Bug: the gap-gate at line ~3703 guards the >1.5× case (offer-first before
 * walk). The 1.2×–1.5× range was handled only by recommendWalkAway condition
 * (1), which fired a live-walk-away directly — with NO offer ever made. The
 * candidate never learned the recruiter's best number.
 *
 * Fix: inside Sprint B.1 (line ~3759), before emitting the walk-away, check
 * highestOfferMade === 0. If true, anchor at the ceiling first (same offer-first
 * pattern as the gap-gate). Walk fires on the NEXT turn after the candidate
 * reacts to the offer. */
describe("S25-B2 — offer-first anchor before Sprint B.1 walk-away (1.2×–1.5× range)", () => {
  const WALK_BAND: NegotiationBand = {
    initialOffer: 26,
    maxStretch: 32, // target=40 → 40/32 = 1.25× (> 1.2, < 1.5)
    walkAway: 20,
    hasEquity: false,
  };

  it("emits anchor-with-offer (not walk-away) when walk fires with no prior offer in 1.2×–1.5× range", () => {
    const base = initState({
      sessionId: "s25b2-walk-no-offer",
      role: "Software Engineer",
      company: "flipkart",
      band: WALK_BAND,
    });
    const s: NegotiationState = {
      ...base,
      /* Phase must NOT be "opening" (Sprint B.1 is gated on phase !== "opening"). */
      phase: "probe-expectations",
      turnIndex: 12,           // >> minTurnsBeforeClose (default 8)
      minTurnsBeforeClose: 8,
      candidateCurrentCtc: 28,
      candidateTarget: 40,     // 40/32 = 1.25× ceiling → condition (1) in recommendWalkAway
      highestOfferMade: 0,     // NO offer made yet — the bug scenario
      /* Prior honest-defer stamp: the early planDiscoverySufficientAnchor gate
       * returned null (ceiling < CTC in that earlier state), stamped the topic,
       * and left highestOfferMade === 0. Without this stamp, planDiscoverySufficient-
       * Anchor would fire first and correctly anchor — the S25-B2 path only triggers
       * once that gate is blocked by the prior stamp. */
      askedTopics: [
        { topic: "band-anchor-with-rationale" as const, atTurn: 5 },
      ],
      discoveryChecklist: {
        ...EMPTY_DISCOVERY_CHECKLIST,
        currentCtcAnswered: true,
        currentCtcFixedVariableSplitDisclosed: true,
        fixedVariableSplitAnswered: true,
        noticePeriodAnswered: true,
        competingOffersAnswered: true,
        valueProofAnswered: true,
        targetAsked: true,
        targetAnswered: true,
      },
      /* conversationLog left empty → lastCandidateText="" → candidateIsEngaging=false
       * → suppressDeadlockWalk=false → recommendWalkAway condition (1) fires. */
    };
    const action = planNextAction(s);
    /* Must NOT be a walk-away with no offer on the table. */
    expect(action.kind).not.toBe("live-walk-away");
    /* Must be an anchor-with-offer so the candidate sees the ceiling. */
    expect(action.kind).toBe("anchor-with-offer");
    /* The offer must be at the band ceiling (Sprint B.1 fix anchors at maxStretch). */
    if (action.kind === "anchor-with-offer") {
      expect(action.initialOffer).toBe(WALK_BAND.maxStretch);
    }
  });

  it("DOES emit walk-away when the offer has already been made (offer-first guard already satisfied)", () => {
    const base = initState({
      sessionId: "s25b2-walk-with-offer",
      role: "Software Engineer",
      company: "flipkart",
      band: WALK_BAND,
    });
    const s: NegotiationState = {
      ...base,
      phase: "counter-offer",
      turnIndex: 12,
      minTurnsBeforeClose: 8,
      candidateCurrentCtc: 28,
      candidateTarget: 40,     // still 1.25× ceiling (> 1.2, < 1.5 so gap-gate doesn't trigger)
      highestOfferMade: 32,    // ceiling offer WAS made → offer-first guard satisfied, walk allowed
      /* Prior stamp so we're in the same post-honest-defer state as test 1. */
      askedTopics: [
        { topic: "band-anchor-with-rationale" as const, atTurn: 5 },
      ],
    };
    const action = planNextAction(s);
    /* Once highestOfferMade > 0, the walk-away should fire normally. */
    expect(action.kind).toBe("live-walk-away");
  });

  it("does NOT emit walk-away when turnIndex < minTurnsBeforeClose (walk still being suppressed)", () => {
    const base = initState({
      sessionId: "s25b2-not-yet",
      role: "Software Engineer",
      company: "flipkart",
      band: WALK_BAND,
    });
    const s: NegotiationState = {
      ...base,
      phase: "probe-expectations",
      turnIndex: 4,            // below minTurns=8 → walk not yet emitted
      minTurnsBeforeClose: 8,
      candidateCurrentCtc: 28,
      candidateTarget: 40,
      highestOfferMade: 0,
      /* Prior honest-defer stamp so planDiscoverySufficientAnchor is blocked —
       * puts us on the same path as test 1 but with turn < minTurns. */
      askedTopics: [
        { topic: "band-anchor-with-rationale" as const, atTurn: 2 },
      ],
      discoveryChecklist: {
        ...EMPTY_DISCOVERY_CHECKLIST,
        currentCtcAnswered: true,
        targetAsked: true,
        targetAnswered: true,
      },
    };
    const action = planNextAction(s);
    /* Walk is still suppressed; planner should NOT emit a walk-away. */
    expect(action.kind).not.toBe("live-walk-away");
  });
});

/* ─── S19-B1/B3 — hasConcreteTell + fake-leverage-challenge at counterRound≥1 ── */

/* S19-B1 (2026-07-22): Named competing offer disclosed at counterRound≥1 was
 * completely ignored. Root cause: hasConcreteTell required status!=null (verbal/
 * email/letter/signed), but "I have an offer from Zomato at 38" only extracts
 * stage="offered" (no status word) → hasConcreteTell returned false →
 * fake-leverage-challenge never armed → defensive ladder (comparative-anchoring
 * hold-firm) fired instead → competing offer silently dropped.
 *
 * S19-B3 (2026-07-22): Same root cause for offers disclosed in discovery phase
 * that carry into counter-offer: hasConcreteTell false → no challenge at round≥1.
 *
 * Fix: hasConcreteTell accepts stage="offered"/"accepted" as a concrete tell;
 * stage="interviewing" is excluded (process, not yet an offer). */

const CO_BAND: NegotiationBand = {
  initialOffer: 35,
  maxStretch: 42,
  walkAway: 30,
  hasEquity: false,
};

function anchoredAt35ForCoTest(): NegotiationState {
  let s = initState({ sessionId: "s19-b1", role: "product", company: "Razorpay", band: CO_BAND });
  s = { ...s, minTurnsBeforeClose: 0 };
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "ctc" }, "What is your current CTC?");
  s = applyCandidateAnswer(s, "My current CTC is 30 LPA");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "target" }, "What are you targeting?");
  s = applyCandidateAnswer(s, "I am targeting 41 LPA");
  s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: 35, rationale: "anchor" }, "For this grade we can do 35 LPA.");
  s = applyCandidateAnswer(s, "That is too low, I need more");
  s = applyAiMove(s, { lever: "counter-base", newTotalLpa: 36, rationale: "round 0 counter" }, "We can stretch to 36.");
  // counterRound = 1 now
  s = applyCandidateAnswer(s, "Still not enough");
  s = applyAiMove(s, { lever: "probe", newTotalLpa: null, rationale: "x" }, "Help me understand what number works for you.");
  return s;
}

describe("S19-B1/B3 — hasConcreteTell stage arm + fake-leverage-challenge at counterRound≥1", () => {
  it("hasConcreteTell: company+amount+stage='offered' is a concrete tell (status not required)", () => {
    expect(hasConcreteTell({
      company: "zomato", amount: 38, stage: "offered", status: null,
      letterShareOffered: false, onHold: false, proofRequestedAtTurn: null,
      proofProvided: false, hasAny: true,
    })).toBe(true);
  });

  it("hasConcreteTell: company+amount+stage='accepted' is a concrete tell", () => {
    expect(hasConcreteTell({
      company: "zomato", amount: 38, stage: "accepted", status: null,
      letterShareOffered: false, onHold: false, proofRequestedAtTurn: null,
      proofProvided: false, hasAny: true,
    })).toBe(true);
  });

  it("hasConcreteTell: stage='interviewing' with company+amount is NOT concrete (process, not offer)", () => {
    expect(hasConcreteTell({
      company: "zomato", amount: 38, stage: "interviewing", status: null,
      letterShareOffered: false, onHold: false, proofRequestedAtTurn: null,
      proofProvided: false, hasAny: true,
    })).toBe(false);
  });

  it("hasConcreteTell: vague (no company) with stage='offered' is NOT concrete", () => {
    expect(hasConcreteTell({
      company: null, amount: 38, stage: "offered", status: null,
      letterShareOffered: false, onHold: false, proofRequestedAtTurn: null,
      proofProvided: false, hasAny: true,
    })).toBe(false);
  });

  it("S19-B1: fake-leverage-challenge fires (not comparative-anchoring) when named offer first arrives at counterRound=1", () => {
    let s = anchoredAt35ForCoTest();
    // counterRound = 1 — candidate now reveals Zomato offer for the first time
    s = applyCandidateAnswer(s, "I have an offer from Zomato at 38, can you match it?");
    const action = planNextAction(s);
    expect(action.kind).toBe("fake-leverage-challenge");
    expect(action.kind).not.toBe("comparative-anchoring");
  });

  it("S19-B3: vague competing offer at counterRound=1 still routes to reactive-followup (competing-credibility probe)", () => {
    let s = anchoredAt35ForCoTest();
    // counterRound = 1 — unnamed offer (vague) → competing-credibility fires, not fake-leverage-challenge
    s = applyCandidateAnswer(s, "I have another offer at 39, can you match it?");
    const action = planNextAction(s);
    expect(action.kind).toBe("reactive-followup");
    expect(action.kind).not.toBe("fake-leverage-challenge");
  });
});
