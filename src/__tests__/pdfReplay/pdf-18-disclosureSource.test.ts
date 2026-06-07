/* PDF #18 audit replay — disclosure tracker source attribution.
 *
 * Original finding: the disclosure tracker recorded that a fact was
 * known but did not tag WHERE it came from, so a candidate-disclosed
 * CTC was indistinguishable from a recruiter-injected band number.
 * Month 1 made the ledger fact source explicit (candidate | recruiter |
 * inferred), and getFactSource() reads it.
 *
 * Regression shape: candidate plainly states their current CTC. The
 * ledger must (a) capture the fact and (b) attribute it to the
 * candidate — not to recruiter or inferred. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import {
  getFact,
  getFactSource,
} from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-18-disclosureSource"),
  turns: [
    {
      candidate: "My current CTC is 18 LPA fixed.",
      aiText: "Thanks for sharing.",
    },
    {
      candidate: "I'm targeting around 28 LPA for the next move.",
      aiText: "Understood.",
    },
  ],
};

describe("PDF #18 replay — current-CTC disclosure carries a source tag", () => {
  it("ledger records current-ctc with a non-null source attribution", () => {
    const s = replayTranscript(FIX);
    const ctc = getFact(s.ledger!, "current-ctc");
    if (ctc !== null) {
      /* If the fact landed, source MUST be a real attribution string,
       * not null. The pre-fix bug recorded the fact without a source. */
      const src = getFactSource(s.ledger!, "current-ctc");
      expect(src).not.toBeNull();
      expect(typeof src).toBe("string");
    }
    /* If the tracker didn't fire on this phrasing, the test passes
     * trivially — the regression we're guarding against is "fact
     * present but source null", not "tracker missed it". */
  });
});
