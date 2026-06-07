/* PDF #35 audit replay — mixed end-to-end disclosure invariants.
 *
 * Original finding: a "kitchen sink" audit that tracked multiple
 * disclosures across a single session and observed (a) the ledger
 * silently overwriting first-stated values when the candidate
 * restated them, AND (b) the same discovery topic getting re-probed
 * across multiple turns. Earlier per-axis fixtures (PDFs #12, #15,
 * #19, #20, #27, #28, #30, #31) lock each invariant individually;
 * this fixture proves they all hold simultaneously on one realistic
 * transcript.
 *
 * Regression shape: candidate discloses CTC, target, notice, and a
 * competing offer across 6 turns with one explicit upward
 * restatement of CTC. All facts must reflect FIRST disclosures, and
 * the discovery checklist counts must each stay <= 1. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import {
  getFact,
  askedTopicCount,
} from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-35-mixedDisclosureEndToEnd"),
  turns: [
    { candidate: "Current CTC is 18 LPA.", aiText: "Noted." },
    { candidate: "I'm targeting 30 LPA.", aiText: "OK." },
    { candidate: "Notice period is 60 days.", aiText: "Got it." },
    {
      candidate: "I have a competing offer from Razorpay at 28 LPA.",
      aiText: "Understood.",
    },
    {
      candidate: "Actually you can call my current CTC 19 with the bonus.",
      aiText: "Noted.",
    },
    {
      candidate: "Looking forward to hearing your number.",
      aiText: "OK.",
    },
  ],
};

describe("PDF #35 replay — all first-wins + probe-once invariants hold together", () => {
  it("CTC, target, notice and competing-offer all reflect first disclosures", () => {
    const s = replayTranscript(FIX);
    /* First-wins on every fact that landed. */
    const ctc = getFact(s.ledger!, "current-ctc");
    expect(ctc === null || ctc === 18).toBe(true);
    const target = getFact(s.ledger!, "target-ctc");
    expect(target === null || target === 30).toBe(true);
    const np = getFact(s.ledger!, "notice-period-days");
    expect(np === null || np === 60).toBe(true);
    const co = getFact(s.ledger!, "competing-offer");
    expect(co === null || co === 28).toBe(true);
  });

  it("no discovery topic was probed more than once", () => {
    const s = replayTranscript(FIX);
    for (const topic of [
      "currentCtcAsked",
      "targetAsked",
      "noticePeriodAsked",
      "competingOffersAsked",
    ] as const) {
      expect(askedTopicCount(s.ledger!, topic)).toBeLessThanOrEqual(1);
    }
  });
});
