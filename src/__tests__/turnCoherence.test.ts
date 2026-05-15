/* Sprint C.1 (2026-05-15) — turn-coherence detector. Pure unit tests. */
import { describe, it, expect } from "vitest";
import { assessTurnCoherence } from "../../server-handlers/_turn-coherence";

describe("Sprint C.1 — assessTurnCoherence (empty inputs)", () => {
  it("returns coherent=true on empty candidate utterance", () => {
    expect(assessTurnCoherence("", "Hello, welcome.").coherent).toBe(true);
  });
  it("returns coherent=true on empty bot reply", () => {
    expect(assessTurnCoherence("What's the fixed?", "").coherent).toBe(true);
  });
  it("returns coherent=true on whitespace-only", () => {
    expect(assessTurnCoherence("   ", "   ").coherent).toBe(true);
  });
});

describe("Sprint C.1 — breakdown-ask heuristic", () => {
  it("'what's the fixed?' with number answer → coherent", () => {
    const r = assessTurnCoherence("What's the fixed?", "The fixed is 12 LPA.");
    expect(r.coherent).toBe(true);
  });
  it("'what's the fixed?' with no number, no deferral → incoherent", () => {
    const r = assessTurnCoherence("What's the fixed?", "Let me tell you about the role first.");
    expect(r.coherent).toBe(false);
    expect(r.reason).toMatch(/breakdown/);
  });
  it("'variable?' with explicit deferral → coherent", () => {
    const r = assessTurnCoherence("Variable?", "I'll come back to that after we discuss your target.");
    expect(r.coherent).toBe(true);
  });
  it("'in-hand?' with number → coherent", () => {
    const r = assessTurnCoherence("In-hand?", "Roughly 14L in-hand.");
    expect(r.coherent).toBe(true);
  });
  it("'in hand?' with deferral via 'circle back' → coherent", () => {
    const r = assessTurnCoherence("What's my in hand?", "Let me circle back on that once we finalize the offer.");
    expect(r.coherent).toBe(true);
  });
  it("'breakdown?' with neither number nor deferral → incoherent", () => {
    const r = assessTurnCoherence("Can I get the breakdown?", "We are excited about your profile.");
    expect(r.coherent).toBe(false);
  });
});

describe("Sprint C.1 — question heuristic (explicit ?)", () => {
  it("direct yes answer to yes/no question → coherent", () => {
    const r = assessTurnCoherence("Is there any equity component?", "Yes, there is RSU vesting over 4 years.");
    expect(r.coherent).toBe(true);
  });
  it("direct no answer → coherent", () => {
    const r = assessTurnCoherence("Will you reconsider the offer?", "No, that's our final position.");
    expect(r.coherent).toBe(true);
  });
  it("question with high content overlap → coherent", () => {
    const r = assessTurnCoherence(
      "What is the notice period expectation for this role?",
      "The notice period expectation for this role is 60 days.",
    );
    expect(r.coherent).toBe(true);
  });
  it("question with zero overlap and no direct-answer marker → incoherent", () => {
    const r = assessTurnCoherence(
      "What about relocation assistance for Bangalore?",
      "We're glad you applied to our company.",
    );
    expect(r.coherent).toBe(false);
    expect(r.reason).toMatch(/overlap/);
  });
  it("question answered with explicit deferral marker → coherent", () => {
    const r = assessTurnCoherence(
      "What's the joining bonus?",
      "Let me come back to you on that one tomorrow.",
    );
    expect(r.coherent).toBe(true);
  });
});

describe("Sprint C.1 — non-question statement", () => {
  it("plain statement from candidate → always coherent", () => {
    const r = assessTurnCoherence(
      "I'm currently making 18 LPA.",
      "Got it, thanks for sharing.",
    );
    expect(r.coherent).toBe(true);
  });
});
