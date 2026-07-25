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

  it("S82-B1: 'I'll pass along your offer to my wife' must NOT return decline (hand-off)", () => {
    expect(detectTrialCloseResponse("I'll pass along your offer to my wife for a quick discussion.")).not.toBe("decline");
  });
  it("S82-B1: 'I'm going to pass along some constraints' must NOT return decline (sharing info)", () => {
    expect(detectTrialCloseResponse("I'm going to pass along some constraints first.")).not.toBe("decline");
  });
  it("S82-B2: 'I'm going to decline to answer that' must NOT return decline (info privacy)", () => {
    expect(detectTrialCloseResponse("I'm going to decline to answer that.")).not.toBe("decline");
  });
  it("S82-B2: 'I'll decline to reveal my CTC' must NOT return decline (info privacy)", () => {
    expect(detectTrialCloseResponse("I'll decline to reveal my current CTC.")).not.toBe("decline");
  });
  it("S82-B1 regression: bare 'I'll pass' IS decline", () => {
    expect(detectTrialCloseResponse("I'll pass.")).toBe("decline");
  });
  it("S82-B2 regression: 'I decline this offer' IS decline", () => {
    expect(detectTrialCloseResponse("I decline this offer.")).toBe("decline");
  });

  // S87 (2026-07-26) — missing accept/decline patterns in trial-close detector
  it("S87: 'Sounds good' IS accept (was returning null — required 'let's proceed')", () => {
    expect(detectTrialCloseResponse("Sounds good.")).toBe("accept");
  });
  it("S87: 'I will take it' IS accept (was returning null — required contraction I'll)", () => {
    expect(detectTrialCloseResponse("I will take it.")).toBe("accept");
  });
  it("S87: 'Count me in' IS accept", () => {
    expect(detectTrialCloseResponse("Count me in.")).toBe("accept");
  });
  it("S87: 'Agreed!' IS accept (added to bare affirmatives)", () => {
    expect(detectTrialCloseResponse("Agreed!")).toBe("accept");
  });
  it("S87: 'Consider it done' IS accept", () => {
    expect(detectTrialCloseResponse("Consider it done.")).toBe("accept");
  });
  it("S87: 'That is acceptable' IS accept", () => {
    expect(detectTrialCloseResponse("That is acceptable.")).toBe("accept");
  });
  it("S87: 'No deal' IS decline", () => {
    expect(detectTrialCloseResponse("No deal.")).toBe("decline");
  });
  it("S87: 'No deal-breakers' is NOT decline (breakers guard)", () => {
    expect(detectTrialCloseResponse("I have no deal-breakers on equity.")).not.toBe("decline");
  });
  it("S87 regression: 'Sounds good, let me think' is hedge (hedge beats accept)", () => {
    expect(detectTrialCloseResponse("Sounds good, let me think about it.")).toBe("hedge");
  });
});
