/* PDF #02 audit replay — undisclosed facts must stay null.
 *
 * Original finding: a coaching-report template assumed every fact
 * would always be present and substituted "0" or "—" when missing.
 * The report's NPV math then treated that 0 as a real disclosure,
 * yielding negative-gap calculations against fabricated zeros.
 * Month 1's first-wins ledger leaves unset facts as null so callers
 * know the difference between "candidate said zero" and "candidate
 * didn't say".
 *
 * Regression shape: candidate discloses CTC and target only. Notice,
 * competing offer, components, and joining date must all stay null
 * in the ledger. */

import { describe, it, expect } from "vitest";
import {
  replayTranscript,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { getFact } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-02-partialDisclosureNoFabrication"),
  turns: [
    { candidate: "Current CTC is 16 LPA.", aiText: "Noted." },
    { candidate: "Asking for 28 LPA.", aiText: "OK." },
  ],
};

describe("PDF #02 replay — undisclosed facts stay null, not 0", () => {
  it("competing-offer, joining-date and components are all null", () => {
    const s = replayTranscript(FIX);
    expect(getFact(s.ledger!, "competing-offer")).toBeNull();
    expect(getFact(s.ledger!, "joining-date")).toBeNull();
    expect(getFact(s.ledger!, "component-base")).toBeNull();
    expect(getFact(s.ledger!, "component-variable")).toBeNull();
    expect(getFact(s.ledger!, "component-equity")).toBeNull();
  });
});
