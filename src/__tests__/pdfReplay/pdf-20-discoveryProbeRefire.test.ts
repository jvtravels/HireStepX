/* PDF #20 audit replay — discovery-probe should not re-fire on the
 * same topic after the candidate already answered it.
 *
 * Original finding: the planner re-asked "what's your current CTC?"
 * one or two turns after the candidate disclosed it, because the
 * askedTopics set was not consulted on subsequent picks. Month 1's
 * ledger.askedTopics + askedTopicCount reader makes this assertable:
 * after a CTC disclosure, the count for currentCtcAsked should stay
 * at most 1.
 *
 * Regression shape: candidate discloses CTC plainly on turn 1, then
 * spends turns 2-4 on tangential conversation. The planner must not
 * issue a second CTC probe. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { askedTopicCount } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-20-discoveryProbeRefire"),
  turns: [
    {
      candidate: "My current CTC is 16 LPA. Happy to share that upfront.",
      aiText: "Thanks.",
    },
    {
      candidate: "I'm based in Bangalore, open to hybrid.",
      aiText: "Good to know.",
    },
    {
      candidate: "Notice period is 60 days, negotiable to 45.",
      aiText: "Noted.",
    },
    {
      candidate: "I'd like to understand the role's scope first.",
      aiText: "Sure.",
    },
  ],
};

describe("PDF #20 replay — discovery probe doesn't re-fire after disclosure", () => {
  it("currentCtcAsked count is at most 1 across the whole replay", () => {
    const s = replayTranscript(FIX);
    /* Either the planner asked once and stopped (count === 1) or it
     * never asked (count === 0, also fine — disclosure preceded the
     * probe). What's NOT allowed is the planner asking a second time
     * after the candidate already disclosed. */
    expect(askedTopicCount(s.ledger!, "currentCtcAsked")).toBeLessThanOrEqual(1);
  });
});
