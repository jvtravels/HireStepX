/* PDF#29 Bug 3 (2026-05-18) — band leak regression.
 *
 * Symptom: bot emitted "₹23 to ₹32.2 lakhs" — leaked the internal band
 * range to the candidate. Three root causes (all fixed in this commit):
 *   1. canonical prose for `band-anchor-with-rationale` interpolated
 *      ₹{lo}-{hi}. Rewritten to point-offer at lo.
 *   2. NEXT_ACTION_CONTRACT had no entry — restyle path could
 *      reintroduce a dash/"to" between numbers.
 *   3. _fact-pack.ts shipped state.band as `budgetBand` unconditionally;
 *      pre-anchor phases must not see the internal range.
 *
 * fixture from PDF 29 manual replay session (2026-05-18) — phrasing per
 * kernel diagnostic.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";
import { NEXT_ACTION_CONTRACT } from "../../../server-handlers/_response-pipeline";
import { buildFactPack } from "../../../server-handlers/_fact-pack";

const BAND: NegotiationBand = {
  initialOffer: 23,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: false,
};

describe("PDF#29 Bug 3 — band leak", () => {
  it("band-anchor-with-rationale canonical contains LPA + band but NOT a range", () => {
    /* Drive the probe-expectations → anchor bridge: discovery complete,
     * no offer on table. The planner returns band-anchor-with-rationale. */
    const state: NegotiationState = {
      ...initState({
        sessionId: "pdf29-a",
        role: "Senior Product Manager",
        company: "Razorpay",
        band: BAND,
      }),
      phase: "probe-expectations",
      candidateCurrentCtc: 18,
      candidateTarget: 28,
      candidateApplicableYoe: 6,
      highestOfferMade: 0,
      discoveryChecklist: undefined,
    };
    const action = planNextAction(state);
    expect(action.kind).toBe("band-anchor-with-rationale");

    const prose = renderCanonicalProse(action, state);
    expect(prose).toMatch(/\bLPA\b/);
    expect(prose).toMatch(/\bband\b/i);
    /* The leak: digit, optional spaces, dash/en-dash/em-dash/"to", digit. */
    expect(prose).not.toMatch(/\d+\s*(?:[-\u2013\u2014]|to)\s*\d/);
    /* Point offer = band floor (initialOffer). */
    expect(prose).toContain(`${BAND.initialOffer}`);
    expect(prose).not.toContain(`${BAND.maxStretch}`);

    /* Contract entry exists and enforces the same invariant. */
    const entry = NEXT_ACTION_CONTRACT["band-anchor-with-rationale"];
    expect(entry).toBeDefined();
    expect(entry?.numberPolicy).toBe("required");
    expect(entry?.bannedTokens?.some((re) => re.source.includes("to"))).toBe(true);
  });

  it("buildFactPack omits budgetBand in pre-anchor phases", () => {
    const base = initState({
      sessionId: "pdf29-b",
      role: "Senior PM",
      company: "Razorpay",
      band: BAND,
    });
    for (const phase of ["opening", "range-disclosure", "probe-expectations"] as const) {
      const pack = buildFactPack({ ...base, phase });
      expect(pack.budgetBand, `phase=${phase}`).toBeUndefined();
    }
  });

  it("buildFactPack populates budgetBand once anchor has been disclosed", () => {
    const base = initState({
      sessionId: "pdf29-c",
      role: "Senior PM",
      company: "Razorpay",
      band: BAND,
    });
    for (const phase of [
      "offer-presented",
      "counter-offer",
      "lever-explore",
      "closing-push",
      "accepted",
    ] as const) {
      const pack = buildFactPack({ ...base, phase });
      expect(pack.budgetBand, `phase=${phase}`).toBeDefined();
      expect(pack.budgetBand?.low).toBe(BAND.initialOffer);
      expect(pack.budgetBand?.high).toBe(BAND.maxStretch);
    }
  });
});
