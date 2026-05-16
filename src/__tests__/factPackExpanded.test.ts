/* Fix 3 (2026-05-16) — FactPack expanded from 5 → ~25 facts.
 *
 * Verifies the expanded INDIAN_MARKET_FACTS bundle, new fact-gap
 * detectors, and broader classifyQuestionIntent coverage.
 */
import { describe, it, expect } from "vitest";
import {
  INDIAN_MARKET_FACTS,
  buildFactPack,
  detectFactGap,
  classifyQuestionIntent,
} from "../../server-handlers/_fact-pack";
import {
  initState,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: false };

describe("INDIAN_MARKET_FACTS — expanded coverage", () => {
  it("exposes at least 20 keys covering comp/benefits/process/tax/leverage", () => {
    const keys = Object.keys(INDIAN_MARKET_FACTS);
    expect(keys.length).toBeGreaterThanOrEqual(20);
  });

  it("includes joiningBonusClawback in compensation", () => {
    expect(INDIAN_MARKET_FACTS.joiningBonusClawback).toMatch(/clawback|prorat|months?/i);
  });

  it("includes group medical floater fact (₹5L family floater)", () => {
    expect(INDIAN_MARKET_FACTS.groupMedicalFloater).toMatch(/5\s*L|5\s*lakh|floater/i);
  });

  it("includes meal voucher fact (Sodexo)", () => {
    expect(INDIAN_MARKET_FACTS.mealVouchers).toMatch(/sodexo|2200|meal/i);
  });

  it("includes BGV timeline fact", () => {
    expect(INDIAN_MARKET_FACTS.bgvTimeline).toMatch(/firstadvantage|authbridge|2-4|weeks/i);
  });

  it("includes new-tax-regime brackets", () => {
    expect(INDIAN_MARKET_FACTS.taxRegimeNew7L).toMatch(/87A|7L|zero/i);
    expect(INDIAN_MARKET_FACTS.taxRegimeAt15L).toBeTruthy();
    expect(INDIAN_MARKET_FACTS.taxRegimeAt25L).toBeTruthy();
  });

  it("includes appraisal march cycle leverage facts", () => {
    expect(INDIAN_MARKET_FACTS.appraisalAnchor).toBeTruthy();
    expect(INDIAN_MARKET_FACTS.marchCycle).toBeTruthy();
  });
});

describe("detectFactGap — expanded patterns", () => {
  const baseState = initState({ sessionId: "f1", role: "swe", company: "acme", band: BAND });

  it("clawback question — answerable from marketFacts only", () => {
    const pack = buildFactPack(baseState);
    const gap = detectFactGap(pack, "what's the clawback on joining bonus?");
    expect(gap.canAnswer).toBe(true);
  });

  it("medical insurance question — answerable", () => {
    const pack = buildFactPack(baseState);
    const gap = detectFactGap(pack, "what's the medical insurance coverage?");
    expect(gap.canAnswer).toBe(true);
  });

  it("BGV question — answerable", () => {
    const pack = buildFactPack(baseState);
    const gap = detectFactGap(pack, "how long does the BGV take?");
    expect(gap.canAnswer).toBe(true);
  });

  it("notice buyout policy is fact-pack answerable", () => {
    const pack = buildFactPack(baseState);
    const gap = detectFactGap(pack, "is buyout allowed by policy?");
    expect(gap.canAnswer).toBe(true);
  });

  it("tax regime question is fact-pack answerable", () => {
    const pack = buildFactPack(baseState);
    const gap = detectFactGap(pack, "how does the new tax regime work at 15L?");
    expect(gap.canAnswer).toBe(true);
  });
});

describe("classifyQuestionIntent — expanded buckets", () => {
  it("clawback → clawback", () => {
    expect(classifyQuestionIntent("what's the clawback?")).toBe("clawback");
  });
  it("retention bonus → retention", () => {
    expect(classifyQuestionIntent("how does retention bonus work?")).toBe("retention");
  });
  it("medical insurance → insurance", () => {
    expect(classifyQuestionIntent("what's the medical floater amount?")).toBe("insurance");
  });
  it("BGV process → bgv", () => {
    expect(classifyQuestionIntent("how long is the background verification?")).toBe("bgv");
  });
  it("UAN/PF transfer → pf", () => {
    expect(classifyQuestionIntent("how does UAN transfer work?")).toBe("pf");
  });
  it("appraisal cycle → appraisal", () => {
    expect(classifyQuestionIntent("when's the next appraisal cycle?")).toBe("appraisal");
  });
});
