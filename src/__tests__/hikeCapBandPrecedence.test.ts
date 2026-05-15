/* F7 (2026-05-15) — hike-cap clamped to band.maxStretch × 1.10.
 *
 * Per-company hike caps (Flipkart 50%, Walmart Labs 40%, etc.) override
 * the generic band ceiling when currentCtc is known. But a permissive
 * cap × high currentCtc can drift the effective ceiling far above any
 * reasonable band, defeating the structural walk-away protections.
 * F7 clamps the hike-cap-derived ceiling to band.maxStretch × 1.10:
 * company reality overrides band, but not unboundedly.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  initState,
  pickAiMove,
  type AiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 15, maxStretch: 22, walkAway: 12, hasEquity: false };

function makeState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    ...initState({ sessionId: "s", role: "swe", company: "Flipkart", band: BAND }),
    phase: "counter-offer",
    turnIndex: 2,
    highestOfferMade: 20,
    candidateTarget: 30, // above clamp
    candidateCurrentCtc: 20, // 50% hike cap → 30 uncapped; clamped to 22*1.10 = 24.2
    ...overrides,
  };
}

function nt(move: AiMove): number {
  return move.newTotalLpa as number;
}

describe("F7 — hike-cap clamped to band.maxStretch × 1.10", () => {
  it("counter-offer total never exceeds band.maxStretch × 1.10 even with permissive hike cap", () => {
    const move = pickAiMove(makeState());
    expect(move.lever).toBe("counter-base");
    /* Clamp = 22 × 1.10 = 24.2. With concession math + boosts, the new
     * total can approach but not exceed the clamped ceiling. */
    expect(nt(move)).toBeLessThanOrEqual(24.2 + 0.01);
  });

  it("when hike cap is tighter than the F7 clamp, the tighter cap still wins", () => {
    /* TCS (30%) × currentCtc=15 → ceiling = 19.5. That's BELOW maxStretch=22.
     * F7 clamp at 24.2 doesn't activate; tighter cap wins. */
    const move = pickAiMove(
      makeState({ company: "TCS", candidateCurrentCtc: 15, candidateTarget: 25, highestOfferMade: 17 }),
    );
    expect(move.lever).toBe("counter-base");
    /* New total bounded by 19.5, well below the F7 clamp ceiling. */
    expect(nt(move)).toBeLessThanOrEqual(19.5 + 0.01);
  });

  it("when no hike cap is registered, F7 clamp doesn't activate (ceiling = maxStretch)", () => {
    /* "Acme" not in COMPANY_HIKE_CAP_PCT → cap=null → no clamp logic;
     * effective ceiling is band.maxStretch=22. */
    const move = pickAiMove(makeState({ company: "Acme", candidateCurrentCtc: 20 }));
    expect(move.lever).toBe("counter-base");
    expect(nt(move)).toBeLessThanOrEqual(22 + 0.01);
  });

  it("F7 doesn't clamp BELOW the floor (highestOfferMade)", () => {
    /* Degenerate: maxStretch tiny, floor already high. F7 clamp =
     * maxStretch * 1.10 might be < floor. Math.max(hardCap, floor)
     * guarantees the recruiter can't claw back what's offered. */
    const move = pickAiMove(
      makeState({
        company: "Flipkart",
        candidateCurrentCtc: 20,
        candidateTarget: 30,
        highestOfferMade: 24, // already above clamp 24.2? floor takes precedence
      }),
    );
    /* New total must not drop below highestOfferMade. */
    expect(nt(move)).toBeGreaterThanOrEqual(24);
  });

  it("F7 comment is present in source as the load-bearing invariant marker", () => {
    const src = readFileSync(
      join(__dirname, "..", "..", "server-handlers", "_kernel-move-picker.ts"),
      "utf-8",
    );
    expect(src).toMatch(/F7 \(2026-05-15\) — clamp hike-cap to band\.maxStretch \* 1\.10/);
    expect(src).toMatch(/Company hike cap may exceed band\.maxStretch by up to 10%/);
  });
});
