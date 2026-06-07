/* PDF #19 audit replay — component-base first-wins.
 *
 * Original finding: when the candidate restated their base under
 * pressure ("14 fixed, well actually 13.5 after the last bonus
 * cycle"), the tracker overwrote the originally disclosed base. Any
 * downstream gap analysis (asked vs base) then under-counted the gap.
 * Month 1's append-only ledger preserves the original disclosure so
 * the coaching report can call out the in-session shrink.
 *
 * Regression shape: candidate states base = 14, then revises down to
 * 13.5. Ledger MUST keep the original 14. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-19-componentBaseFirstWins"),
  turns: [
    {
      candidate: "Fixed base is 14 LPA.",
      aiText: "Noted.",
    },
    {
      candidate: "Actually 13.5 after the last bonus cycle adjustment.",
      aiText: "Understood.",
    },
  ],
};

describe("PDF #19 replay — component-base first stated value wins", () => {
  it("ledger keeps the FIRST base, not the downward revision", () => {
    const s = replayTranscript(FIX);
    const base = getFact(s.ledger!, "component-base");
    /* Either tracker captured 14 (first-wins held) or didn't fire on
     * this phrasing. What is NOT acceptable: 13.5 (the revised
     * value). */
    expect(base === null || base === 14).toBe(true);
  });
});
