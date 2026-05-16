import { describe, it, expect } from "vitest";
import {
  extractComponentBreakdown,
  mergeBreakdown,
  summarizeBreakdown,
} from "../../server-handlers/_component-breakdown";

describe("extractComponentBreakdown — base", () => {
  it("extracts 'base 28'", () => {
    const b = extractComponentBreakdown("I want base 28");
    expect(b.base).toBe(28);
    expect(b.hasAny).toBe(true);
  });

  it("extracts 'base salary of 30 LPA'", () => {
    const b = extractComponentBreakdown("base salary of 30 LPA");
    expect(b.base).toBe(30);
  });

  it("extracts 'fixed pay 25 lakhs'", () => {
    const b = extractComponentBreakdown("fixed pay 25 lakhs");
    expect(b.base).toBe(25);
  });

  it("extracts '₹28 LPA' after 'basic'", () => {
    const b = extractComponentBreakdown("basic ₹28 LPA");
    expect(b.base).toBe(28);
  });

  it("handles 'base salary of around 28'", () => {
    const b = extractComponentBreakdown("I'd like a base salary of around 28");
    expect(b.base).toBe(28);
  });
});

describe("extractComponentBreakdown — variable", () => {
  it("extracts 'variable 7 LPA'", () => {
    const b = extractComponentBreakdown("variable 7 LPA");
    expect(b.variable).toBe(7);
  });

  it("extracts 'performance bonus 5L'", () => {
    const b = extractComponentBreakdown("performance bonus 5L");
    expect(b.variable).toBe(5);
  });

  it("extracts 'bonus of 4 lakh'", () => {
    const b = extractComponentBreakdown("bonus of 4 lakh");
    expect(b.variable).toBe(4);
  });

  it("extracts 'incentive 3 LPA'", () => {
    const b = extractComponentBreakdown("incentive 3 LPA");
    expect(b.variable).toBe(3);
  });
});

describe("extractComponentBreakdown — equity", () => {
  it("extracts 'RSU ₹5L'", () => {
    const b = extractComponentBreakdown("RSU ₹5L");
    expect(b.equity).toBe(5);
  });

  it("extracts 'ESOPs worth 10 LPA'", () => {
    const b = extractComponentBreakdown("ESOPs worth 10 LPA");
    expect(b.equity).toBe(10);
  });

  it("extracts 'equity 8 LPA'", () => {
    const b = extractComponentBreakdown("equity 8 LPA");
    expect(b.equity).toBe(8);
  });

  it("extracts 'stock grant 6 LPA'", () => {
    const b = extractComponentBreakdown("stock grant 6 LPA");
    expect(b.equity).toBe(6);
  });
});

describe("extractComponentBreakdown — combined", () => {
  it("extracts all three components from one sentence", () => {
    const b = extractComponentBreakdown(
      "I'd want base 28, variable 7 LPA, and RSU 5L",
    );
    expect(b.base).toBe(28);
    expect(b.variable).toBe(7);
    expect(b.equity).toBe(5);
    expect(b.hasAny).toBe(true);
  });

  it("handles crore unit (sub-1 cr → ×100 LPA)", () => {
    const b = extractComponentBreakdown("base 0.5 crore");
    expect(b.base).toBe(50);
  });

  it("rejects 'k' unit (too small for salary component)", () => {
    const b = extractComponentBreakdown("base 28k");
    expect(b.base).toBe(null);
  });

  it("returns all-null + hasAny=false on empty text", () => {
    const b = extractComponentBreakdown("");
    expect(b.hasAny).toBe(false);
    expect(b.base).toBe(null);
    expect(b.variable).toBe(null);
    expect(b.equity).toBe(null);
  });

  /* BUG-3 (PDF#24, 2026-05-16) — percentage-shaped split must NOT be
   * misparsed as absolute LPA values. */
  it("does not bind base/variable from '80% fixed, 20% variable'", () => {
    const b = extractComponentBreakdown("currently 80% fixed, 20% variable");
    expect(b.base).toBe(null);
    expect(b.variable).toBe(null);
    expect(b.basePercent).toBe(80);
    expect(b.variablePercent).toBe(20);
    expect(b.hasAny).toBe(true);
  });

  it("handles 'fixed 80% and variable 20%' shape", () => {
    const b = extractComponentBreakdown("fixed 80% and variable 20%");
    expect(b.base).toBe(null);
    expect(b.variable).toBe(null);
    expect(b.basePercent).toBe(80);
    expect(b.variablePercent).toBe(20);
  });

  it("handles '70/30 split' ratio shape", () => {
    const b = extractComponentBreakdown("the split is 70/30 fixed-variable");
    expect(b.basePercent).toBe(70);
    expect(b.variablePercent).toBe(30);
  });

  it("returns all-null when no component cues are present", () => {
    const b = extractComponentBreakdown("I'm looking for around 35 LPA total");
    expect(b.hasAny).toBe(false);
  });
});

describe("mergeBreakdown", () => {
  it("non-null fields overwrite prior", () => {
    const prior = { base: 28, variable: null, equity: null, hasAny: true };
    const next = { base: 30, variable: null, equity: null, hasAny: true };
    const m = mergeBreakdown(prior, next);
    expect(m.base).toBe(30);
  });

  it("null fields preserve prior", () => {
    const prior = { base: 28, variable: 5, equity: null, hasAny: true };
    const next = { base: null, variable: 7, equity: null, hasAny: true };
    const m = mergeBreakdown(prior, next);
    expect(m.base).toBe(28);
    expect(m.variable).toBe(7);
  });

  it("handles null prior", () => {
    const next = { base: 30, variable: null, equity: null, hasAny: true };
    const m = mergeBreakdown(null, next);
    expect(m.base).toBe(30);
    expect(m.hasAny).toBe(true);
  });

  it("hasAny=false when everything null", () => {
    const prior = { base: null, variable: null, equity: null, hasAny: false };
    const next = { base: null, variable: null, equity: null, hasAny: false };
    const m = mergeBreakdown(prior, next);
    expect(m.hasAny).toBe(false);
  });
});

describe("summarizeBreakdown", () => {
  it("formats all three components", () => {
    const s = summarizeBreakdown({ base: 28, variable: 7, equity: 5, hasAny: true });
    expect(s).toContain("base ₹28 LPA");
    expect(s).toContain("variable ₹7 LPA");
    expect(s).toContain("equity ₹5 LPA");
  });

  it("returns empty string when hasAny=false", () => {
    expect(summarizeBreakdown({ base: null, variable: null, equity: null, hasAny: false })).toBe("");
  });

  it("returns empty string on null/undefined", () => {
    expect(summarizeBreakdown(null)).toBe("");
    expect(summarizeBreakdown(undefined)).toBe("");
  });

  it("omits null components", () => {
    const s = summarizeBreakdown({ base: 28, variable: null, equity: null, hasAny: true });
    expect(s).toBe("base ₹28 LPA");
  });
});
