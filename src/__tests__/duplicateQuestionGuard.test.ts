import { describe, it, expect } from "vitest";
import { isDuplicateQuestionText } from "../_duplicate-question-guard";

describe("isDuplicateQuestionText", () => {
  const intro = { type: "intro", aiText: "Welcome! Let's get started." };
  const q1 = { type: "question", aiText: "Tell me about a time you faced a tight deadline." };
  const fu1 = { type: "follow-up", aiText: "What would you do differently next time?" };
  const closing = { type: "closing", aiText: "Thanks for your time today." };

  it("flags an exact repeat of an earlier question", () => {
    const script = [intro, q1, fu1];
    expect(
      isDuplicateQuestionText("Tell me about a time you faced a tight deadline.", script, 3),
    ).toBe(true);
  });

  it("flags a repeat that only differs in case, punctuation, and whitespace", () => {
    const script = [intro, q1, fu1];
    expect(
      isDuplicateQuestionText("tell me about a time you faced a tight deadline", script, 3),
    ).toBe(true);
    expect(
      isDuplicateQuestionText("  TELL me about a time you faced a tight DEADLINE!!  ", script, 3),
    ).toBe(true);
  });

  it("does not flag a genuinely different follow-up", () => {
    const script = [intro, q1, fu1];
    expect(
      isDuplicateQuestionText("How did your manager react to that?", script, 3),
    ).toBe(false);
  });

  it("ignores intro and closing steps — same wording there is not a repeated question", () => {
    const script = [intro, q1, closing];
    expect(isDuplicateQuestionText("Welcome! Let's get started.", script, 3)).toBe(false);
    expect(isDuplicateQuestionText("Thanks for your time today.", script, 3)).toBe(false);
  });

  it("only compares against steps strictly before uptoIndex", () => {
    // q1 sits AFTER uptoIndex here, so it must not count as a prior repeat.
    const script = [intro, fu1, q1];
    expect(
      isDuplicateQuestionText("Tell me about a time you faced a tight deadline.", script, 1),
    ).toBe(false);
  });

  it("returns false for an empty or whitespace-only candidate", () => {
    const script = [intro, q1];
    expect(isDuplicateQuestionText("", script, 2)).toBe(false);
    expect(isDuplicateQuestionText("   ", script, 2)).toBe(false);
  });

  it("returns false against an empty script", () => {
    expect(isDuplicateQuestionText("Any question at all?", [], 0)).toBe(false);
  });
});
