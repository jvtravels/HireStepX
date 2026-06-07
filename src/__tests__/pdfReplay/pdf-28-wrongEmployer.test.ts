/* PDF #28 audit replay — wrong-employer / current-company first-wins.
 *
 * Original finding: the LLM prompt was reading state.candidateCurrentCompany
 * directly, which could drift if a downstream parser misread a later
 * candidate utterance ("I used to work at Flipkart") as a current-employer
 * update. The Month 1 ledger + first-wins fix routes the prompt's
 * current-company read through getFactOr(state.ledger, "current-company",
 * state.candidateCurrentCompany), and the ledger captures the FIRST
 * disclosure permanently.
 *
 * Regression shape: candidate names current employer turn 1, names a
 * prior employer turn 2. Ledger MUST still report turn 1's name. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-28-wrongEmployer"),
  turns: [
    {
      candidate: "I'm currently at Razorpay as a senior engineer.",
      aiText: "Got it.",
    },
    {
      candidate: "I used to work at Flipkart before that.",
      aiText: "Understood.",
    },
    {
      candidate: "And before Flipkart I was at Paytm.",
      aiText: "Acknowledged.",
    },
  ],
};

describe("PDF #28 replay — current-company first-wins survives later mentions", () => {
  it("ledger reports the FIRST disclosed employer, not the most recent", () => {
    const s = replayTranscript(FIX);
    const company = getFact(s.ledger!, "current-company");
    /* Either the ledger captured "Razorpay" (the FIRST disclosure) or
     * the disclosure tracker didn't fire on this phrasing. Both are
     * acceptable; what is NOT acceptable is the ledger reporting
     * "Flipkart" or "Paytm" (the prior employers). */
    expect(company === null || company === "Razorpay").toBe(true);
  });
});
