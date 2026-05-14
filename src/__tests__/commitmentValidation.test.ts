/* PDF #17 architectural fix (2026-05-15) — trial-close detect +
 * response classification. */
import { describe, it, expect } from "vitest";
import { NEGOTIATION_SYSTEM_PROMPT } from "../../server-handlers/_negotiate-turn-helpers";
import {
  detectTrialCloseAsked,
  detectTrialCloseResponse,
} from "../../server-handlers/_trial-close-detector";

describe("COMMITMENT VALIDATION rule", () => {
  it("the system prompt contains the COMMITMENT VALIDATION block", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/COMMITMENT VALIDATION/);
  });

  it("the rule warns that hedged language MEANS the trial close failed", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT.toLowerCase()).toMatch(/hedged/);
    expect(NEGOTIATION_SYSTEM_PROMPT.toLowerCase()).toMatch(/trial close/);
  });
});

describe("detectTrialCloseAsked", () => {
  it("fires on 'if we land at ₹X would you accept'", () => {
    expect(
      detectTrialCloseAsked(
        "If we land at ₹26L total, would you accept this offer today?",
      ),
    ).toBe(true);
  });

  it("fires on 'is ₹X workable'", () => {
    expect(detectTrialCloseAsked("Is ₹24L within your range?")).toBe(true);
  });

  it("does NOT fire on a plain offer disclosure", () => {
    expect(detectTrialCloseAsked("Our offer is ₹24L total.")).toBe(false);
  });

  it("handles null/empty input", () => {
    expect(detectTrialCloseAsked(null)).toBe(false);
    expect(detectTrialCloseAsked("")).toBe(false);
  });
});

describe("detectTrialCloseResponse", () => {
  it("classifies a clean accept", () => {
    expect(detectTrialCloseResponse("Yes, I accept the offer.")).toBe("accept");
    expect(detectTrialCloseResponse("Please send the offer letter")).toBe("accept");
    expect(detectTrialCloseResponse("I'm in.")).toBe("accept");
  });

  it("classifies a clean decline", () => {
    expect(detectTrialCloseResponse("I'm passing on this one")).toBe("decline");
    expect(detectTrialCloseResponse("Not interested")).toBe("decline");
  });

  it("classifies hedged language as hedge, NOT accept", () => {
    expect(detectTrialCloseResponse("I'd be comfortable if you can match it")).toBe("hedge");
    expect(detectTrialCloseResponse("Let me think about it")).toBe("hedge");
    expect(detectTrialCloseResponse("I'll get back to you")).toBe("hedge");
    expect(detectTrialCloseResponse("Maybe")).toBe("hedge");
  });

  it("returns null on unrelated text", () => {
    expect(detectTrialCloseResponse("Tell me about the team.")).toBeNull();
    expect(detectTrialCloseResponse("")).toBeNull();
    expect(detectTrialCloseResponse(null)).toBeNull();
  });
});
