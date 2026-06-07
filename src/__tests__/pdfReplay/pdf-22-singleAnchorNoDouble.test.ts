/* PDF #22 audit replay — single anchor turn must not trigger
 * the anchor-double-set guardrail.
 *
 * Original finding: the planner's anchor logic sometimes ran twice on
 * back-to-back turns when the candidate asked a clarifying question
 * right after their first anchor — the planner re-emitted an anchor
 * instead of explaining the existing one. Month 2 PR-4 introduced the
 * `anchor-double-set` guardrail flag for exactly this case.
 *
 * Regression shape: candidate sets one anchor on turn 1, then asks a
 * benign clarifier on turn 2. The planner must NOT stack a second
 * anchor-set; anchor-double-set count stays at 0. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { countGuardrailFlag } from "../../../server-handlers/_decision-log-readers";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-22-singleAnchorNoDouble"),
  turns: [
    {
      candidate: "Given my impact and market data, I'm targeting 30 LPA.",
      aiText: "That's noted.",
    },
    {
      candidate: "Could you tell me how the band breaks down across levels?",
      aiText: "Sure.",
    },
  ],
};

describe("PDF #22 replay — single-anchor transcript doesn't trip anchor-double-set", () => {
  it("anchor-double-set guardrail count stays at 0", () => {
    const s = replayTranscript(FIX);
    expect(countGuardrailFlag(s, "anchor-double-set")).toBe(0);
  });
});
