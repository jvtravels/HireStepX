/* LN2 / Audit Pass 4 (PDF#27, 2026-05-17) — Indian currency / unit lock.
 *
 * Indian recruiters quote compensation in ₹ + LPA (or lakhs/crores).
 * The validator must reject any restyle that uses US-tech vocab —
 * USD / EUR / GBP / "annual salary" / "per year" / "per annum" /
 * "dollars" / "euros" / "pounds" — falling back to the canonical
 * (guaranteed ₹+LPA) line.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { validateRestyle } from "../../server-handlers/_response-pipeline";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function mkState(): NegotiationState {
  return initState({ sessionId: "ln2", role: "swe", company: "acme", band: BAND });
}

const ACTION: NextAction = {
  kind: "counter-offer",
  counterTotalLpa: 26,
} as NextAction;

describe("LN2 — validator rejects non-Indian currency / unit vocab", () => {
  const CANONICAL = "We can revise the fitment to ₹26L total. How does that look?";

  const REJECTED_SAMPLES = [
    "We can revise the annual salary to ₹26L total. How does that look?",
    "We can revise the fitment to 31000 USD per year. How does that look?",
    "We can revise the fitment to ₹26L per annum. How does that look?",
    "We can revise the fitment to 26 lakhs dollars. How does that look?",
    "We can revise the fitment with EUR equivalent. How does that look?",
    "We can revise the fitment in GBP terms. How does that look?",
    "Salary lands at 31000 dollars annually.",
    "Per year, this is 31000 euros total.",
  ];

  for (const sample of REJECTED_SAMPLES) {
    it(`rejects "${sample.slice(0, 60)}..." with non-indian-currency-vocab`, () => {
      const r = validateRestyle(CANONICAL, sample, mkState(), ACTION);
      expect(r.valid).toBe(false);
      if (!r.valid) expect(r.reason).toBe("non-indian-currency-vocab");
    });
  }

  it("accepts a clean ₹+LPA restyle", () => {
    const restyle = "We can revise the fitment to ₹26L total CTC. Thoughts?";
    const r = validateRestyle(CANONICAL, restyle, mkState(), ACTION);
    expect(r.valid).toBe(true);
  });

  it("accepts 'lakhs' framing (Indian unit)", () => {
    const canonical = "The fitment lands at ₹26L total.";
    const restyle = "The fitment lands at 26 lakhs total.";
    const r = validateRestyle(canonical, restyle, mkState(), ACTION);
    /* "lakhs" is an Indian unit; no rejection from LN2. The numbers
     * gate may flag if "26" wasn't in canonical; here it IS, so valid. */
    expect(r.valid).toBe(true);
  });

  it("case-insensitive match — 'USD' / 'usd' both rejected", () => {
    const canonical = "We can revise the fitment to ₹26L total.";
    const lower = "We can revise the fitment to 31000 usd.";
    const upper = "We can revise the fitment to 31000 USD.";
    expect(validateRestyle(canonical, lower, mkState(), ACTION).valid).toBe(false);
    expect(validateRestyle(canonical, upper, mkState(), ACTION).valid).toBe(false);
  });
});
