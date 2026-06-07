/* PDF #09 audit replay — decisionLog grows monotonically, one
 * entry per turn.
 *
 * Original finding: a few patches in the kernel's evolution
 * accidentally short-circuited decisionLog appends on some planner
 * branches (e.g. early-return paths that skipped the bookkeeping
 * block), which made the post-session report's "moves played" count
 * undercount the actual conversation. The invariant we want: turn N
 * produces exactly turn N's entries, with strict growth.
 *
 * Regression shape: replayUpTo(i) must always have exactly i entries
 * for i = 0 .. N. */

import { describe, it, expect } from "vitest";
import {
  replayUpTo,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-09-decisionLogMonotonic"),
  turns: [
    { candidate: "Current CTC is 16 LPA.", aiText: "Noted." },
    { candidate: "Asking for 26 LPA.", aiText: "OK." },
    { candidate: "Notice period is 60 days.", aiText: "Got it." },
    { candidate: "What's the team structure like?", aiText: "Hybrid pods." },
  ],
};

describe("PDF #09 replay — decisionLog has exactly one entry per turn", () => {
  it("replayUpTo(i).decisionLog.length === i for every i", () => {
    for (let i = 0; i <= FIX.turns.length; i++) {
      const s = replayUpTo(FIX, i);
      expect(s.decisionLog?.length ?? 0).toBe(i);
    }
  });
});
