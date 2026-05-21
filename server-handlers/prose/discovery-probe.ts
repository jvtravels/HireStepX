/* Carved out of `_canonical-prose.ts` (2026-05-22).
 *
 * Discovery-probe arm. Normalises the item key (strips `Answered` /
 * `Disclosed` suffixes — Defect 4, 2026-05-16), honours the
 * planner's FL5 range-ask override (PDF#27, 2026-05-17), and prefaces
 * the probe with a one-line ACK of the prior turn's disclosure when
 * one exists (BUG-2, PDF#24, 2026-05-16).
 */

import type { NegotiationState } from "../_negotiation-kernel";
import type { NextAction } from "../_next-action-planner";
import type { ProseHelpers } from "./_helpers";

export function proseDiscoveryProbe(
  action: NextAction,
  state: NegotiationState,
  helpers: ProseHelpers,
): string {
  if (action.kind !== "discovery-probe") {
    throw new Error("proseDiscoveryProbe invoked for non-discovery-probe action");
  }
  const rawItem = action.item;
  const item = rawItem.replace(/(?:Answered|Disclosed)$/, "");
  /* PDF#27 FL5 (2026-05-17) — uncertainty-escape range-ask passthrough.
   * The planner's FL5 escape hatch may swap the canonical probe prompt
   * for a range-shaped ask when the candidate hedged on the prior
   * turn. Detect the FL5 range-ask vocabulary and prefer it. */
  const RANGE_ASK_RE = /\b(?:rough\s+range|ballpark|no\s+need\s+for\s+an\s+exact)\b/i;
  if (action.ask && RANGE_ASK_RE.test(action.ask)) {
    const probeOverride = action.ask;
    const ackPrefix = helpers.buildDiscoveryAck(state.lastTurnDelta, item, state);
    return ackPrefix
      ? `${ackPrefix} ${probeOverride}`
      : probeOverride;
  }
  let probe: string;
  if (item === "currentCtc") {
    probe = "Let's start with your current side — what's the total CTC at present?";
  } else if (item === "fixedVariableSplit" || item === "currentCtcFixedVariableSplit") {
    probe = "And how is your current package structured between fixed and variable?";
  } else if (item === "expectedCtc" || item === "target") {
    probe = "What's the fitment you were looking at for this move — broadly, what range are you anchoring on?";
  } else if (item === "expectedCtcFixedVariableSplit") {
    probe = "On the expected side — how would you want the split between fixed and variable to land?";
  } else if (item === "noticePeriod") {
    probe = "What's the notice period at your current company? Any scope for buyout there?";
  } else if (item === "competingOffers") {
    probe = "Are you actively in process with other companies right now?";
  } else if (item === "valueProof") {
    probe = "Walk me through one project from your current role that you'd anchor on in a fitment discussion — something where the impact is concrete.";
  } else {
    probe = action.ask || "Can you tell me a little more about what you're looking at?";
  }
  /* BUG-2 ROOT CAUSE FIX (PDF#24, 2026-05-16): preface every
   * discovery probe with a one-line acknowledgement of the prior
   * turn's disclosure. */
  const delta = state.lastTurnDelta;
  const ack = helpers.buildDiscoveryAck(delta, item, state);
  return ack ? `${ack} ${probe}` : probe;
}
