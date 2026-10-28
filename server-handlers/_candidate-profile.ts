import { type CandidateProfileResult, type CareerGapActivity, EMPTY_CANDIDATE_PROFILE } from "./_candidate-profile-types";
import { GAP_ACTIVITY_PATTERNS, detectAcceptanceTimeRequest, detectAgingParentCare, detectBenchTimeDisclosed, detectBgvAnxiety, detectCompBreakupUnknown, detectCompensationHistoryIssue, detectCrossBorderAnchor, detectCryptoTokenComp, detectCulturalJoiningConstraint, detectDomainPivot, detectEarlySwitcher, detectEsopSophisticationProbe, detectExplodingOfferPressure, detectFounderSecondInnings, detectGardenLeaveDisclosed, detectGccArbitrageAnchor, detectHotDomainPremium, detectInternshipConversion, detectLatecareerAgeBias, detectLowCtcAlert, detectMentalHealthDisclosed, detectMncExperience, detectMoonlightingDisclosed, detectNonCompeteFlagged, detectPayBandAsked, detectPayParityAsked, detectPeopleManagementClaimed, detectPipDisclosed, detectPostAcceptanceRenege, detectPreemptiveCounterReceived, detectPriorInternshipNonConversion, detectProbationComp, detectQuotaAttainmentClaimed, detectRecentLayoff, detectRelocationBonusAsked, detectReturnshipMaternity, detectServiceBond, detectServiceCompanyBackground, detectSpouseJobConstraint, detectTaxStructureAsked, detectUnvestedEquityLossClaim, detectVerbalOnlyOffer, extractGapMonths, extractLevelMismatch, extractTenureSignal } from "./_candidate-profile-detectors-a";
import { detectAccelerationTriggerAsk, detectAcquiHireContext, detectAcquisitionContextAsk, detectAskedAboutGrowthPath, detectAskedAboutGrowthPath8, detectAskedAboutReporting, detectAskedAboutTeamSize, detectBfsiClawbackContext, detectBigFourGradeStep, detectBoomerangRehire, detectCabinParkingAsk, detectCasteReservationContext, detectChronicIllnessDisclosed, detectCollegeTier, detectCompetingOfferAmount, detectContractToHireAsk, detectCounterOfferRisk, detectCurrentCtcRefusal, detectD2cConsumerEquity, detectDeflectedOnRange, detectDietaryReligiousNeed, detectDomesticTopMbaAnchor, detectEdtechReputationCheck, detectEquityBuybackLiquidityAsk, detectEquityCliffPeriodAsk, detectEquityExerciseTermsAsk, detectEquityRefreshCadenceAsk, detectEquityVestingScheduleAsk, detectEsopExerciseLoanAsk, detectEsopPerquisiteTaxAsk, detectEvasiveOnCurrentCtc, detectGaveInconsistentNumbers, detectGaveRangeNotPoint, detectGratuityVestingNear, detectHeadcountApprovalCheck, detectHealthcarePharmaContext, detectHometownReturnPreference, detectInternalTransferContext, detectInternationalDegreePremium, detectInvokedCompetingOffer, detectIpAssignmentClauseAsk, detectJointFamilyFinancialResp, detectLgbtqDisclosure, detectManufacturingCoreContext, detectMenstrualLeavePolicy, detectMentionedBgvConcern, detectMentionedForm16, detectMentionedMoonlighting, detectMentionedSpouseFamily, detectMentionedTaxImplication, detectMissionDrivenComp, detectMultipleOffersJuggling, detectNoticeBuyoutAsk, detectOfferLetterTurnaroundDemand, detectOfferRescindedHistory, detectOldEmployerDocsIssue, detectPaternityLeaveAsk, detectPreIpoSecondaryAsk, detectPreResignationStealth, detectPregnancyDisclosed, detectProbationaryDurationAsk, detectPwdDisability, detectQuickCommerceContext, detectRecruitmentAgencyMediation, detectReferencedMarketData, detectReferencedMarketDataSources, detectReferralReceived, detectReverseAnchorAsk, detectSalaryReviewCadenceAsk, detectSecurityClearanceNeeded, detectSignOnClawback, detectSingleParentConstraint, detectSpanOfControlAsk, detectTenderOfferCycleAsk, detectTitlePrecisionAsk, detectToxicManagerContext, detectVariableTrackRecord, detectVeteranTransition, detectVisaSponsorshipNeed, detectWantsFlexibleWork, detectWantsHigherBase, detectWantsJoiningBonus, detectWantsRelocationAllowance, detectWfhEquipmentStipend } from "./_candidate-profile-detectors-b";
import { detectCompetingOffersDisclosed, detectCurrentCtcDisclosed, detectFixedVariableSplitDisclosed, detectInHandSalaryDisclosed, detectNoticePeriodDisclosed, detectValueProofProvided } from "./_candidate-profile-tail";
export { EMPTY_CANDIDATE_PROFILE, SPECIAL_PERSONAL_DATA_FLAGS, redactCandidateProfileForLogs, redactForAnalytics } from "./_candidate-profile-types";
export type { CandidateProfileResult, CareerGapActivity, CollegeTier, CompensationHistoryIssue, LevelMismatch, TenureSignal } from "./_candidate-profile-types";
export { detectCollegeTier, detectFreshGradDisclosure, detectReferencedMarketDataSources, marketDataSources } from "./_candidate-profile-detectors-b";
export { __ADJACENT_INTERNAL, __DOMAIN_KEYWORDS_INTERNAL, computeApplicableYoe, detectCompetingOffersDisclosed, detectCurrentCtcDisclosed, detectFixedVariableSplitDisclosed, detectInHandSalaryDisclosed, detectNoticePeriodDisclosed, detectValueProofProvided, experienceLevelFromYoe, mergeCandidateProfile } from "./_candidate-profile-tail";
export type { ApplicableYoeRelation, ApplicableYoeResult } from "./_candidate-profile-tail";
import { runRegistry } from "./_candidate-profile-registry";

/* Candidate-profile parser — Phase 17B (2026-05-13).
 *
 * The 19-scenario audit surfaced three adjacent candidate-background
 * signals that materially affect how a recruiter frames the offer:
 *
 *   16. Career gap — "I had a 1-year break for upskilling". Pre-Phase-17
 *       the kernel had no state for this; the LLM had to re-derive it
 *       from the transcript every turn and routinely missed the gap-
 *       justification activity.
 *
 *   17. Frequent job changes — "I've switched 4 times in 5 years". A
 *       recruiter pushback that materially affects offer framing (often
 *       reduces joining-bonus willingness due to retention risk). No
 *       state captured the switch cadence.
 *
 *   18/19. Over/under-qualified — "I'm overqualified but want this for
 *          the domain" / "I'm short on YOE but my skills match". Real
 *          recruiters always probe this; without state, the AI couldn't
 *          adapt its push-back style (over-q → "will you get bored?";
 *          under-q → "are you open to lower level?").
 *
 * All three are conservative parsers — the cost of a false positive is
 * silently teaching the kernel a candidate background that wasn't
 * stated. */

/* ─── Wave kill-switches (launch-blocker, 2026-05-14) ──────────────
 *
 * Each wave of profile flags can be disabled independently via env
 * vars on Vercel. When a wave is disabled, its flags are forced to
 * `false` in extractCandidateProfile, regardless of utterance content,
 * before the result is returned. This gives ops a no-deploy rollback
 * if a wave starts mis-firing in production.
 *
 *   HSX_DISABLE_WAVE_2=1 — disables the 20 Wave-2 flags
 *     (parentInsurance, inHand, rto, returnship, payBand, taxStruct,
 *      bgvAnxiety, esopSoph, spouseJob, agingParent, moonlighting,
 *      mentalHealth, payParity, preemptCounter, acceptTime, crypto,
 *      gccArb, benchTime, founderSecond, latecareerAge).
 *   HSX_DISABLE_WAVE_3=1 — disables the 25 Wave-3 flags.
 *   HSX_DISABLE_WAVE_4=1 — disables the 32 Wave-4 flags.
 *
 * Resolved at module-evaluation time. Tests use vi.stubEnv +
 * vi.resetModules() to flip values between runs. */
declare const process: { env: Record<string, string | undefined> };
const DISABLE_WAVE_2 = process.env.HSX_DISABLE_WAVE_2 === "1";
const DISABLE_WAVE_3 = process.env.HSX_DISABLE_WAVE_3 === "1";
const DISABLE_WAVE_4 = process.env.HSX_DISABLE_WAVE_4 === "1";
const DISABLE_WAVE_6 = process.env.HSX_DISABLE_WAVE_6 === "1";
const DISABLE_WAVE_7 = process.env.HSX_DISABLE_WAVE_7 === "1";
const DISABLE_WAVE_8 = process.env.HSX_DISABLE_WAVE_8 === "1";
const DISABLE_WAVE_9 = process.env.HSX_DISABLE_WAVE_9 === "1";

/** Wave-2 flag names — boolean fields zeroed when HSX_DISABLE_WAVE_2=1. */
const WAVE_2_FLAGS: ReadonlyArray<string> = [
  "parentInsuranceAsked", "inHandTakehomeFocus", "rtoPushback",
  "returnshipMaternity", "payBandAsked", "taxStructureAsked",
  "bgvAnxiety", "esopSophisticationProbe", "spouseJobConstraint",
  "agingParentCare", "moonlightingDisclosed", "mentalHealthDisclosed",
  "payParityAsked", "preemptiveCounterReceived", "acceptanceTimeRequest",
  "cryptoTokenComp", "gccArbitrageAnchor", "benchTimeDisclosed",
  "founderSecondInnings", "latecareerAgeBias",
];

/** Wave-3 flag names — boolean fields zeroed when HSX_DISABLE_WAVE_3=1. */
const WAVE_3_FLAGS: ReadonlyArray<string> = [
  "titlePrecisionAsk", "currentCtcRefusal", "pregnancyDisclosed",
  "boomerangRehire", "referralReceived", "hometownReturnPreference",
  "pwdDisability", "gratuityVestingNear", "acquisitionContextAsk",
  "lgbtqDisclosure", "chronicIllnessDisclosed", "noticeBuyoutAsk",
  "bfsiClawbackContext", "bigFourGradeStep", "securityClearanceNeeded",
  "missionDrivenComp", "edtechReputationCheck", "acquiHireContext",
  "cabinParkingAsk", "spanOfControlAsk", "preResignationStealth",
  "reverseAnchorAsk", "dietaryReligiousNeed", "oldEmployerDocsIssue",
  "equityRefreshCadenceAsk",
  /* Wave-3D (PDF #17 follow-up, 2026-05-15) — equity-instrument depth. */
  "equityVestingScheduleAsk", "equityCliffPeriodAsk",
  "equityExerciseTermsAsk", "equityBuybackLiquidityAsk",
];

/** Wave-6 flag names — boolean fields zeroed when HSX_DISABLE_WAVE_6=1. */
const WAVE_6_FLAGS: ReadonlyArray<string> = [
  "currentHasBonus", "currentHasEsop", "currentEsopVested",
  "currentHasRetentionBonus", "currentHasGratuity", "currentHasNps",
  "wantsHigherBase", "wantsHigherBonus", "wantsJoiningBonus",
  "wantsRelocationAllowance", "wantsFlexibleWork", "wantsLearningBudget",
  "wantsEquityRefresh", "wantsProfessionalTitle",
  "hasSeenOffer", "offerDeadlineMentioned",
  "negotiatingMultipleOffers", "prefersCashOverPerks", "perksImportant",
];

/** Wave-7 flag names — boolean fields zeroed when HSX_DISABLE_WAVE_7=1. */
const WAVE_7_FLAGS: ReadonlyArray<string> = [
  "anchoredFirst", "anchorWasHighball", "retreatedFromAnchor",
  "acceptedCounterQuickly", "respondedToBudgetCeiling",
  "pushedBackOnCeiling", "invokedCompetingOffer", "expressedUrgency",
  "expressedHesitation", "usedRecruiterName", "saidThankYou",
  "askedAboutTeam", "askedAboutGrowthPath", "askedAboutWorkLifeBalance",
  "gaveInconsistentNumbers", "evasiveOnCurrentCtc", "dramaticAnchorJump",
  "mentionedCounterOffer", "mentionedLayoffRisk", "seemsRushed",
];

/** Wave-8 flag names — boolean fields zeroed when HSX_DISABLE_WAVE_8=1.
 * Offer-response behavior + financial specifics + role clarity + competing-offer
 * specifics (the flags the task session calls "Wave-6 expansion"). */
const WAVE_8_FLAGS: ReadonlyArray<string> = [
  /* Offer-response behavior */
  "explicitlyRejectedOffer", "askedForTimeToDecide",
  "mentionedSpouseFamily", "mentionedRelocation",
  /* Financial specifics */
  "mentionedPf", "mentionedGratuity", "mentionedForm16",
  "mentionedVariablePayout", "mentionedSigningBonus",
  "mentionedRetentionBonus", "mentionedJoiningBonus",
  /* Role clarity */
  "askedAboutReporting", "askedAboutTeamSize",
  "askedAboutPerformanceCycle", "mentionedTargetRole",
  /* Competing-offer specifics */
  "competingOfferIsVerbal",
];

/** Wave-9 flag names — boolean fields zeroed when HSX_DISABLE_WAVE_9=1.
 * Psychological/behavioral + Indian doc/process + seniority/career stage +
 * negotiation strategy signals (the flags the task session calls "Wave-7 expansion"). */
const WAVE_9_FLAGS: ReadonlyArray<string> = [
  /* Psychological/behavioral */
  "showedFrustration", "showedExcitement", "usedSilence",
  "backtrackedOnExpectation", "escalatedDemand",
  /* Indian-specific doc/process */
  "mentionedBgvConcern", "mentionedRelievingLetterRisk",
  "mentionedNoticeWaiver", "mentionedNoticeBuyout",
  "mentionedMoonlighting",
  /* Seniority/career stage */
  "isFirstJobChange", "hasManagementExperience",
  "mentionedStartupExperience", "mentionedMncExperience",
  "hasPhdOrMba",
  /* Negotiation strategy signals */
  "usedAnchorFirst", "gaveRangeNotPoint", "deflectedOnRange",
  "referencedMarketData", "mentionedCostOfLiving",
  "mentionedTaxImplication",
];

/** Wave-4 flag names — boolean fields zeroed when HSX_DISABLE_WAVE_4=1. */
const WAVE_4_FLAGS: ReadonlyArray<string> = [
  "signOnClawback", "variableTrackRecord", "wfhEquipmentStipend",
  "salaryReviewCadenceAsk", "multipleOffersJuggling",
  "recruitmentAgencyMediation", "internalTransferContext",
  "offerRescindedHistory", "internationalDegreePremium",
  "domesticTopMbaAnchor", "toxicManagerContext", "visaSponsorshipNeed",
  "casteReservationContext", "veteranTransition", "singleParentConstraint",
  "jointFamilyFinancialResp", "paternityLeaveAsk", "menstrualLeavePolicy",
  "esopExerciseLoanAsk", "preIpoSecondaryAsk", "accelerationTriggerAsk",
  "esopPerquisiteTaxAsk", "tenderOfferCycleAsk",
  "probationaryDurationAsk", "offerLetterTurnaroundDemand",
  "contractToHireAsk", "headcountApprovalCheck", "ipAssignmentClauseAsk",
  "healthcarePharmaContext", "manufacturingCoreContext",
  "quickCommerceContext", "d2cConsumerEquity",
];

/** Exported for tests so the wave-membership lists are auditable. */
export const __WAVE_FLAGS_INTERNAL = {
  wave2: WAVE_2_FLAGS,
  wave3: WAVE_3_FLAGS,
  wave4: WAVE_4_FLAGS,
  wave6: WAVE_6_FLAGS,
  wave7: WAVE_7_FLAGS,
  wave8: WAVE_8_FLAGS,
  wave9: WAVE_9_FLAGS,
};

/** Read the kill-switch env vars at call time (not module-load) so
 *  tests can flip env between runs without resetModules. */
function readWaveDisables(): { w2: boolean; w3: boolean; w4: boolean; w6: boolean; w7: boolean; w8: boolean; w9: boolean } {
  return {
    w2: process.env.HSX_DISABLE_WAVE_2 === "1" || DISABLE_WAVE_2,
    w3: process.env.HSX_DISABLE_WAVE_3 === "1" || DISABLE_WAVE_3,
    w4: process.env.HSX_DISABLE_WAVE_4 === "1" || DISABLE_WAVE_4,
    w6: process.env.HSX_DISABLE_WAVE_6 === "1" || DISABLE_WAVE_6,
    w7: process.env.HSX_DISABLE_WAVE_7 === "1" || DISABLE_WAVE_7,
    w8: process.env.HSX_DISABLE_WAVE_8 === "1" || DISABLE_WAVE_8,
    w9: process.env.HSX_DISABLE_WAVE_9 === "1" || DISABLE_WAVE_9,
  };
}

function applyWaveDisables(result: CandidateProfileResult): CandidateProfileResult {
  const { w2, w3, w4, w6, w7, w8, w9 } = readWaveDisables();
  if (!w2 && !w3 && !w4 && !w6 && !w7 && !w8 && !w9) return result;
  // Wave flag names are typed per-field on CandidateProfileResult; writing by
  // dynamic key (WAVE_N_FLAGS) needs the index-signature view.
  const out = result as unknown as Record<string, unknown>;
  if (w2) for (const k of WAVE_2_FLAGS) out[k] = false;
  if (w3) for (const k of WAVE_3_FLAGS) out[k] = false;
  if (w4) for (const k of WAVE_4_FLAGS) out[k] = false;
  if (w6) for (const k of WAVE_6_FLAGS) out[k] = false;
  if (w7) for (const k of WAVE_7_FLAGS) out[k] = false;
  if (w8) for (const k of WAVE_8_FLAGS) out[k] = false;
  if (w9) for (const k of WAVE_9_FLAGS) out[k] = false;
  /* Recompute hasAny against the zeroed flags so downstream code sees
   * consistent state. We check a small union — any non-null/true value
   * across the remaining surface. */
  // Cast back now that the dynamic-key writes above are done.
  const r = out as unknown as CandidateProfileResult;
  r.hasAny =
    r.careerGapMonths != null ||
    r.careerGapActivity != null ||
    r.tenureSignal != null ||
    r.levelMismatch != null ||
    r.domainPivot ||
    r.transferableSkillsClaimed ||
    r.compensationHistoryIssue != null ||
    r.serviceBondAccepted ||
    r.probationCompMentioned ||
    r.internshipConversion ||
    r.collegeTier != null ||
    r.earlySwitcher ||
    r.lowCtcAlert ||
    r.priorInternshipNonConversion ||
    r.serviceCompanyBackground ||
    r.compBreakupUnknown ||
    r.recentLayoff ||
    r.hotDomainPremium ||
    r.pipDisclosed ||
    r.verbalOnlyOffer ||
    r.culturalJoiningConstraint ||
    r.peopleManagementClaimed ||
    r.mncExperience ||
    r.crossBorderAnchor ||
    r.unvestedEquityLossClaim ||
    r.explodingOfferPressure ||
    r.postAcceptanceRenege ||
    r.quotaAttainmentClaimed ||
    r.gardenLeaveDisclosed ||
    r.nonCompeteFlagged ||
    r.relocationBonusAsked ||
    (!w2 && (
      r.parentInsuranceAsked || r.inHandTakehomeFocus || r.rtoPushback ||
      r.returnshipMaternity || r.payBandAsked || r.taxStructureAsked ||
      r.bgvAnxiety || r.esopSophisticationProbe || r.spouseJobConstraint ||
      r.agingParentCare || r.moonlightingDisclosed || r.mentalHealthDisclosed ||
      r.payParityAsked || r.preemptiveCounterReceived || r.acceptanceTimeRequest ||
      r.cryptoTokenComp || r.gccArbitrageAnchor || r.benchTimeDisclosed ||
      r.founderSecondInnings || r.latecareerAgeBias
    )) ||
    (!w3 && (
      r.titlePrecisionAsk || r.currentCtcRefusal || r.pregnancyDisclosed ||
      r.boomerangRehire || r.referralReceived || r.hometownReturnPreference ||
      r.pwdDisability || r.gratuityVestingNear || r.acquisitionContextAsk ||
      r.lgbtqDisclosure || r.chronicIllnessDisclosed || r.noticeBuyoutAsk ||
      r.bfsiClawbackContext || r.bigFourGradeStep || r.securityClearanceNeeded ||
      r.missionDrivenComp || r.edtechReputationCheck || r.acquiHireContext ||
      r.cabinParkingAsk || r.spanOfControlAsk || r.preResignationStealth ||
      r.reverseAnchorAsk || r.dietaryReligiousNeed || r.oldEmployerDocsIssue ||
      r.equityRefreshCadenceAsk ||
      r.equityVestingScheduleAsk || r.equityCliffPeriodAsk ||
      r.equityExerciseTermsAsk || r.equityBuybackLiquidityAsk
    )) ||
    (!w4 && (
      r.signOnClawback || r.variableTrackRecord || r.wfhEquipmentStipend ||
      r.salaryReviewCadenceAsk || r.multipleOffersJuggling ||
      r.recruitmentAgencyMediation || r.internalTransferContext ||
      r.offerRescindedHistory || r.internationalDegreePremium ||
      r.domesticTopMbaAnchor || r.toxicManagerContext || r.visaSponsorshipNeed ||
      r.casteReservationContext || r.veteranTransition || r.singleParentConstraint ||
      r.jointFamilyFinancialResp || r.paternityLeaveAsk || r.menstrualLeavePolicy ||
      r.esopExerciseLoanAsk || r.preIpoSecondaryAsk || r.accelerationTriggerAsk ||
      r.esopPerquisiteTaxAsk || r.tenderOfferCycleAsk ||
      r.probationaryDurationAsk || r.offerLetterTurnaroundDemand ||
      r.contractToHireAsk || r.headcountApprovalCheck || r.ipAssignmentClauseAsk ||
      r.healthcarePharmaContext || r.manufacturingCoreContext ||
      r.quickCommerceContext || r.d2cConsumerEquity
    )) ||
    (!w6 && (
      r.wantsHigherBase || r.wantsJoiningBonus || r.wantsRelocationAllowance ||
      r.wantsFlexibleWork
    )) ||
    (!w7 && (
      r.invokedCompetingOffer || r.askedAboutGrowthPath || r.gaveInconsistentNumbers || r.evasiveOnCurrentCtc
    )) ||
    (!w8 && (
      r.mentionedSpouseFamily || r.mentionedForm16 ||
      r.askedAboutReporting || r.askedAboutTeamSize || r.askedAboutGrowthPath8 ||
      r.competingOfferAmount != null
    )) ||
    (!w9 && (
      r.mentionedBgvConcern || r.mentionedMoonlighting ||
      r.gaveRangeNotPoint || r.deflectedOnRange ||
      r.referencedMarketData || r.mentionedTaxImplication
    ));
  return r;
}


export function extractCandidateProfile(text: string): CandidateProfileResult {
  if (!text) return EMPTY_CANDIDATE_PROFILE;

  const careerGapMonths = extractGapMonths(text);
  /* Activity only counted when there's a gap context OR the activity
   * phrase carries its own gap connotation (e.g. "during my break I
   * was upskilling"). To avoid false positives on "I'm currently
   * upskilling on the side", require a gap signal nearby. */
  let careerGapActivity: CareerGapActivity | null = null;
  const gapContext =
    careerGapMonths != null ||
    /\b(?:during\s+(?:my\s+|the\s+)?(?:break|gap|hiatus|sabbatical|time\s+off)|in\s+the\s+(?:gap|break)|while\s+(?:i\s+was\s+)?(?:off|on\s+break))\b/i.test(text);
  if (gapContext) {
    for (const { kind, pattern } of GAP_ACTIVITY_PATTERNS) {
      if (pattern.test(text)) {
        careerGapActivity = kind;
        break;
      }
    }
  }

  const tenureSignal = extractTenureSignal(text);
  const levelMismatch = extractLevelMismatch(text);
  const { domainPivot, transferableSkillsClaimed } = detectDomainPivot(text);
  const compensationHistoryIssue = detectCompensationHistoryIssue(text);
  const serviceBondAccepted = detectServiceBond(text);
  const probationCompMentioned = detectProbationComp(text);
  const internshipConversion = detectInternshipConversion(text);
  const collegeTier = detectCollegeTier(text);
  /* Junior-flow (2026-05-14e) — four 0-2 YoE signals. */
  const earlySwitcher = detectEarlySwitcher(text);
  const lowCtcAlert = detectLowCtcAlert(text);
  const priorInternshipNonConversion = detectPriorInternshipNonConversion(text, internshipConversion);
  const serviceCompanyBackground = detectServiceCompanyBackground(text);
  /* Mid-level flow (2026-05-14f) — comp-literacy signal. */
  const compBreakupUnknown = detectCompBreakupUnknown(text);
  /* Real-world Indian extensions (2026-05-14g). */
  const recentLayoff = detectRecentLayoff(text);
  const hotDomainPremium = detectHotDomainPremium(text);
  const pipDisclosed = detectPipDisclosed(text);
  const verbalOnlyOffer = detectVerbalOnlyOffer(text);
  const culturalJoiningConstraint = detectCulturalJoiningConstraint(text);
  /* Senior + process + long-tail (2026-05-14h). */
  const peopleManagementClaimed = detectPeopleManagementClaimed(text);
  const mncExperience = detectMncExperience(text);
  const crossBorderAnchor = detectCrossBorderAnchor(text);
  const unvestedEquityLossClaim = detectUnvestedEquityLossClaim(text);
  const explodingOfferPressure = detectExplodingOfferPressure(text);
  const postAcceptanceRenege = detectPostAcceptanceRenege(text);
  const quotaAttainmentClaimed = detectQuotaAttainmentClaimed(text);
  const gardenLeaveDisclosed = detectGardenLeaveDisclosed(text);
  const nonCompeteFlagged = detectNonCompeteFlagged(text);
  const relocationBonusAsked = detectRelocationBonusAsked(text);
  /* Wave-2 (2026-05-14i) — 20 deeper signals.
   *
   * Wave-2A SHADOW → PRIMARY cutover (2026-05-21). The three flags
   * below (parentInsuranceAsked, inHandTakehomeFocus, rtoPushback) used
   * to be computed by direct detector calls AND parallel-registered in
   * the wave-flag registry for shadow parity. The parity contract test
   * (`candidateProfileRegistry.test.ts`) ran green for the entire SHADOW
   * window. Switching to read from the registry output here removes the
   * dual-write — the registered `detect:` references still point at the
   * same module-local functions, so behaviour is byte-identical to
   * SHADOW mode. The parity test now becomes a tautological backstop
   * that prevents accidental drift if either path is later modified
   * independently. */
  const __wave2aRegistry = runRegistry(text);
  const parentInsuranceAsked = Boolean(__wave2aRegistry.parentInsuranceAsked);
  const inHandTakehomeFocus = Boolean(__wave2aRegistry.inHandTakehomeFocus);
  const rtoPushback = Boolean(__wave2aRegistry.rtoPushback);
  const returnshipMaternity = detectReturnshipMaternity(text);
  const payBandAsked = detectPayBandAsked(text);
  const taxStructureAsked = detectTaxStructureAsked(text);
  const bgvAnxiety = detectBgvAnxiety(text);
  const esopSophisticationProbe = detectEsopSophisticationProbe(text);
  const spouseJobConstraint = detectSpouseJobConstraint(text);
  const agingParentCare = detectAgingParentCare(text);
  /* Wave-2B SHADOW parity-assert (2026-05-21). Legacy direct-call values
   * above remain canonical; the registry is registered in parallel and
   * checked here. The contract test enforces byte-for-byte parity across
   * the adversarial corpus; this dev-only assert surfaces drift fast if
   * either path is later modified. Cutover to PRIMARY happens in a
   * separate commit after the soak window. */
  if (process.env.NODE_ENV !== "production") {
    const __wave2bRegistry = runRegistry(text);
    console.assert(
      taxStructureAsked === Boolean(__wave2bRegistry.taxStructureAsked),
      "wave-2b drift: taxStructureAsked",
    );
    console.assert(
      bgvAnxiety === Boolean(__wave2bRegistry.bgvAnxiety),
      "wave-2b drift: bgvAnxiety",
    );
    console.assert(
      esopSophisticationProbe === Boolean(__wave2bRegistry.esopSophisticationProbe),
      "wave-2b drift: esopSophisticationProbe",
    );
    console.assert(
      spouseJobConstraint === Boolean(__wave2bRegistry.spouseJobConstraint),
      "wave-2b drift: spouseJobConstraint",
    );
    console.assert(
      agingParentCare === Boolean(__wave2bRegistry.agingParentCare),
      "wave-2b drift: agingParentCare",
    );
  }
  const moonlightingDisclosed = detectMoonlightingDisclosed(text);
  const mentalHealthDisclosed = detectMentalHealthDisclosed(text);
  const payParityAsked = detectPayParityAsked(text);
  const preemptiveCounterReceived = detectPreemptiveCounterReceived(text);
  const acceptanceTimeRequest = detectAcceptanceTimeRequest(text);
  /* Wave-2C SHADOW parity-assert (2026-05-22). Legacy direct-call values
   * above remain canonical; the registry is registered in parallel and
   * checked here. The contract test enforces byte-for-byte parity across
   * the adversarial corpus; this dev-only assert surfaces drift fast if
   * either path is later modified. Cutover to PRIMARY happens in a
   * separate commit after the soak window. */
  if (process.env.NODE_ENV !== "production") {
    const __wave2cRegistry = runRegistry(text);
    console.assert(
      moonlightingDisclosed === Boolean(__wave2cRegistry.moonlightingDisclosed),
      "wave-2c drift: moonlightingDisclosed",
    );
    console.assert(
      mentalHealthDisclosed === Boolean(__wave2cRegistry.mentalHealthDisclosed),
      "wave-2c drift: mentalHealthDisclosed",
    );
    console.assert(
      payParityAsked === Boolean(__wave2cRegistry.payParityAsked),
      "wave-2c drift: payParityAsked",
    );
    console.assert(
      preemptiveCounterReceived === Boolean(__wave2cRegistry.preemptiveCounterReceived),
      "wave-2c drift: preemptiveCounterReceived",
    );
    console.assert(
      acceptanceTimeRequest === Boolean(__wave2cRegistry.acceptanceTimeRequest),
      "wave-2c drift: acceptanceTimeRequest",
    );
  }
  const cryptoTokenComp = detectCryptoTokenComp(text);
  const gccArbitrageAnchor = detectGccArbitrageAnchor(text);
  const benchTimeDisclosed = detectBenchTimeDisclosed(text);
  const founderSecondInnings = detectFounderSecondInnings(text);
  const latecareerAgeBias = detectLatecareerAgeBias(text);
  /* Wave-2D SHADOW parity-assert (2026-05-22). Legacy direct-call values
   * above remain canonical; the registry is registered in parallel and
   * checked here. The contract test enforces byte-for-byte parity across
   * the adversarial corpus; this dev-only assert surfaces drift fast if
   * either path is later modified. Cutover to PRIMARY happens in a
   * separate commit after the soak window. */
  if (process.env.NODE_ENV !== "production") {
    const __wave2dRegistry = runRegistry(text);
    console.assert(
      cryptoTokenComp === Boolean(__wave2dRegistry.cryptoTokenComp),
      "wave-2d drift: cryptoTokenComp",
    );
    console.assert(
      gccArbitrageAnchor === Boolean(__wave2dRegistry.gccArbitrageAnchor),
      "wave-2d drift: gccArbitrageAnchor",
    );
    console.assert(
      benchTimeDisclosed === Boolean(__wave2dRegistry.benchTimeDisclosed),
      "wave-2d drift: benchTimeDisclosed",
    );
    console.assert(
      founderSecondInnings === Boolean(__wave2dRegistry.founderSecondInnings),
      "wave-2d drift: founderSecondInnings",
    );
    console.assert(
      latecareerAgeBias === Boolean(__wave2dRegistry.latecareerAgeBias),
      "wave-2d drift: latecareerAgeBias",
    );
  }
  /* Wave-3 (2026-05-14j) — 25 new signals. */
  const titlePrecisionAsk = detectTitlePrecisionAsk(text);
  const currentCtcRefusal = detectCurrentCtcRefusal(text);
  const pregnancyDisclosed = detectPregnancyDisclosed(text);
  const boomerangRehire = detectBoomerangRehire(text);
  const referralReceived = detectReferralReceived(text);
  const hometownReturnPreference = detectHometownReturnPreference(text);
  const pwdDisability = detectPwdDisability(text);
  const gratuityVestingNear = detectGratuityVestingNear(text);
  const acquisitionContextAsk = detectAcquisitionContextAsk(text);
  const lgbtqDisclosure = detectLgbtqDisclosure(text);
  const chronicIllnessDisclosed = detectChronicIllnessDisclosed(text);
  const noticeBuyoutAsk = detectNoticeBuyoutAsk(text);
  const bfsiClawbackContext = detectBfsiClawbackContext(text);
  const bigFourGradeStep = detectBigFourGradeStep(text);
  const securityClearanceNeeded = detectSecurityClearanceNeeded(text);
  const missionDrivenComp = detectMissionDrivenComp(text);
  const edtechReputationCheck = detectEdtechReputationCheck(text);
  const acquiHireContext = detectAcquiHireContext(text);
  const cabinParkingAsk = detectCabinParkingAsk(text);
  const spanOfControlAsk = detectSpanOfControlAsk(text);
  const preResignationStealth = detectPreResignationStealth(text);
  const reverseAnchorAsk = detectReverseAnchorAsk(text);
  const dietaryReligiousNeed = detectDietaryReligiousNeed(text);
  const oldEmployerDocsIssue = detectOldEmployerDocsIssue(text);
  const equityRefreshCadenceAsk = detectEquityRefreshCadenceAsk(text);
  /* Wave-3D (PDF #17 follow-up, 2026-05-15) — equity-instrument depth. */
  const equityVestingScheduleAsk = detectEquityVestingScheduleAsk(text);
  const equityCliffPeriodAsk = detectEquityCliffPeriodAsk(text);
  const equityExerciseTermsAsk = detectEquityExerciseTermsAsk(text);
  const equityBuybackLiquidityAsk = detectEquityBuybackLiquidityAsk(text);
  /* Wave-4 (2026-05-14k) — 32 new signals. */
  const signOnClawback = detectSignOnClawback(text);
  const variableTrackRecord = detectVariableTrackRecord(text);
  const wfhEquipmentStipend = detectWfhEquipmentStipend(text);
  const salaryReviewCadenceAsk = detectSalaryReviewCadenceAsk(text);
  const multipleOffersJuggling = detectMultipleOffersJuggling(text);
  const recruitmentAgencyMediation = detectRecruitmentAgencyMediation(text);
  const internalTransferContext = detectInternalTransferContext(text);
  const offerRescindedHistory = detectOfferRescindedHistory(text);
  const internationalDegreePremium = detectInternationalDegreePremium(text);
  const domesticTopMbaAnchor = detectDomesticTopMbaAnchor(text);
  const toxicManagerContext = detectToxicManagerContext(text);
  const visaSponsorshipNeed = detectVisaSponsorshipNeed(text);
  const casteReservationContext = detectCasteReservationContext(text);
  const veteranTransition = detectVeteranTransition(text);
  const singleParentConstraint = detectSingleParentConstraint(text);
  const jointFamilyFinancialResp = detectJointFamilyFinancialResp(text);
  const paternityLeaveAsk = detectPaternityLeaveAsk(text);
  const menstrualLeavePolicy = detectMenstrualLeavePolicy(text);
  const esopExerciseLoanAsk = detectEsopExerciseLoanAsk(text);
  const preIpoSecondaryAsk = detectPreIpoSecondaryAsk(text);
  const accelerationTriggerAsk = detectAccelerationTriggerAsk(text);
  const esopPerquisiteTaxAsk = detectEsopPerquisiteTaxAsk(text);
  const tenderOfferCycleAsk = detectTenderOfferCycleAsk(text);
  const probationaryDurationAsk = detectProbationaryDurationAsk(text);
  const offerLetterTurnaroundDemand = detectOfferLetterTurnaroundDemand(text);
  const contractToHireAsk = detectContractToHireAsk(text);
  const headcountApprovalCheck = detectHeadcountApprovalCheck(text);
  const ipAssignmentClauseAsk = detectIpAssignmentClauseAsk(text);
  const healthcarePharmaContext = detectHealthcarePharmaContext(text);
  const manufacturingCoreContext = detectManufacturingCoreContext(text);
  const quickCommerceContext = detectQuickCommerceContext(text);
  const d2cConsumerEquity = detectD2cConsumerEquity(text);

  /* PDF #17 architectural fix (2026-05-15) — six discovery-flag
   * detectors. The recruiter MUST collect these before disclosing an
   * anchor band. */
  const currentCtcDisclosed = detectCurrentCtcDisclosed(text);
  const fixedVariableSplitDisclosed = detectFixedVariableSplitDisclosed(text);
  const inHandSalaryDisclosed = detectInHandSalaryDisclosed(text);
  const noticePeriodDisclosed = detectNoticePeriodDisclosed(text);
  const competingOffersDisclosed = detectCompetingOffersDisclosed(text);
  const valueProofProvided = detectValueProofProvided(text);

  /* Wave-5 (ITEM 4, 2026-05-15) — 21 preference / behaviour flags. */
  const counterOfferRisk = detectCounterOfferRisk(text);

  /* Wave-6 (2026-05-15) — compensation structure flags. */
  const wantsHigherBase = detectWantsHigherBase(text);
  const wantsJoiningBonus = detectWantsJoiningBonus(text);
  const wantsRelocationAllowance = detectWantsRelocationAllowance(text);
  const wantsFlexibleWork = detectWantsFlexibleWork(text);

  /* Wave-7 (2026-05-15) — behavioral / psychological flags. */
  const invokedCompetingOffer = detectInvokedCompetingOffer(text);
  const askedAboutGrowthPath = detectAskedAboutGrowthPath(text);
  const gaveInconsistentNumbers = detectGaveInconsistentNumbers(text);
  const evasiveOnCurrentCtc = detectEvasiveOnCurrentCtc(text);

  /* Wave-8 (2026-05-16) — offer-response + financial + role clarity + competing-offer. */
  const mentionedSpouseFamily = detectMentionedSpouseFamily(text);
  const mentionedForm16 = detectMentionedForm16(text);
  const askedAboutReporting = detectAskedAboutReporting(text);
  const askedAboutTeamSize = detectAskedAboutTeamSize(text);
  const askedAboutGrowthPath8 = detectAskedAboutGrowthPath8(text);
  const competingOfferAmount = detectCompetingOfferAmount(text);

  /* Wave-9 (2026-05-16) — psychological + Indian doc + seniority + strategy. */
  const mentionedBgvConcern = detectMentionedBgvConcern(text);
  const mentionedMoonlighting = detectMentionedMoonlighting(text);
  const gaveRangeNotPoint = detectGaveRangeNotPoint(text);
  const deflectedOnRange = detectDeflectedOnRange(text);
  const referencedMarketData = detectReferencedMarketData(text);
  const referencedMarketDataSources = detectReferencedMarketDataSources(text);
  const mentionedTaxImplication = detectMentionedTaxImplication(text);

  const hasAny =
    careerGapMonths != null ||
    careerGapActivity != null ||
    tenureSignal != null ||
    levelMismatch != null ||
    domainPivot ||
    transferableSkillsClaimed ||
    compensationHistoryIssue != null ||
    serviceBondAccepted ||
    probationCompMentioned ||
    internshipConversion ||
    collegeTier != null ||
    earlySwitcher ||
    lowCtcAlert ||
    priorInternshipNonConversion ||
    serviceCompanyBackground ||
    compBreakupUnknown ||
    recentLayoff ||
    hotDomainPremium ||
    pipDisclosed ||
    verbalOnlyOffer ||
    culturalJoiningConstraint ||
    peopleManagementClaimed ||
    mncExperience ||
    crossBorderAnchor ||
    unvestedEquityLossClaim ||
    explodingOfferPressure ||
    postAcceptanceRenege ||
    quotaAttainmentClaimed ||
    gardenLeaveDisclosed ||
    nonCompeteFlagged ||
    relocationBonusAsked ||
    parentInsuranceAsked ||
    inHandTakehomeFocus ||
    rtoPushback ||
    returnshipMaternity ||
    payBandAsked ||
    taxStructureAsked ||
    bgvAnxiety ||
    esopSophisticationProbe ||
    spouseJobConstraint ||
    agingParentCare ||
    moonlightingDisclosed ||
    mentalHealthDisclosed ||
    payParityAsked ||
    preemptiveCounterReceived ||
    acceptanceTimeRequest ||
    cryptoTokenComp ||
    gccArbitrageAnchor ||
    benchTimeDisclosed ||
    founderSecondInnings ||
    latecareerAgeBias ||
    titlePrecisionAsk ||
    currentCtcRefusal ||
    pregnancyDisclosed ||
    boomerangRehire ||
    referralReceived ||
    hometownReturnPreference ||
    pwdDisability ||
    gratuityVestingNear ||
    acquisitionContextAsk ||
    lgbtqDisclosure ||
    chronicIllnessDisclosed ||
    noticeBuyoutAsk ||
    bfsiClawbackContext ||
    bigFourGradeStep ||
    securityClearanceNeeded ||
    missionDrivenComp ||
    edtechReputationCheck ||
    acquiHireContext ||
    cabinParkingAsk ||
    spanOfControlAsk ||
    preResignationStealth ||
    reverseAnchorAsk ||
    dietaryReligiousNeed ||
    oldEmployerDocsIssue ||
    equityRefreshCadenceAsk ||
    equityVestingScheduleAsk ||
    equityCliffPeriodAsk ||
    equityExerciseTermsAsk ||
    equityBuybackLiquidityAsk ||
    signOnClawback ||
    variableTrackRecord ||
    wfhEquipmentStipend ||
    salaryReviewCadenceAsk ||
    multipleOffersJuggling ||
    recruitmentAgencyMediation ||
    internalTransferContext ||
    offerRescindedHistory ||
    internationalDegreePremium ||
    domesticTopMbaAnchor ||
    toxicManagerContext ||
    visaSponsorshipNeed ||
    casteReservationContext ||
    veteranTransition ||
    singleParentConstraint ||
    jointFamilyFinancialResp ||
    paternityLeaveAsk ||
    menstrualLeavePolicy ||
    esopExerciseLoanAsk ||
    preIpoSecondaryAsk ||
    accelerationTriggerAsk ||
    esopPerquisiteTaxAsk ||
    tenderOfferCycleAsk ||
    probationaryDurationAsk ||
    offerLetterTurnaroundDemand ||
    contractToHireAsk ||
    headcountApprovalCheck ||
    ipAssignmentClauseAsk ||
    healthcarePharmaContext ||
    manufacturingCoreContext ||
    quickCommerceContext ||
    d2cConsumerEquity ||
    currentCtcDisclosed ||
    fixedVariableSplitDisclosed ||
    inHandSalaryDisclosed ||
    noticePeriodDisclosed ||
    competingOffersDisclosed ||
    valueProofProvided ||
    /* Wave-5 (ITEM 4, 2026-05-15) */
    counterOfferRisk != null ||
    /* Wave-6 (2026-05-15) */
    wantsHigherBase ||
    wantsJoiningBonus ||
    wantsRelocationAllowance ||
    wantsFlexibleWork ||
    /* Wave-7 (2026-05-15) */
    invokedCompetingOffer ||
    askedAboutGrowthPath ||
    gaveInconsistentNumbers ||
    evasiveOnCurrentCtc ||
    /* Wave-8 (2026-05-16) */
    mentionedSpouseFamily ||
    mentionedForm16 ||
    askedAboutReporting ||
    askedAboutTeamSize ||
    askedAboutGrowthPath8 ||
    competingOfferAmount != null ||
    /* Wave-9 (2026-05-16) */
    mentionedBgvConcern ||
    mentionedMoonlighting ||
    gaveRangeNotPoint ||
    deflectedOnRange ||
    referencedMarketData ||
    mentionedTaxImplication;
  return applyWaveDisables({
    careerGapMonths,
    careerGapActivity,
    tenureSignal,
    levelMismatch,
    domainPivot,
    transferableSkillsClaimed,
    compensationHistoryIssue,
    serviceBondAccepted,
    probationCompMentioned,
    internshipConversion,
    collegeTier,
    earlySwitcher,
    lowCtcAlert,
    priorInternshipNonConversion,
    serviceCompanyBackground,
    compBreakupUnknown,
    recentLayoff,
    hotDomainPremium,
    pipDisclosed,
    verbalOnlyOffer,
    culturalJoiningConstraint,
    peopleManagementClaimed,
    mncExperience,
    crossBorderAnchor,
    unvestedEquityLossClaim,
    explodingOfferPressure,
    postAcceptanceRenege,
    quotaAttainmentClaimed,
    gardenLeaveDisclosed,
    nonCompeteFlagged,
    relocationBonusAsked,
    parentInsuranceAsked,
    inHandTakehomeFocus,
    rtoPushback,
    returnshipMaternity,
    payBandAsked,
    taxStructureAsked,
    bgvAnxiety,
    esopSophisticationProbe,
    spouseJobConstraint,
    agingParentCare,
    moonlightingDisclosed,
    mentalHealthDisclosed,
    payParityAsked,
    preemptiveCounterReceived,
    acceptanceTimeRequest,
    cryptoTokenComp,
    gccArbitrageAnchor,
    benchTimeDisclosed,
    founderSecondInnings,
    latecareerAgeBias,
    titlePrecisionAsk,
    currentCtcRefusal,
    pregnancyDisclosed,
    boomerangRehire,
    referralReceived,
    hometownReturnPreference,
    pwdDisability,
    gratuityVestingNear,
    acquisitionContextAsk,
    lgbtqDisclosure,
    chronicIllnessDisclosed,
    noticeBuyoutAsk,
    bfsiClawbackContext,
    bigFourGradeStep,
    securityClearanceNeeded,
    missionDrivenComp,
    edtechReputationCheck,
    acquiHireContext,
    cabinParkingAsk,
    spanOfControlAsk,
    preResignationStealth,
    reverseAnchorAsk,
    dietaryReligiousNeed,
    oldEmployerDocsIssue,
    equityRefreshCadenceAsk,
    equityVestingScheduleAsk,
    equityCliffPeriodAsk,
    equityExerciseTermsAsk,
    equityBuybackLiquidityAsk,
    signOnClawback,
    variableTrackRecord,
    wfhEquipmentStipend,
    salaryReviewCadenceAsk,
    multipleOffersJuggling,
    recruitmentAgencyMediation,
    internalTransferContext,
    offerRescindedHistory,
    internationalDegreePremium,
    domesticTopMbaAnchor,
    toxicManagerContext,
    visaSponsorshipNeed,
    casteReservationContext,
    veteranTransition,
    singleParentConstraint,
    jointFamilyFinancialResp,
    paternityLeaveAsk,
    menstrualLeavePolicy,
    esopExerciseLoanAsk,
    preIpoSecondaryAsk,
    accelerationTriggerAsk,
    esopPerquisiteTaxAsk,
    tenderOfferCycleAsk,
    probationaryDurationAsk,
    offerLetterTurnaroundDemand,
    contractToHireAsk,
    headcountApprovalCheck,
    ipAssignmentClauseAsk,
    healthcarePharmaContext,
    manufacturingCoreContext,
    quickCommerceContext,
    d2cConsumerEquity,
    currentCtcDisclosed,
    fixedVariableSplitDisclosed,
    inHandSalaryDisclosed,
    noticePeriodDisclosed,
    competingOffersDisclosed,
    valueProofProvided,
    /* Wave-5 (ITEM 4, 2026-05-15) */
    counterOfferRisk,
    /* Wave-6 (2026-05-15) */
    wantsHigherBase,
    wantsJoiningBonus,
    wantsRelocationAllowance,
    wantsFlexibleWork,
    /* Wave-7 (2026-05-15) */
    invokedCompetingOffer,
    askedAboutGrowthPath,
    gaveInconsistentNumbers,
    evasiveOnCurrentCtc,
    /* Wave-8 (2026-05-16) */
    mentionedSpouseFamily,
    mentionedForm16,
    askedAboutReporting,
    askedAboutTeamSize,
    askedAboutGrowthPath8,
    competingOfferAmount,
    /* Wave-9 (2026-05-16) */
    mentionedBgvConcern,
    mentionedMoonlighting,
    gaveRangeNotPoint,
    deflectedOnRange,
    referencedMarketData,
    referencedMarketDataSources,
    mentionedTaxImplication,
    hasAny,
  });
}

