/* HireStepX — Salary Negotiation Canonical State Kernel
 * ─────────────────────────────────────────────────────────────────────
 * The static 7-anchor script + regex transcript re-parsing + LLM echo
 * guards + post-hoc clamp layers — the legacy architecture — have
 * produced the same bug class over and over: state drift between the
 * three subsystems (script slot index, regex-extracted "current facts",
 * LLM-generated text). Every patch is a regex addition or guard
 * tightening that closes one crack and opens another.
 *
 * This module is the replacement: a single, authoritative
 * NegotiationState that the engine owns and mutates ONLY through
 * pure transition functions defined here. The LLM is downstream — it
 * receives state, returns text, and never sets state. Facts are folded
 * into state ONCE per turn (when the candidate's answer arrives), not
 * re-parsed every render.
 *
 * Design rules:
 *   1. State is the source of truth. The transcript is a render artefact.
 *   2. Transitions are pure functions. No LLM, no IO, no clock — all
 *      injected if needed. Same input → same output, always.
 *   3. Terminal phases are sticky. accepted / walked-away / stalemate
 *      never transition back.
 *   4. Numbers come from `band` and `state.highestOfferMade`. The LLM
 *      cannot invent a counter — its text is post-validated against
 *      the AiMove returned by pickAiMove(state).
 *   5. Backwards compatibility: this module is unused at runtime until
 *      a route handler (Ship 2) and the engine flag (Ship 3) are wired.
 *      Ship 1 establishes the data model only — tests cover transitions
 *      end-to-end without touching production code paths.
 *
 * Naming note: the existing `_negotiation-state.ts` covers a narrower
 * concern (per-turn intent classification — accepted/rejected/walking/
 * deflected). This kernel is the canonical session-long state object;
 * the intent classifier feeds into it. Keeping them separate so the
 * intent regexes stay reviewable in isolation.
 */

import type { NegotiationFacts } from "../src/interviewEvaluation";
import { classifyAcceptance } from "./_acceptance-classifier";
import {
  extractComponentBreakdown,
  mergeBreakdown,
  type ComponentBreakdown,
} from "./_component-breakdown";
import {
  extractHikeRationale,
  computeHikePercent,
  type RationaleResult,
} from "./_hike-rationale";
import {
  extractNoticeJoining,
  mergeNoticeJoining,
  type NoticeJoiningResult,
} from "./_notice-joining";
import {
  extractEquityVesting,
  mergeEquityVesting,
  type EquityVestingResult,
} from "./_equity-vesting";
import {
  extractLocationMode,
  mergeLocationMode,
  type LocationModeResult,
} from "./_location-mode";
import {
  extractCompetingOfferDetail,
  mergeCompetingOfferDetail,
  type CompetingOfferDetail,
} from "./_competing-offer-detail";
import {
  extractDecisionDeadline,
  mergeDecisionDeadline,
  type DecisionDeadlineResult,
} from "./_decision-deadline";
import {
  extractCandidateProfile,
  mergeCandidateProfile,
  type CandidateProfileResult,
} from "./_candidate-profile";
import {
  extractMiscSignals,
  mergeMiscSignals,
  type MiscSignalsResult,
} from "./_misc-signals";
import {
  extractCandidateStance,
  mergeCandidateStance,
  detectRecoverySignals,
  type CandidateStanceResult,
} from "./_candidate-stance";
import {
  extractSalesOTE,
  extractContractRate,
  mergeSalesOTE,
  mergeContractRate,
  EMPTY_SALES_OTE,
  EMPTY_CONTRACT_RATE,
  type SalesOTEResult,
  type ContractRateResult,
} from "./_comp-structure";
import {
  extractRetentionCounter,
  mergeRetentionCounter,
  EMPTY_RETENTION_COUNTER,
  type RetentionCounterResult,
} from "./_retention-counter";

/* ─── Phases ──────────────────────────────────────────────────────── */

export type NegotiationPhase =
  /* Pre-offer — AI hasn't put a number on the table yet. */
  | "opening"
  /* AI has presented the initial offer; candidate is reacting. */
  | "offer-presented"
  /* AI is probing candidate's target / reasoning. */
  | "probe-expectations"
  /* Candidate has anchored; AI is countering with cash levers. */
  | "counter-offer"
  /* Multiple rounds of counter exhausted base; exploring non-cash. */
  | "lever-explore"
  /* AI is pushing for close ("I need to know today"). */
  | "closing-push"
  /* Terminal — candidate accepted the offer. */
  | "accepted"
  /* Terminal — candidate walked away / rejected. */
  | "walked-away"
  /* Terminal — turn budget exhausted without resolution. */
  | "stalemate";

const TERMINAL_PHASES = new Set<NegotiationPhase>([
  "accepted",
  "walked-away",
  "stalemate",
]);
export const isTerminalPhase = (p: NegotiationPhase): boolean => TERMINAL_PHASES.has(p);

/* ─── Levers ─────────────────────────────────────────────────────── */

export type NegotiationLever =
  | "open-with-offer"   // initial offer presentation
  | "probe"             // ask what they want
  | "counter-base"      // bump base
  | "joining-bonus"     // one-time
  | "equity-grant"      // RSU/ESOP top-up
  | "notice-buyout"     // buy out notice period
  | "benefits-summary"  // recap non-cash
  | "hold-firm"         // explicit "this is final"
  | "close-acceptance"  // wrap with agreed terms
  | "close-walkaway"    // wrap acknowledging no-deal
  | "close-stalemate";  // wrap acknowledging out of turns

/* ─── Band — server-derived once at session start ────────────────── */

export interface NegotiationBand {
  /** AI's opening number (LPA). */
  initialOffer: number;
  /** Maximum the AI can stretch to with explicit approval (LPA). */
  maxStretch: number;
  /** Below this, AI walks (LPA). */
  walkAway: number;
  /** Whether equity/RSU is on the table for this role/company tier. */
  hasEquity: boolean;
  /** Phase 12 (2026-05-13): optional base/variable component bounds.
   *  When set, the move-picker + validator enforce that any counter
   *  respects the candidate's stated base floor (via
   *  `candidateComponentBreakdown.base`) AND the recruiter's
   *  structural caps. Optional so legacy bands without this info
   *  fall through to the prior total-CTC-only behaviour. */
  baseFloor?: number;
  baseStretch?: number;
  variableMax?: number;
}

/* ─── Canonical State ────────────────────────────────────────────── */

/* Information items a candidate can interrogate the recruiter about.
   Tracked as a set on state so we don't double-credit repeated asks
   and so the move-picker can reward depth of due diligence. */
export type InfoIntent =
  | "clawback-period"      // joining-bonus clawback duration / pro-rata
  | "variable-history"     // last 2-3yr variable payout %
  | "vest-schedule"        // RSU/ESOP grant + cliff + slope
  | "strike-price"         // ESOP exercise price / last 409A / FMV
  | "in-hand-monthly"      // CTC → net take-home breakdown
  | "exercise-window"      // post-termination ESOP exercise window
  | "acceleration"         // accelerated vesting on acquisition / RIF
  | "fixed-vs-variable"    // CTC split breakdown
  | "perks-non-cash"       // Sodexo / gratuity / NPS lumping
  | "package-breakdown";   // generic "walk me through the package" / "break it down" — added 2026-05 after the Lollypop session where the candidate asked for the structure and the AI responded with a probe ("what range are you targeting?") instead of providing the breakdown. The existing intents were all component-specific; this catches the higher-level "explain the offer" ask.

/* Negotiation tactics from the Voss / interviewing.io canon that the
   parser detects and the move-picker rewards. Tracked so a candidate
   who's clearly negotiating well faces less recruiter stiffening. */
export type VossTactic =
  | "mirror"               // repeats AI's last 1-3 words as a question
  | "label"                // "it sounds like..." framing
  | "calibrated"           // "how can I..." / "what's the best you can..."
  | "sign-today-bundle"    // "if you can do X+Y+Z I'll sign today"
  | "deflect-current-ctc"; // refuses to disclose current CTC

/* Macro market mode — adjusts global concession curves. Soft markets
   (post-layoff 2023-style) reduce concession willingness; hot markets
   (AI/ML 2025-style) increase it. Default neutral. */
export type MarketMode = "soft" | "neutral" | "hot";

/* Phase 21 — Recruiter persona. The same kernel state can be played
 * by four distinct recruiter archetypes; each modulates tactical
 * preferences (concession curve, what they probe for, what they
 * surface unprompted, tone). The kernel uses persona ONLY at the
 * response-hints layer so band math stays persona-agnostic — the
 * candidate's *experience* changes, not the underlying economics.
 *
 *   hardline      — aggressive in-house TA. Anchors at walkAway,
 *                   resists concessions, treats every probe as a
 *                   bargaining tell. Closing-pressure heavy.
 *   consultative  — friendly hiring manager. Transparent about the
 *                   band, willing to swap levers (JB ↔ equity ↔
 *                   review cycle), explains the why.
 *   founder       — early-stage founder/CEO. Mission-heavy, equity-
 *                   heavy, time-pressured ("we need to move fast"),
 *                   conservative on cash but generous on title/scope.
 *   agency        — external agency recruiter on commission. Surface-
 *                   level, deal-making, optimises for closure speed,
 *                   pushes acceptance harder than is warranted by
 *                   the actual band.
 *
 * Default: "consultative" — the existing kernel behaviour mapped
 * cleanly to a transparent hiring-manager persona, so callers that
 * don't specify persona see no change. */
export type RecruiterPersona = "hardline" | "consultative" | "founder" | "agency";

/* Phase 24b (2026-05-13) — persona-conditional band economics.
 * Earlier persona work modulated STYLE (hints, probes). This pure
 * helper modulates the BAND itself so persona affects what's actually
 * negotiable:
 *   - hardline:    +1L walkAway (less willing to chase low), -1L maxStretch
 *                  (less willing to flex high). Tighter band overall.
 *   - founder:     hasEquity forced true (equity is the trade lever),
 *                  +0.5L maxStretch (founder authority to flex on TC).
 *   - agency:      +0.5L maxStretch (commission-motivated to close).
 *   - consultative: no change (baseline).
 *
 * Invariants preserved:
 *   - walkAway < initialOffer < maxStretch (clamped if persona deltas
 *     would invert).
 *   - If a caller pre-applied tighter bounds, we never widen past
 *     {initialOffer ± 0.01} into invalid territory. */
export function applyPersonaToBand(
  base: NegotiationBand,
  persona: RecruiterPersona,
): NegotiationBand {
  const out: NegotiationBand = { ...base };
  switch (persona) {
    case "hardline":
      out.walkAway = base.walkAway + 1;
      out.maxStretch = base.maxStretch - 1;
      break;
    case "founder":
      out.hasEquity = true;
      out.maxStretch = base.maxStretch + 0.5;
      break;
    case "agency":
      out.maxStretch = base.maxStretch + 0.5;
      break;
    case "consultative":
      /* no change */
      break;
  }
  /* Clamp to preserve invariants: walkAway strictly below initialOffer,
   * maxStretch strictly above initialOffer. */
  if (out.walkAway >= base.initialOffer) out.walkAway = base.initialOffer - 0.5;
  if (out.maxStretch <= base.initialOffer) out.maxStretch = base.initialOffer + 0.5;
  return out;
}

export interface NegotiationState {
  /* Identity */
  readonly sessionId: string;
  readonly role: string;
  readonly company: string;

  /* Band — frozen at session start. Server is authoritative; the
     engine cannot mutate this after init. */
  readonly band: NegotiationBand;

  /* Phase + turn budget */
  phase: NegotiationPhase;
  turnIndex: number;    // number of AI turns produced; incremented in applyAiMove
  maxTurns: number;     // hard cap before stalemate (default 8)

  /* Candidate-stated facts. Folded in via applyCandidateAnswer or
     foldFactsIntoState — set ONCE per turn, never re-derived from
     transcript. Null = not stated. */
  candidateTarget: number | null;        // their ask (LPA, last-stated-wins)
  /** Phase 25a (2026-05-13) — the FIRST number the candidate ever
   *  anchored. Frozen on first non-null assignment; never updated
   *  after. Lets the red-flag layer detect upward drift ("Earlier
   *  you mentioned ₹18L; now you're at ₹24L"). */
  firstAnchoredTarget: number | null;
  candidateCurrentCtc: number | null;    // current package (NOT target)
  competingOffer: number | null;         // BATNA in hand (NOT target)

  /* Component-level breakdown the candidate has stated about their
   * ask or current — base / variable / equity in LPA. Phase 10A
   * (2026-05-13). Carries cross-turn (last-stated-wins via
   * mergeBreakdown). The LLM prompt surfaces these so the AI doesn't
   * propose a counter that satisfies the candidate's total while
   * violating their base-floor constraint. Detection-only at the
   * kernel level: enforcement in the move-picker is deferred until
   * the band schema also carries components. */
  candidateComponentBreakdown: ComponentBreakdown;

  /* Range ask: candidate stated "30-35 LPA" instead of a single number.
     Research (Idaho / Harvard PON) shows range asks earn meaningfully
     more than single-point asks. We reward this in the counter-offer
     split. */
  candidateAskedAsRange: boolean;

  /* AI moves made */
  highestOfferMade: number;              // best number AI has put on table (LPA)
  leversUsed: NegotiationLever[];        // ordered history
  lastAiText: string;                    // for verbatim-repeat detection

  /** Phase 28 (2026-05-13) — last kernel-computed joining-bonus amount
   *  the AI has put on the table this session (LPA, one-time). Null
   *  until a joining-bonus move fires. Carries across turns so
   *  close-acceptance can include it in the recap — without this the
   *  JB silently disappeared from the close summary (May 2026 session).
   *  Sticky (never reset to null after being set). */
  lastJoiningBonusOffered: number | null;

  /* Rolling conversation log — capped at the last CONVERSATION_LOG_CAP
   * entries (= 4, i.e. last 2 exchanges). Phase 5 of the rebuild: the
   * compact brief carried derived facts only (target, current, highest
   * offer, etc.); the per-turn user prompt had `lastAiText` and the
   * candidate's CURRENT answer but no thread before that. The Lollypop
   * session (May 2026) showed the bot dropping context across turns
   * (re-asking what the candidate had said two turns earlier). Carrying
   * the last 2 exchanges into the prompt lets the LLM thread responses
   * without re-deriving state from the full transcript.
   *
   * Capped on purpose. A growing log inflates the per-turn prompt and
   * trips Groq's prefix cache (dynamic content drifts farther through
   * the prompt with each turn). 4 entries = ~600 tokens of dialogue,
   * which is enough thread for natural references and small enough that
   * the cache prefix still hits. */
  conversationLog: Array<{ speaker: "ai" | "candidate"; text: string }>;

  /* Recruiter-side tactic counters. `finalOfferAssertedCount` tracks
     how many times the AI (or upstream LLM) has claimed "best and
     final" — used by the move-picker to decay credibility after the
     AI then moves anyway. */
  finalOfferAssertedCount: number;

  /* Candidate-side tactic & intent counters. */
  vossTacticsUsed: VossTactic[];
  infoAsked: InfoIntent[];

  /* Verbal-acceptance lock: the candidate said "yes" but then tried to
     re-open the conversation. Distinct from terminal `accepted` — when
     this fires, the move-picker stiffens dramatically and a small
     rescission risk applies on the next turn. */
  verbalAcceptanceTurn: number | null;

  /* Phase 25d (2026-05-13) — rescission escalation. Counts candidate
   * turns AFTER verbalAcceptanceTurn on which the candidate is still
   * asking for more (target/info/tactic firing without acceptance).
   * 2+ = the offer is being rescinded; move-picker routes directly to
   * close-walkaway and the red-flag layer surfaces "rescission-risk"
   * as a blocker. */
  postVerbalRenegotiationCount: number;

  /* Phase 21b (2026-05-13) — recovery actualization. True on the AI
   * turn that immediately follows a candidate utterance carrying a
   * recovery signal (desperate / salary-only / avoids-anchor /
   * personal-expense / offer-shopping recovered). Read by
   * pickAiMove to un-stiffen the counter split for one turn. Reset
   * to false in applyAiMove so it never bleeds into the next AI
   * turn. */
  recentRecoveryActive: boolean;

  /* Walk-away-and-return: candidate hit `walked-away` and then re-
     engaged. Comes with a penalty (loss of joining bonus, lower base
     ceiling on return). */
  walkAwayReturned: boolean;

  /* Hard-vs-soft band cap. When true, `maxStretch` is genuinely
     unreachable on base — the AI redirects to JB/equity/level instead
     of conceding on base. Modeled after services-co fitment caps. */
  hardBandCap: boolean;

  /* Macro market mode — adjusts concession curve globally. */
  marketMode: MarketMode;

  /* Phase 21 — Recruiter persona archetype. Influences response-hint
   * tone and tactical preferences but NOT band math. Frozen at session
   * start. Default "consultative" preserves legacy behaviour. */
  recruiterPersona: RecruiterPersona;

  /* Terminal signals (turn index where the transition fired) */
  acceptedAtTurn: number | null;
  walkedAwayAtTurn: number | null;

  /* Phase 11 (2026-05-13) — hike % + candidate-stated rationale.
   * Computed sticky: hikePercent regenerates each turn from
   * (target, currentCtc); rationale is last-stated-wins. */
  hikePercent: number | null;
  rationale: RationaleResult | null;

  /* Phase 13 (2026-05-13) — notice period + joining bonus + buyout
   * signals. Sticky: notice days and joining-bonus ask persist
   * across turns; buyoutRequested / earlyJoinPreferred booleans are
   * monotone-up. */
  noticeJoining: NoticeJoiningResult;

  /* Phase 14 (2026-05-13) — equity vesting preferences + literacy.
   * Captures vesting years, cliff months, cash/equity preference,
   * and candidate's prior equity experience. */
  equityVesting: EquityVestingResult;

  /* Phase 15 (2026-05-13) — work mode (remote/hybrid/office) +
   * candidate location + relocation signals. */
  locationMode: LocationModeResult;

  /* Phase 16 (2026-05-13) — structured competing-offer detail.
   * Complements the existing `competingOffer: number` magnitude with
   * company + status + stage + letter-share signals. */
  competingOfferDetail: CompetingOfferDetail;

  /* Phase 17A (2026-05-13) — decision deadline + conditional accept.
   * deadlineDays sets the AI's closing-pressure pacing; conditional
   * acceptance downgrades the legacy signalsAcceptance to a "trade
   * proposal" the move-picker should counter on. */
  decisionDeadline: DecisionDeadlineResult;

  /* Phase 17B (2026-05-13) — candidate background. Career gap, tenure
   * cadence, and over/under-qualified self-statement. Materially
   * affects the AI's framing of joining bonus, level fit, and
   * retention. */
  candidateProfile: CandidateProfileResult;

  /* Phase 17F (2026-05-13) — scalar candidate signals: floor, salary-
   * review cycle, proof-of-CTC shareability, internal-counter risk. */
  miscSignals: MiscSignalsResult;

  /* Phase 18 (2026-05-13) — candidate stance / posture (rigidity,
   * market-reference, salary-only-factor, badmouth, confidential
   * overshare, desperation, equity-as-cash). Drives the follow-up
   * router and red-flag detector — both pure derived views recomputed
   * each turn. */
  candidateStance: CandidateStanceResult;

  /* Phase 24c (2026-05-13) — promoted sales / contract comp-structure
   * detectors. Previously utterance-grade only (Phase 22). Now sticky
   * across turns: numeric facts (OTE, base, attainment, day rate,
   * utilization) are last-stated-wins; red-flag booleans are
   * monotone-up. Lets the recruiter side reason across turns ("you
   * quoted ₹40L OTE 3 turns ago; what was the base?"). */
  salesOTE: SalesOTEResult;
  contractRate: ContractRateResult;

  /* Phase 27 — retention-counter from current employer. Materially
   * affects the new-employer's leverage: they now have to beat TWO
   * numbers, and the candidate's "exit story" gets noisier. */
  retentionCounter: RetentionCounterResult;

  /* Phase 29 (2026-05-14) — Role-applicable YOE. Distinguishes the
   * candidate's TOTAL career YOE from the YOE that maps to the TARGET
   * role's domain. A Senior Product Designer with 6 years applying for
   * a Java Developer role has totalYoe=6 but applicableYoe≈0; the
   * kernel must use applicableYoe (not totalYoe) when sizing the band,
   * the hike%, and the recruiter framing for a domain pivot. All three
   * are session-immutable once initialised (computed from resumeProfile
   * + targetRole at init); null = unknown signal. */
  candidateTotalYoe: number | null;
  candidateApplicableYoe: number | null;
  candidatePrimaryDomain: string | null;
}

/* ─── Factory ────────────────────────────────────────────────────── */

export interface InitStateInput {
  sessionId: string;
  role: string;
  company: string;
  band: NegotiationBand;
  maxTurns?: number;
}

export interface InitStateExtras {
  hardBandCap?: boolean;
  marketMode?: MarketMode;
  recruiterPersona?: RecruiterPersona;
  /* Phase 29 — role-applicable YOE plumbed from the client (resume
   * profile + target role). All three optional; defaults to null. */
  candidateTotalYoe?: number | null;
  candidateApplicableYoe?: number | null;
  candidatePrimaryDomain?: string | null;
}

export function initState(input: InitStateInput & InitStateExtras): NegotiationState {
  return {
    sessionId: input.sessionId,
    role: input.role,
    company: input.company,
    band: applyPersonaToBand({ ...input.band }, input.recruiterPersona ?? "consultative"),
    phase: "opening",
    turnIndex: 0,
    maxTurns: input.maxTurns ?? 8,
    candidateTarget: null,
    firstAnchoredTarget: null,
    candidateCurrentCtc: null,
    competingOffer: null,
    candidateComponentBreakdown: { base: null, variable: null, equity: null, hasAny: false },
    candidateAskedAsRange: false,
    highestOfferMade: 0,
    leversUsed: [],
    lastAiText: "",
    lastJoiningBonusOffered: null,
    conversationLog: [],
    finalOfferAssertedCount: 0,
    vossTacticsUsed: [],
    infoAsked: [],
    verbalAcceptanceTurn: null,
    postVerbalRenegotiationCount: 0,
    recentRecoveryActive: false,
    walkAwayReturned: false,
    hardBandCap: input.hardBandCap ?? false,
    marketMode: input.marketMode ?? "neutral",
    recruiterPersona: input.recruiterPersona ?? "consultative",
    acceptedAtTurn: null,
    walkedAwayAtTurn: null,
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
      letterShareOffered: false,
      onHold: false,
      hasAny: false,
    },
    decisionDeadline: {
      deadlineDays: null,
      deadlineExplicit: false,
      conditionalAcceptance: false,
      conditionalEvidence: null,
      hasAny: false,
    },
    candidateProfile: {
      careerGapMonths: null,
      careerGapActivity: null,
      tenureSignal: null,
      levelMismatch: null,
      domainPivot: false,
      transferableSkillsClaimed: false,
      compensationHistoryIssue: null,
      serviceBondAccepted: false,
      probationCompMentioned: false,
      hasAny: false,
    },
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
      hasAny: false,
    },
    salesOTE: { ...EMPTY_SALES_OTE },
    contractRate: { ...EMPTY_CONTRACT_RATE },
    retentionCounter: { ...EMPTY_RETENTION_COUNTER },
    candidateTotalYoe: input.candidateTotalYoe ?? null,
    candidateApplicableYoe: input.candidateApplicableYoe ?? null,
    candidatePrimaryDomain: input.candidatePrimaryDomain ?? null,
  };
}

/* ─── Candidate answer → parsed signals ──────────────────────────── */

export interface ParsedAnswer {
  target: number | null;
  currentCtc: number | null;
  competing: number | null;
  signalsAcceptance: boolean;
  signalsWalkAway: boolean;
  /* Candidate stated their target as a range ("30-35 LPA") rather than
     a single number. Set on the turn it's detected; sticky on state. */
  targetAsRange: boolean;
  /* Voss / interviewing.io tactics detected this turn. Multiple may
     fire on the same answer. */
  vossTactics: VossTactic[];
  /* Information items the candidate explicitly asked about this turn. */
  infoAsked: InfoIntent[];
  /* Candidate has explicitly hedged on a competing offer ("I have other
     offers but can't share details"). Signals leverage without
     disclosing a number — kernel should respect but not anchor. */
  signalsCompetingExistsWithoutNumber: boolean;
  /* Component breakdown the candidate stated this turn — base /
     variable / equity. Phase 10A (2026-05-13). When `hasAny` is true,
     the LLM prompt surfaces these so it can respect base-floor /
     variable-cap constraints in subsequent offers. Phase 12 added
     enforcement in the move-picker (response hints + base-floor
     validator). */
  componentBreakdown: ComponentBreakdown;
  /* Phase 11 (2026-05-13) — rationale + hike justification cues. */
  rationale: RationaleResult | null;
  /* Phase 13 — notice / joining bonus / buyout signals. */
  noticeJoining: NoticeJoiningResult;
  /* Phase 14 — equity vesting preferences + literacy. */
  equityVesting: EquityVestingResult;
  /* Phase 15 — work-mode + location + relocation signals. */
  locationMode: LocationModeResult;
  /* Phase 16 — competing-offer paperwork / company / stage detail. */
  competingOfferDetail: CompetingOfferDetail;
  /* Phase 17A — deadline + conditional accept. */
  decisionDeadline: DecisionDeadlineResult;
  /* Phase 17B — candidate background (gap / tenure / level mismatch). */
  candidateProfile: CandidateProfileResult;
  /* Phase 17F — floor / review / proof / internal-counter scalars. */
  miscSignals: MiscSignalsResult;
  /* Phase 18 — candidate stance / posture scalars. */
  candidateStance: CandidateStanceResult;
  /* Phase 27 — retention-counter from current employer. */
  retentionCounter: RetentionCounterResult;
}

/* Parse the candidate's free-text answer for salary-relevant numbers
   and intent signals. Distinguishes "my current package is X" (currentCtc)
   from "I'm looking for Y" (target). Strict ordering: current/competing
   patterns claim their numbers first; target patterns only bind a
   number that wasn't already bound elsewhere. This is what the legacy
   extractor did across the whole transcript every render; here we run
   it once per candidate turn against the single fresh answer. */
/* Hinglish word-numbers commonly heard in spoken negotiation calls
   (and frequently mis-transcribed by STT into the wrong digit). We
   pre-substitute the spelled form into a digit so the rest of the
   parser sees a normal "30 LPA". Only the salary-relevant range
   (10–100 lakhs) is mapped — outside that, candidates use English
   digits anyway. Common surface forms: "tees LPA" (30), "paintees
   LPA" (35), "chalis lakh chahiye" (40), "pachas LPA" (50). */
const HINGLISH_NUMBERS: Record<string, string> = {
  das: "10", gyarah: "11", barah: "12", terah: "13", chaudah: "14",
  pandrah: "15", solah: "16", satrah: "17", atharah: "18", unnees: "19",
  bees: "20", ikees: "21", baees: "22", tees: "30", paintees: "35",
  chalees: "40", chalis: "40", paintaalis: "45", pachas: "50",
  pachaas: "50", pachpan: "55", saath: "60", pasath: "65", sattar: "70",
  pichattar: "75", assi: "80", pacchasi: "85", nabbe: "90", pachanve: "95",
  sau: "100",
};

function substituteHinglishNumbers(s: string): string {
  return s.replace(/\b(das|gyarah|barah|terah|chaudah|pandrah|solah|satrah|atharah|unnees|bees|ikees|baees|tees|paintees|chalees|chalis|paintaalis|pachas|pachaas|pachpan|saath|pasath|sattar|pichattar|assi|pacchasi|nabbe|pachanve|sau)\b/gi,
    (m) => HINGLISH_NUMBERS[m.toLowerCase()] ?? m);
}

/* Voss-tactic detection. These patterns are conservative — only
   reasonably unambiguous formulations are recognized. False positives
   here would silently boost concessions for candidates who didn't
   actually negotiate well. */
function detectVossTactics(a: string, lastAiText: string): VossTactic[] {
  const out: VossTactic[] = [];

  /* Mirror: candidate ends with a 1-3 word echo of the AI's last
     content phrase, phrased as a question. We approximate by checking
     for trailing "?" + last-AI 1-3 word echo. */
  if (lastAiText && /\?\s*$/.test(a)) {
    const aiWords = fingerprintWords(lastAiText);
    const candWords = fingerprintWords(a);
    if (aiWords.length >= 2 && candWords.length >= 1) {
      const tail = candWords.slice(-3);
      if (tail.length > 0 && aiWords.slice(-6).join(" ").includes(tail.join(" "))) {
        out.push("mirror");
      }
    }
  }

  /* Label: "it sounds like X" / "it seems like X" / "you must be X".
     The classic Voss formulations that name the other party's
     constraint or emotion. */
  if (/\b(it\s+(?:sounds|seems|looks|feels)\s+like|you\s+must\s+(?:be|feel|need)|it\s+appears\s+that)\b/i.test(a)) {
    out.push("label");
  }

  /* Calibrated how/what question. We require "how"/"what" + a modal +
     question mark to avoid grabbing every "how are you" pleasantry. */
  if (/\b(how\s+(?:am\s+i|can\s+(?:we|i)|do\s+(?:you|we)|would\s+you|could\s+(?:we|you))|what.?s\s+(?:the\s+(?:best|most|maximum)|your\s+thinking|driving|behind))\b[^?]*\?/i.test(a)) {
    out.push("calibrated");
  }

  /* "Sign today if X+Y+Z" bundle from interviewing.io playbook.
     Matches both orderings: "sign today if X" and "if X I'll sign
     today". */
  const signToday = /\b(sign\s+today|accept\s+today|close\s+(?:this\s+)?today|done\s+today|sign\s+(?:right\s+)?now|sign\s+tonight)\b/i;
  const conditional = /\b(if|when|provided|as\s+long\s+as)\b/i;
  if (signToday.test(a) && conditional.test(a)) {
    out.push("sign-today-bundle");
  }

  /* Current-CTC deflection. Candidate explicitly refuses to disclose
     current package. */
  if (/\b(?:prefer\s+not\s+to\s+(?:share|disclose)|company\s+policy.*(?:share|disclose|reveal)|(?:current\s+)?ctc\s+is\s+(?:irrelevant|confidential)|focus\s+on\s+(?:expected|market)|don.?t\s+(?:share|disclose)\s+(?:my\s+)?(?:current\s+)?ctc|rather\s+(?:not\s+)?(?:share|discuss)\s+(?:my\s+)?current)\b/i.test(a)) {
    out.push("deflect-current-ctc");
  }

  return out;
}

/* Info-intent detection. The candidate explicitly asks about an offer
   component. Each phrase is conservative — we'd rather miss an ask than
   credit one that wasn't there. */
function detectInfoIntents(a: string): InfoIntent[] {
  const out: InfoIntent[] = [];
  if (/\b(clawback|claw\s+back|return\s+(?:the\s+)?bonus|repay(?:ment)?|pro[-\s]?rata|tenure\s+requirement)\b/i.test(a)) out.push("clawback-period");
  if (/\b(variable\s+(?:pay|component|payout|history)|bonus\s+payout\s+(?:history|last|past)|payout\s+(?:percentage|%|history)|how\s+much\s+variable)\b/i.test(a)) out.push("variable-history");
  if (/\b(vest(?:ing)?\s+(?:schedule|period|cliff|slope)|cliff|grant\s+schedule|back[-\s]?loaded|monthly\s+vest|quarterly\s+vest)\b/i.test(a)) out.push("vest-schedule");
  if (/\b(strike\s+price|exercise\s+price|409a|fmv|fair\s+market\s+value|grant\s+price)\b/i.test(a)) out.push("strike-price");
  if (/\b(in[-\s]?hand|take[-\s]?home|net\s+(?:salary|monthly|pay)|monthly\s+(?:salary|pay|in\s+hand))\b/i.test(a)) out.push("in-hand-monthly");
  if (/\b(exercise\s+window|post[-\s]?termination|after\s+(?:leaving|resignation)|exercise\s+period)\b/i.test(a)) out.push("exercise-window");
  if (/\b(accelerat(?:ed|ion)\s+vest|change\s+of\s+control|acquisition\s+(?:trigger|clause|vesting)|single[-\s]?trigger|double[-\s]?trigger)\b/i.test(a)) out.push("acceleration");
  if (/\b(fixed\s+(?:vs|versus|and)\s+variable|split\s+(?:between|of)\s+fixed|how\s+much\s+(?:is\s+)?fixed|fixed\s+component|ctc\s+(?:breakdown|split))\b/i.test(a)) out.push("fixed-vs-variable");
  if (/\b(sodexo|food\s+coupon|gratuity|nps|insurance\s+(?:value|cost)|non[-\s]?cash|benefits\s+(?:value|in\s+ctc))\b/i.test(a)) out.push("perks-non-cash");
  /* Generic "walk me through / break it down / what's the structure" —
     the candidate is explicitly asking the recruiter to enumerate the
     package, NOT to probe their expectations. The Lollypop session
     (May 2026) showed the AI responding to "could you break down the
     offer for me?" with "what range are you targeting?" — a phase
     mismatch the move-picker now overrides via this intent. */
  if (/\b(walk\s+me\s+through|break\s+(?:it|that|the\s+offer|the\s+package)\s+down|breakdown\s+of\s+(?:the\s+)?(?:offer|package|ctc)|structure\s+of\s+(?:the\s+)?(?:offer|package|ctc)|what(?:'s|\s+is)\s+(?:in\s+)?(?:the\s+)?(?:package|offer)|tell\s+me\s+more\s+about\s+(?:the\s+)?(?:package|offer|ctc))\b/i.test(a)) out.push("package-breakdown");
  return out;
}

/* Phase param is optional and only used to widen target-binding when
 * the recruiter just asked for expectations. The Tech-Mahindra UX
 * session (May 2026) had the candidate reply "30 lpa thirty lakhs
 * per ctc" — bare number, no "looking for / want / expecting"
 * trigger — and the kernel left target = null, so the AI kept
 * probing instead of countering. When `phase === "probe-expectations"`
 * a bare "<n> LPA / lakhs" is accepted as the target (still gated
 * by the current/competing disambiguator). */
export function parseCandidateAnswer(
  answer: string,
  lastAiText = "",
  phase?: NegotiationPhase,
  /** Whether an offer has been quoted by the bot. When known and
   *  false, the acceptance classifier vetoes commitment idioms
   *  ("sounds good") that lack an offer reference — you can't
   *  accept what hasn't been offered. Default undefined preserves
   *  back-compat for callers that don't have state context. */
  offerOnTable?: boolean,
): ParsedAnswer {
  const a = substituteHinglishNumbers((answer || "").trim());
  if (!a) {
    return {
      target: null, currentCtc: null, competing: null,
      signalsAcceptance: false, signalsWalkAway: false,
      targetAsRange: false, vossTactics: [], infoAsked: [],
      signalsCompetingExistsWithoutNumber: false,
      componentBreakdown: { base: null, variable: null, equity: null, hasAny: false },
      rationale: null,
      noticeJoining: { noticePeriodDays: null, buyoutRequested: false, joiningBonusAsk: null, earlyJoinPreferred: false, joiningBonusClawbackDiscussed: false, lastWorkingDayText: null, hasAny: false },
      equityVesting: { vestingYears: null, cliffMonths: null, preference: null, familiarity: null, strikePriceDiscussed: false, valuationDiscussed: false, liquidityDiscussed: false, hasAny: false },
      locationMode: { workMode: null, locationCity: null, relocationRequested: false, relocationRefused: false, hasAny: false },
      competingOfferDetail: { company: null, status: null, stage: null, letterShareOffered: false, onHold: false, hasAny: false },
      decisionDeadline: { deadlineDays: null, deadlineExplicit: false, conditionalAcceptance: false, conditionalEvidence: null, hasAny: false },
      candidateProfile: { careerGapMonths: null, careerGapActivity: null, tenureSignal: null, levelMismatch: null, domainPivot: false, transferableSkillsClaimed: false, compensationHistoryIssue: null, serviceBondAccepted: false, probationCompMentioned: false, hasAny: false },
      miscSignals: { candidateFloor: null, salaryReviewMonths: null, proofOfCtcShareable: null, internalCounterRisk: null, hasAny: false },
      candidateStance: { flexibilityPosture: null, marketReferenceVague: false, salaryOnlyFactor: false, badmouthsCurrent: false, confidentialOvershare: false, soundsDesperate: false, treatsEquityAsCash: false, avoidsAnchor: false, personalExpenseJustification: false, offerShoppingDemand: false, dismissesVariableRisk: false, overpromisesJoining: false, hasAny: false },
      retentionCounter: { ...EMPTY_RETENTION_COUNTER },
    };
  }

  /* Acceptance detection is delegated to the unified
   * `_acceptance-classifier` module (Phase 9, 2026-05-13). The legacy
   * inline regex bank that lived here was duplicated in
   * `interviewEvaluation.extractNegotiationFacts.acceptedImmediately`
   * and the two paths drifted across sessions — each fix had to land
   * twice. The classifier is the single source of truth for both
   * detectors, and adds a structural phase gate that pure regex can't
   * express ("you can't accept what hasn't been offered"). The
   * walk-away signal is still computed locally because the kernel
   * exposes it as an independent ParsedAnswer field, and the legacy
   * extractor needs a paired walk-away check on the same axis. */
  const acceptanceResult = classifyAcceptance(a, { phase, offerOnTable });
  const signalsAcceptance = acceptanceResult.accepted;
  const walkAwayPat = /\b(walk away|walking away|i.?m out|not interested|i.?ll pass|no deal|withdraw|decline|won.?t work|isn.?t going to work|have to pass|that won.?t work|move on|nahi\s+(?:chahiye|karna|banega|hoga|kar\s+sakta)|nahin\s+(?:chahiye|karna)|mujhe\s+nahi(?:n)?\s+chahiye)\b/i;
  const signalsWalkAway = walkAwayPat.test(a);

  /* Current-CTC patterns. These claim their number FIRST so the
     target regex can't accidentally pick "8.5" out of "my current
     package is 8.5 LPA" — that exact bug shipped in production
     (Bombay Design Centre session, May 2026).

     Range support: "I'm earning 25-28 LPA" binds the upper bound so
     a candidate's stated comp ceiling becomes the disclosed value
     (matching how recruiters interpret stated current packages). */
  const currentCtc =
    extractUsdAmount(a, [
      /\bcurrent(?:ly)?\s+(?:package|salary|ctc|comp(?:ensation)?|pay)[^.!?\n]{0,30}?\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|K)?/i,
      /\b(?:currently|earning|getting|drawing|making|making\s+about|take\s+home|i\s+get|i\s+earn|i.?m\s+at)\s.*?\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|K)?/i,
    ]) ??
    extractFirstNumber(a, [
      /\b(?:my\s+)?current(?:ly)?\s+(?:package|salary|ctc|comp(?:ensation)?|pay|role)[^.!?\n₹]{0,30}?₹?\s*\d+(?:\.\d+)?\s*(?:[-–—]|to)\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
      /\b(?:my\s+)?current(?:ly)?\s+(?:package|salary|ctc|comp(?:ensation)?|pay|role)[^.!?\n₹]{0,30}?₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
      /\b(?:currently|earning|getting|drawing|my\s+ctc|i.?m\s+at|making|take\s+home|i\s+get|i\s+earn)\s.*?₹?\s*\d+(?:\.\d+)?\s*(?:[-–—]|to)\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
      /\b(?:currently|earning|getting|drawing|my\s+ctc|i.?m\s+at|making|take\s+home|i\s+get|i\s+earn)\s.*?₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
      /\bpackage\s+progression[^.!?\n₹]{0,30}?₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i,
    ]);

  /* Competing-offer patterns. Also must NOT bind to target. */
  const competingCtx = /(?:offer\s+of|in[-\s]?hand(?:\s+offer)?\s+(?:of|at)?|already\s+have|received|competing\s+offer\s+(?:of|at)?|got\s+an\s+offer\s+(?:of|at)?|another\s+offer\s+(?:of|at)?)/i;
  const competing =
    extractUsdAmount(a, [
      new RegExp(competingCtx.source + /\s*\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|K)?/.source, "i"),
    ]) ??
    extractFirstNumber(a, [
      /(?:offer\s+of|in[-\s]?hand(?:\s+offer)?\s+(?:of|at)?|already\s+have|received|competing\s+offer\s+(?:of|at)?|got\s+an\s+offer\s+(?:of|at)?|another\s+offer\s+(?:of|at)?)\s*₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|cr|crore)/i,
    ]);

  /* Target patterns. We require explicit ask context to bind — bare
     numbers are ignored to avoid "currently 8.5" leaking to target.
     Both directions matter for Indian candidates:
       - English / pre-number: "want / expecting / looking for N LPA"
       - Hindi-mix / post-number: "N lakh chahiye", "N LPA ka package",
         "N lakh mil jaye", "N LPA milna chahiye" — common in mixed
         Hindi-English STT output, previously dropped on the floor. */
  const targetCtxPat = /(?:expecting|want|need|asking|target|hoping|looking\s+for|would\s+like|i.?d\s+like|aim(?:ing)?\s+for|comfortable\s+with|settle\s+for|around|mujhe|mera\s+target)\s+(?:to\s+(?:have|get)\s+)?(?:an?\s+|about\s+|approximately\s+|roughly\s+)?₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)?/i;
  const targetHindiPostPat = /₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|lakh|l\b|cr|crore)\s+(?:chahiye|ka\s+package|mil\s+jaye|milna\s+chahiye|expect\s+kar(?:ta|ti)\s+hu|chahta\s+hu|chahti\s+hu)/i;
  /* Range patterns — "30-35 LPA" / "30 to 35 lakhs" / "₹30 – ₹35 LPA".
     Candidates anchor at the top of their stated range, so we bind the
     upper bound as the target (more realistic recruiter framing). */
  const targetRangePat = /(?:expecting|want|need|asking|target|hoping|looking\s+for|would\s+like|aim(?:ing)?\s+for|around|between)\s+(?:an?\s+)?₹?\s*\d+(?:\.\d+)?\s*(?:[-–—]|to)\s*₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|l\b|cr|crore)/i;
  /* USD anchors — "$150k", "$120,000", "USD 100k". Common in tech
     candidates moving from US-comp companies. Converted to LPA at a
     fixed rate so kernel math stays in one unit. */
  const targetUsdPat = /(?:expecting|want|need|asking|target|hoping|looking\s+for|would\s+like|aim(?:ing)?\s+for)\s+(?:an?\s+|about\s+|approximately\s+|roughly\s+)?\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\s*(k|K)?/i;
  let target = extractUsdAmount(a, [targetUsdPat]) ?? extractFirstNumber(a, [targetRangePat, targetCtxPat, targetHindiPostPat]);

  /* Phase-aware bare-number fallback. When the recruiter is in
     probe-expectations and the candidate replies with a number+LPA
     but no "looking for / want" trigger ("30 lpa thirty lakhs per
     ctc"), accept the number as target. Skip when the sentence has
     current/competing markers — those paths already bound. */
  if (
    target == null &&
    phase === "probe-expectations" &&
    currentCtc == null &&
    competing == null
  ) {
    const bareNumberPat = /(?:^|[^a-z])₹?\s*([\d,]+(?:\.\d+)?)\s*(?:lpa|lakhs?|lakh|l\b|cr|crore)\b/i;
    /* "per ctc" / "per annum ctc" is a unit qualifier — only treat "ctc"
       as a current-CTC marker when prefixed by current/my (or the explicit
       earning/drawing verbs). Otherwise "30 lpa per ctc" is a target. */
    const hasCurrentCtcWord = /\bcurrent(?:ly)?\b|\bmy\s+ctc\b|\bearning\b|\bgetting\b|\bdrawing\b|\bmaking\b|\btake\s+home\b/i.test(a);
    const hasCompetingWord = /\b(?:competing|another|other)\s+offer\b|\bin[-\s]?hand\b|\boffer\s+of\b/i.test(a);
    if (!hasCurrentCtcWord && !hasCompetingWord) {
      target = extractFirstNumber(a, [bareNumberPat]);
    }
  }

  /* Disambiguation: if a number was already bound to current/
     competing, it isn't ALSO the target — drop it. */
  if (target != null && (target === currentCtc || target === competing)) {
    target = null;
  }

  /* Range-ask detection — fires if any of the range patterns matched
     regardless of whether the bound number came from a range or a
     single-value path. */
  const rangeAnyPat = /\b\d+(?:\.\d+)?\s*(?:[-–—]|to)\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l\b|cr|crore)/i;
  const targetAsRange = rangeAnyPat.test(a) && target != null;

  /* Competing-without-number: candidate has signaled competing exists
     but refuses or omits to share magnitude. */
  const competingMentionPat = /\b(competing\s+offer|another\s+offer|other\s+offers?|offer\s+in\s+hand|other\s+companies|elsewhere|other\s+conversations|in\s+the\s+market)\b/i;
  const hedgePat = /\b(can.?t\s+share|prefer\s+not|nda|confidential|not\s+at\s+liberty|won.?t\s+disclose|details\s+(?:are\s+)?confidential)\b/i;
  const signalsCompetingExistsWithoutNumber =
    competing == null && competingMentionPat.test(a) && (hedgePat.test(a) || !/[\d]/.test(a));

  const vossTactics = detectVossTactics(a, lastAiText);
  const infoAsked = detectInfoIntents(a);
  const componentBreakdown = extractComponentBreakdown(a);
  /* Phases 11/13/14/15/16 parsers — each returns a structured record
   * with `hasAny` (or null for the rationale singleton). They run
   * over the SAME normalized text so a single utterance "I'm in
   * Bangalore, 90-day notice, market is 32 LPA for my YOE" populates
   * location + notice + rationale in one pass. */
  const hikeRationale = extractHikeRationale(a, target, currentCtc);
  const noticeJoining = extractNoticeJoining(a);
  const equityVesting = extractEquityVesting(a);
  const locationMode = extractLocationMode(a);
  const competingOfferDetail = extractCompetingOfferDetail(a);
  const decisionDeadline = extractDecisionDeadline(a);
  const candidateProfile = extractCandidateProfile(a);
  const miscSignals = extractMiscSignals(a);
  const candidateStance = extractCandidateStance(a);
  const retentionCounter = extractRetentionCounter(a);

  /* Phase 17A — when a conditional acceptance fires, the legacy
   * `signalsAcceptance` boolean must be downgraded. A conditional
   * commit is not an unconditional accept; the AI should respond to
   * the CONDITION, not close the deal. The classifier already requires
   * an "if X" clause to fire conditional, so this is structural:
   * conditional ⇒ NOT accepted. */
  const signalsAcceptanceFinal =
    signalsAcceptance && !decisionDeadline.conditionalAcceptance;

  return {
    target, currentCtc, competing,
    signalsAcceptance: signalsAcceptanceFinal, signalsWalkAway,
    targetAsRange, vossTactics, infoAsked,
    signalsCompetingExistsWithoutNumber,
    componentBreakdown,
    rationale: hikeRationale.rationale,
    noticeJoining,
    equityVesting,
    locationMode,
    competingOfferDetail,
    decisionDeadline,
    candidateProfile,
    miscSignals,
    candidateStance,
    retentionCounter,
  };
}

/* Extract the first numeric value from `text` using any of `patterns`.
   Output is normalised to LPA.

   Unit handling: when the matched substring contains a crore marker
   (`cr` / `crore`) we multiply by 100 so "5 crore" → 500 LPA. Without
   this, the senior/exec hiring path silently truncated magnitude (we
   captured the digit `5` but treated it as 5 LPA). Clamp is widened
   to 5000 LPA (= 50 crore) which covers C-suite while still rejecting
   garbage from STT mishears like "five hundred thousand".

   Comma stripping: Indian "30,00,000" and Western "3,000,000" both
   strip to "3000000". The downstream LPA/lakh unit then resolves
   them correctly. */
function extractFirstNumber(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1]) {
      let n = parseFloat(m[1].replace(/,/g, ""));
      if (!Number.isFinite(n)) continue;
      const isCrore = /\bcr\b|crore/i.test(m[0]);
      if (isCrore) n *= 100;
      if (n >= 1 && n <= 5000) return n;
    }
  }
  return null;
}

/* Convert a USD amount to LPA. Used when a candidate quotes US-comp
   numbers ("$150k", "$120,000"). We use a fixed 83 INR/USD rate —
   close enough for negotiation-band math and avoids the operational
   risk of a live FX lookup on every turn. Anything outside 10k–5M USD
   is rejected as malformed. */
const USD_TO_INR = 83;
function extractUsdAmount(text: string, patterns: RegExp[]): number | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1]) {
      let usd = parseFloat(m[1].replace(/,/g, ""));
      if (!Number.isFinite(usd)) continue;
      /* The `k` suffix on the match means thousands. */
      if (/k/i.test(m[2] || "")) usd *= 1000;
      if (usd < 10_000 || usd > 5_000_000) continue;
      /* USD → INR → lakhs. 1 lakh = 100k INR. */
      const lpa = Math.round((usd * USD_TO_INR) / 100_000 * 10) / 10;
      if (lpa >= 1 && lpa <= 5000) return lpa;
    }
  }
  return null;
}

/* ─── State transition: fold candidate's answer into state ───────── */

/** Apply a candidate turn to state. Returns a new state — never
 *  mutates the input. Terminal phases are sticky: if state.phase is
 *  already terminal, returns state unchanged. */
export function applyCandidateAnswer(state: NegotiationState, answer: string): NegotiationState {
  /* Walk-away-and-return: if state is terminal `walked-away` but the
     candidate sends a non-empty engagement, re-open the conversation
     with a penalty flag. This is the only path out of a terminal phase
     and it's a one-way trapdoor (the flag is sticky). */
  if (state.phase === "walked-away" && (answer || "").trim().length > 0 &&
      !/\b(walk away|walking away|not interested|withdraw|decline|won.?t work|isn.?t going to work|move on|nahi\s+(?:chahiye|karna|banega))\b/i.test(answer)) {
    const reopened: NegotiationState = {
      ...state,
      leversUsed: [...state.leversUsed],
      vossTacticsUsed: [...state.vossTacticsUsed],
      infoAsked: [...state.infoAsked],
      phase: "counter-offer",
      walkAwayReturned: true,
      walkedAwayAtTurn: null,
    };
    return applyCandidateAnswer(reopened, answer);
  }
  if (isTerminalPhase(state.phase)) return state;

  /* `offerOnTable` lets the acceptance classifier veto commitment
     idioms ("sounds good") that arrive before any number has been
     quoted — structural phase gate (Phase 9). */
  const offerOnTable = (state.highestOfferMade ?? 0) > 0;
  const parsed = parseCandidateAnswer(answer, state.lastAiText, state.phase, offerOnTable);
  const next: NegotiationState = {
    ...state,
    leversUsed: [...state.leversUsed],
    vossTacticsUsed: [...state.vossTacticsUsed],
    infoAsked: [...state.infoAsked],
    conversationLog: appendConversation(state.conversationLog, "candidate", answer),
  };

  /* Bind newly-stated facts. Last-stated wins (the candidate may
     revise their target mid-conversation; that's allowed). Phase 25a
     also records the FIRST anchored target, frozen — used by the
     red-flag layer to detect upward drift. */
  if (parsed.target != null) {
    next.candidateTarget = parsed.target;
    if (next.firstAnchoredTarget == null) next.firstAnchoredTarget = parsed.target;
  }
  if (parsed.currentCtc != null) next.candidateCurrentCtc = parsed.currentCtc;
  if (parsed.competing != null) next.competingOffer = parsed.competing;
  if (parsed.targetAsRange) next.candidateAskedAsRange = true;
  /* Component breakdown — merge non-null fields into sticky state.
     Last-stated wins per component; previously-stated components
     persist when the current turn names only one. */
  if (parsed.componentBreakdown.hasAny) {
    next.candidateComponentBreakdown = mergeBreakdown(
      state.candidateComponentBreakdown,
      parsed.componentBreakdown,
    );
  }

  /* Phase 12c (2026-05-13) — structural hard-band-cap detection. If
   * the candidate's stated base floor exceeds the band's
   * baseStretch, the cap is structural (not just band): no amount
   * of total-CTC stretching satisfies the constraint, because base
   * is the binding component. Flip hardBandCap so the move-picker
   * redirects all concession energy to non-cash levers instead of
   * inching the total toward maxStretch on impossible base. */
  if (
    next.candidateComponentBreakdown.base != null &&
    state.band.baseStretch != null &&
    next.candidateComponentBreakdown.base > state.band.baseStretch
  ) {
    next.hardBandCap = true;
  }

  /* Phase 11 — hike% is recomputed each turn from the LATEST
     target+currentCtc (after current-turn binding). Rationale is
     sticky: last-stated wins, prior preserved when current turn
     mentions no rationale cue. */
  next.hikePercent = computeHikePercent(next.candidateTarget, next.candidateCurrentCtc);
  if (parsed.rationale) next.rationale = parsed.rationale;

  /* Phase 13/14/15/16 — merge non-empty parses into sticky state.
     Each merger preserves prior fields when the current turn doesn't
     mention them; non-null new values overwrite. Booleans are
     monotone-up (once requested/refused, stays). */
  if (parsed.noticeJoining.hasAny) {
    next.noticeJoining = mergeNoticeJoining(state.noticeJoining, parsed.noticeJoining);
  }
  if (parsed.equityVesting.hasAny) {
    next.equityVesting = mergeEquityVesting(state.equityVesting, parsed.equityVesting);
  }
  if (parsed.locationMode.hasAny) {
    next.locationMode = mergeLocationMode(state.locationMode, parsed.locationMode);
  }
  if (parsed.competingOfferDetail.hasAny) {
    next.competingOfferDetail = mergeCompetingOfferDetail(
      state.competingOfferDetail,
      parsed.competingOfferDetail,
    );
  }

  /* Phase 17 — fold deadline + profile + misc scalars. Same
   * last-stated-wins / monotone-up merge semantics. */
  if (parsed.decisionDeadline.hasAny) {
    next.decisionDeadline = mergeDecisionDeadline(state.decisionDeadline, parsed.decisionDeadline);
  }
  if (parsed.candidateProfile.hasAny) {
    next.candidateProfile = mergeCandidateProfile(state.candidateProfile, parsed.candidateProfile);
  }
  if (parsed.miscSignals.hasAny) {
    next.miscSignals = mergeMiscSignals(state.miscSignals, parsed.miscSignals);
  }
  if (parsed.retentionCounter.hasAny) {
    next.retentionCounter = mergeRetentionCounter(state.retentionCounter, parsed.retentionCounter);
  }
  /* Phase 21 — pass recovery signals so posture booleans (desperate,
   * salary-only, avoids-anchor, personal-expense, offer-shopping) can
   * decay when the candidate course-corrects in a later turn. Other
   * red flags (badmouth, equity-as-cash, etc.) stay sticky. */
  const recovery = detectRecoverySignals(answer);
  const hasRecovery =
    recovery.desperateRecovered ||
    recovery.salaryOnlyRecovered ||
    recovery.avoidsAnchorRecovered ||
    recovery.personalExpenseRecovered ||
    recovery.offerShoppingRecovered;
  if (parsed.candidateStance.hasAny || hasRecovery) {
    next.candidateStance = mergeCandidateStance(
      state.candidateStance,
      parsed.candidateStance,
      recovery,
    );
  }
  /* Phase 21b recovery actualization (2026-05-13) — mark the AI's next
   * turn as eligible for a small un-stiffening boost in the move-picker.
   * Reset to false in applyAiMove so the bonus is one-shot, not sticky. */
  next.recentRecoveryActive = hasRecovery;

  /* Phase 24c — merge sales / contract comp-structure detectors.
   * Only merge when the new utterance carried a signal; otherwise
   * leave prior state intact (we never blank out earlier disclosure). */
  const freshSales = extractSalesOTE(answer);
  if (freshSales.hasAny) {
    next.salesOTE = mergeSalesOTE(state.salesOTE, freshSales);
  }
  const freshContract = extractContractRate(answer);
  if (freshContract.hasAny) {
    next.contractRate = mergeContractRate(state.contractRate, freshContract);
  }

  /* Merge tactic + info sets — sticky, never cleared. */
  for (const t of parsed.vossTactics) {
    if (!next.vossTacticsUsed.includes(t)) next.vossTacticsUsed.push(t);
  }
  for (const i of parsed.infoAsked) {
    if (!next.infoAsked.includes(i)) next.infoAsked.push(i);
  }

  /* Verbal-acceptance lock — if the candidate previously said yes but
     now is asking for more (target above current offer, or new lever
     request), record the turn so the move-picker can stiffen. We do
     NOT transition to terminal `accepted` in this case; the candidate
     re-opened. */
  const reneging =
    next.verbalAcceptanceTurn != null &&
    (parsed.target != null || parsed.vossTactics.includes("sign-today-bundle") || parsed.infoAsked.length > 0) &&
    !parsed.signalsAcceptance;
  if (reneging) {
    /* Sticky — leave verbalAcceptanceTurn set so the move-picker keeps
       seeing it across subsequent turns. Phase 25d: also escalate the
       rescission counter so 2+ consecutive renegotiation attempts trip
       a hard close-walkaway path in the move-picker AND a "rescission-
       risk" blocker in the red-flag layer. */
    next.postVerbalRenegotiationCount = state.postVerbalRenegotiationCount + 1;
  }

  /* Terminal transitions. */
  if (parsed.signalsAcceptance) {
    /* Conditional accept ("yes if X") set verbalAcceptanceTurn instead
       of locking terminal. parseCandidateAnswer's acceptPat already
       rejects most conditionals; this is belt-and-suspenders for the
       sign-today-bundle path which carries its own implicit "if". */
    if (parsed.vossTactics.includes("sign-today-bundle")) {
      next.verbalAcceptanceTurn = state.turnIndex;
      next.phase = derivePhase(next);
      return next;
    }
    next.phase = "accepted";
    next.acceptedAtTurn = state.turnIndex;
    return next;
  }
  if (parsed.signalsWalkAway) {
    next.phase = "walked-away";
    next.walkedAwayAtTurn = state.turnIndex;
    return next;
  }

  /* Non-terminal: re-derive phase from updated state. */
  next.phase = derivePhase(next);
  return next;
}

/** Fold an externally-computed NegotiationFacts (from the legacy
 *  whole-transcript extractor) into state. Useful during the
 *  feature-flag transition: legacy code already has facts, and the
 *  new kernel can adopt them without re-parsing. */
export function foldFactsIntoState(state: NegotiationState, facts: NegotiationFacts): NegotiationState {
  if (isTerminalPhase(state.phase)) return state;
  const next: NegotiationState = {
    ...state,
    leversUsed: [...state.leversUsed],
    vossTacticsUsed: [...state.vossTacticsUsed],
    infoAsked: [...state.infoAsked],
  };
  const num = (s: string | null): number | null => {
    if (!s) return null;
    const v = parseFloat(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const t = num(facts.candidateCounter);
  const c = num(facts.candidateCurrentCTC);
  const comp = num(facts.competingOfferAmount ?? null);
  if (t != null) {
    next.candidateTarget = t;
    if (next.firstAnchoredTarget == null) next.firstAnchoredTarget = t;
  }
  if (c != null) next.candidateCurrentCtc = c;
  if (comp != null) next.competingOffer = comp;
  if (facts.acceptedImmediately) {
    next.phase = "accepted";
    next.acceptedAtTurn = state.turnIndex;
    return next;
  }
  if (facts.rejectedOutright) {
    next.phase = "walked-away";
    next.walkedAwayAtTurn = state.turnIndex;
    return next;
  }
  next.phase = derivePhase(next);
  return next;
}

/* ─── Phase derivation ───────────────────────────────────────────── */

/** State → phase. Pure, no transcript dependency. The earlier
 *  detectSalaryPhase needed transcript + turn index + facts because it
 *  was reconstructing state from scratch each render; here the phase
 *  IS state, and we just compute the next bucket from already-folded
 *  facts. */
export function derivePhase(state: NegotiationState): NegotiationPhase {
  if (isTerminalPhase(state.phase)) return state.phase;
  if (state.turnIndex >= state.maxTurns) return "stalemate";

  /* Phase 25e (2026-05-13) — closing-push runway. The previous machine
   * jumped straight from counter-offer / lever-explore to stalemate the
   * instant turn budget elapsed, denying the AI a final framed close.
   * One turn before stalemate, when we're still mid-negotiation, route
   * into closing-push so the LLM can issue a clean "I need a decision
   * today" turn before the budget terminates. */
  if (
    state.turnIndex === state.maxTurns - 1 &&
    (state.phase === "counter-offer" || state.phase === "lever-explore")
  ) {
    return "closing-push";
  }

  const target = state.candidateTarget;
  /* Phase stickiness — the MakeMyTrip UX session regression:
     once the conversation has progressed past probe (the candidate
     has anchored, OR we've already entered counter-offer / lever-
     explore / closing-pressure / closing), it MUST NOT regress to
     probe-expectations just because a subsequent turn didn't restate
     a target number. The candidate saying "do it, tell me more" on
     turn 3 doesn't erase the target they stated on turn 2. The post-
     offer phases form a one-way ratchet (except for the explicit
     verbal-acceptance-then-renegotiate path, which is handled via
     `verbalAcceptanceTurn` and never touches phase). */
  const POST_PROBE_PHASES: NegotiationPhase[] = [
    "counter-offer", "lever-explore", "closing-push",
  ];
  const isPostProbe = POST_PROBE_PHASES.includes(state.phase);
  /* "Already probed" sticky-floor: once the AI has run a probe lever
     and the candidate engaged (asked about breakdown, mentioned current
     comp / competing, or used a Voss tactic), do not re-probe even if
     the candidate's next utterance lacks an explicit target. The
     MakeMyTrip session showed the AI asking "what are you hoping to
     achieve" THREE turns after the candidate had engaged with the
     offer, because no explicit target was ever parsed. We treat the
     conversation as having moved on from discovery. */
  const alreadyProbed = state.leversUsed.includes("probe");
  const candidateEngagedAtAll =
    state.candidateTarget != null ||
    state.candidateCurrentCtc != null ||
    state.competingOffer != null ||
    state.vossTacticsUsed.length > 0 ||
    state.infoAsked.length > 0;

  /* Target above max stretch + ≥2 levers tried → lever-explore. Only
     non-cash bridges remain. */
  if (target != null && target > state.band.maxStretch && state.leversUsed.length >= 2) {
    return "lever-explore";
  }

  /* Target stated + we've made an offer → counter territory. */
  if (target != null && state.highestOfferMade > 0) {
    return "counter-offer";
  }

  /* Offered, no target. If the candidate has revealed anything (current
     CTC, competing offer) or we've already probed, we're in probe
     territory; otherwise we're awaiting their first reaction.

     BUT: if we're already in a post-probe phase, hold there (don't
     ratchet backwards). The conversation is past discovery. */
  if (state.highestOfferMade > 0) {
    if (isPostProbe) return state.phase;
    /* If we've already probed AND the candidate has revealed anything,
       further turns belong in counter-offer (treat candidateTarget=null
       as "candidate didn't restate but has engaged" — pickAiMove will
       fall to lever-explore on no headroom). Better than re-probing. */
    if (alreadyProbed && candidateEngagedAtAll) return "counter-offer";
    const candidateEngaged =
      state.candidateCurrentCtc != null ||
      state.competingOffer != null ||
      state.leversUsed.includes("probe");
    return candidateEngaged ? "probe-expectations" : "offer-presented";
  }

  return "opening";
}

/* ─── AI move selection ──────────────────────────────────────────── */

export interface AiMove {
  lever: NegotiationLever;
  /** New total CTC the AI is willing to put on the table this turn
   *  (LPA). Null when the move is non-numeric (probe / benefits / hold). */
  newTotalLpa: number | null;
  /** Human-readable rationale for telemetry and prompt context. */
  rationale: string;
  /** Phase 24d (2026-05-13) — market modulation hint for non-cash
   *  levers. counter-base bakes marketMode into the numeric split,
   *  but joining-bonus / equity-grant / notice-buyout amounts come
   *  from the LLM, not the kernel. Surface a tone hint so the LLM
   *  sizes those concessions in line with the market: hot → be
   *  generous, soft → be tight, neutral → standard. */
  marketModeHint?: string;
  /** Kernel-computed joining-bonus amount (LPA, one-time). Set when
   *  lever='joining-bonus' OR when lever='close-acceptance' and a
   *  JB had previously been offered this session. The LLM MUST quote
   *  this number — non-negotiable. Sizing logic: 40% of the gap
   *  between current highest offer and candidateTarget (or maxStretch
   *  when target is null), modulated by marketMode (hot 1.5 / neutral
   *  1.0 / soft 0.7), clamped to [1.0, 6.0] LPA. Without this, the
   *  LLM offered "joining bonus" three times without ever naming an
   *  amount (May 2026 session). */
  joiningBonusAmount?: number;
}

/** Pick the AI's move for this turn from state alone. Pure. */
export function pickAiMove(state: NegotiationState): AiMove {
  /* Terminal closings. */
  if (state.phase === "accepted") {
    /* Phase 28 — carry the previously-offered JB into the close so the
       recap reflects both base + one-time JB. Without this the close
       summary silently dropped any JB that had been put on the table
       earlier in the session (May 2026 session). */
    const jb = state.lastJoiningBonusOffered;
    return {
      lever: "close-acceptance",
      newTotalLpa: state.highestOfferMade || state.band.initialOffer,
      joiningBonusAmount: jb != null ? jb : undefined,
      rationale: `Candidate accepted; recap terms${jb != null ? ` including ₹${jb}L one-time JB` : ""}.`,
    };
  }
  if (state.phase === "walked-away") {
    return {
      lever: "close-walkaway",
      newTotalLpa: null,
      rationale: "Candidate walked; acknowledge respectfully.",
    };
  }
  if (state.phase === "stalemate") {
    return {
      lever: "close-stalemate",
      newTotalLpa: state.highestOfferMade || state.band.initialOffer,
      rationale: "Turn budget exhausted; offer time to think.",
    };
  }

  /* Opening: put the initial offer on the table. */
  if (state.phase === "opening") {
    return {
      lever: "open-with-offer",
      newTotalLpa: state.band.initialOffer,
      rationale: `Open with band initial ₹${state.band.initialOffer} LPA.`,
    };
  }

  /* Intent override (Phase 3 of the rebuild — Lollypop session, May 2026).
   *
   * The phase machine alone is too coarse for one specific failure mode:
   * the candidate explicitly asks the recruiter to enumerate the
   * package ("can you break it down for me?", "walk me through the
   * structure") while the phase is still offer-presented / probe-
   * expectations. The default path here is the `probe` lever — but the
   * candidate just told us what they want, and it isn't a probe.
   * Responding with another question feels robotic and broke the
   * Lollypop session ("what range are you targeting?" against an explicit
   * ask for the structure).
   *
   * The override: when the candidate has asked for the package
   * breakdown AND we've made an offer AND we haven't already done
   * benefits-summary, jump straight to benefits-summary regardless of
   * phase. The kernel still tracks phase for downstream concession
   * curves, so this is intent-shaped routing on top of phase-shaped
   * routing — not a replacement. */
  const wantsBreakdown =
    state.highestOfferMade > 0 &&
    !state.leversUsed.includes("benefits-summary") &&
    (state.infoAsked.includes("package-breakdown") ||
      state.infoAsked.includes("fixed-vs-variable") ||
      state.infoAsked.includes("perks-non-cash"));
  if (wantsBreakdown) {
    return {
      lever: "benefits-summary",
      newTotalLpa: state.highestOfferMade,
      rationale: "Candidate asked for the package breakdown; enumerate components instead of probing.",
    };
  }

  /* No candidate anchor yet → probe. */
  if (state.phase === "offer-presented" || state.phase === "probe-expectations") {
    return {
      lever: "probe",
      newTotalLpa: null,
      rationale: "Probe candidate's expectation before moving.",
    };
  }

  /* Counter-offer: split toward target, capped at maxStretch.

     Stiffening: the split factor decays as we repeat counter-base.
     A flat 0.5 every turn was exploitable — a candidate who simply
     re-asserted the same demand each turn could pull the offer to
     maxStretch in 4–5 turns. Real recruiters concede less each time
     the same lever is pulled. Schedule: 0.5 → 0.35 → 0.22 → 0.12 → 0.06,
     then floor at 0.05. The full ceiling (maxStretch) remains the hard
     cap, so this never *exceeds* band, only approaches it more slowly. */
  if (state.phase === "counter-offer") {
    /* Hard band cap: base is structurally capped; redirect concession
       energy to non-cash levers instead of inching toward maxStretch. */
    if (state.hardBandCap) {
      return pickLeverExploreMove(state);
    }
    /* Verbal-acceptance-then-renegotiate: heavy stiffening + reject any
       further base movement. Modeled after the offer-rescission risk
       documented in Salary.com survey data.

       Phase 25d (2026-05-13) — escalation. A first re-open earns
       hold-firm; the second re-open is the trigger for offer
       rescission: route directly to close-walkaway. The red-flag
       layer surfaces "rescission-risk" as a blocker on the same
       state so the coach layer can explain what just happened. */
    if (state.verbalAcceptanceTurn != null) {
      if (state.postVerbalRenegotiationCount >= 2) {
        return {
          lever: "close-walkaway",
          newTotalLpa: null,
          rationale: "Candidate verbally accepted then re-opened twice — the offer is being rescinded.",
        };
      }
      return {
        lever: "hold-firm",
        newTotalLpa: state.highestOfferMade,
        rationale: "Candidate verbally accepted; further base asks risk rescission. Hold firm.",
      };
    }

    const target = state.candidateTarget ?? state.band.maxStretch;
    const floor = Math.max(state.highestOfferMade, state.band.initialOffer);
    const ceiling = state.band.maxStretch;
    const aspiration = Math.min(target, ceiling);

    /* No headroom → switch to lever-explore. */
    if (aspiration <= floor + 0.1) {
      return pickLeverExploreMove(state);
    }
    const counterCount = state.leversUsed.filter(l => l === "counter-base").length;
    const splitSchedule = [0.5, 0.35, 0.22, 0.12, 0.06];
    let split = splitSchedule[counterCount] ?? 0.05;

    /* Tactic boost: candidates using calibrated questions, range asks,
       and labeling get larger concessions per turn. Mirroring alone is
       a softer signal so it earns a smaller bump. Sign-today bundles
       get the biggest boost (Voss-canon-grade certainty-for-concession
       trade). Cumulative, capped at 2x the base split. */
    let boost = 1;
    if (state.candidateAskedAsRange) boost += 0.15;
    if (state.vossTacticsUsed.includes("calibrated")) boost += 0.25;
    if (state.vossTacticsUsed.includes("label")) boost += 0.15;
    if (state.vossTacticsUsed.includes("mirror")) boost += 0.05;
    if (state.vossTacticsUsed.includes("sign-today-bundle")) boost += 0.35;
    if (state.vossTacticsUsed.includes("deflect-current-ctc")) boost += 0.10;
    /* Smart-question reward (Phase 25c, 2026-05-13). Asking specific
     * structural questions (clawback, vesting, strike, in-hand, etc.)
     * is itself a sophisticated negotiation tactic and should earn
     * the candidate a small but real concession boost. +0.03 per
     * unique info intent, capped at +0.10 (so ~3 smart questions
     * roughly equals one Voss tactic). */
    const infoBoost = Math.min(state.infoAsked.length * 0.03, 0.10);
    boost += infoBoost;
    /* Phase 21b recovery actualization (2026-05-13). A candidate who
     * course-corrected from a desperation / salary-only / personal-
     * expense / offer-shopping / no-anchor tell on the most recent
     * utterance shouldn't stay punished by an earlier stance breach.
     * Mirror a small "mirror"-tier bump for this AI turn only. */
    if (state.recentRecoveryActive) boost += 0.05;
    if (boost > 2) boost = 2;
    split = Math.min(split * boost, 0.6);

    /* Market mode modulator. Soft markets squeeze candidates; hot
       markets reward them. */
    if (state.marketMode === "soft") split *= 0.7;
    else if (state.marketMode === "hot") split *= 1.3;

    /* Walk-away-and-return penalty: returning candidate gets a worse
     * concession curve to model the loss of leverage. */
    if (state.walkAwayReturned) split *= 0.5;

    if (split > 0.95) split = 0.95;
    let newTotal = Math.round((floor + (aspiration - floor) * split) * 10) / 10;

    /* Phase 12b (2026-05-13) — band-component cap enforcement. When
     * the band declares baseStretch + (optional) variableMax, the
     * counter MUST respect the structural envelope. Total CTC =
     * base + variable, so the max defensible total is
     *   baseStretch + (variableMax ?? 0).
     * If the headline split crossed that, clamp the total down AND
     * route to lever-explore: the cash ceiling has been hit on
     * structure, not on band — non-cash levers remain the path
     * forward. Without this, the AI is implicitly promising base it
     * can't deliver. */
    if (state.band.baseStretch != null) {
      const componentCap = state.band.baseStretch + (state.band.variableMax ?? 0);
      if (newTotal > componentCap + 0.01) {
        /* Clamp kicked in: the headline split would have promised
         * base the structure can't deliver. Route to lever-explore;
         * non-cash levers (JB / equity / notice-buyout) remain the
         * only honest path forward. */
        return pickLeverExploreMove(state);
      }
    }
    return {
      lever: "counter-base",
      newTotalLpa: newTotal,
      rationale: `Split toward target (stiffening ${splitSchedule[counterCount] ?? 0.05}, effective ${split.toFixed(2)}, boost ${boost.toFixed(2)}, market ${state.marketMode}${state.walkAwayReturned ? ", returned" : ""}): floor ₹${floor} → ₹${newTotal} (target ₹${target}, ceiling ₹${ceiling}).`,
    };
  }

  /* lever-explore / closing-push: rotate non-cash levers. */
  return pickLeverExploreMove(state);
}

/** Phase 28 (2026-05-13) — compute the joining-bonus amount the LLM
 *  MUST quote. The previous behaviour delegated this to the LLM and the
 *  LLM punted ("a joining bonus" with no number, three turns running).
 *  Sizing:
 *    gap        = max(0, candidateTarget − highestOfferMade)
 *                 (target null → gap = maxStretch − highestOfferMade)
 *    baseJB     = clamp(gap × 0.4, 1.0, 6.0)
 *    multiplier = marketMode: hot 1.5 / neutral 1.0 / soft 0.7
 *    final      = round(baseJB × multiplier × 10) / 10
 *  Annual-equivalent sanity cap: never exceed (maxStretch − initialOffer)
 *  so the one-time JB doesn't blow past the band's full year-1 spread.
 *  Edge cases:
 *    - gap ≤ 0 (we're already above the candidate's target): JB still
 *      hits the ₹1L floor so the lever fires meaningfully rather than
 *      producing a ₹0 "bonus".
 *    - hot market with tight band: the band-spread cap kicks in.
 *  Pure. */
function computeJoiningBonusAmount(state: NegotiationState): number {
  const target = state.candidateTarget;
  const refTop = target != null ? target : state.band.maxStretch;
  const gap = Math.max(0, refTop - state.highestOfferMade);
  const baseJB = Math.min(6.0, Math.max(1.0, gap * 0.4));
  const multiplier =
    state.marketMode === "hot" ? 1.5 :
    state.marketMode === "soft" ? 0.7 : 1.0;
  let final = Math.round(baseJB * multiplier * 10) / 10;
  const bandSpreadCap = Math.max(1.0, state.band.maxStretch - state.band.initialOffer);
  if (final > bandSpreadCap) final = Math.round(bandSpreadCap * 10) / 10;
  /* Guard against NaN / Infinity from a degenerate band. */
  if (!Number.isFinite(final) || final <= 0) return 1.0;
  return final;
}

function pickLeverExploreMove(state: NegotiationState): AiMove {
  const used = new Set(state.leversUsed);
  /* Phase 24d (2026-05-13) — market mode applied to non-cash levers
   * via a tone hint. counter-base already bakes marketMode into the
   * numeric split; JB / equity / notice-buyout amounts come from the
   * LLM, so we surface a hint instead of a scalar. */
  const marketModeHint =
    state.marketMode === "hot"
      ? "hot market — be generous on non-cash (JB ~1.5x baseline, equity +25%, full notice buyout where applicable)"
      : state.marketMode === "soft"
      ? "soft market — non-cash is also tight (JB ~0.7x baseline, equity -25%, only partial notice buyout)"
      : "neutral market — standard non-cash sizing";
  /* Lever order optimises for company P&L: when the band supports equity
     we prefer equity-grant FIRST because grants vest over multi-year
     schedules and dilute cap-table paper (not in-year cash), whereas a
     joining bonus is full sunk cash at hire. Falling back to joining-
     bonus only when the tier has no equity to offer keeps the AI from
     leaking the cheapest concession last. */
  if (state.band.hasEquity && !used.has("equity-grant")) {
    return {
      lever: "equity-grant",
      newTotalLpa: state.highestOfferMade,
      rationale: "Add equity grant; cheaper long-term than cash sweeteners.",
      marketModeHint,
    };
  }
  if (!used.has("joining-bonus")) {
    return {
      lever: "joining-bonus",
      newTotalLpa: state.highestOfferMade,
      joiningBonusAmount: computeJoiningBonusAmount(state),
      rationale: "Cash headroom exhausted; add one-time joining bonus.",
      marketModeHint,
    };
  }
  if (!used.has("notice-buyout")) {
    return {
      lever: "notice-buyout",
      newTotalLpa: state.highestOfferMade,
      rationale: "Offer notice-period buyout as soft lever.",
      marketModeHint,
    };
  }
  if (!used.has("benefits-summary")) {
    return {
      lever: "benefits-summary",
      newTotalLpa: state.highestOfferMade,
      rationale: "Recap non-cash benefits totality.",
    };
  }
  return {
    lever: "hold-firm",
    newTotalLpa: state.highestOfferMade,
    rationale: "All levers exhausted; hold firm and invite decision.",
  };
}

/* Cap on the rolling conversation log. 4 entries = the last 2 exchanges,
 * which is what the per-turn LLM prompt embeds. Larger logs drift the
 * dynamic portion of the prompt farther through Groq's prefix cache,
 * costing both tokens and cache-hit rate without measurably improving
 * thread coherence (the kernel brief carries the derived facts; the log
 * is just for natural-language reference resolution). */
export const CONVERSATION_LOG_CAP = 4;

/** Push a new entry onto the rolling log, capping at the most recent
 *  CONVERSATION_LOG_CAP entries. Empty text drops the entry (e.g. the
 *  init turn where candidateAnswer = ""). Pure. */
function appendConversation(
  log: NegotiationState["conversationLog"],
  speaker: "ai" | "candidate",
  text: string,
): NegotiationState["conversationLog"] {
  const trimmed = (text || "").trim();
  if (!trimmed) return log.slice();
  const next = [...log, { speaker, text: trimmed }];
  return next.length > CONVERSATION_LOG_CAP ? next.slice(next.length - CONVERSATION_LOG_CAP) : next;
}

/* ─── State transition: apply an AI move ─────────────────────────── */

/** Apply an AI move to state, incrementing turn index and recording
 *  the lever + offered number. Pure. Caller is responsible for the
 *  actual text generation; this just bookkeeps the move. */
export function applyAiMove(state: NegotiationState, move: AiMove, aiText: string): NegotiationState {
  const next: NegotiationState = {
    ...state,
    turnIndex: state.turnIndex + 1,
    leversUsed: [...state.leversUsed, move.lever],
    lastAiText: aiText,
    conversationLog: appendConversation(state.conversationLog, "ai", aiText),
    /* Phase 21b: recovery boost is one-shot — clear after the AI's
     * turn fires so subsequent turns aren't permanently un-stiffened
     * after a single recovery utterance. */
    recentRecoveryActive: false,
  };
  if (move.newTotalLpa != null && move.newTotalLpa > state.highestOfferMade) {
    next.highestOfferMade = move.newTotalLpa;
  }
  /* Phase 28 — record the kernel-computed JB amount when a JB lever
     fires so close-acceptance can include it in the recap. Sticky:
     once set, only an upward replacement clobbers it (a subsequent JB
     lever would re-compute against the new highestOfferMade). */
  if (move.lever === "joining-bonus" && typeof move.joiningBonusAmount === "number") {
    next.lastJoiningBonusOffered = move.joiningBonusAmount;
  }
  /* Re-derive phase only for non-terminal states (terminal phases set
     by candidate-turn don't get clobbered by an AI move that follows). */
  if (!isTerminalPhase(next.phase)) {
    next.phase = derivePhase(next);
  }
  return next;
}

/* ─── Validation helpers ─────────────────────────────────────────── */

/** Does the LLM's generated text contain a salary number that
 *  violates the band? Returns the first violating number (in LPA) or
 *  null. Used by the route handler to detect when the LLM has invented
 *  a number outside the approved band.
 *
 *  Unit-aware: matches both `LPA / lakh` and `cr / crore` and normalises
 *  crore→LPA (×100). Without crore matching, the LLM could write
 *  "₹2 crore total" and bypass the validator entirely — a real risk
 *  since the upstream parser now accepts crore inputs from candidates. */
export function findOutOfBandNumber(text: string, band: NegotiationBand): number | null {
  /* Currency prefix accepts ₹, Rs., Rs, INR so an LLM switching
     notation can't sneak past validation. Now ALSO accepts a bare
     number followed by LPA / lakh / cr — production LLMs frequently
     drop the rupee glyph ("35 LPA"), and the prior strict regex was
     letting those slip past as "no numbers found".

     Strip commas before parseFloat for "₹1,50,000 LPA" style.

     SEMANTIC NOTE on band.walkAway: in the kernel state, walkAway is
     the candidate's FLOOR (recruiter going below this loses the
     candidate). The salary-lookup pipeline historically stored a
     RECRUITER ceiling here (= 1.1 × maxStretch), which made this
     check reject every legitimate offer below that ceiling. The
     server-side band resolver (`resolveServerBand` in negotiate-turn)
     now maps salary-lookup's `minOffer` to the kernel's `walkAway` so
     the semantics line up. The defensive `Math.min(...)` here is
     belt-and-suspenders: if anything upstream ever passes a band where
     walkAway >= maxStretch, we ignore the floor check entirely rather
     than spurious-reject every number. */
  const re = /(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d+)?)\s*(LPA|lpa|lakhs?|crore|\bcr\b)/gi;
  const effectiveFloor = band.walkAway < band.maxStretch ? band.walkAway : -Infinity;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    if (/cr/i.test(m[2])) n *= 100;
    if (n > band.maxStretch + 0.01 || n < effectiveFloor - 0.01) return n;
  }
  return null;
}

/** Verbatim-repeat check. The LLM occasionally regenerates the
 *  identical question two turns in a row; this catches it without
 *  relying on Jaccard tuning. Returns true when both texts have a
 *  matching 8-content-word prefix AND both have at least that many
 *  content words. The min-length guard avoids false positives on very
 *  short closers like "Sounds good." which legitimately repeat across
 *  turns. */
const FINGERPRINT_WORDS = 8;
const MIN_CONTENT_WORDS = 4;

export function isVerbatimRepeat(text: string, state: NegotiationState): boolean {
  if (!state.lastAiText || !text) return false;
  const a = fingerprintWords(text);
  const b = fingerprintWords(state.lastAiText);
  /* Min-length guard: trivial closers ("Sounds good.", "Right.") can't
     trigger a verbatim flag — they have <4 content words and may
     legitimately repeat across turns. */
  if (a.length < MIN_CONTENT_WORDS || b.length < MIN_CONTENT_WORDS) return false;
  return a.slice(0, FINGERPRINT_WORDS).join(" ") === b.slice(0, FINGERPRINT_WORDS).join(" ");
}

const STOP_WORDS = new Set([
  "the","a","an","is","are","be","you","your","i","we","our","that","this","of","to","for",
  "and","or","but","with","what","how","do","does","can","could","would","should","let","me",
  "just","in","on","at","by","as","so","if","like","than","then","its","it","ll","ve","re",
]);

function fingerprintWords(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/* ─── Serialization ──────────────────────────────────────────────── */

/* JSON-safe state for over-the-wire transit. Sets/Maps and `readonly`
   round-trip cleanly because NegotiationState uses plain arrays. */
export function serializeState(state: NegotiationState): string {
  return JSON.stringify(state);
}

const VALID_PHASES: ReadonlySet<NegotiationPhase> = new Set<NegotiationPhase>([
  "opening",
  "offer-presented",
  "probe-expectations",
  "counter-offer",
  "lever-explore",
  "closing-push",
  "accepted",
  "walked-away",
  "stalemate",
]);

const VALID_LEVERS: ReadonlySet<NegotiationLever> = new Set<NegotiationLever>([
  "open-with-offer",
  "probe",
  "counter-base",
  "joining-bonus",
  "equity-grant",
  "notice-buyout",
  "benefits-summary",
  "hold-firm",
  "close-acceptance",
  "close-walkaway",
  "close-stalemate",
]);

function isFiniteNonNegInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && Number.isInteger(n);
}
function isFiniteNumOrNull(n: unknown): n is number | null {
  return n === null || (typeof n === "number" && Number.isFinite(n));
}

/** Throws if `state` is not a structurally valid NegotiationState. The
 *  route relies on this — malformed/out-of-sequence state from the
 *  client must not silently flow into applyCandidateAnswer. */
export function validateState(state: unknown): asserts state is NegotiationState {
  if (!state || typeof state !== "object") throw new Error("state: not an object");
  const s = state as Record<string, unknown>;
  if (typeof s.sessionId !== "string" || !s.sessionId) throw new Error("state.sessionId");
  if (typeof s.role !== "string") throw new Error("state.role");
  if (typeof s.company !== "string") throw new Error("state.company");
  const band = s.band as Record<string, unknown> | undefined;
  if (!band || typeof band !== "object") throw new Error("state.band");
  if (typeof band.initialOffer !== "number" || !Number.isFinite(band.initialOffer)) throw new Error("state.band.initialOffer");
  if (typeof band.maxStretch !== "number" || !Number.isFinite(band.maxStretch)) throw new Error("state.band.maxStretch");
  if (typeof band.walkAway !== "number" || !Number.isFinite(band.walkAway)) throw new Error("state.band.walkAway");
  if (typeof band.hasEquity !== "boolean") throw new Error("state.band.hasEquity");
  if (typeof s.phase !== "string" || !VALID_PHASES.has(s.phase as NegotiationPhase)) throw new Error("state.phase");
  if (!isFiniteNonNegInt(s.turnIndex)) throw new Error("state.turnIndex");
  if (!isFiniteNonNegInt(s.maxTurns) || s.maxTurns === 0) throw new Error("state.maxTurns");
  if (s.turnIndex > s.maxTurns + 1) throw new Error("state.turnIndex exceeds maxTurns");
  if (!isFiniteNumOrNull(s.candidateTarget)) throw new Error("state.candidateTarget");
  if (!isFiniteNumOrNull(s.candidateCurrentCtc)) throw new Error("state.candidateCurrentCtc");
  if (!isFiniteNumOrNull(s.competingOffer)) throw new Error("state.competingOffer");
  if (typeof s.highestOfferMade !== "number" || !Number.isFinite(s.highestOfferMade)) throw new Error("state.highestOfferMade");
  if (!Array.isArray(s.leversUsed) || !s.leversUsed.every((l) => typeof l === "string" && VALID_LEVERS.has(l as NegotiationLever))) {
    throw new Error("state.leversUsed");
  }
  if (typeof s.lastAiText !== "string") throw new Error("state.lastAiText");
  /* Phase 28 — sticky JB amount. Optional for back-compat with legacy
     in-flight sessions; deserializeState backfills to null. */
  if (s.lastJoiningBonusOffered !== undefined && !isFiniteNumOrNull(s.lastJoiningBonusOffered)) {
    throw new Error("state.lastJoiningBonusOffered");
  }
  if (s.acceptedAtTurn !== null && !isFiniteNonNegInt(s.acceptedAtTurn)) throw new Error("state.acceptedAtTurn");
  if (s.walkedAwayAtTurn !== null && !isFiniteNonNegInt(s.walkedAwayAtTurn)) throw new Error("state.walkedAwayAtTurn");
  /* Backward-compatible optional fields: tolerate absence (older
     in-flight sessions) but reject malformed values. deserializeState
     backfills defaults so the rest of the kernel sees a fully-shaped
     state. */
  if (s.finalOfferAssertedCount !== undefined && !isFiniteNonNegInt(s.finalOfferAssertedCount)) throw new Error("state.finalOfferAssertedCount");
  if (s.candidateAskedAsRange !== undefined && typeof s.candidateAskedAsRange !== "boolean") throw new Error("state.candidateAskedAsRange");
  if (s.vossTacticsUsed !== undefined && !(Array.isArray(s.vossTacticsUsed) && s.vossTacticsUsed.every((v) => typeof v === "string"))) throw new Error("state.vossTacticsUsed");
  if (s.infoAsked !== undefined && !(Array.isArray(s.infoAsked) && s.infoAsked.every((v) => typeof v === "string"))) throw new Error("state.infoAsked");
  if (s.verbalAcceptanceTurn !== undefined && s.verbalAcceptanceTurn !== null && !isFiniteNonNegInt(s.verbalAcceptanceTurn)) throw new Error("state.verbalAcceptanceTurn");
  if (s.postVerbalRenegotiationCount !== undefined && !isFiniteNonNegInt(s.postVerbalRenegotiationCount)) throw new Error("state.postVerbalRenegotiationCount");
  if (s.recentRecoveryActive !== undefined && typeof s.recentRecoveryActive !== "boolean") throw new Error("state.recentRecoveryActive");
  if (s.walkAwayReturned !== undefined && typeof s.walkAwayReturned !== "boolean") throw new Error("state.walkAwayReturned");
  if (s.hardBandCap !== undefined && typeof s.hardBandCap !== "boolean") throw new Error("state.hardBandCap");
  if (s.marketMode !== undefined && s.marketMode !== "soft" && s.marketMode !== "neutral" && s.marketMode !== "hot") throw new Error("state.marketMode");
  if (
    s.recruiterPersona !== undefined &&
    s.recruiterPersona !== "hardline" &&
    s.recruiterPersona !== "consultative" &&
    s.recruiterPersona !== "founder" &&
    s.recruiterPersona !== "agency"
  ) {
    throw new Error("state.recruiterPersona");
  }
  if (s.candidateComponentBreakdown !== undefined) {
    const cb = s.candidateComponentBreakdown as Record<string, unknown>;
    if (!cb || typeof cb !== "object") throw new Error("state.candidateComponentBreakdown");
    for (const k of ["base", "variable", "equity"] as const) {
      if (!isFiniteNumOrNull(cb[k])) throw new Error(`state.candidateComponentBreakdown.${k}`);
    }
    if (typeof cb.hasAny !== "boolean") throw new Error("state.candidateComponentBreakdown.hasAny");
  }
  /* Phase 11–16 optional fields. Tolerate absence on legacy in-flight
     sessions; deserializeState backfills. Reject only malformed
     shapes. Lightweight checks — we don't enum-validate every value,
     just structural shape, because adversarial state authorship is
     already gated by the route auth + idempotency. */
  if (s.hikePercent !== undefined && !isFiniteNumOrNull(s.hikePercent)) {
    throw new Error("state.hikePercent");
  }
  if (s.rationale !== undefined && s.rationale !== null) {
    const r = s.rationale as Record<string, unknown>;
    if (typeof r !== "object" || typeof r.kind !== "string" || typeof r.evidence !== "string") {
      throw new Error("state.rationale");
    }
  }
  if (s.noticeJoining !== undefined) {
    const nj = s.noticeJoining as Record<string, unknown>;
    if (!nj || typeof nj !== "object") throw new Error("state.noticeJoining");
    if (!isFiniteNumOrNull(nj.noticePeriodDays)) throw new Error("state.noticeJoining.noticePeriodDays");
    if (typeof nj.buyoutRequested !== "boolean") throw new Error("state.noticeJoining.buyoutRequested");
    if (!isFiniteNumOrNull(nj.joiningBonusAsk)) throw new Error("state.noticeJoining.joiningBonusAsk");
    if (typeof nj.earlyJoinPreferred !== "boolean") throw new Error("state.noticeJoining.earlyJoinPreferred");
    if (typeof nj.hasAny !== "boolean") throw new Error("state.noticeJoining.hasAny");
  }
  if (s.equityVesting !== undefined) {
    const ev = s.equityVesting as Record<string, unknown>;
    if (!ev || typeof ev !== "object") throw new Error("state.equityVesting");
    if (!isFiniteNumOrNull(ev.vestingYears)) throw new Error("state.equityVesting.vestingYears");
    if (!isFiniteNumOrNull(ev.cliffMonths)) throw new Error("state.equityVesting.cliffMonths");
    if (ev.preference !== null && typeof ev.preference !== "string") throw new Error("state.equityVesting.preference");
    if (ev.familiarity !== null && typeof ev.familiarity !== "string") throw new Error("state.equityVesting.familiarity");
    if (typeof ev.hasAny !== "boolean") throw new Error("state.equityVesting.hasAny");
  }
  if (s.locationMode !== undefined) {
    const lm = s.locationMode as Record<string, unknown>;
    if (!lm || typeof lm !== "object") throw new Error("state.locationMode");
    if (lm.workMode !== null && typeof lm.workMode !== "string") throw new Error("state.locationMode.workMode");
    if (lm.locationCity !== null && typeof lm.locationCity !== "string") throw new Error("state.locationMode.locationCity");
    if (typeof lm.relocationRequested !== "boolean") throw new Error("state.locationMode.relocationRequested");
    if (typeof lm.relocationRefused !== "boolean") throw new Error("state.locationMode.relocationRefused");
    if (typeof lm.hasAny !== "boolean") throw new Error("state.locationMode.hasAny");
  }
  if (s.competingOfferDetail !== undefined) {
    const co = s.competingOfferDetail as Record<string, unknown>;
    if (!co || typeof co !== "object") throw new Error("state.competingOfferDetail");
    if (co.company !== null && typeof co.company !== "string") throw new Error("state.competingOfferDetail.company");
    if (co.status !== null && typeof co.status !== "string") throw new Error("state.competingOfferDetail.status");
    if (co.stage !== null && typeof co.stage !== "string") throw new Error("state.competingOfferDetail.stage");
    if (typeof co.letterShareOffered !== "boolean") throw new Error("state.competingOfferDetail.letterShareOffered");
    if (typeof co.hasAny !== "boolean") throw new Error("state.competingOfferDetail.hasAny");
  }
  /* Phase 17 optional fields — structural shape checks only. */
  if (s.decisionDeadline !== undefined) {
    const dd = s.decisionDeadline as Record<string, unknown>;
    if (!dd || typeof dd !== "object") throw new Error("state.decisionDeadline");
    if (!isFiniteNumOrNull(dd.deadlineDays)) throw new Error("state.decisionDeadline.deadlineDays");
    if (typeof dd.deadlineExplicit !== "boolean") throw new Error("state.decisionDeadline.deadlineExplicit");
    if (typeof dd.conditionalAcceptance !== "boolean") throw new Error("state.decisionDeadline.conditionalAcceptance");
    if (dd.conditionalEvidence !== null && typeof dd.conditionalEvidence !== "string") throw new Error("state.decisionDeadline.conditionalEvidence");
    if (typeof dd.hasAny !== "boolean") throw new Error("state.decisionDeadline.hasAny");
  }
  /* Phase 29 — role-applicable YOE. All three optional + null-tolerant
   * for back-compat with in-flight sessions. */
  if (s.candidateTotalYoe !== undefined && !isFiniteNumOrNull(s.candidateTotalYoe)) {
    throw new Error("state.candidateTotalYoe");
  }
  if (s.candidateApplicableYoe !== undefined && !isFiniteNumOrNull(s.candidateApplicableYoe)) {
    throw new Error("state.candidateApplicableYoe");
  }
  if (
    s.candidatePrimaryDomain !== undefined &&
    s.candidatePrimaryDomain !== null &&
    typeof s.candidatePrimaryDomain !== "string"
  ) {
    throw new Error("state.candidatePrimaryDomain");
  }
  if (s.candidateProfile !== undefined) {
    const cp = s.candidateProfile as Record<string, unknown>;
    if (!cp || typeof cp !== "object") throw new Error("state.candidateProfile");
    if (!isFiniteNumOrNull(cp.careerGapMonths)) throw new Error("state.candidateProfile.careerGapMonths");
    if (cp.careerGapActivity !== null && typeof cp.careerGapActivity !== "string") throw new Error("state.candidateProfile.careerGapActivity");
    if (cp.tenureSignal !== null && typeof cp.tenureSignal !== "string") throw new Error("state.candidateProfile.tenureSignal");
    if (cp.levelMismatch !== null && typeof cp.levelMismatch !== "string") throw new Error("state.candidateProfile.levelMismatch");
    if (typeof cp.hasAny !== "boolean") throw new Error("state.candidateProfile.hasAny");
  }
  if (s.miscSignals !== undefined) {
    const ms = s.miscSignals as Record<string, unknown>;
    if (!ms || typeof ms !== "object") throw new Error("state.miscSignals");
    if (!isFiniteNumOrNull(ms.candidateFloor)) throw new Error("state.miscSignals.candidateFloor");
    if (!isFiniteNumOrNull(ms.salaryReviewMonths)) throw new Error("state.miscSignals.salaryReviewMonths");
    if (ms.proofOfCtcShareable !== null && typeof ms.proofOfCtcShareable !== "boolean") throw new Error("state.miscSignals.proofOfCtcShareable");
    if (ms.internalCounterRisk !== null && typeof ms.internalCounterRisk !== "string") throw new Error("state.miscSignals.internalCounterRisk");
    if (typeof ms.hasAny !== "boolean") throw new Error("state.miscSignals.hasAny");
  }
  /* Phase 18 — candidate stance. Optional for backwards-compat. */
  if (s.candidateStance !== undefined) {
    const cs = s.candidateStance as Record<string, unknown>;
    if (!cs || typeof cs !== "object") throw new Error("state.candidateStance");
    if (cs.flexibilityPosture !== null && typeof cs.flexibilityPosture !== "string") {
      throw new Error("state.candidateStance.flexibilityPosture");
    }
    for (const k of ["marketReferenceVague", "salaryOnlyFactor", "badmouthsCurrent", "confidentialOvershare", "soundsDesperate", "treatsEquityAsCash", "hasAny"] as const) {
      if (typeof cs[k] !== "boolean") throw new Error(`state.candidateStance.${k}`);
    }
    /* Phase 19 — corpus-derived stance booleans. Optional for back-compat. */
    for (const k of ["avoidsAnchor", "personalExpenseJustification", "offerShoppingDemand", "dismissesVariableRisk", "overpromisesJoining"] as const) {
      if (cs[k] !== undefined && typeof cs[k] !== "boolean") throw new Error(`state.candidateStance.${k}`);
    }
  }
  /* conversationLog: optional for backwards compat with in-flight
     sessions; when present, every entry must have speaker ∈ {ai, candidate}
     and a string text. */
  if (s.conversationLog !== undefined) {
    if (!Array.isArray(s.conversationLog)) throw new Error("state.conversationLog");
    for (const e of s.conversationLog) {
      const entry = e as Record<string, unknown>;
      if (!entry || typeof entry !== "object") throw new Error("state.conversationLog entry");
      if (entry.speaker !== "ai" && entry.speaker !== "candidate") throw new Error("state.conversationLog.speaker");
      if (typeof entry.text !== "string") throw new Error("state.conversationLog.text");
    }
  }
}

export function deserializeState(json: string): NegotiationState {
  const parsed: unknown = JSON.parse(json);
  validateState(parsed);
  /* Backfill defaults for optional fields added after the wire format
     was first deployed. Existing in-flight sessions serialized without
     these keys; we default them on read so the rest of the kernel can
     assume they exist. */
  const s = parsed as NegotiationState & Partial<Record<string, unknown>>;
  return {
    ...parsed,
    candidateAskedAsRange: s.candidateAskedAsRange ?? false,
    firstAnchoredTarget:
      typeof s.firstAnchoredTarget === "number"
        ? s.firstAnchoredTarget
        : (s.candidateTarget as number | null) ?? null,
    finalOfferAssertedCount: s.finalOfferAssertedCount ?? 0,
    vossTacticsUsed: (s.vossTacticsUsed as VossTactic[] | undefined) ?? [],
    infoAsked: (s.infoAsked as InfoIntent[] | undefined) ?? [],
    verbalAcceptanceTurn: s.verbalAcceptanceTurn ?? null,
    postVerbalRenegotiationCount: (s.postVerbalRenegotiationCount as number | undefined) ?? 0,
    recentRecoveryActive: (s.recentRecoveryActive as boolean | undefined) ?? false,
    walkAwayReturned: s.walkAwayReturned ?? false,
    hardBandCap: s.hardBandCap ?? false,
    marketMode: (s.marketMode as MarketMode | undefined) ?? "neutral",
    recruiterPersona: (s.recruiterPersona as RecruiterPersona | undefined) ?? "consultative",
    conversationLog: (s.conversationLog as NegotiationState["conversationLog"] | undefined) ?? [],
    candidateComponentBreakdown: (s.candidateComponentBreakdown as ComponentBreakdown | undefined)
      ?? { base: null, variable: null, equity: null, hasAny: false },
    hikePercent: (s.hikePercent as number | null | undefined) ?? null,
    rationale: (s.rationale as RationaleResult | null | undefined) ?? null,
    noticeJoining: backfillNoticeJoining(s.noticeJoining),
    equityVesting: backfillEquityVesting(s.equityVesting),
    locationMode: (s.locationMode as LocationModeResult | undefined) ?? {
      workMode: null, locationCity: null, relocationRequested: false, relocationRefused: false, hasAny: false,
    },
    competingOfferDetail: backfillCompetingOfferDetail(s.competingOfferDetail),
    decisionDeadline: (s.decisionDeadline as DecisionDeadlineResult | undefined) ?? {
      deadlineDays: null, deadlineExplicit: false, conditionalAcceptance: false, conditionalEvidence: null, hasAny: false,
    },
    candidateProfile: backfillCandidateProfile(s.candidateProfile),
    miscSignals: (s.miscSignals as MiscSignalsResult | undefined) ?? {
      candidateFloor: null, salaryReviewMonths: null, proofOfCtcShareable: null, internalCounterRisk: null, hasAny: false,
    },
    candidateStance: backfillCandidateStance(s.candidateStance),
    lastJoiningBonusOffered: (s.lastJoiningBonusOffered as number | null | undefined) ?? null,
    salesOTE: (s.salesOTE as SalesOTEResult | undefined) ?? { ...EMPTY_SALES_OTE },
    contractRate: (s.contractRate as ContractRateResult | undefined) ?? { ...EMPTY_CONTRACT_RATE },
    retentionCounter: (s.retentionCounter as RetentionCounterResult | undefined) ?? { ...EMPTY_RETENTION_COUNTER },
    /* Phase 29 — role-applicable YOE. Optional for back-compat with
     * in-flight sessions serialized before this field shipped. */
    candidateTotalYoe: (s.candidateTotalYoe as number | null | undefined) ?? null,
    candidateApplicableYoe: (s.candidateApplicableYoe as number | null | undefined) ?? null,
    candidatePrimaryDomain: (s.candidatePrimaryDomain as string | null | undefined) ?? null,
  };
}

/* Phase 27 — competingOfferDetail.onHold was added after the wire format
 * first deployed. Legacy in-flight sessions serialized this without the
 * onHold key; backfill it. */
function backfillCompetingOfferDetail(raw: unknown): CompetingOfferDetail {
  const v = raw as Partial<CompetingOfferDetail> | undefined;
  return {
    company: v?.company ?? null,
    status: v?.status ?? null,
    stage: v?.stage ?? null,
    letterShareOffered: v?.letterShareOffered ?? false,
    onHold: v?.onHold ?? false,
    hasAny: v?.hasAny ?? false,
  };
}

/* Phase 25b — domainPivot / transferableSkillsClaimed / compensationHistoryIssue
 * were added after the wire format first deployed. Legacy in-flight
 * sessions serialized candidateProfile without these keys; backfill them. */
function backfillCandidateProfile(raw: unknown): CandidateProfileResult {
  const v = raw as Partial<CandidateProfileResult> | undefined;
  return {
    careerGapMonths: v?.careerGapMonths ?? null,
    careerGapActivity: v?.careerGapActivity ?? null,
    tenureSignal: v?.tenureSignal ?? null,
    levelMismatch: v?.levelMismatch ?? null,
    domainPivot: v?.domainPivot ?? false,
    transferableSkillsClaimed: v?.transferableSkillsClaimed ?? false,
    compensationHistoryIssue: v?.compensationHistoryIssue ?? null,
    serviceBondAccepted: v?.serviceBondAccepted ?? false,
    probationCompMentioned: v?.probationCompMentioned ?? false,
    hasAny: v?.hasAny ?? false,
  };
}

/* Phase 19 — corpus-derived stance fields were added after the wire
 * format first deployed. Legacy in-flight sessions serialized
 * candidateStance without these keys; backfill them. */
function backfillCandidateStance(raw: unknown): CandidateStanceResult {
  const v = raw as Partial<CandidateStanceResult> | undefined;
  return {
    flexibilityPosture: v?.flexibilityPosture ?? null,
    marketReferenceVague: v?.marketReferenceVague ?? false,
    salaryOnlyFactor: v?.salaryOnlyFactor ?? false,
    badmouthsCurrent: v?.badmouthsCurrent ?? false,
    confidentialOvershare: v?.confidentialOvershare ?? false,
    soundsDesperate: v?.soundsDesperate ?? false,
    treatsEquityAsCash: v?.treatsEquityAsCash ?? false,
    avoidsAnchor: v?.avoidsAnchor ?? false,
    personalExpenseJustification: v?.personalExpenseJustification ?? false,
    offerShoppingDemand: v?.offerShoppingDemand ?? false,
    dismissesVariableRisk: v?.dismissesVariableRisk ?? false,
    overpromisesJoining: v?.overpromisesJoining ?? false,
    hasAny: v?.hasAny ?? false,
  };
}

/* Phase 17D — joiningBonusClawbackDiscussed + lastWorkingDayText were
 * added after the wire format first deployed. Legacy in-flight sessions
 * serialized noticeJoining without these keys; backfill them. */
function backfillNoticeJoining(raw: unknown): NoticeJoiningResult {
  const v = raw as Partial<NoticeJoiningResult> | undefined;
  return {
    noticePeriodDays: v?.noticePeriodDays ?? null,
    buyoutRequested: v?.buyoutRequested ?? false,
    joiningBonusAsk: v?.joiningBonusAsk ?? null,
    earlyJoinPreferred: v?.earlyJoinPreferred ?? false,
    joiningBonusClawbackDiscussed: v?.joiningBonusClawbackDiscussed ?? false,
    lastWorkingDayText: v?.lastWorkingDayText ?? null,
    hasAny: v?.hasAny ?? false,
  };
}

/* Phase 17E — strikePriceDiscussed / valuationDiscussed /
 * liquidityDiscussed were added after the wire format first deployed.
 * Legacy in-flight sessions serialized equityVesting without these
 * keys; backfill them. */
function backfillEquityVesting(raw: unknown): EquityVestingResult {
  const v = raw as Partial<EquityVestingResult> | undefined;
  return {
    vestingYears: v?.vestingYears ?? null,
    cliffMonths: v?.cliffMonths ?? null,
    preference: v?.preference ?? null,
    familiarity: v?.familiarity ?? null,
    strikePriceDiscussed: v?.strikePriceDiscussed ?? false,
    valuationDiscussed: v?.valuationDiscussed ?? false,
    liquidityDiscussed: v?.liquidityDiscussed ?? false,
    hasAny: v?.hasAny ?? false,
  };
}
