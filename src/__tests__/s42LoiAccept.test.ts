import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";
import { clampOpeningAnchor } from "../../server-handlers/_next-action-planner";
import { initState } from "../../server-handlers/_negotiation-kernel";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 43.7,
  maxStretch: 55,
  walkAway: 38,
  hasEquity: false,
};

function makeState(overrides?: Partial<Parameters<typeof initState>[0]>) {
  return initState({ sessionId: "s-s42", role: "SWE", company: "Myntra", band: BAND, ...overrides });
}

describe("S42-B7 LOI receiver-side document-gate accept", () => {
  it("'once I receive the offer letter' is accepted (post-offer)", () => {
    const result = classifyAcceptance(
      "That sounds good to me — 48 LPA works. I'll formally accept and sign once I receive the written offer letter or LOI.",
      { offerLpa: 48, offerOnTable: true },
    );
    expect(result.accepted).toBe(true);
  });

  it("'as soon as I receive the LOI' is accepted", () => {
    const result = classifyAcceptance(
      "Great, as soon as I receive the LOI I will sign.",
      { offerLpa: 46, offerOnTable: true },
    );
    expect(result.accepted).toBe(true);
  });

  it("'once I get the paperwork' is accepted", () => {
    const result = classifyAcceptance(
      "Sounds fair — once I get the paperwork I'll proceed.",
      { offerLpa: 44, offerOnTable: true },
    );
    expect(result.accepted).toBe(true);
  });

  it("'when I have the formal offer' is accepted", () => {
    const result = classifyAcceptance(
      "I'm happy with that — when I have the formal offer in hand I'll sign it.",
      { offerLpa: 45, offerOnTable: true },
    );
    expect(result.accepted).toBe(true);
  });

  it("bare 'once I receive' (no paperwork noun) does NOT accept", () => {
    const result = classifyAcceptance(
      "Once I receive more information I'll decide.",
      { offerLpa: 45, offerOnTable: true },
    );
    expect(result.accepted).toBe(false);
  });

  it("genuine salary condition 'once you bump it to 52' stays blocked", () => {
    const result = classifyAcceptance(
      "I'll sign once you bump it to 52 LPA.",
      { offerLpa: 48, offerOnTable: true },
    );
    expect(result.accepted).toBe(false);
  });
});

describe("S40-B5 BATNA floor in clampOpeningAnchor", () => {
  it("anchor is floored at competing offer when competing > band floor", () => {
    const state = {
      ...makeState(),
      competingOffer: 47,
      candidateCurrentCtc: 36,
    };
    const result = clampOpeningAnchor(BAND.initialOffer, BAND.maxStretch, state);
    expect(result).toBeGreaterThanOrEqual(47);
  });

  it("no BATNA floor when competing offer is null", () => {
    const state = {
      ...makeState(),
      competingOffer: null,
      candidateCurrentCtc: null,
    };
    const result = clampOpeningAnchor(BAND.initialOffer, BAND.maxStretch, state);
    expect(result).toBeGreaterThanOrEqual(BAND.initialOffer);
    expect(result).toBeLessThanOrEqual(BAND.maxStretch);
  });

  it("BATNA floor below band floor has no effect", () => {
    const state = {
      ...makeState(),
      competingOffer: 40,
      candidateCurrentCtc: null,
    };
    const resultWithBatna = clampOpeningAnchor(BAND.initialOffer, BAND.maxStretch, state);
    const stateNoBatna = { ...makeState(), competingOffer: null, candidateCurrentCtc: null };
    const resultNoBatna = clampOpeningAnchor(BAND.initialOffer, BAND.maxStretch, stateNoBatna);
    expect(resultWithBatna).toBe(resultNoBatna);
  });

  it("BATNA floor is capped at band ceiling (maxStretch)", () => {
    const state = {
      ...makeState(),
      competingOffer: 60,
      candidateCurrentCtc: null,
    };
    const result = clampOpeningAnchor(BAND.initialOffer, BAND.maxStretch, state);
    expect(result).toBeLessThanOrEqual(BAND.maxStretch);
  });
});
