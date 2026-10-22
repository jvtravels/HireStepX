/* Negotiation kernel: state factory, multi-round helpers, decline detection, unit accessors. */

import type { NegotiationBand, NegotiationPhase } from "./_negotiation-vocab";
import { type PriorContext, type PowerSignals, type MarketMode, type RecruiterPersona, type SessionDifficulty, type NegotiationState, enforceMinimumSpread, applyDifficultyToBand, applyPersonaToBand, computeRecruiterPower } from "./_negotiation-state-types";
import { type RecruiterSectorPersona, selectRecruiterSectorPersona } from "./_indian-recruiter-personas";
import { type NegotiationRoundPersona, selectNextRoundPersona } from "./_negotiation-rounds";
import { type ResumeFactPack, buildResumeFactPack, deriveCandidateProfileSeed } from "./_resume-fact-pack";
import { getBandForRole, classifyCompanyTier as classifyBandCompanyTier, classifyRoleFamily } from "./_company-band-tiers";
import { EMPTY_CANDIDATE_PROFILE } from "./_candidate-profile";
import { emptyLedger } from "./_conversation-ledger";
import { EMPTY_COMP } from "./_compensation-model";
import { deriveRecruiterMood } from "./_recruiter-prose-realism";
import { deriveTimeContext } from "./_recruiter-time-context";
import { EMPTY_SALES_OTE, EMPTY_CONTRACT_RATE } from "./_comp-structure";
import { EMPTY_RETENTION_COUNTER } from "./_retention-counter";
import { EMPTY_DISCOVERY_CHECKLIST, type DiscoveryStage, isDiscoveryComplete } from "./_discovery-stage";
import { detectResumeRoleMismatch } from "./_resume-role-match";

/* ─── Factory ────────────────────────────────────────────────────── */

export interface InitStateInput {
  sessionId: string;
  role: string;
  company: string;
  band: NegotiationBand;
  maxTurns?: number;
  /* Kernel-first cleanup (2026-05-16) — role facts and candidate name
   * surfaced as typed init inputs. All optional / nullable. */
  workMode?: "remote" | "hybrid" | "office" | null;
  teamSize?: number | null;
  reportingTo?: string | null;
  joiningWindow?: string | null;
  perfCycle?: string | null;
  equityStructure?: string | null;
  candidateName?: string | null;
  /* Prior-context feature (2026-05-29) — caller-declared upfront
   * context (existing competing offer or retention package). Optional
   * and SET ONCE here; the planner reads it on every turn but the
   * kernel never mutates it. */
  priorContext?: PriorContext;
  /* 2026-05-30 time-context — ISO-8601 timestamp of the call. Used to
   * derive `timeContext` once at session init via `deriveTimeContext`.
   * Optional; undefined defaults to "midweek-standard" (no behavioral
   * change). Treated as a one-shot input — never re-evaluated mid-call,
   * since a single negotiation is a single moment in time. */
  callTimeIso?: string;
  /* Recruiter-power-dynamics feature (2026-05-29) — caller-declared
   * signal bundle. Folded into `recruiterPower` once at init via
   * `computeRecruiterPower`. Undefined → power 0, signals {}, behavior
   * is identity. */
  powerSignals?: PowerSignals;
}

export interface InitStateExtras {
  hardBandCap?: boolean;
  marketMode?: MarketMode;
  recruiterPersona?: RecruiterPersona;
  /* Phase 3 of Salary-Negotiation SCORE_IMPROVEMENT_PLAN (2026-05-18) —
   * the sector archetype the caller has resolved from company + band.
   * Optional: when omitted, `initState` derives via
   * selectRecruiterSectorPersona using only the band shape (heuristic
   * fallback). Callers in negotiate-turn pass an explicit tierBucket
   * via the dedicated field below so the kernel doesn't need to
   * depend on data/company-tiers. */
  recruiterSectorPersona?: RecruiterSectorPersona;
  /* Optional tierBucket hint forwarded from the caller. Used only by
   * the persona selector when recruiterSectorPersona is not
   * pre-resolved. */
  tierBucketHint?: import("../src/_negotiation-math").CompanyTierBucket | null;
  /* Phase 29 — role-applicable YOE plumbed from the client (resume
   * profile + target role). All three optional; defaults to null. */
  candidateTotalYoe?: number | null;
  candidateApplicableYoe?: number | null;
  candidatePrimaryDomain?: string | null;
  /* ResumeFactPack track (2026-05-16) — caller may pass either a
   * pre-built fact pack OR a raw parsed-resume shape. When both are
   * absent the kernel runs with resumeFactPack = null and the
   * credibility-probe / prior-CTC floor levers are inert (back-compat). */
  resumeFactPack?: import("./_resume-fact-pack").ResumeFactPack | null;
  parsedResume?: import("./_resume-fact-pack").ParsedResume | null;
  /* Phase 5 Session A (2026-05-19) — multi-round simulated persona
   * switch. Default-OFF; when omitted or false, the kernel runs single-
   * round (HEAD behaviour). When true, `roundPersona` initialises to
   * "hr-partner", `roundIndex` to 0, and `perRoundBand` is derived from
   * the input band unless the caller pre-resolves it. */
  multiRoundEnabled?: boolean;
  perRoundBand?: Record<NegotiationRoundPersona, NegotiationBand>;
  /* Adaptive session difficulty (2026-06-20) — forwarded from
   * _scenario-seed.ts via negotiate-turn. Modulates recruiter posture
   * (maxStretch / walkAway) through applyDifficultyToBand at init.
   * Optional; "standard"/undefined is identity, so existing callers and
   * tests are unchanged. */
  sessionDifficulty?: SessionDifficulty;
  /* Cross-session bad-faith-tactic rotation cursor (2026-06-20) —
   * forwarded from _scenario-seed.ts via negotiate-turn. Frozen onto
   * state; the planner mods it per tactic family to rotate the variant a
   * returning user sees. Optional; undefined ⇒ planner falls back to the
   * legacy session-local hash seeding (existing callers/tests unchanged). */
  tacticRotation?: number;
}

export function initState(input: InitStateInput & InitStateExtras): NegotiationState {
  /* ResumeFactPack track (2026-05-16) — build once at init and freeze on
   * state. Caller may supply a pre-built pack OR a raw parsed resume;
   * when both absent the kernel runs without resume context (back-compat). */
  const resumeFactPack: ResumeFactPack | null =
    input.resumeFactPack
      ?? (input.parsedResume ? buildResumeFactPack(input.parsedResume) : null);

  /* Derive impliedPriorCtcFromResume once at init. Reads the latest
   * role's company-tier and projects through the role-family × tier
   * band median. Used as a prior-CTC floor in counter-offer split math
   * when the candidate later withholds currentCtc. Null when the
   * latest role can't be resolved to a band tier. */
  let impliedPriorCtcFromResume: number | null = null;
  if (resumeFactPack?.latestRole?.companyName) {
    const band = getBandForRole(
      classifyBandCompanyTier(resumeFactPack.latestRole.companyName),
      input.role,
      input.candidateApplicableYoe ?? input.candidateTotalYoe ?? null,
    );
    impliedPriorCtcFromResume = band.target;
  }

  /* Pre-seed candidateProfile flags with provenance="resume". The
   * mergeCandidateProfile layer is monotone-up (||) so candidate
   * utterances can later confirm these flags but never downgrade. */
  const seed = deriveCandidateProfileSeed(resumeFactPack);
  const seededProfile = { ...EMPTY_CANDIDATE_PROFILE };
  const flagProvenance: Record<string, "resume" | "stated"> = {};
  if (seed.tenureSignal) {
    seededProfile.tenureSignal = seed.tenureSignal;
    flagProvenance.tenureSignal = "resume";
  }
  if (seed.peopleManagementClaimed) {
    seededProfile.peopleManagementClaimed = true;
    flagProvenance.peopleManagementClaimed = "resume";
  }
  if (seed.domesticTopMbaAnchor) {
    seededProfile.domesticTopMbaAnchor = true;
    flagProvenance.domesticTopMbaAnchor = "resume";
  }
  /* ResumeFactPack track (2026-05-16) — mncExperience is now a
   * first-class field on CandidateProfileResult. Pre-seed from the
   * resume pack (faang or indian-product tier in priorCompanies)
   * with provenance="resume". Resume wins on conflict; mergeCandidateProfile
   * is monotone-up, so a later stated utterance cannot downgrade. */
  if (seed.mncExperience) {
    seededProfile.mncExperience = true;
    flagProvenance.mncExperience = "resume";
  }
  /* hasAny derives from any flag being set; recompute. */
  seededProfile.hasAny =
    EMPTY_CANDIDATE_PROFILE.hasAny ||
    seededProfile.tenureSignal != null ||
    seededProfile.peopleManagementClaimed ||
    seededProfile.mncExperience ||
    seededProfile.domesticTopMbaAnchor;

  return {
    sessionId: input.sessionId,
    role: input.role,
    company: input.company,
    band: enforceMinimumSpread(
      applyDifficultyToBand(
        applyPersonaToBand({ ...input.band }, input.recruiterPersona ?? "consultative"),
        input.sessionDifficulty ?? "standard",
      ),
    ),
    phase: "opening",
    turnIndex: 0,
    /* BUG-5 (PDF#24, 2026-05-16) — default raised from 8 to 16, then
     * raised again to 20 in the follow-up audit. Worst-case turn count
     * for a fully exercised session:
     *   - Ordered discovery cascade: currentCtc, currentCtcFixedVariable
     *     Split, expectedCtc, expectedCtcFixedVariableSplit, noticePeriod,
     *     competingOffers, valueProof = 7 AI turns
     *   - Range-disclosure: 1 turn
     *   - Open-with-offer / first anchor: 1 turn
     *   - Counter-base spiral, rounds 0..2 with diminishing concessions:
     *     3 turns
     *   - Closing-push runway (fires at maxTurns-1 from counter-offer /
     *     lever-explore): 1 turn
     *   - Close-recap formal: 1 turn
     *   Subtotal: 14 turns minimum, zero off-script questions.
     * Real candidates ask 2-4 off-script questions across a session
     * (work mode, equity, relocation, etc.) which the response pipeline
     * routes through the answer-and-pivot branch — each one burns an
     * AI turn before the planned canonical resumes. Twenty leaves 6
     * turns of headroom on top of the floor, which fits 4+ off-script
     * interruptions before stalemate fires. Sixteen left only 2 turns
     * of headroom, too tight for as-per-band reality. */
    maxTurns: input.maxTurns ?? 20,
    candidateTarget: null,
    candidateTargetFixed: null,
    candidateTargetIsInHand: false,
    candidateTargetCtcEquivalentLpa: null,
    lastCandidateCounterLpa: null,
    lastCounterComponent: null,
    firstAnchoredTarget: null,
    candidateCurrentCtc: null,
    candidateCurrentCompany: null,
    /* PDF #28 PR-1 — empty Conversation Ledger. No writers yet. */
    ledger: emptyLedger(),
    competingOffer: null,
    candidateComponentBreakdown: { base: null, variable: null, equity: null, hasAny: false },
    candidateAskedAsRange: false,
    candidateTargetWasRange: undefined,
    userClaims: {},
    lastContradiction: null,
    candidateComp: { ...EMPTY_COMP },
    highestOfferMade: 0,
    firstOfferAtTurn: null,
    leversUsed: [],
    lastAiText: "",
    lastJoiningBonusOffered: null,
    /* S20-B2 (2026-07-22) — equity grant amount. Initialized to null;
     * set in applyAiMove when the equity-grant lever fires. */
    equityGrantAmountLpa: null,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    infoAskedInitiated: [],
    verbalAcceptanceTurn: null,
    postVerbalRenegotiationCount: 0,
    counterRound: 0,
    recentRecoveryActive: false,
    walkAwayReturned: false,
    hardBandCap: input.hardBandCap ?? false,
    marketMode: input.marketMode ?? "neutral",
    recruiterPersona: input.recruiterPersona ?? "consultative",
    /* Cross-session bad-faith-tactic rotation cursor (2026-06-20). When the
     * caller (negotiate-turn via _scenario-seed) supplies it, freeze it so
     * the planner rotates tactic variants across sessions; when omitted,
     * leave it undefined and the planner uses its legacy session hash. */
    tacticRotation: input.tacticRotation,
    /* Phase 3 of Salary-Negotiation plan — sector persona derived once
     * from the (tierBucket hint, band shape, company). Caller-supplied
     * value wins; otherwise the kernel runs the selector against the
     * band shape (heuristic fallback). Cheap, deterministic; never
     * mutates after init. */
    recruiterSectorPersona:
      input.recruiterSectorPersona ??
      selectRecruiterSectorPersona({
        tierBucket: input.tierBucketHint ?? null,
        band: input.band,
        company: input.company,
      }),
    /* 2026-05-29 mood-pass — seed the recruiter mood from a hash of
     * sessionId. Deterministic per session, roughly even split across
     * the three buckets. Pure / no I/O. Mood affects prose tone only
     * (see `_recruiter-prose-realism.ts`); planner/strategy is
     * mood-blind. */
    recruiterMood: deriveRecruiterMood(input.sessionId),
    /* 2026-05-30 time-context — derive once at session init. Undefined
     * callTimeIso → "midweek-standard" (behavioral no-op). Single
     * negotiation = single moment in time; never re-derived. */
    timeContext: deriveTimeContext({ callTimeIso: input.callTimeIso }),
    /* 2026-05-29 mood-shift-pass — dynamic mood overlay starts at
     * baseline (no shift). applyMoodShift in applyCandidateAnswer
     * transitions baseline → cooled → rewarmed based on candidate
     * behaviour. */
    recruiterMoodDynamic: "baseline",
    recruiterMoodDynamicEnteredAtTurn: null,
    consecutiveOverBandAsks: 0,
    recruiterMoodColdLineFiredAtTurn: null,
    recruiterMoodRewarmLineFiredAtTurn: null,
    recruiterMoodPeakCandidateAskLpa: null,
    /* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall state. */
    stallTurnsRemaining: 0,
    stallsFiredCount: 0,
    lastStallContext: null,
    acceptedAtTurn: null,
    postAcceptanceDocsRequestedAtTurn: null,
    walkedAwayAtTurn: null,
    stalemateAtTurn: null,
    /* Phase 3 missing-lever set (2026-05-17) — single-fire turn markers. */
    panelApprovalStallFiredAtTurn: null,
    politeWalkawayFiredAtTurn: null,
    hikeStrongDefenseFiredAtTurn: null,
    fakeLeverageChallengeFiredAtTurn: null,
    holdGrantedAtTurn: null,
    competitorMatchFiredAtTurn: null,
    ctcInflationAnchorCtcLpa: null,
    /* Audit follow-up (2026-05-21) — kernel chaos test caught schema
     * drift on 10 optional fields: applyCandidateAnswer produced these
     * keys, but initState never seeded them. Consumers checking the
     * field before its first trigger got `undefined`, often masked
     * because the field is typed `?:`. Explicit defaults close the
     * drift so the state shape after initState ≡ state shape after
     * applyCandidateAnswer (modulo derived facts). */
    repetitionComplaintAtTurn: null,
    lastAnswerClarificationAtTurn: null,
    lastAnswerNoiseAtTurn: null,
    lastAnswerOfferRecapAtTurn: null,
    lastAnswerUncertainAt: null,
    lastTurnDelta: null,
    lastUserFrustrated: false,
    offerAskedAtTurn: null,
    pendingCandidateAcks: [],
    phaseEnteredAtTurn: null,
    plannedNextAction: null,
    lastShippedAction: null,
    hikePercent: null,
    rationale: null,
    noticeJoining: {
      noticePeriodDays: null,
      buyoutRequested: false,
      joiningBonusAsk: null,
      earlyJoinPreferred: false,
      joiningBonusClawbackDiscussed: false,
      lastWorkingDayText: null,
      hasAny: false,
    },
    equityVesting: {
      vestingYears: null,
      cliffMonths: null,
      preference: null,
      familiarity: null,
      strikePriceDiscussed: false,
      valuationDiscussed: false,
      liquidityDiscussed: false,
      equityExists: null,
      hasAny: false,
    },
    locationMode: {
      workMode: null,
      locationCity: null,
      relocationRequested: false,
      relocationRefused: false,
      hasAny: false,
    },
    competingOfferDetail: {
      company: null,
      status: null,
      stage: null,
      amount: null,
      letterShareOffered: false,
      onHold: false,
      proofRequestedAtTurn: null,
      proofProvided: false,
      hasAny: false,
    },
    decisionDeadline: {
      deadlineDays: null,
      deadlineExplicit: false,
      conditionalAcceptance: false,
      conditionalEvidence: null,
      requestsHold: false,
      hasAny: false,
    },
    candidateProfile: seededProfile,
    miscSignals: {
      candidateFloor: null,
      salaryReviewMonths: null,
      proofOfCtcShareable: null,
      internalCounterRisk: null,
      hasAny: false,
    },
    candidateStance: {
      flexibilityPosture: null,
      marketReferenceVague: false,
      salaryOnlyFactor: false,
      badmouthsCurrent: false,
      confidentialOvershare: false,
      soundsDesperate: false,
      treatsEquityAsCash: false,
      avoidsAnchor: false,
      personalExpenseJustification: false,
      offerShoppingDemand: false,
      dismissesVariableRisk: false,
      overpromisesJoining: false,
      complainedAboutHikePercent: false,
      stallSignal: null,
      hasAny: false,
    },
    salesOTE: { ...EMPTY_SALES_OTE },
    contractRate: { ...EMPTY_CONTRACT_RATE },
    retentionCounter: { ...EMPTY_RETENTION_COUNTER },
    candidateTotalYoe: input.candidateTotalYoe ?? null,
    candidateApplicableYoe: input.candidateApplicableYoe ?? null,
    candidatePrimaryDomain: input.candidatePrimaryDomain ?? null,
    freshGradDisclosed: false,
    wfhFlexibilityMentioned: false,
    firstCounterVsOffer: null,
    lastCounterVsOffer: null,
    recruiterFactsAlreadySaid: [],
    answeredQuestionLedger: {},
    pendingPromises: [],
    lastBotReply: null,
    anchorLocked: false,
    lockedAnchorLpa: null,
    minTurnsBeforeClose: 8,
    /* PDF #17 architectural fix (2026-05-15) — initial checklist all
     * false. PDF#38 BUG-B (2026-05-20) — the prior init wired
     * discoveryStage unconditionally to "discovery", which orphaned
     * the planner's probe-mismatch consumer (no code anywhere set
     * the stage to "probe-mismatch"). Now we derive the initial
     * stage from a resume↔role hard mismatch: when the candidate's
     * resume domain (resumeFactPack.latestRole.title preferred,
     * candidatePrimaryDomain as fallback) crosses a domain-family
     * boundary versus the target role, we route the first
     * substantive turn through the mismatch-probe before letting
     * the discovery cascade or anchor turn fire. Subsequent
     * stage advance to "discovery" happens in applyAiMove below
     * (after the probe-mismatch lever lands its single turn). */
    discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    discoveryStage: ((): DiscoveryStage => {
      const resumeTitle =
        resumeFactPack?.latestRole?.title ?? input.candidatePrimaryDomain ?? null;
      if (!resumeTitle || !input.role) return "discovery";
      const mm = detectResumeRoleMismatch({
        resumeTitle,
        targetRole: input.role,
      });
      return mm.mismatch && mm.severity === "hard" ? "probe-mismatch" : "discovery";
    })(),
    /* Negotiation-flow redesign commit 4 (2026-05-15) — reactive-followup
     * de-dupe ledger. Empty at session start; each reactive-followup
     * emission pushes its topic. */
    reactiveFollowupsFired: [],
    /* Bad-faith tactic injection ledgers (2026-05-29). Empty at start. */
    tacticsUsed: [],
    userCaughtTactics: [],
    /* Polish 2 (2026-05-16) — per-topic fire-history. Empty at start. */
    reactiveFollowupsFireLog: {},
    /* 2026-05-29 realism-pass — per-topic answer-direct serve count for
     * strict variant rotation. Empty at start. */
    candidateQuestionServeCount: {},
    /* 2026-05-29 realism-pass — candidate register classifier output.
     * Defaults to neutral; recomputed each candidate turn. */
    candidateRegister: "neutral",
    /* Fix 1 (2026-05-16) — leversFired ledger for Indian-context
     * structural levers. Empty at session start. */
    leversFired: [],
    /* Perfect 3 (2026-05-16) — cumulative urgency sticky upgrade ledger.
     * "none" at init; computeTurnDelta + finalize() promote to soft / firm
     * monotonically across the session. */
    cumulativeUrgency: "none",
    /* Kernel-first cleanup (2026-05-16) — first-class role facts and
     * candidate name. Default null when caller doesn't supply. */
    workMode: input.workMode ?? null,
    teamSize: input.teamSize ?? null,
    reportingTo: input.reportingTo ?? null,
    joiningWindow: input.joiningWindow ?? null,
    perfCycle: input.perfCycle ?? null,
    equityStructure: input.equityStructure ?? null,
    candidateName: input.candidateName ?? null,
    resumeFactPack,
    impliedPriorCtcFromResume,
    flagProvenance,
    candidateStatedCurrentCompany: null,
    credibilityProbeFired: false,
    credibilityProbeAvoidedAt: null,
    /* Prompt-injection defense telemetry (2026-05-17) — empty ledger at
     * session start; appended by the candidate-turn intake when
     * detectAndSanitizeInjection flags the utterance. */
    promptInjectionAttempts: [],
    /* Phase 5 Session A (2026-05-19) — multi-round persona switch.
     * Default-OFF invariance: when `multiRoundEnabled` is false (HEAD
     * default), `roundPersona` stays undefined, `roundIndex` stays 0,
     * `roundTransitions` stays empty, `perRoundBand` stays undefined.
     * No round-aware code path can fire. When true, seed at HR Partner /
     * round 0 with derived per-round band defaults (caller may override). */
    multiRoundEnabled: input.multiRoundEnabled === true,
    roundPersona: input.multiRoundEnabled === true ? "hr-partner" : undefined,
    roundIndex: 0,
    roundTransitions: [],
    perRoundBand:
      input.multiRoundEnabled === true
        ? (input.perRoundBand ?? deriveDefaultPerRoundBand(input.band))
        : undefined,
    /* Prior-context feature (2026-05-29) — pass-through. Undefined
     * when caller doesn't declare; otherwise frozen for session
     * lifetime. */
    priorContext: input.priorContext,
    /* Affinity-dynamic feature (2026-05-29). */
    recruiterAffinity: 0,
    affinityLedger: [],
    /* Paraphrase-loop feature (2026-05-29). */
    paraphraseFired: false,
    paraphraseCorrections: [],
    /* Calibrated-surprise lowball feature (2026-05-29). */
    calibratedSurpriseFired: false,
    calibratedSurpriseContext: null,
    acceptedLowball: false,
    acceptLowballQuietFiredAtTurn: null,
    /* Proactive-sweetener feature (2026-05-30). */
    proactiveSweetenerFired: false,
    /* Recruiter-power-dynamics feature (2026-05-29) — scalar derived
     * once at init from caller-declared signals. Undefined input →
     * {} signals and power 0 (identity behavior). */
    powerSignals: input.powerSignals ?? {},
    recruiterPower: computeRecruiterPower(input.powerSignals ?? {}),
  };
}

/* ─── Phase 5 Session A (2026-05-19) — multi-round helpers ─────────── */

/** Derive a `perRoundBand` record from a single base band. Used by
 *  `initState` when caller enables multi-round but doesn't pre-resolve
 *  the per-round bands.
 *
 *  Shape:
 *   - HR Partner    = floor only           → initialOffer = base.initialOffer,
 *                                            maxStretch = base.initialOffer
 *   - Hiring Manager= floor + ~8% stretch  → maxStretch = floor + 8% of
 *                                            (base.maxStretch − base.initialOffer)
 *                                            (i.e. partial stretch authority)
 *   - Director      = full stretch         → identical to the base band
 *
 *  walkAway / hasEquity / component caps stay aligned with the base band
 *  so the close-floor invariant (highestOfferMade never drops on round
 *  swap) is preserved structurally. */
export function deriveDefaultPerRoundBand(
  base: NegotiationBand,
): Record<NegotiationRoundPersona, NegotiationBand> {
  const stretchGap = Math.max(0, base.maxStretch - base.initialOffer);
  return {
    "hr-partner": {
      ...base,
      initialOffer: base.initialOffer,
      maxStretch: base.initialOffer,
    },
    "hiring-manager": {
      ...base,
      initialOffer: base.initialOffer,
      maxStretch: base.initialOffer + stretchGap * 0.08,
    },
    "director": {
      ...base,
      initialOffer: base.initialOffer,
      maxStretch: base.maxStretch,
    },
  };
}

/** Round-end trigger evaluator. Returns the post-transition state when
 *  the current round is closing AND there's a next persona in the
 *  sequence; otherwise returns `state` unchanged.
 *
 *  Fires when:
 *    1. `multiRoundEnabled` is true (default-OFF invariance);
 *    2. `roundPersona` is set AND `selectNextRoundPersona` returns a
 *       non-null next persona (i.e. roundIndex < 2);
 *    3. Current phase is one of:
 *         - "closing-push"   (the round-end pressure beat)
 *         - "accepted"       (candidate accepted this round)
 *         - "walked-away"    (candidate walked this round)
 *       In all three cases, this round has run its course and the next
 *       persona takes over.
 *
 *  On transition:
 *    - `roundPersona` ← next persona
 *    - `roundIndex`   incremented
 *    - `roundTransitions` accumulates the handoff entry
 *    - `phase`        reset to "opening" (each round opens fresh)
 *    - `band`         swapped to `perRoundBand[newPersona]` when defined
 *      (preserves close-floor invariant by clamping initialOffer at
 *      `highestOfferMade` if the new round band's initialOffer would
 *      drop below it; that's handled inside the swap itself).
 *    - `verbalAcceptanceTurn` / `acceptedAtTurn` / `walkedAwayAtTurn`
 *      cleared (round-scoped — next round starts fresh).
 *
 *  When `roundIndex === 2` (Director already in seat) AND the round
 *  closes, NO transition fires: the session terminates as today.
 *
 *  Pure. Call from `applyAiMove` AND `applyCandidateAnswer` at the tail,
 *  after the normal phase derivation. Idempotent — running on a state
 *  that doesn't satisfy the trigger returns the input reference. */
export function maybeAdvanceRound(state: NegotiationState): NegotiationState {
  if (!state.multiRoundEnabled) return state;
  const current = state.roundPersona;
  if (current == null) return state;
  /* Round-end signal: closing-push OR a terminal phase reached this round. */
  const ROUND_END_PHASES = new Set<NegotiationPhase>([
    "closing-push",
    "accepted",
    "walked-away",
  ]);
  if (!ROUND_END_PHASES.has(state.phase)) return state;
  const next = selectNextRoundPersona(current);
  if (next == null) return state; /* Director — terminal, no further round. */
  /* Defensive guard — should never trip given the index/persona invariant
   * carried through initState + this helper, but kept so a corrupted
   * legacy session can't escalate past Director. */
  const currentIndex = state.roundIndex ?? 0;
  if (currentIndex >= 2) return state;
  const nextIndex = (currentIndex + 1) as 0 | 1 | 2;
  const nextBand =
    state.perRoundBand?.[next] ?? state.band;
  /* Preserve the candidate's disclosed signal: the band swap MUST NOT
   * drop initialOffer below `highestOfferMade`, otherwise the close-
   * floor invariant breaks across the handoff. Clamp upward if needed. */
  const clampedBand: NegotiationBand =
    nextBand.initialOffer < state.highestOfferMade
      ? { ...nextBand, initialOffer: state.highestOfferMade }
      : nextBand;
  return {
    ...state,
    roundPersona: next,
    roundIndex: nextIndex,
    roundTransitions: [
      ...(state.roundTransitions ?? []),
      { atTurn: state.turnIndex, from: current, to: next },
    ],
    phase: "opening",
    band: clampedBand,
    /* Round-scoped — clear acceptance / walked-away markers so the new
     * round's machinery starts fresh. `highestOfferMade` is preserved
     * (the candidate doesn't forget what's been put on the table). */
    verbalAcceptanceTurn: null,
    acceptedAtTurn: null,
    walkedAwayAtTurn: null,
  };
}

/* ─── Fix 3 (PDF #17 follow-up, 2026-05-15) — Explicit decline + dead-end ──
 *
 * Real-session bug: bot ended a 6-turn conversation with "View Result"
 * and no resolution. The terminal-state invariant below tightens
 * transitions: terminal phases (accepted / walked-away / stalemate)
 * may only fire when ONE of the following is true:
 *
 *   1. detectExplicitAcceptance(answer).accepted === true AND
 *      highestOfferMade > 0
 *   2. Candidate explicitly declined ("I'm passing", "I'll decline",
 *      "not interested")
 *   3. turnIndex >= MAX_TURNS_PER_SESSION (hard cap)
 *   4. Three consecutive "I don't know" / "I'm not sure" candidate
 *      turns (genuine dead-end)
 *
 * The minTurnsBeforeClose guard blocks (1) and (4) before the floor
 * turn count. (2) and (3) always pass. Pure. */

export const EXPLICIT_DECLINE_PATTERNS: RegExp[] = [
  /\b(?:i'?m\s+passing|i\s+am\s+passing|i\s+will\s+pass|i'?ll\s+pass)\b/i,
  /\b(?:i\s+(?:will\s+)?decline|i'?ll\s+decline|i\s+have\s+to\s+decline|i\s+must\s+decline)\b/i,
  /* S77-B2 (2026-07-25) — same component-noun lookahead as isWalkAway; bare
   * "not interested in the variable/equity/structure" must not trigger early exit */
  /\b(?:not\s+interested|no(?:'?t|t)\s+interested|i'?m\s+not\s+interested)(?!\s+in\s+(?:(?:a|the|an?|this|that|your|our|their|my)\s+)?(?:\w+\s+)?(?:variable|fixed|equity|stock|rsu|esop|bonus|perks?|benefits?|structure|arrangement|split|breakdown|ratio|format|scheme|component|option|allocation|composition|mix)\b)\b/i,
  /\b(?:withdraw(?:ing)?\s+(?:my\s+)?(?:candidacy|application)|stepping\s+out\s+of\s+(?:this\s+)?process)\b/i,
  /\b(?:i'?ll\s+(?:go|move)\s+with\s+(?:the\s+)?other(?:s)?|going\s+with\s+another\s+offer)\b/i,
];

export function detectExplicitDecline(answer: string | null | undefined): boolean {
  if (!answer || typeof answer !== "string") return false;
  return EXPLICIT_DECLINE_PATTERNS.some((p) => p.test(answer));
}

/** PDF#35 Move 3 (2026-05-18) — flat-ack vocabulary. Single source of
 *  truth for "bare acknowledgement, zero new content" candidate
 *  utterances. Prior implementation caught only "ok / cool / sure";
 *  Meesho/Prita replay surfaced "got it", "right", "noted",
 *  "understood", "makes sense", "fair", "fine", "alright" being
 *  treated as substantive (and downstream loops were planning around
 *  them as if discovery had advanced). Broadened here so every
 *  consumer that needs "flat-ack vs real answer" reads from the same
 *  literal set. */
export const FLAT_ACK_RE =
  /^\s*(?:ok|okay|cool|sure|got\s+it|right|understood|noted|makes\s+sense|fair(?:\s+enough)?|fine|alright|hmm+|mm+hmm+|yeah|yep|yup|aha|ah)[\s.,!?]*$/i;

export function isFlatAck(answer: string | null | undefined): boolean {
  if (!answer || typeof answer !== "string") return false;
  return FLAT_ACK_RE.test(answer);
}

/* Sprint B.2 (2026-05-15) — number-discipline gate.
 *
 * Recruiter-anchors-first is the #1 reason new recruiters give away money:
 * the candidate dodges "what are you targeting?" and the recruiter
 * volunteers a number. Real recruiters never disclose a specific number
 * until either:
 *   (a) the candidate has anchored (candidateTargetLpa is set), OR
 *   (b) discovery is complete AND the candidate has refused the
 *       expectation probe at least twice (probeRefusalCount ≥ 2).
 *
 * Returns true when it's safe to disclose a specific number. Pure. */
export function canDiscloseSpecificNumber(state: NegotiationState): boolean {
  if (state.candidateTarget != null) return true;
  /* Deflect-loop fix (2026-06-15) — a fixed-component target ("₹26 LPA
   * fixed at minimum") is still the candidate revealing their number, so
   * number-discipline (rationale (a): "the candidate has anchored") is
   * satisfied. Without this, a candidate who only ever states a fixed
   * target keeps canDisclose=false, the planner never anchors, and the
   * range-disclosure phase becomes a band-disclosure-deflect sink (see
   * salary-negotiation-happy-path-trace.json T4-T8). derivePhase already
   * folds candidateTargetFixed into its `target` gate (kernel ~5881), so
   * this keeps the two in sync. */
  if (state.candidateTargetFixed != null) return true;
  const refusals = state.probeRefusalCount ?? 0;
  if (refusals >= 2) {
    /* Discovery-complete check is only meaningful when the checklist is
     * tracked; otherwise treat refusal-count alone as sufficient. */
    const checklist = state.discoveryChecklist;
    if (checklist == null) return true;
    const fam = classifyRoleFamily(state.role);
    return isDiscoveryComplete(checklist, fam);
  }
  return false;
}

/* ── Class-A unit accessors (2026-06-15 architecture audit) ──────────
 * Root cause the audit surfaced: candidateTarget / lastCandidateCounterLpa
 * are unit-polymorphic — a number stamped in whatever the candidate spoke
 * (TOTAL CTC, FIXED component, or IN-HAND/take-home) — yet most consumers
 * compared it against TOTAL band/offer figures. That mix produced the
 * in-hand under-quote (~13-25%) and the fixed-vs-total false-accept.
 *
 * These three accessors are the ONE place that normalizes the units. Every
 * numeric decision must read through them; raw state.candidateTarget /
 * state.lastCandidateCounterLpa are for echoing the candidate's own words in
 * prose only. A future reader that goes through an accessor cannot
 * reintroduce the mix. */

/** The candidate's stated TOTAL target in LPA, converted to a CTC-equivalent
 *  when they framed it as in-hand / take-home. Returns null when no *total*
 *  target is stated (a fixed-only ask is not a total). */
export function statedTotalTargetCtcLpa(state: NegotiationState): number | null {
  if (state.candidateTarget == null) return null;
  /* In-hand / take-home framing: candidateTarget is the take-home number the
   * candidate spoke; the CTC-equivalent (gross-up of in-hand + the band's
   * variable/benefit structure) is stamped alongside it in applyCandidateAnswer.
   * Reading the raw take-home here is exactly the in-hand under-quote (~13-25%)
   * the Class-A accessor exists to eliminate, so prefer the CTC-equivalent. */
  if (state.candidateTargetIsInHand && state.candidateTargetCtcEquivalentLpa != null) {
    return state.candidateTargetCtcEquivalentLpa;
  }
  return state.candidateTarget;
}

/** The candidate's effective TOTAL-CTC target for numeric decisions
 *  (aspiration, headroom, bonus sizing). Folds, in priority order:
 *    1. stated total (in-hand-adjusted) — statedTotalTargetCtcLpa
 *    2. fixed-only ask → implied total = fixed + band variable headroom
 *  Returns the UNCAPPED implied total (callers clamp to ceiling themselves
 *  via Math.min, and over-band detection needs to see the overshoot).
 *  Returns null only when no target of any kind is stated. */
export function effectiveTargetCtcLpa(state: NegotiationState): number | null {
  const stated = statedTotalTargetCtcLpa(state);
  if (stated != null) return stated;
  if (state.candidateTargetFixed != null) {
    return state.candidateTargetFixed + (state.band.variableMax ?? 0);
  }
  return null;
}

/** The candidate's most recent counter IFF it was scoped to the TOTAL
 *  package. Returns null for fixed-component counters ("₹26L fixed"), which
 *  must never be compared against a total offer — that comparison was the
 *  units-mismatch false-accept bug class. Every gate that compares a counter
 *  against highestOfferMade (a total) must read this, not the raw field. */
export function totalScopedCounter(state: NegotiationState): number | null {
  if (state.lastCandidateCounterLpa == null) return null;
  if (state.lastCounterComponent === "fixed") return null;
  /* In-hand / take-home framing: a total-scoped counter stated as a NET
   * number is ~13-25% below the CTC it implies. Comparing the raw field
   * against highestOfferMade (a TOTAL) false-accepted the candidate while
   * they were still below their real ask. Prefer the CTC-equivalent —
   * applyCandidateAnswer stamps it from the same parsed.target and clears
   * it whenever a later non-in-hand counter lands, so it can't go stale.
   * Mirrors statedTotalTargetCtcLpa on the target side. */
  if (state.candidateTargetIsInHand && state.candidateTargetCtcEquivalentLpa != null) {
    return state.candidateTargetCtcEquivalentLpa;
  }
  return state.lastCandidateCounterLpa;
}

/* Sprint A.4 (2026-05-15) — current-employer free-form extractor.
 * Patterns: "currently at X" / "working at X" / "I'm with X" / "I work
 * at X" / "right now at X" / "presently at/with X". Returns the proper-
 * noun phrase (1-3 capitalized tokens) or null. Conservative on stop-
 * words ("a", "the", "my") to avoid false positives. Pure. */
export const CURRENT_EMPLOYER_PATTERNS: RegExp[] = [
  /\b(?:currently|presently|right\s+now)\s+(?:at|with|working\s+(?:at|for))\s+([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,2})/,
  /\bI(?:'?m|\s+am)\s+(?:at|with|working\s+(?:at|for))\s+([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,2})/,
  /\bI\s+work\s+(?:at|for|with)\s+([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,2})/,
  /\bworking\s+(?:at|for|with)\s+([A-Z][A-Za-z0-9&.-]*(?:\s+[A-Z][A-Za-z0-9&.-]*){0,2})/,
];
export function detectCurrentEmployer(answer: string | null | undefined): string | null {
  if (!answer || typeof answer !== "string") return null;
  for (const re of CURRENT_EMPLOYER_PATTERNS) {
    const m = answer.match(re);
    if (m && m[1]) {
      const candidate = m[1].trim();
      // Reject filler-only matches like "A", "The", "My".
      if (candidate.length < 2) continue;
      if (/^(?:The|My|Our|An?|This|That)$/i.test(candidate)) continue;
      return candidate;
    }
  }
  return null;
}

export const DEAD_END_PATTERNS: RegExp[] = [
  /\b(?:i\s+don'?t\s+know|i\s+do\s+not\s+know|not\s+sure|i'?m\s+not\s+sure|no\s+idea|dunno|idk)\b/i,
  /\b(?:can'?t\s+say|cannot\s+say|hard\s+to\s+say|tough\s+to\s+say)\b/i,
];

/** Returns true when the last 3 candidate turns in conversationLog are
 *  all "I don't know" / "I'm not sure" / similar dead-end signals.
 *  Genuine dead-end → terminal close is acceptable. Pure. */
export function detectConsecutiveDeadEnd(state: NegotiationState): boolean {
  const log = state.conversationLog ?? [];
  let candidateCount = 0;
  let deadEnds = 0;
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (!e || e.speaker !== "candidate") continue;
    candidateCount += 1;
    const t = e.text || "";
    if (DEAD_END_PATTERNS.some((p) => p.test(t))) {
      deadEnds += 1;
    } else {
      return false;
    }
    if (candidateCount >= 3) break;
  }
  return candidateCount >= 3 && deadEnds >= 3;
}

/** Single source of truth for "is there a concrete offer the candidate
 *  can actually accept?". An offer is on the table when the recruiter has
 *  quoted a number (highestOfferMade > 0) OR has presented the band as a
 *  reference range (the `band-anchor-with-rationale` topic — the kernel
 *  treats a presented band as an offer-on-table; see the accept path's
 *  band-floor close). Used by the acceptance classifier (line ~4503) and
 *  the premature-close guard so both agree on what "accept" can refer to. */
export function isOfferOnTable(state: NegotiationState): boolean {
  const bandPresented = (state.askedTopics ?? []).some(
    (t) => t.topic === "band-anchor-with-rationale",
  );
  return (state.highestOfferMade ?? 0) > 0 || bandPresented;
}

/** Premature-close guard. Returns true when the kernel is permitted to
 *  transition into a terminal phase given the current state. The
 *  caller passes the candidate answer (for explicit-decline detection)
 *  and a reason describing the path:
 *
 *    - "accept"         — strict explicit acceptance (e.g. "I accept",
 *                          "please send the offer letter"). Always
 *                          passes — explicit accept is one of the four
 *                          permitted close conditions.
 *    - "soft-accept"    — implicit / soft-acceptance proxy (3+
 *                          trailing non-counter candidate turns). Blocked
 *                          before minTurnsBeforeClose so the bot can't
 *                          flip to terminal too early.
 *    - "decline"        — candidate explicitly declined. Always passes.
 *    - "max-turns"      — MAX_TURNS_PER_SESSION reached. Always passes.
 *    - "dead-end"       — 3+ consecutive "I don't know" candidate turns.
 *                          Blocked before minTurnsBeforeClose. */
export function canCloseSession(
  state: NegotiationState,
  answer: string | null | undefined,
  reason: "accept" | "soft-accept" | "decline" | "max-turns" | "dead-end",
): boolean {
  /* Hard-cap always wins. */
  if (reason === "max-turns") return true;
  /* Explicit decline always passes the guard. */
  if (reason === "decline") return true;
  /* #118 (2026-06-21, live staging) — nothing-on-the-table guard.
   *
   * Live (Flipkart EM, desperate candidate): "Honestly whatever you offer
   * is fine, I just need this job." → "Yes I accept whatever the number
   * is." The bot was still in discovery — it had NEVER stated an anchor or
   * a band. The strict-accept fast-path below (`reason === "accept"`)
   * passed unconditionally, the kernel force-closed, and because
   * highestOfferMade was still 0 when attachPostAcceptanceMessage cached
   * the recap, the close shipped "Locking the close at ₹0L total comp".
   *
   * This is the SAME invariant the PDF#48 comment below states — "an
   * accept cannot logically exist BEFORE an offer the candidate has seen"
   * — but it must apply to STRICT accepts too: "I accept whatever the
   * number is" is consent to nothing when no number was ever named. Gate
   * BOTH accept and soft-accept on a concrete offer/band being on the
   * table (isOfferOnTable — the same predicate the acceptance classifier
   * uses). With nothing on the table, decline the close; the planner then
   * falls through to its discovery-sufficient anchor (state the offer
   * first), which is the only correct move. */
  if (
    (reason === "accept" || reason === "soft-accept") &&
    !isOfferOnTable(state)
  ) {
    return false;
  }
  /* PDF#48 (2026-05-26) — structural anti-premature-close invariant.
   *
   * The bug: a candidate answered three data-collection questions
   * (current CTC, base split, "no there is not equity"). The kernel
   * announced ₹30.4 LPA on turn 4 and on the SAME turn fired
   * close-acceptance with a full post-acceptance message ("Locking the
   * close at ₹30.4L... Aadhaar, PAN, BGV, retention-counter warning,
   * joining-date lock") — all in one turn. The candidate never had a
   * chance to counter, ask for breakdown, or even react.
   *
   * The trigger was a soft-accept false-positive: parseAcceptance read
   * a candidate utterance (likely "no there is not equity" parsed via
   * the medium-confidence path, or an empty Continue press) as
   * acceptance, the planner stamped verbalAcceptanceTurn = turnIndex
   * via the PDF#36 A2 fast-path, and `_next-action-planner.ts:1765`
   * fired close-acceptance the same turn the offer was first spoken.
   *
   * The root invariant being violated: an "accept" cannot logically
   * exist BEFORE an offer the candidate has seen and processed. The
   * minimum-viable structural guarantee is one full candidate turn
   * AFTER the first offer was announced. Without that, acceptance is
   * by definition a parse artifact — there is nothing yet to accept.
   *
   * Gate BOTH strict-accept and soft-accept (this code-path; the
   * caller at line 4188 / 4261 routes both through here) on:
   *
   *   firstOfferAtTurn != null
   *     AND turnIndex > firstOfferAtTurn          (≥1 candidate turn elapsed)
   *
   * If the candidate has named a counter, that's prima facie proof
   * they processed the offer and the gate releases immediately —
   * counter-then-accept is a normal negotiation path. Strict-accept
   * also gets a same-turn release ONLY if the LANGUAGE is explicit
   * (the candidate literally said "I accept" / "send the offer
   * letter") rather than soft-accept proxies.
   *
   * No real session loses anything from this guard: a candidate who
   * wants to accept can do so on the very next turn. A candidate who
   * doesn't want to accept stops being silently force-closed. */
  /* Soft-accept ONLY: when we can prove the offer landed THIS turn
   * (firstOfferAtTurn === turnIndex) AND the candidate hasn't named a
   * counter, block the close. This catches the PDF#48 trigger where
   * a candidate utterance answering an unrelated probe ("no there is
   * not equity" answering the ESOPs question) gets parsed by the
   * soft-accept proxy as acceptance on the same turn the offer was
   * first announced. Strict explicit acceptance ("I accept", "please
   * send the offer letter") is unambiguous human consent and is NOT
   * gated — a candidate who literally says "I accept" to a same-turn
   * offer should be allowed to close. */
  if (reason === "soft-accept") {
    if (state.firstOfferAtTurn != null && state.firstOfferAtTurn >= state.turnIndex) {
      const candidateCountered =
        state.lastCandidateCounterLpa != null || state.candidateTarget != null;
      if (!candidateCountered) return false;
    }
  }
  /* Strict explicit accept past the structural gate is one of the four
   * canonical valid-close conditions — always passes. */
  if (reason === "accept") return true;
  const min = state.minTurnsBeforeClose ?? 8;
  /* Hard system cap (60) always passes regardless of min. */
  if (state.turnIndex >= 60) return true;
  /* Before the min-turns floor, block soft-accept and dead-ends unless
   * the candidate has explicitly declined this turn. */
  if (state.turnIndex < min) {
    if (detectExplicitDecline(answer)) return true;
    return false;
  }
  return true;
}
