import { describe, it, expect } from "vitest";
import { normalizeDashes } from "../../server-handlers/_text-normalize";

/* TEXT-NORM-1 (2026-06-25) — recruiter-voice dash normalizer. Em/en dashes
 * read as AI-generated to an Indian-HR audience; they must become commas in
 * clause position and hyphens in number ranges. */

describe("normalizeDashes", () => {
  it("converts a spaced em dash clause separator to a comma", () => {
    expect(normalizeDashes("Let's get straight into it — what's your current CTC?")).toBe(
      "Let's get straight into it, what's your current CTC?",
    );
  });

  it("converts a tight em dash between words to a comma", () => {
    expect(normalizeDashes("On the equity side—I can add an ESOP grant")).toBe(
      "On the equity side, I can add an ESOP grant",
    );
  });

  it("keeps a number range as a hyphen, not a comma", () => {
    expect(normalizeDashes("I can structure 53–58 LPA for this grade")).toBe(
      "I can structure 53-58 LPA for this grade",
    );
  });

  it("keeps a rupee/decimal range as a hyphen", () => {
    expect(normalizeDashes("The band is ₹53.2—55L fixed")).toBe("The band is ₹53.2-55L fixed");
  });

  it("handles a mix of range and clause-separator dashes in one line", () => {
    expect(
      normalizeDashes("Fitment sits at ₹53.2L — the band runs 50–58 LPA for this level"),
    ).toBe("Fitment sits at ₹53.2L, the band runs 50-58 LPA for this level");
  });

  it("normalizes en dashes used as separators too", () => {
    expect(normalizeDashes("Two safe sentences – we'll be in touch")).toBe(
      "Two safe sentences, we'll be in touch",
    );
  });

  it("does not touch ordinary hyphens", () => {
    expect(normalizeDashes("a well-structured full-time role")).toBe(
      "a well-structured full-time role",
    );
  });

  it("collapses the doubled-comma / stray-space fallout cleanly", () => {
    expect(normalizeDashes("scope, — and the timeline")).toBe("scope, and the timeline");
  });

  it("passes empty and nullish input straight through", () => {
    expect(normalizeDashes("")).toBe("");
    expect(normalizeDashes(null)).toBe("");
    expect(normalizeDashes(undefined)).toBe("");
  });

  it("leaves dash-free text unchanged", () => {
    const s = "Thanks for the conversation today. We'll be in touch with next steps.";
    expect(normalizeDashes(s)).toBe(s);
  });
});
