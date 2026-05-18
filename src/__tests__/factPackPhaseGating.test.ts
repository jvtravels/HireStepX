/* PDF#29 Bugs 6 + 8 (2026-05-18) — factPack phase gating regression.
 *
 * Bug 6: bot referenced "AuthBridge / FirstAdvantage" BGV vendors during
 * discovery — leaked from INDIAN_MARKET_FACTS.bgvTimeline / bgvScope.
 * Bug 8: bot quoted "10-15%" variable splits as if an offer — leaked
 * from INDIAN_MARKET_FACTS.variableSplitNorms.
 *
 * Root cause: the factPack shipped the full market-facts table to the
 * LLM in every phase. Fixed by phase-gating in selectMarketFacts().
 *
 * fixture from PDF 29 manual replay session (2026-05-18) — phrasing per
 * kernel diagnostic.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationPhase,
} from "../../server-handlers/_negotiation-kernel";
import { buildFactPack, selectMarketFacts } from "../../server-handlers/_fact-pack";

const BAND: NegotiationBand = {
  initialOffer: 23,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: false,
};

const mk = (phase: NegotiationPhase) => ({
  ...initState({
    sessionId: `gate-${phase}`,
    role: "Senior PM",
    company: "Razorpay",
    band: BAND,
  }),
  phase,
});

describe("PDF#29 Bugs 6 + 8 — factPack phase gating", () => {
  const preAnchor: NegotiationPhase[] = [
    "opening",
    "range-disclosure",
    "probe-expectations",
  ];

  for (const phase of preAnchor) {
    it(`pre-anchor phase '${phase}' OMITS BGV + variableSplitNorms`, () => {
      const pack = buildFactPack(mk(phase));
      const mf = pack.marketFacts as Record<string, unknown>;
      expect(mf.bgvTimeline).toBeUndefined();
      expect(mf.bgvScope).toBeUndefined();
      expect(mf.relievingLetterRisk).toBeUndefined();
      expect(mf.form16Requirement).toBeUndefined();
      expect(mf.pfUanTransfer).toBeUndefined();
      expect(mf.joiningDateConvention).toBeUndefined();
      expect(mf.noticeBuyoutPolicy).toBeUndefined();
      expect(mf.bondPolicy).toBeUndefined();
      expect(mf.variableSplitNorms).toBeUndefined();
      /* Always-safe statutory + comp mechanics remain. */
      expect(mf.gratuityRule).toBeDefined();
      expect(mf.pfRule).toBeDefined();
      expect(mf.rsuStandard).toBeDefined();
      expect(mf.taxRegimeNew7L).toBeDefined();
    });
  }

  it("anchoring/counter-round phase ('counter-offer') includes comp mechanics + leverage, omits BGV", () => {
    const pack = buildFactPack(mk("counter-offer"));
    const mf = pack.marketFacts as Record<string, unknown>;
    expect(mf.variableSplitNorms).toBeDefined();
    expect(mf.gratuityRule).toBeDefined();
    expect(mf.appraisalAnchor).toBeDefined();
    expect(mf.bgvTimeline).toBeUndefined();
    expect(mf.bgvScope).toBeUndefined();
    expect(mf.relievingLetterRisk).toBeUndefined();
  });

  it("close-recap / post-acceptance ('closing-push', 'accepted') include the FULL set including BGV", () => {
    for (const phase of ["closing-push", "accepted"] as const) {
      const pack = buildFactPack(mk(phase));
      const mf = pack.marketFacts as Record<string, unknown>;
      expect(mf.bgvTimeline, phase).toBeDefined();
      expect(mf.bgvScope, phase).toBeDefined();
      expect(mf.relievingLetterRisk, phase).toBeDefined();
      expect(mf.form16Requirement, phase).toBeDefined();
      expect(mf.variableSplitNorms, phase).toBeDefined();
      expect(mf.gratuityRule, phase).toBeDefined();
    }
  });

  it("selectMarketFacts is pure-projection (no mutation of source)", () => {
    const before = selectMarketFacts("opening");
    const after = selectMarketFacts("accepted");
    expect(Object.keys(before).length).toBeLessThan(Object.keys(after).length);
    /* Subsequent calls don't leak between projections. */
    const reBefore = selectMarketFacts("opening");
    expect(Object.keys(reBefore)).toEqual(Object.keys(before));
  });
});
