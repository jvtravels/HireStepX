/* Carved out of `_canonical-prose.ts` (2026-05-22).
 *
 * Phase 2 Indian-HR redesign (2026-05-17) — point-offer anchor.
 * Replaces the legacy `anchor-with-band` lever that emitted a range.
 * Real Indian HR recruiters disclose a single initial offer number
 * (band floor / classic lowball), not an internal band. "fitment" +
 * "LPA" + a number are the contract's required tokens.
 *
 * PDF#35 Move 4 (2026-05-18) — number-discipline. Never ship the
 * word "variable" as a standalone noun in this canonical.
 *
 * Phase 5 Session B (2026-05-19) — round-persona overlay on the
 * tail. Default-OFF: falls through to the sector tail byte-identical.
 */

import type { NegotiationState } from "../_negotiation-kernel";
import type { NextAction } from "../_next-action-planner";
import type { ProseHelpers } from "./_helpers";

export function proseAnchorWithOffer(
  action: NextAction,
  state: NegotiationState,
  helpers: ProseHelpers,
): string {
  if (action.kind !== "anchor-with-offer") {
    throw new Error("proseAnchorWithOffer invoked for non-anchor-with-offer action");
  }
  if (action.bandIncomplete) {
    return "I'll have a firmer number once the panel signs off — meanwhile, what's the fitment you were targeting?";
  }
  const variableMax = state.band?.variableMax;
  const persona = helpers.sectorPersona;
  const roundPersonaB = helpers.activeRoundPersona;
  const tail = roundPersonaB != null
    ? helpers.selectByRoundPersona(roundPersonaB, {
        "hr-partner": " That's the band floor for this grade — no stretch on cash from my side.",
        "hiring-manager": " That sits inside the stretch band I can hold against this scope.",
        "director": " That's the Director-tier band — full sign-off authority on this number.",
      })
    : helpers.selectBySectorPersona(persona, {
        "it-services":   " That's the grade fitment as per our band for this role.",
        "gcc":           " That's anchored to the global band for this level.",
        "indian-unicorn":" The cash sits inside our band; ESOP grant follows the same level — I'll share the annual-value figure before the offer letter.",
        "early-startup": " Cash is tight at this stage, but equity % is where we can stretch.",
        "bfsi":          " Fixed sits as per our regulatory band; variable is on the performance cycle.",
        /* Realism-Audit Fix 1 — three new sector personas. */
        "psu":           " That's the grade fitment as per the pay-scale matrix; HRA and LTC are on top per government norms.",
        "consulting-big4": " That's the fitment to the level — internal equity caps any movement at this band.",
        "fmcg-management": " That's the band for the leadership-development cohort; the trajectory matters more than the joining number.",
        "default":       "",
      });
  /* PDF#45 follow-up (2026-05-25) — joining bonus surfaced in the
   * anchor line when one has already been sized. Real Indian HR
   * recruiters lay out Total / Fixed / Variable / Joining in the same
   * breath so the candidate sees the full structure before reacting. */
  const jb = state.lastJoiningBonusOffered;
  const jbTail =
    typeof jb === "number" && jb > 0
      ? ` Plus a ₹${jb} LPA joining bonus.`
      : "";
  if (typeof variableMax === "number" && variableMax > 0) {
    const fixedComponent = Math.max(0, action.initialOffer - variableMax);
    return `So for this grade, the fitment we're able to offer is ₹${action.initialOffer} LPA — ₹${fixedComponent} LPA fixed plus a ₹${variableMax} LPA target on the performance cycle.${jbTail}${tail} Let me know your thoughts.`;
  }
  return `So for this grade, the fitment we're able to offer is ₹${action.initialOffer} LPA.${jbTail}${tail} Let me know your thoughts.`;
}
