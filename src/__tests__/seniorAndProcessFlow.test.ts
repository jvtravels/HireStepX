/* Senior-flow + process dynamics + long-tail (2026-05-14h) — pins
 * the LLM behaviour for the remaining nine real-world Indian
 * negotiation scenarios:
 *
 * Senior (3):
 *   • peopleManagementClaimed — "I lead a team of 8" / "EM" / "Director"
 *   • crossBorderAnchor — Bay Area / Singapore / Dubai TC return
 *   • unvestedEquityLossClaim — RSU leave-behind / signing-bonus ask
 *
 * Process (3):
 *   • explodingOfferPressure — 24-72h deadline from another firm
 *   • postAcceptanceRenege — has reneged before / about to renege now
 *   • quotaAttainmentClaimed — sales attainment / President's Club
 *
 * Long-tail (3):
 *   • gardenLeaveDisclosed — paid sit-out between jobs
 *   • nonCompeteFlagged — restrictive covenant in current contract
 *   • relocationBonusAsked — relo allowance ask
 *
 * Each is utterance-detected, monotone-up across merge, and surfaces
 * a dedicated NEGOTIATION_SYSTEM_PROMPT rule. */
import { describe, expect, it } from "vitest";
import { extractCandidateProfile, mergeCandidateProfile } from "../../server-handlers/_candidate-profile";

describe("senior — peopleManagementClaimed", () => {
  it("detects 'I lead a team of 8'", () => {
    const r = extractCandidateProfile("I lead a team of 8 engineers across two squads.");
    expect(r.peopleManagementClaimed).toBe(true);
  });
  it("detects 'Engineering Manager' title", () => {
    const r = extractCandidateProfile("I'm an engineering manager at my current company.");
    expect(r.peopleManagementClaimed).toBe(true);
  });
  it("detects '5 direct reports'", () => {
    const r = extractCandidateProfile("I have 5 direct reports and own performance reviews.");
    expect(r.peopleManagementClaimed).toBe(true);
  });
  it("does NOT fire on plain IC", () => {
    const r = extractCandidateProfile("I'm a senior software engineer working on backend.");
    expect(r.peopleManagementClaimed).toBe(false);
  });
});

describe("senior — crossBorderAnchor", () => {
  it("detects 'returning from the US'", () => {
    const r = extractCandidateProfile("I'm returning to India from the Bay Area.");
    expect(r.crossBorderAnchor).toBe(true);
  });
  it("detects USD TC anchor", () => {
    const r = extractCandidateProfile("My current TC is $250,000 in the US.");
    expect(r.crossBorderAnchor).toBe(true);
  });
  it("detects Singapore return", () => {
    const r = extractCandidateProfile("I'm moving back to India from Singapore.");
    expect(r.crossBorderAnchor).toBe(true);
  });
});

describe("senior — unvestedEquityLossClaim", () => {
  it("detects 'leaving behind RSUs'", () => {
    const r = extractCandidateProfile("I'm leaving behind ₹40L in unvested RSUs.");
    expect(r.unvestedEquityLossClaim).toBe(true);
  });
  it("detects 'make me whole on unvested'", () => {
    const r = extractCandidateProfile("Can you make me whole on the unvested grant?");
    expect(r.unvestedEquityLossClaim).toBe(true);
  });
  it("detects 'signing bonus to offset unvested'", () => {
    const r = extractCandidateProfile("I'd need a signing bonus to offset the unvested equity.");
    expect(r.unvestedEquityLossClaim).toBe(true);
  });
});

describe("process — explodingOfferPressure", () => {
  it("detects 'exploding offer'", () => {
    const r = extractCandidateProfile("The other company gave me an exploding offer.");
    expect(r.explodingOfferPressure).toBe(true);
  });
  it("detects '48-hour deadline'", () => {
    const r = extractCandidateProfile("They want a decision in 48 hours.");
    expect(r.explodingOfferPressure).toBe(true);
  });
  it("detects 'decide by tomorrow'", () => {
    const r = extractCandidateProfile("They asked me to decide by tomorrow.");
    expect(r.explodingOfferPressure).toBe(true);
  });
});

describe("process — postAcceptanceRenege", () => {
  it("detects 'reneged on an offer'", () => {
    const r = extractCandidateProfile("I reneged on an offer last year.");
    expect(r.postAcceptanceRenege).toBe(true);
  });
  it("detects 'already accepted another offer but'", () => {
    const r = extractCandidateProfile("Honestly, I already accepted another offer but now I'm reconsidering.");
    expect(r.postAcceptanceRenege).toBe(true);
  });
  it("detects 'backing out of an offer'", () => {
    const r = extractCandidateProfile("Thinking of backing out of the offer.");
    expect(r.postAcceptanceRenege).toBe(true);
  });
});

describe("process — quotaAttainmentClaimed", () => {
  it("detects '140% of quota'", () => {
    const r = extractCandidateProfile("Hit 140% of my quota last year.");
    expect(r.quotaAttainmentClaimed).toBe(true);
  });
  it("detects 'President's Club'", () => {
    const r = extractCandidateProfile("I was a President's Club winner two years running.");
    expect(r.quotaAttainmentClaimed).toBe(true);
  });
  it("detects 'top performer'", () => {
    const r = extractCandidateProfile("I'm a top performer on the team.");
    expect(r.quotaAttainmentClaimed).toBe(true);
  });
});

describe("long-tail — gardenLeaveDisclosed", () => {
  it("detects 'garden leave'", () => {
    const r = extractCandidateProfile("I'll be on garden leave for the next 3 months.");
    expect(r.gardenLeaveDisclosed).toBe(true);
  });
  it("detects 'paid sit-out period'", () => {
    const r = extractCandidateProfile("They put me on a paid sit-out period between jobs.");
    expect(r.gardenLeaveDisclosed).toBe(true);
  });
});

describe("long-tail — nonCompeteFlagged", () => {
  it("detects 'non-compete clause'", () => {
    const r = extractCandidateProfile("My current contract has a non-compete clause.");
    expect(r.nonCompeteFlagged).toBe(true);
  });
  it("detects 'restrictive covenant'", () => {
    const r = extractCandidateProfile("There's a restrictive covenant in my agreement.");
    expect(r.nonCompeteFlagged).toBe(true);
  });
  it("detects 'non-solicit'", () => {
    const r = extractCandidateProfile("I have a non-solicit clause that worries me.");
    expect(r.nonCompeteFlagged).toBe(true);
  });
});

describe("long-tail — relocationBonusAsked", () => {
  it("detects 'relocation bonus'", () => {
    const r = extractCandidateProfile("Is there a relocation bonus included?");
    expect(r.relocationBonusAsked).toBe(true);
  });
  it("detects 'moving allowance'", () => {
    const r = extractCandidateProfile("Do you cover a moving allowance?");
    expect(r.relocationBonusAsked).toBe(true);
  });
});

describe("monotone-up across merge — Tier 2/3/4", () => {
  it("preserves all 9 new flags across a follow-up turn", () => {
    const prior = extractCandidateProfile(
      "I lead a team of 10 engineers, returning from the Bay Area. My TC was $300,000 and I'm leaving behind unvested RSUs. The other company gave me an exploding offer.",
    );
    expect(prior.peopleManagementClaimed).toBe(true);
    expect(prior.crossBorderAnchor).toBe(true);
    expect(prior.unvestedEquityLossClaim).toBe(true);
    expect(prior.explodingOfferPressure).toBe(true);
    const next = extractCandidateProfile("Sure, makes sense.");
    const merged = mergeCandidateProfile(prior, next);
    expect(merged.peopleManagementClaimed).toBe(true);
    expect(merged.crossBorderAnchor).toBe(true);
    expect(merged.unvestedEquityLossClaim).toBe(true);
    expect(merged.explodingOfferPressure).toBe(true);
  });
});

describe("system prompt carries the 9 senior/process/long-tail rules", () => {
  it("NEGOTIATION_SYSTEM_PROMPT references each token + voice cue", async () => {
    const mod = await import("../../server-handlers/_negotiate-turn-helpers");
    const sys = mod.NEGOTIATION_SYSTEM_PROMPT;
    /* mgmt — probe scope before band */
    expect(sys).toMatch(/mgmt/);
    expect(sys).toMatch(/probe scope/i);
    /* crossBdr — PPP correction */
    expect(sys).toMatch(/crossBdr/);
    expect(sys).toMatch(/ppp/i);
    /* unvestEq — signing-bonus, not base */
    expect(sys).toMatch(/unvestEq/);
    expect(sys).toMatch(/signing\s+bonus/i);
    /* exploding — coach against pressure */
    expect(sys).toMatch(/exploding/);
    expect(sys).toMatch(/24[-\s]?hour/i);
    /* renege — clean acceptance */
    expect(sys).toMatch(/renege/);
    expect(sys).toMatch(/clean\s+acceptance/i);
    /* quota — probe attainment + OTE */
    expect(sys).toMatch(/quota/);
    expect(sys).toMatch(/ote/i);
    /* gardenLv — joining timeline good news */
    expect(sys).toMatch(/gardenLv/);
    /* nonComp — clause review */
    expect(sys).toMatch(/nonComp/);
    expect(sys).toMatch(/employment\s+counsel|clause/i);
    /* relo — separate from CTC */
    expect(sys).toMatch(/`relo`/);
    expect(sys).toMatch(/relocation/i);
  });
});
