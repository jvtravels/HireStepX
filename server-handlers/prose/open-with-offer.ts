/* Carved out of `_canonical-prose.ts` (2026-05-22).
 *
 * Open-with-offer arm. OPENING-greeting variant: in the kernel-first
 * world the opener is a discovery probe; if we still reach this case
 * (planner decided to anchor BECAUSE discovery is complete), the
 * canonical line names the band, not a single number, so the LLM
 * cannot sneak an anchor in via restyle.
 *
 * F4 / Audit Pass 2 (PDF#25, 2026-05-16) — resume-aware opener. When
 * state.resumeFactPack is present we prefer an opener that
 * references latestRole.companyName and (where available) the role
 * title.
 *
 * FL1 / Audit Pass 4 (PDF#27, 2026-05-17) — concrete opener ask.
 * Senior candidates (applicableYoe >= 4 OR role matches /senior|
 * lead|principal|staff/i) get a tighter "total annual" framing.
 */

import type { NegotiationState } from "../_negotiation-kernel";
import type { NextAction } from "../_next-action-planner";
import type { ProseHelpers } from "./_helpers";

export function proseOpenWithOffer(
  _action: NextAction,
  state: NegotiationState,
  helpers: ProseHelpers,
): string {
  const firstName = helpers.firstName;
  if (state.turnIndex === 0) {
    const yoe = state.candidateApplicableYoe;
    const senior =
      (yoe != null && yoe >= 4) ||
      (state.role != null && /senior|lead|principal|staff/i.test(state.role));
    const concreteAsk = senior
      ? "what's your current CTC — total annual?"
      : "what's your current CTC at the moment?";
    const rfp = state.resumeFactPack;
    const latest = rfp?.latestRole ?? null;
    if (latest && latest.companyName && latest.companyName.trim().length > 0) {
      const co = latest.companyName.trim();
      const titleStr =
        latest.title && latest.title.trim().length > 0
          ? `I can see you're at ${co} as ${latest.title.trim()} — `
          : `I can see you're at ${co} — `;
      return `Thanks for making the time${firstName ? ", " + firstName : ""}. ${titleStr}${concreteAsk}`;
    }
    return `Thanks for making the time${firstName ? ", " + firstName : ""}. Let's get straight into it — ${concreteAsk}`;
  }
  return "Before I put a number out — what fitment were you anchoring on?";
}
