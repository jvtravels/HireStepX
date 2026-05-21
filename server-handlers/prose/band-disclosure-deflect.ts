/* Carved out of `_canonical-prose.ts` (2026-05-22).
 *
 * Phase 2 Indian-HR redesign (2026-05-17) — replaces the legacy
 * `range-disclosure` lever that leaked the band ceiling. Real Indian
 * HR recruiters NEVER share internal numbers; they deflect and offer
 * to take the candidate's expectation back to the panel. Retains the
 * "as per our band" idiom marker (required by canonicalProseIndianIdiom
 * test) and the panel/leadership escalation reference.
 *
 * Phase 3 of Salary-Negotiation plan (2026-05-18) — persona-specific
 * deflection. Each archetype leans on a different framing for WHY
 * the band can't move: IT services → rigid policy + grade fitment;
 * GCC → global band reference; Unicorn → ESOP leverage; Startup →
 * cash constraint; BFSI → regulatory bands. All variants preserve
 * the "as per our band" idiom marker and panel-escalation offer
 * required by the canonical contract; the default path renders
 * byte-identical to pre-Phase-3 prose.
 *
 * Phase 5 Session B (2026-05-19) — round-persona overlay. When
 * multi-round is enabled, the round persona dictates the deflection
 * style independent of sector. HR Partner cites grade fitment;
 * Hiring Manager pivots to scope-trade; Director frames as final
 * leverage. Multi-round OFF (default) falls through to the sector
 * persona branch byte-identical to pre-Phase-5 prose.
 */

import type { NegotiationState } from "../_negotiation-kernel";
import type { NextAction } from "../_next-action-planner";
import type { ProseHelpers } from "./_helpers";

export function proseBandDisclosureDeflect(
  _action: NextAction,
  state: NegotiationState,
  helpers: ProseHelpers,
): string {
  const roundPersonaA = helpers.activeRoundPersona;
  /* BUG-004 fix (QA v2, 2026-05-19) — chain a same-turn probe so the
   * deflection doesn't stall the conversation for a turn. Real
   * recruiters: deflect + immediately re-anchor on candidate's
   * target. Single shared chain tail keeps the 9 variants
   * byte-stable until the chained probe. */
  const chainedProbe =
    " If you can share even a rough target, I can tell you straight away whether we're broadly aligned.";
  /* PDF#37 BUG-B (2026-05-20) — when an offer is already on the
   * table, the deflect MUST restate that number explicitly so the
   * LLM-restyle layer can't drift the line to "there isn't a fixed
   * amount mentioned for the role" / "that's something the HM walks
   * through later". Naming the number forecloses the hallucination
   * path. */
  const highestOffer = state.highestOfferMade ?? 0;
  const offerOnTableClause =
    highestOffer > 0
      ? ` The fitment of ₹${highestOffer}L I shared is what I have on the table.`
      : "";
  if (roundPersonaA != null) {
    return helpers.selectByRoundPersona(roundPersonaA, {
      "hr-partner":
        "I'll need to take that back to the hiring panel — as per our band, the grade fitment is what I have on the table." + offerOnTableClause + " Happy to escalate your expectation internally." + chainedProbe,
      "hiring-manager":
        "Within the band for this scope, I can flex on structure but not headline." + offerOnTableClause + " If you want me to move the cash, we'd need to revisit scope or level." + chainedProbe,
      "director":
        "This is the final number my approval supports — as per our band for this grade." + offerOnTableClause + " Let me know if there's a path forward." + chainedProbe,
    });
  }
  const sectorBody = helpers.selectBySectorPersona(helpers.sectorPersona, {
    "it-services":
      "I won't be able to share internal numbers — as per our band, the grade fitment I shared is what I have. Happy to take this back to the panel." + chainedProbe,
    "gcc":
      "I won't be able to share internal numbers, but as per our band for this grade — anchored to the global benchmark — the offer stands. Happy to take this back to the panel." + chainedProbe,
    "indian-unicorn":
      "I won't be able to share internal numbers on cash. As per our band for this grade the fixed is what I shared, with the ESOP grant on top. Happy to take this back to the panel and structure more on equity." + chainedProbe,
    "early-startup":
      "I won't be able to share internal numbers. As per our band, cash runway is the constraint. Happy to take this back to the panel and stretch on equity." + chainedProbe,
    "bfsi":
      "I won't be able to share internal numbers. As per our regulatory band, fixed sits where I shared it; variable is where we have room. Happy to take this back to the panel." + chainedProbe,
    "default":
      "I won't be able to share internal numbers, but as per our band for this grade, the offer I have on the table is what I shared. Happy to take your expectation back to the panel if there's a gap." + chainedProbe,
  });
  /* PDF#37 BUG-B (2026-05-20) — when an explicit offer is already on
   * the table, splice the number into the deflect so the LLM-restyle
   * layer can't hallucinate "there isn't a fixed amount for the role". */
  if (highestOffer > 0) {
    const explicitRecap =
      ` The fitment of ₹${highestOffer}L I shared earlier still stands.`;
    return sectorBody + explicitRecap;
  }
  return sectorBody;
}
