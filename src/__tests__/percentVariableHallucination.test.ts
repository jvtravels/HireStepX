/* S14-B3 (2026-07-18) — "50% variable" percentage hallucination.
 *
 * This class is ALREADY structurally guarded: validateRestyle's
 * PERCENT_TOKEN_RE subset check (_response-pipeline.ts, added 2026-06-30 for
 * the "54% variable" class) rejects any `%` token in the restyle that the
 * this-turn canonical does not carry, falling back to canonical. This test
 * locks that guard against the exact S14-B3 scenario: a number-free
 * variable-comfort canonical, and an LLM restyle that fabricates "50%
 * variable". No production change — pure regression lock. */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { validateRestyle } from "../../server-handlers/_response-pipeline";

const BAND: NegotiationBand = {
  initialOffer: 26,
  maxStretch: 34,
  walkAway: 20,
  hasEquity: false,
};

const mkState = (): NegotiationState =>
  initState({ sessionId: "percent-variable-guard", role: "swe", company: "acme", band: BAND });

describe("validateRestyle — '50% variable' percent hallucination (S14-B3)", () => {
  it("rejects a fabricated '50% variable' the canonical never carried", () => {
    const canonical =
      "Your variable component is on the higher side — comfortable with that continuing?";
    const bad = "A 50% variable is on the higher side — comfortable with that continuing?";
    const r = validateRestyle(canonical, bad, mkState());
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("new-percent-in-restyle:50%");
  });

  it("still passes a number-free restyle of the same number-free canonical", () => {
    const canonical =
      "Your variable component is on the higher side — comfortable with that continuing?";
    const ok = "The variable piece sits on the higher side — are you comfortable with that?";
    const r = validateRestyle(canonical, ok, mkState());
    expect(r.valid).toBe(true);
  });
});
