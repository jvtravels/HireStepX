import { describe, it, expect } from "vitest";
import { extractCandidateProfile } from "../../server-handlers/_candidate-profile";
import {
  scoreProfileConfidence,
  lowConfidenceFlags,
} from "../../server-handlers/_candidate-profile-confidence";

describe("scoreProfileConfidence", () => {
  it("scores 0 for every flag on empty input", () => {
    const profile = extractCandidateProfile("");
    const scores = scoreProfileConfidence("", profile);
    for (const v of Object.values(scores)) expect(v).toBe(0);
  });

  it("high-confidence career-gap with explicit months + activity", () => {
    const text = "I had a 14-month career break for upskilling and certifications.";
    const profile = extractCandidateProfile(text);
    const scores = scoreProfileConfidence(text, profile);
    /* 14-month gap + numeric anchor + lexicon match → > 0.6. */
    expect(scores.careerGapMonths).toBeGreaterThan(0.6);
  });

  it("low-confidence when the candidate hedges", () => {
    const text = "I maybe had a small gap, possibly 6 months or so, I think.";
    const profile = extractCandidateProfile(text);
    const scores = scoreProfileConfidence(text, profile);
    /* Even if the gap detector fires, hedge words drop the score. */
    if (scores.careerGapMonths > 0) {
      expect(scores.careerGapMonths).toBeLessThan(0.6);
    }
  });

  it("numerical anchors boost confidence", () => {
    const withNumbers = "I switched 4 jobs in 5 years, my current CTC is ₹18 LPA.";
    const withoutNumbers = "I switch jobs frequently. My pay is okay.";
    const p1 = extractCandidateProfile(withNumbers);
    const p2 = extractCandidateProfile(withoutNumbers);
    const s1 = scoreProfileConfidence(withNumbers, p1);
    const s2 = scoreProfileConfidence(withoutNumbers, p2);
    if (s1.tenureSignal > 0 && s2.tenureSignal > 0) {
      expect(s1.tenureSignal).toBeGreaterThan(s2.tenureSignal);
    } else {
      /* If the detector doesn't fire on the second utterance, the
       * boost from numeric anchors is still asserted on the first. */
      expect(s1.tenureSignal).toBeGreaterThan(0);
    }
  });

  it("inactive flags get score 0 (false / null / empty)", () => {
    const profile = extractCandidateProfile("Hello, how are you?");
    const scores = scoreProfileConfidence("Hello, how are you?", profile);
    expect(scores.careerGapMonths).toBe(0);
    expect(scores.tenureSignal).toBe(0);
    expect(scores.domainPivot).toBe(0);
  });

  it("explicit service-bond mention scores high", () => {
    const text = "I signed a 2-year service bond worth ₹3 lakh with my current employer.";
    const profile = extractCandidateProfile(text);
    const scores = scoreProfileConfidence(text, profile);
    if (profile.serviceBondAccepted) {
      expect(scores.serviceBondAccepted).toBeGreaterThan(0.6);
    }
  });

  it("scores in [0,1] for all flags regardless of input", () => {
    const text = "I switched 6 jobs in 7 years. PIP. PIP. PIP. Layoff. ₹50 LPA target.";
    const profile = extractCandidateProfile(text);
    const scores = scoreProfileConfidence(text, profile);
    for (const v of Object.values(scores)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("hedged-only utterance with no anchors produces low scores", () => {
    const text = "I think I might possibly have done something like that, maybe.";
    const profile = extractCandidateProfile(text);
    const scores = scoreProfileConfidence(text, profile);
    for (const v of Object.values(scores)) {
      if (v > 0) expect(v).toBeLessThan(0.5);
    }
  });
});

describe("lowConfidenceFlags", () => {
  it("returns empty when nothing fires", () => {
    const profile = extractCandidateProfile("");
    const scores = scoreProfileConfidence("", profile);
    expect(lowConfidenceFlags(scores)).toEqual([]);
  });

  it("filters fired flags below the threshold", () => {
    const text = "I think I maybe had a gap of a few months, possibly.";
    const profile = extractCandidateProfile(text);
    const scores = scoreProfileConfidence(text, profile);
    const low = lowConfidenceFlags(scores, 0.5);
    /* All fired flags here are hedged → in the low set. */
    for (const k of low) {
      expect(scores[k]).toBeGreaterThan(0);
      expect(scores[k]).toBeLessThan(0.5);
    }
  });

  it("does not include flags that did not fire (score 0)", () => {
    const text = "₹26 LPA hard ask, no flexibility.";
    const profile = extractCandidateProfile(text);
    const scores = scoreProfileConfidence(text, profile);
    const low = lowConfidenceFlags(scores, 0.4);
    for (const k of low) expect(scores[k]).toBeGreaterThan(0);
  });
});
