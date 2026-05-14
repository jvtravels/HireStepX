/* Phase 34 (2026-05-14) — structured kernel-level audit events.
 *
 * Before this module the kernel emitted no structured trail; post-
 * mortems on production sessions relied on the route handler's freeform
 * logs, which capture the LLM prose and a few request fields but not
 * the kernel's STATE TRANSITIONS. That made root-causing the Bug-12
 * close-floor regression unnecessarily archaeological — we had to
 * reconstruct what the kernel did from what the LLM eventually said.
 *
 * deriveKernelEvents(prev, next, move?) is a pure function over a state
 * diff: same inputs, same events. It can be called from anywhere — the
 * route handler typically calls it after applyCandidateAnswer and again
 * after applyAiMove, sending events to whatever sink it uses (PostHog,
 * structured stdout, blob storage).
 *
 * Design constraints:
 *   - PURE. No clock (timestamps belong to the sink). No IO. No throws.
 *   - SOURCE OF TRUTH IS THE DIFF. We don't introspect kernel internals;
 *     we describe what *changed* between two states. This keeps the
 *     audit decoupled from kernel implementation details.
 *   - EVENT TYPES ARE A CLOSED UNION. Each one names exactly one kind
 *     of transition. No catch-all "STATE_CHANGED" event.
 *   - NEVER FAIL SILENTLY. If a diff doesn't match any event type we
 *     simply emit nothing — but every kernel transition that matters
 *     for debugging has a corresponding event type.
 */

import type { NegotiationState, AiMove } from "./_negotiation-kernel";

/* ─── Event taxonomy ────────────────────────────────────────────────── */

export type KernelEventType =
  | "PHASE_TRANSITION"
  | "TERMINAL_ENTRY"
  | "FRESH_GRAD_DISCLOSED"
  | "BAND_REBASED"
  | "HARD_BAND_CAP_FLIPPED"
  | "VERBAL_ACCEPTANCE_RECORDED"
  | "POST_VERBAL_RENEGOTIATION"
  | "HIGHEST_OFFER_BUMPED"
  | "ACCEPT_CLAMPED_TO_FLOOR"
  | "LEVER_FIRED"
  | "JOINING_BONUS_SET"
  | "WALK_AWAY_RETURNED";

/** Discriminated union — every event carries a `type` plus typed payload. */
export type KernelEvent =
  | { type: "PHASE_TRANSITION"; from: NegotiationState["phase"]; to: NegotiationState["phase"]; turn: number }
  | { type: "TERMINAL_ENTRY"; phase: "accepted" | "walked-away" | "stalemate"; turn: number }
  | { type: "FRESH_GRAD_DISCLOSED"; turn: number }
  | { type: "BAND_REBASED"; turn: number; fromInitialOffer: number; toInitialOffer: number; reason: "fresh-grad-disclosure" }
  | { type: "HARD_BAND_CAP_FLIPPED"; turn: number; candidateBase: number | null; bandBaseStretch: number | null }
  | { type: "VERBAL_ACCEPTANCE_RECORDED"; turn: number }
  | { type: "POST_VERBAL_RENEGOTIATION"; turn: number; count: number }
  | { type: "HIGHEST_OFFER_BUMPED"; turn: number; from: number; to: number }
  | { type: "ACCEPT_CLAMPED_TO_FLOOR"; turn: number; candidateAsk: number; closedAt: number }
  | { type: "LEVER_FIRED"; turn: number; lever: AiMove["lever"]; newTotalLpa: number | null }
  | { type: "JOINING_BONUS_SET"; turn: number; amount: number }
  | { type: "WALK_AWAY_RETURNED"; turn: number };

/** Derive the structured events that describe the transition from
 *  `prev` to `next`. Optional `move` lets us attribute LEVER_FIRED /
 *  ACCEPT_CLAMPED_TO_FLOOR to a specific AI action (only set when
 *  applyAiMove was the transition source). */
export function deriveKernelEvents(
  prev: NegotiationState,
  next: NegotiationState,
  move?: AiMove,
): KernelEvent[] {
  const events: KernelEvent[] = [];
  const turn = next.turnIndex;

  /* Phase transition — any phase change is recorded so debugging can
   * scrub through the timeline. Terminal entries get a second, more
   * specific event so filters on "terminal happened on turn N" don't
   * need to join two fields. */
  if (prev.phase !== next.phase) {
    events.push({ type: "PHASE_TRANSITION", from: prev.phase, to: next.phase, turn });
    if (next.phase === "accepted" || next.phase === "walked-away" || next.phase === "stalemate") {
      events.push({ type: "TERMINAL_ENTRY", phase: next.phase, turn });
    }
  }

  /* Fresh-grad disclosure — the flag is sticky, so we only emit on
   * the rising edge. Band rebase (Phase 30) typically fires in the
   * same applyCandidateAnswer call; emit both so the trail shows the
   * causal chain. */
  if (!prev.freshGradDisclosed && next.freshGradDisclosed) {
    events.push({ type: "FRESH_GRAD_DISCLOSED", turn });
  }
  if (prev.band.initialOffer !== next.band.initialOffer || prev.band.maxStretch !== next.band.maxStretch) {
    /* The only legitimate mid-session band rebase is fresh-grad. If
     * future code adds another rebase path, extend the reason union. */
    events.push({
      type: "BAND_REBASED",
      turn,
      fromInitialOffer: prev.band.initialOffer,
      toInitialOffer: next.band.initialOffer,
      reason: "fresh-grad-disclosure",
    });
  }

  /* Hard band cap — flipped when the candidate's stated base exceeds
   * the band's baseStretch (Phase 12). Sticky, so rising edge only. */
  if (!prev.hardBandCap && next.hardBandCap) {
    events.push({
      type: "HARD_BAND_CAP_FLIPPED",
      turn,
      candidateBase: next.candidateComponentBreakdown?.base ?? null,
      bandBaseStretch: next.band.baseStretch ?? null,
    });
  }

  /* Verbal acceptance — set when conditional accept lands ("yes if X"
   * or sign-today-bundle). Distinct from terminal acceptance. */
  if (prev.verbalAcceptanceTurn == null && next.verbalAcceptanceTurn != null) {
    events.push({ type: "VERBAL_ACCEPTANCE_RECORDED", turn });
  }
  if (prev.postVerbalRenegotiationCount !== next.postVerbalRenegotiationCount) {
    events.push({ type: "POST_VERBAL_RENEGOTIATION", turn, count: next.postVerbalRenegotiationCount });
  }

  /* Walk-away returned — the candidate left, came back, and we reset
   * to counter-offer (Phase 22). The counter is non-decreasing, but
   * we treat any increment as the signal. */
  if (!prev.walkAwayReturned && next.walkAwayReturned) {
    events.push({ type: "WALK_AWAY_RETURNED", turn });
  }

  /* Highest offer bumped — the AI's offer ratcheted upward this turn.
   * The close-floor invariant relies on this field, so making it
   * auditable is high-value. */
  if (next.highestOfferMade > prev.highestOfferMade) {
    events.push({
      type: "HIGHEST_OFFER_BUMPED",
      turn,
      from: prev.highestOfferMade,
      to: next.highestOfferMade,
    });
  }

  /* Lever fired + JB amount — only when the move was an AI action.
   * applyCandidateAnswer doesn't have a move so these are skipped. */
  if (move) {
    events.push({
      type: "LEVER_FIRED",
      turn,
      lever: move.lever,
      newTotalLpa: move.newTotalLpa ?? null,
    });
    /* Close-floor clamp — the AI accepted at a number that's higher
     * than the candidate's ask because highestOfferMade pinned it.
     * Detected by: move was close-acceptance AND newTotalLpa equals
     * prev.highestOfferMade AND prev.highestOfferMade > the candidate's
     * last counter. This is the Bug-12 signature; surfacing it as an
     * event means a single grep on production logs will tell us how
     * often it fires. */
    if (
      move.lever === "close-acceptance" &&
      move.newTotalLpa != null &&
      prev.lastCandidateCounterLpa != null &&
      move.newTotalLpa > prev.lastCandidateCounterLpa
    ) {
      events.push({
        type: "ACCEPT_CLAMPED_TO_FLOOR",
        turn,
        candidateAsk: prev.lastCandidateCounterLpa,
        closedAt: move.newTotalLpa,
      });
    }
    if (move.lever === "joining-bonus" && typeof move.joiningBonusAmount === "number") {
      events.push({
        type: "JOINING_BONUS_SET",
        turn,
        amount: move.joiningBonusAmount,
      });
    }
  }

  return events;
}
