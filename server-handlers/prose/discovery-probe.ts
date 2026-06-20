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
import { askedTopicEntries } from "../_conversation-ledger";

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
  /* Re-ask de-duplication (2026-06-19, surfaced via the offline dice
   * sweep) — when the candidate gives a non-answer ("ok" / "hmm") to a
   * discovery probe, the planner re-asks the SAME topic on the next turn.
   * The canonical probe string is fixed, so the re-ask shipped VERBATIM
   * (modulo an overlay tic), which reads robotically and trips the
   * same-response loop guard. A real recruiter re-prompts differently:
   * acknowledges the miss and nudges for even a rough figure. Count prior
   * asks of THIS item from the asked-topic ledger (0 on the first ask, so
   * first-ask phrasing stays byte-identical — no existing snapshot moves);
   * ≥1 means this is a re-prompt and we pick a distinct nudge variant.
   *
   * Read the asked-topic ledger (preferred when present), NOT the raw
   * `state.askedTopics` array: the array is a lossy dual-write that gets
   * cleared/desynced across turns, so counting it always yielded 0 and the
   * re-ask variant never fired. Mirror `readAskedTopics` in the planner —
   * prefer the ledger when it has at least as many entries as the array. */
  const askedArr = state.askedTopics ?? [];
  const fromLedger = state.ledger ? askedTopicEntries(state.ledger) : [];
  const askedSource =
    fromLedger.length >= askedArr.length ? fromLedger : askedArr;
  const priorAsks = askedSource.filter(
    (t) => t.topic.replace(/(?:Answered|Disclosed)$/, "") === item,
  ).length;
  /* Each variant leads with a word that survives the realism-overlay's
   * mid-sentence-downcase contract intact: either "I" (never downcased,
   * stays correct after a prepended opener comma) or a whitelisted opener
   * ("Given" / "Before" / "And"). Leading with an un-whitelisted capital
   * common word (e.g. "Even" / "No") would garble to "So, Even …" after an
   * overlay prepend — keep the curated bank collision-free at the source. */
  const REASK_PROBES: Partial<Record<string, readonly [string, string]>> = {
    currentCtc: [
      "I still need a figure to anchor the fitment — what's your current total CTC, even a rough one?",
      "Given even a rough figure helps here, where does your current CTC sit today?",
    ],
    fixedVariableSplit: [
      "Before we move on — roughly how does your current package split between fixed and variable?",
      "I just need an approximate fixed-vs-variable break on your current side.",
    ],
    currentCtcFixedVariableSplit: [
      "Before we move on — roughly how does your current package split between fixed and variable?",
      "I just need an approximate fixed-vs-variable break on your current side.",
    ],
    expectedCtc: [
      "I don't need an exact number — broadly, what range are you anchoring on for this move?",
      "Given even a band helps, what fitment would make this move worth it for you?",
    ],
    target: [
      "I don't need an exact number — broadly, what range are you anchoring on for this move?",
      "Given even a band helps, what fitment would make this move worth it for you?",
    ],
    noticePeriod: [
      "And on timelines — what's your notice period at the current company?",
      "Given offers can move fast — roughly how long is your notice, 30/60/90 days?",
    ],
    competingOffers: [
      "And just to gauge urgency — are you in process with any other companies right now?",
      "I won't need names — are there other offers in play at the moment?",
    ],
  };
  const reAsk = priorAsks >= 1 ? REASK_PROBES[item] : undefined;
  let probe: string;
  if (reAsk) {
    probe = reAsk[Math.min(priorAsks - 1, reAsk.length - 1)];
  } else if (item === "currentCtc") {
    probe = "Let's start with your current side — what's the total CTC at present?";
  } else if (item === "fixedVariableSplit" || item === "currentCtcFixedVariableSplit") {
    probe = "And how is your current package structured between fixed and variable?";
  } else if (item === "expectedCtc" || item === "target") {
    probe = "What's the fitment you were looking at for this move — broadly, what range are you anchoring on?";
  } else if (item === "expectedCtcFixedVariableSplit") {
    probe = "On the expected side — how would you want the split between fixed and variable to land?";
  } else if (item === "noticePeriod") {
    /* AUDIT-3 Fix #2 (2026-06-08): split the compound probe into a
     * single question. The old prose asked "notice + buyout" in one
     * breath; candidates answered one, the other was silently logged
     * unsatisfied, and the planner thought notice was satisfied while
     * buyout drifted. Now: ask notice cleanly; buyout becomes its own
     * follow-up turn when state warrants. */
    probe = "What's your notice period at the current company?";
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
