/* GROUNDING_HEDGE_DROPS_SEQUENCE_CRITICAL — when validateAnswerGrounding
 * fails on a sequence-critical turn (panel-approval-stall, discovery-probe,
 * anchor-with-offer, counter-offer), the planner's move must still ship.
 * Today the early-return at line 794-800 of _response-pipeline.ts drops it.
 *
 * After AUDIT-W02 fix: shipped text contains the canonical pivot text
 * appended to the hedge, NOT the hedge alone.
 */
import { describe, it, expect, vi } from "vitest";
import { generateBotReply } from "../../server-handlers/_response-pipeline";
import { initState } from "../../server-handlers/_negotiation-kernel";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 24, maxStretch: 32, walkAway: 20, hasEquity: false };

// Stub LLM: fabricates a manager name not in factPack to trigger grounding fail.
const stubLlm = vi.fn(async () => "You'll report to Priya Sharma in the Platform team.");

describe("generateBotReply — fact-grounding hedge on sequence-critical action", () => {
  it("composes hedge + canonical pivot rather than dropping planner move", async () => {
    const state = initState({
      sessionId: "grounding-seqcrit-test",
      role: "Senior Software Engineer",
      company: "acme",
      band: BAND,
    } as never);
    // Push into counter-offer-ish territory so the planner picks a
    // sequence-critical action; otherwise the LLM's ungrounded answer
    // would just defer alone (pre-fix behavior).
    const armed = {
      ...state,
      phase: "counter-offer" as const,
      turnIndex: 8,
      candidateTarget: 36,
      lastCandidateCounterLpa: 36,
      firstAnchoredTarget: 36,
      candidateCurrentCtc: 24,
      highestOfferMade: 32,
      counterRound: 1,
      anchorLocked: true,
      lockedAnchorLpa: 32,
      lastAiText: "We've stretched to 32 LPA.",
    };
    const result = await generateBotReply(armed, stubLlm as never, "Who would I be reporting to?");
    // The shipped text should be longer than the hedge alone (which is
    // a single short sentence). With the pivot composed in, the output
    // contains both the hedge phrasing AND a canonical follow-up.
    expect(result.text.length).toBeGreaterThan(80);
    // The hedge fragment should still be present (canonical hedge wording).
    expect(result.text.toLowerCase()).toMatch(/confirm|check|hiring manager|revert|let me/);
  });
});
