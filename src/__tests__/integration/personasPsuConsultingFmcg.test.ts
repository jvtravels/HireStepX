/* Realism-Audit Fix 1 (2026-05-22) — three new sector personas.
 *
 * Asserts:
 *   - tierBucket dispatch picks `psu` / `fmcg-management` for psu / fmcg
 *     (previously fell through to "default").
 *   - getRecruiterSectorPersona returns the new config shape with the
 *     right pushbackStyle.
 *   - canonical-prose surfaces (anchor-with-offer / counter-offer /
 *     band-disclosure-deflect) carry the persona's sector-true register.
 */
import { describe, it, expect } from "vitest";
import {
  selectRecruiterSectorPersona,
  getRecruiterSectorPersona,
  hikeCapByCtc,
  type RecruiterSectorPersona,
} from "../../../server-handlers/_indian-recruiter-personas";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 28,
  walkAway: 16,
  hasEquity: false,
};

function stateFor(p: RecruiterSectorPersona): NegotiationState {
  const base = initState({ sessionId: "s-rfa1", role: "swe", company: "acme", band: BAND });
  return { ...base, recruiterSectorPersona: p };
}

describe("Realism-Audit Fix 1 — tierBucket dispatch", () => {
  it("psu tier → psu persona", () => {
    expect(selectRecruiterSectorPersona({ tierBucket: "psu" })).toBe("psu");
  });
  it("fmcg tier → fmcg-management persona", () => {
    expect(selectRecruiterSectorPersona({ tierBucket: "fmcg" })).toBe("fmcg-management");
  });
});

describe("Realism-Audit Fix 1 — persona config shape", () => {
  it("psu: cadre-pay-rigid pushback, no ESOP, low bandSpread, high stallProbability", () => {
    const p = getRecruiterSectorPersona("psu");
    expect(p.id).toBe("psu");
    expect(p.pushbackStyle).toBe("cadre-pay-rigid");
    expect(p.prefersEsop).toBe(false);
    expect(p.bandSpread).toBeLessThanOrEqual(0.10);
    expect(p.stallProbability).toBeGreaterThanOrEqual(0.5);
  });
  it("consulting-big4: internal-equity-cap pushback, high stallProbability", () => {
    const p = getRecruiterSectorPersona("consulting-big4");
    expect(p.id).toBe("consulting-big4");
    expect(p.pushbackStyle).toBe("internal-equity-cap");
    expect(p.stallProbability).toBeGreaterThanOrEqual(0.5);
  });
  it("fmcg-management: ldp-trajectory pushback, no ESOP", () => {
    const p = getRecruiterSectorPersona("fmcg-management");
    expect(p.id).toBe("fmcg-management");
    expect(p.pushbackStyle).toBe("ldp-trajectory");
    expect(p.prefersEsop).toBe(false);
  });
});

describe("Realism-Audit Fix 1 — canonical-prose carries sector register", () => {
  const counter: NextAction = { kind: "counter-offer", counterTotalLpa: 24 } as NextAction;
  const deflect: NextAction = { kind: "band-disclosure-deflect" } as NextAction;
  const anchor: NextAction = {
    kind: "anchor-with-offer",
    initialOffer: 20,
    bandIncomplete: false,
  } as NextAction;

  it("psu — government-norms / pay-scale register", () => {
    const s = stateFor("psu");
    expect(renderCanonicalProse(deflect, s)).toMatch(/government norms|pay-scale|pay scale|rule book/i);
    expect(renderCanonicalProse(anchor, s)).toMatch(/pay-scale|HRA|government norms/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/government norms/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/₹24L/);
  });

  it("consulting-big4 — fitment-to-level / internal-equity register", () => {
    const s = stateFor("consulting-big4");
    expect(renderCanonicalProse(deflect, s)).toMatch(/internal equity|fitment to the level|people-team/i);
    expect(renderCanonicalProse(anchor, s)).toMatch(/fitment to the level|internal equity/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/internal equity|fitment to the level/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/₹24L/);
  });

  it("fmcg-management — LDP / trajectory register", () => {
    const s = stateFor("fmcg-management");
    expect(renderCanonicalProse(deflect, s)).toMatch(/leadership-development|trajectory|cohort/i);
    expect(renderCanonicalProse(anchor, s)).toMatch(/leadership-development|cohort|trajectory/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/leadership-development|cohort|trajectory/i);
    expect(renderCanonicalProse(counter, s)).toMatch(/₹24L/);
  });
});

describe("Realism-Audit Fix 4 — hikeCapByCtc tiered scaling", () => {
  it("low CTC (≤₹8L): generous cap on IT-services", () => {
    const p = getRecruiterSectorPersona("it-services");
    expect(hikeCapByCtc(p, 6)).toBeGreaterThanOrEqual(0.5);
  });
  it("high CTC (>₹50L): tight cap on IT-services", () => {
    const p = getRecruiterSectorPersona("it-services");
    expect(hikeCapByCtc(p, 60)).toBeLessThanOrEqual(0.2);
  });
  it("PSU stays rigid across tiers — never above ~12%", () => {
    const p = getRecruiterSectorPersona("psu");
    expect(hikeCapByCtc(p, 5)).toBeLessThanOrEqual(0.15);
    expect(hikeCapByCtc(p, 15)).toBeLessThanOrEqual(0.15);
    expect(hikeCapByCtc(p, 30)).toBeLessThanOrEqual(0.15);
    expect(hikeCapByCtc(p, 80)).toBeLessThanOrEqual(0.15);
  });
  it("unknown currentCtc → falls back to scalar hikeCap", () => {
    const p = getRecruiterSectorPersona("indian-unicorn");
    expect(hikeCapByCtc(p, null)).toBe(p.hikeCap);
    expect(hikeCapByCtc(p, undefined)).toBe(p.hikeCap);
    expect(hikeCapByCtc(p, 0)).toBe(p.hikeCap);
  });
});
