/* Bad-faith tactic injection tests (2026-05-29).
 *
 * Covers the three new low-priority NextAction kinds the planner can
 * inject as flavour manipulation plays:
 *   - exploding-offer-pressure
 *   - fake-competing-candidate
 *   - vague-promise
 *
 * Per tactic, we verify: (a) it fires under the right conditions, (b)
 * it does not re-fire once stamped, (c) it does not fire when the gate
 * is not met. The injector is exported as `maybePlanTacticInject` and
 * tested directly so the suite doesn't depend on the upstream cascade
 * order (which the planner re-tunes regularly).
 */
import { describe, it, expect } from "vitest";
import {
  applyAiMove,
  initState,
  applyCandidateAnswer,
  type AiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import {
  maybePlanTacticInject,
  detectUserCaughtTactic,
} from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: true,
};

const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "tactic-test", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

describe("maybePlanTacticInject — exploding-offer-pressure", () => {
  it("fires at turn 6+ with no acceptance and counter-offer phase", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 6,
      highestOfferMade: 22,
      candidateTarget: 25,
    });
    const a = maybePlanTacticInject(s);
    expect(a).not.toBeNull();
    expect(a!.kind).toBe("exploding-offer-pressure");
  });

  it("does NOT fire before turn 6", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 5,
      highestOfferMade: 22,
      candidateTarget: 25,
    });
    const a = maybePlanTacticInject(s);
    /* may fire vague-promise on a hit slot — but not exploding. */
    expect(a?.kind).not.toBe("exploding-offer-pressure");
  });

  it("does NOT fire when phase=accepted", () => {
    const s = init({
      phase: "accepted",
      turnIndex: 8,
      highestOfferMade: 22,
      acceptedAtTurn: 5,
    });
    const a = maybePlanTacticInject(s);
    expect(a).toBeNull();
  });

  it("does NOT fire twice once tacticsUsed is stamped", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 7,
      highestOfferMade: 22,
      candidateTarget: 25,
      tacticsUsed: ["exploding-offer-pressure"],
    });
    const a = maybePlanTacticInject(s);
    expect(a?.kind).not.toBe("exploding-offer-pressure");
  });
});

describe("maybePlanTacticInject — fake-competing-candidate", () => {
  it("fires at turn 4+ when candidate is over-band on ask", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 4,
      highestOfferMade: 22,
      candidateTarget: 32, // > maxStretch=28
    });
    const a = maybePlanTacticInject(s);
    expect(a).not.toBeNull();
    expect(a!.kind).toBe("fake-competing-candidate");
  });

  it("does NOT fire when candidate target is within band", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 5,
      highestOfferMade: 22,
      candidateTarget: 26, // <= maxStretch=28
    });
    const a = maybePlanTacticInject(s);
    expect(a?.kind).not.toBe("fake-competing-candidate");
  });

  it("does NOT fire before turn 4", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 3,
      highestOfferMade: 22,
      candidateTarget: 32,
    });
    const a = maybePlanTacticInject(s);
    expect(a?.kind).not.toBe("fake-competing-candidate");
  });

  it("does NOT fire twice once tacticsUsed is stamped", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 5,
      highestOfferMade: 22,
      candidateTarget: 32,
      tacticsUsed: ["fake-competing-candidate"],
    });
    const a = maybePlanTacticInject(s);
    expect(a?.kind).not.toBe("fake-competing-candidate");
  });
});

describe("maybePlanTacticInject — vague-promise", () => {
  /* The vague-promise tactic uses a session-jittered slot test —
   * fires on a deterministic subset of (sessionId, turnIndex) pairs.
   * We search a window of turns until we find one that fires, then
   * verify the rest of the semantics on that turn. */
  function findVaguePromiseTurn(baseState: NegotiationState): NegotiationState | null {
    // Iterate session ids + turn indices to find a slot hit. The
    // slot hash mod 5 is deterministic per (sessionId, turn), so
    // enumerating a small grid guarantees a hit somewhere.
    for (let i = 0; i < 30; i++) {
      const sid = `vague-test-${i}`;
      for (let t = 2; t <= 12; t++) {
        const s = { ...baseState, sessionId: sid, turnIndex: t };
        const a = maybePlanTacticInject(s);
        if (a?.kind === "vague-promise") return s;
      }
    }
    return null;
  }

  it("fires on at least one mid-stage turn under the slot gate", () => {
    /* Use a state where exploding/competing-candidate gates DO NOT
     * fire so vague-promise is the only candidate (target in-band,
     * not late session). */
    const s = init({
      phase: "counter-offer",
      turnIndex: 2,
      highestOfferMade: 22,
      candidateTarget: 24,
    });
    const hit = findVaguePromiseTurn(s);
    expect(hit).not.toBeNull();
    const a = maybePlanTacticInject(hit!);
    expect(a?.kind).toBe("vague-promise");
  });

  it("does NOT fire when turn < 2", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 1,
      highestOfferMade: 22,
      candidateTarget: 24,
    });
    const a = maybePlanTacticInject(s);
    expect(a?.kind).not.toBe("vague-promise");
  });

  it("does NOT fire twice once tacticsUsed is stamped", () => {
    const base = init({
      phase: "counter-offer",
      highestOfferMade: 22,
      candidateTarget: 24,
    });
    const hit = findVaguePromiseTurn(base);
    expect(hit).not.toBeNull();
    const stamped = { ...hit!, tacticsUsed: ["vague-promise"] };
    const a = maybePlanTacticInject(stamped);
    expect(a?.kind).not.toBe("vague-promise");
  });
});

describe("applyAiMove — tactic ledger stamping", () => {
  it("stamps tacticsUsed when a tactic action ships", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 6,
      highestOfferMade: 22,
      candidateTarget: 25,
    });
    const move: AiMove = {
      lever: "hold-firm",
      newTotalLpa: 22,
      actionKind: "exploding-offer-pressure",
      rationale: "test stamp",
    };
    const next = applyAiMove(s, move, "Quick one — we'll need confirmation by EOD today.");
    expect(next.tacticsUsed).toContain("exploding-offer-pressure");
  });
});

describe("detectUserCaughtTactic — user-side detection", () => {
  it("catches deadline pressure by name", () => {
    const caught = detectUserCaughtTactic(
      "That feels like artificial deadline pressure — why the rush?",
      ["exploding-offer-pressure"],
    );
    expect(caught).toBe("exploding-offer-pressure");
  });

  it("catches fake competing candidate framing", () => {
    const caught = detectUserCaughtTactic(
      "Sure, but the 'another candidate ready to sign' line is just pressure.",
      ["fake-competing-candidate"],
    );
    expect(caught).toBe("fake-competing-candidate");
  });

  it("catches the non-binding promise framing", () => {
    const caught = detectUserCaughtTactic(
      "If that's a real concession, can we put it in writing in the offer letter?",
      ["vague-promise"],
    );
    expect(caught).toBe("vague-promise");
  });

  it("returns null when the user did not name the tactic", () => {
    const caught = detectUserCaughtTactic(
      "Ok let me think about it.",
      ["exploding-offer-pressure"],
    );
    expect(caught).toBeNull();
  });

  it("returns null when the recruiter never used the tactic", () => {
    /* Even if user says 'deadline', if the recruiter hasn't used the
     * tactic this session, we don't credit it. */
    const caught = detectUserCaughtTactic(
      "Why the rush, do we have a deadline?",
      [],
    );
    expect(caught).toBeNull();
  });
});

describe("applyCandidateAnswer — userCaughtTactics ledger", () => {
  it("pushes the caught tactic onto state.userCaughtTactics", () => {
    const s = init({
      phase: "counter-offer",
      turnIndex: 6,
      highestOfferMade: 22,
      candidateTarget: 25,
      tacticsUsed: ["exploding-offer-pressure"],
    });
    const next = applyCandidateAnswer(
      s,
      "That sounds like artificial deadline pressure to me.",
    );
    expect(next.userCaughtTactics).toContain("exploding-offer-pressure");
  });
});
