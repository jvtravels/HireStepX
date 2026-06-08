/* EQUITY-LEAK-FOUNDER-TCS — founder persona must not invent equity on
 * cash-only bands (TCS / Infosys class). Fails on main: state.band.hasEquity
 * becomes true even though base.hasEquity=false.
 */
import { describe, it, expect } from "vitest";
import { initState } from "../../server-handlers/_negotiation-kernel";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const TCS_BAND: NegotiationBand = {
  initialOffer: 20,
  maxStretch: 24,
  walkAway: 16,
  hasEquity: false,
};

describe("applyPersonaToBand — founder on non-equity band", () => {
  it("founder persona must not force hasEquity=true on a TCS-style band", () => {
    const state = initState({
      sessionId: "tcs-founder-test",
      role: "Backend Engineer",
      company: "tcs",
      band: TCS_BAND,
      recruiterPersona: "founder",
    } as never);
    expect(state.band.hasEquity).toBe(false);
  });
});
