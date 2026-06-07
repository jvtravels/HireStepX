/* PDF #33 audit replay — recap-summary moves must not register on
 * any coercion-shaped guardrail.
 *
 * Original finding: when the planner played a recap-summary turn
 * ("just to recap: you're at 16, asking for 26, 30-day notice"),
 * if the previous turn happened to be a stall or pressure move, the
 * stale family stamp on the recap could still be misread, tripping
 * a guardrail flag that didn't apply. Month 2 PR-1's clean
 * recap-summary family designation should keep these turns quiet
 * on the guardrail axis.
 *
 * Regression shape: candidate discloses key facts in quick
 * succession (which often triggers a recap-summary in the planner).
 * No coercion guardrail should fire across the run. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { countGuardrailFlag } from "../../../server-handlers/_decision-log-readers";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-33-recapSummaryNoGuardrails"),
  turns: [
    { candidate: "Current CTC is 16 LPA.", aiText: "Noted." },
    { candidate: "Targeting 26 LPA.", aiText: "OK." },
    { candidate: "Notice is 30 days.", aiText: "Got it." },
    {
      candidate: "Yes that recap is correct — anything else you need?",
      aiText: "All clear.",
    },
  ],
};

describe("PDF #33 replay — recap-style turns don't trip coercion guardrails", () => {
  it("pressure-repeat, stall-cascade and anchor-double-set all stay at 0", () => {
    const s = replayTranscript(FIX);
    expect(countGuardrailFlag(s, "pressure-repeat")).toBe(0);
    expect(countGuardrailFlag(s, "stall-cascade")).toBe(0);
    expect(countGuardrailFlag(s, "anchor-double-set")).toBe(0);
  });
});
