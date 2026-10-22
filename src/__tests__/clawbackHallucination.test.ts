/* S14-B4 / S13-B4 (2026-07-18) — clawback hallucination guard.
 *
 * Canonical prose only ever emits "clawback" bound to a granted joining
 * bonus. When the LLM restyle injects "clawback"/"clawback period" onto a
 * turn whose canonical never mentioned it (candidate said "unvested RSUs",
 * not clawback), validateRestyle rejects it → canonical fallback. A restyle
 * with no clawback passes, and a legitimately clawback-bearing canonical
 * (joining-bonus-granted move) is not falsely rejected. */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { validateRestyle } from "../../server-handlers/_response-pipeline";

const BAND: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 34,
  walkAway: 18,
  hasEquity: true,
};

const mkState = (): NegotiationState =>
  initState({ sessionId: "clawback-guard", role: "swe", company: "acme", band: BAND });

describe("validateRestyle — clawback hallucination (S14-B4 / S13-B4)", () => {
  it("rejects a restyle that invents a clawback period the canonical never carried", () => {
    /* Candidate asked about unvested RSUs; canonical answers on vesting,
     * no clawback anywhere. LLM fabricated "there's a clawback period". */
    const canonical =
      "On the RSUs — anything unvested when you leave simply lapses, there's no cash owed back.";
    const bad =
      "On the RSUs — anything unvested lapses, and note there's a clawback period on that.";
    const r = validateRestyle(canonical, bad, mkState());
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("clawback-hallucination");
  });

  it("passes a clawback-free restyle of a clawback-free canonical", () => {
    const canonical =
      "On the RSUs — anything unvested when you leave simply lapses, there's no cash owed back.";
    const ok =
      "On the RSUs — whatever hasn't vested just lapses when you go, nothing is owed back.";
    const r = validateRestyle(canonical, ok, mkState());
    expect(r.valid).toBe(true);
  });

  it("does NOT falsely reject a canonical that legitimately names a clawback (joining-bonus grant)", () => {
    const canonical =
      "We're in the same range, then — let's lock it at ₹30L. We'll add a one-time joining " +
      "bonus of ₹3L to make it work — that'll be in the offer letter with the standard clawback. " +
      "Let me run this past leadership once and revert with the formal offer letter.";
    const restyle =
      "We're in the same range, then — let's lock it at ₹30L, plus a one-time joining bonus of ₹3L " +
      "in the offer letter with the standard clawback. Let me run this past leadership and revert with the formal offer letter.";
    const r = validateRestyle(canonical, restyle, mkState());
    expect(r.valid).toBe(true);
  });
});
