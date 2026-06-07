/* PDF #26 audit replay — every emitted actionKind must map to a
 * known ActionFamily (no "unmapped" stamps).
 *
 * Original finding: a few times during planner evolution, a new
 * actionKind was added to the kernel without being added to the
 * KIND_TO_FAMILY table, so the M2 family-stamp logic recorded
 * "unmapped" for those moves and the family-level guardrails
 * silently skipped them. Month 2 PR-1's familyOf() returns
 * "unmapped" exactly when this happens, making the regression
 * assertable.
 *
 * Regression shape: a realistic 5-turn session. Every decisionLog
 * entry that carries an actionKind must also have a non-"unmapped"
 * family stamp. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { familyOf } from "../../../server-handlers/_action-families";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-26-actionKindsAllMapped"),
  turns: [
    { candidate: "Current CTC is 18 LPA.", aiText: "Noted." },
    { candidate: "Asking for 30 LPA.", aiText: "OK." },
    { candidate: "Notice period is 45 days.", aiText: "Got it." },
    {
      candidate: "I have a competing offer from PhonePe at 28 LPA.",
      aiText: "Understood.",
    },
    {
      candidate: "What's the team's growth roadmap?",
      aiText: "Strong — building two new pods.",
    },
  ],
};

describe("PDF #26 replay — no actionKind escapes the family taxonomy", () => {
  it("every stamped actionKind resolves to a real ActionFamily", () => {
    const s = replayTranscript(FIX);
    const stamped = (s.decisionLog ?? []).filter((e) => !!e.actionKind);
    for (const entry of stamped) {
      const fam = familyOf(entry.actionKind!);
      expect(fam).not.toBe("unmapped");
      /* And the entry's own family stamp should match familyOf(). */
      if (entry.family) {
        expect(entry.family).toBe(fam);
      }
    }
  });
});
