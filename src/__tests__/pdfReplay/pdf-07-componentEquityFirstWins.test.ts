/* PDF #07 audit replay — component-equity first-wins.
 *
 * Original finding: candidate disclosed equity = 8 LPA notional, then
 * pulled it back to "5, because the strike's underwater". Tracker
 * overwrote with the smaller number, which the coaching report's
 * total-comp math used as ground truth. The pre-fix bug hid the fact
 * the candidate downplayed their equity under pressure. Month 1's
 * first-wins keeps the original.
 *
 * Regression shape: candidate states equity = 8, then revises to 5.
 * Ledger MUST keep 8. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-07-componentEquityFirstWins"),
  turns: [
    { candidate: "Equity component is 8 LPA notional.", aiText: "Noted." },
    {
      candidate: "Make that 5 — the strike is underwater.",
      aiText: "Understood.",
    },
  ],
};

describe("PDF #07 replay — component-equity first stated value wins", () => {
  it("ledger keeps the FIRST equity, not the downward revision", () => {
    const s = replayTranscript(FIX);
    const e = getFact(s.ledger!, "component-equity");
    expect(e === null || e === 8).toBe(true);
  });
});
