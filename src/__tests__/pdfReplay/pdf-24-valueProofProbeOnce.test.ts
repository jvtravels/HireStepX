/* PDF #24 audit replay — value-proof probe should not re-fire after
 * the candidate already volunteered an impact story.
 *
 * Original finding: after a candidate volunteered concrete value
 * proof ("I led platform consolidation that cut p99 latency 40%"),
 * the planner sometimes re-asked "can you give me an example of
 * your impact?" two turns later, because the valueProofAsked
 * checklist flag wasn't consulted on subsequent picks. Reads as
 * the recruiter ignoring what they were just told.
 *
 * Regression shape: candidate volunteers an impact story turn 1,
 * then continues. valueProofAsked count must stay at most 1. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { askedTopicCount } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-24-valueProofProbeOnce"),
  turns: [
    {
      candidate:
        "I led platform consolidation last year that cut p99 latency 40% and shaved 2 crore off the infra bill.",
      aiText: "Strong impact.",
    },
    {
      candidate: "Current CTC is 22 LPA.",
      aiText: "Noted.",
    },
    {
      candidate: "I'm asking for 35 LPA for this move.",
      aiText: "OK.",
    },
  ],
};

describe("PDF #24 replay — value-proof probe stays at most once", () => {
  it("valueProofAsked count is <= 1 across the whole replay", () => {
    const s = replayTranscript(FIX);
    expect(askedTopicCount(s.ledger!, "valueProofAsked")).toBeLessThanOrEqual(1);
  });
});
