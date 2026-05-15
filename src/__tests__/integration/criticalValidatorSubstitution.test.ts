/* F2 (PDF#19 2026-05-15) — kernel-authored safe-prose substitution.
 *
 * PDF#19 keystone: when the LLM emits text that fails a CRITICAL
 * validator (range-discipline, number-discipline, budget-discipline,
 * next-action-emitted, role-label, close-vocab, fabricated-facts) past
 * the reroll cap, the previous code logged a `validator-reject-
 * fallthrough` decisionLog entry and SHIPPED THE BAD TEXT TO THE USER.
 *
 * The fix is: substitute kernel-authored fallback prose anchored on
 * state.plannedNextAction.ask, push a `kernel-prose-substitution`
 * decisionLog entry, and return the substituted text (still through
 * enforceRoleLabel).
 *
 * This test drives the real generateAiText seam with a deterministic
 * LLM mock emitting bad text on both attempts, and asserts the reply
 * never reaches the user.
 */
import { describe, it, expect, vi } from "vitest";
import { generateAiText, type LlmCaller } from "../../../server-handlers/negotiate-turn";
import {
  initState,
  type AiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 30, maxStretch: 50, walkAway: 25, hasEquity: false };

/* probe lever — validateAiText does not require a specific number in the
 * reply, so we can exercise the inner numDisc / rangeDisc validators
 * without short-circuiting on the outer required-number check. */
const PROBE_MOVE: AiMove = {
  lever: "probe",
  newTotalLpa: null,
  rationale: "Probe candidate target before counter.",
};

describe("F2 — kernel-authored prose substitution on critical validator failure", () => {
  it("substitutes kernel prose when LLM emits sub-anchor number on a locked-anchor turn (number-discipline fails twice)", async () => {
    /* Build state where anchor is locked at ₹50L. Any emitted number
     * below ₹47.5L fails NUMBER DISCIPLINE. */
    const state: NegotiationState = {
      ...initState({ sessionId: "s-f2", role: "Software Engineer", company: "Acme", band: BAND }),
      turnIndex: 3,
      phase: "counter-offer",
      anchorLocked: true,
      lockedAnchorLpa: 50,
      highestOfferMade: 50,
      candidateTarget: 60,
      /* Stamp a planned action with an ask so the substitution has
       * something concrete to anchor on. */
      plannedNextAction: {
        kind: "counter-offer",
        ask: "Where would you like the package to land?",
      },
    };

    /* Both attempts emit a NUMBER DISCIPLINE violation (₹20L is >5%
     * below the ₹50L locked anchor). */
    const llm: LlmCaller = vi.fn(async () => "Let me offer ₹20L total package.");

    const result = await generateAiText(state, PROBE_MOVE, "What's the package?", llm, "user");

    /* F2 invariant: the bad number must NOT reach the user. */
    expect(result.text).not.toMatch(/₹?\s*20\s*L/i);

    /* F2 invariant: a decisionLog entry records the substitution. */
    const log = state.decisionLog ?? [];
    const lastEntry = log[log.length - 1];
    expect(lastEntry?.picker).toBe("kernel-prose-substitution");
  });
});
