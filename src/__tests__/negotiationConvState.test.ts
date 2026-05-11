import { describe, it, expect } from "vitest";
import {
  detectPendingRequest,
  deriveConvState,
  phaseForState,
  isAcceptedState,
  type StateSignals,
} from "../../server-handlers/_negotiation-state";

const baseSignals: StateSignals = {
  acceptedThisTurn: false,
  conditionalAccept: false,
  rejectedThisTurn: false,
  walkAwayThisTurn: false,
  deflectedThisTurn: false,
  needsTimeThisTurn: false,
  acceptedEverInHistory: false,
  answer: "",
};

describe("detectPendingRequest", () => {
  it("returns null for plain statements", () => {
    expect(detectPendingRequest("Yes, that works for me.")).toBeNull();
    expect(detectPendingRequest("Okay")).toBeNull();
    expect(detectPendingRequest("")).toBeNull();
  });

  it("classifies breakdown asks as kind=breakdown", () => {
    const r = detectPendingRequest("Can you give me a breakdown of the ₹27 LPA?");
    expect(r?.kind).toBe("breakdown");
  });

  it("classifies generic questions as kind=question", () => {
    const r = detectPendingRequest("What's the joining bonus?");
    expect(r?.kind).toBe("question");
  });

  it("treats explicit requests without '?' as questions", () => {
    expect(detectPendingRequest("Walk me through the structure please.")?.kind).toBe("breakdown");
    expect(detectPendingRequest("Tell me how much equity vests in year 1.")?.kind).toBe("question");
  });
});

describe("deriveConvState", () => {
  it("returns open when no signals fire", () => {
    expect(deriveConvState(baseSignals).kind).toBe("open");
  });

  it("returns accepted on a fresh yes", () => {
    expect(deriveConvState({ ...baseSignals, acceptedThisTurn: true }).kind).toBe("accepted");
  });

  it("returns accepted (sticky) when the candidate accepted earlier", () => {
    expect(
      deriveConvState({ ...baseSignals, acceptedEverInHistory: true }).kind,
    ).toBe("accepted");
  });

  it("rejection on this turn dominates over sticky accept", () => {
    // A fresh rejection re-opens — the prior sticky-accept doesn't lock
    // us into closing. Important: candidates do flip mid-session.
    expect(
      deriveConvState({
        ...baseSignals,
        rejectedThisTurn: true,
        acceptedEverInHistory: true,
      }).kind,
    ).toBe("rejected");
  });

  it("walk-away dominates over rejection", () => {
    expect(
      deriveConvState({ ...baseSignals, walkAwayThisTurn: true, rejectedThisTurn: true }).kind,
    ).toBe("walking");
  });

  it("conditional-accept is its own state, not collapsed into accepted", () => {
    expect(
      deriveConvState({ ...baseSignals, conditionalAccept: true }).kind,
    ).toBe("conditional-accept");
  });

  it("carries pending requests alongside any state", () => {
    const s = deriveConvState({
      ...baseSignals,
      acceptedEverInHistory: true,
      answer: "Can you give me a breakdown of ₹27?",
    });
    expect(s.kind).toBe("accepted");
    expect(s.pendingRequest?.kind).toBe("breakdown");
  });

  it("rejection state carries pending request too", () => {
    const s = deriveConvState({
      ...baseSignals,
      rejectedThisTurn: true,
      answer: "That's too low. What's your absolute best?",
    });
    expect(s.kind).toBe("rejected");
    expect(s.pendingRequest?.kind).toBe("question");
  });
});

describe("phaseForState", () => {
  it("[behavior preserved] rejected + closing → counter-offer", () => {
    expect(phaseForState({ kind: "rejected" }, "closing")).toBe("counter-offer");
    expect(phaseForState({ kind: "rejected" }, "closing-pressure")).toBe("counter-offer");
  });

  it("[behavior preserved] walking + closing → counter-offer", () => {
    expect(phaseForState({ kind: "walking" }, "closing")).toBe("counter-offer");
  });

  it("[behavior preserved] rejected on non-closing phase stays put", () => {
    expect(phaseForState({ kind: "rejected" }, "counter-offer")).toBe("counter-offer");
    expect(phaseForState({ kind: "rejected" }, "probe-expectations")).toBe("probe-expectations");
  });

  it("[Morningstar T6 fix] accepted + pendingRequest → offer-reaction", () => {
    expect(
      phaseForState(
        { kind: "accepted", pendingRequest: { kind: "breakdown", text: "Can you give me a breakdown of ₹27?" } },
        "closing",
      ),
    ).toBe("offer-reaction");
  });

  it("accepted WITHOUT pendingRequest stays in closing", () => {
    expect(phaseForState({ kind: "accepted" }, "closing")).toBe("closing");
  });

  it("open with pendingRequest while closing-family → offer-reaction", () => {
    expect(
      phaseForState(
        { kind: "open", pendingRequest: { kind: "question", text: "What's the joining bonus?" } },
        "closing",
      ),
    ).toBe("offer-reaction");
  });

  it("open with pendingRequest in non-closing phase stays put (the prompt's own probe rules handle it)", () => {
    expect(
      phaseForState(
        { kind: "open", pendingRequest: { kind: "breakdown", text: "Walk me through it" } },
        "probe-expectations",
      ),
    ).toBe("probe-expectations");
  });
});

describe("isAcceptedState", () => {
  it("true for accepted + conditional-accept; false for everything else", () => {
    expect(isAcceptedState({ kind: "accepted" })).toBe(true);
    expect(isAcceptedState({ kind: "conditional-accept" })).toBe(true);
    expect(isAcceptedState({ kind: "open" })).toBe(false);
    expect(isAcceptedState({ kind: "rejected" })).toBe(false);
    expect(isAcceptedState({ kind: "walking" })).toBe(false);
  });
});
