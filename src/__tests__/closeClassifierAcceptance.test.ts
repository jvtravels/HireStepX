/* Close-classifier acceptance guards — findings #124 / #125 / #126
 * (2026-06-21, live-staging Flipkart-EM hardening loop).
 *
 * These lock three structural fixes in the salary-negotiation kernel's
 * acceptance path. All three run through the REAL deterministic pipeline
 * (kernel + planner + canonical-prose) via the offline simulator, i.e. the
 * worst case we ship when the LLM is unavailable.
 *
 *   #124 — a forward-commitment idiom over a standing offer
 *          ("Sounds good, let's go ahead") must CLOSE the session, not
 *          route back to a discovery / expectations probe. The strict
 *          acceptance gate now recognises let's-go-ahead/proceed/do-it so
 *          it bypasses the PDF#48 one-turn-wait the same way an explicit
 *          "I accept" does.
 *
 *   #125 — on a band accept, the close number must honour an in-band
 *          candidate TARGET (capped at the band ceiling), not silently fall
 *          back to the disclosed-CTC hike floor. A committed offer must be
 *          registered (highestOfferMade > 0), never ₹0.
 *
 *   #126 — the candidate's OWN ask (expected CTC / target) is theirs to
 *          revise. Lowering it ("I want 50" → "if you can do 38 I'm in") is
 *          a concession, not a factual contradiction, so the
 *          contradiction-callout (reserved for immutable facts like current
 *          CTC) must NOT fire.
 */
import { describe, it, expect } from "vitest";
import { runConversation } from "./_negotiationSim";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const EM_BAND: NegotiationBand = {
  initialOffer: 32.7,
  maxStretch: 56,
  walkAway: 26.6,
  hasEquity: true,
};
const EM_EXTRAS = {
  applicableYoe: 9,
  experienceLevel: "senior",
  currentCtcLpa: 14,
};

describe("close-classifier acceptance guards (#124/#125/#126)", () => {
  it("#124 — forward-commitment idiom over a standing offer closes the session", () => {
    const { transcript, finalState } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: EM_BAND,
      initExtras: EM_EXTRAS,
      turns: ["My current is 14.", "Sounds good, let's go ahead."],
    });
    // An offer was on the table before the accept...
    expect(finalState.highestOfferMade).toBeGreaterThan(0);
    // ...and the forward-commitment idiom drove a real close.
    expect(finalState.phase).toBe("accepted");
    expect(transcript[transcript.length - 1].terminal).toBe(true);
  });

  it("#125 — band accept registers a committed offer (never ₹0), honouring an in-band target", () => {
    const HIGH_BAND: NegotiationBand = {
      initialOffer: 32,
      maxStretch: 40,
      walkAway: 26,
      hasEquity: true,
    };
    const { finalState } = runConversation({
      role: "Staff Engineer",
      company: "Stripe",
      band: HIGH_BAND,
      turns: [
        "I'm at Razorpay, 30 LPA, 24 fixed 6 variable.",
        "I have a competing offer at 38.",
        "Targeting 40 to move.",
        "Where would you land?",
        "That works for me. Let's go ahead and close.",
      ],
    });
    expect(finalState.phase).toBe("accepted");
    // In-band target (40) is honoured over the disclosed-CTC floor, capped
    // at the band ceiling — never the ₹0 / floor-only fallback.
    expect(finalState.highestOfferMade).toBe(40);
  });

  it("#126 — self-lowered ask is a concession, not a contradiction-callout", () => {
    const { transcript } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: EM_BAND,
      initExtras: EM_EXTRAS,
      turns: ["I want 50.", "Come on, stretch.", "if you can do 38 I'm in"],
      stopOnTerminal: false,
    });
    // Revising one's own ask downward must never trip the "which figure
    // should I take to the panel?" contradiction-callout.
    expect(transcript.every((t) => t.kind !== "contradiction-callout")).toBe(true);
  });
});
