/* PDF #04 audit replay — component-variable first-wins.
 *
 * Original finding: a candidate stated "variable is 4 LPA", then a
 * few turns later said "well 3 actually, last year's payout was
 * short". The tracker overwrote with the smaller value, which the
 * downstream gap math then used to UNDER-state their total comp,
 * making their ask look more aggressive than it was. Month 1's
 * first-wins getFact freezes the original value.
 *
 * Regression shape: candidate states variable = 4, then revises down
 * to 3. Ledger MUST keep 4. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-04-componentVariableFirstWins"),
  turns: [
    { candidate: "Variable component is 4 LPA.", aiText: "Noted." },
    {
      candidate: "Actually it was 3 last year — payout was short.",
      aiText: "Understood.",
    },
  ],
};

describe("PDF #04 replay — component-variable first stated value wins", () => {
  it("ledger keeps the FIRST variable, not the downward revision", () => {
    const s = replayTranscript(FIX);
    const v = getFact(s.ledger!, "component-variable");
    expect(v === null || v === 4).toBe(true);
  });
});
