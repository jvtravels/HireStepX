/* B3 (2026-07-23) — Premature walk-away guard for condition (4).
 *
 * Condition (4) fires when: at ceiling AND turn >= 8.
 * Guard added: candidate must have had >= 2 response turns AFTER the first
 * offer was placed (firstOfferAtTurn). Without the guard, a recruiter who
 * opens at the ceiling and burns 7 turns on discovery would trigger
 * walk-away before the candidate has had a real chance to respond.
 */
import { describe, it, expect } from "vitest";
import { recommendWalkAway } from "../../server-handlers/_recruiter-critique";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

/* Use a proper band with enough spread so initState doesn't adjust maxStretch.
 * RC-1 enforces a minimum spread; initialOffer: 25 / maxStretch: 30 is fine.
 * Tests set highestOfferMade = 30 (= maxStretch) to exercise condition (4). */
const BAND: NegotiationBand = {
  initialOffer: 25,
  maxStretch: 30,
  walkAway: 20,
  hasEquity: false,
};

function makeState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    ...initState({ sessionId: "s", role: "swe", company: "Acme", band: BAND }),
    phase: "counter-offer",
    turnIndex: 10,
    band: BAND,           // re-pin band so RC-1 adjustments from initState don't shift maxStretch
    highestOfferMade: 30, // at ceiling (= maxStretch)
    candidateTarget: 30,  // not above 1.2× ceiling — only condition (4) relevant
    firstOfferAtTurn: null,
    ...overrides,
  };
}

describe("B3 — premature walk-away guard (condition 4)", () => {
  it("does NOT walk when candidate only had 1 turn after first offer (turn gap = 1)", () => {
    /* Recruiter placed first offer at turn 9, now at turn 10 — only 1 candidate
     * turn has elapsed. Walk-away should be suppressed. */
    const res = recommendWalkAway(
      makeState({ turnIndex: 10, firstOfferAtTurn: 9 })
    );
    expect(res.walk).toBe(false);
  });

  it("does NOT walk when candidate has had 0 turns after first offer (same turn)", () => {
    /* Offer placed this very turn — candidate hasn't responded at all. */
    const res = recommendWalkAway(
      makeState({ turnIndex: 10, firstOfferAtTurn: 10 })
    );
    expect(res.walk).toBe(false);
  });

  it("DOES walk when firstOfferAtTurn is null (legacy/untracked — guard skipped, defers to turn >= 8)", () => {
    /* Legacy persisted states may have highestOfferMade > 0 but firstOfferAtTurn null.
     * The guard must not regress old behaviour: when firstOfferAtTurn is null,
     * the candidateTurnsSinceFirstOffer guard is skipped entirely and the plain
     * turn-count gate (turn >= 8) applies as before. */
    const res = recommendWalkAway(
      makeState({ turnIndex: 10, firstOfferAtTurn: null, highestOfferMade: 30 })
    );
    expect(res.walk).toBe(true);
  });

  it("DOES walk when candidate has had >= 2 turns since first offer and turn >= 8", () => {
    /* Offer placed at turn 7, now at turn 10 — 3 candidate turns have elapsed.
     * Full condition (4) should fire. */
    const res = recommendWalkAway(
      makeState({ turnIndex: 10, firstOfferAtTurn: 7 })
    );
    expect(res.walk).toBe(true);
  });

  it("DOES walk at exactly 2 turns since first offer", () => {
    /* Boundary: offer placed at turn 8, now at turn 10 → gap = 2.
     * Should be exactly sufficient to trigger walk. */
    const res = recommendWalkAway(
      makeState({ turnIndex: 10, firstOfferAtTurn: 8 })
    );
    expect(res.walk).toBe(true);
  });

  it("does NOT walk when turn < 8 even if candidate had 2 turns since offer", () => {
    /* Condition (4) requires turn >= 8 regardless of candidateTurnsSinceFirstOffer. */
    const res = recommendWalkAway(
      makeState({ turnIndex: 7, firstOfferAtTurn: 4 })
    );
    expect(res.walk).toBe(false);
  });

  it("reason string mentions ceiling and turn count when walk fires", () => {
    const res = recommendWalkAway(
      makeState({ turnIndex: 10, firstOfferAtTurn: 7 })
    );
    expect(res.walk).toBe(true);
    expect(res.reason).toMatch(/ceiling/i);
    expect(res.reason).toMatch(/10 turns/);
  });
});
