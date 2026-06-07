/* PDF #34 audit replay — retention-into-exploding-offer should not
 * trigger consecutive pressure-leverage moves.
 *
 * Original finding: when the candidate revealed both a retention
 * counter from their current employer AND an exploding-offer deadline
 * from a competitor, the planner sometimes stacked two coercive
 * pressure-leverage moves back-to-back, which read as recruiter
 * bullying. Month 2 PR-3 introduced the `pressure-repeat` guardrail
 * flag that fires exactly when consecutive decisions both come from
 * the pressure-leverage family.
 *
 * Regression shape: candidate discloses retention + exploding offer
 * across two consecutive turns. The planner must keep
 * pressure-repeat at 0. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { countGuardrailFlag } from "../../../server-handlers/_decision-log-readers";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-34-retentionPressureRepeat"),
  turns: [
    {
      candidate: "My current employer just offered me a retention bump to 22 LPA.",
      aiText: "Interesting context.",
    },
    {
      candidate: "And the competing offer from PhonePe expires Friday — exploding.",
      aiText: "Noted.",
    },
    {
      candidate: "I need a number from you today.",
      aiText: "Understood.",
    },
  ],
};

describe("PDF #34 replay — retention + exploding offer doesn't stack pressure", () => {
  it("pressure-repeat guardrail flag count stays at 0", () => {
    const s = replayTranscript(FIX);
    expect(countGuardrailFlag(s, "pressure-repeat")).toBe(0);
  });
});
