import { describe, it, expect } from "vitest";
import { clipHeadline } from "../skillCopy";

describe("clipHeadline", () => {
  it("keeps a short headline intact", () => {
    expect(clipHeadline("Add numbers to your results")).toBe("Add numbers to your results");
  });
  it("stops at the first sentence", () => {
    expect(clipHeadline("Quantify results. Then rehearse the story aloud twice.")).toBe("Quantify results");
  });
  it("cuts a long line at a word boundary without a dangling connective", () => {
    const out = clipHeadline("Walk through the situation, task, action and result of each project you describe in the interview");
    expect(out.length).toBeLessThanOrEqual(55);
    expect(out).not.toMatch(/\b(and|the|of|to|in|on|a)$/i);
  });
});
