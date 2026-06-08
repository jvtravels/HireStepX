/* AUDIT-4 (2026-06-08) — Output-rail unit tests.
 *
 * Pure-function tests for the offer-ask invariant rail. Asserts:
 *  1. Allow path: candidate didn't ask for a number → rail no-ops.
 *  2. Allow path: drafted text contains a salary number → rail no-ops.
 *  3. Allow path: drafted text contains an honest ceiling → rail no-ops.
 *  4. Block path: explicit offer-ask + indefinite-defer fluff
 *     ("competitive and based on your experience") → blocked with
 *     reason `indefinite-defer-after-offer-ask` and a substitute that
 *     names a number.
 *  5. Block path: explicit offer-ask + no number, no ceiling → blocked
 *     with reason `no-number-no-ceiling`.
 *  6. Over-band branch (candidate current >= stretch) → substitute
 *     names the stretch AND bounces a calibrated question.
 *  7. Terminal phase exemption: rail does not fire in closing-push.
 */

import { describe, it, expect } from "vitest";
import { enforceOfferAskInvariant, OFFER_ASK_RE } from "../../server-handlers/_output-rail-offer-ask";
import type { NegotiationState } from "../../server-handlers/_negotiation-kernel";

const baseState: NegotiationState = {
  band: { walkAway: 22, initialOffer: 28, maxStretch: 35 },
  phase: "probe-expectations",
  turnIndex: 6,
  candidateCurrentCtc: 26,
  candidateTarget: 38,
  sessionId: "test-session",
  highestOfferMade: 0,
  conversationLog: [],
  lastAiText: "",
  lastTurnDelta: null,
  // The state shape has many optional fields; this cast keeps the
  // test focused on the rail's actual reads (band, phase, turnIndex,
  // candidateCurrentCtc, sessionId).
} as unknown as NegotiationState;

describe("OFFER_ASK_RE", () => {
  it("matches common offer-ask phrasings", () => {
    const positives = [
      "What's your offer?",
      "what is your offer for this role",
      "can you share the range",
      "share the number please",
      "What are you offering for the role?",
      "what's the range you're working with",
      "tell me the number",
      "how much are you offering",
      "what figure are you thinking",
      "what fitment are you working with",
    ];
    for (const p of positives) {
      expect(OFFER_ASK_RE.test(p), `should match: ${p}`).toBe(true);
    }
  });

  it("does NOT match disclosures or non-asks", () => {
    const negatives = [
      "my current is 32L fixed",
      "I'm looking at around 40L total",
      "What's your timeline for this role?",
      "tell me about the team",
      "can you share more about the role",
    ];
    for (const n of negatives) {
      expect(OFFER_ASK_RE.test(n), `should NOT match: ${n}`).toBe(false);
    }
  });
});

describe("enforceOfferAskInvariant — allow paths", () => {
  it("no-ops when candidate didn't ask for a number", () => {
    const v = enforceOfferAskInvariant({
      candidateAnswer: "my current is 32L fixed and 4L variable",
      draftedText: "Got it — what range are you anchoring on for the move?",
      state: baseState,
    });
    expect(v.allow).toBe(true);
    expect(v.substitute).toBeNull();
  });

  it("no-ops when drafted text contains a salary number", () => {
    const v = enforceOfferAskInvariant({
      candidateAnswer: "what's your offer?",
      draftedText: "We're looking at around 30L for this role at the moment.",
      state: baseState,
    });
    expect(v.allow).toBe(true);
  });

  it("no-ops when drafted text contains an honest ceiling sentence", () => {
    const v = enforceOfferAskInvariant({
      candidateAnswer: "what's your offer?",
      draftedText:
        "Honest — that's above where this role typically sits. " +
        "What would make a move in this zone work for you?",
      state: baseState,
    });
    expect(v.allow).toBe(true);
  });
});

describe("enforceOfferAskInvariant — block paths", () => {
  it("blocks the Flipkart 'competitive and based on your experience' dodge", () => {
    const v = enforceOfferAskInvariant({
      candidateAnswer: "what's your offer for the role?",
      draftedText:
        "Our offer is competitive and based on your experience and the role's requirements.",
      state: baseState,
    });
    expect(v.allow).toBe(false);
    expect(v.reason).toBe("indefinite-defer-after-offer-ask");
    expect(v.substitute).not.toBeNull();
    expect(v.substitute).toMatch(/\d/);
  });

  it("blocks the 'let me check and get back' dodge", () => {
    const v = enforceOfferAskInvariant({
      candidateAnswer: "can you share the range?",
      draftedText: "Let me check internally and come back to you on that.",
      state: baseState,
    });
    expect(v.allow).toBe(false);
    expect(v.reason).toBe("indefinite-defer-after-offer-ask");
  });

  it("blocks no-number, no-ceiling responses when explicitly asked", () => {
    const v = enforceOfferAskInvariant({
      candidateAnswer: "what number are you thinking?",
      draftedText:
        "That's a great question — what's most important to you in this move?",
      state: baseState,
    });
    expect(v.allow).toBe(false);
    expect(v.reason).toBe("no-number-no-ceiling");
  });
});

describe("enforceOfferAskInvariant — over-band substitute", () => {
  it("when candidate current >= band stretch, substitute names ceiling AND bounces calibrated question", () => {
    const overBandState = {
      ...baseState,
      band: { walkAway: 25, initialOffer: 30, maxStretch: 35 },
      candidateCurrentCtc: 40, // Above stretch — Flipkart Sr PD case
    } as NegotiationState;
    const v = enforceOfferAskInvariant({
      candidateAnswer: "what's your offer for this role?",
      draftedText: "Our offer is competitive and based on your experience.",
      state: overBandState,
    });
    expect(v.allow).toBe(false);
    expect(v.substitute).toMatch(/35L/);
    expect(v.substitute).toMatch(/non-cash|ESOP|joining|role scope/i);
    expect(v.substitute).toMatch(/\?/); // must contain a calibrated question
  });

  it("when candidate is below stretch, substitute names the stretch", () => {
    const v = enforceOfferAskInvariant({
      candidateAnswer: "what's your offer?",
      draftedText: "Let me come back to you on that.",
      state: baseState, // current 26, stretch 35
    });
    expect(v.allow).toBe(false);
    expect(v.substitute).toMatch(/35L/);
  });
});

describe("enforceOfferAskInvariant — phase exemptions", () => {
  it("does not fire in closing-push phase (close path has its own contract)", () => {
    const terminalState = { ...baseState, phase: "closing-push" } as NegotiationState;
    const v = enforceOfferAskInvariant({
      candidateAnswer: "what's your offer?",
      draftedText: "Let me come back to you on that.",
      state: terminalState,
    });
    expect(v.allow).toBe(true);
  });

  it("does not fire in walked-away phase", () => {
    const terminalState = { ...baseState, phase: "walked-away" } as NegotiationState;
    const v = enforceOfferAskInvariant({
      candidateAnswer: "what was your offer going to be?",
      draftedText: "Appreciate the time today.",
      state: terminalState,
    });
    expect(v.allow).toBe(true);
  });
});
