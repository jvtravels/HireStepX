/* PDF #13 audit replay — target-CTC probe should not re-fire after
 * the candidate already named a number.
 *
 * Original finding: the planner re-asked "what are you looking for?"
 * after the candidate had already anchored, because the targetAsked
 * checklist flag wasn't being consulted on subsequent picks. Reading
 * back as the recruiter not listening.
 *
 * Regression shape: candidate names a target on turn 1, then spends
 * later turns on tangential conversation. targetAsked count must
 * stay at most 1. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { askedTopicCount } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-13-targetProbeOnce"),
  turns: [
    {
      candidate: "I'm targeting 30 LPA for this move.",
      aiText: "Noted.",
    },
    {
      candidate: "Current CTC is 18 LPA.",
      aiText: "OK.",
    },
    {
      candidate: "Notice period is 60 days.",
      aiText: "Got it.",
    },
    {
      candidate: "I'd love to hear about the engineering culture.",
      aiText: "Sure.",
    },
  ],
};

describe("PDF #13 replay — target-CTC probe stays at most once", () => {
  it("targetAsked count is <= 1 across the whole replay", () => {
    const s = replayTranscript(FIX);
    expect(askedTopicCount(s.ledger!, "targetAsked")).toBeLessThanOrEqual(1);
  });
});
