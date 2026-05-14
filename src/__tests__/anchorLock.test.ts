/* Fix 7 (2026-05-15) — Anchor recomputation suppression.
 *
 * Real session: bot anchored ₹34L turn 1, ₹24L turn 2, no candidate
 * action between. band.initialOffer was being re-derived. lockAnchor
 * makes the first-disclosed anchor sticky for the session. */
import { describe, it, expect } from "vitest";
import {
  lockAnchor,
  effectiveAnchorLpa,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

function fakeState(initialOffer: number, overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    band: { initialOffer, maxStretch: initialOffer * 1.5, walkAway: initialOffer * 0.7, hasEquity: false },
    ...overrides,
  } as NegotiationState;
}

describe("lockAnchor / effectiveAnchorLpa", () => {
  it("returns band.initialOffer when not yet locked", () => {
    const s = fakeState(34);
    expect(effectiveAnchorLpa(s)).toBe(34);
  });

  it("returns lockedAnchorLpa after lockAnchor()", () => {
    const s = fakeState(34);
    const locked = lockAnchor(s, 34);
    expect(locked.anchorLocked).toBe(true);
    expect(effectiveAnchorLpa(locked)).toBe(34);
  });

  it("is idempotent — subsequent lockAnchor calls do not overwrite", () => {
    const s1 = lockAnchor(fakeState(34), 34);
    const s2 = lockAnchor(s1, 24);
    /* Even though the second call tried to relock at ₹24L, the first
     * lock at ₹34L must remain. */
    expect(effectiveAnchorLpa(s2)).toBe(34);
    expect(s2.lockedAnchorLpa).toBe(34);
  });
});
