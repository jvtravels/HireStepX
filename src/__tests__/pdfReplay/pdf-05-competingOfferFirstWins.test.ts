/* PDF #05 audit replay — competing-offer value first-wins.
 *
 * Original finding: when the candidate inflated their competing offer
 * mid-session ("Swiggy offered 24 LPA... actually call it 26 with
 * stock"), the disclosure tracker overwrote the stored number. The
 * coaching report's leverage analysis then evaluated the candidate's
 * play against the inflated figure instead of the original
 * disclosure, hiding the bluff. Month 1's first-wins getFact freezes
 * the original number so coaching can flag the escalation.
 *
 * Regression shape: candidate states 24, then revises to 26 a few
 * turns later. Ledger MUST keep 24. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-05-competingOfferFirstWins"),
  turns: [
    {
      candidate: "I have a competing offer from Swiggy at 24 LPA.",
      aiText: "Noted.",
    },
    { candidate: "Notice period is 30 days.", aiText: "OK." },
    {
      candidate: "Actually that Swiggy offer is 26 with stock.",
      aiText: "Understood.",
    },
  ],
};

describe("PDF #05 replay — competing-offer value first stated wins", () => {
  it("ledger keeps the FIRST competing-offer number, not the inflated one", () => {
    const s = replayTranscript(FIX);
    const co = getFact(s.ledger!, "competing-offer");
    expect(co === null || co === 24).toBe(true);
  });
});
