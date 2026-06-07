/* PDF #16 audit replay — notice-period probe should not re-fire
 * after disclosure.
 *
 * Original finding: same shape as PDFs #20 (CTC), #15 (competing
 * offer), #11 (split), and #13 (target) — the noticePeriodAsked
 * checklist flag wasn't being consulted, so the planner sometimes
 * re-probed the notice period after the candidate already answered.
 *
 * Regression shape: candidate states notice period upfront, then
 * carries on. noticePeriodAsked count must stay at most 1. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { askedTopicCount } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-16-noticePeriodProbeOnce"),
  turns: [
    {
      candidate: "Notice period is 45 days, negotiable to 30.",
      aiText: "Noted.",
    },
    {
      candidate: "Current CTC is 16 LPA.",
      aiText: "OK.",
    },
    {
      candidate: "Asking for 26 LPA.",
      aiText: "Got it.",
    },
  ],
};

describe("PDF #16 replay — notice-period probe stays at most once", () => {
  it("noticePeriodAsked count is <= 1 across the whole replay", () => {
    const s = replayTranscript(FIX);
    expect(askedTopicCount(s.ledger!, "noticePeriodAsked")).toBeLessThanOrEqual(1);
  });
});
