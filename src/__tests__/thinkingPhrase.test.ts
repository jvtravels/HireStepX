import { describe, it, expect } from "vitest";
import { buildThinkingPhrase, shouldStaySilent } from "../_thinking-phrase";

/* The phrase content is randomised (pickRandom over reaction banks)
   so tests assert on STRUCTURAL properties — phrase emitted vs null,
   counter deltas, mark flags — not specific strings. The exact phrase
   bank wording lives in _interview-engine-helpers.ts and is covered
   there. */

const baseInput = {
  currentStep: 3,
  stepType: "question" as const,
  interviewType: "behavioral",
  lastAnswerQuality: "decent" as const,
  lastAnswerText: "We shipped the migration in two weeks.",
  personality: "balanced" as const,
  questionsRemaining: 3,
  pushbackCount: 0,
  lastQuestionSpoken: false,
  timePressureSpoken: false,
};

describe("buildThinkingPhrase", () => {
  it("returns no phrase on the very first step", () => {
    const r = buildThinkingPhrase({ ...baseInput, currentStep: 0 });
    expect(r.phrase).toBeNull();
  });

  it("returns no phrase for an intro step", () => {
    const r = buildThinkingPhrase({ ...baseInput, stepType: "intro" });
    expect(r.phrase).toBeNull();
  });

  it("emits a phrase for a standard question with strong answer", () => {
    const r = buildThinkingPhrase({ ...baseInput, lastAnswerQuality: "strong", lastAnswerText: "I led a team of six and grew revenue 40%." });
    expect(typeof r.phrase).toBe("string");
    expect(r.phrase!.length).toBeGreaterThan(0);
  });

  it("uses a follow-up bridge phrase when stepType is follow-up", () => {
    /* Force strong quality so the productive-silence gate (which can
       fire 40% of the time on a decent answer) doesn't pre-empt and
       return a null phrase. */
    const r = buildThinkingPhrase({ ...baseInput, stepType: "follow-up", lastAnswerQuality: "strong" });
    expect(typeof r.phrase).toBe("string");
    expect(r.dontKnowDelta).toBe(0);
  });

  it("sets dontKnowDelta when the user surrenders", () => {
    /* "strong" quality dodges the silence gate so we deterministically
       reach the dontKnow branch. Quality is incidental here — what
       matters is the lastAnswerText pattern. */
    const r = buildThinkingPhrase({ ...baseInput, lastAnswerQuality: "strong", lastAnswerText: "I don't know, I haven't faced that situation." });
    expect(r.dontKnowDelta).toBe(1);
    expect(typeof r.phrase).toBe("string");
  });

  /* These tests use lastAnswerQuality: "strong" to bypass the
     productive-silence gate (which can pre-empt at 40% on decent
     answers) — silence makes the test flaky. With strong, the path
     is deterministic. */
  it("marks lastQuestionSpoken when only one question remains", () => {
    const r = buildThinkingPhrase({ ...baseInput, lastAnswerQuality: "strong", questionsRemaining: 1 });
    expect(r.markedLastQuestionSpoken).toBe(true);
  });

  it("does not re-mark lastQuestionSpoken once it's already been marked", () => {
    const r = buildThinkingPhrase({ ...baseInput, lastAnswerQuality: "strong", questionsRemaining: 1, lastQuestionSpoken: true });
    expect(r.markedLastQuestionSpoken).toBe(false);
  });

  it("marks timePressureSpoken when 2 questions remain past the warmup", () => {
    const r = buildThinkingPhrase({ ...baseInput, lastAnswerQuality: "strong", questionsRemaining: 2, currentStep: 5 });
    expect(r.markedTimePressureSpoken).toBe(true);
  });

  it("does not mark time pressure during warmup steps", () => {
    const r = buildThinkingPhrase({ ...baseInput, lastAnswerQuality: "strong", questionsRemaining: 2, currentStep: 1 });
    expect(r.markedTimePressureSpoken).toBe(false);
  });

  describe("salary-negotiation branch", () => {
    const negInput = { ...baseInput, interviewType: "salary-negotiation" };

    it("increments pushback count on rejection language", () => {
      const r = buildThinkingPhrase({ ...negInput, lastAnswerText: "That's not acceptable, way too low." });
      expect(r.pushbackDelta).toBe(1);
    });

    it("does not count pushback when the candidate also accepts", () => {
      const r = buildThinkingPhrase({ ...negInput, lastAnswerText: "Not enough, but I accept the deal." });
      expect(r.pushbackDelta).toBe(0);
    });

    it("never falls through to dontKnow redirect inside salary-negotiation", () => {
      const r = buildThinkingPhrase({ ...negInput, lastAnswerText: "I don't know what to ask for." });
      expect(r.dontKnowDelta).toBe(0); // negotiation has its own dontKnow handling
      expect(typeof r.phrase).toBe("string");
    });

    it("uses heavy-pushback voice once 3+ pushbacks have accumulated", () => {
      const r = buildThinkingPhrase({ ...negInput, pushbackCount: 3, lastAnswerQuality: "strong", lastAnswerText: "Still too low." });
      expect(typeof r.phrase).toBe("string");
      // Heavy-pushback bank includes "let me think about this seriously" / "let me be straight with you"
      // Just confirm a phrase came back; specific content varies.
    });
  });
});

describe("shouldStaySilent", () => {
  const base = {
    currentStep: 3,
    stepType: "question" as const,
    interviewType: "behavioral",
    lastAnswerQuality: "decent" as const,
    lastAnswerText: "We shipped the migration.",
  };

  it("never stays silent on the very first step", () => {
    // 50 trials — currentStep=0 should always return false even though
    // randomness is involved.
    for (let i = 0; i < 50; i++) {
      expect(shouldStaySilent({ ...base, currentStep: 0 })).toBe(false);
    }
  });

  it("never stays silent inside salary-negotiation (silence reads as pressure)", () => {
    for (let i = 0; i < 50; i++) {
      expect(shouldStaySilent({ ...base, interviewType: "salary-negotiation" })).toBe(false);
    }
  });

  it("never stays silent on a strong answer", () => {
    for (let i = 0; i < 50; i++) {
      expect(shouldStaySilent({ ...base, lastAnswerQuality: "strong" })).toBe(false);
    }
  });

  it("never stays silent on a weak answer (silence on weak feels punitive)", () => {
    for (let i = 0; i < 50; i++) {
      expect(shouldStaySilent({ ...base, lastAnswerQuality: "weak" })).toBe(false);
    }
  });

  it("never stays silent if the answer already had a metric", () => {
    for (let i = 0; i < 50; i++) {
      expect(shouldStaySilent({ ...base, lastAnswerText: "We grew revenue 40% in 6 months." })).toBe(false);
    }
  });
});

describe("buildThinkingPhrase — skip override", () => {
  it("uses a soft skip-acknowledgement when the previous turn was skipped", () => {
    const r = buildThinkingPhrase({ ...baseInput, lastAnswerQuality: "weak", lastTurnWasSkip: true });
    expect(typeof r.phrase).toBe("string");
    // Skip ack bank should land — none of these contain a question mark or a STAR-style probe.
    expect(r.phrase!.length).toBeGreaterThan(0);
    expect(r.phrase).not.toMatch(/\?$/);
  });

  it("skip override pre-empts the standard reaction even on a strong-quality slot", () => {
    /* Quality flag is incidental on a skip — there's no answer to react to.
       Asserting the override fires regardless of quality. */
    const r = buildThinkingPhrase({ ...baseInput, lastAnswerQuality: "strong", lastTurnWasSkip: true });
    expect(typeof r.phrase).toBe("string");
    expect(r.dontKnowDelta).toBe(0);
    expect(r.pushbackDelta).toBe(0);
  });

  it("does not fire skip override on intro / step 0", () => {
    const r = buildThinkingPhrase({ ...baseInput, currentStep: 0, lastTurnWasSkip: true });
    expect(r.phrase).toBeNull();
  });
});
