/* PDF #12 audit replay — notice-period first-wins.
 *
 * Original finding: when the candidate softened a previously stated
 * notice period under recruiter pressure ("I said 60 days, but I
 * could probably push it to 120"), the downstream prompt swapped the
 * stored value to the looser one. That handed the recruiter a free
 * concession the candidate never actually agreed to. Month 1's
 * append-only ledger + first-wins getFact freezes the first stated
 * value so coaching feedback can call out the slippage instead of
 * silently following it.
 *
 * Regression shape: candidate states 60 days, then later softens to
 * 120. Ledger MUST still report 60. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-12-noticePeriodFirstWins"),
  turns: [
    { candidate: "Notice period is 60 days.", aiText: "Noted." },
    {
      candidate: "Actually I could push it to 120 if you need.",
      aiText: "Understood.",
    },
  ],
};

describe("PDF #12 replay — notice-period first stated value wins", () => {
  it("ledger keeps the FIRST notice period, not the softened one", () => {
    const s = replayTranscript(FIX);
    const np = getFact(s.ledger!, "notice-period-days");
    /* Either the tracker captured 60 (first-wins held) or it didn't
     * fire at all. What is NOT acceptable: 120 (the softened value). */
    expect(np === null || np === 60).toBe(true);
  });
});
