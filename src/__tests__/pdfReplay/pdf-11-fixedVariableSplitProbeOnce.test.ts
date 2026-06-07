/* PDF #11 audit replay — fixed/variable-split probe should not
 * re-fire after the candidate already disclosed the split.
 *
 * Original finding: the planner re-asked "what's your fixed vs
 * variable breakdown?" one or two turns after the candidate already
 * answered, because the fixedVariableSplitAsked flag wasn't being
 * consulted on subsequent picks. Same shape as PDF #20 (CTC) and
 * PDF #15 (competing offer) but on the split topic.
 *
 * Regression shape: candidate plainly states the split, then spends
 * later turns on tangential conversation. The planner must not issue
 * a second split probe. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { askedTopicCount } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-11-fixedVariableSplitProbeOnce"),
  turns: [
    {
      candidate: "My current CTC is 18 LPA — 14 fixed, 4 variable.",
      aiText: "Got it, thanks.",
    },
    {
      candidate: "Notice period is 45 days.",
      aiText: "Noted.",
    },
    {
      candidate: "Looking to understand the role's growth trajectory.",
      aiText: "Sure.",
    },
  ],
};

describe("PDF #11 replay — fixed/variable-split probe stays at most once", () => {
  it("fixedVariableSplitAsked count is <= 1 across the whole replay", () => {
    const s = replayTranscript(FIX);
    expect(
      askedTopicCount(s.ledger!, "fixedVariableSplitAsked"),
    ).toBeLessThanOrEqual(1);
  });
});
