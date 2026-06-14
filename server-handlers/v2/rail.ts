/* V2-RAIL (2026-06-09) — the single post-render output assertion.
 *
 * Runs AFTER the kernel has rendered prose. One rule: the rendered
 * turn must contain at least one of the four legitimate move
 * shapes. Anything else is marketing fluff and is rejected.
 *
 * v1 had a 32-check regex restyle validator that ran on every turn.
 * The reason this rail is one check instead of thirty-two: the
 * kernel-side tools.ts already validates numerics, frame, time
 * markers, rationale-length, etc. at construction time. The only
 * thing left for the rail is the "honest move shape" assertion. */

import type { OrchestratorResult } from "./orchestrator";
import type { DerivedState } from "./kernel";

export interface RailVerdict {
  pass: boolean;
  reason?: string;
}

const LPA_RE = /\b\d+(?:\.\d+)?\s*(?:l|lpa)\b/i;
const RUPEE_RE = /₹\s*\d+/;
const TIME_MARKER_RE =
  /\b(today|tomorrow|by\s+eod|by\s+end\s+of|within\s+\d+\s+(hours?|days?)|by\s+\w+day|by\s+\d{1,2}[/-]\d{1,2})\b/i;
const CEILING_RE = /\b(ceiling|cannot\s+authorize|won't\s+go\s+above|dealbreaker)\b/i;
const DISCOVERY_OK_TOOLS = new Set(["ask_discovery"]);

/** Assert that the rendered turn is one of:
 *   (a) contains an LPA number from the band
 *   (b) explicitly cites the ceiling (decline_offer_ask shape)
 *   (c) defers with a concrete callback time
 *   (d) asks a discovery question — only when state allows it
 *
 *  This is the single output rail. v1 had thirty-two of these and
 *  they still missed the failure modes. The cut is: validate the
 *  CHOICE upstream (kernel.legalTools), validate the ARGUMENTS
 *  upstream (tools.executeTool), so the rail only has to confirm
 *  the rendered prose carries one of the four honest shapes. */
export function assertHonestMove(
  result: OrchestratorResult,
  state: DerivedState,
): RailVerdict {
  const t = result.canonical;

  const hasNumber = LPA_RE.test(t) || RUPEE_RE.test(t);
  if (hasNumber) return { pass: true };

  const hasCeiling = CEILING_RE.test(t);
  if (hasCeiling) return { pass: true };

  const hasConcreteTime = TIME_MARKER_RE.test(t);
  if (hasConcreteTime && result.tool === "defer_with_callback") return { pass: true };

  if (DISCOVERY_OK_TOOLS.has(result.tool)) {
    /* Discovery is fine ONLY when the kernel allowed it. The
     * orchestrator already enforces this via legalTools, but the
     * rail double-checks: discovery shipped after offer-ask
     * pressure is a contract violation that should be loud. */
    if (state.offerAskCount === 0 && state.turnIndex <= 6) {
      return { pass: true };
    }
    return {
      pass: false,
      reason: `discovery shipped despite offerAskCount=${state.offerAskCount} turnIndex=${state.turnIndex}`,
    };
  }

  return {
    pass: false,
    reason:
      "rendered turn carries no number, no ceiling-cite, no concrete callback time, and no legitimate discovery question — marketing fluff",
  };
}
