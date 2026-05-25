/* Carved out of `_canonical-prose.ts` (2026-05-22).
 *
 * Fix 4 (2026-05-16) — formal close recap. Enumerates Fixed | Variable
 * target | JB (optional) | Retention (optional) | Notice | Proposed
 * joining (optional) | BGV start trigger | OL ETA, then asks "Sounds
 * good?" so the candidate explicitly reconfirms the full structured
 * fitment before the offer letter is cut.
 *
 * Perfect 3 (2026-05-16) — when sticky cumulativeUrgency is firm,
 * append a fast-track line on the formal recap so the candidate hears
 * that the OL pipeline is being shortened to match their timeline.
 */

import type { NegotiationState } from "../_negotiation-kernel";
import type { NextAction } from "../_next-action-planner";
import { clawbackForCompany } from "../_joining-bonus-clawback";
import type { ProseHelpers } from "./_helpers";

export function proseCloseRecapFormal(
  action: NextAction,
  state: NegotiationState,
  _helpers: ProseHelpers,
): string {
  if (action.kind !== "close-recap-formal") {
    throw new Error("proseCloseRecapFormal invoked for non-close-recap-formal action");
  }
  const parts: string[] = [];
  parts.push(`Fixed ₹${action.fixedLpa}L`);
  parts.push(`variable target ₹${action.variableLpa}L`);
  if (action.joiningBonusLpa != null && action.joiningBonusLpa > 0) {
    /* Audit fix 2026-05-21: tier+amount-aware clawback. */
    const cb = clawbackForCompany(action.joiningBonusLpa, state.company);
    parts.push(`joining bonus ₹${action.joiningBonusLpa}L with a ${cb.months}-month ${cb.structure === "it-services-service-bond" ? "service bond" : "clawback"}`);
  }
  if (action.retentionBonusLpa != null && action.retentionBonusLpa > 0) {
    parts.push(`retention bonus ₹${action.retentionBonusLpa}L split across the retention window`);
  }
  /* PDF#45 B2 (2026-05-26) — recap-hallucination guard. Render notice
   * / BGV / OL ETA only when the planner populated them (the planner
   * leaves them undefined when no corresponding discovery topic was
   * discussed). Prevents the recap from fabricating "notice 9 weeks /
   * BGV post-acceptance / OL 2-3 business days" boilerplate when none
   * of these were ever raised in the session. */
  if (action.noticePeriodWeeks != null) {
    parts.push(`notice ${action.noticePeriodWeeks} weeks`);
  }
  if (action.proposedJoiningDate) {
    parts.push(`proposed joining ${action.proposedJoiningDate}`);
  }
  if (action.bgvStartTrigger) {
    parts.push(`BGV starts ${action.bgvStartTrigger}`);
  }
  if (action.offerLetterEta) {
    parts.push(`offer letter in ${action.offerLetterEta}`);
  }
  const urgencyTail =
    state.cumulativeUrgency === "firm"
      ? " Given your timeline, we'll fast-track the offer letter — expect it within 24 hours of BGV initiation."
      : "";
  return `Let me recap the fitment before I revert internally — ${parts.join(", ")}. Sounds good?${urgencyTail}`;
}
