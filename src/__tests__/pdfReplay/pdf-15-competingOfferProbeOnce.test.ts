/* PDF #15 audit replay — competing-offer probe should not re-fire.
 *
 * Original finding: after the candidate disclosed a competing offer,
 * the planner sometimes re-asked "do you have any competing offers?"
 * a few turns later, because the discovery checklist's
 * competingOffersAsked flag wasn't being consulted on subsequent
 * picks. Same shape as PDF #20 but for the competing-offer topic.
 *
 * Regression shape: candidate plainly discloses a competing offer.
 * Across the rest of the replay, askedTopicCount for
 * competingOffersAsked must stay at most 1. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { askedTopicCount } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-15-competingOfferProbeOnce"),
  turns: [
    {
      candidate: "I do have a competing offer from Swiggy at 26 LPA.",
      aiText: "Thanks for being upfront.",
    },
    {
      candidate: "Notice period is 30 days.",
      aiText: "Got it.",
    },
    {
      candidate: "I'd like to understand the team structure.",
      aiText: "Sure.",
    },
  ],
};

describe("PDF #15 replay — competing-offer probe stays at most once", () => {
  it("competingOffersAsked count is <= 1 across the whole replay", () => {
    const s = replayTranscript(FIX);
    expect(askedTopicCount(s.ledger!, "competingOffersAsked")).toBeLessThanOrEqual(1);
  });
});
