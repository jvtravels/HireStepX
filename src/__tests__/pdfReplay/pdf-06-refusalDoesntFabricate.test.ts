/* PDF #06 audit replay — candidate refusal must not silently
 * populate the refused fact.
 *
 * Original finding: when a candidate refused to disclose their
 * current CTC ("I'd rather not share that yet"), an older parser
 * sometimes interpreted nearby numeric tokens (years of experience,
 * team size) as the CTC and stored a wrong value. The fix made the
 * disclosure tracker conservative on refusal phrasing — better to
 * leave the fact null than to fabricate.
 *
 * Regression shape: candidate refuses to share current CTC across
 * two turns. Ledger MUST NOT report a current-ctc value. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-06-refusalDoesntFabricate"),
  turns: [
    {
      candidate: "I'd rather not share my current CTC at this stage.",
      aiText: "Understood.",
    },
    {
      candidate:
        "I've got 8 years of experience and lead a team of 12 — happy to discuss scope.",
      aiText: "Sure.",
    },
  ],
};

describe("PDF #06 replay — refusal doesn't fabricate a current-CTC value", () => {
  it("current-ctc stays null when the candidate refused to disclose", () => {
    const s = replayTranscript(FIX);
    expect(getFact(s.ledger!, "current-ctc")).toBeNull();
  });
});
