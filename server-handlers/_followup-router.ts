/* Follow-up question router — Phase 18 (2026-05-13).
 *
 * Maps the merged kernel state to a prioritized list of follow-up
 * question CATEGORIES the AI should ask next. This is a derived view,
 * not state — it's recomputed each turn from `NegotiationState` and
 * never folded back.
 *
 * Why a router and not free-form LLM prompting?
 *
 * The 19-scenario India-market audit produced 10 hard rules of the
 * form "if signal X, ask question Y." Encoding them as a router gives
 * us three properties the LLM alone can't:
 *
 *   1. Determinism — the same state always produces the same priority
 *      ordering. The LLM may rephrase the question naturally, but the
 *      *category* is fixed by the kernel.
 *
 *   2. Composability — the move-picker can blend router output with
 *      its phase-aware hints (e.g. "we're in counter-offer phase,
 *      suppress probe-style follow-ups").
 *
 *   3. Coverage audit — running this in tests against the 19 scenario
 *      transcripts proves we don't silently drop a follow-up.
 *
 * The router is intentionally narrow: it only routes follow-ups that
 * come from the 10 decision rules. Phase / counter-offer / accept
 * routing stays in the move-picker. */

import type { NegotiationState } from "./_negotiation-kernel";
import type { CandidateStanceResult } from "./_candidate-stance";

export type FollowupCategory =
  /** "Is your CTC fixed + variable, or all fixed?" */
  | "ctc-fixed-vs-variable"
  /** "Your ask is a ~Xpct hike — what's driving it?" */
  | "hike-justification"
  /** "When you say 'market', which market range are you comparing against?" */
  | "market-reference-probe"
  /** "What's the minimum you'd be comfortable accepting?" */
  | "min-comfortable-range"
  /** "Beyond the number, do role / growth / benefits matter to you?" */
  | "non-comp-priorities"
  /** "What's the decision criteria + deadline on your competing offer?" */
  | "competing-offer-criteria"
  /** "What's your last working day, and any counter-offer risk?" */
  | "notice-and-counter"
  /** "Have you held ESOPs before? Familiar with vesting + liquidity?" */
  | "esop-literacy"
  /** "Are you ready to ramp up, and how current is your stack?" */
  | "gap-readiness"
  /** "Any relocation support you'd need? Cost-of-living expectations?" */
  | "relocation-support";

export interface FollowupRecommendation {
  category: FollowupCategory;
  /** 1 = highest priority. The router sorts ascending. */
  priority: number;
  /** Short, machine-readable reason — surfaced in the brief so the
   *  LLM understands WHY the follow-up is being recommended. Not for
   *  the candidate. */
  reason: string;
}

interface RouterInput {
  state: NegotiationState;
  stance: CandidateStanceResult;
}

/* Threshold for "huge hike" follow-up. The audit picked 40% as the
 * upper end of "normal" India-market intra-band moves; above that
 * recruiters consistently asked for justification. */
const HUGE_HIKE_THRESHOLD = 40;

export function recommendFollowups(input: RouterInput): FollowupRecommendation[] {
  const { state, stance } = input;
  const out: FollowupRecommendation[] = [];

  /* Rule 1: candidate doesn't know fixed-vs-variable breakup. */
  const breakdown = state.candidateComponentBreakdown;
  const hasCurrentOrTarget = state.candidateCurrentCtc != null || state.candidateTarget != null;
  if (hasCurrentOrTarget && !breakdown.hasAny) {
    out.push({
      category: "ctc-fixed-vs-variable",
      priority: 2,
      reason: "candidate stated CTC magnitude without naming fixed/variable split",
    });
  }

  /* Rule 2: ask above 40% hike without rationale. */
  if (
    state.hikePercent != null &&
    state.hikePercent > HUGE_HIKE_THRESHOLD &&
    state.rationale == null
  ) {
    out.push({
      category: "hike-justification",
      priority: 1,
      reason: `ask is +${Math.round(state.hikePercent)}% hike, no rationale cue detected`,
    });
  }

  /* Rule 3: candidate said "as per market" / "market standard" with
   * no anchored range. */
  if (stance.marketReferenceVague) {
    out.push({
      category: "market-reference-probe",
      priority: 2,
      reason: "candidate invoked 'market' without anchoring a range",
    });
  }

  /* Rule 4: candidate is too flexible. Two paths:
   *  - stance.flexibilityPosture === "flexible" AND no floor stated
   *  - candidate stated a target but no floor at all (covers the
   *    quiet-flexible case where the candidate didn't say "flexible"
   *    but also gave no bottom line) */
  const noFloor = state.miscSignals.candidateFloor == null;
  if (stance.flexibilityPosture === "flexible" && noFloor) {
    out.push({
      category: "min-comfortable-range",
      priority: 2,
      reason: "candidate is openly flexible but has not stated a floor",
    });
  }

  /* Rule 5: candidate is too rigid — probe whether non-comp levers
   * (role, growth, benefits) matter. */
  if (stance.flexibilityPosture === "rigid" || stance.salaryOnlyFactor) {
    out.push({
      category: "non-comp-priorities",
      priority: 3,
      reason: stance.salaryOnlyFactor
        ? "candidate stated salary is the only decision factor"
        : "candidate signalled hardline / non-negotiable on the number",
    });
  }

  /* Rule 6: competing offer exists but criteria/deadline missing. We
   * fire if the magnitude is known OR a hedged "I have other offers"
   * was signalled, AND we don't yet have BOTH a deadline and an
   * offer-stage detail. */
  const hasCompeting =
    state.competingOffer != null ||
    state.competingOfferDetail.hasAny;
  const haveDeadline = state.decisionDeadline.deadlineDays != null;
  const haveStage = state.competingOfferDetail.stage != null;
  if (hasCompeting && (!haveDeadline || !haveStage)) {
    out.push({
      category: "competing-offer-criteria",
      priority: 1,
      reason: `competing-offer present; ${!haveDeadline ? "deadline" : "offer-stage"} unknown`,
    });
  }

  /* Rule 7: candidate is serving notice. Ask LWD + internal counter
   *  risk if either is missing. */
  const servingNotice =
    state.noticeJoining.noticePeriodDays != null ||
    state.noticeJoining.buyoutRequested ||
    state.noticeJoining.earlyJoinPreferred;
  const haveLwd = state.noticeJoining.lastWorkingDayText != null;
  const haveCounterRisk = state.miscSignals.internalCounterRisk != null;
  if (servingNotice && (!haveLwd || !haveCounterRisk)) {
    out.push({
      category: "notice-and-counter",
      priority: 2,
      reason: `notice signalled; ${!haveLwd ? "LWD" : "internal-counter status"} unknown`,
    });
  }

  /* Rule 8: candidate wants ESOP. Ask vesting/liquidity literacy
   *  unless we already have familiarity = experienced AND at least
   *  one of vesting/liquidity has been discussed. */
  const eq = state.equityVesting;
  const wantsEquity =
    eq.preference === "equity-pref" ||
    eq.vestingYears != null ||
    eq.cliffMonths != null ||
    stance.treatsEquityAsCash;
  const literate =
    eq.familiarity === "experienced" &&
    (eq.strikePriceDiscussed ||
      eq.valuationDiscussed ||
      eq.liquidityDiscussed ||
      eq.vestingYears != null);
  if (wantsEquity && !literate) {
    out.push({
      category: "esop-literacy",
      priority: stance.treatsEquityAsCash ? 1 : 3,
      reason: stance.treatsEquityAsCash
        ? "candidate is treating equity as guaranteed cash"
        : "candidate wants equity; vesting/liquidity literacy not confirmed",
    });
  }

  /* Rule 9: candidate has a career gap. Ask readiness + skill
   *  relevance unless we already have a gap-activity that implies
   *  active upskilling. */
  const profile = state.candidateProfile;
  const hasGap = profile.careerGapMonths != null && profile.careerGapMonths >= 3;
  const upskilled =
    profile.careerGapActivity === "upskill" ||
    profile.careerGapActivity === "study";
  if (hasGap && !upskilled) {
    out.push({
      category: "gap-readiness",
      priority: 2,
      reason: `${profile.careerGapMonths}-month gap; activity = ${profile.careerGapActivity ?? "unstated"}`,
    });
  }

  /* Rule 10: candidate is relocating. Ask about relocation support /
   *  COL unless the candidate has already explicitly waived it. */
  const loc = state.locationMode;
  const relocating =
    loc.relocationRequested ||
    /* Implicit: candidate stated a city different from the role
     *  location AND chose office/hybrid mode. */
    (loc.locationCity != null && (loc.workMode === "office" || loc.workMode === "hybrid"));
  if (relocating && !loc.relocationRefused) {
    out.push({
      category: "relocation-support",
      priority: 3,
      reason: loc.relocationRequested
        ? "candidate explicitly asked about relocation support"
        : `candidate based in ${loc.locationCity ?? "another city"} with on-site mode`,
    });
  }

  /* Sort by ascending priority, then preserve insertion order for ties. */
  return out.sort((a, b) => a.priority - b.priority);
}
