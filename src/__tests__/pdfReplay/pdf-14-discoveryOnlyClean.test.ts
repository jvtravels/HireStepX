/* PDF #14 audit replay — pure discovery-probe transcript trips zero
 * guardrails.
 *
 * Original finding: a session that consisted entirely of discovery
 * probes from the AI (no anchoring, no pressure, no stalls) was
 * still tripping the anchor-double-set guardrail in some
 * configurations because of a stale family stamp on a fallback
 * discovery actionKind. Month 2 PR-1 cleaned the family table; this
 * locks that fix.
 *
 * Regression shape: 4 turns of pure information-gathering on the
 * candidate's part — facts only, no asks or pushes. Every guardrail
 * flag count must be 0. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { guardrailFlagSummary } from "../../../server-handlers/_decision-log-readers";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-14-discoveryOnlyClean"),
  turns: [
    { candidate: "Current CTC is 14 LPA.", aiText: "Got it." },
    { candidate: "Fixed/variable is 12/2.", aiText: "Noted." },
    { candidate: "Notice period is 60 days.", aiText: "OK." },
    { candidate: "No competing offers right now.", aiText: "Understood." },
  ],
};

describe("PDF #14 replay — pure information-disclosure trips zero guardrails", () => {
  it("guardrailFlagSummary contains no flag with a non-zero count", () => {
    const s = replayTranscript(FIX);
    const summary = guardrailFlagSummary(s);
    for (const [, count] of Object.entries(summary)) {
      expect(count).toBe(0);
    }
  });
});
