/* Carved out of `_canonical-prose.ts` (2026-05-22).
 *
 * Counter-offer arm. The planner pre-computes the counter total + the
 * optional fixed/variable split on the typed action (kernel-first
 * cleanup, 2026-05-16). Canonical prose for a counter ALWAYS
 * includes the number so the restyle validator can verify it
 * survives. Persona-aware: sector persona (Phase 3) and round
 * persona (Phase 5 Session B) overlay where applicable.
 */

import type { NegotiationState } from "../_negotiation-kernel";
import type { NextAction } from "../_next-action-planner";
import type { ProseHelpers } from "./_helpers";

export function proseCounterOffer(
  action: NextAction,
  state: NegotiationState,
  helpers: ProseHelpers,
): string {
  if (action.kind !== "counter-offer") {
    throw new Error("proseCounterOffer invoked for non-counter-offer action");
  }
  const total = action.counterTotalLpa;
  const round = state.counterRound;
  const persona = helpers.sectorPersona;
  let spiralLead = "Hearing you out — let me see what I can structure.";
  if (round >= 2) {
    spiralLead = "I've stretched as far as my band allows on cash —";
  } else if (round >= 1) {
    spiralLead = "We've already moved on fitment once. Let me see what's possible at this stage.";
  }
  /* PDF#46 B6 (2026-05-25) — component-aware lead. When the candidate
   * framed their counter at the base level ("46L total, 44L base, 2L
   * JB"), acknowledge the base ask vs our fixed component before
   * pivoting to the total. Real recruiters engage with the structure
   * the candidate proposed, not just the headline number. */
  if (
    typeof action.candidateProposedBaseLpa === "number" &&
    action.candidateProposedBaseLpa > 0
  ) {
    const ourFixed = action.counterFixedLpa;
    const baseAck =
      typeof ourFixed === "number"
        ? `On your ₹${action.candidateProposedBaseLpa}L base ask — our fixed component lands at ₹${ourFixed}L on the structure I can hold.`
        : `On your ₹${action.candidateProposedBaseLpa}L base ask — let me come at this on the total side.`;
    spiralLead = `${baseAck} ${spiralLead}`;
  }
  if (total != null && total > 0) {
    /* Phase 5 Session B (2026-05-19) — round-persona overlay
     * preempts the sector body when multi-round is on. */
    const roundPersonaC = helpers.activeRoundPersona;
    if (roundPersonaC != null) {
      const roundBody = helpers.selectByRoundPersona(roundPersonaC, {
        "hr-partner": `As per band, the most I can structure is ₹${total}L total — that's the grade fitment ceiling I have.`,
        "hiring-manager": `We can revise the fitment to ₹${total}L total — that's the stretch I can hold against the scope we're hiring.`,
        "director": `Final number on cash is ₹${total}L total — this is the leverage I'm able to sign off on.`,
      });
      return `${spiralLead} ${roundBody} How does that look from your side?`;
    }
    const body = helpers.selectBySectorPersona(persona, {
      "it-services": `Services-track ceiling lands the fitment at ₹${total}L total.`,
      "gcc": `Anchored to the global band, we can revise the fitment to ₹${total}L total.`,
      "indian-unicorn": `On cash we can revise the fitment to ₹${total}L total, with a stronger ESOP grant on top.`,
      "early-startup": `Cash runway is tight — we can revise the fitment to ₹${total}L total, with a stretch on equity %.`,
      "bfsi": `Variable bumps to land the fitment at ₹${total}L total on the perf cycle.`,
      /* Realism-Audit Fix 1 — PSU / Big-4 / FMCG-management framings. */
      "psu": `As per government norms the grade-fitment lands at ₹${total}L total — HRA and LTC are the only flex.`,
      "consulting-big4": `Fitment to the level lands at ₹${total}L total — internal equity at this band caps further movement.`,
      "fmcg-management": `For the leadership-development cohort the band lands at ₹${total}L total — the trajectory carries more long-term value.`,
      "default": `We can revise the fitment to ₹${total}L total.`,
    });
    return `${spiralLead} ${body} How does that look from your side?`;
  }
  return state.highestOfferMade > 0
    ? `We're holding the current fitment at ₹${state.highestOfferMade}L. What would move this forward for you?`
    : "What number would land for you?";
}
