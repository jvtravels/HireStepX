/* Negotiation-flow redesign commit 6 (2026-05-15) — phase-transition
 * monotonicity matrix. Pins the structural one-way ratchet that
 * replaces the prior ad-hoc sticky clauses (POST_PROBE_PHASES /
 * isPostProbe / alreadyProbed) inside derivePhase.
 *
 * Audit ref: /tmp/negotiation-flow-audit.md D6 + section C.4.
 *
 * Two legitimate backward exceptions:
 *   1. walk-away-reopen   — walkAwayReturned flag set after candidate
 *      re-engages from `walked-away`; phase hops to `counter-offer`.
 *   2. verbal-renege      — postVerbalRenegotiationCount > 0 after the
 *      candidate said yes then actively re-opened; phase stays in
 *      `counter-offer` while the move-picker stiffens. Gated on the
 *      active renege count (2026-06-15 audit, Kernel Finding 3), not the
 *      permanent verbalAcceptanceTurn stamp. */
import { describe, it, expect } from "vitest";
import {
  initState,
  canTransitionPhase,
  type NegotiationBand,
  type NegotiationState,
  type NegotiationPhase,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: true,
};

const mk = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "s-phase-monotonicity",
    role: "Software Engineer",
    company: "acme",
    band: BAND,
  }),
  ...overrides,
});

const ORDERED_PHASES: NegotiationPhase[] = [
  "opening",
  "range-disclosure",
  "offer-presented",
  "probe-expectations",
  "counter-offer",
  "lever-explore",
  "closing-push",
];

describe("canTransitionPhase — monotonicity matrix", () => {
  it("allows every legal forward transition along the canonical ladder", () => {
    const s = mk();
    for (let i = 0; i < ORDERED_PHASES.length - 1; i++) {
      const from = ORDERED_PHASES[i];
      const to = ORDERED_PHASES[i + 1];
      expect(canTransitionPhase(from, to, s)).toBe(true);
    }
  });

  it("allows skip-ahead forward transitions (opening → counter-offer)", () => {
    const s = mk();
    expect(canTransitionPhase("opening", "counter-offer", s)).toBe(true);
    expect(canTransitionPhase("opening", "lever-explore", s)).toBe(true);
    expect(canTransitionPhase("offer-presented", "lever-explore", s)).toBe(true);
  });

  it("allows same-phase no-op transitions for every phase", () => {
    const s = mk();
    for (const p of ORDERED_PHASES) {
      expect(canTransitionPhase(p, p, s)).toBe(true);
    }
    for (const p of ["accepted", "walked-away", "stalemate"] as NegotiationPhase[]) {
      expect(canTransitionPhase(p, p, s)).toBe(true);
    }
  });

  it("blocks every illegal regression along the canonical ladder", () => {
    const s = mk();
    for (let i = 1; i < ORDERED_PHASES.length; i++) {
      const from = ORDERED_PHASES[i];
      for (let j = 0; j < i; j++) {
        const to = ORDERED_PHASES[j];
        expect(canTransitionPhase(from, to, s)).toBe(false);
      }
    }
  });

  it("blocks counter-offer → probe-expectations regression (D6 MakeMyTrip case)", () => {
    const s = mk();
    expect(canTransitionPhase("counter-offer", "probe-expectations", s)).toBe(false);
  });

  it("blocks range-disclosure → opening regression", () => {
    const s = mk();
    expect(canTransitionPhase("range-disclosure", "opening", s)).toBe(false);
  });

  it("blocks lever-explore → counter-offer regression (without re-open flag)", () => {
    const s = mk();
    expect(canTransitionPhase("lever-explore", "counter-offer", s)).toBe(false);
  });

  it("allows walk-away → counter-offer ONLY when walkAwayReturned is true", () => {
    const without = mk({ walkAwayReturned: false });
    const withFlag = mk({ walkAwayReturned: true });
    expect(canTransitionPhase("walked-away", "counter-offer", without)).toBe(false);
    expect(canTransitionPhase("walked-away", "counter-offer", withFlag)).toBe(true);
  });

  it("allows verbal-renege regression to counter-offer when renege is active", () => {
    const reneging = mk({ verbalAcceptanceTurn: 4, postVerbalRenegotiationCount: 1 });
    expect(canTransitionPhase("lever-explore", "counter-offer", reneging)).toBe(true);
    expect(canTransitionPhase("closing-push", "counter-offer", reneging)).toBe(true);
    /* Without an active renege the same transitions are forbidden. */
    const plain = mk();
    expect(canTransitionPhase("lever-explore", "counter-offer", plain)).toBe(false);
    expect(canTransitionPhase("closing-push", "counter-offer", plain)).toBe(false);
  });

  it("does NOT regress on a clean acceptance — stamp set but no active renege", () => {
    /* Kernel Finding 3 (2026-06-15): the verbalAcceptanceTurn stamp never
     * clears, so the old gate dragged a settled deal backward to
     * counter-offer indefinitely. Gating on postVerbalRenegotiationCount
     * means a clean acceptance (count 0) stays put. */
    const cleanAccept = mk({ verbalAcceptanceTurn: 4, postVerbalRenegotiationCount: 0 });
    expect(canTransitionPhase("lever-explore", "counter-offer", cleanAccept)).toBe(false);
    expect(canTransitionPhase("closing-push", "counter-offer", cleanAccept)).toBe(false);
  });

  it("verbal-renege exception does NOT open arbitrary backward transitions", () => {
    /* Only the counter-offer target is unlocked; lever-explore → probe-expectations
     * stays blocked even with an active renege. */
    const reneging = mk({ verbalAcceptanceTurn: 4, postVerbalRenegotiationCount: 1 });
    expect(canTransitionPhase("lever-explore", "probe-expectations", reneging)).toBe(false);
    expect(canTransitionPhase("counter-offer", "opening", reneging)).toBe(false);
  });

  it("terminals are non-transitionable to non-terminal phases (except walk-away-reopen)", () => {
    const plain = mk();
    for (const term of ["accepted", "stalemate"] as NegotiationPhase[]) {
      for (const to of ORDERED_PHASES) {
        expect(canTransitionPhase(term, to, plain)).toBe(false);
      }
    }
    /* walked-away similarly blocks every non-counter-offer destination by default. */
    for (const to of ORDERED_PHASES) {
      if (to === "counter-offer") continue;
      expect(canTransitionPhase("walked-away", to, plain)).toBe(false);
    }
  });

  it("terminals can transition between each other (shared rank 7)", () => {
    const s = mk();
    /* Same-rank transitions pass the rank check — even between distinct
     * terminal phases. derivePhase's own terminal-sticky guard prevents
     * this in practice, so this is a contract test on the matrix only. */
    expect(canTransitionPhase("accepted", "walked-away", s)).toBe(true);
    expect(canTransitionPhase("walked-away", "stalemate", s)).toBe(true);
  });
});

describe("derivePhase — clamped by monotonicity", () => {
  it("walk-away-reopen path remains functional (applyCandidateAnswer hop preserved)", async () => {
    const { applyCandidateAnswer } = await import(
      "../../server-handlers/_negotiation-kernel"
    );
    const reopened = applyCandidateAnswer(
      mk({
        phase: "walked-away",
        walkedAwayAtTurn: 5,
        turnIndex: 6,
        highestOfferMade: 22,
      }),
      "actually, can we revisit? I might be able to make this work.",
    );
    expect(reopened.walkAwayReturned).toBe(true);
    /* The reopen path explicitly assigns phase = counter-offer BEFORE the
     * derivePhase clamp runs; the clamp itself permits walked-away →
     * counter-offer via the walkAwayReturned exception. */
    expect(reopened.phase).toBe("counter-offer");
  });

  it("verbal-renege keeps phase in counter-offer (matrix exception preserved)", async () => {
    /* End-to-end smoke: a state with an ACTIVE renege should not regress
     * below counter-offer when derivePhase runs. We assert via
     * canTransitionPhase (the matrix) since derivePhase's own cascade
     * rarely picks a backward target — the contract is what we pin here. */
    const reneging = mk({
      verbalAcceptanceTurn: 4,
      postVerbalRenegotiationCount: 1,
      phase: "lever-explore",
    });
    expect(canTransitionPhase("lever-explore", "counter-offer", reneging)).toBe(true);
  });
});
