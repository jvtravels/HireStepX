/* Adaptive session difficulty → kernel band (2026-06-20).
 *
 * `_scenario-seed.ts` computed a per-user `difficulty` (warmup → standard
 * → hardball, escalating with prior-session count) but the kernel never
 * read it, so a returning user's recruiter never actually got harder. The
 * complaint genre — "feels the same every time" — applied to progression.
 *
 * `applyDifficultyToBand` wires it. These tests lock the contract that
 * makes it safe:
 *   - "standard"/undefined is a pure identity transform (so every existing
 *     caller and test, none of which pass difficulty, is unchanged);
 *   - the market anchor `initialOffer` is PINNED across all difficulties
 *     (difficulty changes the recruiter's posture, never market truth);
 *   - warmup gives the candidate more room, hardball less;
 *   - the core invariant walkAway < initialOffer < maxStretch always holds,
 *     even on degenerate tight bands and when stacked on a persona shift;
 *   - deltas are proportional, so they scale across band magnitudes.
 */
import { describe, it, expect } from "vitest";
import {
  applyDifficultyToBand,
  applyPersonaToBand,
  initState,
  type NegotiationBand,
  type SessionDifficulty,
} from "../../server-handlers/_negotiation-kernel";

const BASE: NegotiationBand = { initialOffer: 22, maxStretch: 30, walkAway: 18, hasEquity: false };
const ALL: SessionDifficulty[] = ["warmup", "standard", "hardball"];

describe("applyDifficultyToBand — standard is identity", () => {
  it("returns the same reference (no allocation, byte-identical)", () => {
    const out = applyDifficultyToBand(BASE, "standard");
    expect(out).toBe(BASE);
  });
});

describe("applyDifficultyToBand — warmup gives more room", () => {
  it("widens maxStretch and lowers walkAway", () => {
    const out = applyDifficultyToBand(BASE, "warmup");
    expect(out.maxStretch).toBeGreaterThan(BASE.maxStretch);
    expect(out.walkAway).toBeLessThan(BASE.walkAway);
    expect(out.maxStretch).toBe(31.5); // 30 * 1.05
    expect(out.walkAway).toBe(17.3); // 18 * 0.96, rounded to 0.1
  });
});

describe("applyDifficultyToBand — hardball is tighter", () => {
  it("narrows maxStretch and raises walkAway", () => {
    const out = applyDifficultyToBand(BASE, "hardball");
    expect(out.maxStretch).toBeLessThan(BASE.maxStretch);
    expect(out.walkAway).toBeGreaterThan(BASE.walkAway);
    expect(out.maxStretch).toBe(28.5); // 30 * 0.95
    expect(out.walkAway).toBe(18.7); // 18 * 1.04, rounded to 0.1
  });
});

describe("applyDifficultyToBand — market anchor is pinned", () => {
  it("never moves initialOffer for any difficulty", () => {
    for (const d of ALL) {
      expect(applyDifficultyToBand(BASE, d).initialOffer).toBe(BASE.initialOffer);
    }
  });

  it("never touches hasEquity (an economic component, not a posture)", () => {
    for (const d of ALL) {
      expect(applyDifficultyToBand({ ...BASE, hasEquity: true }, d).hasEquity).toBe(true);
      expect(applyDifficultyToBand({ ...BASE, hasEquity: false }, d).hasEquity).toBe(false);
    }
  });
});

describe("applyDifficultyToBand — invariant walkAway < initialOffer < maxStretch", () => {
  it("holds on the typical band for every difficulty", () => {
    for (const d of ALL) {
      const o = applyDifficultyToBand(BASE, d);
      expect(o.walkAway).toBeLessThan(o.initialOffer);
      expect(o.initialOffer).toBeLessThan(o.maxStretch);
    }
  });

  it("clamps a degenerate tight band so hardball cannot invert walkAway past the anchor", () => {
    const tight: NegotiationBand = { initialOffer: 20, maxStretch: 20.4, walkAway: 19.4, hasEquity: false };
    const o = applyDifficultyToBand(tight, "hardball");
    expect(o.walkAway).toBeLessThan(o.initialOffer);
    expect(o.maxStretch).toBeGreaterThan(o.initialOffer);
    expect(o.walkAway).toBeLessThan(o.maxStretch);
  });
});

describe("applyDifficultyToBand — proportional across magnitudes", () => {
  it("scales sanely from a small IT-services band to a large GCC band", () => {
    const small: NegotiationBand = { initialOffer: 6.6, maxStretch: 7.1, walkAway: 6.1, hasEquity: false };
    const large: NegotiationBand = { initialOffer: 63.1, maxStretch: 81.9, walkAway: 47.5, hasEquity: true };
    for (const band of [small, large]) {
      const hb = applyDifficultyToBand(band, "hardball");
      const wu = applyDifficultyToBand(band, "warmup");
      // Both stay invariant-valid and meaningfully different from each other.
      for (const o of [hb, wu]) {
        expect(o.walkAway).toBeLessThan(o.initialOffer);
        expect(o.initialOffer).toBeLessThan(o.maxStretch);
      }
      expect(wu.maxStretch).toBeGreaterThan(hb.maxStretch);
      expect(wu.walkAway).toBeLessThan(hb.walkAway);
    }
  });
});

describe("initState — difficulty composes with persona, defaults to identity", () => {
  it("undefined difficulty leaves the persona band untouched", () => {
    const withDiff = initState({ sessionId: "s", role: "swe", company: "Acme", band: BASE, recruiterPersona: "hardline" });
    const personaOnly = applyPersonaToBand(BASE, "hardline");
    expect(withDiff.band.walkAway).toBe(personaOnly.walkAway);
    expect(withDiff.band.maxStretch).toBe(personaOnly.maxStretch);
  });

  it("warmup init produces a more generous band than standard", () => {
    const warm = initState({ sessionId: "s", role: "swe", company: "Acme", band: BASE, sessionDifficulty: "warmup" });
    const std = initState({ sessionId: "s", role: "swe", company: "Acme", band: BASE, sessionDifficulty: "standard" });
    expect(warm.band.maxStretch).toBeGreaterThan(std.band.maxStretch);
    expect(warm.band.walkAway).toBeLessThan(std.band.walkAway);
  });

  it("hardline + hardball stack but never break the band invariant", () => {
    const s = initState({
      sessionId: "s",
      role: "swe",
      company: "Acme",
      band: BASE,
      recruiterPersona: "hardline",
      sessionDifficulty: "hardball",
    });
    expect(s.band.walkAway).toBeLessThan(s.band.initialOffer);
    expect(s.band.initialOffer).toBeLessThan(s.band.maxStretch);
  });
});
