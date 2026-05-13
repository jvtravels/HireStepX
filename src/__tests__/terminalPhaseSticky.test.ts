/* Sticky terminal-phase regression tests (session 13, 2026-05-14).
 * ─────────────────────────────────────────────────────────────────────
 * Bug evidence: after the kernel reached phase=accepted on turn 1, the
 * candidate kept talking ("Are the variable components", "Let's get
 * started", "I have already accepted your offer"). The original
 * pickAiMove routed every one of those re-entries through the
 * close-acceptance branch, so the UI re-played the congratulatory wrap
 * over and over and the engine never transitioned to "View Result".
 *
 * These tests pin the fix: when pickAiMove is invoked with a state that
 * was ALREADY terminal at a prior turn (acceptedAtTurn < turnIndex), it
 * returns the new `terminal-restate` lever instead of close-acceptance.
 * The first transition turn (acceptedAtTurn === turnIndex) still routes
 * through close-acceptance so the full recap fires once.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  pickAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s1", role: "swe", company: "acme", band: BAND }),
  highestOfferMade: 25,
  ...overrides,
});

describe("terminal phase stickiness", () => {
  it("first acceptance transition still routes through close-acceptance", () => {
    /* acceptedAtTurn === turnIndex — the candidate just said yes THIS turn,
       so the full recap (JB included if any) must fire. */
    const state = baseState({
      phase: "accepted",
      turnIndex: 3,
      acceptedAtTurn: 3,
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("close-acceptance");
  });

  it("subsequent talk from accepted state returns terminal-restate", () => {
    /* applyCandidateAnswer is a no-op in terminal phases (turnIndex does
       NOT advance from candidate side), but applyAiMove DOES advance
       turnIndex after the original close. So on the very next picker call
       acceptedAtTurn < turnIndex. */
    const state = baseState({
      phase: "accepted",
      turnIndex: 4,
      acceptedAtTurn: 3,
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("terminal-restate");
    expect(move.newTotalLpa).toBe(state.highestOfferMade);
  });

  it("subsequent talk from walked-away state returns terminal-restate", () => {
    const state = baseState({
      phase: "walked-away",
      turnIndex: 5,
      walkedAwayAtTurn: 4,
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("terminal-restate");
  });

  it("stalemate first entry routes through close-stalemate; subsequent calls restate", () => {
    /* First entry: no close-stalemate in leversUsed yet → fresh close. */
    const first = baseState({
      phase: "stalemate",
      turnIndex: 8,
      leversUsed: [],
    });
    expect(pickAiMove(first).lever).toBe("close-stalemate");

    /* After close-stalemate has fired once, every re-entry is a restate. */
    const subsequent = baseState({
      phase: "stalemate",
      turnIndex: 9,
      leversUsed: ["close-stalemate"],
    });
    expect(pickAiMove(subsequent).lever).toBe("terminal-restate");
  });

  it("multiple sequential calls from terminal state keep returning terminal-restate", () => {
    let state = baseState({
      phase: "accepted",
      turnIndex: 4,
      acceptedAtTurn: 3,
    });
    for (let i = 0; i < 3; i++) {
      const move = pickAiMove(state);
      expect(move.lever).toBe("terminal-restate");
      /* simulate applyAiMove advancing turnIndex without escaping terminal */
      state = { ...state, turnIndex: state.turnIndex + 1 };
    }
  });

  it("terminal-restate newTotalLpa equals highestOfferMade (close-floor invariant)", () => {
    const state = baseState({
      phase: "accepted",
      turnIndex: 4,
      acceptedAtTurn: 3,
      highestOfferMade: 26.5,
    });
    const move = pickAiMove(state);
    expect(move.newTotalLpa).toBe(26.5);
  });

  it("terminal-restate carries lastJoiningBonusOffered when present", () => {
    const state = baseState({
      phase: "accepted",
      turnIndex: 4,
      acceptedAtTurn: 3,
      lastJoiningBonusOffered: 3,
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("terminal-restate");
    expect(move.joiningBonusAmount).toBe(3);
  });
});
