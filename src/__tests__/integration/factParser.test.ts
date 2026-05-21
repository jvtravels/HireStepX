/* Unit tests for the typed salary fact parser.
 *
 * Audit follow-up (2026-05-21). Pins the contract the pipeline now
 * depends on (`extractNumbers` delegates here). Range-awareness is
 * the headline behaviour — the legacy regex stack silently flattened
 * "₹22-24 LPA" into [22, 24] with no signal that they were the
 * bounds of a range; the typed parser preserves that structure. */
import { describe, it, expect } from "vitest";
import {
  parseSalaryFacts,
  extractSalaryScalars,
  hasSalaryAbove,
  maxSalaryLpa,
} from "../../../server-handlers/_fact-parser";

describe("_fact-parser — parseSalaryFacts", () => {
  it("extracts a single LPA number", () => {
    const f = parseSalaryFacts("Looking at ₹22 LPA total.");
    expect(f).toHaveLength(1);
    expect(f[0].value).toBe(22);
    expect(f[0].unit).toBe("LPA");
    expect(f[0].confidence).toBe("high");
    expect(f[0].isRangeLower).toBe(false);
    expect(f[0].isRangeUpper).toBe(false);
  });

  it("normalises crore to LPA (×100)", () => {
    const f = parseSalaryFacts("Our band tops out at 1.2 crore.");
    expect(f).toHaveLength(1);
    expect(f[0].value).toBe(120);
    expect(f[0].unit).toBe("crore");
  });

  it("treats bare L as lakh", () => {
    const f = parseSalaryFacts("currently at 18L");
    expect(f).toHaveLength(1);
    expect(f[0].value).toBe(18);
    expect(f[0].unit).toBe("lakh");
  });

  it("handles lakhs/lacs/lac spellings", () => {
    expect(parseSalaryFacts("22 lakhs")[0].value).toBe(22);
    expect(parseSalaryFacts("22 lac")[0].value).toBe(22);
    expect(parseSalaryFacts("22 lacs")[0].value).toBe(22);
  });

  it("range '22-24 LPA' produces two facts with isRangeLower/Upper flags", () => {
    const f = parseSalaryFacts("expecting ₹22-24 LPA total");
    expect(f).toHaveLength(2);
    expect(f[0].value).toBe(22);
    expect(f[0].isRangeLower).toBe(true);
    expect(f[0].rangePeer).toBe(24);
    expect(f[1].value).toBe(24);
    expect(f[1].isRangeUpper).toBe(true);
    expect(f[1].rangePeer).toBe(22);
  });

  it("range 'N to M LPA' (word 'to') matches", () => {
    const f = parseSalaryFacts("30 to 35 LPA range");
    expect(f).toHaveLength(2);
    expect(f[0].value).toBe(30);
    expect(f[1].value).toBe(35);
    expect(f[0].isRangeLower).toBe(true);
  });

  it("range does NOT double-count with the unit pass", () => {
    /* Without the consumed-span dedup, a 22-24 LPA range would also
     * be picked up by UNIT_NUM_RE matching the trailing "24 LPA". */
    const f = parseSalaryFacts("₹22-24 LPA range");
    expect(f).toHaveLength(2);
  });

  it("strips thousand separators in ₹-prefixed bare numbers", () => {
    /* Edge case: "₹22,00,000" — Indian comma style. We still treat as
     * LPA-scale (matches legacy RUPEE_NUM_RE behaviour). */
    const f = parseSalaryFacts("₹22,00,000");
    expect(f).toHaveLength(1);
    expect(f[0].rawDigits).toBe("2200000");
  });

  it("₹-prefixed without unit token gets medium confidence", () => {
    const f = parseSalaryFacts("₹25 base");
    expect(f).toHaveLength(1);
    expect(f[0].value).toBe(25);
    expect(f[0].confidence).toBe("medium");
  });

  it("returns facts in source-offset order", () => {
    const f = parseSalaryFacts("base 18 LPA, variable 4 LPA, total ₹22 LPA");
    expect(f.map((x) => x.value)).toEqual([18, 4, 22]);
  });

  it("empty / whitespace input returns []", () => {
    expect(parseSalaryFacts("")).toEqual([]);
    expect(parseSalaryFacts("   ")).toEqual([]);
  });

  it("no salary-bearing tokens returns []", () => {
    expect(parseSalaryFacts("we're hybrid, three days in office")).toEqual([]);
  });
});

describe("_fact-parser — extractSalaryScalars (legacy contract)", () => {
  it("returns raw digit strings preserving extractNumbers's prior API", () => {
    expect(extractSalaryScalars("₹22 LPA")).toEqual(["22"]);
    expect(extractSalaryScalars("22 LPA and ₹35,000")).toEqual(["22", "35000"]);
  });

  it("range produces both bounds", () => {
    expect(extractSalaryScalars("22-24 LPA")).toEqual(["22", "24"]);
  });
});

describe("_fact-parser — hasSalaryAbove / maxSalaryLpa", () => {
  it("hasSalaryAbove detects band overshoot", () => {
    expect(hasSalaryAbove("we can stretch to ₹95 LPA", 50)).toBe(true);
    expect(hasSalaryAbove("we can stretch to ₹22 LPA", 50)).toBe(false);
  });

  it("hasSalaryAbove respects range upper bound", () => {
    expect(hasSalaryAbove("range is 20-60 LPA", 50)).toBe(true);
  });

  it("hasSalaryAbove with crore normalisation", () => {
    /* 1.2 crore = 120 LPA. */
    expect(hasSalaryAbove("our band tops at 1.2 crore", 100)).toBe(true);
    expect(hasSalaryAbove("our band tops at 0.5 crore", 60)).toBe(false);
  });

  it("maxSalaryLpa returns null on no facts", () => {
    expect(maxSalaryLpa("we're hybrid")).toBe(null);
  });

  it("maxSalaryLpa returns the largest LPA-normalised value", () => {
    expect(maxSalaryLpa("base 18 LPA, total 28 LPA, equity 0.2 crore")).toBe(28);
    expect(maxSalaryLpa("base 18 LPA, total 28 LPA, equity 0.5 crore")).toBe(50);
  });
});
