import { describe, it, expect } from "vitest";
import {
  HR_QUESTIONS,
  HR_DIMENSIONS,
  sampleHrQuestions,
} from "../../data/hr-round-question-bank";

describe("HR_QUESTIONS — shape & coverage", () => {
  it("has a healthy number of curated entries", () => {
    expect(HR_QUESTIONS.length).toBeGreaterThanOrEqual(20);
  });

  it("every entry has non-empty text, a valid dimension, and a sane frequency", () => {
    for (const q of HR_QUESTIONS) {
      expect(q.text.length).toBeGreaterThan(0);
      expect(HR_DIMENSIONS).toContain(q.dimension);
      expect(q.frequencyPct).toBeGreaterThanOrEqual(0);
      expect(q.frequencyPct).toBeLessThanOrEqual(100);
    }
  });

  it("has unique ids", () => {
    const ids = HR_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every declared HR dimension at least once", () => {
    const covered = new Set(HR_QUESTIONS.map((q) => q.dimension));
    for (const d of HR_DIMENSIONS) {
      expect(covered.has(d)).toBe(true);
    }
  });

  it("is NOT behavioural STAR prep — no 'tell me about a time' openers dominate", () => {
    const star = HR_QUESTIONS.filter((q) => /^tell me about a time/i.test(q.text));
    // A couple of scenario probes are fine; the bank must not be STAR-shaped.
    expect(star.length).toBeLessThanOrEqual(3);
  });
});

describe("sampleHrQuestions", () => {
  it("returns the requested count when the bank is large enough", () => {
    expect(sampleHrQuestions({ count: 5, seed: 1 })).toHaveLength(5);
  });

  it("is deterministic for a given (count, seed)", () => {
    const a = sampleHrQuestions({ count: 6, seed: 42 });
    const b = sampleHrQuestions({ count: 6, seed: 42 });
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
  });

  it("varies with the seed", () => {
    const a = sampleHrQuestions({ count: 6, seed: 1 });
    const b = sampleHrQuestions({ count: 6, seed: 999 });
    expect(a.map((q) => q.id)).not.toEqual(b.map((q) => q.id));
  });

  it("spreads across distinct dimensions before repeating one", () => {
    const picked = sampleHrQuestions({ count: HR_DIMENSIONS.length, seed: 7 });
    const dims = new Set(picked.map((q) => q.dimension));
    // First-pass dedupe means up to N dimensions appear before any repeats.
    expect(dims.size).toBe(Math.min(HR_DIMENSIONS.length, picked.length));
  });

  it("returns no duplicates within a single sample", () => {
    const picked = sampleHrQuestions({ count: HR_QUESTIONS.length, seed: 3 });
    expect(new Set(picked.map((q) => q.id)).size).toBe(picked.length);
  });

  it("handles count 0 and over-large counts gracefully", () => {
    expect(sampleHrQuestions({ count: 0, seed: 1 })).toEqual([]);
    expect(sampleHrQuestions({ count: 9999, seed: 1 })).toHaveLength(HR_QUESTIONS.length);
  });

  it("weightByFrequency front-loads the most common questions", () => {
    const picked = sampleHrQuestions({ count: 3, seed: 5, weightByFrequency: true });
    // The single most-asked question in the bank should appear in a small
    // weighted draw.
    const topFreq = Math.max(...HR_QUESTIONS.map((q) => q.frequencyPct));
    expect(picked.some((q) => q.frequencyPct === topFreq)).toBe(true);
  });
});
