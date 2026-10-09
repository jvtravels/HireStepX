/* Negotiation kernel: discovery topics, phases, levers, bands, persona + difficulty. */

import { getNextActionPlanner } from "./_planner-registry";
import type { NegotiationState } from "./_negotiation-state-types";

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
export function _callNextActionPlanner(s: unknown): unknown {
  const fn = getNextActionPlanner();
  return fn ? fn(s) : null;
}

/* ─── Discovery topics (ArchRec 2 typed enum, 2026-05-16) ─────────────
 *
 * The `askedTopic` field on AiMove flows into three different ledgers:
 *   - state.askedTopics[].topic   (F7 repetition guard)
 *   - state.reactiveFollowupsFired (single-fire reactive dedup)
 *   - state.reactiveFollowupsFireLog keys (refireable per-topic budget)
 * and is the lookup key for REFIREABLE_TOPICS in _next-action-planner.
 *
 * Before this commit the field was typed `string`, which let typos
 * silently break dedup (`"variable-confort"` would route past
 * canRefire as a fresh topic). This union enumerates every observed
 * topic literal across the three planner sites + the discovery
 * cascade + the wired-profile rules table. Three classes:
 *
 *   1. Discovery checklist keys (both *Asked + *Answered forms — the
 *      cascade emits *Asked as the public item, the ordered variant
 *      uses *Answered as the internal sentinel, and the F7 guard
 *      compares against whichever the planner pushed).
 *   2. Reactive-followup topic names (kebab-case, paired with prose
 *      branches in _canonical-prose.ts).
 *   3. Structural lever / actionKind markers that flow into the F7
 *      ledger via the `move.lever`/`move.actionKind` fallback in
 *      applyAiMove (see the fallback chain below).
 *
 * The fallback in applyAiMove still widens to string at the cast site
 * because `move.lever` is a NegotiationLever (a different union); the
 * dev-mode assertion at that one site catches additions to the lever
 * vocabulary that aren't also registered here. */
export type DiscoveryTopic =
  /* Discovery checklist — *Asked keys (emitted by getNextDiscoveryQuestion
   * and getNextOrderedDiscoveryQuestion as the public `item` value). */
  | "currentCtcAsked"
  | "fixedVariableSplitAsked"
  | "noticePeriodAsked"
  | "competingOffersAsked"
  | "valueProofAsked"
  | "targetAsked"
  /* Discovery checklist — *Answered keys (returned by
   * getNextOrderedDiscoveryItem and observed in F7 repetition-guard
   * test fixtures and applyAiMove fallback paths). */
  | "currentCtcAnswered"
  | "fixedVariableSplitAnswered"
  | "noticePeriodAnswered"
  | "competingOffersAnswered"
  | "valueProofAnswered"
  | "targetAnswered"
  | "currentCtcFixedVariableSplitDisclosed"
  | "expectedCtcFixedVariableSplitDisclosed"
  /* AP3-F2 (2026-05-17) — component-aware discovery probes. Fired by
   * the planner AFTER currentCtc is satisfied for senior comp
   * negotiations (applicableYoe >= 4 OR role matches
   * /senior|lead|principal|staff/i). Each maps to a single component of
   * the candidate's current package; parsing into
   * state.candidateComponentBreakdown is handled by the existing
   * component-breakdown extractor (extractComponentBreakdown +
   * mergeBreakdown), so satisfaction is observed by reading
   * `state.candidateComponentBreakdown.{base,variable,equity}`. */
  | "currentCtcBase"
  | "currentCtcVariable"
  | "currentCtcEsop"
  /* Reactive-followup topics (planReactiveFollowup + planWiredProfileFollowup). */
  | "variable-comfort"
  | "equity-clarity"
  | "competing-credibility"
  | "competing-leverage-ack"
  | "credibility-probe"
  | "ctc-gentle-push"
  | "hike-justification"
  | "notice-buyout"
  | "notice-buyout-confirm"
  | "number-clarification"
  | "value-proof"
  | "answer-direct"
  | "wants-higher-base"
  | "wants-joining-bonus"
  | "wants-relocation-allowance"
  | "title-designation"
  | "spouse-family-context"
  | "reporting-structure"
  | "growth-path"
  | "team-size"
  | "tax-implication"
  | "bgv-concern"
  | "moonlighting-policy"
  | "range-to-point"
  | "range-deflection"
  | "market-data-reference"
  /* PDF#37 (2026-05-20) — freelancer/archetype anchor-clarify reactive
   * followup. P11_FREELANCER candidates need a rate-card probe before
   * a CTC anchor is meaningful. */
  | "anchor-clarify"
  /* Single-fire markers pushed through applyAiMove. */
  | "close-confirmation"
  | "close-recap-formal"
  | "candidate-trial-close"
  /* Audit fix (2026-05-22) — trial-close response classification.
   * Stamped by applyCandidateAnswer when the candidate replies to a
   * trial-close with a hedge or decline (not an accept). The planner
   * uses these to avoid re-asking the same trial close on the next
   * turn. */
  | "candidate-trial-close-hedge"
  | "candidate-trial-close-decline"
  | "comparative-anchoring"
  | "internal-equity-defense"
  /* Phase 3 missing-lever set (2026-05-17) — three additional Indian-HR
   * levers (stall / walkaway / hike-strong rebuttal). actionKinds are
   * registered as DiscoveryTopics so the applyAiMove F7 ledger push
   * passes the dev-only KNOWN_TOPICS guard. */
  | "panel-approval-stall"
  | "polite-walkaway"
  | "anchor-defense-hike-strong"
  /* PDF#42 BUG-A (2026-05-21) — competitor-match. AI's authoritative
   * response after the candidate proves a higher competing offer
   * (proofProvided OR letterShareOffered). Commits to taking the
   * competing number back to the panel with a revert window, instead
   * of routing through lever-explore which historically prompted the
   * candidate ("what else can we add to the fitment?"). Single-fire
   * via state.competitorMatchFiredAtTurn. */
  | "competitor-match"
  /* Phase 2 Indian-HR redesign (2026-05-17) — post-acceptance documentation
   * request actionKind. Pushed onto askedTopics via applyAiMove's F7 ledger
   * so the planner can verify single-fire (in addition to the explicit
   * postAcceptanceDocsRequestedAtTurn marker). */
  | "post-acceptance-document-request"
  /* Structural-lever actionKinds — pushed onto askedTopic by
   * makeStructuralLeverAction so applyAiMove can route them through
   * the F7 ledger uniformly. */
  | "band-anchor-with-rationale"
  /* Phase 2 Indian-HR redesign (2026-05-17) — point-offer anchor lever
   * actionKind (replaces the legacy `anchor-with-band` kind that emitted
   * a range). Single-fire per session via askedTopics ledger. */
  | "anchor-with-offer"
  | "lever-grade-upgrade"
  | "lever-retention-bonus"
  | "lever-rsu-refresh"
  | "lever-relocation"
  | "lever-perf-bonus-cadence"
  | "lever-work-mode"
  | "lever-growth-path"
  | "lever-joining-bonus-explained"
  /* NegotiationLever values (move.lever fallback in applyAiMove pushes
   * these onto state.askedTopics when no askedTopic/actionKind is set).
   * Mirrors the NegotiationLever union below so the fallback is
   * exhaustively covered by the type. */
  | "open-with-offer"
  | "probe"
  | "probe-justification"
  | "counter-base"
  | "joining-bonus"
  | "equity-grant"
  | "benefits-summary"
  | "compensation-summary"
  | "notice-period-summary"
  | "hike-context-summary"
  | "hold-firm"
  | "close-acceptance"
  | "close-walkaway"
  | "close-stalemate"
  | "terminal-restate"
  | "ctc-inflation-anchor"
  /* PDF#29 Bug 7 (2026-05-18) — frustration-recovery actionKind. Pushed
   * onto state.askedTopics by applyAiMove so the F7 ledger records the
   * single-fire emission alongside the lastUserFrustrated clear. */
  | "acknowledge-and-recover"
  /* PDF#34 Fix 3 (2026-05-18) — clarification response actionKind.
   * Pushed onto state.askedTopics by applyAiMove so the F7 ledger sees
   * the single-fire emission; the planner consults
   * lastAnswerClarificationAtTurn to decide whether to re-fire. */
  | "clarify-prior-question"
  /* Prior-context feature (2026-05-29) — caller-declared upfront
   * context shapers. Stamped through applyAiMove's askedTopics push so
   * the planner observes single-fire via reactiveFollowupsFired. They
   * are NOT discovery probes — the bot is acknowledging / reacting to
   * context the user declared at session init, not asking a fresh
   * question — so the askedTopics ledger entry doubles as a "this arm
   * fired" marker rather than a discovery-completion stamp. */
  | "acknowledge-existing-offer"
  | "acknowledge-retention-offer"
  | "match-existing-offer-prose"
  | "retention-trump-warning"
  /* S23-B1 (2026-07-21) — recruiter grants thinking time to the candidate. */
  | "hold-grant";

/** Exhaustiveness helper. Used in topic switches so adding a new
 *  DiscoveryTopic literal lights up at every consumer site that hasn't
 *  been updated. */
export function assertNever(x: never): never {
  throw new Error(`Unhandled discriminant: ${String(x)}`);
}

/** Dev-only guard against silent additions of unknown topic strings
 *  pushed through the `move.lever`/`move.actionKind` fallback in
 *  applyAiMove. In production we let unknown strings pass (back-compat
 *  with sessions serialized before this commit). In dev we throw so
 *  the test suite forces every new lever/actionKind that flows into
 *  the F7 ledger to be registered as a DiscoveryTopic. */
export const KNOWN_TOPICS: ReadonlySet<string> = new Set<DiscoveryTopic>([
  "currentCtcAsked", "fixedVariableSplitAsked", "noticePeriodAsked",
  "competingOffersAsked", "valueProofAsked", "targetAsked",
  "currentCtcAnswered", "fixedVariableSplitAnswered", "noticePeriodAnswered",
  "competingOffersAnswered", "valueProofAnswered", "targetAnswered",
  "currentCtcFixedVariableSplitDisclosed", "expectedCtcFixedVariableSplitDisclosed",
  /* AP3-F2 (2026-05-17) — component-aware discovery topics. */
  "currentCtcBase", "currentCtcVariable", "currentCtcEsop",
  "variable-comfort", "equity-clarity", "competing-credibility",
  "competing-leverage-ack", "credibility-probe", "ctc-gentle-push",
  "hike-justification", "notice-buyout", "notice-buyout-confirm",
  "number-clarification", "value-proof", "answer-direct",
  "wants-higher-base", "wants-joining-bonus", "wants-relocation-allowance",
  "title-designation",
  "spouse-family-context", "reporting-structure", "growth-path", "team-size",
  "tax-implication", "bgv-concern", "moonlighting-policy",
  "range-to-point", "range-deflection", "market-data-reference",
  /* PDF#37 (2026-05-20). */
  "anchor-clarify",
  "close-confirmation", "close-recap-formal", "candidate-trial-close",
  "candidate-trial-close-hedge", "candidate-trial-close-decline",
  "comparative-anchoring", "internal-equity-defense", "band-anchor-with-rationale",
  "panel-approval-stall", "polite-walkaway", "anchor-defense-hike-strong",
  /* PDF#42 BUG-A (2026-05-21). */
  "competitor-match",
  "anchor-with-offer", "post-acceptance-document-request",
  "lever-grade-upgrade", "lever-retention-bonus", "lever-rsu-refresh",
  "lever-relocation", "lever-perf-bonus-cadence", "lever-joining-bonus-explained",
  "lever-work-mode", "lever-growth-path",
  "open-with-offer", "probe", "probe-justification", "counter-base",
  "joining-bonus", "equity-grant", "benefits-summary", "compensation-summary",
  "notice-period-summary", "hike-context-summary", "hold-firm",
  "close-acceptance", "close-walkaway", "close-stalemate", "terminal-restate",
  /* PDF#29 Bug 7 (2026-05-18). */
  "acknowledge-and-recover",
  /* PDF#34 Fix 3 (2026-05-18). */
  "clarify-prior-question",
  /* Prior-context feature (2026-05-29) — caller-declared upfront
   * context shapers. */
  "acknowledge-existing-offer",
  "acknowledge-retention-offer",
  "match-existing-offer-prose",
  "retention-trump-warning",
  /* S23-B1 (2026-07-21) — recruiter grants thinking time. */
  "hold-grant",
]);

export function isDiscoveryTopic(s: string): s is DiscoveryTopic {
  return KNOWN_TOPICS.has(s);
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

export const TERMINAL_PHASES = new Set<NegotiationPhase>([
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
 *   2. verbal-renege — `postVerbalRenegotiationCount > 0` (candidate said
 *      yes and is now actively re-opening). Only the move-picker stiffens;
 *      phase wants to stay in `counter-offer` while the bot stiffens, and
 *      any derivation that would otherwise compute a "lower" target phase
 *      should be allowed to land on counter-offer. Gated on the active
 *      renege count, not the permanent `verbalAcceptanceTurn` stamp, so a
 *      clean acceptance is never dragged backward.
 *
 * Terminal phases share rank so they never transition between each
 * other except via the walk-away-reopen exception. The two non-walk-away
 * terminals (accepted / stalemate) are absorbing under normal flow.
 *
 * Removes the prior ad-hoc sticky clauses (POST_PROBE_PHASES /
 * isPostProbe / alreadyProbed) inside derivePhase — once monotonicity
 * is structural, those one-off `if` clauses become unnecessary. */
export const PHASE_RANK: Record<NegotiationPhase, number> = {
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
  /* Exception 2: verbal-renege — the candidate previously said yes but is
   * now actively asking for more. The state-machine intentionally drops
   * back to `counter-offer` while the move-picker stiffens. If derivation
   * produces `counter-offer` and we're sitting in a higher phase like
   * `lever-explore` or `closing-push`, permit the regression so the
   * stiffening path runs cleanly.
   *
   * 2026-06-15 architecture audit — Kernel Finding 3: gate on an ACTIVE
   * renege (postVerbalRenegotiationCount > 0, incremented in
   * applyCandidateAnswer the moment the candidate reopens) rather than the
   * permanent `verbalAcceptanceTurn != null` stamp. The stamp never
   * clears, so the old gate let a clean acceptance be dragged backward to
   * counter-offer indefinitely by any stray counter-offer derivation. The
   * counter only implies the stamp is set, so this is strictly narrower. */
  if (state.postVerbalRenegotiationCount > 0 && to === "counter-offer") return true;
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
  | "terminal-restate"
  /* PDF#29 Bug 7 (2026-05-18) — frustration-recovery move. The bot
   * acknowledges that it looped on a topic the candidate already
   * answered and breaks out of the loop. Not a comp lever; no
   * newTotalLpa is emitted. Single-fire is enforced by the planner
   * via state.lastUserFrustrated being one-shot. */
  | "acknowledge-and-recover"
  /* Audit fix 2026-05-21 — CTC-inflation anchor. Recruiter anchors high
   * on the TOTAL PACKAGE while breaking it into fixed/variable/ESOP-
   * paper/JB/benefits, weaponising the CTC-vs-in-hand confusion that
   * Indian candidates routinely hit. The framing is the lie; the
   * numbers are accurate. When the candidate later asks for the
   * in-hand breakdown, a separate truthful render is shipped (see
   * `_ctc-inflation.ts`). Single-fire per session via the planner. */
  | "ctc-inflation-anchor";

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
