/* Wave-4 deeper Indian scenarios (2026-05-14k) — 32 flags across five
 * tiers: high-frequency comp / process gaps (12), sensitive identity /
 * DEI (6), equity depth (5), contract / timing (5), and vertical
 * context (4).
 *
 * Each flag is utterance-detected, monotone-up across merge, surfaces
 * a compactTurnBrief token, and a dedicated NEGOTIATION_SYSTEM_PROMPT
 * rule. */
import { describe, expect, it } from "vitest";
import { extractCandidateProfile, mergeCandidateProfile } from "../../server-handlers/_candidate-profile";

/* ─── TIER A — HIGH-FREQUENCY COMP MECHANICS / PROCESS ──────────── */

describe("Wave-4 TIER-A — signOnClawback", () => {
  it("detects 'joining bonus clawback if I leave before 1 year'", () => {
    expect(extractCandidateProfile("Is there a joining bonus clawback if I leave before 1 year?").signOnClawback).toBe(true);
  });
  it("detects 'sign-on has 18-month tail'", () => {
    expect(extractCandidateProfile("The sign-on bonus has an 18-month tail.").signOnClawback).toBe(true);
  });
  it("detects 'JB recovery clause'", () => {
    expect(extractCandidateProfile("What's the JB recovery clause?").signOnClawback).toBe(true);
  });
});

describe("Wave-4 TIER-A — variableTrackRecord", () => {
  it("detects 'always hit 100% variable'", () => {
    expect(extractCandidateProfile("I always hit 100% variable.").variableTrackRecord).toBe(true);
  });
  it("detects 'consistently maxed my bonus'", () => {
    expect(extractCandidateProfile("Consistently maxed my bonus every cycle.").variableTrackRecord).toBe(true);
  });
  it("detects 'perfect variable payout history'", () => {
    expect(extractCandidateProfile("I have a perfect variable payout history.").variableTrackRecord).toBe(true);
  });
});

describe("Wave-4 TIER-A — wfhEquipmentStipend", () => {
  it("detects 'desk/chair stipend'", () => {
    expect(extractCandidateProfile("Do you give a desk or chair stipend?").wfhEquipmentStipend).toBe(true);
  });
  it("detects 'WFH setup allowance'", () => {
    expect(extractCandidateProfile("Is there a one-time WFH setup allowance?").wfhEquipmentStipend).toBe(true);
  });
  it("detects 'internet reimbursement'", () => {
    expect(extractCandidateProfile("Internet reimbursement available?").wfhEquipmentStipend).toBe(true);
  });
});

describe("Wave-4 TIER-A — salaryReviewCadenceAsk", () => {
  it("detects 'annual or semi-annual review'", () => {
    expect(extractCandidateProfile("Is it annual or semi-annual review?").salaryReviewCadenceAsk).toBe(true);
  });
  it("detects 'next appraisal'", () => {
    expect(extractCandidateProfile("When's the next appraisal?").salaryReviewCadenceAsk).toBe(true);
  });
  it("detects 'mid-year correction policy'", () => {
    expect(extractCandidateProfile("What's your mid-year correction policy?").salaryReviewCadenceAsk).toBe(true);
  });
});

describe("Wave-4 TIER-A — multipleOffersJuggling", () => {
  it("detects '3 active processes'", () => {
    expect(extractCandidateProfile("I have 3 active processes right now.").multipleOffersJuggling).toBe(true);
  });
  it("detects 'comparing 4 offers'", () => {
    expect(extractCandidateProfile("I'm comparing 4 offers.").multipleOffersJuggling).toBe(true);
  });
  it("detects 'final rounds with two other companies'", () => {
    expect(extractCandidateProfile("In final rounds with two other companies.").multipleOffersJuggling).toBe(true);
  });
});

describe("Wave-4 TIER-A — recruitmentAgencyMediation", () => {
  it("detects 'through ABC consultants'", () => {
    expect(extractCandidateProfile("I'm through ABC consultants.").recruitmentAgencyMediation).toBe(true);
  });
  it("detects 'placement agency'", () => {
    expect(extractCandidateProfile("The placement agency contacted me first.").recruitmentAgencyMediation).toBe(true);
  });
  it("detects 'Naukri RMS reached out'", () => {
    expect(extractCandidateProfile("Naukri RMS reached out to me.").recruitmentAgencyMediation).toBe(true);
  });
});

describe("Wave-4 TIER-A — internalTransferContext", () => {
  it("detects 'internal candidate'", () => {
    expect(extractCandidateProfile("I'm an internal candidate for this role.").internalTransferContext).toBe(true);
  });
  it("detects 'IJP'", () => {
    expect(extractCandidateProfile("Looking at an IJP within the company.").internalTransferContext).toBe(true);
  });
  it("detects 'transferring within the company'", () => {
    expect(extractCandidateProfile("Transferring within the company.").internalTransferContext).toBe(true);
  });
});

describe("Wave-4 TIER-A — offerRescindedHistory", () => {
  it("detects 'last offer was rescinded'", () => {
    expect(extractCandidateProfile("My last offer was rescinded.").offerRescindedHistory).toBe(true);
  });
  it("detects 'Cars24 pulled my offer'", () => {
    expect(extractCandidateProfile("Cars24 pulled my offer last year.").offerRescindedHistory).toBe(true);
  });
  it("detects 'joining was cancelled'", () => {
    expect(extractCandidateProfile("Joining was cancelled at the last minute.").offerRescindedHistory).toBe(true);
  });
});

describe("Wave-4 TIER-A — internationalDegreePremium", () => {
  it("detects 'Masters at Stanford'", () => {
    expect(extractCandidateProfile("I did my Masters at Stanford.").internationalDegreePremium).toBe(true);
  });
  it("detects 'Ivy League MBA'", () => {
    expect(extractCandidateProfile("I have an Ivy League MBA.").internationalDegreePremium).toBe(true);
  });
  it("detects 'INSEAD MBA'", () => {
    expect(extractCandidateProfile("I did my MBA at INSEAD.").internationalDegreePremium).toBe(true);
  });
});

describe("Wave-4 TIER-A — domesticTopMbaAnchor", () => {
  it("detects 'fresh out of IIM-A'", () => {
    expect(extractCandidateProfile("I'm fresh out of IIM-A.").domesticTopMbaAnchor).toBe(true);
  });
  it("detects 'ISB grad'", () => {
    expect(extractCandidateProfile("ISB grad, 2025 batch.").domesticTopMbaAnchor).toBe(true);
  });
  it("detects 'just graduated from XLRI'", () => {
    expect(extractCandidateProfile("Just graduated from XLRI.").domesticTopMbaAnchor).toBe(true);
  });
});

describe("Wave-4 TIER-A — toxicManagerContext", () => {
  it("detects 'my manager is the reason I'm leaving'", () => {
    expect(extractCandidateProfile("My manager is the reason I'm leaving.").toxicManagerContext).toBe(true);
  });
  it("detects 'toxic boss'", () => {
    expect(extractCandidateProfile("Honestly, a toxic boss situation.").toxicManagerContext).toBe(true);
  });
  it("detects 'leadership is the problem'", () => {
    expect(extractCandidateProfile("Leadership is the problem here.").toxicManagerContext).toBe(true);
  });
});

describe("Wave-4 TIER-A — visaSponsorshipNeed", () => {
  it("detects 'H1B sponsorship'", () => {
    expect(extractCandidateProfile("I need H1B sponsorship.").visaSponsorshipNeed).toBe(true);
  });
  it("detects 'OPT runs out'", () => {
    expect(extractCandidateProfile("My OPT runs out in 4 months.").visaSponsorshipNeed).toBe(true);
  });
  it("detects 'green card sponsorship'", () => {
    expect(extractCandidateProfile("Looking for green card sponsorship.").visaSponsorshipNeed).toBe(true);
  });
});

/* ─── TIER B — SENSITIVE IDENTITY / DEI ─────────────────────────── */

describe("Wave-4 TIER-B — casteReservationContext", () => {
  it("detects 'OBC category'", () => {
    expect(extractCandidateProfile("I'm applying under OBC category.").casteReservationContext).toBe(true);
  });
  it("detects 'SC reservation'", () => {
    expect(extractCandidateProfile("This is under SC reservation quota.").casteReservationContext).toBe(true);
  });
  it("detects 'scheduled tribe'", () => {
    expect(extractCandidateProfile("Scheduled tribe candidate.").casteReservationContext).toBe(true);
  });
});

describe("Wave-4 TIER-B — veteranTransition", () => {
  it("detects 'transitioning from the Army'", () => {
    expect(extractCandidateProfile("I'm transitioning from the Army.").veteranTransition).toBe(true);
  });
  it("detects 'ex-defence'", () => {
    expect(extractCandidateProfile("Ex-defence, looking for a lateral.").veteranTransition).toBe(true);
  });
  it("detects 'served in the military'", () => {
    expect(extractCandidateProfile("I served in the military for 12 years.").veteranTransition).toBe(true);
  });
});

describe("Wave-4 TIER-B — singleParentConstraint", () => {
  it("detects 'single parent'", () => {
    expect(extractCandidateProfile("I'm a single parent.").singleParentConstraint).toBe(true);
  });
  it("detects 'sole custody'", () => {
    expect(extractCandidateProfile("I have sole custody of my kids.").singleParentConstraint).toBe(true);
  });
  it("detects 'no co-parent'", () => {
    expect(extractCandidateProfile("No co-parent, so schedule flex matters.").singleParentConstraint).toBe(true);
  });
});

describe("Wave-4 TIER-B — jointFamilyFinancialResp", () => {
  it("detects 'supporting my parents financially'", () => {
    expect(extractCandidateProfile("I'm supporting my parents financially.").jointFamilyFinancialResp).toBe(true);
  });
  it("detects 'sole earner'", () => {
    expect(extractCandidateProfile("I'm the sole earner for the family.").jointFamilyFinancialResp).toBe(true);
  });
  it("detects 'household runs on my salary'", () => {
    expect(extractCandidateProfile("Household runs on my salary.").jointFamilyFinancialResp).toBe(true);
  });
});

describe("Wave-4 TIER-B — paternityLeaveAsk", () => {
  it("detects 'paternity policy'", () => {
    expect(extractCandidateProfile("What's your paternity policy?").paternityLeaveAsk).toBe(true);
  });
  it("detects 'paternity leave duration'", () => {
    expect(extractCandidateProfile("Paternity leave duration?").paternityLeaveAsk).toBe(true);
  });
  it("detects 'new-father benefits'", () => {
    expect(extractCandidateProfile("Any new-father benefits?").paternityLeaveAsk).toBe(true);
  });
});

describe("Wave-4 TIER-B — menstrualLeavePolicy", () => {
  it("detects 'menstrual leave policy'", () => {
    expect(extractCandidateProfile("What's the menstrual leave policy?").menstrualLeavePolicy).toBe(true);
  });
  it("detects 'period leave'", () => {
    expect(extractCandidateProfile("Do you offer period leave?").menstrualLeavePolicy).toBe(true);
  });
  it("detects 'Zomato-style menstrual leave'", () => {
    expect(extractCandidateProfile("Zomato-style menstrual leave?").menstrualLeavePolicy).toBe(true);
  });
});

/* ─── TIER C — EQUITY DEPTH ─────────────────────────────────────── */

describe("Wave-4 TIER-C — esopExerciseLoanAsk", () => {
  it("detects 'ESOP exercise loan'", () => {
    expect(extractCandidateProfile("Do you offer an ESOP exercise loan?").esopExerciseLoanAsk).toBe(true);
  });
  it("detects 'cashless exercise'", () => {
    expect(extractCandidateProfile("Cashless exercise option?").esopExerciseLoanAsk).toBe(true);
  });
  it("detects 'company-funded exercise'", () => {
    expect(extractCandidateProfile("Any company-funded exercise mechanism?").esopExerciseLoanAsk).toBe(true);
  });
});

describe("Wave-4 TIER-C — preIpoSecondaryAsk", () => {
  it("detects 'secondary sale opportunity'", () => {
    expect(extractCandidateProfile("Is there a secondary sale opportunity?").preIpoSecondaryAsk).toBe(true);
  });
  it("detects 'pre-IPO secondary'", () => {
    expect(extractCandidateProfile("Any pre-IPO secondary planned?").preIpoSecondaryAsk).toBe(true);
  });
  it("detects 'tender for early employees'", () => {
    expect(extractCandidateProfile("Any tender for early employees?").preIpoSecondaryAsk).toBe(true);
  });
});

describe("Wave-4 TIER-C — accelerationTriggerAsk", () => {
  it("detects 'single trigger acceleration'", () => {
    expect(extractCandidateProfile("Is it single trigger acceleration?").accelerationTriggerAsk).toBe(true);
  });
  it("detects 'double-trigger acceleration'", () => {
    expect(extractCandidateProfile("Double-trigger acceleration on change of control?").accelerationTriggerAsk).toBe(true);
  });
  it("detects 'acceleration clause'", () => {
    expect(extractCandidateProfile("What's the acceleration clause?").accelerationTriggerAsk).toBe(true);
  });
});

describe("Wave-4 TIER-C — esopPerquisiteTaxAsk", () => {
  it("detects 'Section 17(2) treatment'", () => {
    expect(extractCandidateProfile("Section 17(2) treatment on ESOP?").esopPerquisiteTaxAsk).toBe(true);
  });
  it("detects 'perquisite tax on exercise'", () => {
    expect(extractCandidateProfile("Perquisite tax on exercise?").esopPerquisiteTaxAsk).toBe(true);
  });
  it("detects 'TDS on ESOP exercise'", () => {
    expect(extractCandidateProfile("How is TDS on ESOP exercise handled?").esopPerquisiteTaxAsk).toBe(true);
  });
});

describe("Wave-4 TIER-C — tenderOfferCycleAsk", () => {
  it("detects 'next tender offer cycle'", () => {
    expect(extractCandidateProfile("When's the next tender offer cycle?").tenderOfferCycleAsk).toBe(true);
  });
  it("detects 'annual buyback'", () => {
    expect(extractCandidateProfile("Do you run an annual buyback?").tenderOfferCycleAsk).toBe(true);
  });
  it("detects 'ESOP buy-back cadence'", () => {
    expect(extractCandidateProfile("ESOP buy-back cadence?").tenderOfferCycleAsk).toBe(true);
  });
});

/* ─── TIER D — CONTRACT / TIMING ────────────────────────────────── */

describe("Wave-4 TIER-D — probationaryDurationAsk", () => {
  it("detects 'how long is probation'", () => {
    expect(extractCandidateProfile("How long is probation?").probationaryDurationAsk).toBe(true);
  });
  it("detects 'probation duration'", () => {
    expect(extractCandidateProfile("Probation duration?").probationaryDurationAsk).toBe(true);
  });
  it("detects '6-month vs 3-month probation'", () => {
    expect(extractCandidateProfile("Is it 6-month vs 3-month probation?").probationaryDurationAsk).toBe(true);
  });
});

describe("Wave-4 TIER-D — offerLetterTurnaroundDemand", () => {
  it("detects 'OL in 48 hours'", () => {
    expect(extractCandidateProfile("I need the OL in 48 hours.").offerLetterTurnaroundDemand).toBe(true);
  });
  it("detects 'when will I get the written offer'", () => {
    expect(extractCandidateProfile("When will I get the written offer?").offerLetterTurnaroundDemand).toBe(true);
  });
  it("detects 'offer-letter deadline'", () => {
    expect(extractCandidateProfile("There's an offer-letter deadline on my side.").offerLetterTurnaroundDemand).toBe(true);
  });
});

describe("Wave-4 TIER-D — contractToHireAsk", () => {
  it("detects 'contract-to-hire'", () => {
    expect(extractCandidateProfile("Is this contract-to-hire?").contractToHireAsk).toBe(true);
  });
  it("detects 'temp-to-perm timeline'", () => {
    expect(extractCandidateProfile("What's the temp-to-perm timeline?").contractToHireAsk).toBe(true);
  });
  it("detects 'convert to permanent'", () => {
    expect(extractCandidateProfile("When does it convert to permanent?").contractToHireAsk).toBe(true);
  });
});

describe("Wave-4 TIER-D — headcountApprovalCheck", () => {
  it("detects 'is the headcount approved'", () => {
    expect(extractCandidateProfile("Is the headcount approved?").headcountApprovalCheck).toBe(true);
  });
  it("detects 'HC budgeted'", () => {
    expect(extractCandidateProfile("Is the HC budgeted?").headcountApprovalCheck).toBe(true);
  });
  it("detects 'offers fall through on HC'", () => {
    expect(extractCandidateProfile("I've seen offers fall through on HC issues.").headcountApprovalCheck).toBe(true);
  });
});

describe("Wave-4 TIER-D — ipAssignmentClauseAsk", () => {
  it("detects 'IP assignment scope'", () => {
    expect(extractCandidateProfile("What's the IP assignment scope?").ipAssignmentClauseAsk).toBe(true);
  });
  it("detects 'own my side projects'", () => {
    expect(extractCandidateProfile("Do I own my side projects?").ipAssignmentClauseAsk).toBe(true);
  });
  it("detects 'moonlighting IP clause'", () => {
    expect(extractCandidateProfile("Concerned about the moonlighting IP clause.").ipAssignmentClauseAsk).toBe(true);
  });
});

/* ─── TIER E — VERTICAL CONTEXT ─────────────────────────────────── */

describe("Wave-4 TIER-E — healthcarePharmaContext", () => {
  it("detects 'Sun Pharma'", () => {
    expect(extractCandidateProfile("I'm at Sun Pharma in R&D.").healthcarePharmaContext).toBe(true);
  });
  it("detects 'API manufacturing'", () => {
    expect(extractCandidateProfile("API manufacturing background.").healthcarePharmaContext).toBe(true);
  });
  it("detects 'clinical trials background'", () => {
    expect(extractCandidateProfile("Coming from clinical trials background.").healthcarePharmaContext).toBe(true);
  });
});

describe("Wave-4 TIER-E — manufacturingCoreContext", () => {
  it("detects 'Tata Motors'", () => {
    expect(extractCandidateProfile("I'm at Tata Motors right now.").manufacturingCoreContext).toBe(true);
  });
  it("detects 'auto OEM'", () => {
    expect(extractCandidateProfile("Auto OEM background.").manufacturingCoreContext).toBe(true);
  });
  it("detects 'shop floor'", () => {
    expect(extractCandidateProfile("Shop floor manufacturing role.").manufacturingCoreContext).toBe(true);
  });
});

describe("Wave-4 TIER-E — quickCommerceContext", () => {
  it("detects 'Zepto'", () => {
    expect(extractCandidateProfile("I'm at Zepto.").quickCommerceContext).toBe(true);
  });
  it("detects 'Blinkit ops'", () => {
    expect(extractCandidateProfile("Blinkit ops, two years.").quickCommerceContext).toBe(true);
  });
  it("detects 'quick commerce / 10-minute delivery'", () => {
    expect(extractCandidateProfile("Quick commerce, 10-minute delivery.").quickCommerceContext).toBe(true);
  });
  it("detects 'dark stores'", () => {
    expect(extractCandidateProfile("Run dark stores in Bangalore.").quickCommerceContext).toBe(true);
  });
});

describe("Wave-4 TIER-E — d2cConsumerEquity", () => {
  it("detects 'Boat'", () => {
    expect(extractCandidateProfile("I'm at Boat in growth.").d2cConsumerEquity).toBe(true);
  });
  it("detects 'Mamaearth'", () => {
    expect(extractCandidateProfile("Mamaearth brand team.").d2cConsumerEquity).toBe(true);
  });
  it("detects 'D2C brand'", () => {
    expect(extractCandidateProfile("D2C brand background.").d2cConsumerEquity).toBe(true);
  });
});

/* ─── Dense composition & monotone-up ───────────────────────────── */

describe("Wave-4 — dense multi-flag composition", () => {
  it("fires 5+ Wave-4 flags across different tiers in a single utterance", () => {
    const p = extractCandidateProfile(
      "I'm an internal candidate (IJP) moving from Tata Motors. My manager is the reason I'm leaving. " +
      "I'm fresh out of IIM-A. Need H1B sponsorship. Also asking about double-trigger acceleration. " +
      "What's the menstrual leave policy?",
    );
    expect(p.internalTransferContext).toBe(true);
    expect(p.manufacturingCoreContext).toBe(true);
    expect(p.toxicManagerContext).toBe(true);
    expect(p.domesticTopMbaAnchor).toBe(true);
    expect(p.visaSponsorshipNeed).toBe(true);
    expect(p.accelerationTriggerAsk).toBe(true);
    expect(p.menstrualLeavePolicy).toBe(true);
  });
});

describe("Wave-4 — monotone-up merge", () => {
  it("preserves Wave-4 flags across a no-op second turn", () => {
    const prior = extractCandidateProfile(
      "I'm at Zepto in quick commerce. I need H1B sponsorship. " +
      "What's your paternity policy? Cashless exercise option? " +
      "I'm comparing 4 offers.",
    );
    expect(prior.quickCommerceContext).toBe(true);
    expect(prior.visaSponsorshipNeed).toBe(true);
    expect(prior.paternityLeaveAsk).toBe(true);
    expect(prior.esopExerciseLoanAsk).toBe(true);
    expect(prior.multipleOffersJuggling).toBe(true);
    const next = extractCandidateProfile("ok");
    const merged = mergeCandidateProfile(prior, next);
    expect(merged.quickCommerceContext).toBe(true);
    expect(merged.visaSponsorshipNeed).toBe(true);
    expect(merged.paternityLeaveAsk).toBe(true);
    expect(merged.esopExerciseLoanAsk).toBe(true);
    expect(merged.multipleOffersJuggling).toBe(true);
  });
});

/* ─── System prompt regression ──────────────────────────────────── */

describe("Wave-4 — system prompt carries all 32 new rules", () => {
  it("NEGOTIATION_SYSTEM_PROMPT references each Wave-4 token + voice cue", async () => {
    const mod = await import("../../server-handlers/_negotiate-turn-helpers");
    const sys = mod.NEGOTIATION_SYSTEM_PROMPT;
    /* Tier A — HIGH-FREQUENCY COMP MECHANICS / PROCESS */
    expect(sys).toMatch(/signClaw/);
    expect(sys).toMatch(/clawback/i);
    expect(sys).toMatch(/varTrack/);
    expect(sys).toMatch(/variable\s+(?:history|track)/i);
    expect(sys).toMatch(/wfhStipend/);
    expect(sys).toMatch(/setup\s+stipend/i);
    expect(sys).toMatch(/revCadence/);
    expect(sys).toMatch(/review\s+cycle/i);
    expect(sys).toMatch(/multiOffers/);
    expect(sys).toMatch(/comparison/i);
    expect(sys).toMatch(/\bagency\b/);
    expect(sys).toMatch(/consultant/i);
    expect(sys).toMatch(/intTransfer/);
    expect(sys).toMatch(/IJP|internal\s+band/i);
    expect(sys).toMatch(/offerResc/);
    expect(sys).toMatch(/rescinded/i);
    expect(sys).toMatch(/intlDegree/);
    expect(sys).toMatch(/premium.*India-priced/i);
    expect(sys).toMatch(/topMba/);
    expect(sys).toMatch(/MBA\s+fresher\s+band/i);
    expect(sys).toMatch(/toxicMgr/);
    expect(sys).toMatch(/validate\s+without\s+anchoring\s+down/i);
    expect(sys).toMatch(/\bvisa\b/);
    expect(sys).toMatch(/sponsorship/i);
    /* Tier B — SENSITIVE IDENTITY / DEI */
    expect(sys).toMatch(/casteRes/);
    expect(sys).toMatch(/respect.*category\s+disclosure/i);
    expect(sys).toMatch(/veteran/);
    expect(sys).toMatch(/lateral/i);
    expect(sys).toMatch(/singleParent/);
    expect(sys).toMatch(/schedule\s+flex/i);
    expect(sys).toMatch(/jointFamFin/);
    expect(sys).toMatch(/do\s+not\s+anchor\s+down/i);
    expect(sys).toMatch(/paternity/);
    expect(sys).toMatch(/policy\s+disclosure/i);
    expect(sys).toMatch(/menstrual/);
    /* Tier C — EQUITY DEPTH */
    expect(sys).toMatch(/esopLoan/);
    expect(sys).toMatch(/exercise\s+loan/i);
    expect(sys).toMatch(/secondary/);
    expect(sys).toMatch(/accelTrig/);
    expect(sys).toMatch(/double-trigger/i);
    expect(sys).toMatch(/esopTax/);
    expect(sys).toMatch(/perquisite\s+tax/i);
    expect(sys).toMatch(/tenderCycle/);
    expect(sys).toMatch(/buyback/i);
    /* Tier D — CONTRACT / TIMING */
    expect(sys).toMatch(/probDur/);
    expect(sys).toMatch(/probation\s+length/i);
    expect(sys).toMatch(/olTurnaround/);
    expect(sys).toMatch(/OL\s+turnaround/i);
    expect(sys).toMatch(/\bc2h\b/);
    expect(sys).toMatch(/contract-to-hire/i);
    expect(sys).toMatch(/hcApproval/);
    expect(sys).toMatch(/headcount/i);
    expect(sys).toMatch(/ipClause/);
    expect(sys).toMatch(/IP\s+scope/i);
    /* Tier E — VERTICAL CONTEXT */
    expect(sys).toMatch(/pharma/);
    expect(sys).toMatch(/pharma\s+band/i);
    expect(sys).toMatch(/mfgCore/);
    expect(sys).toMatch(/core\s+engineering\s+band/i);
    expect(sys).toMatch(/qcom/);
    expect(sys).toMatch(/quick-commerce\s+equity/i);
    expect(sys).toMatch(/d2c/);
    expect(sys).toMatch(/D2C\s+(?:brand|consumer)/i);
  });
});
