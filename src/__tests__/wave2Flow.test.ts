/* Wave-2 deeper Indian scenarios (2026-05-14i) — 20 flags spanning
 * the four blocks of real-world Indian negotiation surface area not
 * covered by Tier 1-4:
 *
 *  Block 1 — BENEFITS / TAX / TAKE-HOME:
 *    parentInsuranceAsked, inHandTakehomeFocus, rtoPushback,
 *    returnshipMaternity, payBandAsked, taxStructureAsked
 *  Block 2 — LIFE-CONTEXT:
 *    spouseJobConstraint, agingParentCare
 *  Block 3 — MECHANICS:
 *    bgvAnxiety, esopSophisticationProbe, moonlightingDisclosed,
 *    mentalHealthDisclosed, payParityAsked, preemptiveCounterReceived,
 *    acceptanceTimeRequest
 *  Block 4 — MODERN / EDGE:
 *    cryptoTokenComp, gccArbitrageAnchor, benchTimeDisclosed,
 *    founderSecondInnings, latecareerAgeBias
 *
 * Each flag is utterance-detected, monotone-up across merge, surfaces
 * a compactTurnBrief token, and a dedicated NEGOTIATION_SYSTEM_PROMPT
 * rule. */
import { describe, expect, it } from "vitest";
import { extractCandidateProfile, mergeCandidateProfile } from "../../server-handlers/_candidate-profile";

describe("Wave-2 BENEFITS — parentInsuranceAsked", () => {
  it("detects 'parent insurance cover'", () => {
    expect(extractCandidateProfile("Does the medical cover my parents?").parentInsuranceAsked).toBe(true);
  });
  it("detects 'family floater'", () => {
    expect(extractCandidateProfile("What's the family floater amount?").parentInsuranceAsked).toBe(true);
  });
  it("detects 'OPD coverage'", () => {
    expect(extractCandidateProfile("Is OPD coverage included?").parentInsuranceAsked).toBe(true);
  });
});

describe("Wave-2 BENEFITS — inHandTakehomeFocus", () => {
  it("detects 'in-hand salary'", () => {
    expect(extractCandidateProfile("What will be my in-hand salary?").inHandTakehomeFocus).toBe(true);
  });
  it("detects 'monthly take-home'", () => {
    expect(extractCandidateProfile("Need to understand monthly take-home.").inHandTakehomeFocus).toBe(true);
  });
  it("detects 'CTC vs in-hand'", () => {
    expect(extractCandidateProfile("Help me understand CTC vs in-hand.").inHandTakehomeFocus).toBe(true);
  });
});

describe("Wave-2 BENEFITS — rtoPushback", () => {
  it("detects 'return-to-office mandate'", () => {
    expect(extractCandidateProfile("I'm not OK with a return-to-office mandate.").rtoPushback).toBe(true);
  });
  it("detects 'promised WFH'", () => {
    expect(extractCandidateProfile("I was promised WFH at my current company.").rtoPushback).toBe(true);
  });
  it("detects '5 days in office'", () => {
    expect(extractCandidateProfile("Is this 5 days in the office?").rtoPushback).toBe(true);
  });
});

describe("Wave-2 BENEFITS — returnshipMaternity", () => {
  it("detects 'returning from maternity'", () => {
    expect(extractCandidateProfile("I'm returning to work after maternity.").returnshipMaternity).toBe(true);
  });
  it("detects 'maternity break of 14 months'", () => {
    expect(extractCandidateProfile("I had a maternity break of 14 months.").returnshipMaternity).toBe(true);
  });
  it("detects 'returnship program'", () => {
    expect(extractCandidateProfile("Do you have a returnship program?").returnshipMaternity).toBe(true);
  });
});

describe("Wave-2 BENEFITS — payBandAsked", () => {
  it("detects 'pay band for the level'", () => {
    expect(extractCandidateProfile("What's the pay band for this level?").payBandAsked).toBe(true);
  });
  it("detects 'top of the band'", () => {
    expect(extractCandidateProfile("Can you tell me the top of the band?").payBandAsked).toBe(true);
  });
  it("detects 'levels.fyi data'", () => {
    expect(extractCandidateProfile("Levels.fyi data says the range is higher.").payBandAsked).toBe(true);
  });
});

describe("Wave-2 BENEFITS — taxStructureAsked", () => {
  it("detects 'HRA'", () => {
    expect(extractCandidateProfile("Can you maximise HRA in the structure?").taxStructureAsked).toBe(true);
  });
  it("detects 'FBP / flexi benefits'", () => {
    expect(extractCandidateProfile("Do you offer FBP?").taxStructureAsked).toBe(true);
  });
  it("detects 'NPS / 80C'", () => {
    expect(extractCandidateProfile("Is there an NPS option for 80CCD?").taxStructureAsked).toBe(true);
  });
});

describe("Wave-2 LIFE-CONTEXT — spouseJobConstraint", () => {
  it("detects 'wife works in Pune'", () => {
    expect(extractCandidateProfile("My wife works in Pune so I can't relocate to Delhi.").spouseJobConstraint).toBe(true);
  });
  it("detects 'dual-career'", () => {
    expect(extractCandidateProfile("We're a dual-career household.").spouseJobConstraint).toBe(true);
  });
});

describe("Wave-2 LIFE-CONTEXT — agingParentCare", () => {
  it("detects 'aging parents'", () => {
    expect(extractCandidateProfile("I have aging parents to take care of.").agingParentCare).toBe(true);
  });
  it("detects 'looking after my mother'", () => {
    expect(extractCandidateProfile("Looking after my mother — need WFH flexibility.").agingParentCare).toBe(true);
  });
});

describe("Wave-2 MECHANICS — bgvAnxiety", () => {
  it("detects 'don't call my current manager'", () => {
    expect(extractCandidateProfile("Please don't call my current manager.").bgvAnxiety).toBe(true);
  });
  it("detects 'worried about BGV'", () => {
    expect(extractCandidateProfile("I'm worried about the BGV process.").bgvAnxiety).toBe(true);
  });
  it("detects 'correspondence degree'", () => {
    expect(extractCandidateProfile("My degree is correspondence — will that be a problem?").bgvAnxiety).toBe(true);
  });
});

describe("Wave-2 MECHANICS — esopSophisticationProbe", () => {
  it("detects '409A / FMV'", () => {
    expect(extractCandidateProfile("What's your latest 409A?").esopSophisticationProbe).toBe(true);
  });
  it("detects 'double-trigger acceleration'", () => {
    expect(extractCandidateProfile("Is there double-trigger acceleration?").esopSophisticationProbe).toBe(true);
  });
  it("detects 'exercise window'", () => {
    expect(extractCandidateProfile("What's the post-termination exercise window?").esopSophisticationProbe).toBe(true);
  });
});

describe("Wave-2 MECHANICS — moonlightingDisclosed", () => {
  it("detects 'moonlighting policy'", () => {
    expect(extractCandidateProfile("What's your moonlighting policy?").moonlightingDisclosed).toBe(true);
  });
  it("detects 'YouTube channel'", () => {
    expect(extractCandidateProfile("Can I keep my YouTube channel?").moonlightingDisclosed).toBe(true);
  });
});

describe("Wave-2 MECHANICS — mentalHealthDisclosed", () => {
  it("detects 'burnout'", () => {
    expect(extractCandidateProfile("I'm recovering from burnout.").mentalHealthDisclosed).toBe(true);
  });
  it("detects 'therapy reimbursement'", () => {
    expect(extractCandidateProfile("Do you cover therapy reimbursement?").mentalHealthDisclosed).toBe(true);
  });
  it("detects 'EAP'", () => {
    expect(extractCandidateProfile("Does the company have an EAP?").mentalHealthDisclosed).toBe(true);
  });
});

describe("Wave-2 MECHANICS — payParityAsked", () => {
  it("detects 'pay equity'", () => {
    expect(extractCandidateProfile("What's your pay equity policy?").payParityAsked).toBe(true);
  });
  it("detects 'gender pay gap'", () => {
    expect(extractCandidateProfile("Have you audited your gender pay gap?").payParityAsked).toBe(true);
  });
});

describe("Wave-2 MECHANICS — preemptiveCounterReceived", () => {
  it("detects 'my current company gave me a counter'", () => {
    expect(extractCandidateProfile("My current company gave me a counter-offer.").preemptiveCounterReceived).toBe(true);
  });
  it("detects 'got a promotion to keep me'", () => {
    expect(extractCandidateProfile("Got a promotion last week to keep me.").preemptiveCounterReceived).toBe(true);
  });
});

describe("Wave-2 MECHANICS — acceptanceTimeRequest", () => {
  it("detects 'a week to decide'", () => {
    expect(extractCandidateProfile("Can I have a week to decide?").acceptanceTimeRequest).toBe(true);
  });
  it("detects 'need some time to think'", () => {
    expect(extractCandidateProfile("Need some time to think it over.").acceptanceTimeRequest).toBe(true);
  });
});

describe("Wave-2 EDGE — cryptoTokenComp", () => {
  it("detects 'paid in USDT'", () => {
    expect(extractCandidateProfile("Can I be partially paid in USDT?").cryptoTokenComp).toBe(true);
  });
  it("detects 'token allocation'", () => {
    expect(extractCandidateProfile("Is there a token allocation as part of comp?").cryptoTokenComp).toBe(true);
  });
});

describe("Wave-2 EDGE — gccArbitrageAnchor", () => {
  it("detects 'GCC / captive center'", () => {
    expect(extractCandidateProfile("I work at a US GCC in Bangalore.").gccArbitrageAnchor).toBe(true);
  });
  it("detects 'parent co in the US'", () => {
    expect(extractCandidateProfile("My parent company is in the US — what's the salary parity?").gccArbitrageAnchor).toBe(true);
  });
});

describe("Wave-2 EDGE — benchTimeDisclosed", () => {
  it("detects 'on the bench'", () => {
    expect(extractCandidateProfile("I've been on the bench for 4 months.").benchTimeDisclosed).toBe(true);
  });
  it("detects 'between projects'", () => {
    expect(extractCandidateProfile("Currently between projects at my current employer.").benchTimeDisclosed).toBe(true);
  });
});

describe("Wave-2 EDGE — founderSecondInnings", () => {
  it("detects 'was a founder'", () => {
    expect(extractCandidateProfile("I was a co-founder at a startup that didn't work out.").founderSecondInnings).toBe(true);
  });
  it("detects 'took no salary'", () => {
    expect(extractCandidateProfile("I drew zero salary for 18 months as founder.").founderSecondInnings).toBe(true);
  });
});

describe("Wave-2 EDGE — latecareerAgeBias", () => {
  it("detects 'too senior'", () => {
    expect(extractCandidateProfile("Am I too senior for this role?").latecareerAgeBias).toBe(true);
  });
  it("detects 'fit with a younger team'", () => {
    expect(extractCandidateProfile("Will I fit in with a younger team?").latecareerAgeBias).toBe(true);
  });
});

describe("Wave-2 — monotone-up + multi-flag composition", () => {
  it("preserves all flags across turns and handles dense disclosure", () => {
    const prior = extractCandidateProfile(
      "I'm returning from maternity, my wife works in Pune so I need WFH, what's the pay band for this level? Also can you cover my parents in the medical?",
    );
    expect(prior.returnshipMaternity).toBe(true);
    expect(prior.spouseJobConstraint).toBe(true);
    expect(prior.rtoPushback).toBe(false); // no explicit RTO pushback wording
    expect(prior.payBandAsked).toBe(true);
    expect(prior.parentInsuranceAsked).toBe(true);
    const next = extractCandidateProfile("Will my in-hand be enough? Need a week to decide.");
    const merged = mergeCandidateProfile(prior, next);
    expect(merged.returnshipMaternity).toBe(true);
    expect(merged.spouseJobConstraint).toBe(true);
    expect(merged.payBandAsked).toBe(true);
    expect(merged.parentInsuranceAsked).toBe(true);
    expect(merged.inHandTakehomeFocus).toBe(true);
    expect(merged.acceptanceTimeRequest).toBe(true);
  });
});

describe("Wave-2 — system prompt carries all 20 new rules", () => {
  it("NEGOTIATION_SYSTEM_PROMPT references each Wave-2 token", async () => {
    const mod = await import("../../server-handlers/_negotiate-turn-helpers");
    const sys = mod.NEGOTIATION_SYSTEM_PROMPT;
    /* Block 1 — benefits / tax / take-home */
    expect(sys).toMatch(/parentIns/);
    expect(sys).toMatch(/floater/i);
    expect(sys).toMatch(/inHand/);
    expect(sys).toMatch(/CTC.*in-hand|in-hand.*CTC/i);
    expect(sys).toMatch(/taxStruct/);
    expect(sys).toMatch(/hra/i);
    expect(sys).toMatch(/payBand/);
    expect(sys).toMatch(/level-range|band/i);
    expect(sys).toMatch(/`rto`/);
    /* Block 2 — life context */
    expect(sys).toMatch(/matReturn/);
    expect(sys).toMatch(/maternity/i);
    expect(sys).toMatch(/spouse/);
    expect(sys).toMatch(/parentCare/);
    expect(sys).toMatch(/ageBias/);
    /* Block 3 — mechanics */
    expect(sys).toMatch(/esopProbe/);
    expect(sys).toMatch(/409A/i);
    expect(sys).toMatch(/precounter/);
    expect(sys).toMatch(/acceptTime/);
    expect(sys).toMatch(/payParity/);
    expect(sys).toMatch(/`bgv`/);
    /* Block 4 — modern / edge */
    expect(sys).toMatch(/moonlight/);
    expect(sys).toMatch(/mentalHlth/);
    expect(sys).toMatch(/eap/i);
    expect(sys).toMatch(/`crypto`/);
    expect(sys).toMatch(/vda|usdt/i);
    expect(sys).toMatch(/`gcc`/);
    expect(sys).toMatch(/`bench`/);
    expect(sys).toMatch(/`founder`/);
  });
});
