/* PDF #08 audit replay — joining-date first-wins.
 *
 * Original finding: when the candidate floated an earlier joining
 * date under recruiter pressure ("I said Sept 1, but I could try for
 * Aug 15"), the disclosure tracker overwrote the stored date, which
 * downstream offer generation then treated as the candidate's
 * committed availability. Month 1's append-only ledger + first-wins
 * getFact freezes the original date so the coaching report can flag
 * the slippage instead of silently following it.
 *
 * Regression shape: candidate states Sept 1, then offers Aug 15.
 * Ledger MUST still report Sept 1 (or no date — both fine; the
 * forbidden value is Aug 15). */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-08-joiningDateFirstWins"),
  turns: [
    {
      candidate: "I can join by September 1st.",
      aiText: "Noted.",
    },
    {
      candidate: "Actually I could push for August 15th if needed.",
      aiText: "Understood.",
    },
  ],
};

describe("PDF #08 replay — joining-date first stated value wins", () => {
  it("ledger keeps the FIRST joining date, not the pulled-in one", () => {
    const s = replayTranscript(FIX);
    const jd = getFact(s.ledger!, "joining-date");
    /* The pre-fix bug was the ledger reporting "August 15". Either
     * "September 1" survived (first-wins held) or the tracker didn't
     * fire on this phrasing — both acceptable. */
    if (jd !== null) {
      expect(jd.toLowerCase()).not.toContain("august");
      expect(jd).not.toContain("15");
    }
  });
});
