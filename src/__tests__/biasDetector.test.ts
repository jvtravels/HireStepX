import { describe, it, expect } from "vitest";
import { detectBias, countBias } from "../biasDetector";

describe("detectBias — uptalk", () => {
  it("flags a declarative statement ending with ?", () => {
    const hits = detectBias("I am very excited about this role?");
    expect(hits.some((h) => h.kind === "uptalk")).toBe(true);
  });

  it("flags we-sentence at start ending with ?", () => {
    const hits = detectBias("We would love to accept the offer?");
    expect(hits.some((h) => h.kind === "uptalk")).toBe(true);
  });

  it("flags uptalk after a sentence boundary", () => {
    // "We would..." begins after ". " — a genuine uptalk in the 2nd sentence
    const hits = detectBias("The package sounds great. We would prefer not to go higher?");
    expect(hits.some((h) => h.kind === "uptalk")).toBe(true);
  });

  it("does NOT flag 'we' embedded inside a genuine interrogative", () => {
    // S66-B1: false positive — "we" appears mid-sentence after "so"
    const hits = detectBias(
      "Could you share the actual offer number so we have something concrete to work with?"
    );
    expect(hits.some((h) => h.kind === "uptalk")).toBe(false);
  });

  it("does NOT flag 'I' inside a subordinate clause of a question", () => {
    const hits = detectBias(
      "Would it be possible to know if I could get this in writing?"
    );
    expect(hits.some((h) => h.kind === "uptalk")).toBe(false);
  });

  it("does NOT flag short declaratives (< 15 chars after pronoun)", () => {
    // Clause too short — "I agree?" is ambiguous, not flagged
    const hits = detectBias("I agree?");
    expect(hits.some((h) => h.kind === "uptalk")).toBe(false);
  });
});

describe("detectBias — overHedging", () => {
  it("flags 'kind of think'", () => {
    const hits = detectBias("I kind of think that's fair.");
    expect(hits.some((h) => h.kind === "overHedging")).toBe(true);
  });

  it("non-native mode suppresses single hedge", () => {
    const hits = detectBias("I kind of think that's fair.", { nonNativeEnglish: true });
    expect(hits.some((h) => h.kind === "overHedging")).toBe(false);
  });

  it("non-native mode keeps ≥3 hedges", () => {
    const text =
      "I kind of think we should accept. I sort of feel it's reasonable. I kinda believe they'll flex.";
    const hits = detectBias(text, { nonNativeEnglish: true });
    expect(hits.filter((h) => h.kind === "overHedging").length).toBeGreaterThanOrEqual(3);
  });
});

describe("detectBias — disabled", () => {
  it("returns empty when disabled", () => {
    const hits = detectBias("I am very excited about this role?", { disabled: true });
    expect(hits).toHaveLength(0);
  });
});

describe("countBias", () => {
  it("aggregates hits across answers", () => {
    const answers = [
      "I am so excited about this offer?",
      "We would love to join the team?",
    ];
    const counts = countBias(answers);
    expect(counts.uptalk).toBe(2);
  });
});
