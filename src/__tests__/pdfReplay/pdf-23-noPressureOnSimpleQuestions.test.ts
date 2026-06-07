/* PDF #23 audit replay — simple factual questions must not trigger
 * any pressure-leverage guardrail.
 *
 * Original finding: the planner sometimes reached for a pressure
 * lever ("the offer's only on the table today") in response to a
 * benign factual question, which read as unnecessarily coercive
 * given the candidate hadn't pushed back at all. Month 2 PR-3's
 * pressure-repeat guardrail catches the consecutive case; here we
 * lock the simpler "don't escalate without provocation" property by
 * asserting the guardrail-flag set is empty for an
 * informational-only transcript.
 *
 * Regression shape: candidate asks 3 plain factual questions in a
 * row. The decision log's guardrail flag summary must be empty —
 * no pressure, no stalls, no double-anchors. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { guardrailFlagSummary } from "../../../server-handlers/_decision-log-readers";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-23-noPressureOnSimpleQuestions"),
  turns: [
    { candidate: "What's the team size?", aiText: "It's about 12 engineers." },
    { candidate: "Is it hybrid or fully remote?", aiText: "Hybrid, 3 days a week." },
    { candidate: "Who would I report to?", aiText: "The VP of Engineering." },
  ],
};

describe("PDF #23 replay — informational transcript trips zero guardrails", () => {
  it("guardrailFlagSummary is an empty object", () => {
    const s = replayTranscript(FIX);
    const summary = guardrailFlagSummary(s);
    expect(Object.keys(summary)).toEqual([]);
  });
});
