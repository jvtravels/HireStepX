/* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature close guard.
 *
 * Real bug: session ended after ~6 turns with "View Result" button
 * and no resolution. Block any transition to terminal phase before
 * minTurnsBeforeClose (default 8) unless the candidate explicitly
 * declined or MAX_TURNS_PER_SESSION (60) is reached. */
import { describe, expect, it } from "vitest";
import {
  canCloseSession,
  detectExplicitDecline,
  detectConsecutiveDeadEnd,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";

function fakeState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    turnIndex: 0,
    minTurnsBeforeClose: 8,
    conversationLog: [],
    ...overrides,
  } as NegotiationState;
}

describe("canCloseSession — premature close guard", () => {
  it("blocks soft-accept at turn 3 (below floor 8)", () => {
    const s = fakeState({ turnIndex: 3 });
    expect(canCloseSession(s, "ok", "soft-accept")).toBe(false);
  });

  it("blocks dead-end at turn 3 (below floor 8)", () => {
    const s = fakeState({ turnIndex: 3 });
    expect(canCloseSession(s, "I don't know", "dead-end")).toBe(false);
  });

  it("allows soft-accept at turn 8 (at floor)", () => {
    const s = fakeState({ turnIndex: 8 });
    expect(canCloseSession(s, "ok", "soft-accept")).toBe(true);
  });

  it("allows soft-accept at turn 12 (above floor)", () => {
    const s = fakeState({ turnIndex: 12 });
    expect(canCloseSession(s, "ok", "soft-accept")).toBe(true);
  });

  it("explicit strict accept always passes regardless of turn", () => {
    const s = fakeState({ turnIndex: 2 });
    expect(canCloseSession(s, "I accept the offer", "accept")).toBe(true);
  });

  it("explicit decline always passes regardless of turn", () => {
    const s = fakeState({ turnIndex: 2 });
    expect(canCloseSession(s, "I'll decline", "decline")).toBe(true);
  });

  it("max-turns reason always passes", () => {
    const s = fakeState({ turnIndex: 60 });
    expect(canCloseSession(s, "anything", "max-turns")).toBe(true);
  });

  it("explicit-decline language at low turn unlocks soft-accept close", () => {
    const s = fakeState({ turnIndex: 3 });
    expect(canCloseSession(s, "I'm passing on this opportunity", "soft-accept")).toBe(true);
  });
});

describe("detectExplicitDecline", () => {
  it("detects 'I'm passing'", () => {
    expect(detectExplicitDecline("I'm passing on this.")).toBe(true);
  });
  it("detects 'I'll decline'", () => {
    expect(detectExplicitDecline("I'll decline the offer.")).toBe(true);
  });
  it("detects 'not interested'", () => {
    expect(detectExplicitDecline("I'm not interested anymore.")).toBe(true);
  });
  it("returns false for hedged language", () => {
    expect(detectExplicitDecline("Let me think about it.")).toBe(false);
  });
  it("handles null gracefully", () => {
    expect(detectExplicitDecline(null)).toBe(false);
  });
});

describe("detectConsecutiveDeadEnd", () => {
  it("returns true on 3 consecutive 'I don't know' candidate turns", () => {
    const s = fakeState({
      conversationLog: [
        { speaker: "ai", text: "Q1" },
        { speaker: "candidate", text: "I don't know" },
        { speaker: "ai", text: "Q2" },
        { speaker: "candidate", text: "Not sure" },
        { speaker: "ai", text: "Q3" },
        { speaker: "candidate", text: "I don't know" },
      ],
    });
    expect(detectConsecutiveDeadEnd(s)).toBe(true);
  });

  it("returns false when a non-deadend turn breaks the run", () => {
    const s = fakeState({
      conversationLog: [
        { speaker: "candidate", text: "I don't know" },
        { speaker: "candidate", text: "Actually ₹20L works" },
        { speaker: "candidate", text: "Not sure" },
      ],
    });
    expect(detectConsecutiveDeadEnd(s)).toBe(false);
  });

  it("returns false on fewer than 3 candidate turns", () => {
    const s = fakeState({
      conversationLog: [
        { speaker: "candidate", text: "I don't know" },
        { speaker: "candidate", text: "Not sure" },
      ],
    });
    expect(detectConsecutiveDeadEnd(s)).toBe(false);
  });
});
