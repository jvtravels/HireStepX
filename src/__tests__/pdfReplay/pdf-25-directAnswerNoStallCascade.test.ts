/* PDF #25 audit replay — direct-answer turns must not trigger
 * the stall-cascade guardrail.
 *
 * Original finding: when the candidate kept asking direct questions
 * the planner sometimes returned two consecutive stall-tactic moves
 * (e.g. "let me get back to you" → "I'll need to check with the
 * panel"), reading as evasion. Month 2 PR-4 introduced the
 * `stall-cascade` guardrail for that pattern.
 *
 * Regression shape: candidate asks two clean factual questions in a
 * row. The planner must NOT emit consecutive stall-tactics;
 * stall-cascade count stays at 0. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { countGuardrailFlag } from "../../../server-handlers/_decision-log-readers";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-25-directAnswerNoStallCascade"),
  turns: [
    {
      candidate: "What's the band for this role?",
      aiText: "It's structured by level.",
    },
    {
      candidate: "And what's the joining bonus policy?",
      aiText: "We can discuss that.",
    },
    {
      candidate: "Is the variable component capped or uncapped?",
      aiText: "It's capped.",
    },
  ],
};

describe("PDF #25 replay — direct factual Qs don't trip stall-cascade", () => {
  it("stall-cascade guardrail count stays at 0", () => {
    const s = replayTranscript(FIX);
    expect(countGuardrailFlag(s, "stall-cascade")).toBe(0);
  });
});
