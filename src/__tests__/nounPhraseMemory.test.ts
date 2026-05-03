import { describe, it, expect } from "vitest";
import { extractNounPhrases, appendToMemory } from "../_noun-phrase-memory";

describe("extractNounPhrases", () => {
  it("returns empty array for empty input", () => {
    expect(extractNounPhrases("")).toEqual([]);
  });

  it("extracts multi-word proper-noun phrases", () => {
    const r = extractNounPhrases("I led the Razorpay migration last year.");
    // Either the bare phrase or a slightly longer one are both acceptable
    expect(r.some(p => p.toLowerCase().startsWith("razorpay migration"))).toBe(true);
  });

  it("ignores generic sentence-starters", () => {
    const r = extractNounPhrases("I led a project. We shipped on time.");
    // Should not include "I led" or "We shipped"
    expect(r.every(p => !p.startsWith("I ") && !p.startsWith("We "))).toBe(true);
  });

  it("picks up hyphenated tech terms", () => {
    const r = extractNounPhrases("we built a rate-limiter for the api gateway.");
    expect(r).toContain("rate-limiter");
  });

  it("picks up team-of-N phrases", () => {
    const r = extractNounPhrases("I managed a team of six engineers.");
    expect(r.some(p => p.toLowerCase().includes("six"))).toBe(true);
  });

  it("picks up Nx growth phrases", () => {
    const r = extractNounPhrases("we hit 10x growth in Q3.");
    expect(r.some(p => /10x/i.test(p))).toBe(true);
  });

  it("picks up rupee amounts in LPA", () => {
    const r = extractNounPhrases("the offer was ₹25 LPA.");
    expect(r.some(p => /₹/.test(p))).toBe(true);
  });

  it("caps results at maxPerTurn", () => {
    const text = "Razorpay Migration. Flipkart Project. Google Engineer. Apple Initiative. Microsoft Launch. Amazon System. Netflix Stack.";
    const r = extractNounPhrases(text, { maxPerTurn: 3 });
    expect(r.length).toBeLessThanOrEqual(3);
  });

  it("preserves insertion order", () => {
    const r = extractNounPhrases("First the Razorpay migration, then the Flipkart project.");
    const razorIdx = r.findIndex(p => p.toLowerCase().includes("razorpay"));
    const flipkartIdx = r.findIndex(p => p.toLowerCase().includes("flipkart"));
    if (razorIdx !== -1 && flipkartIdx !== -1) {
      expect(razorIdx).toBeLessThan(flipkartIdx);
    }
  });
});

describe("appendToMemory", () => {
  it("dedupes by case-insensitive lookup", () => {
    const r = appendToMemory(["Razorpay Migration"], ["razorpay migration", "Q4 launch"]);
    expect(r.filter(p => p.toLowerCase() === "razorpay migration").length).toBe(1);
    expect(r).toContain("Q4 launch");
  });

  it("respects maxBuffer by dropping oldest", () => {
    const existing = ["a", "b", "c", "d", "e"];
    const r = appendToMemory(existing, ["f", "g"], 5);
    expect(r.length).toBe(5);
    expect(r).not.toContain("a");
    expect(r).not.toContain("b");
    expect(r).toContain("f");
    expect(r).toContain("g");
  });

  it("preserves insertion order across appends", () => {
    const r = appendToMemory(["first"], ["second", "third"]);
    expect(r).toEqual(["first", "second", "third"]);
  });

  it("returns existing unchanged when no new phrases", () => {
    const existing = ["a", "b"];
    const r = appendToMemory(existing, []);
    expect(r).toEqual(existing);
  });
});
