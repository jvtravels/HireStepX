import { describe, it, expect } from "vitest";
import {
  candidateMentionedCompetingOffer,
  stripPhantomCompetingOffer,
} from "../../server-handlers/_negotiation-competing";

describe("candidateMentionedCompetingOffer", () => {
  it("returns true on explicit affirmative statements", () => {
    expect(candidateMentionedCompetingOffer("I have another offer from Razorpay")).toBe(true);
    expect(candidateMentionedCompetingOffer("Got an offer from Flipkart last week")).toBe(true);
    expect(candidateMentionedCompetingOffer("I received a competing offer at ₹50 LPA")).toBe(true);
    expect(candidateMentionedCompetingOffer("In-hand offer is around ₹45 LPA")).toBe(true);
  });

  it("returns true when a rupee figure is attached to a competing-offer phrase", () => {
    expect(candidateMentionedCompetingOffer("competing offer of ₹40 LPA")).toBe(true);
  });

  it("returns false on negations — the Lemon Yellow bug pattern", () => {
    // Hirestepx round-5: AI asked "Any competing offer as of now?",
    // candidate answered "No, not really". The AI then fabricated a
    // competing offer in the next turn. This must read as denial.
    expect(candidateMentionedCompetingOffer("Any competing offer as of now? No, not really.")).toBe(false);
    expect(candidateMentionedCompetingOffer("No, I don't have another offer")).toBe(false);
    expect(candidateMentionedCompetingOffer("Haven't received any offers yet")).toBe(false);
    expect(candidateMentionedCompetingOffer("Nothing so far")).toBe(false);
  });

  it("returns false on empty or unrelated text", () => {
    expect(candidateMentionedCompetingOffer("")).toBe(false);
    expect(candidateMentionedCompetingOffer("I'm currently with TCS, looking to move")).toBe(false);
  });

  it("detects a named-company competing offer — OA-B25", () => {
    // Verb-anchored possession with a company qualifier between the
    // determiner and "offer".
    expect(candidateMentionedCompetingOffer("I have an Amazon offer at ₹72L")).toBe(true);
    expect(candidateMentionedCompetingOffer("I received a Google offer at 75 LPA")).toBe(true);
    expect(candidateMentionedCompetingOffer("I got another Flipkart offer last week")).toBe(true);
    // Bare named-company offer welded to a rupee figure (no possession verb).
    expect(candidateMentionedCompetingOffer("Amazon offer at ₹72L")).toBe(true);
    expect(candidateMentionedCompetingOffer("Google offer of 75 LPA")).toBe(true);
  });

  it("does NOT treat an aspirational offer wish as competing — OA-B25 guard", () => {
    // No possession verb and no capitalized company → not a competing claim.
    expect(candidateMentionedCompetingOffer("I'd be happy with an offer of ₹50L")).toBe(false);
    expect(candidateMentionedCompetingOffer("I'm hoping for an offer around 50 LPA")).toBe(false);
  });
});

describe("stripPhantomCompetingOffer", () => {
  const noOfferCtx = (candidateText = "") => ({
    sessionHasCompetingOffer: false,
    candidateText,
  });

  it("strips the AI's fabricated competing-offer sentence (Lemon Yellow bug)", () => {
    const input =
      "I appreciate you bringing up a competing offer, Jay. To help me understand where we need to be competitive, could you share more?";
    const r = stripPhantomCompetingOffer(input, noOfferCtx("No, not really"));
    expect(r.stripped).toBe(true);
    expect(r.text).not.toContain("competing offer");
    expect(r.text).not.toContain("bringing up");
  });

  it("strips 'the other company' / 'their offer' phrasings too", () => {
    const r = stripPhantomCompetingOffer(
      "Let me see what we can do. What is the other company offering? I want to beat that offer of ₹50.",
      noOfferCtx(""),
    );
    expect(r.stripped).toBe(true);
    expect(r.text).not.toMatch(/other\s+company/i);
  });

  it("leaves text untouched when session has a recorded competing offer", () => {
    const r = stripPhantomCompetingOffer(
      "I appreciate the competing offer of ₹40 LPA.",
      { sessionHasCompetingOffer: true, candidateText: "" },
    );
    expect(r.stripped).toBe(false);
  });

  it("leaves text untouched when candidate affirmed a competing offer", () => {
    const r = stripPhantomCompetingOffer(
      "Thanks for sharing your competing offer details.",
      noOfferCtx("I have another offer from Razorpay at ₹45 LPA"),
    );
    expect(r.stripped).toBe(false);
  });

  it("falls back to a neutral redirect when the entire response was phantom prose", () => {
    const r = stripPhantomCompetingOffer(
      "Tell me about your competing offer.",
      noOfferCtx("No"),
    );
    expect(r.stripped).toBe(true);
    expect(r.text).toContain("Help me understand");
  });

  it("preserves non-phantom sentences in a mixed response", () => {
    const r = stripPhantomCompetingOffer(
      "I hear you, Jay. I appreciate you bringing up a competing offer. Let me see what flexibility I have.",
      noOfferCtx("No competing offer right now"),
    );
    expect(r.stripped).toBe(true);
    expect(r.text).toContain("I hear you, Jay");
    expect(r.text).toContain("flexibility");
    expect(r.text).not.toMatch(/competing\s+offer/i);
  });
});
