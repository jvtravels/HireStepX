/* PDF #21 audit replay — competing-offer absence stays absent.
 *
 * Original finding: a session where the candidate explicitly said
 * "no competing offers right now" was sometimes recorded as having
 * one — the parser grabbed a nearby numeric ("4 years at Razorpay")
 * and stored it. Month 1's conservative disclosure path keeps
 * competing-offer null until a real positive disclosure lands.
 *
 * Regression shape: candidate explicitly denies any competing offer
 * while naming a numeric tenure. Ledger MUST keep competing-offer
 * null. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-21-competingOfferNoFabrication"),
  turns: [
    {
      candidate:
        "I've spent 4 years at Razorpay. No competing offers on the table right now.",
      aiText: "Understood.",
    },
    {
      candidate: "Current CTC is 18 LPA.",
      aiText: "Noted.",
    },
  ],
};

describe("PDF #21 replay — explicit denial keeps competing-offer null", () => {
  it("competing-offer stays null even with nearby numeric tokens", () => {
    const s = replayTranscript(FIX);
    expect(getFact(s.ledger!, "competing-offer")).toBeNull();
  });
});
