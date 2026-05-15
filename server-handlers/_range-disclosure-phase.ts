/* PDF #18 follow-up (2026-05-15) — range-disclosure phase rule.
 *
 * The user-mandated negotiation sequence inserts a RANGE disclosure
 * step between discovery completion and the specific anchor:
 *   discovery → "we're in the ₹18-22L band" → candidate reacts →
 *   specific number.
 *
 * Rather than threading a new value into the NegotiationPhase union
 * (which fans out across the phase machine, serializers, exhaustiveness
 * checks, and 4700+ tests asserting the existing enum), this module
 * models the "range-disclosure phase" as a derived predicate over
 * existing state. The brief layer surfaces a `[PHASE RULE: disclose
 * RANGE not specific]` directive whenever the predicate fires; the
 * move-picker and the LLM both honor it. Once the range has been
 * disclosed and the candidate has reacted, the predicate
 * self-suppresses by virtue of the conversation having moved on
 * (either a specific anchor will have been disclosed, or
 * `rangeAlreadyDisclosed` will be true on the immediately-prior turn).
 *
 * Pure / stateless. */

export interface RangeDisclosurePhaseInputs {
  /** Discovery checklist is satisfied for the role family. */
  discoveryComplete: boolean;
  /** Bot has already disclosed a specific number this session
   *  (highestOfferMade > 0 OR an open-with-offer / counter-base lever
   *  has fired). */
  specificAnchorDisclosed: boolean;
  /** Bot has disclosed a range in the immediately-prior turn (as
   *  detected by `detectRangeDisclosure` on `state.lastBotReply`). */
  rangeAlreadyDisclosed: boolean;
}

/** True iff the next bot move SHOULD be a range disclosure (rather
 *  than a specific anchor). Pure.
 *
 *   - Discovery must be complete (we don't anchor mid-discovery).
 *   - No specific number may have been put on the table yet (once a
 *     specific anchor exists, the conversation has progressed past
 *     the range-disclosure phase).
 *   - The prior turn must not already have been a range disclosure
 *     (otherwise we'd loop "₹18-22L … ₹18-22L … ₹18-22L"). */
export function shouldDiscloseRange(
  input: RangeDisclosurePhaseInputs,
): boolean {
  if (!input.discoveryComplete) return false;
  if (input.specificAnchorDisclosed) return false;
  if (input.rangeAlreadyDisclosed) return false;
  return true;
}

/** Bracketed brief line for the LLM. Returns null when the rule
 *  shouldn't fire. Pure. */
export function buildRangeDisclosureBrief(
  input: RangeDisclosurePhaseInputs,
): string | null {
  if (!shouldDiscloseRange(input)) return null;
  return (
    '[PHASE RULE: disclose RANGE not specific — say "₹X-Y band" or "₹X-Y range" ' +
    "first; converge to a single number only AFTER the candidate reacts to the range]"
  );
}
