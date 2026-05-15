/* C2 — active phase gating with narrow trigger (2026-05-15).
 *
 * Two earlier audits deferred this item because the obvious gate point
 * (opening → open-with-offer) would force a probe instead of an opening
 * offer on turn 0, breaking every opening-flow test. The narrow trigger
 * ships here: gate ONLY when the candidate has spoken at least once
 * (turnIndex >= 1) AND discoveryStage === "discovery" AND the checklist
 * is incomplete. Turn-0 tests continue to route through open-with-offer
 * unchanged; legacy sessions without discoveryStage are unaffected.
 *
 * The gate has two coordinated sites:
 *   1. derivePhase — holds phase at "opening" so subsequent turns keep
 *      flowing through the opening branch rather than advancing into
 *      offer/probe territory.
 *   2. pickAiMove opening branch — emits a discovery probe (with the
 *      next required discovery item baked into the rationale) instead
 *      of open-with-offer when the guard condition is met.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  derivePhase,
  pickAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  EMPTY_DISCOVERY_CHECKLIST,
  type DiscoveryChecklist,
} from "../../server-handlers/_discovery-stage";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: true,
};

const init = (
  overrides: Partial<NegotiationState> = {},
): NegotiationState => ({
  ...initState({
    sessionId: "s-active-phase-gating",
    role: "Software Engineer",
    company: "acme",
    band: BAND,
  }),
  ...overrides,
});

const COMPLETE_CHECKLIST: DiscoveryChecklist = {
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
};

describe("derivePhase — active phase gating (narrow trigger)", () => {
  it("turn 0 + empty checklist + opening → opening (legacy behavior preserved)", () => {
    /* The original deferral was about not breaking this case: turn 0
     * with an empty checklist must not be gated, otherwise every
     * opening-flow test would force a probe instead of an offer. */
    const s = init({ phase: "opening" });
    expect(s.turnIndex).toBe(0);
    expect(derivePhase(s)).toBe("opening");
  });

  it("turn 0 + opening + highestOfferMade > 0 → advances to offer-presented (legacy)", () => {
    /* Belt-and-suspenders: the gate must not fire at turn 0 even when
     * the seed already shows an offer on the table. */
    const s = init({ phase: "opening", highestOfferMade: 20 });
    expect(derivePhase(s)).toBe("offer-presented");
  });

  it("turn 2 + discovery + incomplete checklist + no offer → HOLD at opening", () => {
    const s = init({
      phase: "opening",
      turnIndex: 2,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    });
    expect(derivePhase(s)).toBe("opening");
  });

  it("turn 2 + discovery + COMPLETE checklist + no offer → advances to range-disclosure", () => {
    /* Gate clears once the discovery bar is met. PDF#18 follow-up
     * (2026-05-15): once discovery is complete and no specific anchor
     * has been disclosed, derivePhase now promotes to "range-disclosure"
     * (the bot must volunteer a salary RANGE before converging to a
     * single number). Prior assertion expected "opening" — that was the
     * pre-enum behaviour where the range-disclosure rule lived only in
     * the brief layer. */
    const s = init({
      phase: "opening",
      turnIndex: 2,
      highestOfferMade: 0,
      discoveryStage: "discovery",
      discoveryChecklist: COMPLETE_CHECKLIST,
    });
    expect(derivePhase(s)).toBe("range-disclosure");
  });

  it("turn 2 + discovery + incomplete + offer ALREADY made → advances (discovery override past)", () => {
    /* Once an anchor is out, the gate is past — we don't ratchet
     * backwards. The existing post-offer advancement runs unchanged. */
    const s = init({
      phase: "opening",
      turnIndex: 2,
      highestOfferMade: 20,
      discoveryStage: "discovery",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    });
    expect(derivePhase(s)).toBe("offer-presented");
  });

  it("turn 2 + no discoveryStage set → advances normally (legacy non-discovery flow)", () => {
    /* Back-compat: a session that predates discovery tracking has
     * discoveryStage undefined; the gate must not fire. */
    const base = init({
      phase: "opening",
      turnIndex: 2,
      highestOfferMade: 20,
    });
    const legacy: NegotiationState = {
      ...base,
      discoveryStage: undefined,
      discoveryChecklist: undefined,
    };
    expect(derivePhase(legacy)).toBe("offer-presented");
  });

  it("turn 2 + discoveryStage='probe-mismatch' → not gated by discovery branch", () => {
    /* probe-mismatch is a parallel sub-stage, not "discovery"; the
     * gate is specific to discoveryStage === "discovery". */
    const s = init({
      phase: "opening",
      turnIndex: 2,
      highestOfferMade: 20,
      discoveryStage: "probe-mismatch",
      discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    });
    expect(derivePhase(s)).toBe("offer-presented");
  });
});

describe("pickAiMove opening branch — active phase gating", () => {
  it("turn 0 + opening + empty checklist → open-with-offer (legacy preserved)", () => {
    const m = pickAiMove(
      init({
        phase: "opening",
        discoveryStage: "discovery",
        discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
      }),
    );
    expect(m.lever).toBe("open-with-offer");
    expect(m.newTotalLpa).toBe(BAND.initialOffer);
  });

  it("turn 1 + opening + discovery incomplete → discovery probe (NOT open-with-offer)", () => {
    const m = pickAiMove(
      init({
        phase: "opening",
        turnIndex: 1,
        discoveryStage: "discovery",
        discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
      }),
    );
    expect(m.lever).toBe("probe");
    expect(m.newTotalLpa).toBeNull();
    expect(m.rationale.toLowerCase()).toMatch(/discovery incomplete/);
    expect(m.rationale.toLowerCase()).toMatch(/current\s+ctc/);
  });

  it("turn 1 + opening + discovery COMPLETE → open-with-offer (gate clears)", () => {
    const m = pickAiMove(
      init({
        phase: "opening",
        turnIndex: 1,
        discoveryStage: "discovery",
        discoveryChecklist: COMPLETE_CHECKLIST,
      }),
    );
    expect(m.lever).toBe("open-with-offer");
  });

  it("turn 1 + opening + no discoveryStage (legacy session) → open-with-offer", () => {
    const base = init({ phase: "opening", turnIndex: 1 });
    const legacy: NegotiationState = {
      ...base,
      discoveryStage: undefined,
      discoveryChecklist: undefined,
    };
    const m = pickAiMove(legacy);
    expect(m.lever).toBe("open-with-offer");
  });

  it("turn 2 + opening + partially complete checklist → probe with NEXT discovery item", () => {
    /* currentCtc and fixedVariableSplit already answered; per the
     * PDF#18 ordered DISCOVERY_SEQUENCE the next required item is
     * targetAnswered (target/expected CTC comes before notice). The
     * probe rationale must surface the target prompt so compactTurnBrief
     * / [NEXT REQUIRED ACTION] picks it up. (Prior assertion expected
     * /notice/i — that was the legacy priority-cascade behaviour; the
     * ordered variant places target before notice.) */
    const partial: DiscoveryChecklist = {
      ...EMPTY_DISCOVERY_CHECKLIST,
      currentCtcAsked: true,
      currentCtcAnswered: true,
      fixedVariableSplitAsked: true,
      fixedVariableSplitAnswered: true,
    };
    const m = pickAiMove(
      init({
        phase: "opening",
        turnIndex: 2,
        discoveryStage: "discovery",
        discoveryChecklist: partial,
      }),
    );
    expect(m.lever).toBe("probe");
    expect(m.rationale).toMatch(/target/i);
  });

  it("turn 1 + opening + probe-mismatch stage → does NOT trigger discovery branch", () => {
    /* probe-mismatch has its own routing earlier in the picker (the
     * domain-switch probe). The opening-discovery gate is keyed on
     * discoveryStage === "discovery" specifically. */
    const m = pickAiMove(
      init({
        phase: "opening",
        turnIndex: 1,
        discoveryStage: "probe-mismatch",
        discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
      }),
    );
    /* probe-mismatch routes to a probe with a domain-switch rationale —
     * NOT the discovery-incomplete rationale. */
    expect(m.lever).toBe("probe");
    expect(m.rationale.toLowerCase()).not.toMatch(/discovery incomplete/);
  });
});
