/* Wave-3 deeper Indian scenarios (2026-05-14j) — 25 flags across four
 * blocks: identity / title / sensitive disclosures (7), history /
 * relationship / retention (6), domain / vertical voice (7), and
 * process / coaching surface (5).
 *
 * Each flag is utterance-detected, monotone-up across merge, surfaces
 * a compactTurnBrief token, and a dedicated NEGOTIATION_SYSTEM_PROMPT
 * rule. */
import { describe, expect, it } from "vitest";
import { extractCandidateProfile, mergeCandidateProfile } from "../../server-handlers/_candidate-profile";

/* ─── BLOCK 1 — IDENTITY / TITLE / SENSITIVE ────────────────────── */

describe("Wave-3 IDENTITY — titlePrecisionAsk", () => {
  it("detects 'exact designation'", () => {
    expect(extractCandidateProfile("What's the exact designation?").titlePrecisionAsk).toBe(true);
  });
  it("detects 'SDE-2 or Senior SDE'", () => {
    expect(extractCandidateProfile("Is it SDE-2 or Senior SDE?").titlePrecisionAsk).toBe(true);
  });
  it("detects 'M5 or M6 level'", () => {
    expect(extractCandidateProfile("Is this M5 or M6 level?").titlePrecisionAsk).toBe(true);
  });
});

describe("Wave-3 IDENTITY — currentCtcRefusal", () => {
  it("detects 'prefer not to share'", () => {
    expect(extractCandidateProfile("I'd prefer not to share my current CTC.").currentCtcRefusal).toBe(true);
  });
  it("detects 'not comfortable disclosing'", () => {
    expect(extractCandidateProfile("I'm not comfortable disclosing my package.").currentCtcRefusal).toBe(true);
  });
  it("detects 'rather not say'", () => {
    expect(extractCandidateProfile("Rather not say my current package.").currentCtcRefusal).toBe(true);
  });
});

describe("Wave-3 IDENTITY — pregnancyDisclosed", () => {
  it("detects 'I'm pregnant'", () => {
    expect(extractCandidateProfile("I'm pregnant — wanted to share early.").pregnancyDisclosed).toBe(true);
  });
  it("detects 'maternity leave imminent'", () => {
    expect(extractCandidateProfile("My maternity leave is imminent.").pregnancyDisclosed).toBe(true);
  });
  it("detects 'second trimester'", () => {
    expect(extractCandidateProfile("I'm in my second trimester.").pregnancyDisclosed).toBe(true);
  });
});

describe("Wave-3 IDENTITY — pwdDisability", () => {
  it("detects 'hearing impairment'", () => {
    expect(extractCandidateProfile("I have a hearing impairment.").pwdDisability).toBe(true);
  });
  it("detects 'wheelchair accessible'", () => {
    expect(extractCandidateProfile("Is the office wheelchair accessible?").pwdDisability).toBe(true);
  });
  it("detects 'PWD candidate'", () => {
    expect(extractCandidateProfile("I'm a PWD candidate.").pwdDisability).toBe(true);
  });
});

describe("Wave-3 IDENTITY — lgbtqDisclosure", () => {
  it("detects 'same-sex partner'", () => {
    expect(extractCandidateProfile("Do partner benefits cover my same-sex partner?").lgbtqDisclosure).toBe(true);
  });
  it("detects 'LGBTQ+'", () => {
    expect(extractCandidateProfile("How LGBTQ+ inclusive is the team?").lgbtqDisclosure).toBe(true);
  });
});

describe("Wave-3 IDENTITY — chronicIllnessDisclosed", () => {
  it("detects 'chronic illness'", () => {
    expect(extractCandidateProfile("I have a chronic illness.").chronicIllnessDisclosed).toBe(true);
  });
  it("detects 'cancer survivor'", () => {
    expect(extractCandidateProfile("I'm a cancer survivor.").chronicIllnessDisclosed).toBe(true);
  });
  it("detects 'autoimmune'", () => {
    expect(extractCandidateProfile("I have an autoimmune condition.").chronicIllnessDisclosed).toBe(true);
  });
});

describe("Wave-3 IDENTITY — dietaryReligiousNeed", () => {
  it("detects 'Jain food'", () => {
    expect(extractCandidateProfile("Do you have Jain food options?").dietaryReligiousNeed).toBe(true);
  });
  it("detects 'Friday prayers'", () => {
    expect(extractCandidateProfile("I need flexibility for Friday prayers.").dietaryReligiousNeed).toBe(true);
  });
  it("detects 'halal'", () => {
    expect(extractCandidateProfile("Is halal food available in the cafeteria?").dietaryReligiousNeed).toBe(true);
  });
});

/* ─── BLOCK 2 — HISTORY / RELATIONSHIP / RETENTION ──────────────── */

describe("Wave-3 HISTORY — boomerangRehire", () => {
  it("detects 'worked here before'", () => {
    expect(extractCandidateProfile("I worked here before — left in 2021.").boomerangRehire).toBe(true);
  });
  it("detects 'boomerang hire'", () => {
    expect(extractCandidateProfile("I'm a boomerang hire.").boomerangRehire).toBe(true);
  });
  it("detects 'rejoining after 3 years'", () => {
    expect(extractCandidateProfile("Rejoining after 3 years away.").boomerangRehire).toBe(true);
  });
});

describe("Wave-3 HISTORY — referralReceived", () => {
  it("detects 'Priya referred me'", () => {
    expect(extractCandidateProfile("Priya referred me to this role.").referralReceived).toBe(true);
  });
  it("detects 'employee referral'", () => {
    expect(extractCandidateProfile("This was an employee referral.").referralReceived).toBe(true);
  });
  it("detects 'got an internal referral'", () => {
    expect(extractCandidateProfile("I got an internal referral.").referralReceived).toBe(true);
  });
});

describe("Wave-3 HISTORY — hometownReturnPreference", () => {
  it("detects 'back to my hometown'", () => {
    expect(extractCandidateProfile("Want to go back to my hometown.").hometownReturnPreference).toBe(true);
  });
  it("detects 'move closer to family in Indore'", () => {
    expect(extractCandidateProfile("I want to move closer to family in Indore.").hometownReturnPreference).toBe(true);
  });
  it("detects 'Coimbatore'", () => {
    expect(extractCandidateProfile("Looking to relocate to Coimbatore.").hometownReturnPreference).toBe(true);
  });
});

describe("Wave-3 HISTORY — gratuityVestingNear", () => {
  it("detects 'lose gratuity'", () => {
    expect(extractCandidateProfile("I'll lose gratuity if I leave now.").gratuityVestingNear).toBe(true);
  });
  it("detects 'almost 5 years for gratuity'", () => {
    expect(extractCandidateProfile("Almost 5 years here — gratuity nearly vested.").gratuityVestingNear).toBe(true);
  });
  it("detects '4.7 years tenure'", () => {
    expect(extractCandidateProfile("I'm at 4.7 years tenure — close to gratuity completion.").gratuityVestingNear).toBe(true);
  });
});

describe("Wave-3 HISTORY — acquisitionContextAsk", () => {
  it("detects 'are you being acquired'", () => {
    expect(extractCandidateProfile("Are you being acquired?").acquisitionContextAsk).toBe(true);
  });
  it("detects 'M&A talks'", () => {
    expect(extractCandidateProfile("I heard about the M&A talks.").acquisitionContextAsk).toBe(true);
  });
  it("detects 'post-acquisition retention'", () => {
    expect(extractCandidateProfile("What's the post-acquisition retention plan?").acquisitionContextAsk).toBe(true);
  });
});

describe("Wave-3 HISTORY — acquiHireContext", () => {
  it("detects 'company is being acquired'", () => {
    expect(extractCandidateProfile("My current company is being acquired.").acquiHireContext).toBe(true);
  });
  it("detects 'acqui-hire'", () => {
    expect(extractCandidateProfile("It's an acqui-hire situation.").acquiHireContext).toBe(true);
  });
  it("detects 'winding down'", () => {
    expect(extractCandidateProfile("My current startup is winding down.").acquiHireContext).toBe(true);
  });
});

/* ─── BLOCK 3 — DOMAIN / VERTICAL VOICE ─────────────────────────── */

describe("Wave-3 DOMAIN — bfsiClawbackContext", () => {
  it("detects 'bonus locked till March'", () => {
    expect(extractCandidateProfile("My bonus is locked till March.").bfsiClawbackContext).toBe(true);
  });
  it("detects 'joining bonus clawback'", () => {
    expect(extractCandidateProfile("Is there joining bonus clawback if I leave under 1 year?").bfsiClawbackContext).toBe(true);
  });
  it("detects 'deferred comp clawback'", () => {
    expect(extractCandidateProfile("My deferred comp clawback is significant.").bfsiClawbackContext).toBe(true);
  });
});

describe("Wave-3 DOMAIN — bigFourGradeStep", () => {
  it("detects 'Deloitte'", () => {
    expect(extractCandidateProfile("I'm at Deloitte as Senior Consultant.").bigFourGradeStep).toBe(true);
  });
  it("detects 'S2 to M1 lateral'", () => {
    expect(extractCandidateProfile("Looking for an S2 to M1 lateral.").bigFourGradeStep).toBe(true);
  });
  it("detects 'EY Manager'", () => {
    expect(extractCandidateProfile("Currently EY Manager grade step.").bigFourGradeStep).toBe(true);
  });
});

describe("Wave-3 DOMAIN — securityClearanceNeeded", () => {
  it("detects 'security clearance'", () => {
    expect(extractCandidateProfile("Do I need security clearance for this?").securityClearanceNeeded).toBe(true);
  });
  it("detects 'DRDO project'", () => {
    expect(extractCandidateProfile("Coming from a DRDO project.").securityClearanceNeeded).toBe(true);
  });
  it("detects 'DoD clearance'", () => {
    expect(extractCandidateProfile("I have a DoD clearance.").securityClearanceNeeded).toBe(true);
  });
});

describe("Wave-3 DOMAIN — missionDrivenComp", () => {
  it("detects 'mission-aligned'", () => {
    expect(extractCandidateProfile("I'm mission-aligned, willing to take below-market.").missionDrivenComp).toBe(true);
  });
  it("detects 'climate / pay cut'", () => {
    expect(extractCandidateProfile("Climate work — happy with a pay cut for the cause.").missionDrivenComp).toBe(true);
  });
  it("detects 'NGO / open to lower'", () => {
    expect(extractCandidateProfile("NGO work — I'm open to lower comp.").missionDrivenComp).toBe(true);
  });
});

describe("Wave-3 DOMAIN — edtechReputationCheck", () => {
  it("detects 'Byju's debacle'", () => {
    expect(extractCandidateProfile("I'm worried after the Byju's debacle.").edtechReputationCheck).toBe(true);
  });
  it("detects 'Unacademy layoffs'", () => {
    expect(extractCandidateProfile("Are you laying off like Unacademy did?").edtechReputationCheck).toBe(true);
  });
  it("detects 'edtech stability'", () => {
    expect(extractCandidateProfile("How's edtech stability looking?").edtechReputationCheck).toBe(true);
  });
});

describe("Wave-3 DOMAIN — cabinParkingAsk", () => {
  it("detects 'cabin'", () => {
    expect(extractCandidateProfile("Do I get a cabin at this level?").cabinParkingAsk).toBe(true);
  });
  it("detects 'dedicated parking'", () => {
    expect(extractCandidateProfile("Is dedicated parking included?").cabinParkingAsk).toBe(true);
  });
  it("detects 'company car'", () => {
    expect(extractCandidateProfile("Is there a company car at this band?").cabinParkingAsk).toBe(true);
  });
});

describe("Wave-3 DOMAIN — spanOfControlAsk", () => {
  it("detects 'span of control'", () => {
    expect(extractCandidateProfile("What's my span of control?").spanOfControlAsk).toBe(true);
  });
  it("detects 'how many reports'", () => {
    expect(extractCandidateProfile("How many reports will I have?").spanOfControlAsk).toBe(true);
  });
  it("detects 'org chart'", () => {
    expect(extractCandidateProfile("Can you share the org chart?").spanOfControlAsk).toBe(true);
  });
});

/* ─── BLOCK 4 — PROCESS / COACHING SURFACE ──────────────────────── */

describe("Wave-3 PROCESS — noticeBuyoutAsk", () => {
  it("detects 'buy out my notice'", () => {
    expect(extractCandidateProfile("Can you buy out my notice period?").noticeBuyoutAsk).toBe(true);
  });
  it("detects 'notice buyout amount'", () => {
    expect(extractCandidateProfile("What's the notice buyout amount?").noticeBuyoutAsk).toBe(true);
  });
  it("detects '90-day notice cover the shortfall'", () => {
    expect(extractCandidateProfile("90-day notice — can you cover the shortfall?").noticeBuyoutAsk).toBe(true);
  });
});

describe("Wave-3 PROCESS — preResignationStealth", () => {
  it("detects 'they don't know I'm interviewing'", () => {
    expect(extractCandidateProfile("They don't know I'm interviewing.").preResignationStealth).toBe(true);
  });
  it("detects 'stealth job search'", () => {
    expect(extractCandidateProfile("This is a stealth job search.").preResignationStealth).toBe(true);
  });
  it("detects 'keeping confidential'", () => {
    expect(extractCandidateProfile("Keeping the search confidential.").preResignationStealth).toBe(true);
  });
});

describe("Wave-3 PROCESS — reverseAnchorAsk", () => {
  it("detects 'what's your budget'", () => {
    expect(extractCandidateProfile("What's your budget for this role?").reverseAnchorAsk).toBe(true);
  });
  it("detects 'you tell me'", () => {
    expect(extractCandidateProfile("You tell me — what would you offer?").reverseAnchorAsk).toBe(true);
  });
  it("detects 'what range did you have in mind'", () => {
    expect(extractCandidateProfile("What range did you have in mind?").reverseAnchorAsk).toBe(true);
  });
});

describe("Wave-3 PROCESS — oldEmployerDocsIssue", () => {
  it("detects 'ex-employer hasn't given relieving letter'", () => {
    expect(extractCandidateProfile("Ex-employer hasn't given the relieving letter.").oldEmployerDocsIssue).toBe(true);
  });
  it("detects 'lost my payslips'", () => {
    expect(extractCandidateProfile("I lost my payslips from that role.").oldEmployerDocsIssue).toBe(true);
  });
  it("detects 'company shut down so no docs'", () => {
    expect(extractCandidateProfile("Company shut down — I have no relieving documents.").oldEmployerDocsIssue).toBe(true);
  });
});

describe("Wave-3 PROCESS — equityRefreshCadenceAsk", () => {
  it("detects 'next RSU grant'", () => {
    expect(extractCandidateProfile("When do I get my next RSU grant?").equityRefreshCadenceAsk).toBe(true);
  });
  it("detects 'annual refresh policy'", () => {
    expect(extractCandidateProfile("What's the annual refresh policy?").equityRefreshCadenceAsk).toBe(true);
  });
  it("detects 'promotion top-up'", () => {
    expect(extractCandidateProfile("Is there a promotion top-up grant?").equityRefreshCadenceAsk).toBe(true);
  });
});

/* ─── Dense composition & monotone-up ───────────────────────────── */

describe("Wave-3 — dense multi-flag composition", () => {
  it("fires 5+ Wave-3 flags in a single dense utterance", () => {
    const p = extractCandidateProfile(
      "I'd prefer not to share my current CTC. I'm a boomerang hire — worked here before. " +
      "Priya referred me. Can you buy out my notice period? Also what's your budget for this role?",
    );
    expect(p.currentCtcRefusal).toBe(true);
    expect(p.boomerangRehire).toBe(true);
    expect(p.referralReceived).toBe(true);
    expect(p.noticeBuyoutAsk).toBe(true);
    expect(p.reverseAnchorAsk).toBe(true);
  });
});

describe("Wave-3 — monotone-up merge", () => {
  it("preserves Wave-3 flags across a no-op second turn", () => {
    const prior = extractCandidateProfile(
      "I have a hearing impairment. Looking to move back to my hometown. " +
      "I'm at Deloitte as Senior Consultant — looking at an S2 to M1 lateral. " +
      "What's the annual refresh policy?",
    );
    expect(prior.pwdDisability).toBe(true);
    expect(prior.hometownReturnPreference).toBe(true);
    expect(prior.bigFourGradeStep).toBe(true);
    expect(prior.equityRefreshCadenceAsk).toBe(true);
    const next = extractCandidateProfile("ok");
    const merged = mergeCandidateProfile(prior, next);
    expect(merged.pwdDisability).toBe(true);
    expect(merged.hometownReturnPreference).toBe(true);
    expect(merged.bigFourGradeStep).toBe(true);
    expect(merged.equityRefreshCadenceAsk).toBe(true);
  });
});

/* ─── System prompt regression ──────────────────────────────────── */

describe("Wave-3 — system prompt carries all 25 new rules", () => {
  it("NEGOTIATION_SYSTEM_PROMPT references each Wave-3 token + voice cue", async () => {
    const mod = await import("../../server-handlers/_negotiate-turn-helpers");
    const sys = mod.NEGOTIATION_SYSTEM_PROMPT;
    /* Block 5 — IDENTITY / TITLE / SENSITIVE */
    expect(sys).toMatch(/titlePrec/);
    expect(sys).toMatch(/designation|grade/i);
    expect(sys).toMatch(/ctcRefuse/);
    expect(sys).toMatch(/respect.*refusal|refusal/i);
    expect(sys).toMatch(/pregnancy/);
    expect(sys).toMatch(/do not anchor down/i);
    expect(sys).toMatch(/pwd/);
    expect(sys).toMatch(/accommodation/i);
    expect(sys).toMatch(/lgbtq/);
    expect(sys).toMatch(/partner benefits/i);
    expect(sys).toMatch(/chronicIll/);
    expect(sys).toMatch(/eap/i);
    expect(sys).toMatch(/dietary/);
    /* Block 6 — HISTORY / RELATIONSHIP / RETENTION */
    expect(sys).toMatch(/boomerang/);
    expect(sys).toMatch(/rehire-eligibility/i);
    expect(sys).toMatch(/referral/);
    expect(sys).toMatch(/referral-bonus/i);
    expect(sys).toMatch(/hometown/);
    expect(sys).toMatch(/tier-?2 city/i);
    expect(sys).toMatch(/gratuityNear/);
    expect(sys).toMatch(/gratuity/i);
    expect(sys).toMatch(/acqAsk/);
    expect(sys).toMatch(/m&a/i);
    expect(sys).toMatch(/acquiHire/);
    expect(sys).toMatch(/acqui-hire|acquired/i);
    /* Block 7 — DOMAIN / VERTICAL */
    expect(sys).toMatch(/bfsiClaw/);
    expect(sys).toMatch(/clawback/i);
    expect(sys).toMatch(/big4Step/);
    expect(sys).toMatch(/grade step/i);
    expect(sys).toMatch(/secClear/);
    expect(sys).toMatch(/clearance/i);
    expect(sys).toMatch(/mission/);
    expect(sys).toMatch(/mission-aligned/i);
    expect(sys).toMatch(/lowball/i);
    expect(sys).toMatch(/edtechRep/);
    expect(sys).toMatch(/stability/i);
    expect(sys).toMatch(/cabin/);
    expect(sys).toMatch(/perk/i);
    expect(sys).toMatch(/spanCtrl/);
    expect(sys).toMatch(/span of control/i);
    /* Block 8 — PROCESS / COACHING */
    expect(sys).toMatch(/noticeBO/);
    expect(sys).toMatch(/notice buyout/i);
    expect(sys).toMatch(/stealth/);
    expect(sys).toMatch(/confidentiality/i);
    expect(sys).toMatch(/revAnchor/);
    expect(sys).toMatch(/do not anchor first/i);
    expect(sys).toMatch(/oldEmpDocs/);
    expect(sys).toMatch(/relieving letter|bgv/i);
    expect(sys).toMatch(/equityRefresh/);
    expect(sys).toMatch(/refresh cadence|refresh policy/i);
  });
});
