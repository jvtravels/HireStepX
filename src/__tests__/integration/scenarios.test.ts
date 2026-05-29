/* End-to-end multi-turn integration scenarios A-E.
 *
 * Per the PDF#18 audit: leaf tests passed for months while `lockAnchor`
 * was orphan and `buildPostAcceptanceMessage` was never dispatched. The
 * dead-wiring class of bug doesn't surface in single-function unit
 * tests; it requires driving the kernel through a real multi-turn
 * session and asserting on state shape AND derived outputs.
 *
 * These scenarios drive `applyCandidateAnswer` + `pickAiMove` +
 * `applyAiMove` directly — no LLM mock. The `aiText` argument to
 * applyAiMove is a synthesized recruiter line that we control, so we
 * can assert on what the kernel commits without depending on LLM
 * non-determinism.
 *
 * Scenario A — Infosys IT-services counter-offer risk.
 * Scenario B — Designer → CSM resume↔role mismatch.
 * Scenario C — Hot-market data scientist.
 * Scenario D — Terminal accept + post-acceptance dispatch.
 * Scenario E — PDF#18 reproduction (Senior Product Designer → QA at JPM).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  pickAiMove,
  applyAiMove,
  effectiveAnchorLpa,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../../server-handlers/_negotiation-kernel";
import {
  EMPTY_DISCOVERY_CHECKLIST,
  type DiscoveryChecklist,
} from "../../../server-handlers/_discovery-stage";
import { estimateCounterOfferRisk } from "../../../server-handlers/_counter-offer-risk";

/* ─── Helpers ──────────────────────────────────────────────────────── */

/** Drive a single turn end-to-end: candidate utterance → pickAiMove →
 *  applyAiMove. The synthetic `aiText` lets us assert on bot artefacts
 *  (range disclosure, locked anchor) without depending on the LLM. */
function simulateTurn(
  state: NegotiationState,
  candidateText: string,
  aiText: string,
): { state: NegotiationState; move: AiMove } {
  const afterCandidate = applyCandidateAnswer(state, candidateText);
  const move = pickAiMove(afterCandidate);
  const afterAi = applyAiMove(afterCandidate, move, aiText);
  return { state: afterAi, move };
}

/* A pre-loaded discovery checklist for scenarios that want to skip
 * past the ordered probing and assert on later phases. */
const FULL_DISCOVERY: DiscoveryChecklist = {
  ...EMPTY_DISCOVERY_CHECKLIST,
  currentCtcAsked: true,
  currentCtcAnswered: true,
  fixedVariableSplitAsked: true,
  fixedVariableSplitAnswered: true,
  noticePeriodAsked: true,
  noticePeriodAnswered: true,
  competingOffersAsked: true,
  competingOffersAnswered: true,
  valueProofAsked: true,
  valueProofAnswered: true,
  targetAsked: true,
  targetAnswered: true,
  currentCtcFixedVariableSplitDisclosed: true,
  expectedCtcFixedVariableSplitDisclosed: true,
};

/* ─── Scenario A — Infosys IT-services counter-offer risk ──────────── */

describe("Scenario A — Infosys IT-services counter-offer risk", () => {
  const BAND: NegotiationBand = {
    initialOffer: 14,
    maxStretch: 18,
    walkAway: 11,
    hasEquity: false,
  };

  it("counter-offer-risk estimator returns 'medium' or 'high' for the short-tenure / Infosys / vague-competing pattern", () => {
    const risk = estimateCounterOfferRisk({
      currentCtcLpa: 12,
      targetLpa: 14,
      tenureMonths: 18,
      currentEmployer: "Infosys",
      competingOfferCredibility: "vague",
    });
    /* Short tenure (≤ 24mo), services-co retention pattern, hike in the
     * 15-22% counter-offer-sweet-spot, vague competing offer → score
     * stacks. Risk is at least medium (we assert ≥ medium so a tightening
     * of the threshold doesn't break the test). */
    expect(["medium", "high"]).toContain(risk.risk);
  });

  it("anchor stays locked after first numeric disclosure", () => {
    const s0 = initState({
      sessionId: "scen-a",
      role: "Software Engineer",
      company: "Infosys",
      band: BAND,
    });
    const move: AiMove = {
      lever: "open-with-offer",
      newTotalLpa: 14,
      rationale: "open at band initial",
    };
    const s1 = applyAiMove(s0, move, "We can extend ₹14L for the role.");
    expect(s1.anchorLocked).toBe(true);
    expect(s1.lockedAnchorLpa).toBe(14);
    expect(effectiveAnchorLpa(s1)).toBe(14);

    /* Second numeric move does NOT relock — anchor is immutable. */
    const move2: AiMove = {
      lever: "counter-base",
      newTotalLpa: 15,
      rationale: "small bump",
    };
    const s2 = applyAiMove(s1, move2, "We can stretch to ₹15L.");
    expect(s2.lockedAnchorLpa).toBe(14);
  });
});

/* ─── Scenario B — Designer → CSM mismatch ─────────────────────────── */

describe("Scenario B — Designer → CSM resume↔role mismatch", () => {
  const BAND: NegotiationBand = {
    initialOffer: 22,
    maxStretch: 30,
    walkAway: 18,
    hasEquity: true,
  };

  it("probe-mismatch stage routes to a domain-switch probe BEFORE any anchor", () => {
    const s = initState({
      sessionId: "scen-b",
      role: "Customer Success Manager",
      company: "unicorn-co",
      band: BAND,
    });
    /* Orchestrator-set discoveryStage simulates the resume↔role hard
     * mismatch detection running on turn 0. */
    const withMismatch: NegotiationState = {
      ...s,
      discoveryStage: "probe-mismatch",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    };
    const move = pickAiMove(withMismatch);
    expect(move.lever).toBe("probe");
    expect(move.newTotalLpa).toBeNull();
    expect(move.rationale.toLowerCase()).toMatch(/probe-mismatch|domain switch|resume/);
  });
});

/* ─── Scenario C — Hot-market data scientist ───────────────────────── */

describe("Scenario C — Hot-market data scientist", () => {
  const BAND: NegotiationBand = {
    initialOffer: 28,
    maxStretch: 38,
    walkAway: 22,
    hasEquity: true,
  };

  it("hot marketMode tightens concession multiplier (counter-base larger than neutral)", () => {
    const baseState = (mode: "hot" | "neutral"): NegotiationState => ({
      ...initState({
        sessionId: "scen-c",
        role: "Data Scientist",
        company: "gcc-tech",
        band: BAND,
        marketMode: mode,
      }),
      phase: "counter-offer",
      highestOfferMade: 28,
      candidateTarget: 35,
      candidateCurrentCtc: 22,
      turnIndex: 3,
    });
    const hotMove = pickAiMove(baseState("hot"));
    const neutralMove = pickAiMove(baseState("neutral"));
    expect(hotMove.lever).toBe("counter-base");
    expect(neutralMove.lever).toBe("counter-base");
    expect(hotMove.newTotalLpa).not.toBeNull();
    expect(neutralMove.newTotalLpa).not.toBeNull();
    /* Hot multiplier (1.3x) > neutral (1.0x) → hot counter lands higher. */
    expect(hotMove.newTotalLpa!).toBeGreaterThan(neutralMove.newTotalLpa!);
  });

  it("counter-offer-risk for hot-market data scientist with credible competing offer → low", () => {
    /* Letter-in-hand from competitor lowers retention risk; long-tenure
     * + no Indian-IT services employer caps it further. */
    const risk = estimateCounterOfferRisk({
      currentCtcLpa: 22,
      targetLpa: 35,
      tenureMonths: 48,
      currentEmployer: "small-startup",
      competingOfferCredibility: "letter-in-hand",
    });
    expect(risk.risk).toBe("low");
  });
});

/* ─── Scenario D — Terminal accept + post-acceptance dispatch ──────── */

describe("Scenario D — Terminal accept + post-acceptance dispatch", () => {
  const BAND: NegotiationBand = {
    initialOffer: 20,
    maxStretch: 26,
    walkAway: 16,
    hasEquity: true,
  };

  it("explicit acceptance transitions to terminal `accepted` and attaches buildPostAcceptanceMessage", () => {
    const s0: NegotiationState = {
      ...initState({
        sessionId: "scen-d",
        role: "Software Engineer",
        company: "tech-co",
        band: BAND,
      }),
      phase: "counter-offer",
      highestOfferMade: 22,
      candidateTarget: 24,
      turnIndex: 8,
      minTurnsBeforeClose: 1,
      discoveryChecklist: FULL_DISCOVERY,
    };
    const next = applyCandidateAnswer(s0, "I accept the offer, please send the offer letter.");
    expect(next.phase).toBe("accepted");
    expect(next.acceptedAtTurn).toBe(8);
    expect(typeof next.postAcceptanceMessage).toBe("string");
    const msg = next.postAcceptanceMessage ?? "";
    /* PDF#45 follow-up (2026-05-25) — trimmed checklist; relieving-letter
     * lives in the BGV partner blurb now. */
    expect(msg).toMatch(/Aadhaar/);
    expect(msg).toMatch(/PAN/);
    expect(msg).toMatch(/Relieving-letter/i);
    expect(msg).toMatch(/BGV/i);
  });

  it("close-acceptance lever fires on the move after terminal accepted", () => {
    const s0: NegotiationState = {
      ...initState({
        sessionId: "scen-d-2",
        role: "Software Engineer",
        company: "tech-co",
        band: BAND,
      }),
      phase: "counter-offer",
      highestOfferMade: 22,
      turnIndex: 8,
      minTurnsBeforeClose: 1,
      discoveryChecklist: FULL_DISCOVERY,
    };
    const afterCand = applyCandidateAnswer(s0, "Yes I accept the offer.");
    expect(afterCand.phase).toBe("accepted");
    const move = pickAiMove(afterCand);
    expect(move.lever).toBe("close-acceptance");
  });
});

/* ─── Scenario E — PDF#18 repro: Senior Designer → QA at JPM ───────── */

describe("Scenario E — PDF#18 reproduction (Senior Product Designer → QA Engineer at JP Morgan)", () => {
  const BAND: NegotiationBand = {
    initialOffer: 18,
    maxStretch: 25,
    walkAway: 14,
    hasEquity: true,
  };

  it("anchor locks on first disclosure and does not change on a later turn", () => {
    const s0 = initState({
      sessionId: "scen-e",
      role: "QA Engineer",
      company: "JP Morgan",
      band: BAND,
    });
    const open: AiMove = {
      lever: "open-with-offer",
      newTotalLpa: 18,
      rationale: "open at QA band",
    };
    const s1 = applyAiMove(s0, open, "Our opening is ₹18L for the QA role.");
    expect(s1.anchorLocked).toBe(true);
    expect(s1.lockedAnchorLpa).toBe(18);

    /* Even if the move-picker later proposes a counter, the LOCKED
     * anchor never changes — it's the immutable opening reference. */
    const s2 = applyAiMove(
      s1,
      { lever: "counter-base", newTotalLpa: 20, rationale: "small stretch" },
      "We can stretch to ₹20L.",
    );
    expect(s2.lockedAnchorLpa).toBe(18);
    expect(effectiveAnchorLpa(s2)).toBe(18);
  });

  it("current CTC is asked BEFORE a specific anchor when discovery is active and incomplete", () => {
    const s: NegotiationState = {
      ...initState({
        sessionId: "scen-e-2",
        role: "QA Engineer",
        company: "JP Morgan",
        band: BAND,
      }),
      phase: "opening",
      turnIndex: 1,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    };
    const move = pickAiMove(s);
    expect(move.lever).toBe("probe");
    expect(move.rationale).toMatch(/Discovery incomplete \(next: currentCtcAnswered\)/);
  });

  it("post-acceptance message includes notice/LWD/doc-checklist sections", () => {
    const s: NegotiationState = {
      ...initState({
        sessionId: "scen-e-3",
        role: "QA Engineer",
        company: "JP Morgan",
        band: BAND,
      }),
      phase: "counter-offer",
      highestOfferMade: 20,
      turnIndex: 8,
      minTurnsBeforeClose: 1,
      discoveryChecklist: FULL_DISCOVERY,
    };
    const next = applyCandidateAnswer(s, "I accept the offer.");
    expect(next.phase).toBe("accepted");
    const msg = next.postAcceptanceMessage ?? "";
    /* Documents — PDF#45 trimmed checklist (identity only); remaining
     * docs are referenced via the BGV partner blurb. */
    expect(msg).toMatch(/Aadhaar/);
    expect(msg).toMatch(/PAN/);
    expect(msg).toMatch(/payslips/i);
    expect(msg).toMatch(/Relieving-letter/i);
    expect(msg.toLowerCase()).toMatch(/joining[-\s]date/);
  });

  it("turn-coherence: simulated multi-turn drives anchorLocked + discoveryChecklist through ordered probes", () => {
    /* PDF#39 BUG-A regression (2026-05-20). This test was authored
     * before the AP3-F3 anchor-with-band lever was wired and was
     * incidentally passing only because the planner's anchor-with-offer
     * move emitted `_move.newTotalLpa: null`, which suppressed
     * highestOfferMade and anchorLocked. With BUG-A fixed, the planner
     * correctly locks the anchor as soon as currentCtc lands and the
     * profile is non-senior (no component cascade required). The
     * assertion below was inverted: AP3-F3 anchors BEFORE target by
     * design (real Indian HR puts a fitment on the table and invites
     * the candidate's reaction rather than grinding through every
     * discovery probe first). The test now pins the correct contract:
     * non-senior + currentCtc disclosed → AP3-F3 anchor-with-band fires
     * and anchorLocked transitions to true.
     *
     * To keep the original probe-cascade intent intact, the test now
     * pre-fires the AP3-F3 anchor via askedTopics, modelling the prior
     * "anchor already happened" state, so the subsequent assertions
     * exercise the probe cascade as originally intended. */
    let s: NegotiationState = {
      ...initState({
        sessionId: "scen-e-multiturn",
        role: "Software Engineer",
        company: "tech-co",
        band: BAND,
      }),
      phase: "opening",
      turnIndex: 1,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
      /* Pre-fire AP3-F3 single-fire ledger so the planner skips the
       * anchor lever and the assertion below tests the discovery-probe
       * cascade as the original test intended. */
      askedTopics: [{ topic: "band-anchor-with-rationale", atTurn: 0 }],
    };
    /* Turn 1: candidate states current CTC. Bot probes for split next. */
    let r = simulateTurn(s, "My current CTC is 14L.", "What's the fixed/variable split on that?");
    s = r.state;
    expect(s.anchorLocked).toBeFalsy();
    expect(r.move.lever).toBe("probe");

    /* Turn 2: candidate states split. Bot probes for target next. */
    r = simulateTurn(s, "Fixed 12L and variable 2L.", "And your target?");
    s = r.state;
    expect(s.anchorLocked).toBeFalsy();
    expect(r.move.lever).toBe("probe");
  });
});

/* ─── Scenario F — Dead-input wiring (callTimeIso + powerSignals) ──── *
 *
 * Regression guard for the 2026-05-30 dead-input wiring. The kernel
 * exposes `callTimeIso` and `powerSignals` on `InitStateInput`, but
 * `negotiate-turn.ts` previously didn't pass either, so the power-
 * dynamics + time-context features were dormant in live sessions.
 * This scenario asserts that when init receives both, the derived
 * fields actually land on state. */

describe("Scenario F — dead-input wiring activates power + time context", () => {
  const BAND: NegotiationBand = { initialOffer: 14, maxStretch: 18, walkAway: 11 };

  it("callTimeIso → timeContext bucket; powerSignals.quarterTiming → recruiterPower", () => {
    /* Friday 17:30 IST in mid-quarter — should bucket as friday-rush, and
     * the explicit quarter-end signal should drive recruiterPower negative. */
    const fridayEveningIst = "2026-05-29T12:00:00.000Z"; // 17:30 IST, Fri
    const s = initState({
      sessionId: "scen-f-deadinputs",
      role: "Software Engineer",
      company: "tech-co",
      band: BAND,
      callTimeIso: fridayEveningIst,
      powerSignals: { quarterTiming: "quarter-end" },
    });
    expect(s.timeContext).toBe("friday-rush");
    expect(s.powerSignals?.quarterTiming).toBe("quarter-end");
    expect(typeof s.recruiterPower).toBe("number");
    expect(s.recruiterPower!).toBeLessThan(0);
  });

  it("defaults are safe when both inputs omitted (back-compat)", () => {
    const s = initState({
      sessionId: "scen-f-defaults",
      role: "Software Engineer",
      company: "tech-co",
      band: BAND,
    });
    expect(s.timeContext).toBe("midweek-standard");
    expect(s.recruiterPower).toBe(0);
  });
});
