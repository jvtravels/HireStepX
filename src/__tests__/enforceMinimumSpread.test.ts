/* RC-1 (2026-07-12) — minimum concession-spread floor.
 *
 * The recruiter's cash number "barely moving" was the dominant realism defect
 * in the holistic audit. The band pipeline (salary-lookup P35→P85 math, the
 * resolver's one-way down-clamps, and the hardline/hardball posture transforms)
 * could independently compress (maxStretch − initialOffer) to a fraction of an
 * LPA with no lower bound enforced anywhere. The floor is applied as the
 * OUTERMOST init transform (after persona + difficulty) inside initState, so it
 * is the authoritative final word on the frozen session band: the recruiter
 * always keeps ≥ max(1.5L, 12% of opener) of concession headroom, widening the
 * ceiling UP only so walkAway < initialOffer < maxStretch is never broken.
 *
 * Driven through the public initState chokepoint (not the internal helper) so
 * the test pins the real wiring — persona=consultative and difficulty=standard
 * are both identity on the ceiling, isolating the floor's effect. */
import { describe, it, expect } from "vitest";
import { initState } from "../../server-handlers/_negotiation-kernel";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const frozenBand = (
  initialOffer: number,
  maxStretch: number,
  walkAway: number,
  extra: Partial<NegotiationBand> = {},
): NegotiationBand => ({
  initialOffer,
  maxStretch,
  walkAway,
  hasEquity: false,
  ...extra,
});

const initBand = (band: NegotiationBand): NegotiationBand =>
  initState({
    sessionId: "rc1-min-spread",
    role: "Software Engineer",
    company: "Flipkart",
    band,
  }).band;

describe("minimum concession-spread floor — widens degenerate bands", () => {
  it("widens a near-flat high band to 12% headroom (Flipkart-EM class)", () => {
    // ₹28L opener with only 0.5L room — the exact 'number never moves' shape.
    const out = initBand(frozenBand(28, 28.5, 22));
    // 12% of 28 = 3.36 → ceiling lifts to 31.4.
    expect(out.maxStretch).toBeCloseTo(31.4, 5);
    expect(out.maxStretch - out.initialOffer).toBeGreaterThanOrEqual(3.36);
  });

  it("uses the 1.5L absolute floor for low-market bands (no over-widening)", () => {
    // ₹6L PSU opener: 12% = 0.72L, below the 1.5L floor → floor wins.
    const out = initBand(frozenBand(6, 6.3, 5));
    expect(out.maxStretch).toBeCloseTo(7.5, 5);
    // A flat 3L floor would have produced a 50% band (9.0) — we avoid that.
    expect(out.maxStretch).toBeLessThan(9);
  });

  it("lifts a zero-spread band (maxStretch === initialOffer)", () => {
    const out = initBand(frozenBand(40, 40, 32));
    // 12% of 40 = 4.8 → ceiling lifts to 44.8.
    expect(out.maxStretch).toBeCloseTo(44.8, 5);
  });
});

describe("minimum concession-spread floor — leaves healthy bands untouched", () => {
  it("no-op when spread already exceeds the proportional floor", () => {
    const out = initBand(frozenBand(40, 52, 32)); // 12L spread = 30%.
    expect(out.maxStretch).toBe(52);
  });

  it("no-op at exactly the proportional floor (12% of opener)", () => {
    // 25 opener, 12% = 3.0 → 28 is exactly the floor, must not widen further.
    const out = initBand(frozenBand(25, 28, 20));
    expect(out.maxStretch).toBe(28);
  });

  it("preserves initialOffer, walkAway, and non-cash fields", () => {
    const out = initBand(
      frozenBand(30, 30.4, 24, { hasEquity: true, probationOffer: 27 }),
    );
    expect(out.initialOffer).toBe(30);
    expect(out.walkAway).toBe(24);
    expect(out.hasEquity).toBe(true);
    expect(out.probationOffer).toBe(27);
    // Only the ceiling moves.
    expect(out.maxStretch).toBeGreaterThan(30.4);
  });
});

describe("minimum concession-spread floor — invariant strengthened, never broken", () => {
  it.each([
    [28, 28.5, 22],
    [6, 6.3, 5],
    [40, 40, 32],
    [12, 12.1, 9],
    [55, 55.2, 44],
  ])("walkAway < initialOffer < maxStretch holds for (%d,%d,%d)", (i, m, w) => {
    const out = initBand(frozenBand(i, m, w));
    expect(out.walkAway).toBeLessThan(out.initialOffer);
    expect(out.initialOffer).toBeLessThan(out.maxStretch);
  });
});
