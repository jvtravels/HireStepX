/* PDF #27 audit replay — ledger append-only audit-trail invariant.
 *
 * Original finding: parts of the codebase were mutating recorded facts
 * in place when "better" candidate data arrived, destroying the audit
 * trail and making first-wins semantics impossible to enforce. Month 1
 * locked the ledger to append-only — every recordFact pushes a new
 * entry, and getFact returns the FIRST one. The ledger size monotonic
 * across the replay is the simplest property test.
 *
 * Regression shape: drive a multi-turn session, snapshot ledger size
 * after each turn, assert it never decreases. */

import { describe, it, expect } from "vitest";
import {
  replayUpTo,
  pdfReplayInit,
  type ReplayInput,
} from "./_replayHarness";
import { size } from "../../../server-handlers/_conversation-ledger";

const FIX: ReplayInput = {
  init: pdfReplayInit("pdf-27-ledgerAppendOnly"),
  turns: [
    { candidate: "Current CTC is 14 LPA.", aiText: "Got it." },
    { candidate: "Actually it's 14.5 LPA including bonus.", aiText: "Noted." },
    { candidate: "Asking for 26 LPA.", aiText: "Why 26?" },
    { candidate: "Notice is 90 days.", aiText: "Understood." },
    { candidate: "I have a competing offer from Swiggy at 24 LPA.", aiText: "OK." },
  ],
};

describe("PDF #27 replay — ledger size is monotonic non-decreasing", () => {
  it("size at turn N is always >= size at turn N-1", () => {
    const sizes: number[] = [];
    for (let i = 0; i <= FIX.turns.length; i++) {
      const partial = replayUpTo(FIX, i);
      sizes.push(size(partial.ledger!));
    }
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
    }
  });
});
