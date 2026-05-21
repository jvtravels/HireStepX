/* Carved out of `_canonical-prose.ts` (2026-05-22).
 *
 * PDF#33 Move A (2026-05-18) — "let me walk you through" was a
 * teaser pattern: it promised content the kernel never actually
 * delivered, so the next turn looped, jumped topics, or repeated.
 * Replaced across all info-disclosure topics with either (a)
 * substantive content the kernel CAN deliver deterministically, or
 * (b) a concrete question whose answer advances the negotiation.
 */

import type { NegotiationState } from "../_negotiation-kernel";
import type { NextAction } from "../_next-action-planner";
import type { ProseHelpers } from "./_helpers";

export function proseInfoDisclosure(
  action: NextAction,
  state: NegotiationState,
  _helpers: ProseHelpers,
): string {
  if (action.kind !== "info-disclosure") {
    throw new Error("proseInfoDisclosure invoked for non-info-disclosure action");
  }
  const topic = action.topic;
  if (topic === "breakdown") {
    return state.highestOfferMade > 0
      ? `On the ₹${state.highestOfferMade}L fitment — broadly that's fixed cash + a target variable on the perf cycle, with benefits layered on top. Want me to break out the fixed/variable split?`
      : "On the structure — which side of it matters most to you: fixed, variable, or benefits?";
  }
  if (topic === "benefits") {
    return "Beyond cash, the standard cover is medical (self + family + parents), term life, and accidental — group-policy. Anything specific you want me to confirm on?";
  }
  if (topic === "comp-structure") {
    return "On the structure — fixed is the bulk of the package, variable sits on the perf cycle, and equity (where applicable) vests over four years. Which piece do you want to dig into?";
  }
  if (topic === "notice") {
    return "On notice — what's the standard period at your current side, and is a buyout an option there?";
  }
  if (topic === "hike-pct") {
    return "On the hike piece — what's anchoring the expectation at that level?";
  }
  return "What part of the structure do you want me to break down first?";
}
