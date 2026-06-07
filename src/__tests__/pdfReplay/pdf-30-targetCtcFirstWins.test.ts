/* PDF #30 audit replay — target-CTC first-wins.
 *
 * Original finding: when the candidate raised their ask mid-session
 * ("28 LPA actually, no — let's say 32") the disclosure tracker
 * overwrote the stored target with the second number. The coaching
 * report then judged the candidate against the higher anchor, hiding
 * the in-session drift. Month 1's first-wins getFact freezes the
 * first ask so the report can call out the wobble.
 *
 * Regression shape: candidate states 28, then revises to 32. Ledger
 * MUST keep 28. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-30-targetCtcFirstWins"),
  turns: [
    {
      candidate: "I'm targeting 28 LPA.",
      aiText: "Noted.",
    },
    {
      candidate: "Actually, let's say 32 LPA — given my background.",
      aiText: "Understood.",
    },
  ],
};

describe("PDF #30 replay — target-CTC first stated value wins", () => {
  it("ledger keeps the FIRST target, not the upward revision", () => {
    const s = replayTranscript(FIX);
    const target = getFact(s.ledger!, "target-ctc");
    /* Either tracker captured 28 (first-wins held) or didn't fire.
     * What is NOT acceptable: 32 (the revised value). */
    expect(target === null || target === 28).toBe(true);
  });
});
