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

  it("#128 — in-band conditional accept above the gap concedes (not a justify-probe) and converges", () => {
    const { transcript, finalState } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: { initialOffer: 32, maxStretch: 52, walkAway: 28, hasEquity: true },
      initExtras: { applicableYoe: 8, experienceLevel: "senior", currentCtcLpa: 34 },
      turns: [
        "Currently 34 LPA.",
        "I have a competing offer from Razorpay at 46.",
        "Can you match it?",
        "If you can do 46 I'm in.",
        "46 works, I'll sign today.",
        "Yes, 46 and I'm in.",
      ],
    });
    // The turn that handled "If you can do 46 I'm in." must be a cash
    // concession, NOT a probe interrogating the candidate for the number they
    // just committed to. (Pre-#128 this fired probe-expectations / a reactive
    // justify-probe and stalled.)
    const condTurn = transcript.find((t) => t.candidate === "If you can do 46 I'm in.");
    expect(condTurn).toBeTruthy();
    expect(condTurn!.kind).not.toMatch(/probe|reactive|expectations/i);
    // The offer must move UP toward the in-band ask (39 → >39), never stall flat.
    expect(condTurn!.highestOfferMade).toBeGreaterThan(39);
    // And the negotiation converges to a real close (no probe loop).
    expect(finalState.phase).toBe("accepted");
  });

  it("#129 — firm accept restating the in-band figure closes AT that figure, not the bare offer", () => {
    const { finalState } = runConversation({
      role: "Engineering Manager",
      company: "Flipkart",
      band: { initialOffer: 32, maxStretch: 52, walkAway: 28, hasEquity: true },
      initExtras: { applicableYoe: 8, experienceLevel: "senior", currentCtcLpa: 34 },
      turns: [
        "Currently 34 LPA.",
        "I have a competing offer from Razorpay at 46.",
        "Can you match it?",
        "If you can do 46 I'm in.",
        "46 works, I'll sign today.",
      ],
    });
    expect(finalState.phase).toBe("accepted");
    // The candidate agreed at 46 (in band, above the standing offer). The close
    // must land at 46 — never stealth-close on the bare offer the planner had
    // crept to (a #105-class under-close).
    expect(finalState.highestOfferMade).toBe(46);
  });

  it("#127 — terse accept-with-number ('fine 22 done') is acceptance AND closes at the stated figure", () => {
    const { finalState } = runConversation({
      role: "Engineering Manager",
      company: "Acme",
      band: { initialOffer: 18, maxStretch: 26, walkAway: 14, hasEquity: false },
      initExtras: { applicableYoe: 4, experienceLevel: "mid", currentCtcLpa: 16 },
      turns: ["16 fixed.", "want 24", "that's too low", "fine 22 done"],
    });
    // "fine 22 done" self-lowers from the 24 ask and welds the settle figure to
    // a commit token. It must (a) classify as acceptance — not fire another
    // anchor/counter — and (b) close at 22 (in band, above the offer), the
    // figure the candidate actually committed to, not the stale 24 ask nor the
    // bare standing offer.
    expect(finalState.phase).toBe("accepted");
    expect(finalState.highestOfferMade).toBe(22);
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
