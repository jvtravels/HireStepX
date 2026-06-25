import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";
import { validateRestyle } from "../../server-handlers/_response-pipeline";

/* Pre-launch audit (2026-06-25) — close-recap sweetener-drop guard.
 *
 * The formal close-recap canonical enumerates the structured deal the
 * candidate is about to confirm. The restyle completeness check historically
 * enforced only four fixed tokens (fixed / variable / notice / bgv). It did
 * NOT require the joining bonus or equity/ESOP — so an LLM restyle could
 * silently smooth those OUT of the recap even when the canonical GRANTED
 * them. The candidate's "yes" then binds a deal missing the very sweetener
 * they closed on — a soft FALSE-CLOSE, the worst failure mode.
 *
 * Structural fix (single source of truth): the required tokens are derived
 * from what the CANONICAL recap actually contains, per-call. If canonical
 * names a joining bonus, the restyle must too; same for equity/ESOP. */

const BAND: NegotiationBand = {
  initialOffer: 32,
  maxStretch: 56,
  walkAway: 26,
  hasEquity: true,
};

const state: NegotiationState = initState({
  sessionId: "recap-sweetener-guard",
  role: "Engineering Manager",
  company: "Flipkart",
  band: BAND,
});

const recapAction: NextAction = {
  kind: "close-recap-formal",
  fixedLpa: 40,
  variableLpa: 6,
  joiningBonusLpa: 3,
} as NextAction;

/* A canonical recap that grants BOTH a joining bonus and equity. */
const CANONICAL_WITH_SWEETENERS =
  "Quick recap before we cut the letter: ₹40L fixed, ₹6L variable, a one-time " +
  "joining bonus of ₹3L, ESOPs vesting over four years, 60-day notice, and " +
  "standard BGV. Does that all line up on your end?";

describe("close-recap rejects a restyle that drops a granted sweetener", () => {
  it("rejects a restyle that drops the joining bonus", () => {
    const restyled =
      "Quick recap: ₹40L fixed, ₹6L variable, ESOPs vesting over four years, " +
      "60-day notice, and standard BGV. Does that line up?";
    const r = validateRestyle(CANONICAL_WITH_SWEETENERS, restyled, state, recapAction);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("close-recap-dropped-joining-bonus");
  });

  it("rejects a restyle that drops the equity/ESOP line", () => {
    const restyled =
      "Quick recap: ₹40L fixed, ₹6L variable, a one-time joining bonus of ₹3L, " +
      "60-day notice, and standard BGV. Does that line up?";
    const r = validateRestyle(CANONICAL_WITH_SWEETENERS, restyled, state, recapAction);
    expect(r.valid).toBe(false);
    expect(r.reason).toBe("close-recap-dropped-equity");
  });

  it("accepts a restyle that preserves every granted term", () => {
    const restyled =
      "So to confirm the full package: ₹40L fixed, ₹6L variable, plus a one-time " +
      "joining bonus of ₹3L and ESOPs vesting over four years. Notice is 60 days " +
      "and BGV is standard. All good?";
    const r = validateRestyle(CANONICAL_WITH_SWEETENERS, restyled, state, recapAction);
    expect(r.valid).toBe(true);
  });

  it("does not require a joining bonus the canonical never granted", () => {
    const canonicalNoJb =
      "Recap: ₹40L fixed, ₹6L variable, 60-day notice, standard BGV. Sound right?";
    const restyled =
      "To confirm: ₹40L fixed and ₹6L variable, 60-day notice, standard BGV. Good?";
    const r = validateRestyle(canonicalNoJb, restyled, state, recapAction);
    expect(r.valid).toBe(true);
  });
});
