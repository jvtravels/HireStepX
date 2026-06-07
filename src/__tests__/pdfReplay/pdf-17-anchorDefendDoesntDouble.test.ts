/* PDF #17 audit replay — defending an anchor must not register as
 * a second anchor-set.
 *
 * Original finding: when the candidate set an anchor and then the
 * recruiter pushed back, the candidate's defense ("I'm holding at
 * 30 — here's why...") was sometimes parsed as a NEW anchor-set
 * move, tripping the anchor-double-set guardrail spuriously. Month 2
 * PR-1's family taxonomy distinguishes anchor-set (initial claim)
 * from anchor-defend (justification of an existing one), so a
 * set-then-defend sequence shouldn't flag the guardrail.
 *
 * Regression shape: candidate anchors, recruiter pushes back, then
 * candidate justifies. anchor-double-set count must stay at 0. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { countGuardrailFlag } from "../../../server-handlers/_decision-log-readers";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-17-anchorDefendDoesntDouble"),
  turns: [
    {
      candidate: "Based on my impact and market, I'm targeting 30 LPA.",
      aiText: "30 is at the top of our band.",
    },
    {
      candidate:
        "I'm holding at 30. Here's why — last year I led platform consolidation that saved 2 crore.",
      aiText: "Noted.",
    },
    {
      candidate: "Same 30, and I have a competing offer at 28 to back it up.",
      aiText: "Understood.",
    },
  ],
};

describe("PDF #17 replay — set-then-defend doesn't trip anchor-double-set", () => {
  it("anchor-double-set guardrail count stays at 0", () => {
    const s = replayTranscript(FIX);
    expect(countGuardrailFlag(s, "anchor-double-set")).toBe(0);
  });
});
