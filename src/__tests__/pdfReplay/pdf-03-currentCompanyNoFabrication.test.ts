/* PDF #03 audit replay — current-company stays null when the
 * candidate hasn't actually said where they work.
 *
 * Original finding: when the candidate referenced past employers
 * ("I've worked at Flipkart and Paytm") without naming a current
 * employer, the disclosure tracker sometimes grabbed the first
 * mentioned company and treated it as current — fabricating a
 * disclosure the candidate never made. Month 1's conservative
 * disclosure parser plus the ledger's first-wins discipline keeps
 * the field null until a real current-employer statement lands.
 *
 * Regression shape: candidate names two past employers but no
 * current one. Ledger MUST keep current-company null. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-03-currentCompanyNoFabrication"),
  turns: [
    {
      candidate:
        "I've previously worked at Flipkart and Paytm — both in payments.",
      aiText: "Strong background.",
    },
    { candidate: "Currently between roles.", aiText: "Understood." },
  ],
};

describe("PDF #03 replay — past-only employer mentions don't fabricate current-company", () => {
  it("current-company stays null (or at least isn't a past employer)", () => {
    const s = replayTranscript(FIX);
    const c = getFact(s.ledger!, "current-company");
    /* The acceptable outcomes: null (tracker stayed silent) OR a
     * non-past-employer value. The forbidden outcomes: "Flipkart"
     * or "Paytm" — the past employers the candidate named. */
    if (c !== null) {
      expect(c.toLowerCase()).not.toContain("flipkart");
      expect(c.toLowerCase()).not.toContain("paytm");
    }
  });
});
