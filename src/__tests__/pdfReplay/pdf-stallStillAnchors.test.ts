/* OA-B39 / OA-B54 regression lock (2026-07-18 audit).
 *
 * Two documented "discovery deadlock" shapes — a candidate who fully
 * stonewalls (never discloses any number) and one who only ever says "market
 * rate" — used to loop discovery forever with a zero offer. The A6 stonewall
 * escape (forcedPhaseFor: discovery-with-no-signal → offer-presented) plus the
 * band-disclosure anchor now guarantee a concrete offer lands before any
 * stalemate. These pin the "never stalemate without an offer" invariant. */

import { describe, it, expect } from "vitest";
import { replayTranscript, pdfReplayInit } from "./_replayHarness";

const BAND = { initialOffer: 24, maxStretch: 30, walkAway: 20, hasEquity: false } as const;

describe("OA-B39 / OA-B54 — discovery stalls still anchor an offer", () => {
  it("OA-B39: full stonewall to maxTurns puts an offer on the table before stalemate", () => {
    const stall = "I'd rather not say. Let's just talk.";
    const state = replayTranscript({
      init: { ...pdfReplayInit("b39-stall"), band: BAND },
      turns: Array.from({ length: 25 }, () => ({ candidate: stall })),
    });
    expect(state.highestOfferMade).toBeGreaterThan(0);
  });

  it("OA-B54: 'market rate' deflection still lands a concrete offer", () => {
    const state = replayTranscript({
      init: { ...pdfReplayInit("b54"), band: BAND },
      turns: [
        "Just pay me the market rate.",
        "Just pay market.",
        "Market rate is fine.",
        "As I said, market rate.",
        "Market rate.",
        "Market rate please.",
      ].map((candidate) => ({ candidate })),
    });
    expect(state.highestOfferMade).toBeGreaterThan(0);
  });
});
