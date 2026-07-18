/* S16-B3 ≡ S12-B4 (2026-07-18) — max-stretch / close-ceiling restyle guard.
 *
 * The kernel's escalatingCloseOut canonical is already gated on
 * highestOfferMade>0 (canonicalEscalationAnchor.test.ts), so the KERNEL can
 * never emit "I've stretched as far as I can" pre-offer. This locks the
 * companion restyle-side guard: on a non-terminal, non-closing turn whose
 * canonical carries no ceiling phrase, a restyle that injects max-stretch
 * language falls back to canonical. A genuine close-phase turn whose
 * canonical DOES carry it passes unchanged. */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
  type NegotiationPhase,
} from "../../server-handlers/_negotiation-kernel";
import { validateRestyle } from "../../server-handlers/_response-pipeline";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 16,
  hasEquity: false,
};

const mkState = (phase: NegotiationPhase = "opening"): NegotiationState => {
  const s = initState({ sessionId: "max-stretch-guard", role: "swe", company: "acme", band: BAND });
  s.phase = phase;
  return s;
};

describe("validateRestyle — max-stretch outside close phase (S16-B3 / S12-B4)", () => {
  it("rejects a restyle that injects 'stretched as far as I can' onto a non-terminal probe", () => {
    /* Pre-anchor discovery — canonical is a plain probe, no ceiling talk. */
    const canonical = "What fitment were you anchoring on for this role?";
    const bad = "I've stretched as far as I can — what fitment were you anchoring on?";
    const r = validateRestyle(canonical, bad, mkState("probe-expectations"));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("new-max-stretch-outside-close-phase");
  });

  it("rejects 'best I can do' / 'final number' injected mid-counter", () => {
    const canonical = "On the fixed, ₹24L is where the base sits for this grade.";
    const bad = "On the fixed, ₹24L is the best I can do — that's my final number.";
    const r = validateRestyle(canonical, bad, mkState("counter-offer"));
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("new-max-stretch-outside-close-phase");
  });

  it("passes a genuine close-out whose canonical DOES carry the ceiling phrase", () => {
    /* Mirrors escalatingCloseOut POOL wording — canonical carries it, so
     * the faithful restyle is allowed regardless of phase. */
    const canonical =
      "I've stretched as far as the band allows on this one. If ₹28L works for you, I'll get the paperwork moving.";
    const restyle =
      "I've stretched as far as the band allows here. If ₹28L works, I'll get the paperwork moving.";
    const r = validateRestyle(canonical, restyle, mkState("closing-push"));
    expect(r.valid).toBe(true);
  });

  it("allows ceiling language in the closing-push register even if the restyle rephrases it", () => {
    const canonical = "₹28L is the number I can commit to today — shall I roll out the offer letter?";
    const restyle = "₹28L is my final number for this grade — shall I start the offer letter?";
    const r = validateRestyle(canonical, restyle, mkState("closing-push"));
    expect(r.valid).toBe(true);
  });

  it("leaves a ceiling-free restyle of a ceiling-free canonical untouched", () => {
    const canonical = "What fitment were you anchoring on for this role?";
    const ok = "What number were you targeting for this role?";
    const r = validateRestyle(canonical, ok, mkState("probe-expectations"));
    expect(r.valid).toBe(true);
  });
});
