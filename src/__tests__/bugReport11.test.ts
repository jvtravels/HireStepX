/* Bug-report 11 (2026-05-14) — regression suite for the four fixes:
 *
 *   A. Opening prose pins role to SESSION target (state.role), never
 *      leaks from a resume-derived role.
 *   B. Business Analyst @ Accenture opens at the entry 35th-percentile
 *      when applicableYoe = 0, NOT at the resume-derived senior bucket.
 *   C. Candidate ask below current offer routes directly to
 *      close-acceptance at min(offer, ask), not another counter-up.
 *   D. Mid-session "pre-graduate / fresh grad / still in college"
 *      disclosure flips freshGradDisclosed sticky-true and forces
 *      candidateApplicableYoe = 0.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  pickAiMove,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import {
  deterministicFallbackText,
} from "../../server-handlers/_negotiate-turn-helpers";
import { detectFreshGradDisclosure } from "../../server-handlers/_candidate-profile";
import { generateNegotiationBand } from "../../data/salary-lookup";

const BAND: NegotiationBand = { initialOffer: 7, maxStretch: 11, walkAway: 5, hasEquity: false };

describe("bug-report 11 — Bug A: opening role pinned to session target", () => {
  it("deterministic fallback opener mentions state.role verbatim", () => {
    const state = initState({
      sessionId: "s1",
      role: "Business Analyst",
      company: "accenture",
      band: BAND,
    });
    const move = pickAiMove(state);
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/Business Analyst/);
    expect(text).not.toMatch(/Senior Product Designer/i);
  });

  it("deterministic fallback opener stays generic when state.role is empty", () => {
    const state = initState({
      sessionId: "s1",
      role: "",
      company: "accenture",
      band: BAND,
    });
    const move = pickAiMove(state);
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/this role/);
  });
});

describe("bug-report 11 — Bug B: Accenture BA entry-band opens around 35th pctile", () => {
  it("generateNegotiationBand for entry-level BA @ Accenture has initialOffer in calibrated entry range", () => {
    const band = generateNegotiationBand({
      role: "Business Analyst",
      company: "accenture",
      experienceLevel: "entry",
    });
    /* Calibrated entry band 6-8 LPA → 35th pctile = 6 + 2*0.35 = 6.7 */
    expect(band.initialOffer).toBeGreaterThanOrEqual(6);
    expect(band.initialOffer).toBeLessThanOrEqual(8);
    expect(band.maxStretch).toBeLessThan(15);
  });

  it("Accenture BA opening is NOT the senior-bucket ceiling (₹25L)", () => {
    const band = generateNegotiationBand({
      role: "Business Analyst",
      company: "accenture",
      experienceLevel: "entry",
    });
    expect(band.initialOffer).toBeLessThan(20);
  });
});

describe("bug-report 11 — Bug C: candidate ask below offer auto-accepts", () => {
  it("ask ₹14L vs offer ₹25L routes to close-acceptance at ₹14L", () => {
    let state = initState({
      sessionId: "s1",
      role: "Business Analyst",
      company: "accenture",
      band: { initialOffer: 25, maxStretch: 30, walkAway: 20, hasEquity: false },
    });
    /* Simulate: AI already opened with ₹25L. */
    state = { ...state, highestOfferMade: 25, phase: "offer-presented" as const };
    state = applyCandidateAnswer(state, "I'm looking for around 14 LPA.");
    const move = pickAiMove(state);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa).toBe(14);
  });

  it("ask EQUAL to offer also accepts at offer value", () => {
    let state = initState({
      sessionId: "s1",
      role: "Business Analyst",
      company: "accenture",
      band: { initialOffer: 7, maxStretch: 11, walkAway: 5, hasEquity: false },
    });
    state = { ...state, highestOfferMade: 8, phase: "offer-presented" as const };
    state = applyCandidateAnswer(state, "I'm looking for 8 LPA.");
    const move = pickAiMove(state);
    expect(move.lever).toBe("close-acceptance");
    expect(move.newTotalLpa).toBe(8);
  });

  it("ask ABOVE offer still routes through normal negotiation (not auto-accept)", () => {
    let state = initState({
      sessionId: "s1",
      role: "Business Analyst",
      company: "accenture",
      band: { initialOffer: 7, maxStretch: 14, walkAway: 5, hasEquity: false },
    });
    state = { ...state, highestOfferMade: 7, phase: "offer-presented" as const };
    state = applyCandidateAnswer(state, "I want 12 LPA.");
    const move = pickAiMove(state);
    expect(move.lever).not.toBe("close-acceptance");
  });
});

describe("bug-report 11 — Bug D: mid-session fresh-grad disclosure", () => {
  it("detectFreshGradDisclosure fires on 'pre-graduate'", () => {
    expect(detectFreshGradDisclosure("I'm graduating, I mean, pre-graduate.")).toBe(true);
  });

  it("detectFreshGradDisclosure fires on 'fresh graduate'", () => {
    expect(detectFreshGradDisclosure("Actually I'm a fresh graduate.")).toBe(true);
  });

  it("detectFreshGradDisclosure fires on 'still in college'", () => {
    expect(detectFreshGradDisclosure("I'm still in college, final year.")).toBe(true);
  });

  it("detectFreshGradDisclosure fires on '0 years of experience'", () => {
    expect(detectFreshGradDisclosure("I have 0 years of experience.")).toBe(true);
  });

  it("detectFreshGradDisclosure ignores unrelated text", () => {
    expect(detectFreshGradDisclosure("I have 6 years of experience.")).toBe(false);
    expect(detectFreshGradDisclosure("Let's talk about the joining bonus.")).toBe(false);
  });

  it("applyCandidateAnswer flips freshGradDisclosed sticky-true and zeroes applicableYoe", () => {
    let state = initState({
      sessionId: "s1",
      role: "Business Analyst",
      company: "accenture",
      band: BAND,
      candidateTotalYoe: 6,
      candidateApplicableYoe: 6,
      candidatePrimaryDomain: "product-design",
    });
    state = { ...state, highestOfferMade: 25, phase: "offer-presented" as const };
    state = applyCandidateAnswer(state, "I'm graduating, I mean, pre-graduate.");
    expect(state.freshGradDisclosed).toBe(true);
    expect(state.candidateApplicableYoe).toBe(0);
  });

  it("freshGradDisclosed stays true on subsequent turns", () => {
    let state = initState({
      sessionId: "s1",
      role: "Business Analyst",
      company: "accenture",
      band: BAND,
      candidateApplicableYoe: 6,
    });
    state = { ...state, highestOfferMade: 25, phase: "offer-presented" as const };
    state = applyCandidateAnswer(state, "Pre-graduate, actually.");
    expect(state.freshGradDisclosed).toBe(true);
    state = applyCandidateAnswer(state, "What can you offer?");
    expect(state.freshGradDisclosed).toBe(true);
  });
});
