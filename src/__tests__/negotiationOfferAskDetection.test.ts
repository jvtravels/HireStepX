import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

/**
 * Kernel-level regression for OFFER-ASK detection (live-staging finding,
 * 2026-06-17).
 *
 * The second completion sink: a candidate who finished discovery and
 * EXPLICITLY asked the recruiter to put a number down ("what fitment can you
 * put on the table?", "where does the offer land?") never got an anchor — the
 * kernel's narrow `OFFER_ASK_RE` failed to match those natural frames, so
 * `offerAskedAtTurn` stayed null, the planner's Fix-5 anchor gate never fired,
 * and the recruiter looped a generic discovery-probe deflection forever
 * instead of closing like a real HR.
 *
 * After the recall widening, every natural offer-ask frame must stamp
 * `offerAskedAtTurn`, while candidate DISCLOSURES (including a competing offer
 * "on the table") must NOT — the gate biases recall, but a disclosure firing
 * it would pre-empt proper handling. This drives the real kernel end-to-end.
 */

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: false,
};

function freshState(): NegotiationState {
  return initState({
    sessionId: "offer-ask-fixture",
    role: "react",
    company: "Razorpay",
    band: BAND,
  });
}

const OFFER_ASKS = [
  "What fitment can you put on the table for this grade?",
  "where does the offer land for this role?",
  "what is your offer?",
  "what are you offering?",
  "can you share the range?",
  "put a number on the table for me",
  "what can you offer me?",
  "what fitment can you share?",
  "how much can you offer?",
  "how much are you offering for this position?",
  "where will the number come in?",
  "what's your best and final offer?",
];

const NOT_OFFER_ASKS = [
  "My current CTC is 48 lakhs total.",
  "I have a competing offer on the table from another firm.",
  "My notice period is 60 days.",
  "I can offer flexibility on the joining date.",
  "The base is 36 and variable is 12.",
  "I am looking for a senior role.",
];

describe("negotiation-kernel — offer-ask detection stamps offerAskedAtTurn", () => {
  for (const ask of OFFER_ASKS) {
    it(`recognises offer-ask: "${ask}"`, () => {
      const s = applyCandidateAnswer(freshState(), ask);
      expect(s.offerAskedAtTurn, `offerAskedAtTurn for "${ask}"`).not.toBeNull();
      expect(typeof s.offerAskedAtTurn).toBe("number");
    });
  }

  for (const notAsk of NOT_OFFER_ASKS) {
    it(`does NOT treat as offer-ask: "${notAsk}"`, () => {
      const s = applyCandidateAnswer(freshState(), notAsk);
      expect(s.offerAskedAtTurn ?? null, `offerAskedAtTurn for "${notAsk}"`).toBeNull();
    });
  }

  it("a competing-offer disclosure does not trip the offer-ask gate", () => {
    // Regression guard for the 'on the table' idiom: a DISCLOSURE must not be
    // read as a REQUEST for the company's number.
    const s = applyCandidateAnswer(
      freshState(),
      "Just so you know, I already have a competing offer on the table.",
    );
    expect(s.offerAskedAtTurn ?? null).toBeNull();
  });
});
