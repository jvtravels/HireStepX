import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  applyCandidateAnswer,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

const band: NegotiationBand = { initialOffer: 22, maxStretch: 28, walkAway: 18, hasEquity: false };

function freshStateWithOffer() {
  let s = initState({ sessionId: "t", role: "react", company: "Infosys", band });
  s = applyAiMove(s, { lever: "open-with-offer", newTotalLpa: 22, rationale: "open" }, "We can offer 22 LPA.");
  return s;
}

describe("Bug 2: kernel acceptance gate — hedged language does NOT close", () => {
  it("'I'd be comfortable moving forward if you can do 30L' stays non-terminal", () => {
    const s = freshStateWithOffer();
    const next = applyCandidateAnswer(s, "I'd be comfortable moving forward if you can do 30L");
    expect(next.phase).not.toBe("accepted");
    expect(next.acceptedAtTurn).toBeNull();
  });
  it("'sounds good' alone after an offer does NOT auto-close to accepted", () => {
    const s = freshStateWithOffer();
    const next = applyCandidateAnswer(s, "sounds good");
    // Without explicit acceptance, this MUST NOT terminate as accepted.
    expect(next.phase).not.toBe("accepted");
  });
  it("'thank you for clarifying' does NOT close", () => {
    const s = freshStateWithOffer();
    const next = applyCandidateAnswer(s, "thank you for clarifying that");
    expect(next.phase).not.toBe("accepted");
  });
  it("'I appreciate the offer' does NOT close", () => {
    const s = freshStateWithOffer();
    const next = applyCandidateAnswer(s, "I appreciate the offer");
    expect(next.phase).not.toBe("accepted");
  });
});

describe("Bug 2: kernel acceptance gate — explicit acceptance DOES close", () => {
  it("'I accept the offer' transitions to accepted", () => {
    const s = freshStateWithOffer();
    const next = applyCandidateAnswer(s, "I accept the offer.");
    expect(next.phase).toBe("accepted");
  });
  it("'please send the offer letter' transitions to accepted", () => {
    const s = freshStateWithOffer();
    const next = applyCandidateAnswer(s, "please send the offer letter");
    expect(next.phase).toBe("accepted");
  });
  it("'I'm in' transitions to accepted", () => {
    const s = freshStateWithOffer();
    const next = applyCandidateAnswer(s, "I'm in");
    expect(next.phase).toBe("accepted");
  });
  it("'let's move forward with this number' transitions to accepted", () => {
    const s = freshStateWithOffer();
    const next = applyCandidateAnswer(s, "let's move forward with this number");
    expect(next.phase).toBe("accepted");
  });
});
