import { describe, it, expect } from "vitest";
import {
  extractQuestionsArray,
  validateQuestionShape,
  normalizePanelPersonas,
  isSalaryNegotiationLengthOk,
  computeStepCount,
  buildStaticFallback,
  VALID_PERSONAS,
  type RawQuestion,
} from "../../server-handlers/_generate-questions-helpers";

/**
 * generate-questions is the LLM contract for the interview UI. A shape
 * change in the response — wrong wrapper key, missing aiText, mis-cased
 * persona — silently ships a blank-bubble interview to the candidate.
 * These helpers handle that contract so we can lock the behaviour with
 * tests rather than waiting for a regression in production.
 */

describe("extractQuestionsArray", () => {
  it("returns a bare array unchanged", () => {
    const arr = [{ type: "intro", aiText: "hi" }];
    expect(extractQuestionsArray(arr)).toBe(arr);
  });

  it("unwraps the canonical {questions: [...]} shape", () => {
    const arr = [{ type: "question", aiText: "Q1" }];
    expect(extractQuestionsArray({ questions: arr })).toBe(arr);
  });

  it("unwraps {steps: [...]} (Groq sometimes returns this)", () => {
    const arr = [{ type: "intro", aiText: "hi" }];
    expect(extractQuestionsArray({ steps: arr })).toBe(arr);
  });

  it("unwraps {interview_steps: [...]} (Gemini fallback shape)", () => {
    const arr = [{ type: "closing", aiText: "bye" }];
    expect(extractQuestionsArray({ interview_steps: arr })).toBe(arr);
  });

  it("falls back to first array-valued property when no canonical key matches", () => {
    const arr = [{ type: "question", aiText: "x" }];
    expect(extractQuestionsArray({ irrelevantField: "no", randomKey: arr })).toBe(arr);
  });

  it("returns null for null/string/number inputs", () => {
    expect(extractQuestionsArray(null)).toBeNull();
    expect(extractQuestionsArray("string")).toBeNull();
    expect(extractQuestionsArray(42)).toBeNull();
  });

  it("returns null when no array is found anywhere", () => {
    expect(extractQuestionsArray({ foo: "bar", n: 1 })).toBeNull();
  });
});

describe("validateQuestionShape", () => {
  it("rejects empty arrays — empty interviews are a hard failure", () => {
    expect(validateQuestionShape([])).toBe(false);
  });

  it("rejects steps missing aiText (would render as blank avatar bubble)", () => {
    expect(validateQuestionShape([{ type: "question" }])).toBe(false);
    expect(validateQuestionShape([{ type: "question", aiText: "" }])).toBe(false);
  });

  it("rejects steps missing type", () => {
    expect(validateQuestionShape([{ aiText: "hello" }])).toBe(false);
  });

  it("rejects steps where aiText is not a string", () => {
    expect(validateQuestionShape([{ type: "intro", aiText: 42 }])).toBe(false);
    expect(validateQuestionShape([{ type: "intro", aiText: null }])).toBe(false);
  });

  it("accepts a minimal valid sequence", () => {
    expect(
      validateQuestionShape([
        { type: "intro", aiText: "Welcome" },
        { type: "question", aiText: "Q1" },
        { type: "closing", aiText: "Thanks" },
      ]),
    ).toBe(true);
  });

  it("rejects when ANY single step is malformed", () => {
    expect(
      validateQuestionShape([
        { type: "intro", aiText: "Welcome" },
        { type: "question" }, // missing aiText
        { type: "closing", aiText: "Thanks" },
      ]),
    ).toBe(false);
  });
});

describe("normalizePanelPersonas", () => {
  it("preserves a valid persona regardless of casing", () => {
    const qs: RawQuestion[] = [{ type: "question", aiText: "x", persona: "hiring manager" }];
    normalizePanelPersonas(qs);
    expect(qs[0].persona).toBe("Hiring Manager");
  });

  it("forces intro and closing to Hiring Manager", () => {
    const qs: RawQuestion[] = [
      { type: "intro", aiText: "hi", persona: "HR Partner" },
      { type: "closing", aiText: "bye" },
    ];
    normalizePanelPersonas(qs);
    expect(qs[0].persona).toBe("HR Partner"); // valid persona preserved
    expect(qs[1].persona).toBe("Hiring Manager"); // missing → forced to HM
  });

  it("round-robins across the three personas for question steps", () => {
    const qs: RawQuestion[] = [
      { type: "question", aiText: "q1" },
      { type: "question", aiText: "q2" },
      { type: "question", aiText: "q3" },
    ];
    normalizePanelPersonas(qs);
    expect(qs.map((q) => q.persona)).toEqual([
      "Hiring Manager",
      "Technical Lead",
      "HR Partner",
    ]);
  });

  it("replaces a hallucinated persona with round-robin assignment", () => {
    const qs: RawQuestion[] = [{ type: "question", aiText: "q", persona: "CEO" }];
    normalizePanelPersonas(qs);
    expect(VALID_PERSONAS).toContain(qs[0].persona as "Hiring Manager");
  });

  it("skips rotation index when a question already has a valid persona", () => {
    const qs: RawQuestion[] = [
      { type: "question", aiText: "q1", persona: "HR Partner" },
      { type: "question", aiText: "q2" }, // gets first rotation slot
    ];
    normalizePanelPersonas(qs);
    expect(qs[0].persona).toBe("HR Partner");
    expect(qs[1].persona).toBe("Hiring Manager"); // rotIdx=0
  });
});

describe("isSalaryNegotiationLengthOk", () => {
  it("requires at least 4 turns for salary negotiation arc", () => {
    expect(isSalaryNegotiationLengthOk(true, 3)).toBe(false);
    expect(isSalaryNegotiationLengthOk(true, 4)).toBe(true);
    expect(isSalaryNegotiationLengthOk(true, 7)).toBe(true);
  });

  it("does not gate non-salary interviews on length", () => {
    expect(isSalaryNegotiationLengthOk(false, 1)).toBe(true);
    expect(isSalaryNegotiationLengthOk(false, 0)).toBe(true);
  });
});

describe("computeStepCount", () => {
  it("regular session = 5 questions + intro/closing = 7", () => {
    expect(computeStepCount({ mini: false, isSalaryType: false })).toBe(7);
  });

  it("mini behavioral = 3 questions + intro/closing = 5", () => {
    expect(computeStepCount({ mini: true, isSalaryType: false })).toBe(5);
  });

  it("mini salary-negotiation still gets full 5-question arc = 7 steps", () => {
    expect(computeStepCount({ mini: true, isSalaryType: true })).toBe(7);
  });
});

/* buildStaticFallback is what users get when both LLM providers fail. The
 * shape contract is the same as the LLM path (validateQuestionShape passes)
 * and the count is at least intro + main questions + closing. */
describe("buildStaticFallback", () => {
  it("returns a shape-valid set with intro + closing", () => {
    const qs = buildStaticFallback({
      type: "behavioral",
      focus: "behavioral",
      difficulty: "standard",
      roleFamily: "pm",
      count: 5,
    });
    expect(qs.length).toBeGreaterThanOrEqual(7);
    expect(qs[0].type).toBe("intro");
    expect(qs[qs.length - 1].type).toBe("closing");
    expect(validateQuestionShape(qs as unknown[])).toBe(true);
  });

  it("falls through to behavioral when role+focus has no entries", () => {
    const qs = buildStaticFallback({
      type: "behavioral",
      focus: "case-study",
      difficulty: "standard",
      // Intentionally bogus role family to force tier-3 fallback.
      roleFamily: "nonexistent-role" as unknown as string,
      count: 5,
    });
    expect(qs.length).toBeGreaterThanOrEqual(7);
    expect(validateQuestionShape(qs as unknown[])).toBe(true);
  });

  it("never returns blank aiText", () => {
    const qs = buildStaticFallback({
      type: "behavioral",
      focus: "general",
      difficulty: "standard",
      roleFamily: "general",
      count: 5,
    });
    for (const q of qs) {
      expect(q.aiText.length).toBeGreaterThan(0);
    }
  });
});
