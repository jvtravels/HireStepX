/* PDF #29 audit replay — guardrail flag counts must be monotonic
 * non-decreasing across the session.
 *
 * Original finding: a stale closure in the decision-log reader was
 * sometimes returning a SMALLER count for the same flag on turn N
 * than on turn N-1, because a later patch had filtered some
 * decisionLog entries in place. The reader's counts must only ever
 * grow — once a flag fires on turn K, it stays fired forever. This
 * fixture asserts that property generally across an arbitrary
 * transcript.
 *
 * Regression shape: 5-turn mixed transcript. For every flag, the
 * count at turn N is >= the count at turn N-1. */

import { describe, it, expect } from "vitest";
import {
  replayUpTo,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { countGuardrailFlag } from "../../../server-handlers/_decision-log-readers";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-29-guardrailCountsMonotonic"),
  turns: [
    { candidate: "Current CTC is 14 LPA.", aiText: "Noted." },
    { candidate: "Asking for 26 LPA.", aiText: "OK." },
    { candidate: "Notice is 60 days.", aiText: "Got it." },
    {
      candidate: "I have a competing offer from PhonePe at 25 LPA.",
      aiText: "Understood.",
    },
    { candidate: "Looking forward to your number.", aiText: "Sure." },
  ],
};

const FLAGS = ["pressure-repeat", "stall-cascade", "anchor-double-set"] as const;

describe("PDF #29 replay — guardrail flag counts are monotonic non-decreasing", () => {
  it("count(flag, turn N) >= count(flag, turn N-1) for every flag", () => {
    const series: Record<(typeof FLAGS)[number], number[]> = {
      "pressure-repeat": [],
      "stall-cascade": [],
      "anchor-double-set": [],
    };
    for (let i = 0; i <= FIX.turns.length; i++) {
      const s = replayUpTo(FIX, i);
      for (const f of FLAGS) {
        series[f].push(countGuardrailFlag(s, f));
      }
    }
    for (const f of FLAGS) {
      const counts = series[f];
      for (let i = 1; i < counts.length; i++) {
        expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
      }
    }
  });
});
