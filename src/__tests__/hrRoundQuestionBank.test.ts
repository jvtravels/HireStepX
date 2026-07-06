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
    // Body pool excludes the opener by default.
    const bodySize = HR_QUESTIONS.filter((q) => !q.opener).length;
    expect(sampleHrQuestions({ count: 9999, seed: 1 })).toHaveLength(bodySize);
    expect(sampleHrQuestions({ count: 9999, seed: 1, includeOpener: true })).toHaveLength(
      HR_QUESTIONS.length,
    );
  });

  it("excludes the opener from the body by default so background isn't asked twice", () => {
    const opener = HR_QUESTIONS.find((q) => q.opener);
    expect(opener).toBeDefined();
    const body = sampleHrQuestions({ count: HR_QUESTIONS.length, seed: 11, weightByFrequency: true });
    expect(body.some((q) => q.id === opener!.id)).toBe(false);
    // ...but it's available when explicitly requested.
    const withOpener = sampleHrQuestions({ count: HR_QUESTIONS.length, seed: 11, includeOpener: true });
    expect(withOpener.some((q) => q.id === opener!.id)).toBe(true);
  });

  it("covers BGV / compliance readiness — a 13% rubric dimension (audit gap)", () => {
    // Compliance readiness is the 2nd-heaviest scoring dimension in the
    // HR-round recipe, yet the static fallback bank had zero questions
    // probing it — so an LLM-down session could not score it. Guard that.
    const compliance = HR_QUESTIONS.filter((q) => q.dimension === "compliance");
    expect(compliance.length).toBeGreaterThanOrEqual(1);
    expect(
      compliance.some((q) =>
        /bgv|background|payslip|form\s*16|relieving|document|verification|dual|overlap|moonlight/i.test(
          q.text,
        ),
      ),
    ).toBe(true);
  });

  it("a default HR fallback draw surfaces compliance for a typical session", () => {
    // count=7 is the live hr-round fallback size; weighted draw should
    // reliably include the high-frequency compliance probe.
    const picked = sampleHrQuestions({ count: 7, seed: 7, weightByFrequency: true });
    expect(picked.some((q) => q.dimension === "compliance")).toBe(true);
  });

  it("weightByFrequency front-loads the most common BODY question", () => {
    const picked = sampleHrQuestions({ count: 3, seed: 5, weightByFrequency: true });
    // The most-asked question among the body pool (opener excluded) should
    // appear in a small weighted draw.
    const topBodyFreq = Math.max(
      ...HR_QUESTIONS.filter((q) => !q.opener).map((q) => q.frequencyPct),
    );
    expect(picked.some((q) => q.frequencyPct === topBodyFreq)).toBe(true);
  });

  it("prioritiseDimensions surfaces the rubric-heavy dimensions first (audit gap)", () => {
    // The sampler used to be blind to the resolved rubric — a short draw
    // could omit the dimensions the candidate's round actually grades
    // hardest. Prioritised dimensions must land in a small draw.
    const picked = sampleHrQuestions({
      count: 3,
      seed: 5,
      weightByFrequency: true,
      prioritiseDimensions: ["compliance", "compensation"],
    });
    const dims = new Set(picked.map((q) => q.dimension));
    expect(dims.has("compliance")).toBe(true);
    expect(dims.has("compensation")).toBe(true);
  });

  it("prioritisation is a soft boost, not a filter — still fills the rest", () => {
    const picked = sampleHrQuestions({
      count: 6,
      seed: 9,
      prioritiseDimensions: ["compliance"],
    });
    // Prioritised dimension present...
    expect(picked.some((q) => q.dimension === "compliance")).toBe(true);
    // ...but the draw is NOT collapsed to only that dimension.
    expect(new Set(picked.map((q) => q.dimension)).size).toBeGreaterThan(1);
  });

  it("stays deterministic and dupe-free with prioritiseDimensions set", () => {
    const opts = { count: 6, seed: 42, prioritiseDimensions: ["compensation"] as const };
    const a = sampleHrQuestions(opts);
    const b = sampleHrQuestions(opts);
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(new Set(a.map((q) => q.id)).size).toBe(a.length);
  });

  it("empty prioritiseDimensions is a no-op (identical to omitting it)", () => {
    const withEmpty = sampleHrQuestions({ count: 6, seed: 21, prioritiseDimensions: [] });
    const without = sampleHrQuestions({ count: 6, seed: 21 });
    expect(withEmpty.map((q) => q.id)).toEqual(without.map((q) => q.id));
  });
});
