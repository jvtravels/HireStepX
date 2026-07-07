/* Proactive-sweetener feature (2026-05-30) — tests.
 *
 * Real recruiters offer non-cash sweeteners (signing bonus,
 * relocation, equity refresh, joining flexibility, notice-buyout
 * help) UNPROMPTED when they sense the candidate cooling and they're
 * capped on cash. Pre-2026-05-30 the simulator was 100% reactive —
 * the #1 remaining salary-negotiation realism gap.
 *
 * Covers:
 *   - Single-fire (fires once, then never again)
 *   - Phase gate (no fire during opening / probe-expectations)
 *   - Cash-cap gate (no fire when offer is well under maxStretch)
 *   - Affinity-drop cooling signal fires it
 *   - Counter-still-pending cooling signal fires it
 *   - Sector keying produces the right sweetenerKind for 5+ sectors
 *   - Prose contains sector-distinct phrasing (PSU "joining timeline",
 *     unicorn "equity refresh", etc.)
 *   - Default sector falls back to signing-bonus
 *   - State stamps fire flag + kind on apply
 *   - Pre-empts manager-consult-stall when both would be valid
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
  type AffinityLedgerEntry,
} from "../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
  actionToLever,
} from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import type { RecruiterSectorPersona } from "../../server-handlers/_indian-recruiter-personas";

const BAND: NegotiationBand = {
  initialOffer: 28,
  maxStretch: 32,
  walkAway: 25,
  hasEquity: true,
};

/** Build a state that is ALREADY past discovery and the recruiter
 *  is sitting at the cash cap (highestOfferMade ≥ 95% of maxStretch).
 *  Cooling-signal seeding is per-test. */
const cappedState = (
  overrides: Partial<NegotiationState> = {},
): NegotiationState => {
  const s = initState({
    sessionId: overrides.sessionId ?? "ps-1",
    role: "Senior Engineer",
    company: "acme",
    band: BAND,
    recruiterSectorPersona:
      (overrides.recruiterSectorPersona as RecruiterSectorPersona | undefined) ??
      "indian-unicorn",
  });
  return {
    ...s,
    turnIndex: 6,
    phase: "counter-offer",
    highestOfferMade: 32, /* at maxStretch — cash-capped */
    candidateCurrentCtc: 22,
    ...overrides,
  };
};

const withAffinityDrop = (s: NegotiationState): NegotiationState => {
  const ledger: AffinityLedgerEntry[] = [
    { turn: s.turnIndex - 2, delta: -1, reason: "wasted-time" },
    { turn: s.turnIndex - 1, delta: -1, reason: "abrasive-tone" },
  ];
  return { ...s, affinityLedger: ledger };
};

describe("proactive-sweetener — phase gate", () => {
  it("does NOT fire in 'opening'", () => {
    const s = withAffinityDrop(
      cappedState({ sessionId: "ps-phase-opening", phase: "opening" }),
    );
    const action = planNextAction(s);
    expect(action.kind).not.toBe("proactive-sweetener");
  });

  it("does NOT fire in 'probe-expectations'", () => {
    const s = withAffinityDrop(
      cappedState({
        sessionId: "ps-phase-probe",
        phase: "probe-expectations",
      }),
    );
    const action = planNextAction(s);
    expect(action.kind).not.toBe("proactive-sweetener");
  });

  it("DOES fire in 'counter-offer' when capped + cooling", () => {
    const s = withAffinityDrop(cappedState({ sessionId: "ps-phase-co" }));
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
  });
});

describe("proactive-sweetener — cash-cap gate", () => {
  it("does NOT fire when highestOfferMade is well under maxStretch", () => {
    /* 28 / 32 = 87.5% — under the 95% cash-cap threshold. */
    const s = withAffinityDrop(
      cappedState({ sessionId: "ps-cash-under", highestOfferMade: 28 }),
    );
    const action = planNextAction(s);
    expect(action.kind).not.toBe("proactive-sweetener");
  });

  it("does NOT fire when no offer is on the table", () => {
    const s = withAffinityDrop(
      cappedState({ sessionId: "ps-no-offer", highestOfferMade: 0 }),
    );
    const action = planNextAction(s);
    expect(action.kind).not.toBe("proactive-sweetener");
  });

  it("DOES fire at exactly 95% of maxStretch", () => {
    /* 32 * 0.95 = 30.4; bump to 30.5 to clear the boundary. */
    const s = withAffinityDrop(
      cappedState({ sessionId: "ps-cash-95", highestOfferMade: 30.5 }),
    );
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
  });
});

describe("proactive-sweetener — cooling signals", () => {
  it("fires on affinity-drop (last 2 ledger entries net negative)", () => {
    const s = withAffinityDrop(cappedState({ sessionId: "ps-signal-aff" }));
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
  });

  it("fires on counter-still-pending (candidate asking > highestOfferMade)", () => {
    const s = cappedState({
      sessionId: "ps-signal-counter",
      lastCandidateCounterLpa: 38,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
  });

  it("does NOT fire when no cooling signal is present", () => {
    const s = cappedState({ sessionId: "ps-no-signal" });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("proactive-sweetener");
  });
});

/* PRI-65 (2026-07-06, launch-readiness audit) — the (5c) "stale-offer"
 * cooling signal (2+ candidate turns since the offer landed, no close shipped)
 * was DEAD: it read `state.lastOfferTurn` / `state.highestOfferMadeAtTurn`
 * through `as unknown as` casts, and neither property exists on
 * NegotiationState, so both always resolved to undefined and the branch never
 * fired. It now reads the real `firstOfferAtTurn` field. These tests exercise
 * (5c) IN ISOLATION — no affinity ledger (5a) and no pending counter (5b), so
 * the ONLY path to a fire is the stale-offer trigger itself. */
describe("proactive-sweetener — stale-offer cooling signal (5c)", () => {
  it("fires when the offer has sat 2+ turns since it landed (firstOfferAtTurn)", () => {
    const s = cappedState({
      sessionId: "ps-stale-fire",
      turnIndex: 6,
      firstOfferAtTurn: 4, // 6 - 4 = 2 turns elapsed → stale
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
  });

  it("does NOT fire when the offer only just landed (< 2 turns elapsed)", () => {
    const s = cappedState({
      sessionId: "ps-stale-fresh",
      turnIndex: 6,
      firstOfferAtTurn: 5, // 6 - 5 = 1 turn elapsed → not yet stale
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("proactive-sweetener");
  });

  it("does NOT fire when firstOfferAtTurn is absent (no offer-landed marker)", () => {
    // Guards the backward-compat path: undefined firstOfferAtTurn must not
    // arithmetic into a spurious fire (NaN >= 2 is false).
    const s = cappedState({ sessionId: "ps-stale-absent", turnIndex: 6 });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("proactive-sweetener");
  });

  it("does NOT fire once a close-acceptance lever has already shipped", () => {
    const s = cappedState({
      sessionId: "ps-stale-closed",
      turnIndex: 8,
      firstOfferAtTurn: 4, // 4 turns elapsed — would be stale…
      leversUsed: ["close-acceptance"], // …but the close already happened
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("proactive-sweetener");
  });
});

/* PRI-60 × PRI-65 precedence (2026-07-07) — activating the (5c) stale-offer
 * signal let the sweetener win the SAME close turn that PRI-60's scope-reconcile
 * counter owns: when the candidate has conditionally closed on an UNDELIVERABLE
 * fixed number (above the band's cash cap), the recruiter must NAME the overage
 * out loud before pivoting to equity — not silently dangle an equity-refresh
 * sweetener that never reconciles the scope. The guard defers the sweetener when
 * `undeliverableFixedConditionAsk` is pending. These two share one stale-offer
 * fire-state so the ONLY difference is the pending fixed ask. */
describe("proactive-sweetener — scope-reconcile precedence (PRI-60 × PRI-65)", () => {
  /* Band base cap = maxStretch (32); a fixed ask above it is undeliverable. */
  const staleFire = (over: Partial<NegotiationState> = {}): NegotiationState =>
    cappedState({ turnIndex: 6, firstOfferAtTurn: 4, ...over });

  it("positive control: the shared stale-offer state DOES fire the sweetener", () => {
    const action = planNextAction(staleFire({ sessionId: "ps-prec-control" }));
    expect(action.kind).toBe("proactive-sweetener");
  });

  it("defers to the scope-reconcile counter when an undeliverable fixed ask is pending", () => {
    // 40 fixed > base cap 32 → undeliverableFixedConditionAsk is non-null.
    const action = planNextAction(
      staleFire({ sessionId: "ps-prec-guard", candidateTargetFixed: 40 }),
    );
    expect(action.kind).not.toBe("proactive-sweetener");
  });
});

describe("proactive-sweetener — single-fire", () => {
  it("fires at most ONCE across 20 simulated turns", () => {
    let s = withAffinityDrop(cappedState({ sessionId: "ps-once" }));
    let fires = 0;
    for (let i = 0; i < 20; i++) {
      const action = planNextAction(s);
      if (action.kind === "proactive-sweetener") {
        fires++;
        const move = actionToLever(action, s);
        s = applyAiMove(s, move, "sweetener prose");
      }
      s = { ...s, turnIndex: s.turnIndex + 1 };
    }
    expect(fires).toBe(1);
  });
});

describe("proactive-sweetener — state stamps fire flag + kind on apply", () => {
  it("applyAiMove sets proactiveSweetenerFired + proactiveSweetenerKind", () => {
    let s = withAffinityDrop(
      cappedState({
        sessionId: "ps-apply",
        recruiterSectorPersona: "bfsi",
      }),
    );
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
    const move = actionToLever(action, s);
    s = applyAiMove(s, move, "sweetener prose");
    expect(s.proactiveSweetenerFired).toBe(true);
    expect(s.proactiveSweetenerKind).toBe("signing-bonus");
  });
});

describe("proactive-sweetener — sector keying", () => {
  const CASES: Array<{
    sector: RecruiterSectorPersona;
    kind: string;
  }> = [
    { sector: "it-services", kind: "notice-buyout-help" },
    { sector: "gcc", kind: "relocation" },
    { sector: "indian-unicorn", kind: "equity-refresh" },
    { sector: "early-startup", kind: "equity-refresh" },
    { sector: "bfsi", kind: "signing-bonus" },
    { sector: "psu", kind: "joining-flexibility" },
    { sector: "consulting-big4", kind: "relocation" },
    { sector: "consulting-mbb", kind: "signing-bonus" },
    { sector: "fmcg-management", kind: "joining-flexibility" },
    { sector: "edtech", kind: "equity-refresh" },
  ];

  for (const { sector, kind } of CASES) {
    it(`${sector} → ${kind}`, () => {
      const s = withAffinityDrop(
        cappedState({
          sessionId: `ps-sector-${sector}`,
          recruiterSectorPersona: sector,
        }),
      );
      const action = planNextAction(s);
      expect(action.kind).toBe("proactive-sweetener");
      if (action.kind === "proactive-sweetener") {
        expect(action.sweetenerKind).toBe(kind);
      }
    });
  }

  it("default sector falls back to signing-bonus", () => {
    const s = withAffinityDrop(
      cappedState({
        sessionId: "ps-default",
        recruiterSectorPersona: "default",
      }),
    );
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
    if (action.kind === "proactive-sweetener") {
      expect(action.sweetenerKind).toBe("signing-bonus");
    }
  });
});

describe("proactive-sweetener — sector-distinct prose", () => {
  it("unicorn prose contains 'equity refresh'", () => {
    const s = withAffinityDrop(
      cappedState({
        sessionId: "ps-prose-unicorn",
        recruiterSectorPersona: "indian-unicorn",
      }),
    );
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
    const prose = renderCanonicalProse(action, s);
    expect(prose.toLowerCase()).toContain("equity refresh");
  });

  it("psu prose contains 'joining timeline'", () => {
    const s = withAffinityDrop(
      cappedState({
        sessionId: "ps-prose-psu",
        recruiterSectorPersona: "psu",
      }),
    );
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
    const prose = renderCanonicalProse(action, s);
    expect(prose.toLowerCase()).toContain("joining timeline");
  });

  it("gcc prose contains 'relocation'", () => {
    const s = withAffinityDrop(
      cappedState({
        sessionId: "ps-prose-gcc",
        recruiterSectorPersona: "gcc",
      }),
    );
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
    const prose = renderCanonicalProse(action, s);
    expect(prose.toLowerCase()).toContain("relocation");
  });

  it("it-services prose contains 'notice buyout'", () => {
    const s = withAffinityDrop(
      cappedState({
        sessionId: "ps-prose-it",
        recruiterSectorPersona: "it-services",
      }),
    );
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
    const prose = renderCanonicalProse(action, s);
    expect(prose.toLowerCase()).toContain("notice buyout");
  });

  it("early-startup prose contains 'ESOP'", () => {
    const s = withAffinityDrop(
      cappedState({
        sessionId: "ps-prose-startup",
        recruiterSectorPersona: "early-startup",
      }),
    );
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
    const prose = renderCanonicalProse(action, s);
    expect(prose).toContain("ESOP");
  });

  it("prose always ends with a closing question", () => {
    const s = withAffinityDrop(
      cappedState({
        sessionId: "ps-prose-q",
        recruiterSectorPersona: "bfsi",
      }),
    );
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
    const prose = renderCanonicalProse(action, s);
    expect(prose.trim().endsWith("?")).toBe(true);
  });
});

describe("proactive-sweetener — pre-empts manager-consult-stall", () => {
  it("when both gates would pass, sweetener fires (manager-consult-stall does not)", () => {
    /* PSU is a dominant-stall sector. Cash cap + cooling + above-
     * maxStretch counter would normally trigger manager-consult-stall.
     * The sweetener slot pre-empts it for ONE turn. */
    const s = cappedState({
      sessionId: "ps-preempt",
      recruiterSectorPersona: "psu",
      lastCandidateCounterLpa: 38, /* above maxStretch 32 → stall gate also passes */
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("proactive-sweetener");
    expect(action.kind).not.toBe("manager-consult-stall");
  });
});

describe("proactive-sweetener — byte-equivalence baseline", () => {
  it("does NOT fire when sessionId is empty (snapshot path stays intact)", () => {
    const s = withAffinityDrop(
      cappedState({ sessionId: "" }),
    );
    const action = planNextAction(s);
    expect(action.kind).not.toBe("proactive-sweetener");
  });
});
