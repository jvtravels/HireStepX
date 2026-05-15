/* Wave 8 + Wave 9 — candidate profile flag expansion.
 *
 * Smoke tests (3 per wave, 6 total):
 *   Wave-8 (offer-response / financial / role clarity / competing-offer):
 *     1. firstOfferReaction=negative when candidate rejects the offer
 *     2. mentionedPf=true when candidate asks about PF breakup
 *     3. competingOfferIsVerbal=true + competingOfferAmount extracted
 *
 *   Wave-9 (psychological / Indian doc-process / seniority / negotiation strategy):
 *     4. showedFrustration=true when candidate expresses impatience
 *     5. isFirstJobChange=true when candidate says been at one company since college
 *     6. gaveRangeNotPoint=true + referencedMarketData=true smoke combo
 */
import { describe, it, expect } from "vitest";
import {
  extractCandidateProfile,
  mergeCandidateProfile,
} from "../../server-handlers/_candidate-profile";

/* ═══════════════════════════════════════════════════════════════════════
 * WAVE-8 SMOKE TESTS
 * ═══════════════════════════════════════════════════════════════════════ */

describe("Wave-8 — offer-response: firstOfferReaction", () => {
  it("firstOfferReaction=negative when candidate explicitly rejects offer as too low", () => {
    const r = extractCandidateProfile(
      "That is lower than what I was expecting — this doesn't work for me.",
    );
    expect(r.firstOfferReaction).toBe("negative");
  });

  it("firstOfferReaction=positive when candidate reacts enthusiastically", () => {
    const r = extractCandidateProfile(
      "That's exactly what I was looking for — I love the offer!",
    );
    expect(r.firstOfferReaction).toBe("positive");
  });

  it("firstOfferReaction=null when no reaction signal in text", () => {
    const r = extractCandidateProfile("My current CTC is 20 LPA.");
    expect(r.firstOfferReaction).toBeNull();
  });
});

describe("Wave-8 — financial specifics: mentionedPf", () => {
  it("mentionedPf=true when candidate asks about PF breakup", () => {
    const r = extractCandidateProfile(
      "Can you tell me what the PF breakup looks like? Is the employer contributing 12%?",
    );
    expect(r.mentionedPf).toBe(true);
  });

  it("mentionedGratuity=true when candidate asks about gratuity in offer", () => {
    const r = extractCandidateProfile(
      "Is gratuity included in the CTC calculation or is it extra?",
    );
    expect(r.mentionedGratuity).toBe(true);
  });

  it("mentionedVariablePayout=true when candidate asks about variable payout schedule", () => {
    const r = extractCandidateProfile(
      "When is the variable component paid out — is it quarterly or annual?",
    );
    expect(r.mentionedVariablePayout).toBe(true);
  });
});

describe("Wave-8 — competing-offer specifics", () => {
  it("competingOfferIsVerbal=true when candidate mentions verbal offer", () => {
    const r = extractCandidateProfile(
      "I have a verbal offer from another company — not written yet.",
    );
    expect(r.competingOfferIsVerbal).toBe(true);
  });

  it("competingOfferAmount extracted when stated", () => {
    const r = extractCandidateProfile(
      "The competing offer is paying 32 LPA — can you match that?",
    );
    expect(r.competingOfferAmount).toBe(32);
  });

  it("Wave-8 flags default to false / null when no signal", () => {
    const r = extractCandidateProfile("I am looking for a new opportunity.");
    expect(r.firstOfferReaction).toBeNull();
    expect(r.explicitlyRejectedOffer).toBe(false);
    expect(r.askedForTimeToDecide).toBe(false);
    expect(r.mentionedSpouseFamily).toBe(false);
    expect(r.mentionedRelocation).toBe(false);
    expect(r.mentionedPf).toBe(false);
    expect(r.mentionedGratuity).toBe(false);
    expect(r.mentionedForm16).toBe(false);
    expect(r.mentionedVariablePayout).toBe(false);
    expect(r.mentionedSigningBonus).toBe(false);
    expect(r.mentionedRetentionBonus).toBe(false);
    expect(r.mentionedJoiningBonus).toBe(false);
    expect(r.askedAboutReporting).toBe(false);
    expect(r.askedAboutTeamSize).toBe(false);
    expect(r.askedAboutPerformanceCycle).toBe(false);
    expect(r.mentionedTargetRole).toBe(false);
    expect(r.competingOfferIsVerbal).toBe(false);
    expect(r.competingOfferCompany).toBeNull();
    expect(r.competingOfferAmount).toBeNull();
    expect(r.competingOfferDeadline).toBeNull();
  });
});

describe("Wave-8 merge — monotone-up behavior", () => {
  it("competingOfferAmount takes max across turns", () => {
    const first = extractCandidateProfile("The other offer is paying 28 LPA.");
    const second = extractCandidateProfile("Actually the competing offer is paying 32 LPA.");
    const merged = mergeCandidateProfile(first, second);
    expect(merged.competingOfferAmount).toBe(32);
  });

  it("mentionedPf is monotone-up across turns", () => {
    const first = extractCandidateProfile("My current CTC is 25 LPA.");
    const second = extractCandidateProfile("What is the PF contribution from the employer?");
    const merged = mergeCandidateProfile(first, second);
    expect(merged.mentionedPf).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
 * WAVE-9 SMOKE TESTS
 * ═══════════════════════════════════════════════════════════════════════ */

describe("Wave-9 — psychological: showedFrustration", () => {
  it("showedFrustration=true when candidate expresses impatience", () => {
    const r = extractCandidateProfile(
      "I'm getting frustrated — this has been going on for weeks and still no answer.",
    );
    expect(r.showedFrustration).toBe(true);
  });

  it("showedExcitement=true when candidate expresses genuine excitement", () => {
    const r = extractCandidateProfile(
      "I'm really excited about this role — it's exactly what I've been looking for!",
    );
    expect(r.showedExcitement).toBe(true);
  });

  it("escalatedDemand=true when candidate adds ask after partial agreement", () => {
    const r = extractCandidateProfile(
      "One more thing — I also need a retention bonus on top of the base we agreed.",
    );
    expect(r.escalatedDemand).toBe(true);
  });
});

describe("Wave-9 — seniority/career stage", () => {
  it("isFirstJobChange=true when candidate mentions been at one company since college", () => {
    const r = extractCandidateProfile(
      "This would be my first job change — I've been with this company since college.",
    );
    expect(r.isFirstJobChange).toBe(true);
  });

  it("hasPhdOrMba=true when candidate mentions MBA", () => {
    const r = extractCandidateProfile(
      "I completed my MBA from IIM Bangalore two years ago.",
    );
    expect(r.hasPhdOrMba).toBe(true);
  });

  it("mentionedStartupExperience=true when candidate mentions startup background", () => {
    const r = extractCandidateProfile(
      "I have a strong startup background — worked at a Series B company for 3 years.",
    );
    expect(r.mentionedStartupExperience).toBe(true);
  });
});

describe("Wave-9 — negotiation strategy signals", () => {
  it("gaveRangeNotPoint=true when candidate states salary range", () => {
    const r = extractCandidateProfile(
      "I'm looking for somewhere between 30 LPA and 35 LPA for this role.",
    );
    expect(r.gaveRangeNotPoint).toBe(true);
  });

  it("referencedMarketData=true when candidate cites Glassdoor data", () => {
    const r = extractCandidateProfile(
      "According to Glassdoor, the market range for this role is 32-40 LPA.",
    );
    expect(r.referencedMarketData).toBe(true);
  });

  it("deflectedOnRange=true when candidate says they're flexible / you tell me", () => {
    const r = extractCandidateProfile(
      "I'm quite flexible on the salary — you know the market better, you tell me.",
    );
    expect(r.deflectedOnRange).toBe(true);
  });

  it("mentionedTaxImplication=true when candidate mentions new tax regime", () => {
    const r = extractCandidateProfile(
      "Under the new tax regime my effective tax rate changes — I need to factor that in.",
    );
    expect(r.mentionedTaxImplication).toBe(true);
  });

  it("Wave-9 flags default to false when no signal", () => {
    const r = extractCandidateProfile("I am looking for a new opportunity.");
    expect(r.showedFrustration).toBe(false);
    expect(r.showedExcitement).toBe(false);
    expect(r.usedSilence).toBe(false);
    expect(r.backtrackedOnExpectation).toBe(false);
    expect(r.escalatedDemand).toBe(false);
    expect(r.mentionedBgvConcern).toBe(false);
    expect(r.mentionedRelievingLetterRisk).toBe(false);
    expect(r.mentionedNoticeWaiver).toBe(false);
    expect(r.mentionedNoticeBuyout).toBe(false);
    expect(r.mentionedMoonlighting).toBe(false);
    expect(r.isFirstJobChange).toBe(false);
    expect(r.hasManagementExperience).toBe(false);
    expect(r.mentionedStartupExperience).toBe(false);
    expect(r.mentionedMncExperience).toBe(false);
    expect(r.hasPhdOrMba).toBe(false);
    expect(r.usedAnchorFirst).toBe(false);
    expect(r.gaveRangeNotPoint).toBe(false);
    expect(r.deflectedOnRange).toBe(false);
    expect(r.referencedMarketData).toBe(false);
    expect(r.mentionedCostOfLiving).toBe(false);
    expect(r.mentionedTaxImplication).toBe(false);
  });
});

describe("Wave-9 merge — monotone-up", () => {
  it("referencedMarketData is monotone-up across turns", () => {
    const first = extractCandidateProfile("My current CTC is 25 LPA.");
    const second = extractCandidateProfile(
      "According to levels.fyi, engineers at this level earn 35-40 LPA.",
    );
    const merged = mergeCandidateProfile(first, second);
    expect(merged.referencedMarketData).toBe(true);
  });

  it("showedFrustration is monotone-up across turns", () => {
    const first = extractCandidateProfile("I'm okay with the process so far.");
    const second = extractCandidateProfile(
      "Honestly, I'm frustrated — this has been going on for weeks.",
    );
    const merged = mergeCandidateProfile(first, second);
    expect(merged.showedFrustration).toBe(true);
  });
});
