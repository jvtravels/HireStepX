/* Phase 5 Session A (2026-05-19) — multi-round simulated persona switch.
 *
 * Tests kernel + planner threading. Session B owns prose layer + UI;
 * stub prose is exercised here for crash safety only.
 *
 * Invariants:
 *   1. `selectNextRoundPersona` sequence: hr-partner → hiring-manager →
 *      director → null (terminal).
 *   2. Default-OFF byte-identical: `initState({ multiRoundEnabled: false })`
 *      leaves `roundPersona` undefined, `roundIndex` 0, `roundTransitions`
 *      empty, `multiRoundEnabled` false. No round mutation can occur.
 *   3. Opt-in seeds correctly: `initState({ multiRoundEnabled: true })`
 *      → `roundPersona === "hr-partner"`, `roundIndex === 0`,
 *      `perRoundBand` populated.
 *   4. Per-round band defaults: HR Partner floor < HM stretch <
 *      Director stretch (ordered maxStretch).
 *   5. `maybeAdvanceRound` triggers on closing-push / accepted / walked-
 *      away phases AND roundIndex < 2; idempotent and bounded above.
 *   6. After 3 rounds (Director seated), no further transition fires.
 *   7. `roundTransitions` accumulates across the trajectory.
 *   8. Planner picks `round-transition` the turn `roundTransitions` gets
 *      a fresh entry.
 *   9. Canonical-prose stub renders without throwing.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  maybeAdvanceRound,
  deriveDefaultPerRoundBand,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  selectNextRoundPersona,
  ROUND_PERSONA_SEQUENCE,
} from "../../server-handlers/_negotiation-rounds";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: true,
};

function mk(overrides: Partial<{ multiRoundEnabled: boolean }> = {}): NegotiationState {
  return initState({
    sessionId: "phase5a-multiround",
    role: "Backend Engineer",
    company: "Flipkart",
    band: BAND,
    multiRoundEnabled: overrides.multiRoundEnabled,
  });
}

describe("Phase 5 Session A — selectNextRoundPersona", () => {
  it("happy path: hr-partner → hiring-manager → director → null", () => {
    expect(selectNextRoundPersona("hr-partner")).toBe("hiring-manager");
    expect(selectNextRoundPersona("hiring-manager")).toBe("director");
    expect(selectNextRoundPersona("director")).toBeNull();
  });

  it("ROUND_PERSONA_SEQUENCE enumerates all three personas in order", () => {
    expect(ROUND_PERSONA_SEQUENCE).toEqual([
      "hr-partner",
      "hiring-manager",
      "director",
    ]);
  });
});

describe("Phase 5 Session A — initState multi-round opt-in", () => {
  it("default-OFF leaves round state inert (byte-identical invariance)", () => {
    const s = mk(); /* multiRoundEnabled omitted */
    expect(s.multiRoundEnabled).toBe(false);
    expect(s.roundPersona).toBeUndefined();
    expect(s.roundIndex).toBe(0);
    expect(s.roundTransitions).toEqual([]);
    expect(s.perRoundBand).toBeUndefined();
  });

  it("explicit false is the same as omitted", () => {
    const s = mk({ multiRoundEnabled: false });
    expect(s.multiRoundEnabled).toBe(false);
    expect(s.roundPersona).toBeUndefined();
    expect(s.roundIndex).toBe(0);
    expect(s.roundTransitions).toEqual([]);
    expect(s.perRoundBand).toBeUndefined();
  });

  it("opt-in seeds at HR Partner / round 0 / derived per-round band", () => {
    const s = mk({ multiRoundEnabled: true });
    expect(s.multiRoundEnabled).toBe(true);
    expect(s.roundPersona).toBe("hr-partner");
    expect(s.roundIndex).toBe(0);
    expect(s.roundTransitions).toEqual([]);
    expect(s.perRoundBand).toBeDefined();
    expect(s.perRoundBand!["hr-partner"].maxStretch).toBeLessThan(
      s.perRoundBand!["hiring-manager"].maxStretch,
    );
  });
});

describe("Phase 5 Session A — deriveDefaultPerRoundBand", () => {
  it("orders maxStretch: HR Partner floor < HM stretch < Director stretch", () => {
    const r = deriveDefaultPerRoundBand(BAND);
    expect(r["hr-partner"].maxStretch).toBe(BAND.initialOffer);
    expect(r["hiring-manager"].maxStretch).toBeGreaterThan(r["hr-partner"].maxStretch);
    expect(r["hiring-manager"].maxStretch).toBeLessThan(r["director"].maxStretch);
    expect(r["director"].maxStretch).toBe(BAND.maxStretch);
  });

  it("preserves walkAway / hasEquity / initialOffer across rounds", () => {
    const r = deriveDefaultPerRoundBand(BAND);
    for (const persona of ROUND_PERSONA_SEQUENCE) {
      expect(r[persona].walkAway).toBe(BAND.walkAway);
      expect(r[persona].hasEquity).toBe(BAND.hasEquity);
      expect(r[persona].initialOffer).toBe(BAND.initialOffer);
    }
  });
});

describe("Phase 5 Session A — maybeAdvanceRound", () => {
  it("default-OFF is a typed no-op (multiRoundEnabled=false)", () => {
    const s = { ...mk(), phase: "closing-push" as const, turnIndex: 5 };
    expect(maybeAdvanceRound(s)).toBe(s);
  });

  it("triggers on closing-push AND roundIndex < 2 — advances to next persona", () => {
    const base = mk({ multiRoundEnabled: true });
    const s: NegotiationState = { ...base, phase: "closing-push", turnIndex: 5 };
    const next = maybeAdvanceRound(s);
    expect(next).not.toBe(s);
    expect(next.roundPersona).toBe("hiring-manager");
    expect(next.roundIndex).toBe(1);
    expect(next.roundTransitions).toHaveLength(1);
    expect(next.roundTransitions![0]).toEqual({
      atTurn: 5,
      from: "hr-partner",
      to: "hiring-manager",
    });
    /* Phase reset to opening so the next round starts fresh. */
    expect(next.phase).toBe("opening");
    /* Round-scoped fields cleared. */
    expect(next.verbalAcceptanceTurn).toBeNull();
    expect(next.acceptedAtTurn).toBeNull();
    expect(next.walkedAwayAtTurn).toBeNull();
  });

  it("triggers on `accepted` and `walked-away` phases the same way", () => {
    const base = mk({ multiRoundEnabled: true });
    for (const phase of ["accepted", "walked-away"] as const) {
      const s: NegotiationState = { ...base, phase, turnIndex: 6 };
      const next = maybeAdvanceRound(s);
      expect(next.roundPersona).toBe("hiring-manager");
      expect(next.roundIndex).toBe(1);
    }
  });

  it("does NOT trigger on non-round-end phases", () => {
    const base = mk({ multiRoundEnabled: true });
    const s: NegotiationState = { ...base, phase: "counter-offer", turnIndex: 4 };
    expect(maybeAdvanceRound(s)).toBe(s);
  });

  it("after 3 rounds (Director seated), no further transition fires", () => {
    const base = mk({ multiRoundEnabled: true });
    const directorState: NegotiationState = {
      ...base,
      roundPersona: "director",
      roundIndex: 2,
      phase: "closing-push",
      turnIndex: 10,
    };
    const next = maybeAdvanceRound(directorState);
    expect(next).toBe(directorState);
    expect(next.roundPersona).toBe("director");
    expect(next.roundIndex).toBe(2);
  });

  it("accumulates roundTransitions across the full trajectory", () => {
    const base = mk({ multiRoundEnabled: true });
    /* Round 0 → 1 handoff at turn 5. */
    const r0 = { ...base, phase: "closing-push" as const, turnIndex: 5 };
    const r1 = maybeAdvanceRound(r0);
    /* Round 1 → 2 handoff at turn 10. */
    const r1Closing = { ...r1, phase: "closing-push" as const, turnIndex: 10 };
    const r2 = maybeAdvanceRound(r1Closing);
    expect(r2.roundPersona).toBe("director");
    expect(r2.roundIndex).toBe(2);
    expect(r2.roundTransitions).toHaveLength(2);
    expect(r2.roundTransitions![0]).toEqual({
      atTurn: 5,
      from: "hr-partner",
      to: "hiring-manager",
    });
    expect(r2.roundTransitions![1]).toEqual({
      atTurn: 10,
      from: "hiring-manager",
      to: "director",
    });
    /* Round 2 (Director) closing — no further transition. */
    const r2Closing = { ...r2, phase: "closing-push" as const, turnIndex: 15 };
    const r3 = maybeAdvanceRound(r2Closing);
    expect(r3).toBe(r2Closing);
  });

  it("clamps new band initialOffer up to highestOfferMade (close-floor invariant)", () => {
    /* Simulate a session where the candidate has already received an
     * offer of ₹25L from HR Partner and the perRoundBand for HM
     * declares an initialOffer below that. The handoff must not let
     * the new band drop the floor — clamp initialOffer up. */
    const base = mk({ multiRoundEnabled: true });
    const customPerRound = {
      ...base.perRoundBand!,
      "hiring-manager": { ...base.perRoundBand!["hiring-manager"], initialOffer: 20 },
    };
    const s: NegotiationState = {
      ...base,
      phase: "closing-push",
      turnIndex: 5,
      highestOfferMade: 25,
      perRoundBand: customPerRound,
    };
    const next = maybeAdvanceRound(s);
    expect(next.band.initialOffer).toBe(25);
  });
});

describe("Phase 5 Session A — planNextAction round-transition branch", () => {
  it("picks `round-transition` the turn roundTransitions gets a fresh entry", () => {
    const base = mk({ multiRoundEnabled: true });
    const transitionedState: NegotiationState = {
      ...base,
      roundPersona: "hiring-manager",
      roundIndex: 1,
      phase: "opening",
      turnIndex: 5,
      roundTransitions: [
        { atTurn: 5, from: "hr-partner", to: "hiring-manager" },
      ],
    };
    const action = planNextAction(transitionedState);
    expect(action.kind).toBe("round-transition");
    if (action.kind === "round-transition") {
      expect(action.from).toBe("hr-partner");
      expect(action.to).toBe("hiring-manager");
    }
  });

  it("does NOT pre-empt when the transition entry is stale (older turn)", () => {
    const base = mk({ multiRoundEnabled: true });
    const stale: NegotiationState = {
      ...base,
      roundPersona: "hiring-manager",
      roundIndex: 1,
      phase: "opening",
      turnIndex: 7, /* moved on since the handoff at turn 5 */
      roundTransitions: [
        { atTurn: 5, from: "hr-partner", to: "hiring-manager" },
      ],
    };
    const action = planNextAction(stale);
    expect(action.kind).not.toBe("round-transition");
  });

  it("does NOT fire when multiRoundEnabled=false even if a transition entry is present", () => {
    /* Defensive: data corruption can leave a transition entry on a
     * single-round session; the planner must not honour it. */
    const base = mk();
    const s: NegotiationState = {
      ...base,
      turnIndex: 5,
      roundTransitions: [
        { atTurn: 5, from: "hr-partner", to: "hiring-manager" },
      ],
    };
    const action = planNextAction(s);
    expect(action.kind).not.toBe("round-transition");
  });
});

describe("Phase 5 Session A — canonical-prose stub", () => {
  it("renders the handoff stub without throwing for hr-partner → hiring-manager", () => {
    const base = mk({ multiRoundEnabled: true });
    const prose = renderCanonicalProse(
      {
        kind: "round-transition",
        from: "hr-partner",
        to: "hiring-manager",
        satisfiesTopic: "round-transition" as unknown as never,
      },
      { ...base, roundPersona: "hiring-manager", roundIndex: 1 },
    );
    expect(typeof prose).toBe("string");
    expect(prose.length).toBeGreaterThan(0);
    expect(prose.toLowerCase()).toContain("hiring manager");
  });

  it("renders the handoff stub for hiring-manager → director", () => {
    const base = mk({ multiRoundEnabled: true });
    const prose = renderCanonicalProse(
      {
        kind: "round-transition",
        from: "hiring-manager",
        to: "director",
        satisfiesTopic: "round-transition" as unknown as never,
      },
      { ...base, roundPersona: "director", roundIndex: 2 },
    );
    expect(typeof prose).toBe("string");
    expect(prose.toLowerCase()).toContain("director");
  });
});
