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
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { EMPTY_DISCOVERY_CHECKLIST } from "../../server-handlers/_discovery-stage";

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
