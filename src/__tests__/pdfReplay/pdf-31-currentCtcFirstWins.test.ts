/* PDF #31 audit replay — current-CTC first-wins on later
 * restatement.
 *
 * Original finding: the candidate first disclosed "current CTC is
 * 14 LPA", then a few turns later said "you can call it 15 with the
 * latest hike", and the tracker overwrote to 15. The coaching
 * report's gap analysis (target − current) then under-reported the
 * stretch the candidate was actually asking for. Month 1's
 * first-wins getFact freezes the original 14 so the gap math stays
 * honest.
 *
 * Regression shape: candidate states 14, then restates as 15 a few
 * turns later. Ledger MUST keep 14. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-31-currentCtcFirstWins"),
  turns: [
    { candidate: "Current CTC is 14 LPA.", aiText: "Noted." },
    { candidate: "Asking for 24 LPA.", aiText: "OK." },
    {
      candidate: "Actually you can call it 15 with the latest hike.",
      aiText: "Understood.",
    },
  ],
};

describe("PDF #31 replay — current-CTC first stated value wins", () => {
  it("ledger keeps the FIRST CTC, not the upward restatement", () => {
    const s = replayTranscript(FIX);
    const ctc = getFact(s.ledger!, "current-ctc");
    expect(ctc === null || ctc === 14).toBe(true);
  });
});
