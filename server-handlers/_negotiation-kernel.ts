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
import { classifyAcceptance, detectExplicitAcceptance } from "./_acceptance-classifier";
import { extractRecruiterFacts, extractRecruiterPromises, extractPromisesFulfilled } from "./_recruiter-facts";
import { extractNonSalaryConstraints, mergeNonSalaryConstraints } from "./_non-salary-constraints";
import { buildPostAcceptanceMessage } from "./_post-acceptance";
import { detectInHandFraming, backComputeCtcFromInHand } from "./_in-hand-vs-ctc";
import { detectRangeDisclosure, detectTrialCloseAsked } from "./_trial-close-detector";
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
  detectFreshGradDisclosure,
  EMPTY_CANDIDATE_PROFILE,
  type CandidateProfileResult,
} from "./_candidate-profile";
import { resolveServerBand } from "./_band-resolver";
import {
  detectCandidateDisclosures,
  pruneAcknowledged,
} from "./_candidate-disclosure-tracker";
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
import {
  EMPTY_DISCOVERY_CHECKLIST,
  backfillDiscoveryChecklist,
  isValidDiscoveryStage,
  isDiscoveryComplete,
  syncChecklistFromParsedFacts,
  type DiscoveryChecklist,
  type DiscoveryStage,
} from "./_discovery-stage";
import { classifyRoleFamily } from "./_company-band-tiers";
import { getNextActionPlanner } from "./_planner-registry";

/* ─── Commit 4 (2026-05-15) — planner-registry refactor ───────────────
 * The planner module (_next-action-planner.ts) imports value bindings
 * from this kernel; a static import the other way would create a
 * load-order cycle. We break the cycle through a third module
 * (_planner-registry.ts) that has no imports of either side. The kernel
 * READS through `getNextActionPlanner()` and the planner REGISTERS via
 * `registerNextActionPlanner(...)` at module-bottom.
 *
 * Replaces the prior commit 3 globalThis workaround (load-order kludge
 * that buried the dependency in a runtime side-effect on globalThis).
 * Same call-graph shape, properly typed module edges:
 *
 *   kernel ──▶ planner-registry ◀── planner
 *
 * The registry's getter returns null while the planner module hasn't
 * loaded yet — callers (applyCandidateAnswer's finalize()) tolerate
 * null gracefully (state.plannedNextAction stays null on that turn). */
function _callNextActionPlanner(s: unknown): unknown {
  const fn = getNextActionPlanner();
  return fn ? fn(s) : null;
}

/* ─── Phases ──────────────────────────────────────────────────────── */

export type NegotiationPhase =
  /* Pre-offer — AI hasn't put a number on the table yet. */
  | "opening"
  /* Ordered discovery is complete but no specific anchor has been
   * disclosed yet — the AI must volunteer a salary RANGE (e.g.
   * "₹X-Y band") before converging to a single number. PDF#18
   * follow-up (2026-05-15): promoted from a soft brief-only directive
   * into a real phase enum value so the state-machine + move-picker
   * + validator enforce it. */
  | "range-disclosure"
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

/* Negotiation-flow redesign commit 6 (2026-05-15) — phase-transition
 * monotonicity matrix (kills D6 from /tmp/negotiation-flow-audit.md).
 *
 * Phases form a one-way ratchet. Higher rank can only go higher (or stay
 * the same). Backward transitions are blocked structurally, except for
 * two LEGITIMATE re-open paths:
 *   1. walk-away-reopen — terminal `walked-away` → `counter-offer` when
 *      the candidate re-engages (the `walkAwayReturned` flag is set in
 *      applyCandidateAnswer). This is the only path out of any terminal
 *      phase and is a one-shot re-entry.
 *   2. verbal-renege — `verbalAcceptanceTurn` is set (candidate said yes
 *      and then re-opened). Only the move-picker stiffens; phase wants
 *      to stay in `counter-offer` while the bot stiffens, and any
 *      derivation that would otherwise compute a "lower" target phase
 *      should be allowed to land on counter-offer.
 *
 * Terminal phases share rank so they never transition between each
 * other except via the walk-away-reopen exception. The two non-walk-away
 * terminals (accepted / stalemate) are absorbing under normal flow.
 *
 * Removes the prior ad-hoc sticky clauses (POST_PROBE_PHASES /
 * isPostProbe / alreadyProbed) inside derivePhase — once monotonicity
 * is structural, those one-off `if` clauses become unnecessary. */
const PHASE_RANK: Record<NegotiationPhase, number> = {
  "opening": 0,
  "range-disclosure": 1,
  "offer-presented": 2,
  "probe-expectations": 3,
  "counter-offer": 4,
  "lever-explore": 5,
  "closing-push": 6,
  "accepted": 7,
  "walked-away": 7,
  "stalemate": 7,
};

export function canTransitionPhase(
  from: NegotiationPhase,
  to: NegotiationPhase,
  state: NegotiationState,
): boolean {
  if (PHASE_RANK[to] >= PHASE_RANK[from]) return true;
  /* Exception 1: walk-away reopen — `walkAwayReturned` is set inside
   * applyCandidateAnswer when a candidate re-engages after `walked-away`.
   * The reopen path explicitly hops phase to `counter-offer`; subsequent
   * derivations that produce `counter-offer` (or higher) are fine via
   * the rank check above, but any derivation that produces a LOWER
   * phase (e.g. `probe-expectations`) while reopened should still be
   * allowed to clamp into `counter-offer` rather than getting stuck. */
  if (state.walkAwayReturned && to === "counter-offer") return true;
  /* Exception 2: verbal-renege — `verbalAcceptanceTurn` is set when the
   * candidate previously said yes but is now asking for more. The state-
   * machine intentionally keeps us in `counter-offer` while the move-
   * picker stiffens. If derivation produces `counter-offer` and we're
   * sitting in a higher phase like `lever-explore` or `closing-push`,
   * permit the regression so the stiffening path runs cleanly. */
  if (state.verbalAcceptanceTurn != null && to === "counter-offer") return true;
  return false;
}

/* ─── Levers ─────────────────────────────────────────────────────── */

export type NegotiationLever =
  | "open-with-offer"   // initial offer presentation
  | "probe"             // ask what they want
  /* Bug-report 15 (2026-05-14) — fire ONCE before the first counter-base
   * when the candidate has anchored materially above initialOffer. Real
   * HR never moves money without first asking what's driving the number
   * (benchmark? competing offer? current-package hike math?). The probe
   * is a one-shot: kernel records it in leversUsed so the next turn
   * proceeds with counter-base regardless of the candidate's follow-up. */
  | "probe-justification"
  | "counter-base"      // bump base
  | "joining-bonus"     // one-time
  | "equity-grant"      // RSU/ESOP top-up
  | "notice-buyout"     // buy out notice period
  | "benefits-summary"  // recap non-cash
  | "compensation-summary" // disclose company comp STRUCTURE (base/var/equity ratios, bonus freq, vesting) — session 12 bug fix 2026-05-14
  | "notice-period-summary" // disclose company notice / start-date / buyout policy — audit Session C 2026-05-14
  | "hike-context-summary"  // surface hike% delta + Indian market context — audit Session C 2026-05-14
  | "hold-firm"         // explicit "this is final"
  | "close-acceptance"  // wrap with agreed terms
  | "close-walkaway"    // wrap acknowledging no-deal
  | "close-stalemate"   // wrap acknowledging out of turns
  /* Re-served wrap when the candidate keeps talking AFTER a terminal
   * phase was reached. Distinct from close-acceptance so we can tell in
   * telemetry / tests that this turn is a sticky restate, not a fresh
   * transition. Always carries terminal=true in the response payload. */
  | "terminal-restate";

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
  /** Fresher-flow extension (2026-05-14). Set ONLY for IT-services tier
   *  entry-level offers — real recruiters at TCS / Infosys / Wipro pay a
   *  reduced rate during the 6-month probation period (typically ~90%
   *  of confirmed CTC), then step up to `initialOffer` on confirmation.
   *  Surfacing this on the band lets the opener explicitly break the
   *  number into "₹X during 6-month probation → ₹Y on confirmation"
   *  instead of quoting a single flat figure the candidate is then
   *  surprised by on joining. Unset for all other tiers. */
  probationOffer?: number;
  probationMonths?: number;
  /** Fresher-flow extension (2026-05-14). True when the candidate is
   *  applying for an INTERNSHIP (not a full-time fresher role). Tagged
   *  on the band by `_band-resolver` after detecting "intern" /
   *  "internship" in the original role string. When set, the band
   *  numbers represent monthly stipend × 12 (annualized stipend), NOT
   *  full-time CTC — the LLM must frame the offer accordingly
   *  ("₹X/month stipend over a 6-month internship"). */
  isInternshipStipend?: boolean;
  internshipMonths?: number;
}

/* ─── Canonical State ────────────────────────────────────────────── */

/**
 * Information items a candidate can interrogate the recruiter about.
 * Tracked as a set on state so we don't double-credit repeated asks
 * and so the move-picker can reward depth of due diligence.
 *
 * CONVENTION — two tiers of handling (see `_negotiate-turn-helpers.ts`
 * `INFO_ANSWERS` for the long-form note):
 *
 *  - STATIC ONE-LINERS (9): clawback-period, variable-history,
 *    vest-schedule, strike-price, in-hand-monthly, exercise-window,
 *    acceleration, fixed-vs-variable, perks-non-cash. Each maps to a
 *    fixed snippet in the `INFO_ANSWERS` table — no state interpolation.
 *
 *  - STATE-DERIVED BLOCKS (4): benefits-overview, compensation-breakdown,
 *    notice-period-ask, hike-percentage-ask. These have bespoke
 *    `if (state.infoAsked.includes(...))` blocks inside
 *    `buildResponseHints` that interpolate kernel state (state.company,
 *    state.highestOfferMade, state.candidateCurrentCtc, etc.) and
 *    matching lever-routing branches in `pickAiMove` (search for
 *    `wantsBenefits` / `wantsCompStructure` / `wantsNoticePolicy` /
 *    `wantsHikeContext` for the pattern).
 *
 *  - HYBRID: `package-breakdown` is handled by lever-routing in
 *    `pickAiMove` (`wantsBreakdown` → `benefits-summary` lever) and has
 *    no dedicated `INFO_ANSWERS` row — the lever itself drives the
 *    response. `fixed-vs-variable` and `perks-non-cash` appear in BOTH
 *    tiers (one-liner fallback + breakdown lever trigger).
 *
 * When adding a new intent: if it's a state-free policy snippet, add
 * a row to `INFO_ANSWERS`. If it requires kernel state, add a block to
 * `buildResponseHints` AND a routing branch to `pickAiMove`.
 */
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
  | "package-breakdown"    // generic "walk me through the package" / "break it down" — added 2026-05 after the Lollypop session where the candidate asked for the structure and the AI responded with a probe ("what range are you targeting?") instead of providing the breakdown. The existing intents were all component-specific; this catches the higher-level "explain the offer" ask.
  | "benefits-overview"    // "what are the benefits?" / "what perks do you offer?" — added 2026-05 (bug report 11 follow-up E). Distinct from `perks-non-cash` (Sodexo / gratuity lump-into-CTC trick) and from `package-breakdown` (offer-component enumeration). This is the candidate asking what's IN the benefits package — health insurance, PF, leaves, learning budget, work mode. Routed to a company-aware disclosure in the helpers layer.
  | "compensation-breakdown" // "explain the variable components" / "ESOP details?" / "what's the bonus structure?" — added 2026-05 (session 12 bug). Distinct from `package-breakdown` (offer-component enumeration of THIS offer) and `fixed-vs-variable` (just the split). This is the candidate asking about the GENERAL compensation STRUCTURE at the company — base/variable/equity ratios, bonus frequency, vesting. Routed to a company-aware compensation disclosure (data/company-compensation-structure.ts) via the response-hint layer.
  | "notice-period-ask"    // Session B (2026-05-14): candidate asking ABOUT notice / start-date / buyout — "notice period?", "when can I join?", "earliest start date?", "buyout?". Distinct from the noticeJoining EXTRACTION (candidate stating THEIR notice). An info-ask the recruiter should answer in-channel.
  | "hike-percentage-ask"; // Session B (2026-05-14): candidate asking what hike% this offer represents — "what hike is this?", "is this a 30% hike?", "% raise?". Distinct from hikeRationale (candidate justifying their ask). Recruiter should respond with the computed delta if currentCtc known.

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
  /* P35 clamp invariant (session 12 fix — 2026-05-14). Persona never
   * raises initialOffer; this preserves the 35th-percentile opening
   * anchor set at construction time in salary-lookup.ts. Defensive: if
   * future persona logic ever bumped initialOffer above the input base
   * (e.g. a "founder" boost), this clamp would catch it. */
  if (out.initialOffer > base.initialOffer) out.initialOffer = base.initialOffer;
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
  maxTurns: number;     // hard cap before stalemate (default 20)

  /* Candidate-stated facts. Folded in via applyCandidateAnswer or
     foldFactsIntoState — set ONCE per turn, never re-derived from
     transcript. Null = not stated. */
  candidateTarget: number | null;        // their ask (LPA, last-stated-wins)
  /** Bug-report 12 (2026-05-14) — the numeric counter the candidate
   *  parsed THIS turn (LPA). Distinct from `candidateTarget` which is
   *  sticky from intake / earliest anchor; this field is the per-turn
   *  fresh-counter signal. Set in applyCandidateAnswer when parsed.target
   *  is non-null AND differs from the prior sticky candidateTarget (so
   *  re-asserting the same number doesn't count as a "fresh" counter).
   *  Cleared by applyAiMove so it never bleeds into the next AI turn.
   *  Used by the auto-accept gate so a stale intake target can NEVER
   *  close the AI below highestOfferMade without an in-turn counter. */
  lastCandidateCounterLpa: number | null;
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

  /* perfect 1 (2026-05-16) — multi-turn negotiation spiral. Counts the
   * number of counter-offer moves the AI has shipped this session.
   * Incremented in applyAiMove when move.lever === "counter-base".
   * Read by the planner's counter-offer construction path to apply a
   * diminishing-concessions multiplier (60% / 40% / 20% of the gap
   * for rounds 0/1/2; round 3+ pivots to hold-firm lever-loop). Also
   * read by canonical prose to emit a "we've already moved once"
   * acknowledgement on rounds >= 1.
   *
   * Distinct from counterCount derived from leversUsed (which the
   * existing splitSchedule already uses): counterRound is the canonical
   * authoritative counter for the spiral cadence and prose tells, kept
   * separate so we don't accidentally double-count rotation-counter and
   * spiral-counter against each other. */
  counterRound: number;

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
  /* Symmetric ledger entry for stalemate. Stamped once when derivePhase
   * first returns "stalemate"; cleared symmetrically with the others
   * when a walk-away-return reopens the session. Lets downstream
   * planners read state directly instead of proxying through
   * leversUsed.includes("close-stalemate"). */
  stalemateAtTurn?: number | null;

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

  /* Bug-report 11 (2026-05-14) — mid-session fresh-grad disclosure. The
   * candidate told us mid-conversation that they're pre-graduate / a
   * fresh grad / still in college. When true, candidateApplicableYoe is
   * forced to 0 AND the band rebases to entry-tier via resolveServerBand
   * (Phase 30, 2026-05-14) — clamped so the new ceiling is never below
   * highestOfferMade, preserving the close-floor invariant. Sticky once set. */
  freshGradDisclosed: boolean;

  /* Bug 7 (2026-05-14) — anti-repetition of recruiter benefits. Tracks
   * the set of RecruiterFactToken values that the bot has already
   * surfaced in this session. Fed back into compactTurnBrief so the
   * LLM knows not to restate them verbatim. */
  recruiterFactsAlreadySaid: string[];

  /* Fix 3 (2026-05-15) — Promise-keeping enforcement. Open promises the
   * bot has made but not yet delivered ("we can discuss X", "let me share
   * Y"). Subjects are short normalised strings; promises that get
   * fulfilled on a turn are removed. compactTurnBrief surfaces these so
   * the LLM is forced to deliver on outstanding promises. */
  pendingPromises?: string[];

  /* Fix 4 (2026-05-15) — Full-message-repetition detector. The verbatim
   * AI text the bot produced on the most recent successful turn. Word-
   * shingle Jaccard against this drives the reroll path in negotiate-
   * turn.ts. Null on init; set in applyAiMove. */
  lastBotReply?: string | null;

  /* Fix 7 (2026-05-15) — Anchor recomputation suppression. In a real
   * session the initial anchor jumped from ₹34L on turn 1 to ₹24L on
   * turn 2 with no candidate action — band.initialOffer was being
   * re-derived per turn. Once the recruiter discloses the opening
   * anchor, this flag locks band.initialOffer for the remainder of
   * the session: subsequent rebases may move maxStretch / walkAway
   * but never reset initialOffer downward. Default false; toggled to
   * true on the first turn that reveals a comp number. */
  anchorLocked?: boolean;
  /** Fix 7 (2026-05-15) — the locked anchor value (LPA) for this
   *  session. Set when anchorLocked transitions false → true. */
  lockedAnchorLpa?: number | null;

  /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard.
   * Real session ended after ~6 turns with "View Result" button, no
   * resolution. Block ANY transition to a terminal phase before this
   * turn count unless the candidate explicitly declined OR
   * MAX_TURNS_PER_SESSION is hit. Default 8. */
  minTurnsBeforeClose?: number;

  /* PDF #17 architectural fix (2026-05-15) — discovery-first state
   * machine. The recruiter MUST collect a minimum bar of discovery
   * items (current CTC, fixed/variable split, notice period,
   * competing offers, role-specific value proof, target CTC) BEFORE
   * disclosing an anchor band. The checklist tracks ask/answer pairs
   * per item. Optional for back-compat with in-flight sessions;
   * deserializeState backfills via backfillDiscoveryChecklist. */
  discoveryChecklist?: import("./_discovery-stage").DiscoveryChecklist;

  /* PDF #17 architectural fix (2026-05-15) — explicit discovery-first
   * stage machine layered on top of the existing phase machine. The
   * legacy `phase` field remains the authoritative kernel state; this
   * `discoveryStage` runs in parallel as an informational signal for
   * compactTurnBrief and the move-picker. Optional for back-compat. */
  discoveryStage?: import("./_discovery-stage").DiscoveryStage;

  /* Tier-2 ship (2026-05-15) — non-salary constraints. Hard, non-comp asks
   * that materially change the recruiter's playbook (WFH days, parent-care
   * location lock, specific office). Captured as a single optional object
   * to avoid the 9-site fanout pattern: new constraint fields land as keys
   * here, not as new top-level state fields. */
  nonSalaryConstraints?: import("./_non-salary-constraints").NonSalaryConstraints;

  /* Tier-? ship (2026-05-15) — post-acceptance onboarding message. Built
   * once when the kernel transitions to `accepted` (or soft-accept), so
   * the response layer can concatenate it onto the close turn rather than
   * have the LLM improvise onboarding language. Pure derived; sticky once
   * set so a follow-up terminal restate still surfaces it. Optional for
   * back-compat. */
  postAcceptanceMessage?: string;

  /* Sprint A.4 (2026-05-15) — current employer (free-form, normalized
   * downstream). Detected from utterances; threaded into the
   * counter-offer-risk detector so the well-funded-employer signal can
   * fire. Optional for back-compat. */
  currentEmployer?: string;

  /* Sprint B.2 (2026-05-15) — refusal-count tracker for the number
   * discipline gate. Increments when the candidate dodges a probe for
   * their expectation. Optional. */
  probeRefusalCount?: number;

  /* PDF#18 follow-up (2026-05-15) — range-disclosure phase enum.
   * Records the turnIndex at which the bot first emitted a salary
   * RANGE (e.g. "₹18-22L band"). Set in applyAiMove when
   * detectRangeDisclosure fires on the bot text. derivePhase uses this
   * to transition out of the new "range-disclosure" phase once the
   * candidate has reacted (one turn later). Optional for back-compat. */
  rangeDisclosedAtTurn?: number | null;

  /* PDF#18 follow-up (2026-05-15) — current-vs-expected split
   * disambiguation. Records the subject of the LAST discovery question
   * the bot asked, so when the candidate then provides a "fixed +
   * variable" split utterance, the detector knows whether to flag it
   * against currentCtcFixedVariableSplitDisclosed (subject='current')
   * or expectedCtcFixedVariableSplitDisclosed (subject='expected').
   * Set in applyAiMove from move.rationale (which carries the next
   * ordered-discovery item key). Optional. */
  lastDisclosureSubject?: "current" | "expected" | null;

  /* P4 (2026-05-15) — per-item refusal tracking for the refusal-fallback
   * path in getNextOrderedDiscoveryItem. When the candidate refuses an
   * item ≥2 times, the kernel skips it and moves to the next ordered
   * item. Keys are DiscoverySequenceItem values; values true once the
   * item has been refused enough times. Optional. */
  discoveryRefusedItems?: Record<string, boolean>;

  /* P4 (2026-05-15) — the discovery sequence item the bot just asked
   * about (set in applyAiMove from move.rationale). Used by
   * applyCandidateAnswer to attribute refusals to the correct item. */
  lastDiscoveryItemAsked?: string | null;

  /* Sprint B.3 (2026-05-15) — in-hand vs CTC anchor disambiguation. When
   * true, candidateTarget is in-hand (not CTC). The CTC-equivalent is
   * stored separately so downstream consumers can switch frames. Optional. */
  candidateTargetIsInHand?: boolean;
  candidateTargetCtcEquivalentLpa?: number;

  /* PDF #18 root-cause (2026-05-15) — candidate-disclosure acks. Tracks
   * candidate-disclosed facts (notice period, current CTC, competing
   * offer, joining date) the bot has NOT yet acknowledged. Pushed in
   * applyCandidateAnswer when a disclosure is detected; pruned in
   * applyAiMove when the bot reply addresses it. Surfaced via the
   * brief as [CANDIDATE DISCLOSED — ACKNOWLEDGE THIS TURN: ...]. */
  pendingCandidateAcks?: import("./_candidate-disclosure-tracker").CandidateDisclosureEntry[];

  /* Architectural bug-prevention (2026-05-15) — decision log. Append-only
   * record of every move the kernel picked, with rationale, phase at pick
   * time, and the bracket tags injected into the brief this turn. Lets us
   * reconstruct *why* the kernel moved as it did from final state alone,
   * which is the prerequisite for the replay harness. Optional for
   * back-compat. */
  decisionLog?: Array<{
    turn: number;
    picker: string;        // e.g. "probe-mismatch", "discovery-next", "range-disclosure", "anchor", "concession"
    rationale: string;     // short human-readable reason
    phase: NegotiationPhase;
    briefTags?: string[];  // which bracketed tags were injected this turn
  }>;

  /* Architectural bug-prevention (2026-05-15) — last-turn brief tags. Set
   * by compactTurnBrief, read by the move-picker so the decision log can
   * record which bracket-tagged directives were in front of the LLM on
   * the turn the move was chosen. One-shot per turn; cleared in applyAiMove. */
  lastBriefTags?: string[];

  /* Negotiation-flow redesign commit 1 (2026-05-15) — TurnDelta.
   * Captures WHAT CHANGED on the most recent candidate turn (folded by
   * applyCandidateAnswer) so downstream consumers can route reactively
   * ("candidate just disclosed competing offer — probe credibility")
   * instead of from accumulated state ("competing offer is set, but who
   * knows when it was set"). Cleared (null) by applyAiMove. Optional for
   * back-compat — older serialized sessions deserialize without it and
   * any consumer must null-check. */
  lastTurnDelta?: TurnDelta | null;

  /* Negotiation-flow redesign commit 3 (2026-05-15) — cached NextAction.
   * planNextAction is stamped onto state at the END of applyCandidateAnswer
   * (after phase derivation) and cleared (null) by applyAiMove. Both the
   * move-picker and compactTurnBrief read from this single field, so the
   * brief's [NEXT REQUIRED ACTION] line and the rationale on move.lever
   * cannot diverge — they're produced by the SAME planner call. Optional
   * + nullable for back-compat with sessions serialized before commit 3:
   * pickAiMoveCore replays planNextAction when the field is absent. The
   * declared type is `unknown` so this module doesn't take a runtime
   * dependency on _next-action-planner.ts (which depends on this module
   * for state types); consumers cast to NextAction. */
  plannedNextAction?: unknown | null;

  /* Negotiation-flow redesign commit 4 (2026-05-15) — reactive-followup
   * de-dupe ledger. Each reactive trigger (variable-comfort,
   * competing-credibility, notice-buyout, hike-justification,
   * answer-direct, refused-advance, fresh-grad-rebase) pushes its topic
   * here when the planner emits a reactive-followup action. Consulted
   * by the planner before re-emitting so the same probe doesn't fire
   * twice in the same session. Optional + nullable for back-compat
   * with sessions serialized before commit 4. */
  reactiveFollowupsFired?: string[];

  /* Polish 2 (2026-05-16) — per-topic fire-history (turn indices at
   * which each topic was fired). The legacy `reactiveFollowupsFired`
   * is single-fire dedup; this parallel ledger lets refireable topics
   * (tax-implication, notice-buyout, range-to-point) revisit 2-3
   * times across a session subject to a per-topic max-count + minimum
   * turn-gap, more accurately modelling how Indian candidates revisit
   * sticky topics. Consulted by canRefire() in _next-action-planner.
   * Optional + nullable for back-compat with pre-Polish-2 serialized
   * sessions. */
  reactiveFollowupsFireLog?: Record<string, number[]>;

  /* Fix 1 (2026-05-16) — leversFired ledger for Indian-context structural
   * levers (grade upgrade, retention bonus, RSU refresh, relocation,
   * perf-bonus cadence, joining-bonus explainer, band-anchor with
   * rationale). The planner consults this set during lever rotation
   * to ensure each lever fires at most once per session. Optional for
   * back-compat with sessions serialized before Fix 1. */
  leversFired?: string[];

  /* F7 (PDF#20 2026-05-15) — askedTopics repetition guard.
   * Ordered history of discovery topics the bot has asked, with the
   * turnIndex at which each ask was emitted. applyAiMove pushes here
   * whenever a move carries an askedTopic marker. planNextAction
   * consults this ledger: if the same topic appears within the last 3
   * turns, the planner skips it and advances to the next checklist item.
   * Optional for back-compat with pre-F7 serialized sessions. */
  askedTopics?: { topic: string; atTurn: number }[];

  /* ITEM 3 (2026-05-15) — Trial-close signaling.
   *
   * candidateSignaledClose: set true by applyCandidateAnswer when the
   *   bot's PREVIOUS turn contained a trial-close ask (detectTrialCloseAsked)
   *   and the candidate replied on this turn. Sticky once true. Triggers
   *   the close-confirmation reactive rule in planNextAction.
   *
   * closeFired: set true by applyAiMove when a close-acceptance or
   *   close-walkaway move is applied. Guards the reactive rule so it
   *   only fires once.
   *
   * Optional for back-compat with sessions serialized before ITEM 3. */
  candidateSignaledClose?: boolean;
  closeFired?: boolean;

  /* Kernel-first cleanup (2026-05-16) — first-class role facts. Previously
   * read via loose extension shape in _fact-pack.ts and _canonical-prose.ts.
   * Threaded through InitStateInput and copied to state at init (defaults
   * null). All optional / nullable — absent → fact pack omits them and the
   * LLM is instructed to defer. */
  workMode?: "remote" | "hybrid" | "office" | null;
  teamSize?: number | null;
  reportingTo?: string | null;
  joiningWindow?: string | null;
  /** Additional first-class role facts surfaced alongside workMode et al.
   *  perfCycle: text describing the perf-review cadence (e.g. "annual").
   *  equityStructure: text describing equity grant shape (RSU / ESOP / none). */
  perfCycle?: string | null;
  equityStructure?: string | null;
  /** Kernel-first cleanup (2026-05-16) — candidate first name. Threaded
   *  from intake so _canonical-prose.ts doesn't have to scan the
   *  conversation log to greet by name. Log-scan stays as a fallback for
   *  legacy sessions or self-introductions mid-flow. */
  candidateName?: string | null;

  /** Perfect 3 (2026-05-16) — sticky session-wide urgency level. Promoted
   *  from per-turn TurnDelta.urgencySignal via a monotone upgrade rule
   *  (firm > soft > none, never downgrades). Read by the planner — gated
   *  on discovery-complete — to bias closing-push toward close-recap-formal
   *  when the candidate has surfaced a firm deadline. Default "none". */
  cumulativeUrgency?: "none" | "soft" | "firm";
}

/* ─── Negotiation-flow redesign commit 1 (2026-05-15) — TurnDelta ────
 *
 * Diff between pre- and post-state for a single candidate utterance.
 * Populated by `computeTurnDelta(pre, post, parsed)` inside
 * `applyCandidateAnswer` and stored on `state.lastTurnDelta`. Cleared
 * by `applyAiMove`. Each field is a boolean "this kind of thing just
 * happened this turn" signal — consumers that need the actual value
 * read it from the post-state.
 *
 * Eleven disclosure categories spec'd by the negotiation-flow audit
 * (E row 1):
 *   currentCtc / expectedCtc          — comp facts (new values, not restates)
 *   fixedVariableSplit                — base+variable breakdown disclosed
 *   noticePeriod                      — notice days OR buyout signal
 *   competingOffer                    — competing-offer presence (number or vague)
 *   joiningDate                       — early-join / last-working-day signal
 *   valueProof                        — quota / portfolio / depth signal (sales/contract/profile)
 *   askedQuestion                     — candidate's utterance contains a "?" question
 *   refusedItem                       — probeRefusalCount incremented this turn
 *   freshGrad                         — first-time fresh-grad disclosure
 *   retentionCounter                  — current-employer retention counter disclosed
 */
export interface TurnDelta {
  /** Candidate disclosed a NEW currentCtc value this turn (not a restate). */
  disclosedCurrentCtc: boolean;
  /** Candidate disclosed a NEW expected/target value this turn. */
  disclosedExpectedCtc: boolean;
  /** Candidate disclosed a fixed/variable breakdown for either CTC. */
  disclosedFixedVariableSplit: boolean;
  /** Candidate disclosed notice period or notice-related signal (buyout / LWD). */
  disclosedNoticePeriod: boolean;
  /** Candidate confirmed buyout availability THIS turn (pre.buyoutRequested
   *  false → post true). Distinct from disclosedNoticePeriod which also
   *  fires on bare notice-day disclosures. Used by the reactive-rule
   *  layer to acknowledge buyout before advancing discovery. (Fix 6,
   *  2026-05-16) */
  noticeBuyoutConfirmed: boolean;
  /** Candidate disclosed a competing offer (number OR named-vague signal). */
  disclosedCompetingOffer: boolean;
  /** Candidate disclosed a joining-date / early-join signal. */
  disclosedJoiningDate: boolean;
  /** Candidate disclosed role-specific value proof (quota / ARR / portfolio / shipped systems). */
  disclosedValueProof: boolean;
  /** Candidate utterance contained a direct question ("?"). */
  askedQuestion: boolean;
  /** Structured form of the candidate question. Carries the (trimmed) raw
   *  text and a coarse intent tag so the response pipeline can decide
   *  whether to answer vs. defer without re-detecting the question. */
  candidateAskedQuestion?: { raw: string; intent?: string } | null;
  /** Candidate refused a probe this turn (probeRefusalCount incremented). */
  refusedItem: boolean;
  /** Candidate first-disclosed fresh-grad status this turn. */
  freshGradDisclosed: boolean;
  /** Candidate disclosed a retention counter from their current employer this turn. */
  retentionCounterDisclosed: boolean;
  /** Perfect 2 (2026-05-16) — coarse emotional sentiment classification of
   *  the candidate's utterance this turn. Drives an Indian-recruiter-idiom
   *  acknowledgement prefix in canonical prose for frustrated / excited /
   *  hesitant; decisive and neutral suppress the prefix (decisive needs no
   *  emotional softening, neutral needs no acknowledgement). */
  candidateSentiment?: "frustrated" | "excited" | "hesitant" | "decisive" | "neutral";
  /** Perfect 3 (2026-05-16) — time-pressure signal detected this turn.
   *  "firm" = explicit deadline ("by Friday", "deadline is Monday",
   *  "competing offer expires"); "soft" = directional movement framing
   *  ("looking to move quickly", "in final stages elsewhere"); "none" =
   *  default. Merged into the sticky state.cumulativeUrgency via
   *  applyAiMove (sticky upgrade — firm overrides soft overrides none,
   *  never downgrades within a session). */
  urgencySignal?: "none" | "soft" | "firm";
}

export const EMPTY_TURN_DELTA: TurnDelta = {
  disclosedCurrentCtc: false,
  disclosedExpectedCtc: false,
  disclosedFixedVariableSplit: false,
  disclosedNoticePeriod: false,
  noticeBuyoutConfirmed: false,
  disclosedCompetingOffer: false,
  disclosedJoiningDate: false,
  disclosedValueProof: false,
  askedQuestion: false,
  candidateAskedQuestion: null,
  refusedItem: false,
  freshGradDisclosed: false,
  retentionCounterDisclosed: false,
  candidateSentiment: "neutral",
  urgencySignal: "none",
};

/** Perfect 2 (2026-05-16) — coarse emotional sentiment classifier for
 *  the candidate's utterance. Pure regex-based heuristic on raw text.
 *  Patterns are tuned to Indian-English negotiation idiom (frustrated
 *  candidates lean on "honestly" / "frankly" hedges; excited candidates
 *  use "looking forward" / "happy with"; hesitant candidates surface
 *  family / "let me think" framings; decisive candidates use "final
 *  number" / "bottom line").
 *
 *  Priority order matters: decisive and frustrated outrank excited /
 *  hesitant when patterns collide ("honestly, this is my final number"
 *  → frustrated wins because frustration drives the prefix decision).
 *  Default is "neutral". Downstream renderSentimentPrefix suppresses
 *  the prefix for decisive + neutral. */
function detectCandidateSentiment(
  rawCandidateText: string,
): TurnDelta["candidateSentiment"] {
  if (typeof rawCandidateText !== "string" || !rawCandidateText.trim()) {
    return "neutral";
  }
  const text = rawCandidateText.toLowerCase();
  /* Multiple exclamation marks anywhere → frustrated signal. */
  const multiBang = /!\s*!/.test(rawCandidateText);
  const FRUSTRATED_RE =
    /\b(honestly|frankly|to be very honest|this is not fair|really disappointed|expected more|i don['’]?t think|lowball|very low)\b/i;
  if (multiBang || FRUSTRATED_RE.test(text)) return "frustrated";
  const DECISIVE_RE =
    /\b(final number|bottom line|non[- ]?negotiable|either way|let me be direct|straight up)\b/i;
  if (DECISIVE_RE.test(text)) return "decisive";
  const EXCITED_RE =
    /\b(looking forward|excited to join|happy with|absolutely|great|let['’]?s go ahead|let['’]?s close)\b/i;
  if (EXCITED_RE.test(text)) return "excited";
  const HESITANT_RE =
    /\b(i['’]?m not sure|need to think|let me get back|discuss with family|let me check|kind of|maybe|i suppose)\b/i;
  if (HESITANT_RE.test(text)) return "hesitant";
  return "neutral";
}

/** Perfect 3 (2026-05-16) — time-pressure / urgency signal detector.
 *
 *  Two-bucket classifier (plus default "none") tuned to how Indian
 *  candidates surface time pressure: firm signals carry an explicit
 *  date, named weekday, or "in-hand offer" framing; soft signals are
 *  directional intent without a hard deadline ("looking to move
 *  quickly", "in final stages elsewhere").
 *
 *  Why "firm" outranks "soft": a candidate who says both "looking to
 *  move quickly AND I have to revert by Friday" is firm — the deadline
 *  is the binding constraint, the directional framing is incidental. */
function detectUrgencySignal(
  rawCandidateText: string,
): TurnDelta["urgencySignal"] {
  if (typeof rawCandidateText !== "string" || !rawCandidateText.trim()) {
    return "none";
  }
  const text = rawCandidateText.toLowerCase();
  const FIRM_RE =
    /\b(have to revert by|deadline is|joining by|by\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week|next week|end of (?:the )?week|eow|eod)|have an offer in hand|offer in hand|competing offer expires|need to close this week|close this week)\b/i;
  if (FIRM_RE.test(text)) return "firm";
  const SOFT_RE =
    /\b(soon|looking to move quickly|want to wrap up|in final stages elsewhere|interviewing with others|interviewing elsewhere)\b/i;
  if (SOFT_RE.test(text)) return "soft";
  return "none";
}

/** Perfect 3 (2026-05-16) — sticky upgrade for cumulativeUrgency. Firm
 *  overrides soft overrides none; never downgrades. Pure. */
function mergeCumulativeUrgency(
  prior: NegotiationState["cumulativeUrgency"],
  fresh: TurnDelta["urgencySignal"],
): "none" | "soft" | "firm" {
  const rank = { none: 0, soft: 1, firm: 2 } as const;
  const p = rank[prior ?? "none"];
  const f = rank[fresh ?? "none"];
  const max = p >= f ? p : f;
  return (Object.keys(rank) as Array<"none" | "soft" | "firm">).find(
    (k) => rank[k] === max,
  ) ?? "none";
}

/** Compute the per-turn delta between pre-state and post-state given
 *  the parsed candidate answer. Pure. Called at every return point of
 *  applyCandidateAnswer so terminal / soft-accept / walk-away paths all
 *  carry an accurate delta for downstream consumers. */
export function computeTurnDelta(
  pre: NegotiationState,
  post: NegotiationState,
  parsed: ParsedAnswer,
  rawAnswer: string,
): TurnDelta {
  const d: TurnDelta = { ...EMPTY_TURN_DELTA };

  /* Comp facts — disclosed iff the post value is different from the pre
   * value (covers null→number AND value-changed cases). Re-stating the
   * same number does NOT count as a fresh disclosure. */
  if (post.candidateCurrentCtc != null && post.candidateCurrentCtc !== pre.candidateCurrentCtc) {
    d.disclosedCurrentCtc = true;
  }
  if (post.candidateTarget != null && post.candidateTarget !== pre.candidateTarget) {
    d.disclosedExpectedCtc = true;
  }

  /* Fixed/variable split — fired when this turn's parsed breakdown
   * carried BOTH base and variable. Captures both "split disclosed for
   * current CTC" and "split disclosed for expected CTC" — consumers
   * disambiguate via state.lastDisclosureSubject if they care. */
  if (
    parsed.componentBreakdown.hasAny &&
    ((parsed.componentBreakdown.base != null && parsed.componentBreakdown.variable != null) ||
      (parsed.componentBreakdown.basePercent != null && parsed.componentBreakdown.variablePercent != null))
  ) {
    /* BUG-3 (PDF#24, 2026-05-16): a percentage-shaped split
     * ("80% fixed, 20% variable") is also a valid disclosure of the
     * fitment split — we just don't know the absolute LPA values
     * without a total. Either form flips this flag. */
    d.disclosedFixedVariableSplit = true;
  }

  /* Notice period — covers both notice-days AND buyout/LWD signals. */
  if (parsed.noticeJoining.hasAny) {
    const pn = pre.noticeJoining;
    const nn = post.noticeJoining;
    if (
      (nn.noticePeriodDays != null && nn.noticePeriodDays !== pn.noticePeriodDays) ||
      (nn.buyoutRequested && !pn.buyoutRequested) ||
      (nn.lastWorkingDayText != null && nn.lastWorkingDayText !== pn.lastWorkingDayText)
    ) {
      d.disclosedNoticePeriod = true;
    }
    /* Buyout confirmation flip (Fix 6, 2026-05-16). Distinguished from
     * disclosedNoticePeriod so the reactive-rule layer can acknowledge
     * the buyout disclosure before advancing ordered discovery. */
    if (nn.buyoutRequested && !pn.buyoutRequested) {
      d.noticeBuyoutConfirmed = true;
    }
    if (
      (nn.earlyJoinPreferred && !pn.earlyJoinPreferred) ||
      (nn.lastWorkingDayText != null && nn.lastWorkingDayText !== pn.lastWorkingDayText)
    ) {
      d.disclosedJoiningDate = true;
    }
  }

  /* Competing offer — either numeric or named-vague signal. */
  if (
    (post.competingOffer != null && post.competingOffer !== pre.competingOffer) ||
    parsed.signalsCompetingExistsWithoutNumber ||
    (parsed.competingOfferDetail.hasAny &&
      (parsed.competingOfferDetail.company != null ||
        parsed.competingOfferDetail.status != null ||
        parsed.competingOfferDetail.stage != null ||
        parsed.competingOfferDetail.letterShareOffered ||
        parsed.competingOfferDetail.onHold))
  ) {
    d.disclosedCompetingOffer = true;
  }

  /* Value proof — sales OTE / contract rate / profile signals that
   * speak to role-specific value. Sales/contract aren't in ParsedAnswer;
   * detect via post-state diff against pre-state (extractSalesOTE /
   * extractContractRate are folded into post inside applyCandidateAnswer). */
  if (
    (post.salesOTE.hasAny && !pre.salesOTE.hasAny) ||
    (post.contractRate.hasAny && !pre.contractRate.hasAny)
  ) {
    d.disclosedValueProof = true;
  }
  if (
    parsed.candidateProfile.hasAny &&
    (parsed.candidateProfile.quotaAttainmentClaimed ||
      parsed.candidateProfile.peopleManagementClaimed ||
      parsed.candidateProfile.transferableSkillsClaimed ||
      parsed.candidateProfile.variableTrackRecord)
  ) {
    d.disclosedValueProof = true;
  }

  /* Asked-question — direct question in the candidate's utterance.
   *
   * Populates two fields:
   *   askedQuestion             — back-compat boolean
   *   candidateAskedQuestion    — structured {raw, intent} that the
   *                                response pipeline prefers over a
   *                                fresh re-detection at request time.
   *
   * Detection mirrors _fact-pack.ts:detectCandidateAskedQuestion. It is
   * duplicated here to keep _negotiation-kernel.ts free of a circular
   * import to _fact-pack.ts. If the heuristic ever drifts, fix both.
   */
  if (typeof rawAnswer === "string" && rawAnswer.trim()) {
    const trimmed = rawAnswer.trim();
    const Q_LEAD_RE =
      /^\s*(?:what|how|when|where|who|why|can you|could you|do you|is the|are you|tell me about)\b/i;
    const RHETORICAL_BEFORE_RE =
      /\b(thinking|wondering|wonder|guess|suppose|imagine|just|maybe)\b[^.?!]*?\b(what|how|when|where|who|why)\b/i;
    const trailingQ = /\?\s*$/.test(trimmed);
    const leadingQ = Q_LEAD_RE.test(trimmed);
    const rhetorical = RHETORICAL_BEFORE_RE.test(trimmed) && !trailingQ;
    if (!rhetorical && (trailingQ || leadingQ)) {
      d.askedQuestion = true;
      const lower = trimmed.toLowerCase();
      let intent: string | undefined;
      if (/wfh|work.from.home|remote|hybrid|office/.test(lower)) intent = "wfh";
      else if (/team.size|how many|team structure|how big/.test(lower)) intent = "team";
      else if (/report|manager|reporting to|hierarchy/.test(lower)) intent = "reporting";
      else if (/growth|career path|progression/.test(lower)) intent = "growth-path";
      else if (/perf.*cycle|review.*cycle|appraisal|hike.*cycle/.test(lower)) intent = "perf-cycle";
      else if (/esop|equity|rsu|stock|vesting/.test(lower)) intent = "equity";
      else if (/joining|notice|start.*date|when.*join|buyout|last working day/.test(lower)) intent = "joining";
      else if (/perk|benefit|insurance|gratuity|pf|epf|leave|wellness/.test(lower)) intent = "perks";
      else if (/process|interview|next.*round/.test(lower)) intent = "process";
      else if (/tax|87a|deduction|new.regime|old.regime|rebate/.test(lower)) intent = "tax";
      else if (/bgv|background.*verif|relieving|form.16|payslip|document/.test(lower)) intent = "documents";
      d.candidateAskedQuestion = {
        raw: trimmed.slice(0, 240),
        ...(intent ? { intent } : {}),
      };
    }
  }

  /* Refused-item — probeRefusalCount incremented this turn. */
  if ((post.probeRefusalCount ?? 0) > (pre.probeRefusalCount ?? 0)) {
    d.refusedItem = true;
  }

  /* Fresh-grad — first-time disclosure (pre=false, post=true). */
  if (!pre.freshGradDisclosed && post.freshGradDisclosed) {
    d.freshGradDisclosed = true;
  }

  /* Perfect 2 (2026-05-16) — emotional sentiment classification. Pure
   * regex on the raw candidate utterance. Drives the canonical-prose
   * acknowledgement prefix when sentiment ∈ {frustrated, excited,
   * hesitant}; decisive + neutral suppress (no preachy prefix). */
  d.candidateSentiment = detectCandidateSentiment(rawAnswer);

  /* Perfect 3 (2026-05-16) — per-turn urgency signal. The sticky session
   * field state.cumulativeUrgency is upgraded by finalize() in applyCandidate-
   * Answer using this value; the delta field stays as the per-turn read. */
  d.urgencySignal = detectUrgencySignal(rawAnswer);

  /* Retention counter — current employer counter disclosed. */
  if (parsed.retentionCounter.hasAny) {
    const pr = pre.retentionCounter;
    const nr = post.retentionCounter;
    if (
      (nr.amountLpa != null && nr.amountLpa !== pr.amountLpa) ||
      (nr.hasAny && !pr.hasAny)
    ) {
      d.retentionCounterDisclosed = true;
    }
  }

  return d;
}

/* ─── Fix 7 (2026-05-15) — Anchor-lock helpers ───────────────────── */

/** Return the locked anchor LPA if the session already locked one;
 *  otherwise fall back to band.initialOffer. Pure. */
export function effectiveAnchorLpa(state: NegotiationState): number {
  if (state.anchorLocked && state.lockedAnchorLpa != null) {
    return state.lockedAnchorLpa;
  }
  return state.band.initialOffer;
}

/** Lock the session's anchor. Idempotent — once locked, subsequent
 *  calls are no-ops (the original anchor never changes within a
 *  session). Returns a new state. Pure. */
export function lockAnchor(state: NegotiationState, anchorLpa: number): NegotiationState {
  if (state.anchorLocked) return state;
  return { ...state, anchorLocked: true, lockedAnchorLpa: anchorLpa };
}

/* ─── Fix 1 (2026-05-15) — Anchor clamp against candidate ask ──────
 *
 * Real-session bug (PDF #17 re-analysis): candidate asked ₹16L,
 * recruiter anchored ₹24L — volunteering money the candidate never
 * requested. Real recruiters never anchor higher than the candidate's
 * stated target; if the candidate undershoots the band, they accept
 * quickly with a small step-up rather than padding the offer.
 *
 * PDF #18 audit (2026-05-15): tightened unified rule. The cleanest
 * recruiter behavior is: NEVER offer above max(candidateAsk × 1.10,
 * bandFloor). Below-floor asks are handled by the same expression
 * (max picks the floor); above-anchor asks are no-ops (clamp ≥ anchor).
 *
 * clampAnchorAgainstCandidateAsk:
 *   - candidateAskLpa == null/invalid → return originalAnchor unchanged
 *   - else → min(originalAnchor, max(candidateAsk × 1.10, bandFloor))
 *
 * Applied at session-init AND on each turn before re-anchor (anchor
 * is locked per Fix 7, so this only fires at init for the locked
 * value). Pure. */
export function clampAnchorAgainstCandidateAsk(
  originalAnchor: number,
  candidateAskLpa: number | null,
  bandFloor: number,
): number {
  if (candidateAskLpa == null) return originalAnchor;
  if (!Number.isFinite(candidateAskLpa) || candidateAskLpa <= 0) return originalAnchor;
  const cap = Math.max(candidateAskLpa * 1.10, bandFloor);
  return Math.min(originalAnchor, cap);
}

/* Sprint A.3 (2026-05-15) — attach the post-acceptance onboarding
 * message to state at the moment the kernel transitions to `accepted`.
 * Builds once and stores on state so the response layer can concatenate
 * it onto the close turn without the LLM improvising onboarding
 * language. Idempotent — re-attach is a no-op once set. Mutates `next`
 * in place (callers pass a fresh draft just before returning).
 *
 * Dynamic require kept because `_post-acceptance` imports the
 * NegotiationState type from this file and a static import would lock
 * the load order. */
/** Audit Pass 2 Fix D (2026-05-16) — normalize curly / smart quotes
 *  to ASCII at the input boundary. iOS / macOS auto-correct silently
 *  rewrites apostrophes to U+2019 (right single quotation mark) and
 *  double quotes to U+201C/U+201D, but every regex bank in
 *  `_acceptance-classifier.ts` (lines 78/80/82/92/101/133/143/146/147/
 *  198/226/438-465) uses ASCII `'` exclusively. Pre-fix, "I'll accept"
 *  and "I'm in" pasted from iOS Notes never matched any acceptance
 *  pattern. Apply at applyCandidateAnswer entry (kernel-side) AND at
 *  classifyAcceptance entry (defense-in-depth for the legacy
 *  whole-transcript facts path which doesn't route through the kernel). */
function normalizeQuotes(s: string): string {
  return s
    .replace(/[\u2018\u2019\u02BC\u02BB]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

function attachPostAcceptanceMessage(next: NegotiationState): void {
  if (next.postAcceptanceMessage) return;
  next.postAcceptanceMessage = buildPostAcceptanceMessage(next);
}

/** Audit Pass 2 Fix C (2026-05-16) — single helper for the
 *  "candidate verbally accepted, lock in terminal" state-tuple. Three
 *  accept paths in `applyCandidateAnswer` (strict-boost explicit accept,
 *  classifyAcceptance / soft-accept fallthrough, and the strict-acceptance
 *  terminal write) plus `foldFactsIntoState` were each setting `phase` +
 *  `acceptedAtTurn` independently, BUT only one of them set
 *  `verbalAcceptanceTurn`. The next-action planner gates the
 *  close-recap-formal step on `verbalAcceptanceTurn != null`, so the
 *  close-recap never fired on those paths — terminal-restate won
 *  instead. Forcing the field tuple through this helper closes the gap.
 *
 *  Call sites must keep their own site-specific extras (e.g.
 *  `attachPostAcceptanceMessage` or sign-today-bundle attachments) —
 *  this helper only enforces the field tuple, nothing else. */
function markAccepted(next: NegotiationState, state: NegotiationState): void {
  next.phase = "accepted";
  next.acceptedAtTurn = state.turnIndex;
  next.verbalAcceptanceTurn = state.turnIndex;
}

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
    lastCandidateCounterLpa: null,
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
    counterRound: 0,
    recentRecoveryActive: false,
    walkAwayReturned: false,
    hardBandCap: input.hardBandCap ?? false,
    marketMode: input.marketMode ?? "neutral",
    recruiterPersona: input.recruiterPersona ?? "consultative",
    acceptedAtTurn: null,
    walkedAwayAtTurn: null,
    stalemateAtTurn: null,
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
    candidateProfile: { ...EMPTY_CANDIDATE_PROFILE },
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
    freshGradDisclosed: false,
    recruiterFactsAlreadySaid: [],
    pendingPromises: [],
    lastBotReply: null,
    anchorLocked: false,
    lockedAnchorLpa: null,
    minTurnsBeforeClose: 8,
    /* PDF #17 architectural fix (2026-05-15) — initial checklist all
     * false; initial stage "discovery". Probe-mismatch stage is set
     * only when caller has detected a resume↔role mismatch via the
     * existing mismatch-probe path; default to "discovery" here. */
    discoveryChecklist: { ...EMPTY_DISCOVERY_CHECKLIST },
    discoveryStage: "discovery",
    /* Negotiation-flow redesign commit 4 (2026-05-15) — reactive-followup
     * de-dupe ledger. Empty at session start; each reactive-followup
     * emission pushes its topic. */
    reactiveFollowupsFired: [],
    /* Polish 2 (2026-05-16) — per-topic fire-history. Empty at start. */
    reactiveFollowupsFireLog: {},
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

const EXPLICIT_DECLINE_PATTERNS: RegExp[] = [
  /\b(?:i'?m\s+passing|i\s+am\s+passing|i\s+will\s+pass|i'?ll\s+pass)\b/i,
  /\b(?:i\s+(?:will\s+)?decline|i'?ll\s+decline|i\s+have\s+to\s+decline|i\s+must\s+decline)\b/i,
  /\b(?:not\s+interested|no(?:'?t|t)\s+interested|i'?m\s+not\s+interested)\b/i,
  /\b(?:withdraw(?:ing)?\s+(?:my\s+)?(?:candidacy|application)|stepping\s+out\s+of\s+(?:this\s+)?process)\b/i,
  /\b(?:i'?ll\s+(?:go|move)\s+with\s+(?:the\s+)?other(?:s)?|going\s+with\s+another\s+offer)\b/i,
];

export function detectExplicitDecline(answer: string | null | undefined): boolean {
  if (!answer || typeof answer !== "string") return false;
  return EXPLICIT_DECLINE_PATTERNS.some((p) => p.test(answer));
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

/* Sprint A.4 (2026-05-15) — current-employer free-form extractor.
 * Patterns: "currently at X" / "working at X" / "I'm with X" / "I work
 * at X" / "right now at X" / "presently at/with X". Returns the proper-
 * noun phrase (1-3 capitalized tokens) or null. Conservative on stop-
 * words ("a", "the", "my") to avoid false positives. Pure. */
const CURRENT_EMPLOYER_PATTERNS: RegExp[] = [
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

const DEAD_END_PATTERNS: RegExp[] = [
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
  /* Strict explicit accept is one of the four canonical valid-close
   * conditions — always passes. */
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
  if (/\b(fixed\s+(?:vs|versus|and|or)\s+variable|variable\s+(?:vs|versus|or)\s+fixed|split\s+(?:between|of)\s+fixed|how\s+much\s+(?:is\s+)?fixed|fixed\s+component|ctc\s+(?:breakdown|split)|base\s+fixed\s+or\s+variable)\b/i.test(a)) out.push("fixed-vs-variable");
  if (/\b(sodexo|food\s+coupon|gratuity|nps|insurance\s+(?:value|cost)|non[-\s]?cash|benefits\s+(?:value|in\s+ctc))\b/i.test(a)) out.push("perks-non-cash");
  /* Generic "walk me through / break it down / what's the structure" —
     the candidate is explicitly asking the recruiter to enumerate the
     package, NOT to probe their expectations. The Lollypop session
     (May 2026) showed the AI responding to "could you break down the
     offer for me?" with "what range are you targeting?" — a phase
     mismatch the move-picker now overrides via this intent. */
  if (/\b(walk\s+me\s+through|break\s+(?:it|that|the\s+offer|the\s+package)\s+down|breakdown\s+of\s+(?:the\s+)?(?:offer|package|ctc)|structure\s+of\s+(?:the\s+)?(?:offer|package|ctc)|what(?:'s|\s+is)\s+(?:in\s+)?(?:the\s+)?(?:package|offer)|tell\s+me\s+more\s+about\s+(?:the\s+)?(?:package|offer|ctc))\b/i.test(a)) out.push("package-breakdown");
  /* Generic benefits / perks ask — "what are the benefits?", "what
     perks do you offer?", "what do I get besides salary?", "tell me
     about the benefits package", "for the benefits.". Bug report 11
     follow-up E (2026-05-14): the recruiter previously had no response
     for this and looped close-acceptance. Distinct from `perks-non-cash`
     (lump-into-CTC trick) — this is purely an info disclosure. We
     deliberately do NOT match a bare "benefits" word standing alone
     against substrings like "fringe benefits of equity"; we anchor to
     interrogative shapes or the explicit "for the benefits" follow-up. */
  /* Bug session 12 (2026-05-14) — broaden benefits detection.
   * Trigger when an utterance contains \bbenefits?\b OR \bperks?\b AND
   * shows interrogative / imperative shape:
   *   - ends with `?`
   *   - imperative verb: tell|let me know|give|share|explain|list|
   *     describe|details|breakdown|elaborate|walk me through
   *   - question lead: what are|what is|what's|how about|how does|
   *     what does|what kind of|which|can you|could you
   * Falsy guard: bare declaratives like "I counted the benefits." don't
   * trip because they lack interrogative shape and end with `.`.
   * Existing narrow phrases (for the benefits., what do I get, etc.)
   * still match via the legacy regex. */
  const hasBenefitsWord = /\b(?:benefits?|perks?)\b/i.test(a);
  const endsWithQuestion = /\?\s*$/.test(a.trim());
  const imperativeCue = /\b(?:tell\s+me|let\s+me\s+know|give\s+(?:me)?|share|explain|list|describe|details?|breakdown|elaborate|walk\s+me\s+through|can\s+you|could\s+you|would\s+you)\b/i.test(a);
  const questionLead = /\b(?:what\s+are|what\s+is|what['’]s|how\s+about|how\s+does|what\s+does|what\s+kind\s+of|which)\b/i.test(a);
  const broadBenefitsMatch = hasBenefitsWord && (endsWithQuestion || imperativeCue || questionLead);
  const legacyBenefitsMatch =
    /\b(?:what(?:'s|\s+is|\s+are)?\s+(?:the\s+|some\s+|your\s+)?(?:benefits|perks)|tell\s+me\s+(?:about\s+)?(?:the\s+)?(?:benefits|perks)|(?:any|other)\s+(?:benefits|perks)|let\s+me\s+know\s+(?:about\s+)?(?:are\s+)?(?:the\s+)?(?:benefits|perks)|for\s+the\s+(?:benefits|perks)\b|what\s+do\s+i\s+get|benefits\s+(?:for\s+this\s+role|package|breakdown)|perks\s+(?:do\s+you|of\s+(?:this|the)))\b/i.test(a);
  /* "fringe benefits" used to be a standalone trigger; it now requires
   * interrogative shape so "fringe benefits of equity are nice"
   * (declarative) does not fire. */
  const fringeBenefitsMatch = /\bfringe\s+benefits\b/i.test(a) && (endsWithQuestion || imperativeCue || questionLead);
  if (broadBenefitsMatch || legacyBenefitsMatch || fringeBenefitsMatch) out.push("benefits-overview");

  /* Bug session 12 (2026-05-14) — compensation-breakdown.
   * Candidate asking about variable / bonus / ESOP / equity / RSU /
   * OTE structure — generally, NOT about THIS offer's components. Same
   * interrogative/imperative shape gate as benefits-overview so bare
   * declaratives ("the variable was 12% last year") don't trip. */
  const hasCompWord =
    /\bvariable\s+(?:components?|pay|comp(?:ensation)?)\b/i.test(a) ||
    /\bbonus(?:es)?\b/i.test(a) ||
    /\bESOPs?\b/i.test(a) ||
    /\bstock\s+options?\b/i.test(a) ||
    /\bRSUs?\b/i.test(a) ||
    /\bequity\b/i.test(a) ||
    /\bOTE\b/i.test(a) ||
    /on[-\s]target\s+earnings/i.test(a) ||
    /performance\s+bonus/i.test(a) ||
    /\bcommission\b/i.test(a);
  if (hasCompWord && (endsWithQuestion || imperativeCue || questionLead)) {
    out.push("compensation-breakdown");
  }

  /* Session B (2026-05-14) — notice-period info ask. Anchored to
   * interrogative shapes around notice / start-date / joining-date /
   * buyout so declarative "I have a 60-day notice" doesn't trip. */
  const noticeAskPatterns = [
    /\bnotice\s+period\s*\?/i,
    /\b(?:what(?:'s|\s+is)|how\s+long\s+is)\s+(?:the\s+)?(?:notice|notice\s+period)\b/i,
    /\b(?:when|how\s+soon)\s+can\s+i\s+(?:join|start)\b/i,
    /\b(?:earliest|expected)\s+(?:start\s+date|joining\s+date)\s*\??/i,
    /\bjoining\s+date\s*\?/i,
    /\bstart\s+date\s*\?/i,
    /\bbuyout\s*\?/i,
    /\b(?:do\s+you|will\s+you|can\s+you)\s+(?:offer|cover|do)\s+(?:a\s+)?buy[-\s]?out\b/i,
    /\bbuy[-\s]?out\s+option\b/i,
  ];
  if (noticeAskPatterns.some((p) => p.test(a))) out.push("notice-period-ask");

  /* Session B (2026-05-14) — hike-percentage info ask. The candidate
   * is asking what hike% the offer represents vs their current CTC.
   * Anchored to interrogative shape so declarative "I want a 30% hike"
   * doesn't fire. */
  const hikeDeclarativeGuard = /\b(?:i\s+want|i.?m\s+asking|i\s+expect|i\s+need|i.?d\s+like|i\s+am\s+looking\s+for|expecting)\b/i.test(a);
  const hikeAskPatterns = [
    /\b(?:what(?:'s|\s+is)?|how\s+much)\s+(?:(?:the|a)\s+)?(?:hike|raise|increment|bump)\b/i,
    /\bhike\s*%/i,
    /(?:^|\s)%\s+(?:hike|raise|increment)\s*\?/i,
    /\b(?:is\s+this|will\s+this\s+be)\s+(?:a\s+)?\d{1,3}\s*%\s+(?:hike|raise|increment|bump)\b/i,
    /\bhike\s+(?:from|on)\s+(?:my\s+)?current\b/i,
    /\bwhat\s+hike\s+is\s+this\b/i,
  ];
  if (!hikeDeclarativeGuard && hikeAskPatterns.some((p) => p.test(a))) out.push("hike-percentage-ask");

  return out;
}

/* ─── Input-sanity bounds (launch-blocker, 2026-05-14) ──────────────
 *
 * The kernel previously accepted any number the parsers extracted —
 * including absurd values like "₹50,000 crore" from STT mishears or
 * scripted abuse. That number then propagated into hike-% math, band-
 * comparison branches, and telemetry. The clamping helpers below pin
 * each numeric input to a plausible upper bound and reject negative /
 * NaN / Infinity. Out-of-bounds values become null — which is the
 * "not-stated" sentinel the rest of the kernel already handles. */

/** Hard ceiling on INR LPA values. 5000 LPA = ₹50 Cr per annum, which
 *  is well above any real Indian comp number (top-of-market C-suite
 *  TC is ~₹15-25 Cr including equity). Anything above this is a
 *  parser / STT artefact. */
export const MAX_INR_LPA = 5000;

/** Hard ceiling on notice-period days. 365 days = 1 year, which is
 *  the longest realistic notice (some senior overseas contracts).
 *  Anything above is a parser artefact. */
export const MAX_NOTICE_DAYS = 365;

/** Hard ceiling on career-gap months. 60 months = 5 years, which is
 *  the soft outer bound already enforced by extractGapMonths. We add
 *  a defensive clamp here so out-of-band values from any source get
 *  rejected. */
export const MAX_GAP_MONTHS = 60;

/** Clamp an INR LPA-denominated number to [0, MAX_INR_LPA]. Returns
 *  null for negative, NaN, ±Infinity, or > MAX_INR_LPA. Zero is
 *  accepted (a candidate stating "current package zero" / fresher
 *  with no prior salary is structurally valid). */
export function clampInr(v: number | null): number | null {
  if (v == null) return null;
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  if (v < 0) return null;
  if (v > MAX_INR_LPA) return null;
  return v;
}

/** Clamp notice-period days to (0, MAX_NOTICE_DAYS]. Zero is
 *  rejected (candidate states "no notice" via other signals, not 0
 *  days). Negative / NaN / ±Infinity / overflow → null. */
export function clampNoticeDays(v: number | null): number | null {
  if (v == null) return null;
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  if (v > MAX_NOTICE_DAYS) return null;
  return v;
}

/** Clamp career-gap months to (0, MAX_GAP_MONTHS]. Same rules as
 *  clampNoticeDays — zero is rejected (no gap means null, not 0). */
export function clampGapMonths(v: number | null): number | null {
  if (v == null) return null;
  if (typeof v !== "number") return null;
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  if (v > MAX_GAP_MONTHS) return null;
  return v;
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
      candidateProfile: { ...EMPTY_CANDIDATE_PROFILE },
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
     but refuses or omits to share magnitude.
     F8 (PDF#20 2026-05-15) — expanded pattern set.  Added:
       "another opportunity", "another offer", "evaluating other roles/
       companies/options", "in process with", "in talks with",
       "interviewing with/at/elsewhere", "offer on the table",
       "multiple offers". */
  const competingMentionPat = /\b(competing\s+offer|another\s+offer|another\s+opportunity|other\s+offers?|offer\s+in\s+hand|offer\s+on\s+the\s+table|other\s+companies|other\s+roles?|other\s+options?|other\s+conversations|elsewhere|in\s+the\s+market|evaluating\s+other|in\s+process\s+with|in\s+talks\s+with|interviewing\s+with|interviewing\s+at|interviewing\s+elsewhere|multiple\s+offers?)\b/i;
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

  /* Input-sanity clamps — out-of-bound numeric values become null at
   * the parse boundary so they never leak into hike-% math, band
   * comparisons, or telemetry. See clampInr / clampNoticeDays /
   * clampGapMonths above for the policy. */
  const sanitizedNoticeJoining = {
    ...noticeJoining,
    noticePeriodDays: clampNoticeDays(noticeJoining.noticePeriodDays),
    joiningBonusAsk: clampInr(noticeJoining.joiningBonusAsk),
  };
  const sanitizedCandidateProfile = {
    ...candidateProfile,
    careerGapMonths: clampGapMonths(candidateProfile.careerGapMonths),
  };

  return {
    target: clampInr(target),
    currentCtc: clampInr(currentCtc),
    competing: clampInr(competing),
    signalsAcceptance: signalsAcceptanceFinal, signalsWalkAway,
    targetAsRange, vossTactics, infoAsked,
    signalsCompetingExistsWithoutNumber,
    componentBreakdown,
    rationale: hikeRationale.rationale,
    noticeJoining: sanitizedNoticeJoining,
    equityVesting,
    locationMode,
    competingOfferDetail,
    decisionDeadline,
    candidateProfile: sanitizedCandidateProfile,
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
export function applyCandidateAnswer(state: NegotiationState, rawAnswerInput: string): NegotiationState {
  /* Audit Pass 2 Fix D (2026-05-16) — normalize curly/smart quotes at
   * the input boundary BEFORE anything else reads `answer`. Every
   * downstream regex bank assumes ASCII `'`/`"`. Single point of fix
   * for iOS / macOS / smart-typography paste paths. */
  const answer = normalizeQuotes(rawAnswerInput ?? "");
  /* Negotiation-flow redesign commit 1 (2026-05-15): capture pre-state
   * snapshot for TurnDelta computation. The single pre/post diff is
   * recomputed at every return point via finalize() below to keep
   * the 8+ return branches consistent. */
  const pre = state;
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
      /* Audit Pass 3 / Fix 1 (2026-05-16) — clear stalemate ledger
       * symmetrically with walkedAwayAtTurn when the session reopens. */
      stalemateAtTurn: null,
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
  /* Commit 1 (2026-05-15): finalize() stamps state.lastTurnDelta from the
   * pre-state snapshot before every return. Keeps the 8+ return branches
   * (terminal-accept / soft-accept / walk-away / regular / phase-only)
   * symmetric. Pure — mutates the draft `n` in place. */
  const finalize = (n: NegotiationState): NegotiationState => {
    n.lastTurnDelta = computeTurnDelta(pre, n, parsed, answer);
    /* Perfect 3 (2026-05-16) — promote per-turn urgencySignal to sticky
     * state.cumulativeUrgency via the monotone upgrade rule. Done BEFORE
     * planNextAction so the planner's urgency-aware nudges read the
     * already-merged value, not the prior turn's. */
    n.cumulativeUrgency = mergeCumulativeUrgency(
      pre.cumulativeUrgency,
      n.lastTurnDelta.urgencySignal,
    );
    /* Commit 3 (2026-05-15) — stamp planNextAction so the brief and the
     * move-picker read the SAME action without recomputing. The planner
     * registers itself via _planner-registry at module load (see commit
     * 4 — registerNextActionPlanner at the bottom of
     * _next-action-planner.ts) to avoid an import cycle. */
    n.plannedNextAction = _callNextActionPlanner(n);
    return n;
  };

  /* Bind newly-stated facts. Last-stated wins (the candidate may
     revise their target mid-conversation; that's allowed). Phase 25a
     also records the FIRST anchored target, frozen — used by the
     red-flag layer to detect upward drift. */
  if (parsed.target != null) {
    /* Bug-report 12 (2026-05-14) — per-turn fresh-counter signal.
       Only count as a fresh counter when the parsed number is
       materially different from the prior sticky candidateTarget; a
       candidate re-asserting the same intake number doesn't unlock
       the auto-accept gate. */
    const prior = state.candidateTarget;
    if (prior == null || Math.abs(prior - parsed.target) > 0.05) {
      next.lastCandidateCounterLpa = parsed.target;
    }
    next.candidateTarget = parsed.target;
    if (next.firstAnchoredTarget == null) next.firstAnchoredTarget = parsed.target;
    /* Sprint B.3 (2026-05-15) — in-hand framing disambiguation. If the
     * candidate's anchor utterance frames the number as in-hand /
     * take-home, flag it and back-compute a CTC-equivalent so downstream
     * consumers can switch frames. Pure derived; the original target
     * stays as candidateTarget (still in candidate's units) so existing
     * counter math doesn't silently shift frame. */
    if (detectInHandFraming(answer)) {
      next.candidateTargetIsInHand = true;
      const ctcEq = backComputeCtcFromInHand(parsed.target);
      if (ctcEq != null) next.candidateTargetCtcEquivalentLpa = ctcEq;
    }
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

    /* PDF#18 follow-up P3 (2026-05-15) — current-vs-expected fixed/
     * variable split disambiguation. When the candidate's utterance
     * carries a fixed+variable breakdown AND the bot's previous
     * question was tagged with `lastDisclosureSubject`, route the
     * split to the right flag:
     *   subject='current'  → currentCtcFixedVariableSplitDisclosed=true
     *   subject='expected' → expectedCtcFixedVariableSplitDisclosed=true
     * The legacy umbrella `fixedVariableSplitAnswered` flag is also
     * monotone-true so legacy checklists clear. Monotone-up. */
    /* BUG-3 follow-up (PDF#24, 2026-05-16): a percentage-shaped split
     * ("80% fixed, 20% variable") is also a valid disclosure of the
     * fitment structure — accept either absolute OR percent shape so
     * the subject-specific flag flips for percent-only candidates too.
     * Without this, the umbrella `fixedVariableSplitAnswered` was being
     * set (via syncChecklistFromParsedFacts) but the subject-specific
     * `currentCtcFixedVariableSplitDisclosed` /
     * `expectedCtcFixedVariableSplitDisclosed` stayed false, leaving
     * downstream consumers that key on the subject-specific flag blind
     * to the percent-only disclosure. Monotone-up. */
    const splitHasBoth =
      (parsed.componentBreakdown.base != null &&
        parsed.componentBreakdown.variable != null) ||
      (parsed.componentBreakdown.basePercent != null &&
        parsed.componentBreakdown.variablePercent != null);
    if (splitHasBoth && state.discoveryChecklist != null) {
      const subject = state.lastDisclosureSubject ?? null;
      const checklist = { ...state.discoveryChecklist };
      checklist.fixedVariableSplitAnswered = true;
      if (subject === "current") {
        checklist.currentCtcFixedVariableSplitDisclosed = true;
      } else if (subject === "expected") {
        checklist.expectedCtcFixedVariableSplitDisclosed = true;
      } else {
        /* No subject tag (legacy session / split offered unprompted):
         * fall back to the legacy umbrella flag only. Conservative —
         * doesn't accidentally tag a split against the wrong CTC. */
      }
      next.discoveryChecklist = checklist;
    }
  }

  /* Phase 12c (2026-05-13) — structural hard-band-cap detection. If
   * the candidate's stated base floor exceeds the band's
   * baseStretch, the cap is structural (not just band): no amount
   * of total-CTC stretching satisfies the constraint, because base
   * is the binding component. Flip hardBandCap so the move-picker
   * redirects all concession energy to non-cash levers instead of
   * inching the total toward maxStretch on impossible base.
   *
   * BUG-3 follow-up (PDF#24, 2026-05-16): when the candidate stated
   * the split as a percentage ("80% fixed, 20% variable") but no
   * absolute base was parsed, derive base = basePercent% of the
   * stated current CTC. That lets the cap detection work for
   * percent-only disclosures, broadly aligned with how a recruiter
   * would mentally derive the fixed component from a known total
   * fitment and a stated split. Last-stated wins: absolute base
   * (when present) is authoritative; the derived value only fires
   * when the absolute is missing. */
  let candidateStatedBaseLpa: number | null =
    next.candidateComponentBreakdown.base ?? null;
  if (
    candidateStatedBaseLpa == null &&
    next.candidateComponentBreakdown.basePercent != null &&
    next.candidateCurrentCtc != null
  ) {
    candidateStatedBaseLpa =
      (next.candidateComponentBreakdown.basePercent / 100) *
      next.candidateCurrentCtc;
  }
  if (
    candidateStatedBaseLpa != null &&
    state.band.baseStretch != null &&
    candidateStatedBaseLpa > state.band.baseStretch
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

  /* Bug-report 11 (2026-05-14) — fresh-grad disclosure overrides the
   * resume-derived applicableYoe. If the candidate says "I'm pre-grad"
   * / "fresh graduate" / "still in college" mid-session, force
   * candidateApplicableYoe to 0 and flip freshGradDisclosed sticky-true.
   * The brief in _negotiate-turn-helpers surfaces this so the AI
   * acknowledges the disclosure rather than continuing to anchor on
   * the senior bucket inferred from the resume. */
  if (!state.freshGradDisclosed && detectFreshGradDisclosure(answer)) {
    next.freshGradDisclosed = true;
    next.candidateApplicableYoe = 0;
    /* Phase 30 (2026-05-14) — mid-session band rebase.
     *
     * Before this block we only zeroed candidateApplicableYoe, but the
     * band stored on state was already resolved at init from the
     * onboarding-time applicableYoe (e.g. resume said "5 yrs" → senior
     * band locked at ₹35-65L). With the disclosure, the AI should
     * anchor entry-tier numbers from the very next move.
     *
     * Re-resolve the band with applicableYoe=0 → "entry" tier. But never
     * lower the ceiling below what has ALREADY been offered: the close-
     * floor invariant says we cannot claw back commitments. If the AI
     * has already opened at ₹40L and only now learns the candidate is
     * pre-grad, the ceiling pins to the prior offer rather than
     * collapsing the floor underneath an active negotiation. */
    /* Fresher-flow extension (2026-05-14c): thread collegeTier +
     * internshipConversion from the (merged) candidate profile into the
     * rebase. Both are monotone-up, so reading from `next` (the about-to-
     * commit state) captures any disclosure made on this turn. */
    const rebased = resolveServerBand(state.role, state.company, "entry", 0, {
      collegeTier: next.candidateProfile?.collegeTier ?? null,
      internshipConversion: next.candidateProfile?.internshipConversion ?? false,
    });
    const floor = Math.max(state.highestOfferMade ?? 0, rebased.initialOffer);
    /* `band` is `readonly` on NegotiationState — by design it's an
     * init-time field. Phase 30 is the one explicit case where we
     * rebase, so we narrow the cast to this assignment rather than
     * dropping the readonly contract everywhere. */
    /* Fresher-flow extension (2026-05-14): preserve ALL fields from the
     * rebased band — including probationOffer / probationMonths /
     * isInternshipStipend / internshipMonths / baseStretch / variableMax
     * / minOffer. Previously this assignment listed only the 4 core
     * fields, silently dropping probation + stipend flags when a
     * mid-session rebase happened (e.g. senior PD → discloses pre-grad
     * at TCS). The candidate would see one framing pre-rebase and a
     * different one post-rebase. Spread first, then patch maxStretch
     * for the floor-protection invariant. */
    (next as { band: NegotiationBand }).band = {
      ...rebased,
      maxStretch: Math.max(rebased.maxStretch, floor),
    };
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

  /* Sprint A.4 (2026-05-15) — current-employer detection. Free-form
   * extraction from "currently at X", "working at X", "I'm with X",
   * "I work at X". Threaded into the counter-offer-risk detector so the
   * well-funded-employer signal can fire. Last-stated-wins; never
   * cleared by an utterance that doesn't mention an employer. */
  if (!next.currentEmployer) {
    const emp = detectCurrentEmployer(answer);
    if (emp) next.currentEmployer = emp;
  }

  /* F6 (2026-05-15) — probe-refusal counter. The move-picker's number-
   * discipline gate watches probeRefusalCount to escalate from "soft
   * probe" → "structural probe" → "close-walkaway" when the candidate
   * keeps dodging the expectation question. Without this counter the
   * gate is dead code — the move-picker can't see that the candidate
   * refused. Increment monotonically when the candidate utterance is a
   * recognisable refusal-of-disclosure. Pattern is intentionally narrow
   * (false positives here would burn the requisition). */
  if (
    /i'?d prefer not|not comfortable sharing|let'?s come back|prefer to keep that|won'?t disclose|skip that|pass on that|rather not say|that's personal/i.test(answer)
  ) {
    next.probeRefusalCount = (state.probeRefusalCount ?? 0) + 1;

    /* P4 (2026-05-15) — refusal-fallback wiring. When the candidate
     * has refused the same discovery item twice (probeRefusalCount
     * ≥ 2 with the same lastDiscoveryItemAsked), mark the item in
     * discoveryRefusedItems so getNextOrderedDiscoveryItem skips it
     * and moves to the next item in sequence. Threshold = 2 gives
     * the candidate one "soft probe" and one "structural probe"
     * before the kernel respects the boundary. */
    const askedItem = state.lastDiscoveryItemAsked;
    if (
      askedItem &&
      (next.probeRefusalCount ?? 0) >= 2
    ) {
      const prior = state.discoveryRefusedItems ?? {};
      next.discoveryRefusedItems = { ...prior, [askedItem]: true };
    }
  }

  /* Tier-2 ship wiring (2026-05-15) — non-salary constraints extraction.
   * Detector is already shipped and the brief-injection site already
   * reads `state.nonSalaryConstraints`; the only missing piece was the
   * extractor call. Merge monotone-up so a constraint disclosed earlier
   * survives a later turn that doesn't restate it. */
  {
    const fresh = extractNonSalaryConstraints(answer);
    if (Object.keys(fresh).length > 0) {
      next.nonSalaryConstraints = mergeNonSalaryConstraints(
        state.nonSalaryConstraints,
        fresh,
      );
    }
  }

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

  /* PDF #18 root-cause (2026-05-15) — candidate-disclosure ack tracker.
   * Detect notice-period / current-CTC / competing-offer / joining-date
   * disclosures in the utterance and append to pendingCandidateAcks.
   * The next bot turn MUST acknowledge them (enforced via brief
   * injection + pruneAcknowledged in applyAiMove). De-dupe by kind so
   * a candidate restating the same disclosure across multiple turns
   * doesn't multiply pending entries. */
  {
    const fresh = detectCandidateDisclosures(answer);
    if (fresh.length > 0) {
      const existing = state.pendingCandidateAcks ?? [];
      const merged: typeof existing = [...existing];
      const seen = new Set(existing.map((e) => e.kind));
      for (const entry of fresh) {
        if (!seen.has(entry.kind)) {
          merged.push(entry);
          seen.add(entry.kind);
        }
      }
      if (merged.length !== existing.length) {
        next.pendingCandidateAcks = merged;
      }
    }
  }

  /* ITEM 3 (2026-05-15) — trial-close detector wiring.
   * If the bot's PREVIOUS turn contained a trial-close ask (e.g.
   * "if we land at ₹X, would you accept today?") AND the candidate is
   * replying now, set candidateSignaledClose sticky-true and push
   * "candidate-trial-close" onto reactiveFollowupsFired so the planner
   * can emit a close-confirmation move. Monotone-up: once signaled,
   * stays signaled for the rest of the session. */
  if (!next.candidateSignaledClose && detectTrialCloseAsked(state.lastAiText ?? null)) {
    next.candidateSignaledClose = true;
    const priorFired = next.reactiveFollowupsFired ?? [];
    if (!priorFired.includes("candidate-trial-close")) {
      next.reactiveFollowupsFired = [...priorFired, "candidate-trial-close"];
    }
  }

  /* Merge tactic + info sets — sticky, never cleared. */
  for (const t of parsed.vossTactics) {
    if (!next.vossTacticsUsed.includes(t)) next.vossTacticsUsed.push(t);
  }
  for (const i of parsed.infoAsked) {
    if (!next.infoAsked.includes(i)) next.infoAsked.push(i);
  }

  /* Negotiation-flow redesign commit 2 (2026-05-15) — sync discovery
   * checklist from parsed facts (audit D5 fix). Parsed-facts → *Answered
   * flag writes were asymmetric: currentCtcAnswered / targetAnswered /
   * noticePeriodAnswered / competingOffersAnswered / valueProofAnswered
   * were written only by the legacy whole-transcript foldFactsIntoState
   * path, so a candidate volunteering "90 days notice" on turn 1 would
   * be acknowledged but the bot would still re-ask notice on turn 2.
   * Runs after fact binding (parsed → next), before phase derivation
   * (terminal-accept / walk-away / derivePhase). Monotone-up. */
  if (next.discoveryChecklist != null) {
    const cb = next.candidateComponentBreakdown;
    /* BUG-3 (PDF#24, 2026-05-16): treat a percentage-shaped split
     * ("80% fixed, 20% variable") as a valid disclosure for checklist
     * purposes — the candidate stated the split, just not in absolute
     * LPA terms. */
    const fixedVariableSplitHasBoth =
      (cb.base != null && cb.variable != null) ||
      (cb.basePercent != null && cb.variablePercent != null);
    const valueProofSignal =
      (next.salesOTE?.hasAny ?? false) ||
      (next.contractRate?.hasAny ?? false) ||
      (parsed.candidateProfile.hasAny &&
        (parsed.candidateProfile.quotaAttainmentClaimed ||
          parsed.candidateProfile.peopleManagementClaimed ||
          parsed.candidateProfile.transferableSkillsClaimed ||
          parsed.candidateProfile.variableTrackRecord));
    next.discoveryChecklist = syncChecklistFromParsedFacts(next.discoveryChecklist, {
      target: parsed.target,
      currentCtc: parsed.currentCtc,
      competing: parsed.competing,
      signalsCompetingExistsWithoutNumber: parsed.signalsCompetingExistsWithoutNumber,
      competingOfferDetailHasAny: parsed.competingOfferDetail.hasAny,
      noticeJoiningHasAny: parsed.noticeJoining.hasAny,
      fixedVariableSplitHasBoth,
      valueProofSignal,
    });
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

  /* Bug 2 (2026-05-14) — escalation path: explicit acceptance forms
   * like "please send the offer letter" / "let's move forward with this
   * number" don't trip the legacy `classifyAcceptance` performative
   * bank (they're commitment language, not "I accept" verb). Promote
   * them to terminal `accepted` here so the closing path fires. */
  if (!parsed.signalsAcceptance) {
    const strictBoost = detectExplicitAcceptance(answer);
    if (strictBoost.accepted && state.highestOfferMade > 0 && !isTerminalPhase(next.phase)) {
      /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard.
       * Block accepts before minTurnsBeforeClose unless the candidate
       * explicitly declined. */
      if (canCloseSession(next, answer, "accept")) {
        markAccepted(next, state);
        attachPostAcceptanceMessage(next);
        return finalize(next);
      }
    }
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
      return finalize(next);
    }
    /* Bug 2 (2026-05-14) — STAGE GATING. Terminal `accepted` requires
     * an unambiguous explicit acceptance OR three consecutive non-
     * counter, non-info-asking turns from the candidate (proxy for
     * "they're done negotiating"). The `classifyAcceptance` medium-
     * confidence path is too permissive for closing into offer-letter:
     * "sounds good" / "I'd be comfortable moving forward if X" was
     * tripping a premature close. */
    const strict = detectExplicitAcceptance(answer);
    const hasOffer = state.highestOfferMade > 0;
    if (!strict.accepted) {
      /* Soft-acceptance fallback: 3+ consecutive non-counter, non-info
       * candidate turns means the candidate has stopped negotiating —
       * acceptable as an implicit-accept proxy. */
      const log = next.conversationLog;
      let trailingNonCounter = 0;
      for (let i = log.length - 1; i >= 0; i--) {
        const e = log[i];
        if (!e || e.speaker !== "candidate") continue;
        const t = e.text || "";
        const isCounter = /(?:\d+\s*(?:lpa|lakh|l\b|cr|crore|k\b)|expecting|target|want\s+\d|asking)/i.test(t);
        const isInfoAsk = /\?|how\s+much|what\s+is|tell\s+me|can\s+you/i.test(t);
        if (isCounter || isInfoAsk) break;
        trailingNonCounter += 1;
        if (trailingNonCounter >= 3) break;
      }
      if (!hasOffer || trailingNonCounter < 3) {
        /* Not strict-accepted and no implicit-accept proxy: hold the
         * phase instead of closing. Derive phase normally. */
        next.phase = derivePhase(next);
        return finalize(next);
      }
    }
    /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard.
     * Strict-accepted path passes; soft-accept (trailing-non-counter)
     * path is blocked before minTurnsBeforeClose. */
    const closeReason: "accept" | "soft-accept" = strict.accepted ? "accept" : "soft-accept";
    if (!canCloseSession(next, answer, closeReason)) {
      next.phase = derivePhase(next);
      return finalize(next);
    }
    markAccepted(next, state);
    attachPostAcceptanceMessage(next);
    return finalize(next);
  }
  if (parsed.signalsWalkAway) {
    /* Fix 3 (PDF #17 follow-up, 2026-05-15) — explicit walk-away always
     * passes; this is the candidate declining outright. */
    next.phase = "walked-away";
    next.walkedAwayAtTurn = state.turnIndex;
    return finalize(next);
  }

  /* Non-terminal: re-derive phase from updated state. */
  next.phase = derivePhase(next);
  return finalize(next);
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
  /* Audit Pass 2 Fix C (2026-05-16) — finalize() symmetry with
   * applyCandidateAnswer. There's no candidate turn here (no answer
   * was parsed), so no lastTurnDelta to stamp. We DO need to re-stamp
   * plannedNextAction so consumers reading from fold-facts state see
   * the planner output for the new phase (the prior bug returned
   * `next` raw, so the planner cascade never ran for fold-facts). */
  const finalize = (n: NegotiationState): NegotiationState => {
    n.plannedNextAction = _callNextActionPlanner(n);
    return n;
  };
  if (facts.acceptedImmediately) {
    markAccepted(next, state);
    attachPostAcceptanceMessage(next);
    return finalize(next);
  }
  if (facts.rejectedOutright) {
    next.phase = "walked-away";
    next.walkedAwayAtTurn = state.turnIndex;
    return finalize(next);
  }
  next.phase = derivePhase(next);
  return finalize(next);
}

/* ─── Phase derivation ───────────────────────────────────────────── */

/** State → phase. Pure, no transcript dependency. The earlier
 *  detectSalaryPhase needed transcript + turn index + facts because it
 *  was reconstructing state from scratch each render; here the phase
 *  IS state, and we just compute the next bucket from already-folded
 *  facts. */
export function derivePhase(state: NegotiationState): NegotiationPhase {
  const derived = derivePhaseInner(state);
  /* Negotiation-flow redesign commit 6 (2026-05-15) — clamp the result
   * through the monotonicity matrix. If derivation produced a backward
   * transition that isn't an authorized exception (walk-away-reopen,
   * verbal-renege), hold the prior phase instead of regressing. */
  const next = canTransitionPhase(state.phase, derived, state) ? derived : state.phase;
  /* Audit Pass 3 / Fix 1 (2026-05-16) — symmetric ledger stamp on
   * stalemate entry. Mirrors acceptedAtTurn / walkedAwayAtTurn semantics
   * (set once on first transition into terminal phase, never overwritten
   * once set). state is the callers' mutable `next` workspace by
   * convention; this side effect is the same pattern markAccepted /
   * the rejectedOutright branch already use. */
  if (next === "stalemate" && (state.stalemateAtTurn == null)) {
    state.stalemateAtTurn = state.turnIndex;
  }
  return next;
}

function derivePhaseInner(state: NegotiationState): NegotiationPhase {
  if (isTerminalPhase(state.phase)) return state.phase;
  if (state.turnIndex >= state.maxTurns) return "stalemate";

  /* C2 — active phase gating (2026-05-15). Narrow trigger: when the
   * session is still in the opening phase, no offer has gone out yet,
   * the candidate has spoken at least once (turnIndex >= 1 — so there
   * is utterance to extract discovery facts from), discoveryStage is
   * "discovery" and the checklist is incomplete, HOLD the phase at
   * "opening". Without this gate the kernel would advance into the
   * offer/probe phases the moment any prior offer-ish artefact (e.g.,
   * a synthetic test seed) appears, even though discovery hasn't been
   * collected. The companion gate in the move-picker re-routes the
   * opening branch from `open-with-offer` to a discovery probe when
   * this condition holds, so the bot asks instead of anchoring.
   *
   * turnIndex >= 1 keeps every turn-0 opening-flow test green (turn 0
   * still routes through open-with-offer as before). highestOfferMade
   * === 0 keeps the gate from regressing once an anchor is on the
   * table (the existing post-offer advancement is unchanged). */
  if (
    state.phase === "opening" &&
    state.highestOfferMade === 0 &&
    state.turnIndex >= 1 &&
    state.discoveryStage === "discovery" &&
    state.discoveryChecklist != null &&
    !isDiscoveryComplete(state.discoveryChecklist, classifyRoleFamily(state.role))
  ) {
    return "opening";
  }

  /* PDF#18 follow-up (2026-05-15) — range-disclosure phase transitions.
   *
   * ENTRY: when in `opening` AND ordered discovery is complete AND no
   * specific anchor disclosed yet (highestOfferMade === 0) AND the
   * session is past turn 0 (so we have something to react to), promote
   * to `range-disclosure`. The companion gate in the move-picker
   * forces a range-emitting move when this phase is active.
   *
   * EXIT: once a range has been disclosed (rangeDisclosedAtTurn set)
   * AND at least one AI turn has elapsed since (turnIndex >
   * rangeDisclosedAtTurn), advance to negotiation territory. We use
   * the post-range "negotiation" semantically = offer-presented when
   * no candidate target has been parsed yet, counter-offer when one
   * has — same routing the rest of derivePhase already uses. */
  if (
    state.phase === "opening" &&
    state.highestOfferMade === 0 &&
    state.turnIndex >= 1 &&
    state.discoveryChecklist != null &&
    isDiscoveryComplete(state.discoveryChecklist, classifyRoleFamily(state.role)) &&
    (state.rangeDisclosedAtTurn == null)
  ) {
    return "range-disclosure";
  }
  if (state.phase === "range-disclosure") {
    /* Still pre-anchor: if a specific number hasn't been put on the
     * table, stay in range-disclosure until the bot has actually
     * disclosed a range AND at least one further turn has elapsed
     * (allowing the candidate to react). */
    if (state.highestOfferMade > 0) {
      /* A specific anchor has been put on the table — promote. */
      if (state.candidateTarget != null) return "counter-offer";
      return "offer-presented";
    }
    if (
      state.rangeDisclosedAtTurn != null &&
      state.turnIndex > state.rangeDisclosedAtTurn
    ) {
      /* Candidate has had a turn to react — advance to negotiation. */
      if (state.candidateTarget != null) return "probe-expectations";
      return "offer-presented";
    }
    return "range-disclosure";
  }

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
  /* Negotiation-flow redesign commit 6 (2026-05-15) — sticky-floor
   * clauses (POST_PROBE_PHASES / isPostProbe / alreadyProbed /
   * candidateEngagedAtAll) removed. Monotonicity is now enforced
   * structurally by the canTransitionPhase clamp wrapping this function.
   * Backward transitions (e.g. counter-offer → probe-expectations) are
   * rejected by the matrix; legitimate verbal-renege keeps the phase
   * sticky via the verbal-renege exception in canTransitionPhase. */

  /* Target above max stretch + ≥2 levers tried → lever-explore. Only
     non-cash bridges remain. */
  if (target != null && target > state.band.maxStretch && state.leversUsed.length >= 2) {
    return "lever-explore";
  }

  /* Target stated + we've made an offer → counter territory. */
  if (target != null && state.highestOfferMade > 0) {
    return "counter-offer";
  }

  /* Offered, no target — distinguish between "candidate has engaged"
     (probe-expectations) and "awaiting first reaction" (offer-presented).
     Backward regressions from higher phases are blocked by the
     monotonicity matrix above. */
  if (state.highestOfferMade > 0) {
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
  /** Commit 4 (2026-05-15) — reactive-followup topic marker. Set when
   *  the planner emits a `reactive-followup` NextAction so applyAiMove
   *  can push the topic into state.reactiveFollowupsFired (sticky
   *  de-dupe ledger). Unset on every other lever class. */
  askedTopic?: string;
  /** Commit 4 (2026-05-15) — NextAction kind discriminator carried on
   *  the move for telemetry / decisionLog inspection. Optional. */
  actionKind?: string;
}

/** Bug-report 12 (2026-05-14) — close-floor invariant. Every
 *  close-acceptance return MUST clamp newTotalLpa to at least
 *  highestOfferMade (falling back to band.initialOffer when the AI
 *  hasn't opened yet). The kernel must NEVER close below the number
 *  it already put on the table — once an offer is out there, that's
 *  the floor for any future close. Belt-and-suspenders against any
 *  logic path that tries to close low (e.g. the auto-accept gate when
 *  candidate counters DOWN below the offer they already have on the
 *  table — they don't need to take less than what was offered, so we
 *  honor the higher number).
 *  Pure. */
export function clampToCloseFloor(state: NegotiationState, value: number): number {
  const closeFloor = state.highestOfferMade > 0
    ? state.highestOfferMade
    : state.band.initialOffer;
  return Math.max(closeFloor, value);
}

/** pickAiMove was extracted to _kernel-move-picker.ts on 2026-05-14
 *  (kernel split refactor). Re-exported here so every existing caller
 *  continues to `import { pickAiMove } from "./_negotiation-kernel"`
 *  unchanged. See _kernel-move-picker.ts for rationale + dependency edges. */
export { pickAiMove } from "./_kernel-move-picker";


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
    /* Bug-report 12 (2026-05-14): the per-turn fresh-counter signal
     * is also one-shot — clear after the AI's turn so a sticky intake
     * target can't keep firing the auto-accept gate on subsequent
     * turns where the candidate didn't actually re-counter. */
    lastCandidateCounterLpa: null,
    /* Architectural bug-prevention (2026-05-15) — clear one-shot brief
     * tag attribution so next turn starts fresh. */
    lastBriefTags: undefined,
    /* Negotiation-flow redesign commit 1 (2026-05-15) — TurnDelta is a
     * per-candidate-turn signal. Clear it on the AI turn so a stale delta
     * cannot bleed into the next candidate turn's reactive routing. */
    lastTurnDelta: null,
    /* Negotiation-flow redesign commit 3 (2026-05-15) — plannedNextAction
     * is a per-candidate-turn signal too. Clear after the AI consumes it;
     * the next applyCandidateAnswer call repopulates from the post-derive
     * state. */
    plannedNextAction: null,
  };
  /* Negotiation-flow redesign commit 4 (2026-05-15) — record the
   * reactive-followup topic the planner emitted this turn. Sticky:
   * future planNextAction calls consult this ledger before re-emitting
   * the same trigger. Never cleared on AI turns. */
  if (move.askedTopic) {
    const fired = state.reactiveFollowupsFired ?? [];
    if (!fired.includes(move.askedTopic)) {
      next.reactiveFollowupsFired = [...fired, move.askedTopic];
    } else {
      next.reactiveFollowupsFired = fired;
    }
    /* Polish 2 (2026-05-16) — append the AI turn index to the per-topic
     * fire-log so canRefire can compute counts + turn gaps for sticky
     * topics (tax-implication, notice-buyout, range-to-point). The
     * legacy `reactiveFollowupsFired` array stays as a dedup ledger for
     * single-fire topics. */
    const priorLog = state.reactiveFollowupsFireLog ?? {};
    const priorTurns = priorLog[move.askedTopic] ?? [];
    next.reactiveFollowupsFireLog = {
      ...priorLog,
      [move.askedTopic]: [...priorTurns, state.turnIndex],
    };
  }
  /* Fix 1 (2026-05-16) — record structural lever emissions onto the
   * leversFired ledger so the planner's pickStructuralLever rotation
   * advances correctly. Gated on actionKind being one of the new
   * Indian-context lever kinds. */
  const STRUCTURAL_LEVERS = new Set<string>([
    "band-anchor-with-rationale",
    "lever-grade-upgrade",
    "lever-retention-bonus",
    "lever-rsu-refresh",
    "lever-relocation",
    "lever-perf-bonus-cadence",
    "lever-joining-bonus-explained",
  ]);
  if (move.actionKind && STRUCTURAL_LEVERS.has(move.actionKind)) {
    const firedLevers = state.leversFired ?? [];
    if (!firedLevers.includes(move.actionKind)) {
      next.leversFired = [...firedLevers, move.actionKind];
    } else {
      next.leversFired = firedLevers;
    }
  }
  /* F7 (PDF#20 2026-05-15) — push the asked topic onto the askedTopics
   * ledger so planNextAction can skip same-topic probes within 3 turns.
   * Use move.askedTopic if set (reactive-followups), otherwise fall back
   * to move.lever (discovery probes carry the lever key "probe" which is
   * less specific, but move.actionKind carries the item string for
   * discovery-probe moves). Use the most-specific available key. */
  {
    const topicKey =
      move.askedTopic ??
      (move.actionKind && move.actionKind !== "reactive-followup" ? move.actionKind : null) ??
      move.lever;
    if (topicKey) {
      const prior = state.askedTopics ?? [];
      next.askedTopics = [...prior, { topic: topicKey, atTurn: next.turnIndex }];
    }
  }
  if (move.newTotalLpa != null && move.newTotalLpa > state.highestOfferMade) {
    next.highestOfferMade = move.newTotalLpa;
  }
  /* PDF #18 root-cause wiring (2026-05-15) — anchor lock on first numeric
   * disclosure. Before this wire, lockAnchor / effectiveAnchorLpa were
   * exported but never called anywhere (orphan helpers — confirmed via
   * full-codebase grep). The PDF #18 real session showed the anchor
   * jumping 54 → 28 LPA mid-flight; band.initialOffer was being
   * recomputed each turn with no immutable lock. We now fire lockAnchor
   * here, at the SINGLE site where the kernel commits an AI move with
   * a number on it. Idempotent — subsequent disclosures don't relock. */
  if (
    move.newTotalLpa != null &&
    Number.isFinite(move.newTotalLpa) &&
    move.newTotalLpa > 0 &&
    !next.anchorLocked
  ) {
    next.anchorLocked = true;
    next.lockedAnchorLpa = move.newTotalLpa;
  }
  /* Bug 7 (2026-05-14) — extract recruiter-fact tokens mentioned in this
   * AI turn and union into recruiterFactsAlreadySaid. Surfaced back via
   * compactTurnBrief so the LLM doesn't restate the same benefits. */
  if (aiText) {
    const newFacts = extractRecruiterFacts(aiText);
    if (newFacts.length > 0) {
      const merged = new Set<string>(state.recruiterFactsAlreadySaid || []);
      for (const f of newFacts) merged.add(f);
      next.recruiterFactsAlreadySaid = Array.from(merged);
    }
  }

  /* Fix 4 (2026-05-15) — remember last bot reply for repetition detection. */
  next.lastBotReply = aiText || null;

  /* PDF#18 follow-up (2026-05-15) — range-disclosure phase enum.
   * When the bot text emits a salary RANGE (detected by the existing
   * detectRangeDisclosure helper), record the turnIndex so derivePhase
   * can transition out of "range-disclosure" once the candidate has
   * reacted. Sticky: once set, do not overwrite (the first range
   * disclosure is the phase marker). */
  if (
    aiText &&
    next.rangeDisclosedAtTurn == null &&
    detectRangeDisclosure(aiText)
  ) {
    next.rangeDisclosedAtTurn = next.turnIndex;
  }

  /* PDF#18 follow-up (2026-05-15) — split-disambiguation subject tag.
   * The move-picker tags the rationale with the next ordered-discovery
   * item the bot is asking about. If that item is the current-CTC
   * fixed/variable split, set lastDisclosureSubject='current'; if it's
   * the expected-CTC split, set 'expected'. The next applyCandidateAnswer
   * call uses this to route the candidate's split utterance to the
   * correct flag (currentCtcFixedVariableSplitDisclosed vs
   * expectedCtcFixedVariableSplitDisclosed). */
  if (typeof move.rationale === "string") {
    if (move.rationale.includes("currentCtcFixedVariableSplitDisclosed")) {
      next.lastDisclosureSubject = "current";
    } else if (move.rationale.includes("expectedCtcFixedVariableSplitDisclosed")) {
      next.lastDisclosureSubject = "expected";
    }

    /* P4 (2026-05-15) — capture the discovery item the bot just asked
     * about so applyCandidateAnswer can attribute refusals to the
     * correct sequence item. The move-picker rationale follows the
     * convention `Discovery incomplete (next: <ITEM>) — ask: ...`. */
    const m = move.rationale.match(/Discovery incomplete \(next:\s*([a-zA-Z]+)\)/);
    if (m) {
      next.lastDiscoveryItemAsked = m[1];
    }
  }

  /* PDF #18 root-cause (2026-05-15) — prune pendingCandidateAcks that
   * this bot turn addressed. Mirror of the pendingPromises fulfillment
   * path. Entries not addressed remain pending and resurface in the
   * next turn brief. */
  if (state.pendingCandidateAcks && state.pendingCandidateAcks.length > 0) {
    const remaining = pruneAcknowledged(state.pendingCandidateAcks, aiText);
    if (remaining.length !== state.pendingCandidateAcks.length) {
      next.pendingCandidateAcks = remaining;
    }
  }

  /* Fix 3 (2026-05-15) — promise-keeping: consume any pending promises
   * the current turn fulfilled, then add any new promises this turn made. */
  if (aiText) {
    const pending = state.pendingPromises ?? [];
    const fulfilled = extractPromisesFulfilled(pending, aiText);
    let remaining = pending;
    if (fulfilled.length > 0) {
      const consumed = new Set(fulfilled);
      remaining = pending.filter(p => !consumed.has(p));
    }
    const newPromises = extractRecruiterPromises(aiText);
    if (newPromises.length > 0) {
      const merged = new Set<string>(remaining);
      for (const p of newPromises) merged.add(p);
      next.pendingPromises = Array.from(merged);
    } else if (fulfilled.length > 0) {
      next.pendingPromises = remaining;
    }
  }
  /* ITEM 3 (2026-05-15) — closeFired: set true when the AI emits a
   * close-acceptance or close-walkaway move so the reactive close-
   * confirmation rule does not re-fire after the session is closing. */
  /* perfect 1 (2026-05-16) — spiral counter. Increment counterRound
   * each time the AI ships a counter-base move; the planner reads
   * this to apply diminishing-concessions on subsequent rounds. */
  if (move.lever === "counter-base") {
    next.counterRound = state.counterRound + 1;
  }
  if (move.lever === "close-acceptance" || move.lever === "close-walkaway") {
    next.closeFired = true;
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
/** Phase 31 (2026-05-14) — centralised component-constraint validator.
 *
 *  Before this helper, `pickAiMove` had an inline check (Phase 12b,
 *  ~line 1924) that compared the proposed counter against
 *  `baseStretch + variableMax` but never against `baseFloor`. The audit
 *  flagged this: a band can declare baseFloor as the structural minimum
 *  base the company will quote, yet the kernel completely ignored it,
 *  so a counter below baseFloor could leave the picker.
 *
 *  Semantics:
 *    A total-CTC value T is structurally valid iff there EXISTS a
 *    (base, variable) decomposition with
 *      baseFloor   ≤ base    ≤ baseStretch
 *      0           ≤ variable ≤ variableMax
 *      base + variable = T
 *
 *    Therefore T must satisfy:
 *      baseFloor                       ≤ T   (else base would have to be < baseFloor)
 *      T ≤ baseStretch + variableMax        (else base would have to exceed baseStretch)
 *
 *  Returns { ok, reason }. Reason discriminates the two failure modes
 *  so the move-picker can react differently — below-floor offers
 *  shouldn't happen and indicate a band-resolution bug; above-cap
 *  offers route to non-cash levers.
 *
 *  Fields are all optional. When a field is absent, the corresponding
 *  half of the constraint is unenforced (treated as ±∞). Legacy bands
 *  without any component metadata always validate as ok. */
export type ComponentConstraintReason = "below-base-floor" | "above-component-cap";

export interface ComponentConstraintResult {
  ok: boolean;
  reason?: ComponentConstraintReason;
}

export function validateComponentConstraints(
  band: NegotiationBand,
  proposedTotalLpa: number,
): ComponentConstraintResult {
  if (band.baseFloor != null && proposedTotalLpa + 0.01 < band.baseFloor) {
    return { ok: false, reason: "below-base-floor" };
  }
  if (band.baseStretch != null) {
    const componentCap = band.baseStretch + (band.variableMax ?? 0);
    if (proposedTotalLpa > componentCap + 0.01) {
      return { ok: false, reason: "above-component-cap" };
    }
  }
  return { ok: true };
}

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
  "range-disclosure",
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
  "compensation-summary",
  "notice-period-summary",
  "hike-context-summary",
  "hold-firm",
  "close-acceptance",
  "close-walkaway",
  "close-stalemate",
  "terminal-restate",
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
  if (s.stalemateAtTurn !== undefined && s.stalemateAtTurn !== null && !isFiniteNonNegInt(s.stalemateAtTurn)) throw new Error("state.stalemateAtTurn");
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
  /* perfect 1 (2026-05-16) — counterRound spiral counter. Optional for
   * back-compat with sessions serialized before this field shipped. */
  if (s.counterRound !== undefined && !isFiniteNonNegInt(s.counterRound)) throw new Error("state.counterRound");
  if (s.recentRecoveryActive !== undefined && typeof s.recentRecoveryActive !== "boolean") throw new Error("state.recentRecoveryActive");
  if (s.walkAwayReturned !== undefined && typeof s.walkAwayReturned !== "boolean") throw new Error("state.walkAwayReturned");
  if (s.pendingCandidateAcks !== undefined) {
    if (!Array.isArray(s.pendingCandidateAcks)) throw new Error("state.pendingCandidateAcks");
    for (const entry of s.pendingCandidateAcks) {
      if (!entry || typeof entry !== "object") throw new Error("state.pendingCandidateAcks[].shape");
      const e = entry as Record<string, unknown>;
      if (typeof e.kind !== "string") throw new Error("state.pendingCandidateAcks[].kind");
      if (typeof e.label !== "string") throw new Error("state.pendingCandidateAcks[].label");
    }
  }
  /* Negotiation-flow redesign commit 4 (2026-05-15) — reactiveFollowupsFired
   * is optional + sticky. Reject only malformed shape. */
  if (s.reactiveFollowupsFired !== undefined) {
    if (!Array.isArray(s.reactiveFollowupsFired) || !s.reactiveFollowupsFired.every((v) => typeof v === "string")) {
      throw new Error("state.reactiveFollowupsFired");
    }
  }
  /* Polish 2 (2026-05-16) — reactiveFollowupsFireLog validator. */
  if (s.reactiveFollowupsFireLog !== undefined) {
    if (
      s.reactiveFollowupsFireLog === null ||
      typeof s.reactiveFollowupsFireLog !== "object" ||
      Array.isArray(s.reactiveFollowupsFireLog)
    ) {
      throw new Error("state.reactiveFollowupsFireLog");
    }
    for (const [k, v] of Object.entries(s.reactiveFollowupsFireLog)) {
      if (typeof k !== "string") throw new Error("state.reactiveFollowupsFireLog.key");
      if (!Array.isArray(v) || !v.every((n) => typeof n === "number" && Number.isFinite(n))) {
        throw new Error("state.reactiveFollowupsFireLog.value");
      }
    }
  }
  /* Fix 1 (2026-05-16) — leversFired ledger validator. */
  if (s.leversFired !== undefined) {
    if (!Array.isArray(s.leversFired) || !s.leversFired.every((v) => typeof v === "string")) {
      throw new Error("state.leversFired");
    }
  }
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
  /* Bug 7 — recruiter-facts-already-said. Optional + string array. */
  if (s.recruiterFactsAlreadySaid !== undefined) {
    if (!Array.isArray(s.recruiterFactsAlreadySaid) || !s.recruiterFactsAlreadySaid.every((v) => typeof v === "string")) {
      throw new Error("state.recruiterFactsAlreadySaid");
    }
  }
  /* Fix 3 (2026-05-15) — pendingPromises optional + string array. */
  if (s.pendingPromises !== undefined) {
    if (!Array.isArray(s.pendingPromises) || !s.pendingPromises.every((v) => typeof v === "string")) {
      throw new Error("state.pendingPromises");
    }
  }
  /* Fix 4 (2026-05-15) — lastBotReply optional + string-or-null. */
  if (s.lastBotReply !== undefined && s.lastBotReply !== null && typeof s.lastBotReply !== "string") {
    throw new Error("state.lastBotReply");
  }
  /* Fix 7 (2026-05-15) — anchorLocked optional boolean, lockedAnchorLpa optional number-or-null. */
  if (s.anchorLocked !== undefined && typeof s.anchorLocked !== "boolean") {
    throw new Error("state.anchorLocked");
  }
  if (
    s.lockedAnchorLpa !== undefined &&
    s.lockedAnchorLpa !== null &&
    (typeof s.lockedAnchorLpa !== "number" || !Number.isFinite(s.lockedAnchorLpa))
  ) {
    throw new Error("state.lockedAnchorLpa");
  }
  /* Fix 3 (PDF #17 follow-up, 2026-05-15) — minTurnsBeforeClose optional number. */
  if (
    s.minTurnsBeforeClose !== undefined &&
    (typeof s.minTurnsBeforeClose !== "number" || !Number.isFinite(s.minTurnsBeforeClose) || s.minTurnsBeforeClose < 0)
  ) {
    throw new Error("state.minTurnsBeforeClose");
  }
  /* PDF #17 architectural fix (2026-05-15) — discoveryChecklist
   * optional; when present every key must be boolean. */
  if (s.discoveryChecklist !== undefined) {
    const dc = s.discoveryChecklist as Record<string, unknown>;
    if (!dc || typeof dc !== "object") throw new Error("state.discoveryChecklist");
    const keys: (keyof DiscoveryChecklist)[] = [
      "currentCtcAsked", "currentCtcAnswered",
      "fixedVariableSplitAsked", "fixedVariableSplitAnswered",
      "noticePeriodAsked", "noticePeriodAnswered",
      "competingOffersAsked", "competingOffersAnswered",
      "valueProofAsked", "valueProofAnswered",
      "targetAsked", "targetAnswered",
      "variableComfortTested", "commitmentValidationAsked",
      "currentCtcFixedVariableSplitDisclosed",
      "expectedCtcFixedVariableSplitDisclosed",
    ];
    for (const k of keys) {
      if (dc[k] !== undefined && typeof dc[k] !== "boolean") {
        throw new Error(`state.discoveryChecklist.${k}`);
      }
    }
  }
  if (s.discoveryStage !== undefined && !isValidDiscoveryStage(s.discoveryStage)) {
    throw new Error("state.discoveryStage");
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
    /* Audit Pass 3 / Fix 1 (2026-05-16) — backfill stalemate ledger
     * for in-flight sessions serialized before this field shipped. */
    stalemateAtTurn: (s.stalemateAtTurn as number | null | undefined) ?? null,
    firstAnchoredTarget:
      typeof s.firstAnchoredTarget === "number"
        ? s.firstAnchoredTarget
        : (s.candidateTarget as number | null) ?? null,
    finalOfferAssertedCount: s.finalOfferAssertedCount ?? 0,
    vossTacticsUsed: (s.vossTacticsUsed as VossTactic[] | undefined) ?? [],
    infoAsked: (s.infoAsked as InfoIntent[] | undefined) ?? [],
    verbalAcceptanceTurn: s.verbalAcceptanceTurn ?? null,
    postVerbalRenegotiationCount: (s.postVerbalRenegotiationCount as number | undefined) ?? 0,
    counterRound: (s.counterRound as number | undefined) ?? 0,
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
    freshGradDisclosed: (s.freshGradDisclosed as boolean | undefined) ?? false,
    recruiterFactsAlreadySaid: (s.recruiterFactsAlreadySaid as string[] | undefined) ?? [],
    pendingPromises: (s.pendingPromises as string[] | undefined) ?? [],
    lastBotReply: (s.lastBotReply as string | null | undefined) ?? null,
    anchorLocked: (s.anchorLocked as boolean | undefined) ?? false,
    lockedAnchorLpa: (s.lockedAnchorLpa as number | null | undefined) ?? null,
    /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard. */
    minTurnsBeforeClose: (s.minTurnsBeforeClose as number | undefined) ?? 8,
    /* PDF #17 architectural fix (2026-05-15) — discovery-first state
     * machine fields. Optional for back-compat with in-flight sessions. */
    discoveryChecklist: backfillDiscoveryChecklist(s.discoveryChecklist),
    discoveryStage: (s.discoveryStage as DiscoveryStage | undefined) ?? "discovery",
    /* Bug-report 12 (2026-05-14) — per-turn fresh-counter signal.
     * Optional for back-compat; defaults to null (treat in-flight
     * sessions as if no fresh counter has been parsed). */
    lastCandidateCounterLpa: (s.lastCandidateCounterLpa as number | null | undefined) ?? null,
    /* PDF #18 (2026-05-15) — candidate-disclosure acks. Optional; omit
     * when empty to keep serialized wire size small. */
    pendingCandidateAcks: (s.pendingCandidateAcks as NegotiationState["pendingCandidateAcks"]) ?? undefined,
    /* Negotiation-flow redesign commit 4 (2026-05-15) — reactive-followup
     * ledger. Sticky across the session (never cleared by applyAiMove).
     * Optional for back-compat with sessions serialized before commit 4. */
    reactiveFollowupsFired: (s.reactiveFollowupsFired as string[] | undefined) ?? [],
    /* Polish 2 (2026-05-16) — per-topic fire-history. Back-compat
     * default = empty record. */
    reactiveFollowupsFireLog:
      (s.reactiveFollowupsFireLog as Record<string, number[]> | undefined) ?? {},
    /* Fix 1 (2026-05-16) — leversFired back-compat default. */
    leversFired: (s.leversFired as string[] | undefined) ?? [],
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
 * sessions serialized candidateProfile without these keys; backfill them.
 * Uses EMPTY_CANDIDATE_PROFILE spread so new wave flags are always present.
 *
 * Backcompat: the following flags were pruned in commit "perfect 6" but
 * old persisted snapshots may carry them. Silently dropped via the
 * known-keys filter below (raw entries whose key is not in the current
 * EMPTY_CANDIDATE_PROFILE shape are discarded):
 *   prefersEquityOverCash, hasVestingCliff, rsuVestingAware, esopHolder,
 *   riskAverse, prefersMnc, prefersStartup, openToRelocation, remotePref,
 *   likelyToCounter, acceptedFirstOffer, hasWalkedAway, anchorsHigh,
 *   softOnRange, noticePeriodFlexible, joiningUrgency, isIcToManager,
 *   hasLeadershipExperience, domainSpecialist, multipleCompaniesInTwoYears,
 *   currentHasBonus, currentBonusPct, currentHasEsop, currentEsopVested,
 *   currentHasRetentionBonus, currentHasGratuity, currentHasNps,
 *   wantsHigherBonus, wantsFlexibleWork, wantsLearningBudget,
 *   wantsEquityRefresh, wantsProfessionalTitle, hasSeenOffer,
 *   offerDeadlineMentioned, offerDeadlineText, negotiatingMultipleOffers,
 *   prefersCashOverPerks, perksImportant, anchoredFirst, anchorWasHighball,
 *   retreatedFromAnchor, acceptedCounterQuickly, respondedToBudgetCeiling,
 *   pushedBackOnCeiling, expressedUrgency, expressedHesitation,
 *   usedRecruiterName, saidThankYou, askedAboutTeam, askedAboutWorkLifeBalance,
 *   dramaticAnchorJump, mentionedCounterOffer, mentionedLayoffRisk,
 *   seemsRushed, firstOfferReaction, explicitlyRejectedOffer,
 *   askedForTimeToDecide, mentionedRelocation, mentionedPf, mentionedGratuity,
 *   mentionedVariablePayout, mentionedSigningBonus, mentionedRetentionBonus,
 *   mentionedJoiningBonus, askedAboutPerformanceCycle, mentionedTargetRole,
 *   competingOfferIsVerbal, competingOfferCompany, competingOfferDeadline,
 *   showedFrustration, showedExcitement, usedSilence,
 *   backtrackedOnExpectation, escalatedDemand, mentionedRelievingLetterRisk,
 *   mentionedNoticeWaiver, mentionedNoticeBuyout, isFirstJobChange,
 *   hasManagementExperience, mentionedStartupExperience,
 *   mentionedMncExperience, hasPhdOrMba, usedAnchorFirst, mentionedCostOfLiving,
 *   wantsHigherBase (kept as live), wantsRelocationAllowance (kept as live),
 *   wantsJoiningBonus (kept as live).
 */
function backfillCandidateProfile(raw: unknown): CandidateProfileResult {
  const v = raw as Partial<CandidateProfileResult> | undefined;
  /* Spread EMPTY first so every required field has a default, then overlay
   * whatever the legacy payload carried (undefined values from the partial
   * are filtered out so they don't overwrite the defaults). Pruned-flag
   * keys present in the raw payload but no longer in EMPTY_CANDIDATE_PROFILE
   * are silently dropped via the known-keys filter — see backcompat note
   * above. */
  const knownKeys = new Set(Object.keys(EMPTY_CANDIDATE_PROFILE));
  const defined = Object.fromEntries(
    Object.entries(v ?? {}).filter(
      ([k, val]) => val !== undefined && knownKeys.has(k),
    ),
  ) as Partial<CandidateProfileResult>;
  return { ...EMPTY_CANDIDATE_PROFILE, ...defined };
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
