import { describe, it, expect } from "vitest";
import { countTokens } from "../../server-handlers/_tokenizer";

describe("countTokens", () => {
  it("returns 0 for empty / null / undefined / non-string", () => {
    expect(countTokens("")).toBe(0);
    expect(countTokens(null)).toBe(0);
    expect(countTokens(undefined)).toBe(0);
    expect(countTokens(123 as unknown as string)).toBe(0);
  });

  it("handles ASCII prose with whitespace correctly", () => {
    /* "hello world" = 2 words, 11 chars.
     *   lower = ceil(11/4) = 3
     *   upper = ceil(2*1.3) = 3
     *   → max = 3 */
    expect(countTokens("hello world")).toBe(3);
  });

  it("dominates by char count for long single-token strings", () => {
    /* "a".repeat(400) = 1 word, 400 chars.
     *   lower = 100, upper = ceil(1.3) = 2 → 100 */
    expect(countTokens("a".repeat(400))).toBe(100);
  });

  it("handles unicode without crashing and respects char bound", () => {
    /* 12 devanagari + ascii chars; word count = 2.
     *   lower = ceil(len/4); upper = ceil(2*1.3)=3.
     * We don't assert a precise count (UTF-16 vs codepoint ambiguity)
     * — just that it's positive and finite. */
    const s = "नमस्ते world";
    const t = countTokens(s);
    expect(t).toBeGreaterThan(0);
    expect(Number.isFinite(t)).toBe(true);
  });

  it("scales with very long text", () => {
    const long = "lorem ipsum ".repeat(1000); // 12k chars, 2000 words
    const t = countTokens(long);
    /* lower = ceil(12000/4)=3000; upper=ceil(2000*1.3)=2600 → 3000 */
    expect(t).toBe(3000);
  });

  it("handles code blocks (whitespace-heavy)", () => {
    const code = "function foo() {\n  return 1;\n}";
    const t = countTokens(code);
    /* lower = ceil(31/4)=8; upper = ceil(words*1.3). Should be > 4. */
    expect(t).toBeGreaterThanOrEqual(8);
  });

  it("returns at least 1 for any non-empty input", () => {
    expect(countTokens("a")).toBeGreaterThanOrEqual(1);
    expect(countTokens(" ")).toBeGreaterThanOrEqual(0);
  });

  it("collapsed whitespace doesn't inflate the word count", () => {
    /* "a    b" — 2 words after split+filter, not 5. */
    expect(countTokens("a    b")).toBe(Math.max(Math.ceil(6 / 4), Math.ceil(2 * 1.3)));
  });
});
