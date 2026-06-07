/* PDF #32 audit replay — terminal close must not raise any
 * coercion-shaped guardrail flags.
 *
 * Original finding: when the candidate accepted the offer ("Sounds
 * good, I'm in"), the planner sometimes still reached for a
 * pressure-leverage or stall-tactic on the closing turn — usually a
 * stale move queued before the acceptance landed. Reads as the
 * recruiter steamrolling a deal that's already closed. The terminal
 * close turn should be quiet on the guardrail axis.
 *
 * Regression shape: 3-turn run-up to a clean acceptance. Across the
 * whole replay neither pressure-repeat nor stall-cascade fires. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { countGuardrailFlag } from "../../../server-handlers/_decision-log-readers";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-32-terminalCloseNoGuardrails"),
  turns: [
    { candidate: "Current CTC is 18 LPA.", aiText: "Noted." },
    { candidate: "Asking for 28 LPA.", aiText: "OK." },
    { candidate: "Sounds good, I accept the offer.", aiText: "Welcome aboard." },
  ],
};

describe("PDF #32 replay — clean acceptance trips zero coercion guardrails", () => {
  it("pressure-repeat AND stall-cascade both stay at 0", () => {
    const s = replayTranscript(FIX);
    expect(countGuardrailFlag(s, "pressure-repeat")).toBe(0);
    expect(countGuardrailFlag(s, "stall-cascade")).toBe(0);
  });
});
