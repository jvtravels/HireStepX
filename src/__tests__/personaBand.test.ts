import { describe, it, expect } from "vitest";
import {
  applyPersonaToBand,
  initState,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const BASE: NegotiationBand = { initialOffer: 22, maxStretch: 30, walkAway: 18, hasEquity: false };

describe("applyPersonaToBand — consultative is identity", () => {
  it("returns identical economic bounds", () => {
    const out = applyPersonaToBand(BASE, "consultative");
    expect(out.walkAway).toBe(18);
    expect(out.maxStretch).toBe(30);
    expect(out.hasEquity).toBe(false);
  });
});

describe("applyPersonaToBand — hardline tightens both ends", () => {
  it("walkAway +1, maxStretch -1", () => {
    const out = applyPersonaToBand(BASE, "hardline");
    expect(out.walkAway).toBe(19);
    expect(out.maxStretch).toBe(29);
  });
});

describe("applyPersonaToBand — founder flexes TC but never invents equity", () => {
  /* AUDIT-W02 EQUITY-LEAK-FOUNDER-TCS (2026-06-08) — persona modulation
     must NOT invent comp components. Founder bias is a magnitude/lever
     choice WITHIN the band, never a new component. A base band that
     grants no equity (e.g. TCS, hasEquity=false) stays equity-free; the
     founder persona only widens close-side flex (+0.5L maxStretch). */
  it("does NOT invent equity when base has none, but still flexes maxStretch +0.5", () => {
    const out = applyPersonaToBand({ ...BASE, hasEquity: false }, "founder");
    expect(out.hasEquity).toBe(false);
    expect(out.maxStretch).toBe(30.5);
  });

  it("carries equity through when the base band already grants it", () => {
    const out = applyPersonaToBand({ ...BASE, hasEquity: true }, "founder");
    expect(out.hasEquity).toBe(true);
    expect(out.maxStretch).toBe(30.5);
  });
});

describe("applyPersonaToBand — agency widens close-side only", () => {
  it("maxStretch +0.5, walkAway unchanged", () => {
    const out = applyPersonaToBand(BASE, "agency");
    expect(out.maxStretch).toBe(30.5);
    expect(out.walkAway).toBe(18);
  });
});

describe("applyPersonaToBand — invariants preserved under degenerate inputs", () => {
  it("clamps walkAway below initialOffer if hardline would invert", () => {
    const tight: NegotiationBand = { initialOffer: 20, maxStretch: 22, walkAway: 19.5, hasEquity: false };
    const out = applyPersonaToBand(tight, "hardline");
    expect(out.walkAway).toBeLessThan(out.maxStretch);
    expect(out.walkAway).toBeLessThan(20);
  });

  it("clamps maxStretch above initialOffer if hardline would invert", () => {
    const tight: NegotiationBand = { initialOffer: 20, maxStretch: 20.5, walkAway: 16, hasEquity: false };
    const out = applyPersonaToBand(tight, "hardline");
    expect(out.maxStretch).toBeGreaterThan(20);
  });
});

describe("initState — applies persona band economics at construction", () => {
  it("hardline init produces tightened band", () => {
    const state = initState({
      sessionId: "s1",
      role: "swe",
      company: "Acme",
      band: BASE,
      recruiterPersona: "hardline",
    });
    expect(state.band.walkAway).toBe(19);
    expect(state.band.maxStretch).toBe(29);
  });

  it("consultative init leaves band as-is", () => {
    const state = initState({
      sessionId: "s1",
      role: "swe",
      company: "Acme",
      band: BASE,
    });
    expect(state.band.walkAway).toBe(18);
    expect(state.band.maxStretch).toBe(30);
  });

  it("founder init does NOT invent equity when input band has none (AUDIT-W02 EQUITY-LEAK-FOUNDER-TCS)", () => {
    const state = initState({
      sessionId: "s1",
      role: "swe",
      company: "Acme",
      band: { ...BASE, hasEquity: false },
      recruiterPersona: "founder",
    });
    expect(state.band.hasEquity).toBe(false);
  });

  it("founder init carries equity through when the input band grants it", () => {
    const state = initState({
      sessionId: "s1",
      role: "swe",
      company: "Acme",
      band: { ...BASE, hasEquity: true },
      recruiterPersona: "founder",
    });
    expect(state.band.hasEquity).toBe(true);
  });
});

/* Session 12 (2026-05-14) — P35 invariant: persona modulation must
 * never raise the opener above the band's input initialOffer. The
 * opener is anchored at the 35th percentile of the resolved band at
 * construction time in salary-lookup.ts; persona shifts walkAway /
 * maxStretch but must leave initialOffer ≤ input. */
describe("applyPersonaToBand — P35 opening-offer invariant", () => {
  it("opener is never raised above input initialOffer across all personas", () => {
    for (const persona of ["hardline", "consultative", "founder", "agency"] as const) {
      const out = applyPersonaToBand(BASE, persona);
      expect(out.initialOffer).toBeLessThanOrEqual(BASE.initialOffer);
    }
  });

  it("persona-soft scenario: a hypothetically reduced opener is preserved (clamp does NOT raise)", () => {
    // Synthetic: pretend a downstream layer pre-applied a lower opener.
    // The persona helper must not bump it back up to base.
    const reduced: NegotiationBand = { ...BASE, initialOffer: 19 };
    const out = applyPersonaToBand(reduced, "consultative");
    expect(out.initialOffer).toBe(19);
  });
});
