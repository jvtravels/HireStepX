import { registerWaveFlag, runRegistry } from "./_candidate-profile-registry";

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
      r.wantsHigherBase || r.wantsJoiningBonus || r.wantsRelocationAllowance
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

export type CareerGapActivity =
  /** Upskilling / certification / course. */
  | "upskill"
  /** Freelancing / consulting. */
  | "freelance"
  /** Family / personal reasons. */
  | "family"
  /** Health / medical reasons. */
  | "health"
  /** Higher studies / degree. */
  | "study"
  /** Job search / interviewing. */
  | "job-search";

export type TenureSignal =
  /** Candidate has switched ≥ 3 times in ≤ 5 years, or stated they job-
   *  hop. Materially affects retention-bonus framing. */
  | "frequent"
  /** Candidate has stayed long at companies — used as a positive
   *  retention signal that can support a higher joining bonus. */
  | "stable";

export type LevelMismatch =
  /** Candidate's stated experience exceeds the role level. */
  | "over"
  /** Candidate is below the typical YOE/level for the role. */
  | "under";

/** Phase 25b — payroll-issue history. Materially affects how the AI
 *  should anchor when current CTC is below market: a delayed/unpaid
 *  history means "current CTC" isn't a clean signal of market price. */
export type CompensationHistoryIssue =
  /** Salary was paid but delayed by months on at least one occasion. */
  | "delayed"
  /** Salary was withheld entirely / partial months unpaid. */
  | "unpaid";

/** Fresher-flow extension (2026-05-14c). Indian campus hiring anchors
 *  differently by college tier:
 *    tier-1 — IIT / IISc / NIT / IIIT-H / BITS Pilani / top IIM.
 *      Real recruiters quote ~25% above the standard fresher band.
 *    tier-2 — VIT / SRM / Manipal / DTU / NSUT / state engineering
 *      colleges with consistent placement records. Standard band.
 *    tier-3 — private engineering colleges without consistent
 *      placement tie-ups. Often offered below the standard band
 *      (~80%) when there's no campus-deal floor.
 *  Detection is conservative — only fires when the candidate names
 *  the college explicitly or uses an unambiguous tier label.
 *  See `data/college-tiers.ts` for the canonical list. */
export type CollegeTier = "tier-1" | "tier-2" | "tier-3";

export interface CandidateProfileResult {
  /** Stated career-gap duration in months. Range 1–60 (5 years max).
   *  Null when unstated. */
  careerGapMonths: number | null;
  /** What the candidate did during the gap. Null when not stated or
   *  unrecognized. */
  careerGapActivity: CareerGapActivity | null;
  /** Frequent / stable job-tenure signal. Null when unstated. */
  tenureSignal: TenureSignal | null;
  /** Over- or under-qualified self-statement. Null when unstated. */
  levelMismatch: LevelMismatch | null;
  /** Phase 25b — domain pivot. True when the candidate says they're
   *  changing function/industry ("teacher → EdTech sales", "designer
   *  → PM"). Materially affects how the AI grades the comp ask. */
  domainPivot: boolean;
  /** Phase 25b — candidate claimed transferable skills as justification
   *  for full-rate comp despite the pivot. Used together with
   *  domainPivot to flag overreach. */
  transferableSkillsClaimed: boolean;
  /** Phase 25b — payroll history issue. Null when not stated. */
  compensationHistoryIssue: CompensationHistoryIssue | null;
  /** Phase 26 — service-agreement / training bond accepted or being
   *  asked about. True when the candidate has signed (or is being asked
   *  to sign) a bond. Doesn't say whether terms are clear — that's the
   *  red-flag's job to surface. */
  serviceBondAccepted: boolean;
  /** Phase 26 — probation period vs confirmed salary distinction surfaced
   *  in dialogue. True when probation is mentioned in a comp context
   *  (i.e. probation salary may differ from post-confirmation salary). */
  probationCompMentioned: boolean;
  /** Fresher-flow extension (2026-05-14). True when the candidate
   *  signals an intern-to-fulltime conversion: phrases like "PPO",
   *  "pre-placement offer", "convert my internship", "I interned with
   *  you". Routes the negotiation to a PPO-aware framing — the
   *  candidate already has demonstrated fit and a recent stipend, so
   *  the recruiter typically anchors near (not at) the fresher entry
   *  band and JB sizing differs from a cold full-time hire. */
  internshipConversion: boolean;
  /** Fresher-flow extension (2026-05-14c). College tier disclosed by the
   *  candidate. Null when unstated or unrecognized. Routes into the
   *  band-resolver to shift the entry band ±20-25% — tier-1 anchors
   *  above the standard fresher rate, tier-3 below. */
  collegeTier: CollegeTier | null;
  /** Junior-flow extension (2026-05-14e). Candidate signals a single
   *  recent job switch (1 or 2 stints within ≤2 years). Distinct from
   *  `tenureSignal="frequent"` which gates on ≥3 switches. Used by
   *  LEVER_GUIDANCE to trigger the "only 1 year — what changed that
   *  justifies this hike?" pushback move. Monotone-up. */
  earlySwitcher: boolean;
  /** Junior-flow extension (2026-05-14e). Candidate self-states that
   *  their current CTC is below market / their actual skill level
   *  ("I'm underpaid", "my current salary doesn't reflect my skills",
   *  "my CTC is low for what I do"). Routes the recruiter to a
   *  "market-anchor-not-hike" reframe instead of pushing back on the
   *  big hike percentage. Monotone-up. */
  lowCtcAlert: boolean;
  /** Junior-flow extension (2026-05-14e). Candidate signals they did
   *  an internship at a DIFFERENT company before their current/prior
   *  full-time role — the internship is a credential, not a current
   *  PPO-conversion event. Distinct from `internshipConversion` (which
   *  is for converting the CURRENT internship at THIS company). Routes
   *  to a "fresher-or-junior" classifier voice. Monotone-up. */
  priorInternshipNonConversion: boolean;
  /** Junior-flow extension (2026-05-14e). Candidate currently works
   *  at an Indian IT-services company (TCS/Infosys/Wipro/Cognizant/HCL/
   *  TechM/Mindtree/LTI/etc) or self-labels "service background". When
   *  the target is a product company (FAANG/unicorn/SaaS), routes to a
   *  "service vs product depth" reframe — service experience is solid
   *  but product values different depth (systems design vs platform
   *  ops), so the band anchors on entry/mid for product even at 2-3
   *  YoE service. Monotone-up. */
  serviceCompanyBackground: boolean;
  /** Mid-level extension (2026-05-14f). Candidate self-states they
   *  don't know their current fixed/variable / base-variable / CTC
   *  breakup — common at 3-6 YoE in IT-services where the candidate
   *  knows the headline number but not the structure. Routes the
   *  recruiter to a "comp-literacy coaching" voice on compensation-
   *  summary instead of negotiating against unknown numbers.
   *  Monotone-up. */
  compBreakupUnknown: boolean;
  /** Real-world Indian extension (2026-05-14g) — candidate was recently
   *  laid off (Byju's / Unacademy / startup shutdown / mass layoff).
   *  Distinct from `careerGapMonths`: this is the REASON for the gap and
   *  it changes the voice — empathetic tone, do NOT anchor down on
   *  current-CTC (the candidate may have been let go before promotion/
   *  appraisal). Monotone-up. */
  recentLayoff: boolean;
  /** Real-world Indian extension (2026-05-14g) — candidate's role is in
   *  a hot-domain bucket (AI/ML/GenAI, Security/AppSec, Quant/HFT).
   *  These commanded 30-50% premium over standard SWE bands in 2026.
   *  Routes the recruiter to a "premium-justified, but show specialty"
   *  voice instead of pushing back on the headline number.
   *  Monotone-up. */
  hotDomainPremium: boolean;
  /** Real-world Indian extension (2026-05-14g) — candidate disclosed
   *  they are on a Performance Improvement Plan / forced exit / "asked
   *  to leave" / non-voluntary separation. HIGH-RISK oversharing
   *  pattern — the recruiter must coach NOT to volunteer this to other
   *  interviewers and must NOT anchor down on current CTC because of
   *  it. Distinct from layoff (PIP = performance signal; layoff =
   *  org/macro signal). Monotone-up. */
  pipDisclosed: boolean;
  /** Real-world Indian extension (2026-05-14g) — candidate states the
   *  offer was made verbally / no offer letter yet / waiting on written
   *  confirmation. Extremely common Indian pattern and a high source of
   *  candidate anxiety. Routes recruiter to a "we'll get the written
   *  offer to you by [date], here's exactly what it will say" voice.
   *  Monotone-up. */
  verbalOnlyOffer: boolean;
  /** Real-world Indian extension (2026-05-14g) — candidate cites a
   *  culturally-rooted joining constraint: muhurat date, wedding,
   *  Diwali, religious festival, family function. Distinct from generic
   *  noticePeriod / joiningDate — recruiters in India should NOT push
   *  back on these; the right voice is accommodating ("understood,
   *  we'll target a post-festival joining and lock the offer letter
   *  now"). Monotone-up. */
  culturalJoiningConstraint: boolean;
  /** Senior-flow extension (2026-05-14h) — candidate claims people-
   *  management scope ("I lead a team of N", "managed X engineers",
   *  "EM / Engineering Manager / Director title"). Routes to a senior-
   *  voice: probe scope (IC+management split, comp-decisions owned)
   *  before pricing the band. Monotone-up. */
  peopleManagementClaimed: boolean;
  /** ResumeFactPack track (2026-05-16) — candidate has experience at an
   *  MNC / large established product company. Pre-seeded at init from
   *  resumeFactPack.priorCompanies (any with tier "faang" or
   *  "indian-product") with provenance="resume". Also settable from a
   *  stated utterance ("I've worked at Google", "I'm at an MNC") with
   *  provenance="stated". Resume wins on conflict — monotone-up; never
   *  downgrade. Promoted to first-class so downstream consumers don't
   *  leak resume-shape knowledge by reading priorCompanies directly. */
  mncExperience: boolean;
  /** Senior-flow extension (2026-05-14h) — candidate anchors on a
   *  cross-border / overseas TC ("my Bay Area TC was $250k", "I'm
   *  returning from Singapore / Dubai / London"). Routes recruiter to
   *  the PPP-correction rule: do NOT match USD/SGD/GBP directly;
   *  explain India-market parity for the role. Monotone-up. */
  crossBorderAnchor: boolean;
  /** Senior-flow extension (2026-05-14h) — candidate claims unvested
   *  equity / RSU loss / underwater options as a comp-justification
   *  for higher signing bonus or stretch base. Routes recruiter to a
   *  "we can address unvested via signing-bonus, not base" voice.
   *  Monotone-up. */
  unvestedEquityLossClaim: boolean;
  /** Process-dynamics extension (2026-05-14h) — recruiter from another
   *  company has given an exploding offer (24-72h deadline pressure).
   *  Routes to a "don't get pressured" coaching voice + accelerated
   *  decision support. Monotone-up. */
  explodingOfferPressure: boolean;
  /** Process-dynamics extension (2026-05-14h) — candidate signals they
   *  have accepted then reneged on an offer before, or is considering
   *  reneging now. HIGH RED-FLAG in Indian recruiting; routes recruiter
   *  to a "we're optimizing for a clean acceptance, not a fast one"
   *  voice. Monotone-up. */
  postAcceptanceRenege: boolean;
  /** Process-dynamics extension (2026-05-14h) — sales candidate claims
   *  quota attainment ("hit 140% of quota", "President's Club", "top
   *  performer"). Routes to a probe-the-claim voice + scope sales OTE
   *  framing. Monotone-up. */
  quotaAttainmentClaimed: boolean;
  /** Long-tail extension (2026-05-14h) — candidate is on garden leave
   *  / forced paid time-off between resignation and last-working-day.
   *  Routes recruiter to "joining timeline is firm; we can use GL
   *  productively" framing. Monotone-up. */
  gardenLeaveDisclosed: boolean;
  /** Long-tail extension (2026-05-14h) — candidate's current employer
   *  has a non-compete / restrictive covenant restricting joining
   *  competitors. Routes recruiter to a "let's review the clause and
   *  consult counsel before signing" voice. Monotone-up. */
  nonCompeteFlagged: boolean;
  /** Long-tail extension (2026-05-14h) — candidate asks about a
   *  relocation bonus / moving allowance (common when moving
   *  Bangalore↔Hyderabad↔Pune↔Gurgaon etc). Routes recruiter to
   *  surface the standard relo package proactively. Monotone-up. */
  relocationBonusAsked: boolean;
  /* ─── Wave-2 (2026-05-14i) ──────────────────────────────────────── */
  /** Wave-2A — candidate asks about parent / family insurance cover.
   *  THE #1 unmet Indian benefit ask. Routes recruiter to surface the
   *  parent-floater details proactively. Monotone-up. */
  parentInsuranceAsked: boolean;
  /** Wave-2A — candidate frames comp in in-hand / take-home / monthly
   *  net terms instead of CTC. Routes recruiter to walk through the
   *  CTC → in-hand bridge (PF/gratuity/tax) explicitly. Monotone-up. */
  inHandTakehomeFocus: boolean;
  /** Wave-2A — candidate pushes back on Return-to-Office / mandatory
   *  hybrid days. 2024-2026 Infosys/TCS/Wipro mass-attrition driver.
   *  Routes recruiter to clarify our specific WFO policy + flex.
   *  Monotone-up. */
  rtoPushback: boolean;
  /** Wave-2A — candidate is returning from a maternity break (distinct
   *  from generic careerGap — needs returnship voice + no anchor-down
   *  on stale CTC). Monotone-up. */
  returnshipMaternity: boolean;
  /** Wave-2A — candidate asks for the official pay-band / level-range
   *  / "what's the top of the band". Transparent-comp probe. Routes
   *  recruiter to honest band disclosure within policy. Monotone-up. */
  payBandAsked: boolean;
  /** Wave-2B — candidate asks for tax-optimal CTC structuring (HRA /
   *  LTA / FBP / meal-card / 80C / NPS). Routes to "yes, we can
   *  restructure within these caps" voice. Monotone-up. */
  taxStructureAsked: boolean;
  /** Wave-2B — candidate volunteers anxiety about background-
   *  verification (degree gap, employment gap, comp-inflation, weak
   *  college, "don't call my current manager"). Routes recruiter to
   *  a measured "tell me what you're worried about" voice — and to
   *  the red-flag layer. Monotone-up. */
  bgvAnxiety: boolean;
  /** Wave-2B — candidate probes ESOP sophistication: 409A / FMV /
   *  strike-price / vesting / exercise-window / liquidity-history /
   *  acceleration. Sophisticated-candidate signal — routes recruiter
   *  to data-rich detail mode. Monotone-up. */
  esopSophisticationProbe: boolean;
  /** Wave-2B — candidate cites spouse's job as location/move
   *  constraint ("wife works in Pune"). Common dual-career India
   *  pattern. Routes recruiter to location-flex voice. Monotone-up. */
  spouseJobConstraint: boolean;
  /** Wave-2B — candidate cites aging-parent care as relocation /
   *  travel / WFH constraint. Routes recruiter to WFH-flex + medical-
   *  cover-extending-to-parents voice. Monotone-up. */
  agingParentCare: boolean;
  /** Wave-2C — candidate discloses they intend to / already do
   *  moonlight / side-hustle / second job. Post-Wipro-2022 sensitive
   *  topic — routes recruiter to surface our written moonlighting
   *  policy without surprise. Monotone-up. */
  moonlightingDisclosed: boolean;
  /** Wave-2C — candidate discloses a mental-health / burnout / therapy
   *  history affecting work. SENSITIVE — recruiter must NOT anchor
   *  down; routes to empathetic, "our benefits include EAP / therapy
   *  reimbursement" voice. Monotone-up. */
  mentalHealthDisclosed: boolean;
  /** Wave-2C — candidate asks about gender pay-parity / DEI / pay
   *  audit results. Routes recruiter to honest disclosure of policy
   *  (don't deflect). Monotone-up. */
  payParityAsked: boolean;
  /** Wave-2C — candidate's current employer pre-emptively counter-
   *  offered (raise / promotion / WFH) before resignation. Routes
   *  recruiter to "we know the counter pattern — let's price for the
   *  market, not against the panicked counter" voice. Monotone-up. */
  preemptiveCounterReceived: boolean;
  /** Wave-2C — candidate explicitly asks for an acceptance-grace
   *  period ("can I have 1-2 weeks to decide?"). Routes recruiter to
   *  "yes, here's the offer-validity window; how can I help you
   *  decide?" voice. Monotone-up. */
  acceptanceTimeRequest: boolean;
  /** Wave-2D — candidate frames comp in crypto / token / USDT /
   *  stablecoin terms. Routes recruiter to legal/tax-clarification
   *  voice (RBI tax 30%+TDS for VDAs). Monotone-up. */
  cryptoTokenComp: boolean;
  /** Wave-2D — candidate is at / coming from a Global Capability
   *  Center (GCC / captive) and may anchor on India-arbitrage parent-
   *  comp. Routes recruiter to "we price India-market, not parent-co
   *  arbitrage" voice. Monotone-up. */
  gccArbitrageAnchor: boolean;
  /** Wave-2D — candidate discloses bench-time at their current
   *  services-company (unallocated to a project). Common at TCS/
   *  Infosys/Wipro. Routes recruiter to "bench is structural, not
   *  performance" reframe — do NOT anchor down. Monotone-up. */
  benchTimeDisclosed: boolean;
  /** Wave-2D — candidate is a second-innings ex-founder / ex-CEO
   *  whose last salary was ₹0 / stipend / equity-only. Routes
   *  recruiter to "previous package is non-signal — we price the
   *  role" voice. Monotone-up. */
  founderSecondInnings: boolean;
  /** Wave-2D — candidate is 45+ and signals age-bias concern ("am I
   *  too senior?", "fit with younger team?"). Routes recruiter to
   *  warm-affirming voice + frame seniority as asset, not liability.
   *  Monotone-up. */
  latecareerAgeBias: boolean;
  /* ─── Wave-3 (2026-05-14j) — 25 new flags spanning identity / title /
   * sensitive disclosures (7), history / relationship / retention (6),
   * domain / vertical voice (7), and process / coaching surface (5). */
  /** Wave-3A — candidate asks about exact title / designation /
   *  grade-step ("what's the exact designation?", "SDE-2 or Senior
   *  SDE?", "M5 or M6"). India places huge weight on resume-readable
   *  titles. Routes to designation / grade voice. Monotone-up. */
  titlePrecisionAsk: boolean;
  /** Wave-3A — candidate refuses to share current CTC ("I'd prefer not
   *  to share", "rather not say my current package"). Routes recruiter
   *  to RESPECT the refusal — pivot to band-anchored pricing without
   *  pressuring for the number. Monotone-up. */
  currentCtcRefusal: boolean;
  /** Wave-3A — candidate discloses pregnancy / expecting / due date /
   *  imminent maternity leave. SENSITIVE — recruiter must NOT anchor
   *  down; do not let comp be influenced by maternity context. Routes
   *  to warm + maternity-benefit-detail voice. Monotone-up. */
  pregnancyDisclosed: boolean;
  /** Wave-3A — candidate is a returning ex-employee ("I worked here
   *  before", "boomerang hire", "rejoining after 3 years"). Routes to
   *  rehire-eligibility / institutional-knowledge voice. Monotone-up. */
  boomerangRehire: boolean;
  /** Wave-3A — candidate was referred by a current employee ("X
   *  referred me", "internal referral", "employee referral"). Routes
   *  recruiter to surface referral-bonus / honor-referrer voice and
   *  note the social-debt context. Monotone-up. */
  referralReceived: boolean;
  /** Wave-3A — candidate wants to relocate to hometown / tier-2 city
   *  ("back to my hometown", "move closer to family in Indore /
   *  Coimbatore"). Distinct from spouseJobConstraint. Routes to
   *  tier-2-city PPP-adjusted band voice. Monotone-up. */
  hometownReturnPreference: boolean;
  /** Wave-3A — candidate discloses a disability / accessibility need /
   *  PWD reservation ("hearing impairment", "wheelchair accessible",
   *  "PWD candidate", "accommodation required"). SENSITIVE — routes
   *  recruiter to "yes, we accommodate; what specifically?" voice. Must
   *  not anchor down. Monotone-up. */
  pwdDisability: boolean;
  /** Wave-3A — candidate cites being close to gratuity vesting (4.6+
   *  years; "I'll lose gratuity if I leave now", "almost 5 years for
   *  gratuity"). Routes recruiter to "we can cover the gratuity gap in
   *  the signing bonus" voice. Monotone-up. */
  gratuityVestingNear: boolean;
  /** Wave-3A — candidate asks about acquisition / merger context
   *  ("are you being acquired?", "I heard about the M&A", "post-
   *  acquisition retention"). Routes to "here's where we are on the
   *  M&A; here's how it affects your offer" voice. Monotone-up. */
  acquisitionContextAsk: boolean;
  /** Wave-3A — candidate discloses LGBTQ+ identity / asks about partner
   *  benefits / same-sex spouse insurance. SENSITIVE — routes to
   *  "yes, partner benefits cover same-sex partners" voice. Must not
   *  anchor down. Monotone-up. */
  lgbtqDisclosure: boolean;
  /** Wave-3A — candidate discloses a chronic illness / ongoing
   *  treatment / dialysis / cancer-survivor / autoimmune. SENSITIVE
   *  — routes recruiter to EAP / medical-leave / accommodation voice.
   *  Must not anchor down. Monotone-up. */
  chronicIllnessDisclosed: boolean;
  /** Wave-3A — candidate explicitly asks about notice-period buyout /
   *  shortfall ("can you buy out my notice?", "notice buyout amount?").
   *  Distinct from Phase-25 noticePeriodDays; this is the buyout-money
   *  ask. Routes to "yes/no on notice buyout, here's the cap" voice.
   *  Monotone-up. */
  noticeBuyoutAsk: boolean;
  /** Wave-3B — candidate from BFSI cites year-end / variable / bonus
   *  clawback if they leave before March ("bonus locked till March",
   *  "joining bonus clawback if I leave under 1 year"). Routes to
   *  "we can cover the clawback in the signing bonus" voice.
   *  Monotone-up. */
  bfsiClawbackContext: boolean;
  /** Wave-3B — candidate is at Deloitte/EY/PwC/KPMG and references
   *  grade step (Consultant → Senior Consultant → Manager → SM → D,
   *  "S2 to M1 lateral"). Routes to Big-4 grade-step band voice.
   *  Monotone-up. */
  bigFourGradeStep: boolean;
  /** Wave-3B — candidate raises security clearance / defence / govt
   *  project requirement ("I need clearance", "DRDO/ISRO project",
   *  "DoD clearance"). Routes to clearance-status / timeline voice.
   *  Monotone-up. */
  securityClearanceNeeded: boolean;
  /** Wave-3B — candidate signals willingness to take below-market for
   *  mission (climate, healthtech, public sector, social impact, NGO).
   *  Routes to "we won't lowball you even if you're mission-aligned"
   *  voice. Monotone-up. */
  missionDrivenComp: boolean;
  /** Wave-3B — candidate probes edtech company reputation / mass-firing
   *  history / Byju's-parallel anxiety. Routes to honest-stability /
   *  runway / unit-economics voice. Monotone-up. */
  edtechReputationCheck: boolean;
  /** Wave-3B — candidate's CURRENT company is being acquired / wound
   *  down and they're moving as a result. Distinct from
   *  acquisitionContextAsk which is about OUR company's M&A.
   *  Routes to "stale CTC is non-signal, we price the role" voice.
   *  Monotone-up. */
  acquiHireContext: boolean;
  /** Wave-3B — candidate asks about cabin / parking / dedicated
   *  workstation / company car / fuel reimbursement. Traditional
   *  Indian seniority perks. Routes to perk-disclosure voice.
   *  Monotone-up. */
  cabinParkingAsk: boolean;
  /** Wave-3B — candidate asks about their span of control / team size
   *  to manage / org structure / reporting lines / number of reports.
   *  Routes to "here's the org chart and your span of control" voice.
   *  Monotone-up. */
  spanOfControlAsk: boolean;
  /** Wave-3C — candidate has NOT yet told current employer ("they
   *  don't know I'm interviewing", "stealth job search"). Routes to
   *  "we'll structure the offer to give you confidentiality cover"
   *  voice. Monotone-up. */
  preResignationStealth: boolean;
  /** Wave-3C — candidate refuses to give a number first and asks the
   *  recruiter to anchor ("what's your budget?", "you tell me",
   *  "what range did you have in mind?"). Routes to coaching: do not
   *  anchor first unless band data is firm. Monotone-up. */
  reverseAnchorAsk: boolean;
  /** Wave-3C — candidate raises dietary / religious accommodation
   *  (Jain / halal / vegetarian-cafeteria / Friday prayers / Ramzan /
   *  Sabbath). Routes to dietary-accommodation voice. Monotone-up. */
  dietaryReligiousNeed: boolean;
  /** Wave-3C — candidate has trouble retrieving relieving letter /
   *  experience letter / payslips from a prior employer. Affects BGV.
   *  Routes to "we accept affidavit / alternate proof" voice.
   *  Monotone-up. */
  oldEmployerDocsIssue: boolean;
  /** Wave-3C — candidate asks about equity refresh cadence / top-up
   *  grants / promotion refresh ("when's my next RSU grant?", "annual
   *  refresh policy?", "promotion top-up?"). Distinct from
   *  esopSophisticationProbe (which is initial-grant mechanics).
   *  Routes to refresh-cadence voice. Monotone-up. */
  equityRefreshCadenceAsk: boolean;
  /** Wave-3D (PDF #17 follow-up, 2026-05-15) — candidate asks about
   *  equity vesting schedule / cadence ("vesting schedule", "vesting
   *  cadence", "how does vesting work", "vesting period"). Distinct
   *  from equityRefreshCadenceAsk (refresh grants) and
   *  equityCliffPeriodAsk (initial cliff). Monotone-up. */
  equityVestingScheduleAsk: boolean;
  /** Wave-3D (PDF #17 follow-up, 2026-05-15) — candidate asks about
   *  the equity cliff period ("cliff period", "1-year cliff",
   *  "vesting cliff"). Monotone-up. */
  equityCliffPeriodAsk: boolean;
  /** Wave-3D (PDF #17 follow-up, 2026-05-15) — candidate asks about
   *  exercise terms / window / price ("exercise terms", "exercise
   *  window", "exercise price", "strike price", "exercise period").
   *  Monotone-up. */
  equityExerciseTermsAsk: boolean;
  /** Wave-3D (PDF #17 follow-up, 2026-05-15) — candidate asks about
   *  buyback / liquidity events ("buyback", "liquidity event",
   *  "secondary sale", "tender offer", "liquidity history"). Distinct
   *  from preIpoSecondaryAsk (broader pre-IPO context) and
   *  tenderOfferCycleAsk (cadence of buybacks); this flag captures the
   *  general liquidity-mechanism ask. Monotone-up. */
  equityBuybackLiquidityAsk: boolean;
  /* ─── Wave-4 (2026-05-14k) — 32 new flags spanning high-frequency comp /
   * process gaps (12), sensitive identity / DEI (6), equity depth (5),
   * contract / timing (5), and vertical context (4). */
  /** Wave-4A — candidate raises sign-on / joining bonus clawback if they
   *  leave before X months. Distinct from JB-ask in noticeJoining.
   *  Routes to "we will document the clawback waiver" voice. Monotone-up. */
  signOnClawback: boolean;
  /** Wave-4A — candidate claims consistent variable / bonus track record
   *  ("always hit 100% variable", "maxed bonus"). Engineering/PM variant
   *  of sales' quotaAttainmentClaimed. Routes to validate + price-the-
   *  level voice. Monotone-up. */
  variableTrackRecord: boolean;
  /** Wave-4A — candidate asks about WFH / setup stipend (desk, chair,
   *  internet, laptop reimbursement, one-time WFH allowance). Routes to
   *  concrete-stipend-amount disclosure voice. Monotone-up. */
  wfhEquipmentStipend: boolean;
  /** Wave-4A — candidate asks about salary review cadence ("annual or
   *  semi-annual?", "next appraisal?", "mid-year correction policy?").
   *  Routes to review-cycle disclosure voice. Monotone-up. */
  salaryReviewCadenceAsk: boolean;
  /** Wave-4A — candidate juggling multiple offers / 3+ active processes.
   *  Distinct from explodingOfferPressure (one tight deadline) and
   *  competingOffer (single rival). Routes to "let's get to apples-to-
   *  apples comparison" voice. Monotone-up. */
  multipleOffersJuggling: boolean;
  /** Wave-4A — candidate is sourced through an external recruiter /
   *  placement agency / RMS / consultancy. Materially distorts offer
   *  mechanics (agency margin, BGV, joining timeline). Monotone-up. */
  recruitmentAgencyMediation: boolean;
  /** Wave-4A — candidate is an internal transfer / IJP candidate.
   *  Routes to internal-band / current-grade-step voice. Monotone-up. */
  internalTransferContext: boolean;
  /** Wave-4A — candidate has a prior offer-rescinded history ("Cars24
   *  pulled my offer", "joining was cancelled"). Routes to extra-
   *  reassurance / written-offer-quickly voice. Monotone-up. */
  offerRescindedHistory: boolean;
  /** Wave-4A — candidate signals international degree premium (Stanford,
   *  MIT, Oxford, Ivy League MBA, INSEAD / LBS / Wharton). Distinct from
   *  crossBorderAnchor (overseas TC). Routes to "premium acknowledged
   *  but India-priced" voice. Monotone-up. */
  internationalDegreePremium: boolean;
  /** Wave-4A — candidate is fresh from top-tier domestic MBA (IIM-A/B/C,
   *  ISB, XLRI, FMS, MDI). Distinct from collegeTier=tier-1 (undergrad).
   *  Routes to MBA-fresher-band voice. Monotone-up. */
  domesticTopMbaAnchor: boolean;
  /** Wave-4A — candidate cites toxic manager / bad leadership as primary
   *  exit reason. Distinct from generic badmouthing. Routes to
   *  "validate without anchoring down" voice. Monotone-up. */
  toxicManagerContext: boolean;
  /** Wave-4A — candidate needs visa sponsorship (H1B, OPT expiry, STEM
   *  extension, green card sponsorship, visa transfer). Routes to
   *  sponsorship-eligibility / timeline voice. Monotone-up. */
  visaSponsorshipNeed: boolean;
  /** Wave-4B — candidate discloses caste / reservation category (SC/ST/
   *  OBC) in PSU/govt context. SENSITIVE — respect category disclosure;
   *  do not anchor on it. Monotone-up. */
  casteReservationContext: boolean;
  /** Wave-4B — candidate is transitioning from armed forces (Army/Navy/
   *  Air Force, ex-defence, military lateral). Routes to veteran-
   *  lateral comp / civil-equivalent voice. Monotone-up. */
  veteranTransition: boolean;
  /** Wave-4B — candidate is a single parent (sole custody, no co-
   *  parent). Drives schedule-flex / location constraints. SENSITIVE —
   *  schedule flex voice; do not anchor down. Monotone-up. */
  singleParentConstraint: boolean;
  /** Wave-4B — candidate is sole earner / joint-family financial
   *  responsibility (supporting parents, siblings' education). SENSITIVE
   *  — do not anchor down. Monotone-up. */
  jointFamilyFinancialResp: boolean;
  /** Wave-4B — candidate asks about paternity-leave policy. Distinct
   *  from returnshipMaternity. Routes to policy-disclosure voice.
   *  Monotone-up. */
  paternityLeaveAsk: boolean;
  /** Wave-4B — candidate asks about menstrual / period leave policy
   *  (Zomato-style). Routes to policy-disclosure voice. Monotone-up. */
  menstrualLeavePolicy: boolean;
  /** Wave-4C — candidate asks about ESOP exercise loan / cashless
   *  exercise / company-funded exercise. Routes to exercise-loan
   *  mechanics voice. Monotone-up. */
  esopExerciseLoanAsk: boolean;
  /** Wave-4C — candidate asks about pre-IPO secondary sale / tender
   *  for early employees. Routes to secondary-cycle voice. Monotone-up. */
  preIpoSecondaryAsk: boolean;
  /** Wave-4C — candidate asks directly about acceleration trigger
   *  (single-trigger / double-trigger on change of control). Distinct
   *  from esopSophisticationProbe. Routes to double-trigger voice.
   *  Monotone-up. */
  accelerationTriggerAsk: boolean;
  /** Wave-4C — candidate asks about ESOP perquisite-tax treatment
   *  (Section 17(2), TDS on exercise). Routes to perquisite-tax voice.
   *  Monotone-up. */
  esopPerquisiteTaxAsk: boolean;
  /** Wave-4C — candidate asks about tender-offer / annual buyback
   *  cycle. Routes to buyback-cadence voice. Monotone-up. */
  tenderOfferCycleAsk: boolean;
  /** Wave-4D — candidate asks about probationary duration (3-mo vs
   *  6-mo). Distinct from probationCompMentioned. Routes to probation-
   *  length voice. Monotone-up. */
  probationaryDurationAsk: boolean;
  /** Wave-4D — candidate demands fast offer-letter turnaround
   *  ("48 hours", "when will I get the OL?"). Routes to OL-turnaround
   *  voice. Monotone-up. */
  offerLetterTurnaroundDemand: boolean;
  /** Wave-4D — candidate asks if role is contract-to-hire / when it
   *  converts to permanent. Routes to contract-to-hire mechanics
   *  voice. Monotone-up. */
  contractToHireAsk: boolean;
  /** Wave-4D — candidate explicitly checks headcount approval / HC
   *  budgeted ("seen offers fall through on HC"). Routes to
   *  headcount-approval voice. Monotone-up. */
  headcountApprovalCheck: boolean;
  /** Wave-4D — candidate raises IP assignment / moonlighting / side-
   *  project ownership concern. GenAI-era anxiety. Routes to IP-scope
   *  voice. Monotone-up. */
  ipAssignmentClauseAsk: boolean;
  /** Wave-4E — candidate from pharma R&D / API / clinical / regulatory
   *  (Sun Pharma, Dr Reddy's, Cipla). Routes to pharma-band voice.
   *  Monotone-up. */
  healthcarePharmaContext: boolean;
  /** Wave-4E — candidate from core mechanical / electrical / auto /
   *  steel (Tata Motors, Mahindra, L&T, Maruti, Bajaj Auto). Routes
   *  to core-engineering-band voice. Monotone-up. */
  manufacturingCoreContext: boolean;
  /** Wave-4E — candidate from quick commerce (Zepto, Blinkit, Swiggy-
   *  Instamart, BB-Now). Routes to quick-commerce equity voice.
   *  Monotone-up. */
  quickCommerceContext: boolean;
  /** Wave-4E — candidate from D2C founder-era brand (Boat, Mamaearth,
   *  Sugar, Wakefit, Licious). Routes to D2C-brand voice. Monotone-up. */
  d2cConsumerEquity: boolean;
  /* ─── PDF #17 architectural fix (2026-05-15) — discovery-first
   * detectors. The recruiter MUST collect these signals before
   * disclosing an anchor band. All six are optional for back-compat
   * with serialized state from in-flight sessions; the merge helper
   * is monotone-up. */
  /** Candidate disclosed their current CTC (phrases like "my current
   *  CTC is", "I'm earning", "current package is" + a ₹ amount). */
  currentCtcDisclosed?: boolean;
  /** Candidate disclosed the fixed/variable split of their current
   *  package ("X fixed Y variable", "70-30 split", etc). */
  fixedVariableSplitDisclosed?: boolean;
  /** Candidate disclosed their in-hand / take-home amount ("in-hand is
   *  ₹X", "monthly net ₹X"). */
  inHandSalaryDisclosed?: boolean;
  /** Candidate disclosed their notice period ("X days/weeks/months
   *  notice", "notice period is X"). */
  noticePeriodDisclosed?: boolean;
  /** Candidate disclosed competing-offer status, either positively
   *  ("I have another offer", "in process with X") or negatively
   *  ("no other offers"). */
  competingOffersDisclosed?: boolean;
  /** Candidate provided role-specific value proof: ARR/book size for
   *  CSM, quota/attainment for sales, complex system shipped for
   *  engineering, product launches + metrics for product, portfolio
   *  depth for design. */
  valueProofProvided?: boolean;
  /* ─── Wave-5 (ITEM 4, 2026-05-15) — 21 preference / behaviour flags.
   * These are additive; back-compat optional fields would break EMPTY type,
   * so they are required booleans / nullable unions defaulting to false/null
   * in EMPTY and populated by the Wave-5 detectors below. */

  /* Equity/Wealth flags */
  /** Candidate explicitly prefers equity over a higher cash component
   *  ("I'd rather have equity", "more stock than salary", "equity matters
   *  more to me than base"). Routes recruiter to equity-first framing.
   *  Monotone-up. */
  /** Candidate mentions existing unvested equity / cliff they'd be leaving
   *  ("I have a 1-year cliff coming up", "unvested RSUs worth X"). Distinct
   *  from unvestedEquityLossClaim (loss framing); this is existence signal.
   *  Monotone-up. */
  /** Candidate demonstrates RSU/ESOP vesting mechanics awareness ("4-year
   *  vesting with 1-year cliff", "monthly vesting after cliff", "standard
   *  4/1 schedule"). Sophisticated-candidate signal. Monotone-up. */
  /** Candidate self-identifies as an ESOP/stock holder at current employer
   *  ("I hold ESOPs", "I have unvested options", "my current package
   *  includes ESOPs"). Distinct from esopSophisticationProbe (questions
   *  mechanics) — this is an ownership-existence signal. Monotone-up. */

  /* Risk/Stability flags */
  /** Candidate signals preference for fixed over variable comp ("I prefer
   *  stable fixed salary", "not comfortable with variable", "I'd rather
   *  have less variable"). Routes recruiter to fixed-heavy structuring.
   *  Monotone-up. */
  /** Candidate signals preference for an MNC / established company over a
   *  startup ("I want the stability of an MNC", "prefer large company",
   *  "not comfortable with startup risk"). Monotone-up. */
  /** Candidate signals preference for a startup / high-growth environment
   *  ("I want to join a startup", "looking for a fast-paced startup",
   *  "equity is important — startup stage"). Monotone-up. */
  /** Candidate explicitly states willingness to relocate ("I'm open to
   *  relocating", "happy to move cities", "can relocate for the right
   *  role"). Distinct from relocationBonusAsked (money ask). Monotone-up. */
  /** Candidate's stated work-mode preference. Null when not stated. */

  /* Negotiation behaviour flags */
  /** Candidate signals they will or are likely to counter any offer
   *  ("I'll need to think about it and come back", "I'll be negotiating",
   *  "I always negotiate", "I have a number in mind"). Monotone-up. */
  /** Candidate volunteered they accepted a first offer in the past
   *  ("I usually accept the first offer", "I took the first number they
   *  gave me", "I don't like to negotiate"). Anti-signal for counter risk.
   *  Monotone-up. */
  /** Set true when a walk-away phase is triggered in the session (i.e.,
   *  the negotiation ended with close-walkaway). Set by applyAiMove or
   *  the phase-derivation path, not by parseCandidateAnswer. */
  /** Candidate's expected CTC is > 40% above their stated current CTC
   *  ("I'm at 20L and want 30L"). High-anchor signal — routes recruiter
   *  to "show your work" probe. Populated when both numbers are parseable.
   *  Monotone-up. */
  /** Candidate gave a salary range with a spread of ≥ ₹20 LPA ("between
   *  28 and 50 LPA" or similar). Signals low precision / willingness to
   *  anchor at the low end. Monotone-up. */

  /* Notice/Timing flags */
  /** Candidate indicated their notice period can be shortened via buyout
   *  or early exit ("my notice can be bought out", "they can waive it",
   *  "I can join earlier if you cover the notice"). Distinct from
   *  noticeBuyoutAsk (asking whether WE pay). Monotone-up. */
  /** Candidate's joining urgency. Null when not stated. */
  /** Estimate of how likely the candidate's current employer will counter.
   *  "high" when candidate mentions prior counter or current manager knows
   *  they're looking. "medium" when tenure/specialisation is high. Null
   *  when not inferable. */
  counterOfferRisk: "high" | "medium" | "low" | null;

  /* Domain/Seniority flags */
  /** Candidate is transitioning from Individual Contributor to People
   *  Manager ("I want to move into management", "looking for a team lead
   *  / EM / manager role", "ready for the IC→manager transition").
   *  Distinct from peopleManagementClaimed (already managing). Monotone-up. */
  /** Candidate claims prior leadership / management experience ("I've
   *  led teams", "ex-engineering-manager", "director level"). Broader
   *  than peopleManagementClaimed — includes non-current experience.
   *  Monotone-up. */
  /** Candidate mentions a niche domain specialisation that commands a
   *  premium (fintech, healthtech, deep-tech, space-tech, climate-tech,
   *  embedded, VLSI, quantitative finance). Routes to premium-band voice.
   *  Monotone-up. */
  /** Candidate has been at 3+ companies in the last 2 years (distinct from
   *  tenureSignal="frequent" which is 3+ in 5 years). Extreme job-hopper
   *  signal — routes to retention-risk framing. Monotone-up. */

  /* ─── Wave-6 (2026-05-15) — Compensation structure flags (~21 flags). ── */

  /* Current compensation breakdown */
  /** Candidate mentioned annual / performance bonus at current employer. Monotone-up. */
  /** Extracted bonus % of CTC ("15% variable" → 15). Null when unstated. Takes max across turns. */
  /** Candidate has ESOPs in current role. Monotone-up. */
  /** Candidate mentioned vested ESOPs at current employer. Monotone-up. */
  /** Candidate mentioned retention bonus / joining bonus at current employer. Monotone-up. */
  /** Candidate mentioned gratuity (signals 5yr+ tenure). Monotone-up. */
  /** Candidate mentioned NPS / 80CCD(2) component. Monotone-up. */

  /* Expected compensation preferences */
  /** Candidate explicitly asked for higher fixed/base. Monotone-up. */
  wantsHigherBase: boolean;
  /** Candidate asked about performance bonus structure. Monotone-up. */
  /** Candidate asked about or mentioned joining bonus. Monotone-up. */
  wantsJoiningBonus: boolean;
  /** Candidate asked about relocation support/allowance. Monotone-up. */
  wantsRelocationAllowance: boolean;
  /** Candidate asked about remote/hybrid as part of the offer. Monotone-up. */
  /** Candidate mentioned L&D budget, certifications, upskilling allowance. Monotone-up. */
  /** Candidate asked about equity refresh grants. Monotone-up. */
  /** Candidate mentioned title upgrade as part of expectation. Monotone-up. */

  /* Offer evaluation signals */
  /** Candidate has received the offer letter / verbal offer. Monotone-up. */
  /** Candidate mentioned offer expiry / time pressure. Monotone-up. */
  /** Extracted deadline date/timeframe if mentioned ("by Friday", "3 days"). Null when unstated. */
  /** Candidate is juggling 2+ active offers simultaneously. Monotone-up. */
  /** Candidate explicitly said they care more about the number than perks. Monotone-up. */
  /** Health insurance, food coupons, cab mentioned as important. Monotone-up. */

  /* ─── Wave-7 (2026-05-15) — Behavioral and psychological negotiation flags (~21 flags). ── */

  /* Anchoring behavior */
  /** Candidate stated a number before being asked. Monotone-up. */
  /** Candidate's first anchor was > 50% above current CTC. Monotone-up. */
  /** Candidate walked back their initial ask. Monotone-up. */
  /** Candidate accepted counter-offer in < 2 turns. Monotone-up. */

  /* Pressure response */
  /** Candidate acknowledged when told budget ceiling. Monotone-up. */
  /** Candidate explicitly challenged the stated ceiling. Monotone-up. */
  /** Candidate used competing offer as leverage (not just mentioned). Monotone-up. */
  invokedCompetingOffer: boolean;
  /** Candidate said things like "I need to decide by...". Monotone-up. */
  /** Candidate expressed hesitation ("I'm not sure", "need to think about it"). Monotone-up. */

  /* Rapport signals */
  /** Candidate addressed recruiter by name. Monotone-up. */
  /** Candidate expressed gratitude during negotiation. Monotone-up. */
  /** Candidate showed interest in team/manager/culture. Monotone-up. */
  /** Candidate asked about career progression explicitly. Monotone-up. */
  askedAboutGrowthPath: boolean;
  /** Candidate raised WLB as a concern. Monotone-up. */

  /* Red flags */
  /** CTC numbers contradicted each other across turns. Monotone-up. */
  gaveInconsistentNumbers: boolean;
  /** Candidate deflected or refused to disclose current CTC. Monotone-up. */
  evasiveOnCurrentCtc: boolean;
  /** Expected CTC jumped > 30% across turns (changed ask). Monotone-up. */
  /** Current employer made or might make counter-offer. Monotone-up. */
  /** Candidate hinted at job insecurity as reason for looking. Monotone-up. */
  /** Multiple signals of time pressure / urgency. Monotone-up. */

  /* ─── Wave-8 (2026-05-16) — Offer-response behavior + financial specifics +
   * role clarity + competing-offer specifics (~21 flags). */

  /* Offer-response behavior */
  /** Candidate reacted positively, negatively, or neutrally to the offer.
   *  Null when not yet stated. */
  /** Candidate explicitly rejected the offer ("I can't accept this",
   *  "this doesn't work for me"). Monotone-up. */
  /** Candidate asked for time to decide ("can I have a day?", "I need
   *  to think overnight"). Monotone-up. */
  /** Candidate mentioned spouse / family discussion as reason for delay
   *  ("need to discuss with my wife", "family decision"). Monotone-up. */
  mentionedSpouseFamily: boolean;
  /** Candidate mentioned relocation in the context of this offer
   *  ("I'd need to relocate", "is relocation covered?"). Distinct from
   *  relocationBonusAsked (money) and openToRelocation (willingness).
   *  Monotone-up. */

  /* Financial specifics */
  /** Candidate asked about PF contribution / UAN transfer / employer PF
   *  ("what's the PF breakup?", "does the company contribute 12%?",
   *  "PF UAN transfer"). Monotone-up. */
  /** Candidate mentioned gratuity in an offer-evaluation context
   *  ("is gratuity included?", "5-year gratuity"). Distinct from
   *  currentHasGratuity (existing employer) and gratuityVestingNear
   *  (near-vesting signal). Monotone-up. */
  /** Candidate asked about Form-16 / tax certificate from new employer
   *  ("will I get Form 16?", "Form 16 issuance date"). Monotone-up. */
  mentionedForm16: boolean;
  /** Candidate asked when / how variable component gets paid ("when is
   *  variable paid?", "is variable quarterly or annual?", "what's the
   *  variable payout track record?"). Monotone-up. */
  /** Candidate asked about or mentioned signing bonus
   *  ("is there a signing bonus?", "sign-on?"). Distinct from
   *  wantsJoiningBonus (preference) — this is a mention/ask signal.
   *  Monotone-up. */
  /** Candidate asked about retention bonus
   *  ("retention bonus?", "is there a stay bonus?"). Monotone-up. */
  /** Candidate asked about joining bonus explicitly
   *  ("joining bonus", "JB", "onboarding bonus"). Distinct from
   *  wantsJoiningBonus (preference weight); this is a raw mention/ask.
   *  Monotone-up. */

  /* Role clarity flags */
  /** Candidate asked who they report to ("who's my manager?",
   *  "reporting line", "who does this role report to?"). Monotone-up. */
  askedAboutReporting: boolean;
  /** Candidate asked about team size ("how big is the team?",
   *  "how many people on the team?"). Distinct from spanOfControlAsk
   *  (management span). Monotone-up. */
  askedAboutTeamSize: boolean;
  /** Candidate asked about growth path ("what's the career path?",
   *  "how quickly do people grow here?"). Already covered by
   *  askedAboutGrowthPath in Wave-7; this is the Wave-8 parallel
   *  intended to capture it via a different detection path. Monotone-up. */
  askedAboutGrowthPath8: boolean;
  /** Candidate asked about performance review cycle ("annual review?",
   *  "performance cycle", "how often is performance assessed?").
   *  Monotone-up. */
  /** Candidate stated a target role / future aspiration ("I want to be
   *  a Staff Engineer in 3 years", "VP in 5 years"). Monotone-up. */

  /* Competing-offer specifics */
  /** Candidate's competing offer is verbal / not yet written
   *  ("I have a verbal offer", "not written yet", "informal offer").
   *  Monotone-up. */
  /** Company name of the competing offer, if mentioned. Null when not
   *  stated. Takes last non-null value across turns. */
  /** Stated amount of the competing offer in LPA. Null when not stated.
   *  Takes max across turns. */
  competingOfferAmount: number | null;
  /** Deadline associated with the competing offer, if mentioned
   *  ("they want an answer by Friday"). Null when not stated. Takes
   *  last non-null value. */

  /* ─── Wave-9 (2026-05-16) — Psychological/behavioral + Indian doc/process +
   * seniority/career stage + negotiation strategy signals (~21 flags). */

  /* Psychological/behavioral */
  /** Candidate expressed frustration or impatience ("this is taking too
   *  long", "I'm getting frustrated", "it's been weeks"). Monotone-up. */
  /** Candidate expressed genuine excitement about the role ("I'm really
   *  excited about this", "this is exactly what I've been looking for").
   *  Monotone-up. */
  /** Candidate explicitly paused / asked for a moment to think ("give
   *  me a moment", "let me think about that", "can I have a minute?").
   *  Monotone-up. */
  /** Candidate walked back a previously stated number ("actually, I can
   *  work with less", "forget what I said — let's talk about X").
   *  Distinct from retreatedFromAnchor (which tracks first-anchor walk-
   *  back). This covers mid-session backtracking. Monotone-up. */
  /** Candidate escalated their demand AFTER partial agreement ("you
   *  agreed on X, can we also add Y?", "one more thing — I also need Z").
   *  Classic salami tactic. Monotone-up. */

  /* Indian-specific doc/process flags */
  /** Candidate raised a background-verification concern ("BGV", "my
   *  degree has a gap year", "previous employer won't verify", "what
   *  does the BGV cover?"). Distinct from bgvAnxiety (Wave-2, general
   *  anxiety). Monotone-up. */
  mentionedBgvConcern: boolean;
  /** Candidate raised risk of not getting a relieving letter / experience
   *  letter from current employer ("my company may not give relieving
   *  letter", "absconding risk", "I left without proper exit").
   *  Monotone-up. */
  /** Company is willing to waive notice period ("we'll waive notice",
   *  "no notice needed", "immediate joining OK"). Monotone-up. */
  /** Candidate willing to buy out notice ("I'll pay the notice buyout",
   *  "I can cover the shortfall"). Distinct from noticeBuyoutAsk (asking
   *  whether WE pay). Monotone-up. */
  /** Candidate disclosed or asked about moonlighting policy
   *  ("moonlighting", "second job", "side project IP"). Distinct from
   *  moonlightingDisclosed (Wave-2, personal disclosure). This flag
   *  captures any moonlighting mention including policy questions.
   *  Monotone-up. */
  mentionedMoonlighting: boolean;

  /* Seniority/career stage */
  /** Candidate signals this is their first job change ("first company",
   *  "been here since college", "only employer", "never changed jobs").
   *  Monotone-up. */
  /** Candidate has or claims management experience ("I've managed a
   *  team", "managed 5 people", "team lead"). Distinct from
   *  peopleManagementClaimed (current scope) and hasLeadershipExperience
   *  (broader leadership claim). This targets explicit "I managed"
   *  language. Monotone-up. */
  /** Candidate mentions startup experience as a credential ("I've worked
   *  at a startup", "startup background", "Series A company").
   *  Monotone-up. */
  /** Candidate mentions MNC experience ("I've worked at an MNC",
   *  "Fortune 500 background", "large corp experience"). Monotone-up. */
  /** Candidate mentions a PhD or MBA degree ("I have a PhD", "MBA from
   *  IIM", "doctoral degree", "post-grad"). Distinct from
   *  domesticTopMbaAnchor (top-tier MBA band) and
   *  internationalDegreePremium (overseas degree). Monotone-up. */

  /* Negotiation strategy signals */
  /** Candidate stated their number BEFORE being asked — proactive anchor.
   *  Distinct from anchoredFirst (Wave-7 which tracks first-number timing
   *  more broadly). This specifically flags unprompted anchoring.
   *  Monotone-up. */
  /** Candidate gave a salary range instead of a point number ("30 to 35
   *  LPA", "somewhere between X and Y"). Signals lower precision /
   *  willingness to converge. Monotone-up. */
  gaveRangeNotPoint: boolean;
  /** Candidate deflected when asked for a number ("I'm flexible",
   *  "you tell me", "whatever the market says", "I'm open"). Classic
   *  negotiation defensive move. Monotone-up. */
  deflectedOnRange: boolean;
  /** Candidate cited external market data ("Glassdoor says", "levels.fyi
   *  data", "AmbitionBox shows", "market research suggests"). Monotone-up. */
  referencedMarketData: boolean;
  /** Polish 3 (2026-05-16) — the specific source keys the candidate
   *  named. Lets the reactive followup cite the exact source(s) instead
   *  of saying "market data" generically. Union-merged across turns
   *  (monotone-up). Source keys come from `marketDataSources`. */
  referencedMarketDataSources: string[];
  /** Candidate mentioned cost-of-living as a factor ("cost of living in
   *  Bangalore", "Mumbai is expensive", "higher CoL city"). Monotone-up. */
  /** Candidate mentioned tax implications as a factor ("new tax regime",
   *  "Section 87A", "old vs new regime", "TDS planning", "my effective
   *  tax rate"). Monotone-up. */
  mentionedTaxImplication: boolean;

  /** Convenience flag. */
  hasAny: boolean;
}

/* ─── DPDP Special Personal Data classification ──────────────────────
 *
 * Under India's Digital Personal Data Protection Act, 2023 (DPDP) and
 * adjacent global frameworks (GDPR Art. 9 "special categories"), the
 * following candidate-profile flags encode SENSITIVE / SPECIAL personal
 * data: health, sexual orientation, caste / religion, family / care
 * status, disability, and gender / reproductive context.
 *
 * These flags MUST NOT be written to analytics logs, retention stores,
 * or any non-essential persistence layer in cleartext. Any code path
 * that emits a candidateProfile snapshot to a log/analytics sink MUST
 * route the snapshot through `redactCandidateProfileForLogs()` first.
 *
 * The kernel still computes these flags in-memory for turn-by-turn
 * dialogue framing (e.g. choosing an empathetic voice for a layoff or
 * PIP disclosure), but they are zeroed before any telemetry write.
 *
 * Adding a new sensitive flag? Add the key here, ensure it's a boolean
 * on CandidateProfileResult, and update the redaction tests. */
export const SPECIAL_PERSONAL_DATA_FLAGS: ReadonlyArray<keyof CandidateProfileResult> = [
  "pregnancyDisclosed",
  "pipDisclosed",
  "mentalHealthDisclosed",
  "lgbtqDisclosure",
  "casteReservationContext",
  "pwdDisability",
  "chronicIllnessDisclosed",
  "dietaryReligiousNeed",
  "singleParentConstraint",
  "paternityLeaveAsk",
  "menstrualLeavePolicy",
  "agingParentCare",
  "returnshipMaternity",
];

/**
 * Return a shallow copy of `p` with every flag in
 * SPECIAL_PERSONAL_DATA_FLAGS forced to `false`. All other fields pass
 * through unchanged. The input object is NOT mutated.
 *
 * Use this at every analytics / log write boundary that includes a
 * candidate-profile snapshot (PostHog events, retention tables, error
 * reports, debug dumps). See DPDP rationale above.
 */
export function redactCandidateProfileForLogs(
  p: CandidateProfileResult,
): CandidateProfileResult {
  const out: CandidateProfileResult = { ...p };
  for (const key of SPECIAL_PERSONAL_DATA_FLAGS) {
    /* Every listed flag is a boolean field on the interface; zero it. */
    (out as unknown as Record<string, unknown>)[key as string] = false;
  }
  return out;
}

/**
 * Generic deep-redaction helper for any payload destined for an
 * analytics / log sink. Walks the object (arrays + plain objects)
 * and forces any key that matches a SPECIAL_PERSONAL_DATA_FLAGS name
 * to `false`. Non-matching keys pass through unchanged.
 *
 * Use this as a defence-in-depth wrap at every analytics write site
 * where the payload MAY contain a candidate-profile snapshot
 * (PostHog events, structured stdout logs, retention writes).
 *
 * Pure — does not mutate the input. Cycles in the input cause it to
 * fall back to returning the value unchanged for that subtree
 * (analytics payloads should not be cyclic).
 */
export function redactForAnalytics(payload: unknown): unknown {
  const sensitive = new Set<string>(
    SPECIAL_PERSONAL_DATA_FLAGS.map((k) => String(k)),
  );
  const seen = new WeakSet<object>();
  function walk(v: unknown): unknown {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return v;
    seen.add(v as object);
    if (Array.isArray(v)) return v.map((x) => walk(x));
    const src = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(src)) {
      if (sensitive.has(k)) {
        out[k] = false;
      } else {
        out[k] = walk(src[k]);
      }
    }
    return out;
  }
  return walk(payload);
}

export const EMPTY_CANDIDATE_PROFILE: CandidateProfileResult = {
  careerGapMonths: null,
  careerGapActivity: null,
  tenureSignal: null,
  levelMismatch: null,
  domainPivot: false,
  transferableSkillsClaimed: false,
  compensationHistoryIssue: null,
  serviceBondAccepted: false,
  probationCompMentioned: false,
  internshipConversion: false,
  collegeTier: null,
  earlySwitcher: false,
  lowCtcAlert: false,
  priorInternshipNonConversion: false,
  serviceCompanyBackground: false,
  compBreakupUnknown: false,
  recentLayoff: false,
  hotDomainPremium: false,
  pipDisclosed: false,
  verbalOnlyOffer: false,
  culturalJoiningConstraint: false,
  peopleManagementClaimed: false,
  mncExperience: false,
  crossBorderAnchor: false,
  unvestedEquityLossClaim: false,
  explodingOfferPressure: false,
  postAcceptanceRenege: false,
  quotaAttainmentClaimed: false,
  gardenLeaveDisclosed: false,
  nonCompeteFlagged: false,
  relocationBonusAsked: false,
  parentInsuranceAsked: false,
  inHandTakehomeFocus: false,
  rtoPushback: false,
  returnshipMaternity: false,
  payBandAsked: false,
  taxStructureAsked: false,
  bgvAnxiety: false,
  esopSophisticationProbe: false,
  spouseJobConstraint: false,
  agingParentCare: false,
  moonlightingDisclosed: false,
  mentalHealthDisclosed: false,
  payParityAsked: false,
  preemptiveCounterReceived: false,
  acceptanceTimeRequest: false,
  cryptoTokenComp: false,
  gccArbitrageAnchor: false,
  benchTimeDisclosed: false,
  founderSecondInnings: false,
  latecareerAgeBias: false,
  /* Wave-3 (2026-05-14j) — 25 new flags. */
  titlePrecisionAsk: false,
  currentCtcRefusal: false,
  pregnancyDisclosed: false,
  boomerangRehire: false,
  referralReceived: false,
  hometownReturnPreference: false,
  pwdDisability: false,
  gratuityVestingNear: false,
  acquisitionContextAsk: false,
  lgbtqDisclosure: false,
  chronicIllnessDisclosed: false,
  noticeBuyoutAsk: false,
  bfsiClawbackContext: false,
  bigFourGradeStep: false,
  securityClearanceNeeded: false,
  missionDrivenComp: false,
  edtechReputationCheck: false,
  acquiHireContext: false,
  cabinParkingAsk: false,
  spanOfControlAsk: false,
  preResignationStealth: false,
  reverseAnchorAsk: false,
  dietaryReligiousNeed: false,
  oldEmployerDocsIssue: false,
  equityRefreshCadenceAsk: false,
  /* Wave-3D (PDF #17 follow-up, 2026-05-15) — equity-instrument depth. */
  equityVestingScheduleAsk: false,
  equityCliffPeriodAsk: false,
  equityExerciseTermsAsk: false,
  equityBuybackLiquidityAsk: false,
  /* Wave-4 (2026-05-14k) — 32 new flags. */
  signOnClawback: false,
  variableTrackRecord: false,
  wfhEquipmentStipend: false,
  salaryReviewCadenceAsk: false,
  multipleOffersJuggling: false,
  recruitmentAgencyMediation: false,
  internalTransferContext: false,
  offerRescindedHistory: false,
  internationalDegreePremium: false,
  domesticTopMbaAnchor: false,
  toxicManagerContext: false,
  visaSponsorshipNeed: false,
  casteReservationContext: false,
  veteranTransition: false,
  singleParentConstraint: false,
  jointFamilyFinancialResp: false,
  paternityLeaveAsk: false,
  menstrualLeavePolicy: false,
  esopExerciseLoanAsk: false,
  preIpoSecondaryAsk: false,
  accelerationTriggerAsk: false,
  esopPerquisiteTaxAsk: false,
  tenderOfferCycleAsk: false,
  probationaryDurationAsk: false,
  offerLetterTurnaroundDemand: false,
  contractToHireAsk: false,
  headcountApprovalCheck: false,
  ipAssignmentClauseAsk: false,
  healthcarePharmaContext: false,
  manufacturingCoreContext: false,
  quickCommerceContext: false,
  d2cConsumerEquity: false,
  /* Wave-5 (ITEM 4, 2026-05-15) — 21 preference / behaviour flags. */
  counterOfferRisk: null,
  /* Wave-6 (2026-05-15) — compensation structure flags. */
  wantsHigherBase: false,
  wantsJoiningBonus: false,
  wantsRelocationAllowance: false,
  /* Wave-7 (2026-05-15) — behavioral/psychological negotiation flags. */
  invokedCompetingOffer: false,
  askedAboutGrowthPath: false,
  gaveInconsistentNumbers: false,
  evasiveOnCurrentCtc: false,

  /* Wave-8 (2026-05-16) defaults */
  mentionedSpouseFamily: false,
  mentionedForm16: false,
  askedAboutReporting: false,
  askedAboutTeamSize: false,
  askedAboutGrowthPath8: false,
  competingOfferAmount: null,

  /* Wave-9 (2026-05-16) defaults */
  mentionedBgvConcern: false,
  mentionedMoonlighting: false,
  gaveRangeNotPoint: false,
  deflectedOnRange: false,
  referencedMarketData: false,
  referencedMarketDataSources: [],
  mentionedTaxImplication: false,

  /* Audit follow-up (2026-05-21) — Wave-fact-disclosure markers. These
   * are typed `?: boolean` on the interface and were silently absent
   * from EMPTY, so consumers spreading `...EMPTY_CANDIDATE_PROFILE`
   * received `undefined` for these fields. The chaos test caught this
   * as schema drift between extract output and EMPTY. Defaults explicit
   * so spread-construction yields a fully-populated profile. */
  currentCtcDisclosed: false,
  fixedVariableSplitDisclosed: false,
  inHandSalaryDisclosed: false,
  noticePeriodDisclosed: false,
  competingOffersDisclosed: false,
  valueProofProvided: false,

  hasAny: false,
};

/* "1-year gap", "6 month break", "took a break of 8 months",
 * "career gap of 2 years" — months-normalized. */
function extractGapMonths(text: string): number | null {
  /* Year-based phrasing */
  const yPat = /\b(?:gap|break|hiatus|sabbatical|career\s+gap|career\s+break|on\s+a\s+break)\s+(?:of\s+)?(\d{1,2})\s+(?:year|yr|years|yrs)\b/i;
  const yPat2 = /\b(\d{1,2})[-\s]?(?:year|yr|years|yrs)\s+(?:gap|break|hiatus|sabbatical|career\s+gap|career\s+break)\b/i;
  for (const re of [yPat, yPat2]) {
    const m = re.exec(text);
    if (m) {
      const y = parseInt(m[1], 10);
      if (Number.isFinite(y) && y >= 1 && y <= 5) return y * 12;
    }
  }
  /* Month-based phrasing */
  const mPat = /\b(?:gap|break|hiatus|sabbatical|career\s+gap|career\s+break|on\s+a\s+break)\s+(?:of\s+)?(\d{1,2})\s+(?:month|mo|months|mos)\b/i;
  const mPat2 = /\b(\d{1,2})[-\s]?(?:month|mo|months|mos)\s+(?:gap|break|hiatus|sabbatical|career\s+gap|career\s+break)\b/i;
  for (const re of [mPat, mPat2]) {
    const m = re.exec(text);
    if (m) {
      const mo = parseInt(m[1], 10);
      if (Number.isFinite(mo) && mo >= 1 && mo <= 60) return mo;
    }
  }
  /* "took a break for 8 months" — generic */
  const generic = /\b(?:took|had)\s+(?:a\s+)?(?:break|gap)\s+(?:for\s+)?(\d{1,2})\s+(month|mo|months|mos|year|yr|years|yrs)\b/i;
  const g = generic.exec(text);
  if (g) {
    const v = parseInt(g[1], 10);
    if (!Number.isFinite(v)) return null;
    const isYear = /year|yr/i.test(g[2]);
    const months = isYear ? v * 12 : v;
    if (months >= 1 && months <= 60) return months;
  }
  return null;
}

const GAP_ACTIVITY_PATTERNS: { kind: CareerGapActivity; pattern: RegExp }[] = [
  {
    kind: "upskill",
    pattern: /\b(?:upskill(?:ing)?|reskill(?:ing)?|certification|cert\s+exam|coursera|udemy|udacity|edx|bootcamp|learning\s+(?:new\s+)?(?:skills?|tech)|self[-\s]?study(?:ing)?|building\s+(?:projects?|portfolio))\b/i,
  },
  {
    kind: "freelance",
    pattern: /\b(?:freelanc(?:e|ing|er)|consult(?:ing|ant)|contract\s+work|independent\s+(?:work|consultant)|side\s+projects?|gig\s+work)\b/i,
  },
  {
    kind: "family",
    pattern: /\b(?:family\s+(?:reasons?|matters|responsibilities|emergency)|personal\s+(?:reasons?|matters)|caring\s+for|caregiver|parental\s+(?:leave|break)|maternity|paternity|child(?:care)?)\b/i,
  },
  {
    kind: "health",
    pattern: /\b(?:health\s+(?:reasons?|issues?|recovery)|medical\s+(?:reasons?|leave|emergency)|surgery|recovery|wellness\s+break|burnout|burn\s+out)\b/i,
  },
  {
    kind: "study",
    pattern: /\b(?:higher\s+studies|masters?|mba|m\.?tech|phd|doctorate|gmat|gre|further\s+studies|pursuing\s+(?:my\s+)?degree|full[-\s]?time\s+(?:course|degree|program))\b/i,
  },
  {
    kind: "job-search",
    pattern: /\b(?:job\s+search(?:ing)?|interview(?:ing)?\s+(?:actively|around)|looking\s+(?:for|around)|exploring\s+(?:options|opportunities)|between\s+jobs)\b/i,
  },
];

const FREQUENT_SWITCH_PATTERNS = [
  /\b(?:switch(?:ed)?|changed|moved\s+(?:between|across))\s+(?:jobs?|companies|roles)\s+(\d+)\s+times?\b/i,
  /\b(\d+)\s+(?:jobs?|companies|switches)\s+in\s+(\d+)\s+(?:year|yr|years|yrs)\b/i,
  /\b(?:job[-\s]?hopp(?:er|ing)|frequent\s+(?:switch(?:er|es)|changes?|moves?)|short\s+stints?|short\s+tenures?)\b/i,
];

const STABLE_TENURE_PATTERNS = [
  /\b(?:stayed\s+(?:for\s+)?(\d+)\+?\s+(?:year|yr|years|yrs)|tenured?\s+(?:for\s+)?(\d+)\+?\s+(?:year|yr|years|yrs)|long\s+tenure|stable\s+(?:career|tenure)|(\d+)\+?\s+(?:year|yr|years|yrs)\s+at\s+(?:my\s+)?(?:current|same|one)\s+(?:company|role|job))\b/i,
];

function extractTenureSignal(text: string): TenureSignal | null {
  /* "switched 4 times" / "4 jobs in 5 years" / "job hopper" — frequent */
  for (const re of FREQUENT_SWITCH_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      /* If pattern captured a count, gate ≥3. Otherwise the keyword
       * pattern is its own evidence. */
      if (m[1] && m[2]) {
        const jobs = parseInt(m[1], 10);
        const yrs = parseInt(m[2], 10);
        if (Number.isFinite(jobs) && Number.isFinite(yrs) && jobs >= 3 && yrs <= 6) {
          return "frequent";
        }
      } else if (m[1]) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n >= 3) return "frequent";
      } else {
        return "frequent";
      }
    }
  }
  for (const re of STABLE_TENURE_PATTERNS) {
    const m = re.exec(text);
    if (m) {
      const yearsStr = m[1] || m[2] || m[3];
      if (yearsStr) {
        const y = parseInt(yearsStr, 10);
        if (Number.isFinite(y) && y >= 4) return "stable";
      } else {
        return "stable";
      }
    }
  }
  return null;
}

const OVER_PATTERNS = [
  /\b(?:over[-\s]?qualified|overqualified|seem\s+over[-\s]?qualified|may\s+(?:be|seem)\s+over[-\s]?qualified|too\s+(?:senior|experienced)\s+for|higher\s+level\s+than\s+(?:this|the)\s+role)\b/i,
];

const UNDER_PATTERNS = [
  /\b(?:under[-\s]?qualified|underqualified|not\s+match(?:ing)?\s+every\s+requirement|short\s+on\s+(?:yoe|experience|years)|less\s+experience\s+than|don.?t\s+match\s+(?:the\s+)?(?:level|requirements?)|may\s+not\s+match\s+every\s+requirement)\b/i,
];

function extractLevelMismatch(text: string): LevelMismatch | null {
  if (OVER_PATTERNS.some((p) => p.test(text))) return "over";
  if (UNDER_PATTERNS.some((p) => p.test(text))) return "under";
  return null;
}

/* Phase 25b — domain-pivot patterns. Two flavours: explicit transition
 * ("moving from teaching to sales", "career change") and "transferable
 * skills" framing that almost always accompanies a pivot. We require
 * a transition phrase OR an explicit pivot keyword; transferable-skills
 * alone is too noisy (anyone might say it in passing). */
const DOMAIN_PIVOT_PATTERNS: RegExp[] = [
  /\b(?:transition(?:ing)?|moving|switching|pivot(?:ing)?|shift(?:ing)?)\s+(?:from|out\s+of|into)\s+\w+(?:\s+\w+){0,3}\s+(?:to|into)\s+\w+/i,
  /\b(?:career\s+(?:change|switch|pivot|transition)|domain\s+(?:change|switch|pivot)|changing\s+(?:domain|field|industry|function))\b/i,
  /\bfrom\s+(?:teaching|design|support|qa|sales|marketing|finance|consulting|operations|hr|customer\s+success)\s+to\s+(?:edtech|product|engineering|pm|data|design|marketing|sales|qa)\b/i,
  /\b(?:i\s+am|i'm|am)\s+(?:transitioning|making\s+a\s+transition|making\s+a\s+pivot|making\s+a\s+switch)\b/i,
];

const TRANSFERABLE_SKILLS_PATTERNS: RegExp[] = [
  /\btransferable\s+skills?\b/i,
  /\b(?:my\s+)?(?:experience|background|skills?)\s+(?:translates?|maps?|carr(?:y|ies))\s+(?:over|across|directly)\b/i,
  /\b(?:adjacent|cross[-\s]?functional|cross[-\s]?domain)\s+(?:skills?|experience|expertise)\b/i,
];

function detectDomainPivot(text: string): {
  domainPivot: boolean;
  transferableSkillsClaimed: boolean;
} {
  const pivot = DOMAIN_PIVOT_PATTERNS.some((p) => p.test(text));
  const transferable = TRANSFERABLE_SKILLS_PATTERNS.some((p) => p.test(text));
  return {
    domainPivot: pivot,
    /* Only count "transferable skills" claims in the context of a pivot
     * — otherwise an SWE saying "my skills carry over to this role" at
     * the same company false-fires. */
    transferableSkillsClaimed: pivot && transferable,
  };
}

/* Phase 25b — payroll-history patterns. "delayed" beats "unpaid" only
 * if both fire; unpaid is the more severe signal so we prefer it when
 * both are present. */
const DELAYED_SALARY_PATTERNS: RegExp[] = [
  /\b(?:salary|salaries|pay(?:cheques?|checks?)?|wages?|comp(?:ensation)?)\s+(?:was|were|got|has\s+been|have\s+been|is\s+being)\s+(?:delayed|late|deferred|withheld\s+briefly)\b/i,
  /\b(?:delayed|late|deferred)\s+(?:salary|salaries|pay(?:cheques?|checks?)?|wages?|payroll)\b/i,
  /\bpayroll\s+(?:was\s+)?(?:delayed|late|deferred|inconsistent|irregular)\b/i,
  /\b(?:company|employer)\s+(?:was|has\s+been)\s+(?:delaying|withholding)\s+(?:salary|payment|pay)/i,
];

const UNPAID_SALARY_PATTERNS: RegExp[] = [
  /\b(?:salary|salaries|wages?|pay(?:cheques?|checks?)?)\s+(?:was|were|has\s+been|have\s+been)\s+unpaid\b/i,
  /\b(?:unpaid|outstanding)\s+(?:salary|salaries|wages?|dues?|payroll|months?)\b/i,
  /\b(?:didn't|did\s+not|hasn'?t|haven'?t)\s+(?:get|receive|been\s+paid)\s+(?:salary|paid|paycheck|wages?)\s+(?:for\s+|in\s+)?(?:\d+\s+)?(?:months?|weeks?)/i,
  /\b(?:not\s+been\s+paid|haven'?t\s+been\s+paid|unpaid\s+for|owed)\s+(?:for\s+)?\d+\s+(?:months?|weeks?)/i,
];

function detectCompensationHistoryIssue(
  text: string,
): CompensationHistoryIssue | null {
  if (UNPAID_SALARY_PATTERNS.some((p) => p.test(text))) return "unpaid";
  if (DELAYED_SALARY_PATTERNS.some((p) => p.test(text))) return "delayed";
  return null;
}

/* Phase 26 — service-agreement / training-bond patterns. Fires when the
 * candidate either accepts a bond or is being explicitly asked about
 * one in a current/prior employment context. The red-flag layer then
 * surfaces it as "unverified" unless the candidate also discussed exit
 * conditions / financial penalty. */
const SERVICE_BOND_PATTERNS: RegExp[] = [
  /\bservice\s+(?:agreement|bond|commitment)\b/i,
  /\btraining\s+bond\b/i,
  /\b(?:\d+)[-\s]?(?:year|yr|years|yrs)\s+(?:bond|commitment|service\s+agreement)\b/i,
  /\bsigned?\s+a?\s+bond\b/i,
  /\bbond\s+(?:period|amount|penalty|clause|terms?)\b/i,
];

function detectServiceBond(text: string): boolean {
  return SERVICE_BOND_PATTERNS.some((p) => p.test(text));
}

/* Phase 26 — probation-comp patterns. The probation period typically
 * carries a lower salary than post-confirmation comp; recruiters often
 * leave this implicit. Fires when probation is mentioned alongside a
 * comp/salary token, OR explicitly named as a comp period. */
const PROBATION_COMP_PATTERNS: RegExp[] = [
  /\bprobation\s+(?:period|salary|comp(?:ensation)?|pay|ctc)\b/i,
  /\b(?:during|in)\s+probation\b/i,
  /\bpost[-\s]?(?:confirmation|probation)\s+(?:salary|comp|ctc|pay)\b/i,
  /\b(?:after|once)\s+(?:confirmation|probation)\s+(?:i|my|the)?\s*(?:salary|ctc|pay|comp)/i,
];

function detectProbationComp(text: string): boolean {
  return PROBATION_COMP_PATTERNS.some((p) => p.test(text));
}

/* Fresher-flow extension (2026-05-14). Intern-to-fulltime conversion
 * detection. Fires when the candidate signals that the current
 * negotiation is for converting a prior or current internship into
 * a full-time role — a "PPO" (pre-placement offer) in Indian campus
 * recruiting parlance. Common phrasings:
 *   - "PPO", "pre-placement offer", "pre placement offer"
 *   - "convert my internship", "convert the internship", "internship to full-time"
 *   - "I interned with you", "I interned here", "I was your intern"
 *   - "intern conversion"
 * Pure. */
const INTERNSHIP_CONVERSION_PATTERNS: RegExp[] = [
  /\bppo\b/i,
  /\bpre[-\s]?placement\s+offer\b/i,
  /\bconvert(?:ing|ed)?\s+(?:my\s+|the\s+)?internship\b/i,
  /\binternship\s+(?:to|into)\s+full[-\s]?time\b/i,
  /\bintern(?:ed|ing)?\s+(?:with|at|for)\s+you\b/i,
  /\bi\s+(?:was|am)\s+(?:your|the)\s+intern\b/i,
  /\bintern\s+conversion\b/i,
];

function detectInternshipConversion(text: string): boolean {
  return INTERNSHIP_CONVERSION_PATTERNS.some((p) => p.test(text));
}

/* ─── Fresher-flow extension (2026-05-14c) — college-tier detection ──
 *
 * Indian campus hiring outcomes correlate strongly with college tier.
 * Three patterns recognized:
 *
 *   tier-1 — explicit IIT/IISc/NIT/IIIT-H/BITS Pilani/IIM mentions,
 *     plus generic "tier-1 college", "top-tier institute", "premier
 *     institute" labels.
 *   tier-2 — VIT/SRM/Manipal/DTU/NSUT/COEP/PEC/Thapar mentions, plus
 *     "tier-2 college" label.
 *   tier-3 — explicit "tier-3 college" / "non-tier-1" label; we do NOT
 *     try to enumerate private colleges by name (too many, too noisy).
 *
 * Conservative: only fires on clear name match or unambiguous tier
 * label. Returns null when the candidate just says "engineering
 * college" or "did my B.Tech" without naming it. */
const COLLEGE_TIER_1_PATTERNS: RegExp[] = [
  /\biit\s*[-(\s]?(?:bombay|delhi|madras|kanpur|kharagpur|roorkee|guwahati|hyderabad|bhilai|gandhinagar|indore|jodhpur|mandi|patna|ropar|tirupati|varanasi|bhubaneswar|dhanbad|goa|palakkad|jammu|dharwad)?[)\s]/i,
  /\b(?:iit|iisc|iiit[-\s]?(?:h|hyderabad|delhi|bangalore))\b/i,
  /\bnit\s*(?:trichy|warangal|surathkal|calicut|rourkela|allahabad|kurukshetra|nagpur)?\b/i,
  /\bbits\s+(?:pilani|hyderabad|goa|dubai)?\b/i,
  /\biim\s+(?:ahmedabad|bangalore|calcutta|kozhikode|lucknow|indore)\b/i,
  /\b(?:tier[-\s]?1|tier[-\s]?one)\s+(?:college|institute|school)\b/i,
  /\b(?:top[-\s]?tier|premier)\s+(?:college|institute|engineering\s+college)\b/i,
];
const COLLEGE_TIER_2_PATTERNS: RegExp[] = [
  /\b(?:vit|srm|manipal|dtu|nsut|coep|pec\s+chandigarh|thapar|amity|christ|symbiosis)\b/i,
  /\b(?:tier[-\s]?2|tier[-\s]?two)\s+(?:college|institute|school)\b/i,
];
const COLLEGE_TIER_3_PATTERNS: RegExp[] = [
  /\b(?:tier[-\s]?3|tier[-\s]?three)\s+(?:college|institute|school)\b/i,
  /\b(?:non[-\s]?tier[-\s]?1|non[-\s]?premier)\s+(?:college|institute)\b/i,
];

/* ─── Junior-flow extensions (2026-05-14e) ────────────────────────── */

/* `earlySwitcher` — candidate is on their first or second job switch
 * within ≤2 years of total experience. Distinct from frequent-switcher
 * (≥3 switches). Three classes of evidence:
 *   - explicit "first job switch", "first switch", "switching for the
 *     first time"
 *   - "1 year" or "X months" tenure + currently looking ("switching",
 *     "moving", "looking for change") — captures "I've been at TCS for
 *     1 year and now want to switch"
 *   - "first job" + "X months/years" + transition language */
const EARLY_SWITCHER_PATTERNS: RegExp[] = [
  /\bfirst\s+(?:job\s+)?(?:switch|move|change|transition|jump)\b/i,
  /\b(?:switching|moving|changing)\s+(?:jobs?|companies)\s+for\s+the\s+first\s+time\b/i,
  /\b(?:i'?ve\s+been|been|after)\s+(?:at\s+\w+\s+|here\s+|with\s+\w+\s+)?(?:for\s+)?(?:about\s+|just\s+|only\s+)?(\d+)\s+(?:month|mo|months|mos|year|yr|years|yrs)\b.{0,80}\b(?:looking|switching|moving|change|want\s+to\s+(?:switch|move|leave|change))\b/i,
  /\bonly\s+(?:about\s+|just\s+)?(\d+)\s+(?:month|months|year|years|yr|yrs)\s+(?:at|in)\b.{0,40}\b(?:switching|moving|change)\b/i,
];

function detectEarlySwitcher(text: string): boolean {
  for (const re of EARLY_SWITCHER_PATTERNS) {
    const m = re.exec(text);
    if (!m) continue;
    /* When a tenure-count is captured, require ≤24 months — anything
     * above 2 years stops being "early". When no number is captured
     * (explicit "first switch" phrasing), the keyword is its own
     * evidence. */
    if (m[1]) {
      const n = parseInt(m[1], 10);
      if (!Number.isFinite(n)) continue;
      const isYear = /year|yr/i.test(m[0]);
      const months = isYear ? n * 12 : n;
      if (months <= 24) return true;
    } else {
      return true;
    }
  }
  return false;
}

/* `lowCtcAlert` — candidate self-states that their current CTC is
 * below market or below what their skills warrant. Fires the
 * "market-anchor-not-hike" reframe in LEVER_GUIDANCE. Conservative:
 * needs explicit self-statement, not just a low number — the numeric
 * check is the kernel's job (state.candidateCurrentCtc vs band). */
const LOW_CTC_PATTERNS: RegExp[] = [
  /\b(?:my\s+(?:current\s+)?(?:salary|ctc|pay|comp(?:ensation)?))\s+(?:is\s+)?(?:low|below\s+market|under\s+market|underpaid|much\s+lower|too\s+low|on\s+the\s+lower\s+side)\b/i,
  /\b(?:i'?m|i\s+am|i\s+feel)\s+(?:underpaid|undervalued|under[-\s]?compensated|under\s+market|below\s+market)\b/i,
  /\b(?:current|prior|last)\s+(?:salary|ctc|pay|package)\s+(?:doesn'?t|does\s+not|never)\s+(?:reflect|match|capture|represent)\s+(?:my\s+)?(?:current\s+|actual\s+|real\s+)?(?:skill|skills|level|responsibilities|work|value)\b/i,
  /\b(?:underpaid\s+for|under\s+market\s+for)\s+(?:my\s+|the\s+)?(?:role|skill|work|level)\b/i,
];

function detectLowCtcAlert(text: string): boolean {
  return LOW_CTC_PATTERNS.some((p) => p.test(text));
}

/* `priorInternshipNonConversion` — candidate did an internship at a
 * DIFFERENT company before their current/prior full-time role. The
 * internship is a credential on the resume, not a PPO conversion
 * event for this negotiation. Distinct from `internshipConversion`:
 *   - internshipConversion = "I'm your intern, converting to FT"
 *   - priorInternshipNonConversion = "I interned at Google, then joined
 *     TCS, now applying to Flipkart" */
const PRIOR_INTERNSHIP_NONCONVERSION_PATTERNS: RegExp[] = [
  /\b(?:i\s+)?intern(?:ed|ship)\s+(?:at|with|for)\s+(?!you\b|us\b|here\b|this\s+company\b)\w+/i,
  /\b(?:summer\s+intern(?:ship)?|winter\s+intern(?:ship)?|industrial\s+trainee)\s+(?:at|with)\s+\w+/i,
  /\b(?:after\s+(?:my\s+)?internship|post[-\s]?internship)\s+(?:i\s+)?(?:joined|moved|went\s+to|started)\b/i,
  /\b(?:did|completed|finished)\s+(?:an?\s+|my\s+)?internship\s+(?:before|prior\s+to|earlier)\b/i,
];

function detectPriorInternshipNonConversion(text: string, isConversionDetected: boolean): boolean {
  if (isConversionDetected) return false; /* current PPO trumps prior credential */
  return PRIOR_INTERNSHIP_NONCONVERSION_PATTERNS.some((p) => p.test(text));
}

/* `serviceCompanyBackground` — candidate works at / came from an
 * Indian IT-services company. Two classes of evidence:
 *   - explicit company name (TCS/Infosys/Wipro/Cognizant/HCL/TechM/
 *     Mindtree/LTI/L&T Infotech/Capgemini/Accenture-India/IBM-India/
 *     DXC/Mphasis)
 *   - self-label ("service company", "service background", "from
 *     services side", "IT services") */
const SERVICE_COMPANY_PATTERNS: RegExp[] = [
  /\b(tcs|infosys|wipro|cognizant|hcl\s+(?:tech|technologies)?|tech\s+mahindra|techm|mindtree|lti|l&t\s+infotech|capgemini|accenture(?:\s+india)?|ibm\s+india|dxc|mphasis|persistent\s+systems|hexaware|coforge|birlasoft|kpit|cyient|nseit|sonata)\b/i,
  /\b(?:it[-\s]?services|service[-\s]company|service[-\s]background|services\s+side|services\s+company|services\s+firm)\b/i,
  /\b(?:from|in|at)\s+(?:a\s+)?service[-\s]?(?:based\s+)?(?:company|firm|background|side)\b/i,
];

function detectServiceCompanyBackground(text: string): boolean {
  return SERVICE_COMPANY_PATTERNS.some((p) => p.test(text));
}

/* `compBreakupUnknown` — candidate self-states they don't know their
 * fixed/variable/CTC breakup. Common at 3-6 YoE in IT-services where
 * the offer letter shows a headline number and the structure is
 * opaque to the candidate. The recruiter should coach (state the
 * structure they would offer) rather than negotiate against unknowns. */
const COMP_BREAKUP_UNKNOWN_PATTERNS: RegExp[] = [
  /\b(?:i\s+(?:don'?t|do\s+not)\s+know|not\s+sure(?:\s+of)?|haven'?t\s+checked|haven'?t\s+seen|need\s+to\s+(?:check|confirm|verify))\s+(?:(?:my|the|exact|exactly)\s+){0,3}(?:base|fixed|variable|breakup|break[-\s]?up|split|structure|component|breakdown|fixed[-\s/]+variable)\b/i,
  /\b(?:my\s+)?(?:base|fixed|variable|breakup|break[-\s]?up|split|structure)\s+(?:is\s+)?(?:not\s+clear|unclear|something\s+i\s+(?:would\s+)?need\s+to\s+check)\b/i,
  /\b(?:i\s+only\s+know|i\s+(?:just\s+)?know)\s+(?:the\s+)?(?:total\s+ctc|headline\s+(?:number|figure|ctc)|ctc\s+number)\b/i,
  /\b(?:don'?t|do\s+not)\s+(?:remember|recall)\s+(?:the\s+)?(?:exact\s+)?(?:base|fixed|variable|breakup|split|structure|breakdown)\b/i,
];

function detectCompBreakupUnknown(text: string): boolean {
  return COMP_BREAKUP_UNKNOWN_PATTERNS.some((p) => p.test(text));
}

/* ─── Real-world Indian extensions (2026-05-14g) ────────────────────── */

/* `recentLayoff` — candidate was let go in a layoff / RIF / company
 * shutdown. Common 2024-2026 pattern (Byju's, Unacademy, Vedantu,
 * crypto-winter, generic edtech/startup shutdowns). Distinguished
 * from "I quit" — fires on involuntary separation cause language. */
const RECENT_LAYOFF_PATTERNS: RegExp[] = [
  /\b(?:i\s+was|got|i\s+got|been|recently)\s+(?:laid[-\s]?off|let\s+go|made\s+redundant|impacted|affected)\b/i,
  /\b(?:layoff|lay[-\s]?off|layoffs|riff?|reduction\s+in\s+force|mass\s+layoff|workforce\s+reduction)\b/i,
  /\b(?:part\s+of\s+(?:the\s+)?(?:layoffs?|riff?|cuts?|reduction)|in\s+(?:the\s+)?(?:layoffs?|riff?))\b/i,
  /\b(?:company|startup|byju'?s?|unacademy|vedantu|udaan|cars24|ola|paytm)\s+(?:shut\s+down|shutdown|wound\s+down|went\s+under|filed\s+for\s+bankruptcy|closed\s+(?:down|operations))\b/i,
  /\b(?:my\s+)?(?:role|position|team|division|business\s+unit)\s+(?:was|got)\s+(?:eliminated|cut|shut\s+down|wound\s+down|dissolved)\b/i,
];

function detectRecentLayoff(text: string): boolean {
  return RECENT_LAYOFF_PATTERNS.some((p) => p.test(text));
}

/* `hotDomainPremium` — candidate's role / specialty is in a hot
 * 2026 bucket commanding 30-50% premium over std SWE: AI/ML/GenAI/
 * LLM/applied-ML, Security/AppSec/InfoSec/cybersec, Quant/HFT.
 * Conservative: requires an explicit specialty mention in a
 * comp / role / experience context. The kernel's domain classifier
 * is independent — this fires when the CANDIDATE invokes the
 * specialty as a comp-justification signal. */
const HOT_DOMAIN_PREMIUM_PATTERNS: RegExp[] = [
  /\b(?:gen[-\s]?ai|generative\s+ai|llm\s+(?:engineer|engineering|ops|infra|training|fine[-\s]?tuning)|prompt\s+engineer|foundation\s+model|rag\s+(?:engineer|pipeline)|agentic\s+(?:ai|systems?))\b/i,
  /\b(?:applied\s+ml|ml\s+(?:engineer|infra|platform|ops|research|scientist)|machine\s+learning\s+(?:engineer|scientist|infrastructure)|ai\s+(?:engineer|scientist|researcher))\b/i,
  /\b(?:appsec|app[-\s]?sec|application\s+security|security\s+engineer|infosec|cybersecurity|cyber\s+security|red\s+team|offensive\s+security|pen[-\s]?test(?:er|ing)?|cloud\s+security)\b/i,
  /\b(?:quant(?:itative)?\s+(?:researcher|developer|trader|analyst)|hft|high[-\s]?frequency\s+trading|low[-\s]?latency\s+trading|trading\s+systems)\b/i,
  /\b(?:premium\s+for|market\s+premium|skill\s+premium|domain\s+premium|specialist\s+premium)\s+(?:ai|ml|gen[-\s]?ai|security|llm|quant)\b/i,
];

function detectHotDomainPremium(text: string): boolean {
  return HOT_DOMAIN_PREMIUM_PATTERNS.some((p) => p.test(text));
}

/* `pipDisclosed` — candidate volunteered that they are on / were on a
 * Performance Improvement Plan, or were forced out / asked to leave
 * for performance reasons. HIGH-RISK oversharing — the AI should
 * NOT pile on, should coach against further disclosure, and should
 * NOT use it to anchor down. Conservative: only fires on explicit
 * PIP / forced-exit language. */
const PIP_DISCLOSED_PATTERNS: RegExp[] = [
  /\b(?:pip|p\.?i\.?p\.?|performance\s+improvement\s+plan)\b/i,
  /\b(?:on\s+a\s+pip|put\s+on\s+a?\s*pip|placed\s+on\s+a?\s*pip)\b/i,
  /\b(?:asked\s+to\s+leave|forced\s+(?:to\s+)?(?:resign|leave|exit)|forced\s+out|managed\s+out|pushed\s+out)\b/i,
  /\b(?:performance\s+(?:issues?|concerns?|reasons?|exit|termination))\b/i,
  /\b(?:terminated\s+for\s+performance|fired\s+for\s+performance|let\s+go\s+for\s+performance)\b/i,
];

function detectPipDisclosed(text: string): boolean {
  return PIP_DISCLOSED_PATTERNS.some((p) => p.test(text));
}

/* `verbalOnlyOffer` — candidate states the offer is verbal / no
 * written offer letter / waiting on offer letter / promised
 * verbally. Recruiter should commit to a written-offer date and
 * spell out the terms. */
const VERBAL_ONLY_OFFER_PATTERNS: RegExp[] = [
  /\b(?:verbal\s+(?:offer|commitment|agreement|confirmation)|offered\s+verbally|told\s+verbally|verbally\s+(?:offered|confirmed|told|promised|committed))\b/i,
  /\b(?:no\s+(?:offer\s+letter|written\s+offer|ol\b)\s+(?:yet|so\s+far)|still\s+(?:waiting|awaiting)\s+(?:for\s+)?(?:the\s+)?(?:offer\s+letter|written\s+offer|ol\b))\b/i,
  /\b(?:offer\s+letter\s+(?:is\s+)?(?:pending|not\s+(?:yet\s+)?(?:received|received\s+yet|issued)|delayed))\b/i,
  /\b(?:nothing\s+in\s+writing|haven'?t\s+(?:received|gotten|got)\s+(?:the\s+)?(?:written\s+)?(?:offer|ol\b)|need\s+(?:it|the\s+offer)\s+in\s+writing)\b/i,
];

function detectVerbalOnlyOffer(text: string): boolean {
  return VERBAL_ONLY_OFFER_PATTERNS.some((p) => p.test(text));
}

/* `culturalJoiningConstraint` — Indian-specific joining-date
 * constraint rooted in a cultural / family event. Muhurat (auspicious
 * date), wedding, Diwali / Holi / Eid / Karva Chauth, sibling
 * wedding, family function, gruhapravesham (housewarming). The
 * recruiter should accommodate, not push back. */
const CULTURAL_JOINING_PATTERNS: RegExp[] = [
  /\b(?:muhurat|muhurtham|muhurath|auspicious\s+(?:date|day|time))\b/i,
  /\b(?:after|post|before)\s+(?:my\s+|the\s+|sister'?s?\s+|brother'?s?\s+)?(?:wedding|marriage|engagement|reception)\b/i,
  /\b(?:my\s+|sister'?s?\s+|brother'?s?\s+|cousin'?s?\s+)?wedding\s+(?:is\s+)?(?:in|on|scheduled|coming\s+up|happening|planned)\b/i,
  /\b(?:after|post|before|around|during)\s+(?:diwali|holi|eid|onam|pongal|navratri|ganesh\s+chaturthi|durga\s+puja|christmas|new\s+year)\b/i,
  /\b(?:family\s+(?:function|event|wedding|ceremony|obligation|commitment)|gruhapravesham|housewarming|griha\s+pravesh|naming\s+ceremony)\b/i,
  /\b(?:can(?:not|'t)\s+join|unable\s+to\s+join|need\s+to\s+delay\s+joining)\s+(?:before|until|till)\s+(?:diwali|wedding|muhurat|after\s+the\s+festival)\b/i,
];

function detectCulturalJoiningConstraint(text: string): boolean {
  return CULTURAL_JOINING_PATTERNS.some((p) => p.test(text));
}

/* ─── Senior-flow + process + long-tail (2026-05-14h) ──────────────── */

/* `peopleManagementClaimed` — candidate self-states management scope. */
const PEOPLE_MGMT_PATTERNS: RegExp[] = [
  /\b(?:i\s+(?:lead|manage|run|head))\s+(?:a\s+)?(?:team\s+of\s+)?\d+\s+(?:engineers?|people|reports?|folks|members|developers?|designers?|analysts?|managers?)\b/i,
  /\b(?:i\s+have|managing|leading)\s+\d+\s+(?:direct\s+)?reports?\b/i,
  /\b(?:engineering\s+manager|eng\s+manager|em\b|director\s+of\s+engineering|head\s+of\s+(?:engineering|product|design|data)|senior\s+(?:engineering\s+)?manager|tech\s+lead\s+manager|tlm\b|people\s+manager|line\s+manager)\b/i,
  /\b(?:team\s+of\s+\d+|\d+\s+person\s+team|\d+[-\s]person\s+team)\b/i,
  /\b(?:managing|leading|owned)\s+(?:a\s+)?(?:team|squad|pod|tribe)\s+(?:of\s+)?(?:engineers?|people|designers?|analysts?)/i,
];
function detectPeopleManagementClaimed(text: string): boolean {
  return PEOPLE_MGMT_PATTERNS.some((p) => p.test(text));
}

/* `mncExperience` — candidate states prior/current MNC / big-tech /
 *  GCC / large-product-company affiliation. Resume-seed wins on
 *  conflict, but stated utterances can flip the flag true on their own
 *  when no resume is available. Conservative — requires a named
 *  company or an explicit MNC/big-tech context phrase. */
const MNC_EXPERIENCE_PATTERNS: RegExp[] = [
  /\b(?:i(?:'ve|\s+have)?\s+worked|i\s+work(?:ed)?|i'?m\s+(?:at|with)|i\s+spent|my\s+(?:current|last|previous|prior)\s+(?:role|job|company|employer)\s+(?:is|was)\s+(?:at\s+)?)\s+(?:at\s+|with\s+|@\s*|in\s+)?(?:google|alphabet|microsoft|amazon|meta|facebook|apple|netflix|adobe|salesforce|atlassian|nvidia|uber|airbnb|stripe|databricks|snowflake|servicenow|oracle|sap|ibm|intel|qualcomm|cisco|vmware|paypal|linkedin|twitter|x\s+corp|tiktok|bytedance|samsung|sony|walmart\s+labs?|target\s+tech)\b/i,
  /\b(?:i(?:'ve|\s+have)?\s+worked|i\s+work(?:ed)?|i'?m\s+(?:at|with))\s+(?:at\s+|with\s+|in\s+)?(?:flipkart|freshworks|zoho|swiggy|zomato|paytm|phonepe|razorpay|cred|byju|nykaa|mphasis|jpmc|jp\s+morgan|goldman\s+sachs|morgan\s+stanley|citi|wells\s+fargo|barclays)\b/i,
  /\b(?:worked|working|spent\s+\d+\s+(?:years?|yrs?))\s+(?:at|with|in|for)\s+(?:an?\s+)?(?:mnc|multinational|fortune\s*\d+|big[-\s]?tech|big\s+four|big\s+4|gcc|global\s+capability\s+center)\b/i,
  /\b(?:my\s+)?(?:mnc|multinational|fortune\s*\d+|big[-\s]?tech|gcc)\s+(?:background|experience|tenure|exposure)\b/i,
];
function detectMncExperience(text: string): boolean {
  if (!text) return false;
  return MNC_EXPERIENCE_PATTERNS.some((p) => p.test(text));
}

/* `crossBorderAnchor` — candidate cites overseas TC / return-to-India. */
const CROSS_BORDER_PATTERNS: RegExp[] = [
  /\b(?:returning|moving\s+back|coming\s+back|relocat(?:ing|ed))\s+(?:to\s+india\s+)?from\s+(?:the\s+)?(?:us|usa|united\s+states|bay\s+area|silicon\s+valley|seattle|new\s+york|sf|san\s+francisco|singapore|sg|dubai|uae|london|uk|united\s+kingdom|canada|australia|berlin|germany|netherlands|amsterdam|zurich|switzerland)\b/i,
  /\b(?:my|current|prior|last)\s+(?:tc|total\s+comp(?:ensation)?|salary|package|comp(?:ensation)?)\s+(?:is|was)\s+(?:\$|usd|sgd|gbp|eur|aed|cad|aud)\s*[\d,.]+/i,
  /\b(?:bay\s+area|silicon\s+valley|us\s+market|singapore\s+market|dubai\s+market|london\s+market)\s+(?:tc|comp|salary|package|rates?|standards?)\b/i,
  /\b(?:nri|non[-\s]resident\s+indian|h1b|h[-\s]?1b|green\s+card|ep\s+pass|employment\s+pass)\b/i,
  /\b(?:return(?:ing)?\s+to\s+india|move\s+back\s+to\s+india|coming\s+home\s+to\s+india)\b/i,
];
function detectCrossBorderAnchor(text: string): boolean {
  return CROSS_BORDER_PATTERNS.some((p) => p.test(text));
}

/* `unvestedEquityLossClaim` — candidate cites unvested equity loss. */
const UNVESTED_EQUITY_PATTERNS: RegExp[] = [
  /\b(?:unvested|leaving\s+behind|walking\s+away\s+from|forfeit(?:ing)?|losing)\s+(?:my\s+|the\s+)?(?:rsus?|stock|equity|options?|shares?|grant|esops?|vesting)\b/i,
  /\b(?:rsus?|stock|equity|options?|esops?)\s+(?:left|remaining|outstanding|unvested|not\s+(?:yet\s+)?vested)\b/i,
  /\b(?:underwater|out\s+of\s+the\s+money|otm)\s+(?:options?|stock|equity|grants?)\b/i,
  /\b(?:signing\s+bonus|joining\s+bonus|sign[-\s]on|sign\s+on)\s+(?:to\s+)?(?:offset|cover|make\s+up\s+for|compensate)\s+(?:the\s+)?(?:unvested|loss|equity|rsus?|stock)\b/i,
  /\b(?:make\s+(?:me\s+)?whole|whole\s+(?:me\s+)?up)\s+(?:for|on)\s+(?:the\s+)?(?:unvested|rsus?|equity|stock|grant)\b/i,
];
function detectUnvestedEquityLossClaim(text: string): boolean {
  return UNVESTED_EQUITY_PATTERNS.some((p) => p.test(text));
}

/* `explodingOfferPressure` — another company gave a tight deadline. */
const EXPLODING_OFFER_PATTERNS: RegExp[] = [
  /\b(?:exploding\s+offer|24[-\s]?hour\s+(?:deadline|window)|48[-\s]?hour\s+(?:deadline|window)|72[-\s]?hour\s+(?:deadline|window))\b/i,
  /\b(?:they|other\s+(?:company|recruiter|offer|firm))\s+(?:want|wants|need|needs|gave\s+me|are\s+giving\s+me|said)\s+(?:a\s+)?(?:decision|answer|response)\s+(?:in|within|by)\s+(?:\d+\s+)?(?:hours?|days?|tomorrow|tonight|end\s+of\s+(?:day|week))\b/i,
  /\b(?:decide|decision)\s+(?:by\s+)?(?:tomorrow|tonight|end\s+of\s+(?:day|week)|in\s+\d+\s+(?:hours?|days?))\b/i,
  /\b(?:pressured|pressuring|rushing|rushed)\s+(?:me\s+)?(?:to\s+)?(?:decide|accept|sign|commit)\b/i,
  /\b(?:offer\s+expires?|expires?\s+(?:in|on)|valid\s+(?:for\s+)?(?:only\s+)?(?:\d+\s+)?(?:hours?|days?))\b/i,
];
function detectExplodingOfferPressure(text: string): boolean {
  return EXPLODING_OFFER_PATTERNS.some((p) => p.test(text));
}

/* `postAcceptanceRenege` — candidate has reneged before or is now. */
const POST_ACCEPTANCE_RENEGE_PATTERNS: RegExp[] = [
  /\b(?:accepted\s+(?:another\s+offer\s+)?(?:then|but)\s+(?:reneged|backed\s+out|changed\s+my\s+mind|declined|reneg(?:ed|ing)))\b/i,
  /\b(?:renege|reneged|reneging|back\s+out\s+of|backed\s+out\s+of|backing\s+out\s+of|pulling\s+out\s+of)\s+(?:an?\s+|the\s+)?(?:offer|acceptance|commitment)\b/i,
  /\b(?:dropping|drop|ghost(?:ing|ed)?)\s+(?:another\s+offer|previously\s+accepted\s+offer|the\s+previous\s+offer)\b/i,
  /\b(?:already\s+(?:accepted|signed)\s+(?:another|a\s+different)\s+offer\s+(?:but|and\s+now))\b/i,
  /\b(?:bait\s+and\s+switch|reneged\s+on|broke\s+(?:my\s+|the\s+)?commitment)\b/i,
];
function detectPostAcceptanceRenege(text: string): boolean {
  return POST_ACCEPTANCE_RENEGE_PATTERNS.some((p) => p.test(text));
}

/* `quotaAttainmentClaimed` — sales candidate cites attainment metric. */
const QUOTA_ATTAINMENT_PATTERNS: RegExp[] = [
  /\b(?:hit|achieved|attained|exceeded|crushed|beat|delivered)\s+\d{2,3}\s*%\s+(?:of\s+)?(?:my\s+|the\s+)?(?:quota|target|number|plan)\b/i,
  /\b\d{2,3}\s*%\s+(?:quota|target|attainment|of\s+plan|to\s+quota|to\s+target)\b/i,
  /\b(?:president'?s?\s+club|club\s+winner|top\s+performer|top\s+(?:\d+\s*%|quartile|decile)|rep\s+of\s+the\s+(?:year|quarter))\b/i,
  /\b(?:quota\s+attainment|attainment\s+(?:of|was|is)|quota[-\s]carrying)\b/i,
  /\b(?:closed|booked|brought\s+in|generated)\s+(?:\$|usd|inr|₹|rs\.?)\s*[\d,.]+\s*(?:m|mn|million|cr|crore|lakhs?|l|k)\s+(?:in\s+)?(?:arr|bookings|revenue|pipeline|deals?)/i,
];
function detectQuotaAttainmentClaimed(text: string): boolean {
  return QUOTA_ATTAINMENT_PATTERNS.some((p) => p.test(text));
}

/* `gardenLeaveDisclosed` — candidate is on / will be on garden leave. */
const GARDEN_LEAVE_PATTERNS: RegExp[] = [
  /\bgarden(?:ing)?\s+leave\b/i,
  /\b(?:on\s+|in\s+)?(?:paid\s+leave|paid\s+notice|paid\s+sit[-\s]out)\s+(?:period|between\s+jobs|until|till)\b/i,
  /\b(?:asked|told|forced)\s+to\s+(?:sit\s+out|stay\s+home|not\s+work)\s+(?:my\s+|the\s+)?notice\b/i,
];
function detectGardenLeaveDisclosed(text: string): boolean {
  return GARDEN_LEAVE_PATTERNS.some((p) => p.test(text));
}

/* `nonCompeteFlagged` — current contract has restrictive covenant. */
const NON_COMPETE_PATTERNS: RegExp[] = [
  /\b(?:non[-\s]?compete(?:\s+clause|\s+agreement)?|nca\b|restrictive\s+covenant|restraint\s+of\s+trade)\b/i,
  /\b(?:non[-\s]?solicit(?:ation)?(?:\s+clause)?|cannot\s+join\s+competitors?|restricted\s+from\s+(?:joining|working\s+with))\b/i,
  /\b(?:competitor\s+list|competing\s+(?:companies|firms|employers))\s+(?:clause|in\s+(?:my\s+)?contract)\b/i,
];
function detectNonCompeteFlagged(text: string): boolean {
  return NON_COMPETE_PATTERNS.some((p) => p.test(text));
}

/* `relocationBonusAsked` — candidate asks about relo package. */
const RELOCATION_PATTERNS: RegExp[] = [
  /\b(?:relocation|relo|moving|move)\s+(?:bonus|allowance|package|assistance|support|reimbursement|expenses?)\b/i,
  /\b(?:cover|reimburse|pay\s+for)\s+(?:my\s+|the\s+)?(?:moving|relocation|move)\s+(?:cost|expense|charges)/i,
  /\b(?:relocating|moving)\s+(?:to|from)\s+(?:bangalore|bengaluru|hyderabad|pune|gurgaon|gurugram|noida|chennai|mumbai|delhi|kolkata|kochi|ahmedabad)\b.{0,80}\b(?:bonus|allowance|package|support|cover)/i,
];
function detectRelocationBonusAsked(text: string): boolean {
  return RELOCATION_PATTERNS.some((p) => p.test(text));
}

/* ─── Wave-2 (2026-05-14i) — 20 deeper Indian-market signals ──────── */

/* Wave-2A — parent / family insurance ask. */
const PARENT_INSURANCE_PATTERNS: RegExp[] = [
  /\b(?:parents?|family|in[-\s]?laws?|spouse|dependents?)\s+(?:insurance|medical|mediclaim|health\s+cover|coverage|floater)\b/i,
  /\b(?:medical|insurance|mediclaim|health\s+cover|floater)\s+(?:for|cover(?:ing|s)?|include[ds]?)\s+(?:my\s+)?(?:parents?|family|in[-\s]?laws?|spouse|dependents?)\b/i,
  /\b(?:does\s+(?:the\s+)?(?:medical|insurance|mediclaim|cover)|insurance\s+sum\s+insured|sum\s+insured|family\s+floater\s+amount)\b/i,
  /\b(?:opd|out[-\s]?patient)\s+(?:cover(?:age)?|benefit|reimbursement)\b/i,
  /\b(?:cover|covering|include|including)\s+(?:my\s+)?(?:parents?|in[-\s]?laws?|family|dependents?)\s+(?:in|under|on)\s+(?:the\s+)?(?:medical|insurance|mediclaim|floater|policy)\b/i,
  /\b(?:cover|covering|include|including)\s+(?:my\s+)?(?:parents?|in[-\s]?laws?|dependents?)\b/i,
];
function detectParentInsuranceAsked(t: string): boolean {
  return PARENT_INSURANCE_PATTERNS.some((p) => p.test(t));
}

/* Wave-2A — in-hand / take-home / monthly net focus. */
const INHAND_TAKEHOME_PATTERNS: RegExp[] = [
  /\b(?:in[-\s]?hand|take[-\s]?home|net\s+(?:salary|pay|monthly|in[-\s]?hand))\b/i,
  /\b(?:monthly\s+(?:in[-\s]?hand|net|take[-\s]?home|salary|deposit|credit)|per[-\s]?month\s+(?:in[-\s]?hand|net|take[-\s]?home))\b/i,
  /\b(?:what\s+(?:will|would|do)\s+(?:i|my)\s+(?:get|receive|see|take\s+home))\s+(?:in[-\s]?hand|monthly|per[-\s]?month|net)\b/i,
  /\b(?:gross\s+(?:vs\.?|versus)\s+net|ctc\s+(?:vs\.?|versus)\s+(?:in[-\s]?hand|take[-\s]?home|net))\b/i,
];
function detectInHandTakehomeFocus(t: string): boolean {
  return INHAND_TAKEHOME_PATTERNS.some((p) => p.test(t));
}

/* Wave-2A — Return-to-Office pushback. */
const RTO_PUSHBACK_PATTERNS: RegExp[] = [
  /\b(?:rto|return[-\s]?to[-\s]?office|return\s+to\s+office)\s+(?:mandate|policy|requirement|push|order)?\b/i,
  /\b(?:was\s+promised|told|sold)\s+(?:wfh|remote|work[-\s]?from[-\s]?home|hybrid)\b/i,
  /\b(?:forced|mandated|required|asked)\s+(?:to\s+)?(?:come\s+(?:in|back)|return\s+to\s+(?:the\s+)?office)\b/i,
  /\b(?:hybrid|3[-\s]days?\s+(?:in[-\s]?office|wfo)|office\s+\d+\s+days?)\s+(?:is|becoming|dealbreaker)\b/i,
  /\b(?:full[-\s]?time\s+(?:wfo|in[-\s]?office)|5\s+days?\s+in\s+(?:the\s+)?office)\b/i,
];
function detectRtoPushback(t: string): boolean {
  return RTO_PUSHBACK_PATTERNS.some((p) => p.test(t));
}

/* Audit follow-up (2026-05-21) — wave-flag registry PRIMARY mode.
 * Three Wave-2A detectors register themselves with the composition seam
 * (`_candidate-profile-registry.ts`). As of the 2026-05-21 cutover,
 * extractCandidateProfile READS these flags from the registry via
 * runRegistry(text) — the legacy direct-call path was removed. The
 * `detect:` references below are now the single source of truth for
 * these three signals. The parity contract test
 * (candidateProfileRegistry.test.ts) remains in place as a regression
 * backstop against accidental drift if either path is later modified
 * independently. Six more waves to migrate after this. */
registerWaveFlag({
  name: "parentInsuranceAsked",
  waveId: "wave-2A",
  detect: detectParentInsuranceAsked,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "inHandTakehomeFocus",
  waveId: "wave-2A",
  detect: detectInHandTakehomeFocus,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "rtoPushback",
  waveId: "wave-2A",
  detect: detectRtoPushback,
  defaultValue: false,
  mergeStrategy: "or",
});

/* Audit follow-up (2026-05-21) — wave-flag registry Wave-2B SHADOW mode.
 * Five Wave-2B detectors register themselves below alongside the legacy
 * direct-call path that still lives in extractCandidateProfile. The
 * parity contract test (candidateProfileRegistry.test.ts) asserts that
 * runRegistry(text)[flag] === legacy detector(text) byte-for-byte, and
 * a NODE_ENV !== "production" runtime parity-assert in the call-site
 * surfaces drift fast in dev/CI. Once SHADOW soaks clean, a separate
 * commit will cut Wave-2B over to PRIMARY (delete the legacy calls and
 * read the values from the registry) — same pattern as Wave-2A. */
registerWaveFlag({
  name: "taxStructureAsked",
  waveId: "wave-2B",
  detect: detectTaxStructureAsked,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "bgvAnxiety",
  waveId: "wave-2B",
  detect: detectBgvAnxiety,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "esopSophisticationProbe",
  waveId: "wave-2B",
  detect: detectEsopSophisticationProbe,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "spouseJobConstraint",
  waveId: "wave-2B",
  detect: detectSpouseJobConstraint,
  defaultValue: false,
  mergeStrategy: "or",
});
registerWaveFlag({
  name: "agingParentCare",
  waveId: "wave-2B",
  detect: detectAgingParentCare,
  defaultValue: false,
  mergeStrategy: "or",
});

/* Wave-2A — returnship from maternity. */
const RETURNSHIP_MATERNITY_PATTERNS: RegExp[] = [
  /\b(?:returning|coming\s+back|getting\s+back)\s+(?:to\s+work\s+)?(?:after|from|post)\s+(?:my\s+)?(?:maternity|parental|child\s+care|baby)\b/i,
  /\b(?:maternity|parental)\s+(?:break|gap|leave|hiatus)\s+(?:of\s+|for\s+)?(\d+\s+)?(?:months?|years?)?\b/i,
  /\b(?:returnship|return[-\s]ship|return\s+to\s+work)\s+(?:program|track|cohort)?\b/i,
  /\b(?:on\s+a\s+|took\s+a\s+|had\s+a\s+)?(?:maternity|parental)\s+(?:break|sabbatical)\b/i,
];
function detectReturnshipMaternity(t: string): boolean {
  return RETURNSHIP_MATERNITY_PATTERNS.some((p) => p.test(t));
}

/* Wave-2A — pay-band / level-range / transparency probe. */
const PAY_BAND_PATTERNS: RegExp[] = [
  /\b(?:pay\s+band|salary\s+band|comp(?:ensation)?\s+band|band\s+(?:for\s+this\s+)?(?:level|role|grade)|level\s+(?:range|band))\b/i,
  /\b(?:top|max(?:imum)?|upper|highest)\s+(?:of\s+)?(?:the\s+)?(?:band|range|tier|level)\b/i,
  /\b(?:what'?s?\s+the\s+(?:band|range|spread|max|maximum)\s+(?:for|on)\s+(?:this|the)\s+(?:role|level|grade))\b/i,
  /\b(?:internal\s+(?:band|range|equity|parity)|pay\s+equity|outlier\s+hire|out[-\s]?of[-\s]?band)\b/i,
  /\b(?:levels\.fyi|ambitionbox|glassdoor|levels)\s+(?:data|range|estimate|says)\b/i,
];
function detectPayBandAsked(t: string): boolean {
  return PAY_BAND_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — tax-optimal CTC restructuring ask. */
const TAX_STRUCTURE_PATTERNS: RegExp[] = [
  /\b(?:hra|house\s+rent\s+allowance|lta|leave\s+travel\s+allowance|fbp|flexi(?:ble)?\s+benefit\s+plan|flexible\s+benefit)\b/i,
  /\b(?:80c|80d|80ccd|nps|section\s+80|tax[-\s]?saving|tax[-\s]?optim(?:al|ization|ize|izing))\s+(?:structure|component|allocation)?\b/i,
  /\b(?:meal\s+card|sodexo|telephone\s+allowance|fuel\s+allowance|driver\s+salary)\s+(?:component|reimbursement)?\b/i,
  /\b(?:old\s+regime|new\s+regime|tax\s+regime)\b/i,
  /\b(?:structure\s+(?:my\s+|the\s+)?ctc|restructure\s+(?:ctc|comp|package)|ctc\s+(?:break(?:up|down)|component\s+split))\s+(?:for\s+)?(?:tax|hra|optim)/i,
];
function detectTaxStructureAsked(t: string): boolean {
  return TAX_STRUCTURE_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — background-verification anxiety. */
const BGV_ANXIETY_PATTERNS: RegExp[] = [
  /\b(?:background\s+(?:check|verification|investigation)|bgv|employment\s+verification|degree\s+verification)\s+(?:concern|issue|risk|worry|anxiety|process)?\b/i,
  /\b(?:don'?t|do\s+not|please\s+don'?t)\s+(?:call|contact|reach\s+out\s+to)\s+(?:my\s+)?(?:current\s+)?(?:manager|employer|company|hr)\b/i,
  /\b(?:worried|concerned|nervous)\s+about\s+(?:the\s+)?(?:bgv|background|verification)\b/i,
  /\b(?:my\s+)?(?:degree|education|college)\s+(?:might|may|could)\s+(?:not\s+verify|fail|be\s+a\s+problem)\b/i,
  /\b(?:correspondence\s+degree|degree\s+is\s+correspondence|distance\s+education|distance[-\s]learning|fake\s+experience|inflated\s+ctc|exaggerated\s+comp)\b/i,
];
function detectBgvAnxiety(t: string): boolean {
  return BGV_ANXIETY_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — ESOP sophistication. */
const ESOP_SOPHISTICATION_PATTERNS: RegExp[] = [
  /\b(?:409a|four[-\s]?o[-\s]?nine[-\s]?a|fmv|fair\s+market\s+value)\b/i,
  /\b(?:strike\s+price|exercise\s+price|exercise\s+window|post[-\s]?termination\s+exercise|pte\s+window)\b/i,
  /\b(?:single[-\s]?trigger|double[-\s]?trigger|acceleration\s+(?:on\s+(?:acquisition|change\s+of\s+control)|clause))\b/i,
  /\b(?:cliff(?:\s+period)?|vesting\s+(?:schedule|cliff|cadence)|4[-\s]?year\s+vesting|monthly\s+vest)\b/i,
  /\b(?:liquidity\s+(?:event|history|program)|esop\s+buy[-\s]?back|secondary\s+(?:sale|transaction))\b/i,
  /\b(?:phantom\s+(?:stock|shares?|equity)|sar\b|stock\s+appreciation\s+rights?)\b/i,
];
function detectEsopSophisticationProbe(t: string): boolean {
  return ESOP_SOPHISTICATION_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — spouse-job constraint. */
const SPOUSE_JOB_PATTERNS: RegExp[] = [
  /\b(?:wife|husband|spouse|partner)\s+(?:works?|is\s+(?:working|based|employed))\s+(?:in|at|out\s+of|from)\s+\w+/i,
  /\b(?:my\s+)?(?:wife'?s?|husband'?s?|spouse'?s?|partner'?s?)\s+(?:job|work|role|company|posting|office)\b/i,
  /\b(?:dual[-\s]?career|two[-\s]?career|both\s+(?:of\s+us|working)|spouse\s+(?:can'?t|cannot)\s+(?:move|relocate))\b/i,
  /\b(?:can'?t\s+relocate|cannot\s+relocate|cant\s+move)\s+(?:because|since|as)\s+(?:my\s+)?(?:wife|husband|spouse|partner)\b/i,
];
function detectSpouseJobConstraint(t: string): boolean {
  return SPOUSE_JOB_PATTERNS.some((p) => p.test(t));
}

/* Wave-2B — aging-parent care. */
const AGING_PARENT_PATTERNS: RegExp[] = [
  /\b(?:aging|elderly|old(?:er)?|senior|ill|sick|unwell)\s+parents?\b/i,
  /\b(?:taking\s+care\s+of|caring\s+for|looking\s+after|need\s+to\s+be\s+near|stay\s+near)\s+(?:my\s+)?(?:parents?|mother|father|mom|dad|in[-\s]?laws?)\b/i,
  /\b(?:parents?\s+(?:are\s+)?(?:in|live\s+in|staying\s+in|based\s+in)|parents?\s+(?:health|medical|illness))\b.{0,80}\b(?:can'?t|cannot|need|stay|relocate|move|wfh|remote)/i,
  /\b(?:medical\s+emergency\s+at\s+home|family\s+health\s+(?:situation|emergency)|parent'?s?\s+surgery)\b/i,
];
function detectAgingParentCare(t: string): boolean {
  return AGING_PARENT_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — moonlighting disclosure. */
const MOONLIGHTING_PATTERNS: RegExp[] = [
  /\b(?:moonlight(?:ing)?|dual\s+employment|second\s+job|side\s+job|side\s+income)\b/i,
  /\b(?:youtube\s+channel|content\s+creation|teaching\s+(?:on\s+the\s+side|online)|freelance\s+(?:on\s+side|side\s+work)|consulting\s+(?:on\s+side|on\s+the\s+side))\b/i,
  /\b(?:can\s+i\s+(?:keep|continue)|allowed\s+to\s+(?:keep|continue|work\s+on))\s+(?:my\s+)?(?:side[-\s]?(?:project|hustle|gig|business)|other\s+(?:work|job))\b/i,
  /\b(?:do\s+you\s+allow|policy\s+on)\s+(?:moonlight(?:ing)?|side[-\s]?(?:gigs?|hustle|work)|dual\s+employment)\b/i,
];
function detectMoonlightingDisclosed(t: string): boolean {
  return MOONLIGHTING_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — mental-health / burnout disclosure. */
const MENTAL_HEALTH_PATTERNS: RegExp[] = [
  /\b(?:mental\s+health|burnout|burn[-\s]?out|anxiety|depression|panic\s+(?:attacks?|disorder))\b/i,
  /\b(?:therapy|therapist|counsell?or|counsell?ing|psychiatrist|psychologist)\s+(?:sessions?|reimbursement|cover|benefit)?\b/i,
  /\b(?:eap|employee\s+assistance\s+program|mental\s+wellness|wellness\s+leave|mental\s+health\s+day)\b/i,
  /\b(?:taking\s+(?:a\s+)?(?:break|time\s+off|leave)\s+for\s+mental\s+health|on\s+leave\s+for\s+(?:burnout|mental\s+health))\b/i,
];
function detectMentalHealthDisclosed(t: string): boolean {
  return MENTAL_HEALTH_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — pay-parity / DEI ask. */
const PAY_PARITY_PATTERNS: RegExp[] = [
  /\b(?:pay\s+(?:parity|equity|gap|audit|transparency)|gender\s+pay\s+(?:gap|parity)|equal\s+pay)\b/i,
  /\b(?:diversity\s+(?:and\s+inclusion|equity)|dei\s+(?:policy|report|metrics?)|women\s+at\s+(?:the\s+)?(?:co|company|leadership))\b/i,
  /\b(?:how\s+do\s+(?:my\s+)?(?:peers?|comparable\s+(?:men|women|hires?)|same[-\s]?level)\s+(?:get\s+paid|earn|compare))\b/i,
  /\b(?:gender\s+(?:ratio|representation|breakdown)|female\s+leadership|women\s+in\s+(?:tech|engineering|leadership))\b/i,
];
function detectPayParityAsked(t: string): boolean {
  return PAY_PARITY_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — preemptive counter received. */
const PREEMPTIVE_COUNTER_PATTERNS: RegExp[] = [
  /\b(?:my\s+(?:current\s+)?(?:company|employer|manager|boss|hr))\s+(?:just\s+|already\s+|recently\s+)?(?:gave|offered|made|put|matched)\s+(?:me\s+)?(?:a\s+)?(?:counter|counter[-\s]?offer|raise|hike|promotion|match)/i,
  /\b(?:counter[-\s]?offered\s+by|got\s+a\s+counter|been\s+counter[-\s]?offered)\s+(?:already|before\s+(?:resigning|leaving)|preemptively)\b/i,
  /\b(?:got\s+(?:a\s+)?promotion|got\s+(?:a\s+)?raise|salary\s+(?:was|got)\s+(?:bumped|increased|hiked))\s+(?:just|recently|last\s+(?:week|month)|to\s+keep\s+me)\b/i,
  /\b(?:they|current\s+(?:co|employer))\s+(?:are\s+)?(?:trying|attempting)\s+to\s+(?:retain|keep|hold\s+on\s+to)\s+me\b/i,
];
function detectPreemptiveCounterReceived(t: string): boolean {
  return PREEMPTIVE_COUNTER_PATTERNS.some((p) => p.test(t));
}

/* Wave-2C — acceptance-time / decision-window request. */
const ACCEPTANCE_TIME_PATTERNS: RegExp[] = [
  /\b(?:can\s+i\s+(?:have|get|take)|need|i'?d\s+like|give\s+me)\s+(?:about\s+|around\s+|roughly\s+)?(?:a\s+(?:few|couple)\s+(?:of\s+)?|a\s+|\d+\s+)?(?:days?|weeks?)\s+to\s+(?:decide|think|respond|consider|review)\b/i,
  /\b(?:offer\s+validity|offer\s+expir(?:y|ation)|decision\s+(?:window|timeline|deadline))\s+(?:of|is|to\s+be)\b/i,
  /\b(?:more\s+time\s+to\s+decide|some\s+time\s+to\s+(?:think|review|consider)|grace\s+period)\b/i,
  /\b(?:before\s+i\s+(?:can\s+)?(?:commit|accept|sign|respond)|need\s+(?:to|some)\s+time)\b/i,
];
function detectAcceptanceTimeRequest(t: string): boolean {
  return ACCEPTANCE_TIME_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — crypto / token comp. */
const CRYPTO_TOKEN_PATTERNS: RegExp[] = [
  /\b(?:crypto|bitcoin|btc|ethereum|eth|usdt|usdc|stablecoin|web3\s+token)\s+(?:comp(?:ensation)?|salary|pay(?:roll|out)?|portion|allocation|component)\b/i,
  /\b(?:token\s+(?:allocation|grant|vesting|comp)|token[-\s]?based\s+(?:comp|compensation|pay))\b/i,
  /\b(?:paid\s+in\s+(?:crypto|btc|eth|usdt|usdc|stable(?:coin)?s?|tokens?)|partial\s+(?:crypto|token)\s+payment)\b/i,
  /\b(?:vda|virtual\s+digital\s+asset|web3\s+native\s+co(?:mpany|mp)?)\b/i,
];
function detectCryptoTokenComp(t: string): boolean {
  return CRYPTO_TOKEN_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — GCC / captive India-arbitrage anchor. */
const GCC_PATTERNS: RegExp[] = [
  /\b(?:gcc|global\s+capability\s+cent(?:re|er)|captive\s+(?:center|centre|unit)|india\s+(?:gcc|captive))\b/i,
  /\b(?:parent\s+(?:co|company))\s+(?:is\s+)?(?:in|out\s+of|based\s+in|headquartered\s+in)\s+(?:the\s+)?(?:us|usa|uk|europe|germany|japan)\b.{0,120}\b(?:salary|comp|tc|package|parity|arbitrage|pay)\b/i,
  /\b(?:india\s+(?:cost\s+)?arbitrage|cost[-\s]?center\s+model|offshore[-\s]?onsite\s+pay\s+gap)\b/i,
  /\b(?:headquarters?\s+in\s+(?:us|usa|uk|europe))\b.{0,80}\b(?:india\s+(?:office|office\s+pays?|comp|salaries?))\b/i,
];
function detectGccArbitrageAnchor(t: string): boolean {
  return GCC_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — bench-time disclosure (services). */
const BENCH_TIME_PATTERNS: RegExp[] = [
  /\b(?:on\s+(?:the\s+)?bench|bench\s+(?:time|period|duration|for\s+\d+))\b/i,
  /\b(?:unallocated|between\s+projects|not\s+(?:yet\s+)?allocated)\s+(?:for\s+|to\s+a\s+)?(?:\d+\s+)?(?:months?|weeks?)?\b/i,
  /\b(?:bench\s+strength|reserves?\s+pool|talent\s+pool)\b/i,
];
function detectBenchTimeDisclosed(t: string): boolean {
  return BENCH_TIME_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — founder / second-innings. */
const FOUNDER_SECOND_INNINGS_PATTERNS: RegExp[] = [
  /\b(?:was|been|i'?m\s+(?:a\s+)?)\s+(?:a\s+)?(?:founder|co[-\s]?founder|ceo|chief\s+executive)\b/i,
  /\b(?:my\s+)?(?:start[-\s]?up|venture|company)\s+(?:didn'?t\s+work\s+out|shut\s+down|failed|wound\s+down|sold|exited)\b/i,
  /\b(?:i\s+took\s+|drew\s+)(?:no\s+salary|zero\s+salary|a\s+stipend|equity[-\s]?only|founder'?s?\s+salary)\b/i,
  /\b(?:second\s+innings|returning\s+to\s+(?:full[-\s]?time|fte|corporate)|leaving\s+the\s+founder\s+life)\b/i,
];
function detectFounderSecondInnings(t: string): boolean {
  return FOUNDER_SECOND_INNINGS_PATTERNS.some((p) => p.test(t));
}

/* Wave-2D — late-career age-bias concern. */
const LATECAREER_AGE_BIAS_PATTERNS: RegExp[] = [
  /\b(?:am\s+i\s+too\s+(?:old|senior)|too\s+senior\s+for\s+(?:this|the\s+role|the\s+team)|age\s+(?:bias|discrimination|concern))\b/i,
  /\b(?:fit\s+(?:in\s+)?with\s+(?:a\s+)?young(?:er)?\s+team|culture\s+fit\s+(?:with|in)\s+a\s+young(?:er)?\s+(?:team|culture))\b/i,
  /\b(?:i'?m\s+\d{2,3}\s+(?:years\s+old)?|over\s+\d{2,3}|(?:45|50|55|60)\+)\b.{0,80}\b(?:concern|worry|bias|too\s+old|too\s+senior)/i,
  /\b(?:experience\s+being\s+a\s+(?:liability|negative)|over[-\s]qualified\s+(?:age|tenure)|seniority\s+working\s+against)\b/i,
];
function detectLatecareerAgeBias(t: string): boolean {
  return LATECAREER_AGE_BIAS_PATTERNS.some((p) => p.test(t));
}

/* ─── Wave-3 (2026-05-14j) — 25 new flags ──────────────────────────── */

/* Wave-3A — titlePrecisionAsk: candidate probes exact designation /
 * grade-step. Indian resume-readable-title weight is enormous. */
const TITLE_PRECISION_PATTERNS: RegExp[] = [
  /\b(?:exact|specific|precise|actual)\s+(?:title|designation|grade|level|band)\b/i,
  /\b(?:what'?s?|tell\s+me)\s+(?:the\s+)?(?:exact\s+)?(?:designation|title|grade[-\s]?step)\b/i,
  /\b(?:sde[-\s]?\d|swe[-\s]?\d|l[-\s]?\d{1,2}|m[-\s]?\d|ic[-\s]?\d|p[-\s]?\d{1,2})\b\s+(?:or\s+|vs\s+|versus\s+)?(?:sde[-\s]?\d|swe[-\s]?\d|l[-\s]?\d{1,2}|m[-\s]?\d|senior|staff|principal)/i,
  /\b(?:senior\s+sde|principal\s+engineer|staff\s+engineer|associate\s+director)\b\s+(?:level|grade|band|step|or\s+)/i,
  /\b(?:resume[-\s]?readable|on\s+(?:my\s+)?resume|how\s+(?:will|does)\s+it\s+(?:read|appear)\s+on\s+(?:my\s+)?resume)\b/i,
];
function detectTitlePrecisionAsk(t: string): boolean {
  return TITLE_PRECISION_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — currentCtcRefusal: candidate declines to share current
 * package. Recruiter must RESPECT and pivot to band-anchored pricing. */
const CTC_REFUSAL_PATTERNS: RegExp[] = [
  /\b(?:prefer\s+not\s+to\s+(?:share|disclose|say)|rather\s+not\s+(?:share|say|disclose))\b.{0,40}\b(?:ctc|salary|package|comp(?:ensation)?|current\s+pay|number)\b/i,
  /\b(?:not\s+comfortable|uncomfortable)\s+(?:sharing|disclosing|revealing)\s+(?:my\s+)?(?:current\s+)?(?:ctc|salary|package|comp(?:ensation)?|number)\b/i,
  /\b(?:i\s+won'?t|i\s+will\s+not|i'?d\s+rather\s+not|won'?t\s+be)\s+(?:share|sharing|disclose|disclosing|tell|tell\s+you|reveal)\s+(?:my\s+)?(?:current\s+)?(?:ctc|salary|package|number)\b/i,
  /\b(?:current\s+ctc|current\s+(?:salary|package))\s+(?:is\s+)?(?:confidential|private|not\s+(?:something|relevant))/i,
  /\b(?:decline\s+to\s+(?:share|disclose)|keep\s+(?:that|it)\s+(?:confidential|private))\b.{0,40}\b(?:ctc|salary|package|comp)\b/i,
];
function detectCurrentCtcRefusal(t: string): boolean {
  return CTC_REFUSAL_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — pregnancyDisclosed: candidate discloses pregnancy / due
 * date / imminent maternity leave. SENSITIVE — must not anchor down. */
const PREGNANCY_PATTERNS: RegExp[] = [
  /\b(?:i'?m\s+)?(?:pregnant|expecting|with\s+child|carrying)\b/i,
  /\b(?:due\s+date|due\s+in\s+\w+|expecting\s+(?:a\s+)?(?:baby|child)\s+in\s+\w+)\b/i,
  /\b(?:maternity\s+leave\s+(?:is\s+)?(?:imminent|coming\s+up|soon|in\s+(?:a\s+)?(?:few\s+)?(?:weeks?|months?))|going\s+on\s+maternity\s+(?:leave|soon))\b/i,
  /\b(?:in\s+(?:my\s+)?(?:second|third|first|1st|2nd|3rd)\s+trimester|trimester\s+of\s+pregnancy)\b/i,
  /\b(?:will\s+(?:be\s+)?need(?:ing)?\s+maternity\s+leave|need(?:ing)?\s+(?:to\s+take\s+)?maternity)\b/i,
];
function detectPregnancyDisclosed(t: string): boolean {
  return PREGNANCY_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — boomerangRehire: candidate is a returning ex-employee. */
const BOOMERANG_PATTERNS: RegExp[] = [
  /\b(?:i\s+(?:worked|was)\s+(?:here|at\s+(?:this|the)\s+co(?:mpany)?)\s+(?:before|previously|earlier))\b/i,
  /\b(?:boomerang\s+(?:hire|rehire|employee|candidate)|boomeranging\s+back)\b/i,
  /\b(?:rejoining|coming\s+back|returning)\s+(?:after\s+\d+\s+(?:years?|months?)|to\s+(?:the\s+)?(?:co(?:mpany)?|team)|the\s+(?:company|firm))\b/i,
  /\b(?:ex[-\s]?(?:employee|colleague)|alumni|former\s+(?:employee|teammate))\s+(?:of\s+(?:this|the)\s+co(?:mpany)?|returning|coming\s+back)\b/i,
  /\b(?:rehire|re[-\s]hire|re[-\s]?joined?)\b/i,
];
function detectBoomerangRehire(t: string): boolean {
  return BOOMERANG_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — referralReceived: candidate was referred internally. */
const REFERRAL_PATTERNS: RegExp[] = [
  /\b(?:was|got|received|have)\s+(?:an?\s+)?(?:internal\s+|employee\s+)?referr(?:al|ed)\b/i,
  /\b(?:employee\s+referral|referral\s+bonus|referred\s+(?:me|by\s+\w+))\b/i,
  /\b\w+\s+referred\s+me\s+(?:to|for|here)\b/i,
  /\b(?:through\s+(?:an?\s+)?(?:employee\s+)?referral|via\s+(?:an?\s+)?referral)\b/i,
  /\b(?:my\s+(?:friend|colleague|ex[-\s]?colleague)\s+\w+\s+(?:works\s+here|is\s+(?:at|on)\s+the\s+team))\b/i,
];
function detectReferralReceived(t: string): boolean {
  return REFERRAL_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — hometownReturnPreference: candidate wants to move to
 * hometown / tier-2 city. Distinct from spouseJobConstraint. */
const HOMETOWN_PATTERNS: RegExp[] = [
  /\b(?:back\s+to\s+(?:my\s+)?(?:hometown|native\s+place|native\s+city|roots)|return(?:ing)?\s+to\s+(?:my\s+)?(?:hometown|native))\b/i,
  /\b(?:closer\s+to\s+(?:my\s+)?(?:family|parents|home)|move\s+closer\s+to\s+(?:family|home|parents))\b/i,
  /\b(?:move|relocate|moving|relocating)\s+(?:back\s+)?(?:to\s+)?(?:indore|coimbatore|bhubaneswar|jaipur|nagpur|kochi|trivandrum|kolkata|ahmedabad|lucknow|chandigarh|patna|vadodara|nashik|surat|visakhapatnam|vizag|guwahati|raipur|ranchi|dehradun|mysore|mangalore|trichy|madurai|vijayawada|tier[-\s]?2\s+city|tier[-\s]?ii\s+city)\b/i,
  /\b(?:my\s+(?:home[-\s]?town|native)\s+is\s+\w+|hometown\s+(?:posting|role|opportunity))\b/i,
  /\b(?:want\s+to\s+(?:settle|move)\s+(?:back\s+)?(?:in\s+|to\s+)?(?:my\s+)?(?:hometown|native|tier[-\s]?2))\b/i,
];
function detectHometownReturnPreference(t: string): boolean {
  return HOMETOWN_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — pwdDisability: candidate discloses disability /
 * accessibility need / PWD reservation. SENSITIVE. */
const PWD_PATTERNS: RegExp[] = [
  /\b(?:pwd|person\s+with\s+disability|persons?\s+with\s+disabilities|differently[-\s]?abled)\b/i,
  /\b(?:wheelchair|wheel[-\s]?chair)\s+(?:accessible|access|ramp|user)?\b/i,
  /\b(?:hearing|visual|vision|mobility|speech)\s+(?:impair(?:ment|ed)|disability|loss|challenge)\b/i,
  /\b(?:accessibility\s+(?:need|requirement|accommodation)|reasonable\s+accommodation|workplace\s+accommodation)\b/i,
  /\b(?:i\s+(?:have|am)\s+(?:a\s+)?(?:disability|disabled|deaf|blind|hard\s+of\s+hearing))\b/i,
  /\b(?:sign\s+language\s+interpreter|screen\s+reader|braille|adaptive\s+(?:tech|equipment))\b/i,
];
function detectPwdDisability(t: string): boolean {
  return PWD_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — gratuityVestingNear: candidate close to 5-yr gratuity. */
const GRATUITY_VESTING_PATTERNS: RegExp[] = [
  /\b(?:gratuity)\s+(?:vest(?:ing|s)?|eligibility|cliff|completion|kicks?\s+in)\b/i,
  /\b(?:lose\s+(?:my\s+)?gratuity|forfeit\s+gratuity|gratuity\s+(?:loss|forfeit))\b/i,
  /\b(?:almost|nearly|close\s+to|just\s+short\s+of|few\s+months\s+(?:to|from|away\s+from))\s+(?:5\s+years?|five\s+years?|gratuity)\b/i,
  /\b(?:4\.\d|four\s+point\s+\w+)\s+years?\b.{0,40}\b(?:gratuity|tenure|completion|current)/i,
  /\b(?:gratuity\s+(?:gap|shortfall|payout)|cover(?:ing)?\s+(?:my\s+|the\s+)?gratuity)\b/i,
];
function detectGratuityVestingNear(t: string): boolean {
  return GRATUITY_VESTING_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — acquisitionContextAsk: candidate asks about OUR M&A. */
const ACQUISITION_CONTEXT_PATTERNS: RegExp[] = [
  /\b(?:are\s+you|is\s+(?:the\s+)?(?:co(?:mpany)?|firm))\s+(?:being\s+)?(?:acquired|getting\s+acquired|in\s+(?:an?\s+)?m&a)\b/i,
  /\b(?:m\s*&\s*a|merger|acquisition)\s+(?:rumour|rumor|news|talks?|deal|context|impact|effect)\b/i,
  /\b(?:post[-\s]?acquisition|post[-\s]?merger|after\s+(?:the\s+)?acquisition)\s+(?:retention|comp|package|stock|options?)\b/i,
  /\b(?:heard\s+about\s+(?:the\s+|your\s+)?(?:m&a|merger|acquisition|deal)|rumours?\s+about\s+(?:m&a|merger|acquisition))\b/i,
  /\b(?:retention\s+(?:bonus|pool|grant)\s+post[-\s]?(?:acquisition|merger))\b/i,
];
function detectAcquisitionContextAsk(t: string): boolean {
  return ACQUISITION_CONTEXT_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — lgbtqDisclosure: candidate discloses LGBTQ+ identity or
 * asks about partner benefits. SENSITIVE. */
const LGBTQ_PATTERNS: RegExp[] = [
  /\b(?:lgbtq\+?|lgbt|lgbtqia\+?|queer|gay|lesbian|bisexual|transgender|non[-\s]?binary|gender[-\s]?fluid)\b/i,
  /\b(?:same[-\s]?sex\s+(?:partner|spouse|marriage)|same\s+gender\s+partner)\b/i,
  /\b(?:partner\s+(?:insurance|benefits?|cover|medical))\b.{0,80}\b(?:same[-\s]?sex|gay|lesbian|lgbt|domestic\s+partner)/i,
  /\b(?:domestic\s+partner(?:ship)?|civil\s+(?:union|partnership))\s+(?:benefits?|cover|insurance)?\b/i,
  /\b(?:my\s+(?:partner|spouse)\s+is\s+(?:also\s+)?(?:a\s+)?(?:man|woman|male|female)\b.{0,40}\b(?:insurance|cover|benefit))/i,
];
function detectLgbtqDisclosure(t: string): boolean {
  return LGBTQ_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — chronicIllnessDisclosed: chronic illness / ongoing
 * treatment / cancer-survivor / autoimmune. SENSITIVE. */
const CHRONIC_ILLNESS_PATTERNS: RegExp[] = [
  /\b(?:chronic\s+(?:illness|condition|disease|pain)|ongoing\s+(?:treatment|medical\s+condition))\b/i,
  /\b(?:dialysis|chemo(?:therapy)?|radiation|immunotherapy)\b/i,
  /\b(?:cancer\s+survivor|cancer\s+patient|in\s+remission|undergoing\s+(?:treatment|chemo|therapy))\b/i,
  /\b(?:autoimmune|lupus|crohn'?s|colitis|rheumatoid\s+arthritis|multiple\s+sclerosis|ms\s+diagnosis)\b/i,
  /\b(?:diabetes\s+type\s+1|type\s+1\s+diabetes|insulin[-\s]?dependent|kidney\s+(?:disease|failure)|liver\s+(?:disease|cirrhosis))\b/i,
  /\b(?:i\s+have\s+(?:a\s+)?(?:chronic|long[-\s]?term|ongoing)\s+(?:illness|condition|disease))\b/i,
];
function detectChronicIllnessDisclosed(t: string): boolean {
  return CHRONIC_ILLNESS_PATTERNS.some((p) => p.test(t));
}

/* Wave-3A — noticeBuyoutAsk: candidate asks about notice buyout
 * money. Distinct from noticePeriodDays. */
const NOTICE_BUYOUT_PATTERNS: RegExp[] = [
  /\b(?:notice\s+(?:period\s+)?buy[-\s]?out|buy[-\s]?out\s+(?:my\s+)?notice|buy\s+out\s+(?:my\s+)?notice)\b/i,
  /\b(?:can\s+you\s+(?:cover|buy[-\s]?out|pay)\s+(?:my\s+)?notice|notice[-\s]?period\s+shortfall|cover\s+the\s+(?:notice|shortfall))\b/i,
  /\b(?:notice\s+(?:buy[-\s]?out\s+)?amount|buyout\s+(?:cap|amount|fee))\b/i,
  /\b\d{1,3}[-\s]?day\s+notice\b.{0,40}\b(?:buy[-\s]?out|cover|pay\s+(?:off|out)|shortfall)/i,
  /\b(?:reimburse|recover|recoup)\s+(?:the\s+)?notice[-\s]?(?:period\s+)?(?:buyout|recovery)/i,
];
function detectNoticeBuyoutAsk(t: string): boolean {
  return NOTICE_BUYOUT_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — bfsiClawbackContext: BFSI bonus clawback if leaving
 * before March / under 1 year. */
const BFSI_CLAWBACK_PATTERNS: RegExp[] = [
  /\b(?:bonus|joining\s+bonus|sign[-\s]?on|deferred\s+(?:comp|bonus))\s+clawback\b/i,
  /\b(?:clawback\s+(?:if|when|clause|provision)|locked\s+(?:in\s+)?(?:till|until)\s+(?:march|q[14]|year[-\s]?end))\b/i,
  /\b(?:bonus\s+(?:locked|payable|paid\s+out)\s+(?:in|by|till|after)\s+(?:march|april|q[14]))\b/i,
  /\b(?:variable\s+pay\s+(?:locked|deferred)|deferred\s+comp\s+(?:clawback|vesting))\b/i,
  /\b(?:if\s+i\s+leave\s+(?:before|under|within)\s+(?:march|\d+\s+(?:year|month)s?))\b.{0,80}\b(?:bonus|clawback|forfeit|lose)/i,
];
function detectBfsiClawbackContext(t: string): boolean {
  return BFSI_CLAWBACK_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — bigFourGradeStep: Deloitte/EY/PwC/KPMG grade reference. */
const BIG_FOUR_GRADE_PATTERNS: RegExp[] = [
  /\b(?:deloitte|ernst\s*&?\s*young|\bey\b|pwc|price\s*waterhouse|kpmg|big[-\s]?(?:4|four))\b/i,
  /\b(?:consultant\s+to\s+senior\s+consultant|sc\s+to\s+manager|manager\s+to\s+senior\s+manager|sm\s+to\s+director)\b/i,
  /\b(?:s[12]\s+to\s+m[12]|c[12]\s+to\s+sc|grade[-\s]?step|grade\s+jump|lateral\s+at\s+(?:m1|m2|sm|sc|consultant))\b/i,
  /\b(?:senior\s+consultant|associate\s+manager|managing\s+director)\b.{0,80}\b(?:big[-\s]?4|deloitte|ey|pwc|kpmg|grade\s+step)/i,
  /\b(?:m1|m2|sm|smd|amd|svp|d\b)\s+(?:level|grade|step|band)\b.{0,40}\b(?:consulting|advisory|big[-\s]?4)/i,
];
function detectBigFourGradeStep(t: string): boolean {
  return BIG_FOUR_GRADE_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — securityClearanceNeeded: defence / govt / clearance ask. */
const SECURITY_CLEARANCE_PATTERNS: RegExp[] = [
  /\b(?:security\s+clearance|clearance\s+(?:status|required|needed|process)|need\s+(?:a\s+)?clearance)\b/i,
  /\b(?:drdo|isro|baba\s+atomic|bhel|bel|hal\s+aero|defence\s+(?:sector|project|contractor)|defense\s+(?:sector|project|contractor))\b/i,
  /\b(?:dod|department\s+of\s+defense|secret\s+clearance|top[-\s]?secret|ts[-\s]?sci|polygraph)\b/i,
  /\b(?:government\s+(?:project|contract|clearance)|govt\s+project|classified\s+(?:project|work))\b/i,
  /\b(?:police\s+verification|character\s+verification\s+(?:for|by))\b.{0,80}\b(?:clearance|defence|defense|gov)/i,
];
function detectSecurityClearanceNeeded(t: string): boolean {
  return SECURITY_CLEARANCE_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — missionDrivenComp: willingness to take below-market for
 * mission-aligned roles (climate, healthtech, social, NGO). */
const MISSION_DRIVEN_PATTERNS: RegExp[] = [
  /\b(?:mission[-\s]?(?:driven|aligned|first)|impact[-\s]?(?:driven|first|focused)|purpose[-\s]?(?:driven|aligned))\b/i,
  /\b(?:climate|cleantech|clean[-\s]?tech|sustainability|renewable|esg)\b.{0,80}\b(?:below[-\s]?market|lower\s+(?:pay|comp)|pay\s+cut|less\s+(?:money|comp))/i,
  /\b(?:healthtech|health[-\s]?tech|public\s+(?:sector|health)|govtech|gov[-\s]?tech|social\s+(?:impact|sector)|ngo|non[-\s]?profit)\b.{0,80}\b(?:open\s+to|willing\s+to|fine\s+with|happy\s+with)/i,
  /\b(?:open\s+to|willing\s+to|fine\s+(?:with|taking))\s+(?:a\s+)?(?:below[-\s]?market|pay\s+cut|lower\s+(?:pay|comp|ctc|salary))\s+(?:for\s+(?:the\s+)?(?:mission|impact|cause))/i,
  /\b(?:work\s+(?:for\s+)?(?:a\s+)?cause|cause[-\s]?driven|do\s+meaningful\s+work)\b/i,
];
function detectMissionDrivenComp(t: string): boolean {
  return MISSION_DRIVEN_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — edtechReputationCheck: edtech stability anxiety. */
const EDTECH_REPUTATION_PATTERNS: RegExp[] = [
  /\b(?:byju'?s|unacademy|whitehat\s+jr|vedantu|upgrad|toppr|simplilearn)\b.{0,120}\b(?:debacle|layoff|firing|stability|debacle|collapse|shutdown|crisis)/i,
  /\b(?:edtech\s+(?:stability|crisis|debacle|layoff|risk|reputation|future|winter))\b/i,
  /\b(?:are\s+you\s+(?:laying\s+off|firing|cutting))\b.{0,80}\b(?:like\s+(?:byju'?s|unacademy)|edtech)/i,
  /\b(?:worried|concerned|anxious)\s+(?:about\s+)?(?:after|because\s+of)\s+(?:the\s+)?(?:byju'?s|unacademy)\b/i,
  /\b(?:mass\s+(?:firing|layoff|exits?)|company\s+(?:winding\s+down|shutting\s+down|going\s+under))\b.{0,80}\b(?:edtech|byju|unacademy)/i,
];
function detectEdtechReputationCheck(t: string): boolean {
  return EDTECH_REPUTATION_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — acquiHireContext: candidate's CURRENT company is being
 * acquired / wound down. Distinct from acquisitionContextAsk. */
const ACQUI_HIRE_PATTERNS: RegExp[] = [
  /\b(?:my\s+)?(?:current\s+)?(?:company|employer|startup|firm)\s+(?:is\s+)?(?:being\s+)?(?:acquired|getting\s+acquired|in\s+talks\s+to\s+(?:be\s+)?(?:acquired|sold))\b/i,
  /\b(?:acqui[-\s]?hire|acquihire|talent\s+acquisition\s+deal)\b/i,
  /\b(?:my\s+)?(?:current\s+)?(?:company|startup|employer)\s+(?:is\s+)?(?:winding\s+down|shutting\s+down|going\s+under|in\s+wind[-\s]?down)\b/i,
  /\b(?:we'?re\s+being\s+(?:acquired|bought|absorbed)|company\s+(?:got|just\s+got)\s+acquired)\b/i,
  /\b(?:moving\s+(?:to|because)\s+(?:of\s+)?(?:the\s+)?(?:acquisition|wind[-\s]?down|shutdown))\b/i,
];
function detectAcquiHireContext(t: string): boolean {
  return ACQUI_HIRE_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — cabinParkingAsk: traditional Indian seniority perks. */
const CABIN_PARKING_PATTERNS: RegExp[] = [
  /\b(?:cabin|private\s+(?:office|cabin|workspace)|corner\s+(?:office|cabin))\b/i,
  /\b(?:dedicated\s+(?:parking|workstation|seat|desk)|reserved\s+parking|parking\s+(?:slot|spot|space|allotment))\b/i,
  /\b(?:company\s+car|car\s+lease|fuel\s+reimbursement|fuel\s+allowance|driver\s+(?:allowance|reimbursement|salary))\b/i,
  /\b(?:executive\s+(?:cabin|parking|perks?)|corner\s+seat|window\s+seat\s+(?:allotment|preference))\b/i,
  /\b(?:do\s+(?:i|we)\s+get\s+(?:a\s+)?(?:cabin|car|parking|driver))\b/i,
];
function detectCabinParkingAsk(t: string): boolean {
  return CABIN_PARKING_PATTERNS.some((p) => p.test(t));
}

/* Wave-3B — spanOfControlAsk: team size / org / reporting probe. */
const SPAN_OF_CONTROL_PATTERNS: RegExp[] = [
  /\b(?:span\s+of\s+control|how\s+(?:big|large)\s+(?:is\s+)?(?:the\s+)?team|team\s+size\s+(?:i'?ll|to|that\s+i))\b/i,
  /\b(?:how\s+many\s+(?:reports?|directs?|people)\s+(?:will|do)\s+i\s+(?:have|manage))\b/i,
  /\b(?:number\s+of\s+(?:direct\s+)?reports?|direct\s+reports?\s+count|reporting\s+(?:to|lines?|structure))\b/i,
  /\b(?:org(?:anization)?\s+(?:chart|structure|hierarchy)|reporting\s+(?:hierarchy|structure))\b/i,
  /\b(?:who\s+(?:reports\s+to\s+me|will\s+report\s+to\s+me|are\s+my\s+(?:directs?|reports?)))\b/i,
];
function detectSpanOfControlAsk(t: string): boolean {
  return SPAN_OF_CONTROL_PATTERNS.some((p) => p.test(t));
}

/* Wave-3C — preResignationStealth: candidate hasn't told current
 * employer; stealth job search. */
const PRE_RESIGNATION_STEALTH_PATTERNS: RegExp[] = [
  /\b(?:they\s+don'?t\s+know|hasn'?t\s+(?:told|informed)\s+(?:my\s+)?(?:manager|employer|company))\b.{0,40}\b(?:interview|job|search|looking)/i,
  /\b(?:stealth\s+(?:job\s+)?search|stealth\s+mode|on\s+the\s+down[-\s]?low|quietly\s+(?:interview|looking))\b/i,
  /\b(?:keep(?:ing)?\s+(?:this|it|the\s+search)\s+confidential|confidential(?:ity)?\s+(?:on\s+|of\s+)?(?:my\s+)?(?:search|interview))\b/i,
  /\b(?:current\s+(?:co|company|employer|manager)\s+doesn'?t\s+know|haven'?t\s+(?:told|informed|resigned|put\s+in\s+papers))\b/i,
  /\b(?:please\s+(?:don'?t|do\s+not)\s+(?:contact|inform|tell)\s+(?:my\s+)?(?:current|present)\s+(?:co|company|employer))\b/i,
];
function detectPreResignationStealth(t: string): boolean {
  return PRE_RESIGNATION_STEALTH_PATTERNS.some((p) => p.test(t));
}

/* Wave-3C — reverseAnchorAsk: candidate asks recruiter to anchor
 * first. Routes to coaching: don't be the first to anchor. */
const REVERSE_ANCHOR_PATTERNS: RegExp[] = [
  /\b(?:what'?s?\s+your\s+(?:budget|range|band)|what\s+range\s+(?:did\s+you|do\s+you|are\s+you))\s+(?:have\s+)?(?:in\s+mind|thinking|budgeted)?\b/i,
  /\b(?:you\s+tell\s+me|what\s+(?:would\s+you|do\s+you)\s+offer|you\s+(?:make\s+|put\s+)?(?:the\s+)?(?:first\s+)?offer)\b/i,
  /\b(?:what'?s?\s+the\s+(?:budget|allocation|number)\s+for\s+(?:this|the)\s+role)\b/i,
  /\b(?:i'?d\s+(?:rather|prefer)\s+(?:hear|know)\s+(?:your\s+)?(?:offer|range|number)\s+first|hear\s+(?:your|the)\s+(?:offer|number)\s+first)\b/i,
  /\b(?:share\s+(?:the\s+)?range\s+first|range\s+first\s+please|what\s+(?:can|do)\s+you\s+(?:offer|pay))\b/i,
];
function detectReverseAnchorAsk(t: string): boolean {
  return REVERSE_ANCHOR_PATTERNS.some((p) => p.test(t));
}

/* Wave-3C — dietaryReligiousNeed: dietary / religious accommodation. */
const DIETARY_RELIGIOUS_PATTERNS: RegExp[] = [
  /\b(?:jain\s+(?:food|diet|meals?)|halal|kosher|vegetarian\s+(?:cafeteria|canteen|meals?|option))\b/i,
  /\b(?:friday\s+prayers?|jumma|namaz|ramzan|ramadan)\b.{0,80}\b(?:timing|break|leave|accommodation|flexibility)?/i,
  /\b(?:sabbath|shabbat|saturday\s+off\s+for\s+(?:religious|sabbath))\b/i,
  /\b(?:no\s+(?:onion|garlic|beef|pork)|onion[-\s]?garlic[-\s]?free|pure\s+veg)\b/i,
  /\b(?:religious\s+(?:accommodation|observance|holiday)|prayer\s+(?:room|break|time))\b/i,
];
function detectDietaryReligiousNeed(t: string): boolean {
  return DIETARY_RELIGIOUS_PATTERNS.some((p) => p.test(t));
}

/* Wave-3C — oldEmployerDocsIssue: missing relieving / experience /
 * payslips. Affects BGV. */
const OLD_EMPLOYER_DOCS_PATTERNS: RegExp[] = [
  /\b(?:relieving\s+letter|experience\s+letter|exp\s+letter)\b.{0,80}\b(?:not\s+(?:given|received|provided)|haven'?t\s+(?:given|received|got)|missing|lost|trouble|issue|problem|delay)/i,
  /\b(?:ex[-\s]?employer|previous\s+(?:employer|company))\s+(?:hasn'?t|has\s+not|won'?t|will\s+not|didn'?t|did\s+not)\s+(?:give(?:n)?|provid(?:e|ed)|issue(?:d)?|hand\s+over)\b/i,
  /\b(?:lost\s+(?:my\s+)?(?:payslips?|salary\s+slips?|offer\s+letter|relieving|experience))\b/i,
  /\b(?:company\s+(?:shut\s+down|wound\s+down|closed)|previous\s+(?:co|employer)\s+(?:shut|closed))\b.{0,80}\b(?:no\s+(?:docs?|relieving|payslips?|letter)|can'?t\s+(?:get|retrieve|provide))/i,
  /\b(?:affidavit|self[-\s]?declaration)\b.{0,40}\b(?:relieving|experience|prior\s+employer|bgv)/i,
];
function detectOldEmployerDocsIssue(t: string): boolean {
  return OLD_EMPLOYER_DOCS_PATTERNS.some((p) => p.test(t));
}

/* Wave-3C — equityRefreshCadenceAsk: refresh / top-up / promotion
 * grant cadence. Distinct from initial-grant mechanics. */
const EQUITY_REFRESH_PATTERNS: RegExp[] = [
  /\b(?:equity\s+refresh|refresh\s+(?:grant|cadence|cycle|policy)|annual\s+refresh)\b/i,
  /\b(?:top[-\s]?up\s+grant|top[-\s]?up\s+(?:rsu|esop|equity)|refresher\s+grant)\b/i,
  /\b(?:promotion\s+(?:top[-\s]?up|grant|refresh|equity)|promo\s+(?:grant|refresh))\b/i,
  /\b(?:next\s+(?:rsu|esop|equity|stock)\s+grant|when\s+(?:do|will)\s+i\s+(?:get|receive)\s+(?:my\s+)?(?:next\s+)?(?:rsu|grant|refresh))\b/i,
  /\b(?:refresh\s+policy|refresh\s+(?:every|each)\s+(?:year|cycle)|annual\s+(?:rsu|equity)\s+(?:cycle|grant))\b/i,
];
function detectEquityRefreshCadenceAsk(t: string): boolean {
  return EQUITY_REFRESH_PATTERNS.some((p) => p.test(t));
}

/* Wave-3D (PDF #17 follow-up, 2026-05-15) — equity-instrument depth.
 * Four distinct asks: vesting schedule, cliff period, exercise terms,
 * buyback / liquidity. Each routes a different recruiter voice. */
const EQUITY_VESTING_SCHEDULE_PATTERNS: RegExp[] = [
  /\b(vesting\s+schedule|vest(?:ing)?\s+cadence|how\s+(?:does\s+)?vesting\s+work|vesting\s+period)\b/i,
];
function detectEquityVestingScheduleAsk(t: string): boolean {
  return EQUITY_VESTING_SCHEDULE_PATTERNS.some((p) => p.test(t));
}

const EQUITY_CLIFF_PERIOD_PATTERNS: RegExp[] = [
  /\b(cliff\s+period|1[-\s]?year\s+cliff|vesting\s+cliff)\b/i,
];
function detectEquityCliffPeriodAsk(t: string): boolean {
  return EQUITY_CLIFF_PERIOD_PATTERNS.some((p) => p.test(t));
}

const EQUITY_EXERCISE_TERMS_PATTERNS: RegExp[] = [
  /\b(exercise\s+terms|exercise\s+window|exercise\s+price|exercise\s+period|strike\s+price)\b/i,
];
function detectEquityExerciseTermsAsk(t: string): boolean {
  return EQUITY_EXERCISE_TERMS_PATTERNS.some((p) => p.test(t));
}

const EQUITY_BUYBACK_LIQUIDITY_PATTERNS: RegExp[] = [
  /\b(buyback|liquidity\s+event|secondary\s+sale|tender\s+offer|liquidity\s+history)\b/i,
];
function detectEquityBuybackLiquidityAsk(t: string): boolean {
  return EQUITY_BUYBACK_LIQUIDITY_PATTERNS.some((p) => p.test(t));
}

/* ─── Wave-4 (2026-05-14k) — 32 new flags ──────────────────────────── */

/* Wave-4A — signOnClawback: sign-on / joining bonus clawback tail. */
const SIGN_ON_CLAWBACK_PATTERNS: RegExp[] = [
  /\b(?:joining\s+bonus|sign[-\s]?on(?:\s+bonus)?|signing\s+bonus|jb)\s+(?:has\s+)?(?:an?\s+)?(?:\d+[-\s]?(?:month|year)s?\s+)?(?:clawback|recovery|tail|repayment|return)\b/i,
  /\b(?:clawback|recovery|return|repay)\s+(?:if\s+i\s+leave|on\s+(?:my\s+)?(?:joining|sign[-\s]?on|signing)\s+bonus)\b/i,
  /\b(?:\d{1,2}[-\s]?(?:month|year)s?\s+(?:clawback|tail|recovery)\s+(?:clause|period|window)?)\b/i,
  /\b(?:jb\s+recovery|joining[-\s]?bonus\s+recovery|sign[-\s]?on\s+(?:tail|clawback)\s+(?:clause)?)\b/i,
  /\b(?:if\s+i\s+leave\s+(?:before|under|within)\s+\d{1,2}\s+(?:months?|years?))\b.{0,80}\b(?:joining|sign[-\s]?on|signing|jb)/i,
];
function detectSignOnClawback(t: string): boolean {
  return SIGN_ON_CLAWBACK_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — variableTrackRecord: PM/eng consistent variable history. */
const VARIABLE_TRACK_RECORD_PATTERNS: RegExp[] = [
  /\b(?:always\s+(?:hit|hits|hitting|maxed|max(?:ing|imised))|consistently\s+(?:hit|max(?:ed|ing)?|deliver(?:ed|ing)?))\b.{0,60}\b(?:variable|bonus|payout|target)/i,
  /\b(?:100\s*%|full)\s+(?:variable|bonus|payout)\s+(?:every\s+(?:year|cycle)|history|track[-\s]?record)?\b/i,
  /\b(?:perfect|spotless|clean|flawless)\s+(?:variable|bonus|payout|variable\s+payout|bonus\s+payout)\s+(?:history|track[-\s]?record|record)\b/i,
  /\b(?:my\s+)?variable\s+(?:has\s+been|payout\s+has\s+been)\s+(?:100|max|full|at\s+target)\b/i,
  /\b(?:never\s+missed|always\s+at\s+(?:or\s+above\s+)?target)\b.{0,40}\b(?:variable|bonus|payout)/i,
];
function detectVariableTrackRecord(t: string): boolean {
  return VARIABLE_TRACK_RECORD_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — wfhEquipmentStipend: desk / chair / internet / WFH setup. */
const WFH_STIPEND_PATTERNS: RegExp[] = [
  /\b(?:wfh|work[-\s]?from[-\s]?home|home[-\s]?office)\s+(?:setup|stipend|allowance|equipment|kit)\b/i,
  /\b(?:desk|chair|monitor|ergonomic)\s+(?:stipend|allowance|reimbursement|setup)\b/i,
  /\b(?:internet|broadband|wifi)\s+(?:reimbursement|allowance|stipend|cover)\b/i,
  /\b(?:laptop|equipment)\s+(?:reimbursement|stipend|allowance|policy)\b/i,
  /\b(?:one[-\s]?time\s+(?:wfh|home[-\s]?office|setup)\s+(?:allowance|stipend|grant|amount))\b/i,
];
function detectWfhEquipmentStipend(t: string): boolean {
  return WFH_STIPEND_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — salaryReviewCadenceAsk: review cycle / appraisal cadence. */
const REVIEW_CADENCE_PATTERNS: RegExp[] = [
  /\b(?:annual|semi[-\s]?annual|half[-\s]?yearly|quarterly|yearly)\s+(?:review|appraisal|salary\s+review)\b/i,
  /\b(?:when'?s?|when\s+is)\s+(?:the\s+)?(?:next\s+)?(?:appraisal|salary\s+review|review\s+cycle|comp\s+cycle)\b/i,
  /\b(?:mid[-\s]?year\s+correction|off[-\s]?cycle\s+(?:correction|adjustment|raise))\b/i,
  /\b(?:review|appraisal|comp)\s+(?:cycle|cadence|frequency|policy)\b/i,
  /\b(?:how\s+often|when\s+do\s+you)\s+(?:do|run|hold)\s+(?:salary\s+)?(?:reviews?|appraisals?)\b/i,
];
function detectSalaryReviewCadenceAsk(t: string): boolean {
  return REVIEW_CADENCE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — multipleOffersJuggling: 3+ active processes / multiple offers. */
const MULTIPLE_OFFERS_PATTERNS: RegExp[] = [
  /\b(?:i\s+have|have)\s+(?:3|three|4|four|5|five|multiple|several)\s+(?:active\s+)?(?:offers?|processes?|interviews?|opportunities)\b/i,
  /\b(?:comparing|juggling|evaluating)\s+(?:3|three|4|four|5|five|multiple|several)\s+(?:offers?|companies|opportunities|options)\b/i,
  /\b(?:final\s+rounds?\s+with\s+(?:two|three|four|multiple|several|other)\s+(?:other\s+)?companies)\b/i,
  /\b(?:in\s+(?:talks|discussions|process)\s+with\s+(?:multiple|several|3|three|4|four)\s+(?:other\s+)?(?:companies|firms))\b/i,
  /\b(?:multiple\s+offers?\s+(?:in\s+hand|on\s+the\s+table|active))\b/i,
];
function detectMultipleOffersJuggling(t: string): boolean {
  return MULTIPLE_OFFERS_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — recruitmentAgencyMediation: external recruiter / agency. */
const AGENCY_PATTERNS: RegExp[] = [
  /\b(?:through|via)\s+(?:abc\s+)?(?:consultants?|consultancy|placement\s+agency|recruitment\s+(?:agency|firm)|staffing\s+(?:agency|firm))\b/i,
  /\b(?:placement\s+(?:agency|consultant)|external\s+recruiter|third[-\s]?party\s+recruiter|agency\s+recruiter)\b/i,
  /\b(?:naukri\s+rms|naukri\s+(?:recruiter|consultant)|rms\s+(?:reached|contacted))\b/i,
  /\b(?:i'?m\s+through|i\s+came\s+through)\s+(?:a\s+)?(?:consultant|consultancy|agency)\b/i,
  /\b(?:my\s+(?:agency|consultant|placement)\s+(?:rep|contact|recruiter))\b/i,
];
function detectRecruitmentAgencyMediation(t: string): boolean {
  return AGENCY_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — internalTransferContext: IJP / internal candidate. */
const INTERNAL_TRANSFER_PATTERNS: RegExp[] = [
  /\b(?:internal\s+(?:candidate|transfer|move|switch|job\s+posting)|i'?m\s+an\s+internal\s+candidate)\b/i,
  /\bijp\b/i,
  /\b(?:internal\s+job\s+posting|cross[-\s]?functional\s+(?:move|transfer)\s+(?:within|inside))\b/i,
  /\b(?:transferring|moving)\s+(?:within|inside|internally)\s+(?:the\s+)?(?:co(?:mpany)?|firm|org(?:anization)?)\b/i,
  /\b(?:lateral\s+(?:move|transfer)\s+within|internal\s+lateral)\b/i,
];
function detectInternalTransferContext(t: string): boolean {
  return INTERNAL_TRANSFER_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — offerRescindedHistory: prior offer was pulled / cancelled. */
const OFFER_RESCINDED_PATTERNS: RegExp[] = [
  /\b(?:my\s+(?:last|previous|prior)\s+offer\s+(?:was|got)\s+(?:rescinded|revoked|pulled|cancelled|withdrawn))\b/i,
  /\b(?:offer\s+(?:was\s+)?(?:rescinded|revoked|pulled|cancelled|withdrawn))\b/i,
  /\b(?:cars24|byju'?s|unacademy|ola)\s+(?:pulled|rescinded|cancelled|revoked)\s+(?:my\s+)?offer\b/i,
  /\b(?:joining\s+(?:was|got)\s+(?:cancelled|called\s+off|deferred\s+indefinitely)|joining\s+date\s+(?:cancelled|pulled))\b/i,
  /\b(?:offer\s+rescinded\s+(?:at\s+the\s+last\s+minute|just\s+before\s+joining))\b/i,
];
function detectOfferRescindedHistory(t: string): boolean {
  return OFFER_RESCINDED_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — internationalDegreePremium: Stanford/MIT/Oxford/Ivy MBA. */
const INTERNATIONAL_DEGREE_PATTERNS: RegExp[] = [
  /\b(?:stanford|mit|harvard|princeton|yale|oxford|cambridge|berkeley|caltech|cmu|carnegie\s+mellon|columbia|cornell|dartmouth|upenn|penn|brown)\b/i,
  /\b(?:ivy\s+league|insead|lbs|london\s+business\s+school|wharton|kellogg|booth|sloan|stern|haas|tuck|fuqua|johnson)\b/i,
  /\b(?:masters?|ms|mba|phd)\s+(?:at|from|degree\s+from)\s+(?:stanford|mit|harvard|oxford|cambridge|insead|lbs|wharton|kellogg)\b/i,
  /\b(?:overseas|abroad|us|uk|european)\s+(?:masters?|mba|phd|degree)\b/i,
  /\b(?:i\s+did\s+my\s+(?:masters?|mba|phd)\s+(?:at|in)\s+(?:the\s+)?(?:us|uk|states|abroad|overseas))\b/i,
];
function detectInternationalDegreePremium(t: string): boolean {
  return INTERNATIONAL_DEGREE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — domesticTopMbaAnchor: IIM-A/B/C, ISB, XLRI, FMS, MDI. */
const DOMESTIC_TOP_MBA_PATTERNS: RegExp[] = [
  /\b(?:iim[-\s]?(?:a|b|c|ahmedabad|bangalore|calcutta|kozhikode|lucknow|indore))\b/i,
  /\bisb\b|\bindian\s+school\s+of\s+business\b/i,
  /\b(?:xlri|fms|mdi|spjimr|sp\s+jain|jbims|nitie|iift)\b/i,
  /\b(?:fresh\s+(?:out\s+of|from)|just\s+graduated\s+from)\s+(?:iim|isb|xlri|fms|mdi)\b/i,
  /\b(?:iim|isb)\s+(?:grad(?:uate)?|fresher|alumni|alum)\b/i,
];
function detectDomesticTopMbaAnchor(t: string): boolean {
  return DOMESTIC_TOP_MBA_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — toxicManagerContext: toxic boss / bad leadership exit. */
const TOXIC_MANAGER_PATTERNS: RegExp[] = [
  /\b(?:toxic\s+(?:manager|boss|leadership|environment|workplace|culture))\b/i,
  /\b(?:my\s+manager\s+is\s+(?:the\s+reason|why)\s+i'?m\s+leaving)\b/i,
  /\b(?:bad|terrible|awful|horrible|abusive)\s+(?:manager|boss|leadership|leader)\b/i,
  /\b(?:leadership\s+is\s+the\s+(?:problem|issue|reason)|manager\s+issues?|management\s+issues?)\b/i,
  /\b(?:micromanag(?:er|ing|ement)|gaslighting\s+manager|hostile\s+manager)\b/i,
];
function detectToxicManagerContext(t: string): boolean {
  return TOXIC_MANAGER_PATTERNS.some((p) => p.test(t));
}

/* Wave-4A — visaSponsorshipNeed: H1B / OPT / STEM / GC sponsorship. */
const VISA_SPONSORSHIP_PATTERNS: RegExp[] = [
  /\b(?:h1[-\s]?b|h[-\s]?1[-\s]?b)\s+(?:sponsorship|transfer|visa)?\b/i,
  /\bopt\s+(?:runs?\s+out|expir(?:es|ing|y)|extension)\b/i,
  /\b(?:stem\s+(?:extension|opt)|stem[-\s]?opt)\b/i,
  /\b(?:visa\s+(?:sponsorship|transfer|status|required))\b/i,
  /\b(?:green\s+card|gc)\s+sponsorship\b/i,
  /\b(?:need\s+(?:visa\s+)?sponsorship|sponsor\s+(?:my\s+)?(?:visa|h1b|green\s+card|gc))\b/i,
];
function detectVisaSponsorshipNeed(t: string): boolean {
  return VISA_SPONSORSHIP_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — casteReservationContext: SC/ST/OBC reservation in PSU/govt. */
const CASTE_RESERVATION_PATTERNS: RegExp[] = [
  /\b(?:sc|st|obc|ews)\s+(?:category|reservation|quota|candidate)\b/i,
  /\b(?:reservation|quota)\s+(?:category|seat|under\s+(?:sc|st|obc|ews))\b/i,
  /\b(?:scheduled\s+(?:caste|tribe)|other\s+backward\s+class)\b/i,
  /\b(?:caste\s+(?:certificate|category|reservation))\b/i,
  /\b(?:psu|govt|government|public[-\s]?sector)\s+(?:reservation|quota|category)\b/i,
];
function detectCasteReservationContext(t: string): boolean {
  return CASTE_RESERVATION_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — veteranTransition: ex-defence / armed-forces lateral. */
const VETERAN_PATTERNS: RegExp[] = [
  /\b(?:ex[-\s]?(?:defence|defense|army|navy|air\s+force|military|servicemen|serviceman))\b/i,
  /\b(?:armed\s+forces?\s+(?:lateral|transition|veteran))\b/i,
  /\b(?:transitioning|moving)\s+from\s+the\s+(?:army|navy|air\s+force|military|defence|defense|forces?)\b/i,
  /\b(?:served\s+in\s+the\s+(?:army|navy|air\s+force|military|forces?)|veteran\s+(?:status|hire|transition))\b/i,
  /\b(?:retired\s+(?:army|navy|air\s+force|colonel|major|lieutenant|captain|commander))\b/i,
];
function detectVeteranTransition(t: string): boolean {
  return VETERAN_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — singleParentConstraint: sole custody / single mom / dad. */
const SINGLE_PARENT_PATTERNS: RegExp[] = [
  /\b(?:single\s+(?:parent|mom|mother|dad|father))\b/i,
  /\b(?:sole\s+(?:custody|guardian|parent|caregiver))\b/i,
  /\b(?:no\s+co[-\s]?parent|raising\s+(?:my\s+)?(?:kids?|child(?:ren)?)\s+alone)\b/i,
  /\b(?:divorced\s+(?:single\s+)?(?:mom|dad|parent)|widowed\s+(?:parent|mom|dad))\b/i,
  /\b(?:sole\s+(?:guardian|parent)\s+of\s+(?:my\s+)?(?:kid|child|children))\b/i,
];
function detectSingleParentConstraint(t: string): boolean {
  return SINGLE_PARENT_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — jointFamilyFinancialResp: sole earner / extended family. */
const JOINT_FAMILY_FIN_PATTERNS: RegExp[] = [
  /\b(?:sole\s+earner|only\s+earner|primary\s+earner)\b/i,
  /\b(?:supporting\s+(?:my\s+)?(?:parents|family|siblings)\s+financially)\b/i,
  /\b(?:responsibility\s+for\s+(?:my\s+)?siblings?'?\s+(?:education|college|fees))\b/i,
  /\b(?:household\s+runs\s+on\s+my\s+salary|family\s+depends\s+on\s+my\s+income)\b/i,
  /\b(?:joint\s+family\s+(?:responsibility|expenses)|extended\s+family\s+(?:support|dependents))\b/i,
];
function detectJointFamilyFinancialResp(t: string): boolean {
  return JOINT_FAMILY_FIN_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — paternityLeaveAsk: paternity policy / new-father benefits. */
const PATERNITY_LEAVE_PATTERNS: RegExp[] = [
  /\b(?:paternity\s+(?:leave|policy|benefits?|duration))\b/i,
  /\b(?:new[-\s]?father\s+(?:benefits?|leave|policy))\b/i,
  /\b(?:what'?s?\s+(?:your|the)\s+paternity)\b/i,
  /\b(?:dad\s+leave|father\s+leave|partner\s+leave\s+(?:for\s+new\s+(?:dads|fathers)))\b/i,
  /\b(?:paternity\s+(?:leave\s+)?(?:weeks|days|duration|length))\b/i,
];
function detectPaternityLeaveAsk(t: string): boolean {
  return PATERNITY_LEAVE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4B — menstrualLeavePolicy: period leave / Zomato-style. */
const MENSTRUAL_LEAVE_PATTERNS: RegExp[] = [
  /\b(?:menstrual\s+(?:leave|policy|days))\b/i,
  /\b(?:period\s+leave|periods?\s+(?:leave|policy|days?\s+off))\b/i,
  /\b(?:zomato[-\s]?style\s+(?:menstrual|period)\s+leave)\b/i,
  /\b(?:female[-\s]?specific\s+leave|monthly\s+leave\s+for\s+women)\b/i,
  /\b(?:do\s+you\s+(?:have|offer)\s+(?:menstrual|period)\s+leave)\b/i,
];
function detectMenstrualLeavePolicy(t: string): boolean {
  return MENSTRUAL_LEAVE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4C — esopExerciseLoanAsk: ESOP loan / cashless exercise. */
const ESOP_LOAN_PATTERNS: RegExp[] = [
  /\b(?:esop\s+(?:exercise\s+)?loan|exercise\s+loan|loan\s+to\s+exercise)\b/i,
  /\b(?:cashless\s+exercise|cashless\s+(?:esop|option))\b/i,
  /\b(?:company[-\s]?funded\s+exercise|company\s+(?:funds?|pays?\s+for)\s+(?:my\s+)?(?:esop\s+)?exercise)\b/i,
  /\b(?:do\s+you\s+offer\s+(?:an?\s+)?(?:esop\s+)?exercise\s+loan|loan[-\s]?backed\s+exercise)\b/i,
  /\b(?:net[-\s]?settle|net[-\s]?settlement)\s+(?:on\s+exercise|esop)\b/i,
];
function detectEsopExerciseLoanAsk(t: string): boolean {
  return ESOP_LOAN_PATTERNS.some((p) => p.test(t));
}

/* Wave-4C — preIpoSecondaryAsk: secondary sale / tender opportunity. */
const PRE_IPO_SECONDARY_PATTERNS: RegExp[] = [
  /\b(?:secondary\s+(?:sale|opportunity|transaction|market))\b/i,
  /\b(?:pre[-\s]?ipo\s+secondary|secondary\s+pre[-\s]?ipo)\b/i,
  /\b(?:tender\s+(?:offer|for\s+(?:early\s+)?employees?))\b/i,
  /\b(?:can\s+i\s+sell|sell\s+(?:some\s+)?(?:of\s+)?my\s+(?:vested\s+)?(?:esops?|shares?|equity))\b.{0,60}\b(?:secondary|pre[-\s]?ipo|tender)/i,
  /\b(?:liquidity\s+event\s+(?:before|pre)\s+ipo|early[-\s]?employee\s+liquidity)\b/i,
];
function detectPreIpoSecondaryAsk(t: string): boolean {
  return PRE_IPO_SECONDARY_PATTERNS.some((p) => p.test(t));
}

/* Wave-4C — accelerationTriggerAsk: single/double-trigger acceleration. */
const ACCELERATION_TRIGGER_PATTERNS: RegExp[] = [
  /\b(?:single[-\s]?trigger|double[-\s]?trigger)\s+(?:acceleration|vesting)?\b/i,
  /\b(?:acceleration\s+(?:trigger|clause|provision|on\s+change\s+of\s+control))\b/i,
  /\b(?:change\s+of\s+control\s+acceleration|coc\s+acceleration)\b/i,
  /\b(?:what'?s?\s+the\s+acceleration\s+(?:clause|policy|trigger))\b/i,
  /\b(?:accelerated\s+vesting\s+on\s+(?:acquisition|change|coc|termination))\b/i,
];
function detectAccelerationTriggerAsk(t: string): boolean {
  return ACCELERATION_TRIGGER_PATTERNS.some((p) => p.test(t));
}

/* Wave-4C — esopPerquisiteTaxAsk: Section 17(2) / TDS on exercise. */
const ESOP_PERQ_TAX_PATTERNS: RegExp[] = [
  /\b(?:section\s+17\s*\(\s*2\s*\)|sec\s+17[-\s]?2)/i,
  /\b(?:perquisite\s+tax|perq\s+tax)\s+(?:on\s+(?:exercise|esop|stock|rsu))?\b/i,
  /\b(?:tds\s+on\s+(?:esop\s+)?exercise|tds\s+(?:on\s+)?(?:rsu|vesting|exercise))\b/i,
  /\b(?:esop\s+(?:taxation|tax\s+treatment|tax\s+on\s+exercise))\b/i,
  /\b(?:fair\s+market\s+value\s+(?:on|at)\s+exercise|fmv\s+at\s+exercise)\b/i,
];
function detectEsopPerquisiteTaxAsk(t: string): boolean {
  return ESOP_PERQ_TAX_PATTERNS.some((p) => p.test(t));
}

/* Wave-4C — tenderOfferCycleAsk: annual buyback / tender cycle. */
const TENDER_CYCLE_PATTERNS: RegExp[] = [
  /\b(?:tender\s+offer\s+cycle|next\s+tender\s+offer)\b/i,
  /\b(?:annual\s+buy[-\s]?back|esop\s+buy[-\s]?back\s+(?:cadence|cycle|frequency))\b/i,
  /\b(?:buy[-\s]?back\s+(?:cycle|cadence|frequency|policy))\b/i,
  /\b(?:when'?s?\s+the\s+next\s+(?:buyback|tender|liquidity\s+event))\b/i,
  /\b(?:periodic\s+(?:buyback|tender)|quarterly\s+(?:buyback|tender))\b/i,
];
function detectTenderOfferCycleAsk(t: string): boolean {
  return TENDER_CYCLE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4D — probationaryDurationAsk: probation length. */
const PROBATION_DURATION_PATTERNS: RegExp[] = [
  /\b(?:how\s+long\s+is\s+(?:the\s+)?probation|probation\s+(?:duration|length|period\s+length))\b/i,
  /\b(?:3[-\s]?month|6[-\s]?month|three[-\s]?month|six[-\s]?month)\s+probation\b/i,
  /\b(?:probation(?:ary)?\s+(?:duration|months?|period))\b/i,
  /\b(?:probation\s+(?:is\s+)?(?:3|6|three|six|nine)\s+months?)\b/i,
  /\b(?:6[-\s]?month\s+vs\s+3[-\s]?month\s+probation|probation\s+vs)\b/i,
];
function detectProbationaryDurationAsk(t: string): boolean {
  return PROBATION_DURATION_PATTERNS.some((p) => p.test(t));
}

/* Wave-4D — offerLetterTurnaroundDemand: fast OL turnaround. */
const OL_TURNAROUND_PATTERNS: RegExp[] = [
  /\b(?:offer\s+letter|ol)\s+(?:in\s+|within\s+)?(?:24|48|72)\s+hours?\b/i,
  /\b(?:when\s+(?:will|do)\s+i\s+(?:get|receive)\s+(?:the\s+)?(?:written\s+)?offer(?:\s+letter)?)\b/i,
  /\b(?:offer[-\s]?letter\s+(?:deadline|turnaround|timeline))\b/i,
  /\b(?:need\s+the\s+ol|need\s+the\s+offer\s+letter)\s+(?:in|by|within)\b/i,
  /\b(?:can\s+you\s+send\s+(?:me\s+)?(?:the\s+)?(?:written\s+)?offer\s+(?:by|in|within))\b/i,
];
function detectOfferLetterTurnaroundDemand(t: string): boolean {
  return OL_TURNAROUND_PATTERNS.some((p) => p.test(t));
}

/* Wave-4D — contractToHireAsk: contract-to-hire / temp-to-perm. */
const CONTRACT_TO_HIRE_PATTERNS: RegExp[] = [
  /\b(?:contract[-\s]?to[-\s]?hire|c2h)\b/i,
  /\b(?:temp[-\s]?to[-\s]?perm|temporary[-\s]?to[-\s]?permanent)\b/i,
  /\b(?:is\s+this\s+(?:a\s+)?(?:contract|fixed[-\s]?term|temp(?:orary)?)\s+(?:role|position))\b/i,
  /\b(?:when\s+(?:does|will)\s+it\s+convert\s+to\s+(?:permanent|fte|full[-\s]?time))\b/i,
  /\b(?:conversion\s+to\s+permanent|converting\s+to\s+fte)\b/i,
];
function detectContractToHireAsk(t: string): boolean {
  return CONTRACT_TO_HIRE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4D — headcountApprovalCheck: HC budgeted / approved? */
const HEADCOUNT_APPROVAL_PATTERNS: RegExp[] = [
  /\b(?:is\s+the\s+)?(?:headcount|hc)\s+(?:approved|budgeted|signed[-\s]?off|allocated)\b/i,
  /\b(?:headcount\s+approval|hc\s+approval|backfill\s+(?:approved|budgeted))\b/i,
  /\b(?:offers?\s+fall\s+through\s+on\s+(?:hc|headcount))\b/i,
  /\b(?:has\s+the\s+(?:role|position)\s+been\s+(?:approved|budgeted))\b/i,
  /\b(?:budgeted\s+(?:role|position|headcount)|approved\s+(?:requisition|req))\b/i,
];
function detectHeadcountApprovalCheck(t: string): boolean {
  return HEADCOUNT_APPROVAL_PATTERNS.some((p) => p.test(t));
}

/* Wave-4D — ipAssignmentClauseAsk: IP scope / side-project ownership. */
const IP_CLAUSE_PATTERNS: RegExp[] = [
  /\b(?:ip\s+assignment|ip\s+clause|intellectual\s+property\s+(?:clause|assignment|scope))\b/i,
  /\b(?:do\s+i\s+own\s+(?:my\s+)?(?:side\s+projects?|personal\s+projects?|github|open[-\s]?source))\b/i,
  /\b(?:moonlighting\s+(?:clause|policy|ip)|side[-\s]?project\s+(?:ip|ownership))\b/i,
  /\b(?:invention\s+assignment|prior\s+inventions?\s+(?:carve[-\s]?out|clause))\b/i,
  /\b(?:can\s+i\s+(?:keep|own)\s+(?:my\s+)?(?:side|personal|open[-\s]?source)\s+(?:work|code|projects?))\b/i,
];
function detectIpAssignmentClauseAsk(t: string): boolean {
  return IP_CLAUSE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4E — healthcarePharmaContext: pharma R&D / API / clinical. */
const PHARMA_PATTERNS: RegExp[] = [
  /\b(?:sun\s+pharma|dr\.?\s+reddy'?s|cipla|lupin|aurobindo|biocon|glenmark|torrent\s+pharma|cadila|zydus|alkem|piramal)\b/i,
  /\b(?:pharma\s+(?:r\s*&\s*d|rnd|r&d|industry|sector|background))\b/i,
  /\b(?:api\s+manufacturing|active\s+pharmaceutical\s+ingredient)\b/i,
  /\b(?:clinical\s+(?:trials?|research|operations?)|cro\b|clinical\s+regulatory)\b/i,
  /\b(?:pharmaceutical\s+(?:industry|company|r&d|formulation)|drug\s+(?:discovery|development))\b/i,
];
function detectHealthcarePharmaContext(t: string): boolean {
  return PHARMA_PATTERNS.some((p) => p.test(t));
}

/* Wave-4E — manufacturingCoreContext: core mech/elec/auto/steel. */
const MFG_CORE_PATTERNS: RegExp[] = [
  /\b(?:tata\s+(?:motors|steel)|mahindra|l\s*&\s*t|larsen|maruti|bajaj\s+auto|hero\s+motocorp|ashok\s+leyland|tvs\s+motor|royal\s+enfield)\b/i,
  /\b(?:auto\s+oem|automotive\s+oem|automobile\s+(?:industry|sector|manufacturer))\b/i,
  /\b(?:manufacturing\s+plant|shop\s+floor|production\s+line|assembly\s+line)\b/i,
  /\b(?:core\s+(?:mechanical|electrical|engineering|industry)|mech(?:anical)?\s+engineering\s+(?:role|background))\b/i,
  /\b(?:steel\s+(?:plant|industry)|jsw|sail\b|vedanta|hindalco|nalco)\b/i,
];
function detectManufacturingCoreContext(t: string): boolean {
  return MFG_CORE_PATTERNS.some((p) => p.test(t));
}

/* Wave-4E — quickCommerceContext: Zepto/Blinkit/Instamart/BB-Now. */
const QCOM_PATTERNS: RegExp[] = [
  /\b(?:zepto|blinkit|grofers|swiggy[-\s]?instamart|instamart|bb[-\s]?now|bigbasket\s+now|dunzo\s+daily)\b/i,
  /\b(?:quick[-\s]?commerce|q[-\s]?commerce)\b/i,
  /\b(?:10[-\s]?minute\s+delivery|10[-\s]?min\s+delivery|quick\s+delivery)\b/i,
  /\b(?:dark\s+stores?|micro[-\s]?warehouses?)\b/i,
  /\b(?:ultra[-\s]?fast\s+delivery|hyperlocal\s+delivery)\b/i,
];
function detectQuickCommerceContext(t: string): boolean {
  return QCOM_PATTERNS.some((p) => p.test(t));
}

/* Wave-4E — d2cConsumerEquity: D2C founder-era brand. */
const D2C_PATTERNS: RegExp[] = [
  /\b(?:boat|mamaearth|the\s+man\s+company|sugar\s+cosmetics|wakefit|licious|fresh\s+to\s+home|country\s+delight|epigamia|paper\s+boat|bombay\s+shaving)\b/i,
  /\b(?:d2c|dtc)\s+(?:brand|company|startup|e[-\s]?commerce)?\b/i,
  /\b(?:direct[-\s]?to[-\s]?consumer\s+(?:brand|company))\b/i,
  /\b(?:consumer[-\s]?tech\s+(?:startup|brand|company))\b/i,
  /\b(?:dtc\s+e[-\s]?commerce|d2c\s+e[-\s]?commerce)\b/i,
];
function detectD2cConsumerEquity(t: string): boolean {
  return D2C_PATTERNS.some((p) => p.test(t));
}

function detectCounterOfferRisk(t: string): "high" | "medium" | "low" | null {
  /* high — candidate mentions prior counter or manager already knows */
  if (/\b(?:(?:my\s+)?(?:current\s+)?(?:employer|manager|company|boss)\s+(?:already\s+)?knows?\s+(?:i'm|i\s+am)\s+(?:looking|interviewing|exploring))\b/i.test(t) ||
    /\b(?:they(?:'ve|\s+have)\s+already\s+(?:counter(?:ed)?|retained|tried\s+to\s+retain)|got\s+a\s+(?:counter|retention)\s+(?:offer|bonus))\b/i.test(t))
    return "high";
  /* low — candidate signals resignation letter ready / finalised */
  if (/\b(?:resignation\s+(?:letter\s+)?(?:is\s+)?(?:ready|submitted|drafted)|already\s+(?:resigned|put\s+in\s+(?:my\s+)?papers?))\b/i.test(t))
    return "low";
  return null;
}

export function detectCollegeTier(text: string): CollegeTier | null {
  if (!text) return null;
  /* tier-1 wins on tie — a candidate from "IIT-B and a tier-3 backup"
   * is read as tier-1 because their best signal dominates anchoring. */
  if (COLLEGE_TIER_1_PATTERNS.some((p) => p.test(text))) return "tier-1";
  if (COLLEGE_TIER_2_PATTERNS.some((p) => p.test(text))) return "tier-2";
  if (COLLEGE_TIER_3_PATTERNS.some((p) => p.test(text))) return "tier-3";
  return null;
}

/* ─── Bug-report 11 (2026-05-14) — Fresh-grad disclosure ─────────────
 *
 * A candidate may disclose mid-session that they are actually a pre-
 * graduate / fresh graduate / still in college / have zero applicable
 * experience. The previous parser had no signal for this: applicableYoe
 * was frozen at init from the resume, so a "Senior Product Designer"
 * resume applying for Business Analyst kept the senior bucket forever
 * even when the candidate said "I'm graduating, pre-graduate."
 *
 * Returns true when ANY of the following are stated:
 *   - "pre-graduate", "pre graduation", "yet to graduate"
 *   - "fresh graduate", "fresher", "freshly graduated"
 *   - "still in college", "still studying", "final year"
 *   - "haven't graduated", "haven't completed"
 *   - explicit "0 years of experience" / "no experience" in context
 *   - "graduating this year / next month / soon" (active student)
 * Pure. */
const FRESH_GRAD_PATTERNS: RegExp[] = [
  /\b(pre[-\s]?grad(?:uate|uation)?|yet\s+to\s+graduate)\b/i,
  /\b(fresh(?:\s+|-)?grad(?:uate)?|fresher|fresh(?:ly|er|ers)?\s+(?:graduated|out\s+of\s+(?:college|university)))\b/i,
  /\b(still\s+(?:in\s+college|in\s+university|studying|a\s+student)|final[-\s]?year(?:\s+student)?|last[-\s]?year\s+(?:student|college))\b/i,
  /\b(haven'?t\s+(?:graduated|completed\s+(?:my\s+)?(?:degree|college))|not\s+(?:yet\s+)?graduated)\b/i,
  /\b(graduating\s+(?:this\s+year|next\s+(?:month|year)|soon|in\s+\w+))\b/i,
  /\b(0|zero)\s+(?:years?|yrs?)\s+(?:of\s+)?(?:experience|exp|yoe)\b/i,
  /\b(no\s+(?:prior\s+|professional\s+|real\s+|actual\s+)?(?:work\s+)?experience)\b/i,
  /\bi'?m\s+(?:graduating|a\s+fresher|a\s+fresh\s+grad)\b/i,
];

export function detectFreshGradDisclosure(text: string): boolean {
  if (!text) return false;
  return FRESH_GRAD_PATTERNS.some((p) => p.test(text));
}

/* `wantsHigherBase` — candidate explicitly asked for higher fixed/base.
 * BUG-006 widening (QA v3, 2026-05-19) — TC007 ("Is there flexibility on
 * fixed?") and TC009 ("I prefer stronger fixed because that is guaranteed")
 * are clear higher-base asks but the original regex required the literal
 * "higher fixed". Add (i) "flexibility on fixed / room on fixed",
 * (ii) "stronger / better fixed" without an explicit comparative verb,
 * (iii) "comfortable with fixed of N" / "fixed component of N" comp asks. */
function detectWantsHigherBase(t: string): boolean {
  return /\b(?:higher\s+(?:fixed|base|basic)\s+(?:salary|pay|component))\b/i.test(t) ||
    /\b(?:want\s+(?:a\s+)?(?:better|higher|more)\s+(?:fixed|base)\b)/i.test(t) ||
    /\b(?:increase\s+(?:the\s+)?(?:fixed|base)\s+(?:salary|component|pay))\b/i.test(t) ||
    /\b(?:more\s+(?:in\s+)?(?:fixed|base|guaranteed)\s+(?:comp|salary|pay))\b/i.test(t) ||
    /\b(?:(?:any\s+)?(?:flexibility|flex|room|movement|wiggle\s*room)\s+on\s+(?:the\s+)?(?:fixed|base))\b/i.test(t) ||
    /\b(?:(?:stronger|bigger|fatter|larger)\s+(?:fixed|base)\b)/i.test(t) ||
    /\b(?:prefer\s+(?:a\s+)?(?:stronger|higher|larger|more)\s+(?:fixed|base|guaranteed))\b/i.test(t) ||
    /\b(?:(?:if\s+)?fixed\s+cannot\s+move)\b/i.test(t) ||
    /* QA v3 round 3 (2026-05-19) — breakup-pushback pattern. Candidate
     * has seen the offer breakup, fixed component is below expectation,
     * asks to revisit. Maps to P18_BREAKUP_PUSHBACK archetype. */
    /\bfixed\s+is\s+(?:lower|less|below)\s+(?:than\s+)?(?:expected|market|i\s+expected)\b/i.test(t) ||
    /\b(?:can\s+we\s+)?revisit\s+(?:it|the\s+(?:breakup|fixed|base|offer))\b/i.test(t) ||
    /\bbreakup.*(?:lower|less|below|disappointing)\b/i.test(t);
}

/* `wantsJoiningBonus` — candidate asked about or mentioned joining bonus. */
function detectWantsJoiningBonus(t: string): boolean {
  return /\b(?:joining\s+bonus|sign[-\s]?on\s+bonus|sign[-\s]?on\s+(?:payment|component))\b/i.test(t) ||
    /\b(?:can\s+(?:you|the\s+company)\s+(?:offer|provide|give)\s+(?:a\s+)?(?:joining|sign[-\s]?on)\s+bonus)\b/i.test(t) ||
    /\b(?:is\s+there\s+(?:a\s+)?(?:joining|sign[-\s]?on)\s+bonus)\b/i.test(t);
}

/* `wantsRelocationAllowance` — candidate asked about relocation support. */
function detectWantsRelocationAllowance(t: string): boolean {
  return /\b(?:relocation\s+(?:allowance|support|assistance|expenses?|package))\b/i.test(t) ||
    /\b(?:can\s+(?:you|the\s+company)\s+(?:cover|help\s+with|support)\s+(?:my\s+)?(?:relocation|moving\s+costs?))\b/i.test(t) ||
    /\b(?:moving\s+(?:allowance|support|assistance|expenses?))\b/i.test(t);
}

/* `invokedCompetingOffer` — used competing offer as leverage. Distinct from
 * just mentioning it — requires explicit leverage language. */
function detectInvokedCompetingOffer(t: string): boolean {
  return /\b(?:(?:because\s+of|given|considering)\s+(?:my\s+)?(?:other|competing|rival)\s+offer)\b/i.test(t) ||
    /\b(?:(?:other|competing)\s+offer\s+(?:is\s+paying|pays?|has\s+already)\s+(?:more|higher|₹\s*\d+))\b/i.test(t) ||
    /\b(?:(?:match|beat|better)\s+(?:my|the|that)\s+(?:other|competing|rival)\s+offer)\b/i.test(t) ||
    /\b(?:need\s+(?:you\s+to\s+)?(?:match|beat|top)\s+(?:my|the)\s+(?:other|competing)\s+offer)\b/i.test(t);
}

/* `askedAboutGrowthPath` — asked about career progression explicitly. */
function detectAskedAboutGrowthPath(t: string): boolean {
  return /\b(?:what(?:'s|\s+is)\s+(?:the\s+)?(?:career|growth|promotion|progression)\s+(?:path|track|trajectory|ladder|opportunity))\b/i.test(t) ||
    /\b(?:how\s+(?:fast|quickly|soon)\s+(?:do\s+people|can\s+i)\s+(?:get\s+promoted|grow|advance))\b/i.test(t) ||
    /\b(?:growth\s+(?:path|opportunity|track|potential)\s+(?:in|at|for\s+this)\s+(?:role|company|position))\b/i.test(t);
}

/* `gaveInconsistentNumbers` — CTC numbers contradicted each other. This is
 * primarily a kernel-set flag but text detection catches within-utterance
 * contradictions for early warning. */
function detectGaveInconsistentNumbers(t: string): boolean {
  /* Look for two different LPA numbers in the same utterance claimed as
   * "current" salary — conservative: requires "current" context + two numbers. */
  const nums: number[] = [];
  const re = /\b(?:current(?:ly)?(?:\s+(?:ctc|salary|package))?\s+(?:is|at|:)\s*)(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l|lakh|lakhs)\b/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const n = parseFloat(m[1]);
    if (Number.isFinite(n) && n > 0) nums.push(n);
  }
  if (nums.length >= 2) {
    const spread = Math.abs(nums[0] - nums[1]) / Math.min(nums[0], nums[1]);
    return spread > 0.1; /* > 10% difference in same utterance = inconsistent */
  }
  return false;
}

/* `evasiveOnCurrentCtc` — deflected or refused to disclose. Complementary
 * to currentCtcRefusal but captures softer evasion. */
function detectEvasiveOnCurrentCtc(t: string): boolean {
  return /\b(?:(?:rather\s+|prefer\s+)?not\s+(?:discuss|get\s+into|share|disclose)\s+(?:my\s+)?(?:current\s+)?(?:ctc|salary|package))\b/i.test(t) ||
    /\b(?:it'?s?\s+(?:complicated|not\s+straightforward|hard\s+to\s+say)\s+(?:because|as)\s+(?:of\s+)?(?:the\s+)?(?:components?|structure|split))\b/i.test(t) ||
    /\b(?:i'?d\s+(?:prefer\s+to\s+)?(?:not|rather\s+not)\s+(?:anchor|lead)\s+with\s+(?:my\s+)?(?:current|present)\s+(?:ctc|number))\b/i.test(t);
}

/* `mentionedSpouseFamily` — mentioned spouse / family discussion. */
function detectMentionedSpouseFamily(t: string): boolean {
  return /\b(?:(?:need|want)\s+to\s+(?:discuss|talk|check)\s+(?:with|to)\s+(?:my\s+)?(?:wife|husband|spouse|family|partner|parents))\b/i.test(t) ||
    /\b(?:(?:family|spouse|wife|husband|partner)\s+(?:decision|discussion|input|approval|needs?\s+to\s+know))\b/i.test(t) ||
    /\b(?:let\s+me\s+(?:discuss|check|talk)\s+(?:at\s+home|with\s+my\s+(?:family|wife|husband|spouse)))\b/i.test(t);
}

/* `mentionedForm16` — mentioned Form-16 / tax certificate from new employer. */
function detectMentionedForm16(t: string): boolean {
  return /\b(?:form\s*[-\s]?16\b|form\s+16\s+(?:issuance|date|from\s+(?:new|your)\s+company)|will\s+(?:you|the\s+company)\s+give\s+(?:me\s+)?form\s*16)\b/i.test(t);
}

/* `askedAboutReporting` — asked who they report to. */
function detectAskedAboutReporting(t: string): boolean {
  return /\b(?:who\s+(?:would|will|do)\s+i\s+(?:report\s+to|report\s+directly\s+to)|(?:reporting\s+(?:line|structure|relationship)|who\s+is\s+(?:my|the)\s+(?:manager|direct\s+manager|reporting\s+manager))\b)\b/i.test(t) ||
    /\b(?:who\s+does\s+this\s+role\s+report\s+to|who\s+would\s+be\s+my\s+(?:manager|boss|supervisor|lead))\b/i.test(t);
}

/* `askedAboutTeamSize` — asked about team size (not span-of-control). */
function detectAskedAboutTeamSize(t: string): boolean {
  return /\b(?:how\s+(?:big|large|many\s+people)\s+is\s+the\s+team|team\s+(?:size|headcount|strength)|how\s+many\s+(?:people|members?|engineers?)\s+(?:are\s+)?(?:on|in)\s+(?:the\s+)?team)\b/i.test(t);
}

/* `askedAboutGrowthPath8` — Wave-8 growth-path detector (distinct pattern from Wave-7). */
function detectAskedAboutGrowthPath8(t: string): boolean {
  return /\b(?:what(?:'s|\s+is)\s+(?:the\s+)?(?:career\s+trajectory|growth\s+opportunity|advancement\s+path|upward\s+mobility)|room\s+for\s+(?:growth|advancement)\s+in\s+(?:this\s+)?(?:role|position|company|team))\b/i.test(t) ||
    /\b(?:(?:fast|quick)\s+track(?:ed)?\s+(?:growth|promotion|advancement)|internal\s+mobility\s+(?:options?|opportunities?|path))\b/i.test(t);
}

/* `competingOfferAmount` — stated amount of competing offer in LPA. */
function detectCompetingOfferAmount(t: string): number | null {
  const m = /(?:other|competing|rival)\s+offer\s+(?:is\s+)?(?:paying|offering|worth|at|of)\s*(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l\b|lakh|lakhs)\b/i.exec(t) ||
    /\b(?:they(?:'re|\s+are)\s+(?:offering|paying)\s*)(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l\b|lakh|lakhs)\b/i.exec(t);
  if (m) {
    const n = parseFloat(m[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/* `mentionedBgvConcern` — raised a background-verification concern. */
function detectMentionedBgvConcern(t: string): boolean {
  return /\b(?:bgv\b|background\s+(?:verification|check|screening)|what\s+does\s+(?:the\s+)?bgv\s+cover|my\s+(?:degree|employment|gap)\s+(?:might|may|could)\s+(?:not\s+pass|fail|be\s+an?\s+issue\s+in)\s+(?:bgv|background\s+check))\b/i.test(t);
}

/* `mentionedMoonlighting` — mentioned moonlighting / second job / side-project policy. */
function detectMentionedMoonlighting(t: string): boolean {
  return /\b(?:moonlight(?:ing)?\b|second\s+job\b|side\s+(?:hustle|project|job|gig|work)\b|parallel\s+(?:employment|work|job)|consulting\s+on\s+the\s+side)\b/i.test(t) ||
    /\b(?:what(?:'s|\s+is)\s+(?:your|the)\s+(?:moonlighting|dual\s+employment|second\s+job)\s+policy)\b/i.test(t);
}

/* `gaveRangeNotPoint` — candidate gave a range instead of point number. */
function detectGaveRangeNotPoint(t: string): boolean {
  return /\b(?:somewhere\s+(?:between|in\s+the\s+range\s+of)|(?:between|from)\s+(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l|lakh|lakhs)?\s+(?:and|to|–|-)\s+(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l|lakh|lakhs)?\b)\b/i.test(t) ||
    /\b(?:(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l|lakh|lakhs)\s+(?:to|–|-|and)\s+(?:₹\s*)?(\d+(?:\.\d+)?)\s*(?:lpa|l|lakh|lakhs))\b/i.test(t);
}

/* `deflectedOnRange` — candidate deflected when asked for a number.
 * BUG-007 widening (QA v3, 2026-05-19) — also catch the "salary is not
 * the main priority" / "whatever you decide / as per company standard"
 * patterns that previously only fired `candidateStance.avoidsAnchor`.
 * Without this widening, TC003 / TC019 hit the discovery-restart path
 * (no anti-exploitation guard) instead of the range-deflection prose.
 * The wired-profile rule for range-deflection then fires and produces
 * the "band-grade language + mutual disclosure" probe that explicitly
 * does NOT exploit the candidate's low-priority signal. */
function detectDeflectedOnRange(t: string): boolean {
  return /\b(?:i(?:'m|\s+am)\s+(?:quite\s+)?flexible\s+(?:on\s+the\s+(?:number|salary|range)|about\s+(?:this|the\s+(?:number|package)))|you\s+(?:tell\s+me|can\s+decide|know\s+best)\s+(?:the\s+)?(?:number|salary|package))\b/i.test(t) ||
    /\b(?:(?:whatever\s+|you\s+tell\s+me\s+)?(?:the\s+)?market\s+(?:rate|says|dictates)|(?:open\s+to\s+discussion|happy\s+with\s+the\s+market\s+rate))\b/i.test(t) ||
    /\b(?:i\s+(?:don'?t|do\s+not)\s+have\s+a\s+(?:specific\s+)?(?:number\s+in\s+mind|fixed\s+expectation))\b/i.test(t) ||
    /* BUG-007 — avoidsAnchor patterns folded in. */
    /\bas\s+per\s+(?:company|your)\s+(?:standards?|policy|norms?|discretion|decision)\b/i.test(t) ||
    /\bwhatever\s+(?:you\s+)?(?:offer|decide|think\s+is\s+fair|company\s+(?:decides|gives))\b/i.test(t) ||
    /\b(?:salary|comp(?:ensation)?|package|money|the\s+number)\s+(?:is\s+)?(?:not|isn'?t)\s+(?:the\s+)?(?:main|primary|top|biggest|key)\s+(?:priority|consideration|factor|driver)/i.test(t) ||
    /\b(?:salary|comp(?:ensation)?|package|money|the\s+number)\s+is\s+secondary\b/i.test(t);
}

/* Polish 3 (2026-05-16) — `referencedMarketData` source detector with
 * the full Indian-context catalogue. Indian candidates routinely cite
 * Naukri (separately from Naukri Salary), Blind India / Blind app,
 * Glassdoor India, IIM Jobs (senior roles), Cutshort, Indeed in
 * addition to the long-standing AmbitionBox / Levels.fyi / Payscale
 * trio. Each source has a regex (case-insensitive, word-bounded where
 * possible) and a canonical key used by `marketDataSources` for the
 * citation phrasing in the reactive followup line. */
const MARKET_DATA_SOURCE_PATTERNS: { key: string; re: RegExp }[] = [
  { key: "ambitionbox", re: /\b(?:ambitionbox|ambition\s+box)\b/i },
  { key: "levels.fyi", re: /\b(?:levels\.fyi|levels\s+fyi)\b/i },
  /* Blind: covers "blind", "blind india", "blind app", "blind salaries".
   * Anchored on the word so it doesn't match the adjective "blind". */
  { key: "blind", re: /\bblind(?:\s+(?:india|app|salaries?))?\b/i },
  /* Naukri: covers "naukri" alone AND "naukri salary"/"naukri.com". */
  { key: "naukri", re: /\bnaukri(?:[.\s]+(?:com|salary|salaries|listings?|jobs?|jobs?\s+(?:listings|data)))?\b/i },
  /* IIM Jobs: "iim jobs" or "iimjobs" (single token). Senior-role focus. */
  { key: "iimjobs", re: /\b(?:iim\s*jobs|iimjobs(?:\.com)?)\b/i },
  { key: "cutshort", re: /\bcutshort(?:\.com)?\b/i },
  { key: "glassdoor", re: /\bglassdoor(?:\s+india)?\b/i },
  { key: "payscale", re: /\bpayscale(?:\.com)?\b/i },
  /* Indeed: word-bounded so it doesn't match the adverb "indeed". A
   * candidate citing the platform almost always uses "Indeed says/data"
   * or "indeed.com". */
  { key: "indeed", re: /\b(?:indeed\.com|indeed\s+(?:says?|data|listings?|range|estimate|shows?))\b/i },
];

export function detectReferencedMarketDataSources(t: string): string[] {
  const out: string[] = [];
  for (const { key, re } of MARKET_DATA_SOURCE_PATTERNS) {
    if (re.test(t)) out.push(key);
  }
  return out;
}

/** Polish 3 (2026-05-16) — citation phrasing per market-data source.
 *  The reactive followup line uses these strings verbatim so the
 *  recruiter names the specific source the candidate referenced
 *  ("AmbitionBox numbers are useful as a floor", "Naukri listings
 *  skew towards service-company bands"), not a generic "market data
 *  estimate". */
export const marketDataSources: Record<string, string> = {
  ambitionbox: "AmbitionBox",
  "levels.fyi": "Levels.fyi",
  blind: "Blind",
  naukri: "Naukri",
  iimjobs: "IIM Jobs",
  cutshort: "Cutshort",
  glassdoor: "Glassdoor",
  payscale: "Payscale",
  indeed: "Indeed",
};

/* `referencedMarketData` — cited any of the catalogued sources OR a
 * generic "market data / market research" framing. */
function detectReferencedMarketData(t: string): boolean {
  if (detectReferencedMarketDataSources(t).length > 0) return true;
  return /\b(?:linkedin\s+salary|comparably)\b/i.test(t) ||
    /\b(?:according\s+to\s+(?:market\s+(?:data|research|survey)|salary\s+(?:data|survey|report))|market\s+(?:data|research)\s+(?:shows?|suggests?|indicates?))\b/i.test(t);
}

/* `mentionedTaxImplication` — mentioned tax implications as a comp factor. */
function detectMentionedTaxImplication(t: string): boolean {
  return /\b(?:new\s+tax\s+regime|old\s+(?:vs\.?\s+new\s+)?tax\s+regime|section\s+87\s*a\b|tax\s+(?:slab|bracket|planning|implication|saving|efficiency)|80\s*c\b|tds\s+(?:rate|deduction|planning)|effective\s+tax\s+rate)\b/i.test(t) ||
    /\b(?:post[-\s]?tax\s+(?:take[-\s]?home|in[-\s]?hand)|in[-\s]?hand\s+after\s+(?:tax|tds)|take[-\s]?home\s+after\s+(?:all\s+)?(?:deductions?|tax(?:es)?))\b/i.test(t);
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
  const cryptoTokenComp = detectCryptoTokenComp(text);
  const gccArbitrageAnchor = detectGccArbitrageAnchor(text);
  const benchTimeDisclosed = detectBenchTimeDisclosed(text);
  const founderSecondInnings = detectFounderSecondInnings(text);
  const latecareerAgeBias = detectLatecareerAgeBias(text);
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

/* ─── PDF #17 architectural fix (2026-05-15) — discovery-flag detectors ──
 *
 * Six pure detector functions for the discovery-first state machine.
 * Each returns a single boolean indicating whether the candidate's
 * utterance contains the relevant disclosure signal. The recruiter
 * MUST collect these signals (via getNextDiscoveryQuestion + the
 * isDiscoveryComplete gate) BEFORE disclosing an anchor band. */

/** Detect candidate disclosing current CTC. Looks for an explicit
 *  reference to current package + a ₹ / lakh number. Pure. */
export function detectCurrentCtcDisclosed(text: string): boolean {
  if (!text) return false;
  /* Must mention current/present compensation context AND a number/
   * range. We're conservative: a bare number without "current"/"earn"/
   * "package" context isn't a CTC disclosure (could be a target). */
  const ctcContext =
    /\b(?:my\s+current\s+(?:ctc|salary|package|comp|cost\s+to\s+company)|i'?m\s+earning|i\s+earn|i\s+make|current\s+package(?:\s+is)?|presently\s+(?:earning|getting)|today\s+i\s+(?:earn|make|get))\b/i.test(text) ||
    /\b(?:currently|right\s+now)\s+(?:at|on|earning|making|getting)\b/i.test(text);
  if (!ctcContext) return false;
  return /(?:₹|rs\.?|inr|\d+\s*(?:lpa|lakh|l\b|k\b|cr\b|crore))/i.test(text);
}

/** Detect candidate disclosing fixed/variable split. Pure. */
export function detectFixedVariableSplitDisclosed(text: string): boolean {
  if (!text) return false;
  if (/\b\d+\s*[-\s]*\d+\s*split\b/i.test(text)) return true;
  if (/\b(?:fixed\s+is|fixed\s+component|fixed\s+portion|fixed\s+pay)\b.{0,40}(?:₹|rs\.?|\d)/i.test(text)) return true;
  if (/\b(?:variable\s+is|variable\s+component|variable\s+portion|variable\s+pay)\b.{0,40}(?:₹|rs\.?|\d|%)/i.test(text)) return true;
  if (/\b\d+\s*(?:fixed|fix)\s+(?:and|plus|\+|,)\s*\d+\s*(?:variable|var)\b/i.test(text)) return true;
  if (/\bsplit\s+is\s+(?:about\s+|around\s+)?\d+/i.test(text)) return true;
  return false;
}

/** Detect candidate disclosing in-hand / take-home salary. Pure. */
export function detectInHandSalaryDisclosed(text: string): boolean {
  if (!text) return false;
  if (/\b(?:in\s*-?\s*hand|take\s*-?\s*home|monthly\s+net|net\s+per\s+month|net\s+(?:salary|in\s+hand))\b.{0,50}(?:₹|rs\.?|inr|\d)/i.test(text)) return true;
  if (/(?:₹|rs\.?|inr)\s*[\d.,]+\s*(?:in\s*-?\s*hand|take\s*-?\s*home|net|per\s+month)\b/i.test(text)) return true;
  return false;
}

/** Detect candidate disclosing notice period or earliest joining date.
 *  Pure. */
export function detectNoticePeriodDisclosed(text: string): boolean {
  if (!text) return false;
  if (/\b\d+\s*(?:day|days|week|weeks|month|months)\s*(?:of\s+)?notice\b/i.test(text)) return true;
  if (/\bnotice\s+(?:period\s+)?(?:is|of)\s+\d+\s*(?:day|week|month)/i.test(text)) return true;
  if (/\b(?:i\s+can\s+join|i'?ll\s+be\s+able\s+to\s+join|can\s+join)\s+(?:in\s+)?\d+\s*(?:day|week|month)/i.test(text)) return true;
  if (/\bserving\s+(?:my\s+)?notice\b/i.test(text)) return true;
  if (/\b(?:90|60|30|45|15)\s*[-\s]*day\s+notice\b/i.test(text)) return true;
  return false;
}

/** Detect candidate disclosing competing offer status (positive or
 *  negative). Pure. */
export function detectCompetingOffersDisclosed(text: string): boolean {
  if (!text) return false;
  if (/\b(?:i\s+have\s+(?:another|other|a\s+competing)\s+offer|i'?ve\s+got\s+another\s+offer|other\s+offers?\s+in\s+hand|active\s+offer)\b/i.test(text)) return true;
  if (/\b(?:in\s+process\s+with|interviewing\s+(?:at|with)|in\s+the\s+(?:final|last)\s+round\s+(?:at|with))\b/i.test(text)) return true;
  if (/\bcompeting\s+offers?\b/i.test(text)) return true;
  if (/\b(?:no\s+other\s+offers|i\s+don'?t\s+have\s+(?:any\s+)?other\s+offers|not\s+(?:in\s+process|interviewing)\s+(?:anywhere|with\s+anyone))\b/i.test(text)) return true;
  if (/\bonly\s+(?:offer|company)\s+(?:i'?m|i\s+am)\s+(?:talking\s+to|in\s+process\s+with)\b/i.test(text)) return true;
  return false;
}

/** Detect role-specific value proof. Pure — generic across role
 *  families. Captures ARR / book size / quota / team / product / scale
 *  numbers in a value-claim context. */
export function detectValueProofProvided(text: string): boolean {
  if (!text) return false;
  /* CSM/CS: ARR / book / retention */
  if (/\b(?:arr|annual\s+recurring|gross\s+retention|net\s+retention|gdr|ndr|gross\s+renewal|book\s+of\s+business|book\s+size)\b/i.test(text)) return true;
  /* Sales: quota / attainment / deal size */
  if (/\b(?:quota\s+(?:of|attainment)|hit\s+\d+%\s+of\s+quota|attained\s+\d+%|deal\s+size|acv|tcv|pipeline\s+of)\b/i.test(text)) return true;
  /* Engineering: scale numbers / systems shipped */
  if (/\b(?:architected|built|scaled|designed)\s+(?:a\s+)?(?:system|platform|service|pipeline)\b.{0,80}(?:million|billion|rps|qps|requests|users|transactions)/i.test(text)) return true;
  if (/\b(?:handling|serving|processing)\s+\d+(?:k|m|mn|bn|million|billion)\s+(?:requests|users|events|transactions|rps|qps)/i.test(text)) return true;
  /* Product: launched + metrics */
  if (/\b(?:launched|shipped|owned|drove)\b.{0,80}(?:metric|dau|mau|gmv|conversion|retention\s+by|revenue\s+by|grew\s+by|up\s+\d+%)/i.test(text)) return true;
  /* Design: portfolio depth */
  if (/\b(?:my\s+portfolio|case\s+study|case\s+studies|design\s+system|design\s+system\s+i\s+(?:built|owned))\b/i.test(text)) return true;
  /* People mgmt scope */
  if (/\b(?:i\s+(?:lead|manage|managed|led|run)\s+(?:a\s+)?team\s+of\s+\d+|team\s+of\s+\d+\s+(?:engineers|designers|pms|reports))\b/i.test(text)) return true;
  return false;
}

/* ─── Phase 29 (2026-05-14) — Role-applicable YOE ────────────────────
 *
 * A Senior Product Designer with 6 years of experience applying for a
 * Java Developer role has totalYoe=6 but applicableYoe≈0 — the
 * negotiation kernel must NOT pay senior rates for unrelated tenure.
 *
 * Two inputs:
 *   - resumeProfile.primaryDomain (e.g. "Product Design", "Java
 *     Backend", "Data Science") — emitted by analyze-resume.
 *   - targetRole (e.g. "java developer") — known at session start.
 *
 * Three outcomes:
 *   - match    → applicableYoe = totalYoe
 *   - adjacent → applicableYoe = totalYoe * 0.5
 *   - pivot    → applicableYoe = 0
 *
 * Conservative: when primaryDomain is missing/empty we fall back to
 * domainPivot / transferableSkillsClaimed utterance signals (if a pivot
 * is asserted in dialogue, applicableYoe collapses to 0).
 *
 * Pure: no clock, no IO. */

interface ApplicableYoeInputs {
  totalYoe: number | null;
  primaryDomain: string | null;
  targetRole: string;
  /** Optional fallbacks from utterance-derived candidateProfile. */
  domainPivot?: boolean;
}

interface DomainCanon {
  /** Canonical domain key surfaced from a free-form string. */
  key: string;
  /** Adjacent domains by canonical key. */
  adjacent: string[];
}

/* Lowercase-keyword → canonical domain. Order matters: more-specific
 * phrases first so "product designer" beats "designer". */
/* Exported for the domain-graph invariant test
 * (src/__tests__/domainGraphInvariants.test.ts). Not part of the
 * runtime public API — leading double underscore signals "internal,
 * audit-only". */
export const __DOMAIN_KEYWORDS_INTERNAL: Array<[RegExp, string]> = [
  [/\b(product\s+design(er)?|ux\s+design(er)?|ui\/?ux|interaction\s+design)\b/i, "product-design"],
  [/\b(visual\s+design|graphic\s+design|brand\s+design)\b/i, "visual-design"],
  [/\b(java\s+(backend|developer|engineer)|spring\s+boot|java\s+ee|j2ee)\b/i, "java-backend"],
  [/\b(python\s+backend|django|flask|fastapi)\b/i, "python-backend"],
  [/\b(node\.?js|nodejs\s+backend|express\s+backend)\b/i, "node-backend"],
  [/\b(\.net|c#|dotnet)\s+(backend|developer|engineer)?\b/i, "dotnet-backend"],
  [/\b(go(lang)?\s+(backend|developer|engineer))\b/i, "go-backend"],
  [/\b(backend\s+(engineer|developer|engineering)|server[-\s]side)\b/i, "backend"],
  [/\b(frontend\s+(engineer|developer|engineering)|react|angular|vue|web\s+frontend)\b/i, "frontend"],
  [/\b(full[-\s]?stack)\b/i, "fullstack"],
  [/\b(mobile|android|ios|react\s+native|flutter)\s*(engineer|developer)?\b/i, "mobile"],
  [/\b(data\s+(science|scientist)|machine\s+learning|ml\s+engineer|ai\s+engineer)\b/i, "data-science"],
  [/\b(data\s+(engineer|engineering)|etl|pipeline|warehouse)\b/i, "data-engineering"],
  [/\b(data\s+analyst|business\s+analyst|analytics)\b/i, "data-analyst"],
  [/\b(devops|sre|site\s+reliability|platform\s+engineer|infrastructure)\b/i, "devops"],
  [/\b(security\s+engineer|appsec|infosec|cybersecurity)\b/i, "security"],
  [/\b(product\s+manager|product\s+management|pm\b)\b/i, "product-management"],
  [/\b(program\s+manager|tpm|technical\s+program)\b/i, "program-management"],
  [/\b(product\s+marketing|pmm)\b/i, "product-marketing"],
  [/\b(social\s+media\s+(manager|lead|specialist|executive|coordinator|strategist)?|community\s+manager|influencer\s+(marketing|manager))\b/i, "social-media"],
  [/\b(marketing\s+(manager|lead)?|growth\s+marketing|digital\s+marketing)\b/i, "marketing"],
  [/\b(sales\s+(engineer|executive|manager)?|account\s+executive|sdr|bdr)\b/i, "sales"],
  [/\b(customer\s+success|cs\s+manager|implementation)\b/i, "customer-success"],
  [/\b(qa\s+(engineer)?|test\s+(engineer|automation)|sdet)\b/i, "qa"],
  [/\b(content\s+(writer|strategist)|technical\s+writer|copywriter)\b/i, "content"],
  [/\b(hr\b|human\s+resources|people\s+(ops|operations)|recruiter|talent\s+acquisition|hr\s+manager|hrbp)\b/i, "hr-people"],
  [/\b(finance\s+(manager|analyst)?|financial\s+analyst|accountant|controller|fp&a|treasur(er|y))\b/i, "finance"],
  /* Bug-report 13 (2026-05-14) — Operations / management / business
   * domain mappings. Pre-13 the table only had a single "operations"
   * keyword which matched too narrowly, and no entries for management /
   * business analyst / customer-success-manager etc., so a Senior
   * Product Designer applying for Operations Manager was getting an
   * "unknown" classification on the target side → applicableYoe
   * defaulted to totalYoe → senior band → catastrophic ₹25L opener. */
  [/\b(operations\s+(manager|lead|head|director)?|ops\s+(manager|lead|head)?|coo\b|chief\s+operating\s+officer|supply\s+chain\s+(manager|lead)?|logistics\s+(manager|lead)?|warehouse\s+(manager|lead)?|fulfilment|fulfillment)\b/i, "operations"],
  [/\b(project\s+manager|program\s+manager|engineering\s+manager|general\s+manager|delivery\s+manager|gm\b|pmo\b)\b/i, "management"],
  [/\b(business\s+(analyst|operations|ops)|biz\s*ops|bizops)\b/i, "business"],
  [/\b(account\s+manager|customer\s+success\s+(manager|lead)?|customer\s+experience\s+(lead|manager)?|cx\s+(lead|manager))\b/i, "customer-success"],
  [/\b(brand\s+(manager|lead)|growth\s+(manager|lead)|marketing\s+(manager|lead|director)?)\b/i, "marketing"],
  [/\b(consultant|consulting|advisory)\b/i, "consulting"],
  [/\b(teach(ing|er)?|educator|instructor|professor)\b/i, "education"],
];

/* Adjacency graph — keyed by canonical domain. Edges are bidirectional
 * conceptually but stored from-each-side for O(1) lookup. */
/* Session A (2026-05-14) audit — graph normalised to be bidirectional
 * and every key referenced by DOMAIN_KEYWORDS / by an edge value MUST
 * be a key in this record (no orphan nodes). The runtime classifier
 * uses `cand.adj.includes(b) || b.adj.includes(a)` so prior asymmetries
 * were behaviour-equivalent, but the audit invariant test now enforces
 * proper bidirectionality so the graph can be reasoned about. The
 * operations / hr-people / finance / qa / education buckets remain
 * intentionally pivot-only (no outgoing adjacency) — this is the
 * design intent from bug-report 13. */
export const __ADJACENT_INTERNAL: Record<string, string[]> = {
  "product-design": ["visual-design", "frontend", "product-management"],
  "visual-design": ["product-design"],
  "frontend": ["fullstack", "mobile", "product-design"],
  "fullstack": ["frontend", "backend", "java-backend", "node-backend"],
  "backend": ["fullstack", "java-backend", "python-backend", "node-backend", "dotnet-backend", "go-backend", "devops", "data-engineering", "security", "management"],
  "java-backend": ["backend", "fullstack"],
  "python-backend": ["backend", "data-engineering"],
  "node-backend": ["backend", "fullstack"],
  "dotnet-backend": ["backend"],
  "go-backend": ["backend", "devops"],
  "mobile": ["frontend"],
  "data-science": ["data-engineering", "data-analyst"],
  "data-engineering": ["data-science", "backend", "python-backend"],
  "data-analyst": ["data-science", "product-management", "business"],
  "devops": ["backend", "security", "go-backend"],
  "security": ["devops", "backend"],
  "product-management": ["product-marketing", "program-management", "data-analyst", "customer-success", "management", "product-design"],
  "program-management": ["product-management", "management"],
  "product-marketing": ["product-management", "marketing"],
  "marketing": ["product-marketing", "content", "sales", "social-media"],
  /* Bug-report 14 (2026-05-14) — social-media as its own bucket.
   * Adjacent to marketing + content (skill transfer is real: copy,
   * brand, audience). Not adjacent to product-design — a Senior
   * Product Designer → Social Media Manager is a true craft pivot. */
  "social-media": ["marketing", "content"],
  "sales": ["customer-success", "marketing"],
  "customer-success": ["sales", "product-management"],
  /* Bug-report 13 — management cluster is internally adjacent (e.g.
   * Engineering Manager → Program Manager). Operations / business /
   * hr-people / finance are intentionally NOT adjacent to anything else
   * outside their own bucket: cross-bucket transitions (Product Design
   * → Operations Manager, Engineering → Operations) must classify as
   * pivot to keep applicableYoe=0 and prevent over-anchoring. */
  "management": ["product-management", "program-management", "backend"],
  "business": ["data-analyst", "consulting"],
  "consulting": ["business"],
  "content": ["marketing", "social-media"],
  /* Pivot-only buckets — empty adjacency by design. */
  "operations": [],
  "hr-people": [],
  "finance": [],
  "qa": [],
  "education": [],
};

function canonDomain(s: string | null | undefined): DomainCanon | null {
  if (!s) return null;
  for (const [pat, key] of __DOMAIN_KEYWORDS_INTERNAL) {
    if (pat.test(s)) return { key, adjacent: __ADJACENT_INTERNAL[key] ?? [] };
  }
  return null;
}

export type ApplicableYoeRelation = "match" | "adjacent" | "pivot" | "unknown";

export interface ApplicableYoeResult {
  applicableYoe: number | null;
  relation: ApplicableYoeRelation;
  /** The canonical key inferred for the candidate's primary domain. */
  candidateDomainKey: string | null;
  /** The canonical key inferred for the target role's domain. */
  targetDomainKey: string | null;
}

/** Map (primaryDomain, targetRole, totalYoe) → applicableYoe.
 *  Pure. */
export function computeApplicableYoe(input: ApplicableYoeInputs): ApplicableYoeResult {
  const { totalYoe, primaryDomain, targetRole } = input;
  const cand = canonDomain(primaryDomain);
  const tgt = canonDomain(targetRole);

  /* Conservative defaults when we can't classify both sides. */
  if (totalYoe == null) {
    return { applicableYoe: null, relation: "unknown", candidateDomainKey: cand?.key ?? null, targetDomainKey: tgt?.key ?? null };
  }
  if (!cand || !tgt) {
    /* Bug-report 14 (2026-05-14) — when either side fails to classify
     * we previously defaulted to `relation: "unknown"` with applicableYoe
     * = totalYoe (full credit). That is the wrong direction for a
     * salary kernel: granting full credit to an unrecognised target role
     * lets a senior candidate's YoE anchor a senior-tier band for a
     * role the system has no model of. Bug-13 (Senior Product Designer
     * → Operations Manager → ₹25L opener) and Bug-14 (Senior Product
     * Designer → Social Media Manager → ₹32L opener) are the same
     * bug class, both rooted here. Band-aiding by adding more domain
     * keywords fixes the symptom for that role and leaves the next
     * unknown role exposed.
     *
     * Correct contract: when we cannot model the relationship, treat
     * it as a pivot. applicableYoe collapses to 0, the band-resolver
     * picks the entry tier, and the recruiter offers conservatively.
     * If the candidate IS in fact senior in the unknown role, they
     * will negotiate up from a low opener — the failure mode is mild
     * (under-offer + counter) rather than catastrophic (6–8× market
     * offer that destroys the simulation's pedagogical value).
     *
     * `relation: "unknown"` is still emitted when totalYoe is null
     * (the truly unknowable case, handled above), so callers that
     * branch on "unknown" for telemetry continue to work. */
    return { applicableYoe: 0, relation: "pivot", candidateDomainKey: cand?.key ?? null, targetDomainKey: tgt?.key ?? null };
  }
  if (cand.key === tgt.key) {
    return { applicableYoe: totalYoe, relation: "match", candidateDomainKey: cand.key, targetDomainKey: tgt.key };
  }
  if (cand.adjacent.includes(tgt.key) || tgt.adjacent.includes(cand.key)) {
    return { applicableYoe: Math.round(totalYoe * 0.5 * 10) / 10, relation: "adjacent", candidateDomainKey: cand.key, targetDomainKey: tgt.key };
  }
  return { applicableYoe: 0, relation: "pivot", candidateDomainKey: cand.key, targetDomainKey: tgt.key };
}

/** Convert applicableYoe → experienceLevel keyword consumed by the
 *  salary-lookup band resolver. Buckets: 0–1 entry, 2–4 mid, 5–8 senior,
 *  9+ staff. Null when no signal. Pure. */
export function experienceLevelFromYoe(yoe: number | null | undefined): "entry" | "mid" | "senior" | "staff" | null {
  if (yoe == null || !Number.isFinite(yoe)) return null;
  if (yoe <= 1) return "entry";
  if (yoe <= 4) return "mid";
  if (yoe <= 8) return "senior";
  return "staff";
}

export function mergeCandidateProfile(
  prior: CandidateProfileResult | null | undefined,
  next: CandidateProfileResult,
): CandidateProfileResult {
  const p = prior ?? EMPTY_CANDIDATE_PROFILE;
  const merged: CandidateProfileResult = {
    careerGapMonths: next.careerGapMonths ?? p.careerGapMonths,
    careerGapActivity: next.careerGapActivity ?? p.careerGapActivity,
    tenureSignal: next.tenureSignal ?? p.tenureSignal,
    levelMismatch: next.levelMismatch ?? p.levelMismatch,
    /* domainPivot + transferableSkillsClaimed are monotone-up — once
     * the candidate disclosed a pivot the recruiter would remember. */
    domainPivot: p.domainPivot || next.domainPivot,
    transferableSkillsClaimed:
      p.transferableSkillsClaimed || next.transferableSkillsClaimed,
    /* compensationHistoryIssue prefers the more severe of the two
     * (unpaid > delayed). Last-stated escalation wins. */
    compensationHistoryIssue:
      next.compensationHistoryIssue === "unpaid"
        ? "unpaid"
        : p.compensationHistoryIssue === "unpaid"
          ? "unpaid"
          : (next.compensationHistoryIssue ?? p.compensationHistoryIssue),
    /* Phase 26 — both fields are monotone-up: once the candidate has
     * disclosed a bond or raised the probation-comp question, the
     * recruiter would remember through the rest of the session. */
    serviceBondAccepted: p.serviceBondAccepted || next.serviceBondAccepted,
    probationCompMentioned: p.probationCompMentioned || next.probationCompMentioned,
    /* internshipConversion is monotone-up — once the candidate disclosed
     * "I was your intern" or "convert my PPO", the recruiter remembers. */
    internshipConversion: p.internshipConversion || next.internshipConversion,
    /* collegeTier — last-stated wins (recruiter would update mental
     * model on disclosure), but never demoted from null. */
    collegeTier: next.collegeTier ?? p.collegeTier,
    /* Junior-flow (2026-05-14e) — all four are monotone-up. Once the
     * candidate disclosed an early switch / low CTC / prior internship
     * / service background, the recruiter would remember through the
     * rest of the session. */
    earlySwitcher: p.earlySwitcher || next.earlySwitcher,
    lowCtcAlert: p.lowCtcAlert || next.lowCtcAlert,
    priorInternshipNonConversion: p.priorInternshipNonConversion || next.priorInternshipNonConversion,
    serviceCompanyBackground: p.serviceCompanyBackground || next.serviceCompanyBackground,
    compBreakupUnknown: p.compBreakupUnknown || next.compBreakupUnknown,
    /* Real-world Indian extensions (2026-05-14g) — all monotone-up.
     * Once disclosed, the recruiter would remember through the session. */
    recentLayoff: p.recentLayoff || next.recentLayoff,
    hotDomainPremium: p.hotDomainPremium || next.hotDomainPremium,
    pipDisclosed: p.pipDisclosed || next.pipDisclosed,
    verbalOnlyOffer: p.verbalOnlyOffer || next.verbalOnlyOffer,
    culturalJoiningConstraint: p.culturalJoiningConstraint || next.culturalJoiningConstraint,
    /* Senior + process + long-tail (2026-05-14h) — all monotone-up. */
    peopleManagementClaimed: p.peopleManagementClaimed || next.peopleManagementClaimed,
    mncExperience: p.mncExperience || next.mncExperience,
    crossBorderAnchor: p.crossBorderAnchor || next.crossBorderAnchor,
    unvestedEquityLossClaim: p.unvestedEquityLossClaim || next.unvestedEquityLossClaim,
    explodingOfferPressure: p.explodingOfferPressure || next.explodingOfferPressure,
    postAcceptanceRenege: p.postAcceptanceRenege || next.postAcceptanceRenege,
    quotaAttainmentClaimed: p.quotaAttainmentClaimed || next.quotaAttainmentClaimed,
    gardenLeaveDisclosed: p.gardenLeaveDisclosed || next.gardenLeaveDisclosed,
    nonCompeteFlagged: p.nonCompeteFlagged || next.nonCompeteFlagged,
    relocationBonusAsked: p.relocationBonusAsked || next.relocationBonusAsked,
    /* Wave-2 (2026-05-14i) — all monotone-up. */
    parentInsuranceAsked: p.parentInsuranceAsked || next.parentInsuranceAsked,
    inHandTakehomeFocus: p.inHandTakehomeFocus || next.inHandTakehomeFocus,
    rtoPushback: p.rtoPushback || next.rtoPushback,
    returnshipMaternity: p.returnshipMaternity || next.returnshipMaternity,
    payBandAsked: p.payBandAsked || next.payBandAsked,
    taxStructureAsked: p.taxStructureAsked || next.taxStructureAsked,
    bgvAnxiety: p.bgvAnxiety || next.bgvAnxiety,
    esopSophisticationProbe: p.esopSophisticationProbe || next.esopSophisticationProbe,
    spouseJobConstraint: p.spouseJobConstraint || next.spouseJobConstraint,
    agingParentCare: p.agingParentCare || next.agingParentCare,
    moonlightingDisclosed: p.moonlightingDisclosed || next.moonlightingDisclosed,
    mentalHealthDisclosed: p.mentalHealthDisclosed || next.mentalHealthDisclosed,
    payParityAsked: p.payParityAsked || next.payParityAsked,
    preemptiveCounterReceived: p.preemptiveCounterReceived || next.preemptiveCounterReceived,
    acceptanceTimeRequest: p.acceptanceTimeRequest || next.acceptanceTimeRequest,
    cryptoTokenComp: p.cryptoTokenComp || next.cryptoTokenComp,
    gccArbitrageAnchor: p.gccArbitrageAnchor || next.gccArbitrageAnchor,
    benchTimeDisclosed: p.benchTimeDisclosed || next.benchTimeDisclosed,
    founderSecondInnings: p.founderSecondInnings || next.founderSecondInnings,
    latecareerAgeBias: p.latecareerAgeBias || next.latecareerAgeBias,
    /* Wave-3 (2026-05-14j) — all monotone-up. */
    titlePrecisionAsk: p.titlePrecisionAsk || next.titlePrecisionAsk,
    currentCtcRefusal: p.currentCtcRefusal || next.currentCtcRefusal,
    pregnancyDisclosed: p.pregnancyDisclosed || next.pregnancyDisclosed,
    boomerangRehire: p.boomerangRehire || next.boomerangRehire,
    referralReceived: p.referralReceived || next.referralReceived,
    hometownReturnPreference: p.hometownReturnPreference || next.hometownReturnPreference,
    pwdDisability: p.pwdDisability || next.pwdDisability,
    gratuityVestingNear: p.gratuityVestingNear || next.gratuityVestingNear,
    acquisitionContextAsk: p.acquisitionContextAsk || next.acquisitionContextAsk,
    lgbtqDisclosure: p.lgbtqDisclosure || next.lgbtqDisclosure,
    chronicIllnessDisclosed: p.chronicIllnessDisclosed || next.chronicIllnessDisclosed,
    noticeBuyoutAsk: p.noticeBuyoutAsk || next.noticeBuyoutAsk,
    bfsiClawbackContext: p.bfsiClawbackContext || next.bfsiClawbackContext,
    bigFourGradeStep: p.bigFourGradeStep || next.bigFourGradeStep,
    securityClearanceNeeded: p.securityClearanceNeeded || next.securityClearanceNeeded,
    missionDrivenComp: p.missionDrivenComp || next.missionDrivenComp,
    edtechReputationCheck: p.edtechReputationCheck || next.edtechReputationCheck,
    acquiHireContext: p.acquiHireContext || next.acquiHireContext,
    cabinParkingAsk: p.cabinParkingAsk || next.cabinParkingAsk,
    spanOfControlAsk: p.spanOfControlAsk || next.spanOfControlAsk,
    preResignationStealth: p.preResignationStealth || next.preResignationStealth,
    reverseAnchorAsk: p.reverseAnchorAsk || next.reverseAnchorAsk,
    dietaryReligiousNeed: p.dietaryReligiousNeed || next.dietaryReligiousNeed,
    oldEmployerDocsIssue: p.oldEmployerDocsIssue || next.oldEmployerDocsIssue,
    equityRefreshCadenceAsk: p.equityRefreshCadenceAsk || next.equityRefreshCadenceAsk,
    /* Wave-3D (PDF #17 follow-up, 2026-05-15) — equity-instrument depth. */
    equityVestingScheduleAsk: p.equityVestingScheduleAsk || next.equityVestingScheduleAsk,
    equityCliffPeriodAsk: p.equityCliffPeriodAsk || next.equityCliffPeriodAsk,
    equityExerciseTermsAsk: p.equityExerciseTermsAsk || next.equityExerciseTermsAsk,
    equityBuybackLiquidityAsk: p.equityBuybackLiquidityAsk || next.equityBuybackLiquidityAsk,
    /* Wave-4 (2026-05-14k) — all monotone-up. */
    signOnClawback: p.signOnClawback || next.signOnClawback,
    variableTrackRecord: p.variableTrackRecord || next.variableTrackRecord,
    wfhEquipmentStipend: p.wfhEquipmentStipend || next.wfhEquipmentStipend,
    salaryReviewCadenceAsk: p.salaryReviewCadenceAsk || next.salaryReviewCadenceAsk,
    multipleOffersJuggling: p.multipleOffersJuggling || next.multipleOffersJuggling,
    recruitmentAgencyMediation: p.recruitmentAgencyMediation || next.recruitmentAgencyMediation,
    internalTransferContext: p.internalTransferContext || next.internalTransferContext,
    offerRescindedHistory: p.offerRescindedHistory || next.offerRescindedHistory,
    internationalDegreePremium: p.internationalDegreePremium || next.internationalDegreePremium,
    domesticTopMbaAnchor: p.domesticTopMbaAnchor || next.domesticTopMbaAnchor,
    toxicManagerContext: p.toxicManagerContext || next.toxicManagerContext,
    visaSponsorshipNeed: p.visaSponsorshipNeed || next.visaSponsorshipNeed,
    casteReservationContext: p.casteReservationContext || next.casteReservationContext,
    veteranTransition: p.veteranTransition || next.veteranTransition,
    singleParentConstraint: p.singleParentConstraint || next.singleParentConstraint,
    jointFamilyFinancialResp: p.jointFamilyFinancialResp || next.jointFamilyFinancialResp,
    paternityLeaveAsk: p.paternityLeaveAsk || next.paternityLeaveAsk,
    menstrualLeavePolicy: p.menstrualLeavePolicy || next.menstrualLeavePolicy,
    esopExerciseLoanAsk: p.esopExerciseLoanAsk || next.esopExerciseLoanAsk,
    preIpoSecondaryAsk: p.preIpoSecondaryAsk || next.preIpoSecondaryAsk,
    accelerationTriggerAsk: p.accelerationTriggerAsk || next.accelerationTriggerAsk,
    esopPerquisiteTaxAsk: p.esopPerquisiteTaxAsk || next.esopPerquisiteTaxAsk,
    tenderOfferCycleAsk: p.tenderOfferCycleAsk || next.tenderOfferCycleAsk,
    probationaryDurationAsk: p.probationaryDurationAsk || next.probationaryDurationAsk,
    offerLetterTurnaroundDemand: p.offerLetterTurnaroundDemand || next.offerLetterTurnaroundDemand,
    contractToHireAsk: p.contractToHireAsk || next.contractToHireAsk,
    headcountApprovalCheck: p.headcountApprovalCheck || next.headcountApprovalCheck,
    ipAssignmentClauseAsk: p.ipAssignmentClauseAsk || next.ipAssignmentClauseAsk,
    healthcarePharmaContext: p.healthcarePharmaContext || next.healthcarePharmaContext,
    manufacturingCoreContext: p.manufacturingCoreContext || next.manufacturingCoreContext,
    quickCommerceContext: p.quickCommerceContext || next.quickCommerceContext,
    d2cConsumerEquity: p.d2cConsumerEquity || next.d2cConsumerEquity,
    /* PDF #17 architectural fix (2026-05-15) — six discovery-flag
     * detectors. All monotone-up: once the candidate has disclosed
     * the signal, the recruiter would remember through the session. */
    currentCtcDisclosed:
      (p.currentCtcDisclosed ?? false) || (next.currentCtcDisclosed ?? false),
    fixedVariableSplitDisclosed:
      (p.fixedVariableSplitDisclosed ?? false) || (next.fixedVariableSplitDisclosed ?? false),
    inHandSalaryDisclosed:
      (p.inHandSalaryDisclosed ?? false) || (next.inHandSalaryDisclosed ?? false),
    noticePeriodDisclosed:
      (p.noticePeriodDisclosed ?? false) || (next.noticePeriodDisclosed ?? false),
    competingOffersDisclosed:
      (p.competingOffersDisclosed ?? false) || (next.competingOffersDisclosed ?? false),
    valueProofProvided:
      (p.valueProofProvided ?? false) || (next.valueProofProvided ?? false),
    /* Wave-5 (ITEM 4, 2026-05-15) — all monotone-up except nullable unions. */
    counterOfferRisk: next.counterOfferRisk ?? p.counterOfferRisk,
    /* Wave-6 (2026-05-15) — all monotone-up except nullable numerics. */
    wantsHigherBase: p.wantsHigherBase || next.wantsHigherBase,
    wantsJoiningBonus: p.wantsJoiningBonus || next.wantsJoiningBonus,
    wantsRelocationAllowance: p.wantsRelocationAllowance || next.wantsRelocationAllowance,
    /* offerDeadlineText — latest non-null wins. */
    /* Wave-7 (2026-05-15) — all monotone-up. */
    invokedCompetingOffer: p.invokedCompetingOffer || next.invokedCompetingOffer,
    askedAboutGrowthPath: p.askedAboutGrowthPath || next.askedAboutGrowthPath,
    gaveInconsistentNumbers: p.gaveInconsistentNumbers || next.gaveInconsistentNumbers,
    evasiveOnCurrentCtc: p.evasiveOnCurrentCtc || next.evasiveOnCurrentCtc,
    /* Wave-8 (2026-05-16) — monotone-up booleans; nullable fields take last non-null. */
    mentionedSpouseFamily: p.mentionedSpouseFamily || next.mentionedSpouseFamily,
    mentionedForm16: p.mentionedForm16 || next.mentionedForm16,
    askedAboutReporting: p.askedAboutReporting || next.askedAboutReporting,
    askedAboutTeamSize: p.askedAboutTeamSize || next.askedAboutTeamSize,
    askedAboutGrowthPath8: p.askedAboutGrowthPath8 || next.askedAboutGrowthPath8,
    competingOfferAmount: Math.max(p.competingOfferAmount ?? 0, next.competingOfferAmount ?? 0) || null,
    /* Wave-9 (2026-05-16) — all monotone-up. */
    mentionedBgvConcern: p.mentionedBgvConcern || next.mentionedBgvConcern,
    mentionedMoonlighting: p.mentionedMoonlighting || next.mentionedMoonlighting,
    gaveRangeNotPoint: p.gaveRangeNotPoint || next.gaveRangeNotPoint,
    deflectedOnRange: p.deflectedOnRange || next.deflectedOnRange,
    referencedMarketData: p.referencedMarketData || next.referencedMarketData,
    /* Polish 3 (2026-05-16) — union-merge per-source citations across
     * turns so the planner can name everything the candidate has ever
     * cited in this session. */
    referencedMarketDataSources: Array.from(
      new Set([
        ...(p.referencedMarketDataSources ?? []),
        ...(next.referencedMarketDataSources ?? []),
      ]),
    ),
    mentionedTaxImplication: p.mentionedTaxImplication || next.mentionedTaxImplication,
    hasAny: false,
  };
  merged.hasAny =
    merged.careerGapMonths != null ||
    merged.careerGapActivity != null ||
    merged.tenureSignal != null ||
    merged.levelMismatch != null ||
    merged.domainPivot ||
    merged.transferableSkillsClaimed ||
    merged.compensationHistoryIssue != null ||
    merged.serviceBondAccepted ||
    merged.probationCompMentioned ||
    merged.internshipConversion ||
    merged.collegeTier != null ||
    merged.earlySwitcher ||
    merged.lowCtcAlert ||
    merged.priorInternshipNonConversion ||
    merged.serviceCompanyBackground ||
    merged.compBreakupUnknown ||
    merged.recentLayoff ||
    merged.hotDomainPremium ||
    merged.pipDisclosed ||
    merged.verbalOnlyOffer ||
    merged.culturalJoiningConstraint ||
    merged.peopleManagementClaimed ||
    merged.mncExperience ||
    merged.crossBorderAnchor ||
    merged.unvestedEquityLossClaim ||
    merged.explodingOfferPressure ||
    merged.postAcceptanceRenege ||
    merged.quotaAttainmentClaimed ||
    merged.gardenLeaveDisclosed ||
    merged.nonCompeteFlagged ||
    merged.relocationBonusAsked ||
    merged.parentInsuranceAsked ||
    merged.inHandTakehomeFocus ||
    merged.rtoPushback ||
    merged.returnshipMaternity ||
    merged.payBandAsked ||
    merged.taxStructureAsked ||
    merged.bgvAnxiety ||
    merged.esopSophisticationProbe ||
    merged.spouseJobConstraint ||
    merged.agingParentCare ||
    merged.moonlightingDisclosed ||
    merged.mentalHealthDisclosed ||
    merged.payParityAsked ||
    merged.preemptiveCounterReceived ||
    merged.acceptanceTimeRequest ||
    merged.cryptoTokenComp ||
    merged.gccArbitrageAnchor ||
    merged.benchTimeDisclosed ||
    merged.founderSecondInnings ||
    merged.latecareerAgeBias ||
    merged.titlePrecisionAsk ||
    merged.currentCtcRefusal ||
    merged.pregnancyDisclosed ||
    merged.boomerangRehire ||
    merged.referralReceived ||
    merged.hometownReturnPreference ||
    merged.pwdDisability ||
    merged.gratuityVestingNear ||
    merged.acquisitionContextAsk ||
    merged.lgbtqDisclosure ||
    merged.chronicIllnessDisclosed ||
    merged.noticeBuyoutAsk ||
    merged.bfsiClawbackContext ||
    merged.bigFourGradeStep ||
    merged.securityClearanceNeeded ||
    merged.missionDrivenComp ||
    merged.edtechReputationCheck ||
    merged.acquiHireContext ||
    merged.cabinParkingAsk ||
    merged.spanOfControlAsk ||
    merged.preResignationStealth ||
    merged.reverseAnchorAsk ||
    merged.dietaryReligiousNeed ||
    merged.oldEmployerDocsIssue ||
    merged.equityRefreshCadenceAsk ||
    merged.equityVestingScheduleAsk ||
    merged.equityCliffPeriodAsk ||
    merged.equityExerciseTermsAsk ||
    merged.equityBuybackLiquidityAsk ||
    merged.signOnClawback ||
    merged.variableTrackRecord ||
    merged.wfhEquipmentStipend ||
    merged.salaryReviewCadenceAsk ||
    merged.multipleOffersJuggling ||
    merged.recruitmentAgencyMediation ||
    merged.internalTransferContext ||
    merged.offerRescindedHistory ||
    merged.internationalDegreePremium ||
    merged.domesticTopMbaAnchor ||
    merged.toxicManagerContext ||
    merged.visaSponsorshipNeed ||
    merged.casteReservationContext ||
    merged.veteranTransition ||
    merged.singleParentConstraint ||
    merged.jointFamilyFinancialResp ||
    merged.paternityLeaveAsk ||
    merged.menstrualLeavePolicy ||
    merged.esopExerciseLoanAsk ||
    merged.preIpoSecondaryAsk ||
    merged.accelerationTriggerAsk ||
    merged.esopPerquisiteTaxAsk ||
    merged.tenderOfferCycleAsk ||
    merged.probationaryDurationAsk ||
    merged.offerLetterTurnaroundDemand ||
    merged.contractToHireAsk ||
    merged.headcountApprovalCheck ||
    merged.ipAssignmentClauseAsk ||
    merged.healthcarePharmaContext ||
    merged.manufacturingCoreContext ||
    merged.quickCommerceContext ||
    merged.d2cConsumerEquity ||
    (merged.currentCtcDisclosed ?? false) ||
    (merged.fixedVariableSplitDisclosed ?? false) ||
    (merged.inHandSalaryDisclosed ?? false) ||
    (merged.noticePeriodDisclosed ?? false) ||
    (merged.competingOffersDisclosed ?? false) ||
    (merged.valueProofProvided ?? false) ||
    /* Wave-5 (ITEM 4, 2026-05-15) */
    merged.counterOfferRisk != null ||
    /* Wave-6 (2026-05-15) */
    merged.wantsHigherBase ||
    merged.wantsJoiningBonus ||
    merged.wantsRelocationAllowance ||
    /* Wave-7 (2026-05-15) */
    merged.invokedCompetingOffer ||
    merged.askedAboutGrowthPath ||
    merged.gaveInconsistentNumbers ||
    merged.evasiveOnCurrentCtc ||
    /* Wave-8 (2026-05-16) */
    merged.mentionedSpouseFamily ||
    merged.mentionedForm16 ||
    merged.askedAboutReporting ||
    merged.askedAboutTeamSize ||
    merged.askedAboutGrowthPath8 ||
    merged.competingOfferAmount != null ||
    /* Wave-9 (2026-05-16) */
    merged.mentionedBgvConcern ||
    merged.mentionedMoonlighting ||
    merged.gaveRangeNotPoint ||
    merged.deflectedOnRange ||
    merged.referencedMarketData ||
    merged.mentionedTaxImplication;
  return merged;
}
