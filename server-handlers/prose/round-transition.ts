/* Carved out of `_canonical-prose.ts` (2026-05-22).
 *
 * Phase 5 Session B (2026-05-19) — distinct handoff prose per
 * (from → to) edge. HR Partner hands off to Hiring Manager with a
 * warm partner-led tone; Hiring Manager hands off to Director with
 * a process-led tone that signals the closing round.
 *
 * Distinct phrasing across the two edges so two consecutive
 * round-transition turns would never collide on the PDF#36 A1
 * rotating-ack guard. The bodies also intentionally avoid the
 * canonical ACK leads ("Noted", "Got it", "Understood",
 * "Appreciate", "Right,", "Fair enough", "Okay,", "Alright,") so
 * the FL2 neutral bridge does not double-prepend an ack onto an
 * already-warm handoff.
 */

import type { NegotiationState } from "../_negotiation-kernel";
import type { NextAction } from "../_next-action-planner";
import type { NegotiationRoundPersona } from "../_negotiation-rounds";
import type { ProseHelpers } from "./_helpers";

export function proseRoundTransition(
  action: NextAction,
  _state: NegotiationState,
  helpers: ProseHelpers,
): string {
  if (action.kind !== "round-transition") {
    throw new Error("proseRoundTransition invoked for non-round-transition action");
  }
  const from: NegotiationRoundPersona = action.from;
  const to: NegotiationRoundPersona = action.to;
  /* `from` is part of the discriminator surface so downstream
   * analyzers can read the edge; not used in the prose body itself
   * today. */
  void from;
  return helpers.selectByRoundPersona(to, {
    /* hr-partner → hiring-manager. Partner-led warmth. */
    "hiring-manager":
      "Thanks — that's everything from my side. Let me bring in the hiring manager who'll walk you through scope and team fit.",
    /* hiring-manager → director. Process-led handoff. */
    "director":
      "Appreciate the depth on scope. I'd like to pull in the director for the final round — they'll cover the closing offer and any flexibility we have.",
    /* HR Partner is never a handoff TARGET. Defensive fallback. */
    "hr-partner":
      "Let me bring in the next round of the conversation.",
  });
}
