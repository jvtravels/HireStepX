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
    /* FIX (commit 3, 2026-05-15) — counter-offer ceiling math moved from
     * _kernel-move-picker.ts to _next-action-planner.ts. Source-of-truth
     * for the F7 invariant comment follows the code. */
    const src = readFileSync(
      join(__dirname, "..", "..", "server-handlers", "_next-action-planner.ts"),
      "utf-8",
    );
    expect(src).toMatch(/F7 \(2026-05-15\) — clamp hike-cap to band\.maxStretch \* 1\.10/);
    expect(src).toMatch(/Company hike cap may exceed band\.maxStretch by up to 10%/);
  });
});

/* #66 (2026-06-18, live-staging) — hike cap below the standing offer must
 * NOT collapse in-band headroom.
 *
 * Live symptom: band {39.2, 56} (a Flipkart SWE band the salary-lookup
 * pipeline produced), candidate disclosed currentCtc 24 and a fixed-scoped
 * target of 48 LPA. The standing offer of 39.2 is a 63% hike over 24 — it
 * already breaches Flipkart's 50% hike cap (24 × 1.50 = 36). The old
 * `Math.max(capped, floor)` then pinned the counter ceiling DOWN to the
 * floor (39.2), so aspiration = min(48, 39.2) = 39.2 ≤ floor and EVERY
 * in-band cash target read as "no-headroom". The planner rotated non-cash
 * levers (equity-grant, joining-bonus, notice-buyout…) forever and never
 * raised the cash anchor — a real-life negotiation never reaching a cash
 * counteroffer.
 *
 * Structural fix: the hike cap may only narrow the ceiling when it lands
 * at or above the standing offer floor. When the band already extended an
 * offer above the hike-implied cap (a deliberate band decision), the cap
 * is moot and band.maxStretch governs — so in-band cash targets get a real
 * counter-base concession.
 */
describe("#66 — hike cap below standing offer doesn't collapse cash headroom", () => {
  const WIDE_BAND: NegotiationBand = {
    initialOffer: 39.2,
    maxStretch: 56,
    walkAway: 26.6,
    hasEquity: true,
  };

  function wideState(overrides: Partial<NegotiationState> = {}): NegotiationState {
    return {
      ...initState({ sessionId: "s66", role: "swe", company: "Flipkart", band: WIDE_BAND }),
      phase: "counter-offer",
      turnIndex: 4,
      highestOfferMade: 39.2,
      candidateCurrentCtc: 24, // 50% hike cap → 36, BELOW the 39.2 standing offer
      candidateTargetFixed: 48, // fixed-scoped in-band target (≤ maxStretch 56)
      ...overrides,
    };
  }

  it("raises the cash anchor (counter-base) instead of pinning ceiling to the floor", () => {
    const move = pickAiMove(wideState());
    expect(move.lever).toBe("counter-base");
    // The cash anchor must move ABOVE the standing offer toward the target.
    expect(nt(move)).toBeGreaterThan(39.2);
    // Still bounded by the band (maxStretch × 1.10 F7 clamp).
    expect(nt(move)).toBeLessThanOrEqual(56 * 1.1 + 0.01);
  });

  it("a binding hike cap ABOVE the floor still narrows the ceiling (no regression)", () => {
    /* currentCtc 30 → Flipkart 50% cap = 45, which is ABOVE the 39.2 floor
     * and BELOW maxStretch 56, so it must still bind: the counter cannot
     * exceed 45. Locks that the fix only neutralizes the cap when it falls
     * below the offer, never when it legitimately constrains. */
    const move = pickAiMove(wideState({ candidateCurrentCtc: 30, candidateTargetFixed: 54 }));
    expect(move.lever).toBe("counter-base");
    expect(nt(move)).toBeLessThanOrEqual(45 + 0.01);
  });
});
