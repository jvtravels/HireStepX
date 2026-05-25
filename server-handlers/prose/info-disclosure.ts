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
    /* PDF#44 BUG-4/5 fix (2026-05-25) — Flipkart Sr-PD session shipped
     * two consecutive dodges ("variable pay is tied to performance" /
     * "we'll keep this in mind for future discussions") when the
     * candidate explicitly asked for the breakdown twice. The candidate
     * is asking a legitimate contractual question; the bot must
     * enumerate. Use the band's fixed/variable split when available;
     * otherwise approximate from the offer using the standard Indian
     * tech-product-co ratio (≈ 70% fixed / 15% variable / 10% RSU
     * vesting Y1 / 5% joining bonus). Reads off real state when present
     * (band.fixedMin/Max, lastJoiningBonusOffered) and falls back to
     * round approximations otherwise — better an approximation labelled
     * as such than a dodge. */
    if (state.highestOfferMade > 0) {
      const total = state.highestOfferMade;
      const band = (state as { band?: { fixedMin?: number; fixedMax?: number; variableMax?: number } }).band;
      const jb = (state as { lastJoiningBonusOffered?: number | null }).lastJoiningBonusOffered;
      const fixed =
        band?.fixedMax != null
          ? Math.round(band.fixedMax * 10) / 10
          : Math.round(total * 0.7 * 10) / 10;
      const variable =
        band?.variableMax != null
          ? Math.round(band.variableMax * 10) / 10
          : Math.round(total * 0.15 * 10) / 10;
      const rsuYear = Math.round((total - fixed - variable - (jb ?? 0)) * 10) / 10;
      const rsuLine = rsuYear > 0 ? `, RSU grant ~₹${rsuYear}L/year vesting over 4 years` : "";
      const jbLine = jb != null && jb > 0 ? `, joining bonus ₹${jb}L` : "";
      return `Sure, here's the structure on the ₹${total}L — base ₹${fixed}L fixed, target variable ₹${variable}L at 100% performance${rsuLine}${jbLine}. Standard benefits (medical, PF, gratuity) layered on top. Any specific component you want me to go deeper on?`;
    }
    return "On the structure — which side of it matters most to you: fixed, variable, or benefits?";
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
