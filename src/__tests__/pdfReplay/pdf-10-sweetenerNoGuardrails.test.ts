/* PDF #10 audit replay — sweetener-offer scenario must not raise
 * coercion-shaped guardrails.
 *
 * Original finding: when the planner offered a non-base sweetener
 * (joining bonus, extra equity, accelerated review) late in the
 * session, an older guardrail mis-classified it as pressure-leverage
 * because the family stamp on that actionKind was wrong. Month 2
 * PR-1's taxonomy gives sweetener-offer its own family, so the
 * coercion guardrails should ignore it.
 *
 * Regression shape: candidate signals near-close, then a turn that
 * commonly produces a sweetener-offer move. pressure-repeat and
 * stall-cascade must stay at 0 throughout. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { countGuardrailFlag } from "../../../server-handlers/_decision-log-readers";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-10-sweetenerNoGuardrails"),
  turns: [
    { candidate: "Current CTC is 20 LPA.", aiText: "Noted." },
    { candidate: "Asking for 32 LPA.", aiText: "OK." },
    {
      candidate: "If you can get me close to that I'd be ready to close.",
      aiText: "Let me see what we can do on joining bonus and equity.",
    },
    {
      candidate: "A joining bonus would help bridge the gap.",
      aiText: "We can structure that.",
    },
  ],
};

describe("PDF #10 replay — sweetener-shaped run doesn't trip coercion flags", () => {
  it("pressure-repeat and stall-cascade stay at 0", () => {
    const s = replayTranscript(FIX);
    expect(countGuardrailFlag(s, "pressure-repeat")).toBe(0);
    expect(countGuardrailFlag(s, "stall-cascade")).toBe(0);
  });
});
