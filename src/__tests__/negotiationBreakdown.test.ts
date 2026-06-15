import { describe, it, expect } from "vitest";
import {
  computeBreakdown,
  formatBreakdownSentence,
  stripRupeeFigures,
  composeBreakdownReply,
  formatClosingRecapSentence,
  composeClosingRecapReply,
} from "../../server-handlers/_negotiation-breakdown";

describe("computeBreakdown", () => {
  it("splits headline across base/variable/joining/PF summing exactly", () => {
    const b = computeBreakdown(30)!;
    expect(b.total).toBe(30);
    expect(b.base).toBe(18);
    expect(b.variable).toBe(6);
    expect(b.joining).toBe(3);
    expect(b.pf).toBe(3);
    expect(b.base + b.variable + b.joining + b.pf).toBeCloseTo(30, 5);
  });

  it("handles decimal headlines (30.4) without slot collisions", () => {
    const b = computeBreakdown(30.4)!;
    // No slot should equal the headline — that was the original bug.
    expect(b.base).not.toBe(30.4);
    expect(b.variable).not.toBe(30.4);
    expect(b.joining).not.toBe(30.4);
    expect(b.pf).not.toBe(30.4);
    expect(b.total).toBe(30.4);
  });

  it("returns null for non-positive / non-finite headlines", () => {
    expect(computeBreakdown(0)).toBeNull();
    expect(computeBreakdown(-5)).toBeNull();
    expect(computeBreakdown(NaN)).toBeNull();
    expect(computeBreakdown(Infinity)).toBeNull();
  });

  /* Numeric Finding 4 (2026-06-15) — clamp base to the band's baseStretch so
   * the recap doesn't promise a fixed the band structurally won't pay. */
  it("clamps base to baseStretch and reallocates the residual, still summing", () => {
    // headline 40 → naive base 24; baseStretch caps it at 20, variableMax 10.
    const b = computeBreakdown(40, { baseStretch: 20, variableMax: 10 })!;
    expect(b.base).toBe(20); // clamped from 24
    expect(b.base).toBeLessThanOrEqual(20);
    expect(b.variable).toBeLessThanOrEqual(10); // respects variableMax
    expect(b.base + b.variable + b.joining + b.pf).toBeCloseTo(40, 5);
  });

  it("leaves the split unchanged when base is already within baseStretch", () => {
    const plain = computeBreakdown(30)!;
    const capped = computeBreakdown(30, { baseStretch: 25, variableMax: 8 })!;
    expect(capped.base).toBe(plain.base); // 18 ≤ 25, no clamp
    expect(capped.variable).toBe(plain.variable);
  });

  /* variableMax is a TRUE ceiling: when the naive 20% slot already exceeds it
   * (base-heavy band), variable must be clamped DOWN, with the excess flowing
   * to joining — not left above the documented ceiling. */
  it("clamps the naive variable down to variableMax and still sums", () => {
    // headline 5 → naive variable 1.0; ceiling 0.8 must win.
    const b = computeBreakdown(5, { variableMax: 0.8 })!;
    expect(b.variable).toBeLessThanOrEqual(0.8);
    expect(b.variable).toBe(0.8);
    expect(b.base + b.variable + b.joining + b.pf).toBeCloseTo(5, 5);
  });
});

describe("formatBreakdownSentence", () => {
  it("renders the four-slot sentence with rupee + LPA formatting", () => {
    const b = computeBreakdown(50)!;
    const s = formatBreakdownSentence(b);
    expect(s).toContain("Base ₹30 LPA");
    expect(s).toContain("variable ₹10 LPA");
    expect(s).toContain("joining bonus ₹5 LPA");
    expect(s).toContain("PF + benefits ₹5 LPA");
    expect(s).toContain("₹50 LPA total");
  });
});

describe("stripRupeeFigures", () => {
  it("removes ₹X LPA / lakh / Cr shapes", () => {
    expect(stripRupeeFigures("offer is ₹49 LPA across slots")).toBe(
      "offer is the number across slots",
    );
    expect(stripRupeeFigures("₹2.5 Cr or ₹250 lakhs")).toBe(
      "the number or the number",
    );
  });

  it("collapses runs of substituted markers", () => {
    expect(stripRupeeFigures("₹49 LPA ₹49 LPA")).toBe("the number");
  });
});

describe("composeBreakdownReply", () => {
  it("uses LLM lead-in if present, else default, and appends the templated breakdown", () => {
    const reply = composeBreakdownReply("Sure, happy to walk through it", 30)!;
    expect(reply.startsWith("Sure, happy to walk through it.")).toBe(true);
    expect(reply).toContain("Base ₹18 LPA");
    expect(reply).toContain("₹30 LPA total");
    expect(reply).toContain("What part would you like to dig into?");
  });

  it("strips rupee numbers the LLM emitted in its lead-in", () => {
    // This is the bug class: LLM ignored the rule and wrote "₹49 LPA" in prose.
    // Server scrubs it before templating the breakdown.
    const reply = composeBreakdownReply(
      "Absolutely, the ₹49 LPA breakdown is base ₹49 LPA, variable ₹49 LPA",
      49,
    )!;
    // None of the bogus ₹49 placeholder slots survive.
    expect(reply).not.toMatch(/base\s+₹49\s+LPA[\s,]+variable\s+₹49/i);
    // The real templated breakdown is appended with distinct slot values.
    expect(reply).toContain("Base ₹29.4 LPA");
    expect(reply).toContain("variable ₹9.8 LPA");
    expect(reply).toContain("₹49 LPA total");
  });

  it("falls back to default lead-in when the LLM left followUpText empty", () => {
    const reply = composeBreakdownReply("", 30)!;
    expect(reply.startsWith("Sure, happy to walk through the structure.")).toBe(true);
  });

  it("returns null when headline is invalid", () => {
    expect(composeBreakdownReply("anything", 0)).toBeNull();
    expect(composeBreakdownReply("anything", NaN)).toBeNull();
  });
});

describe("formatClosingRecapSentence", () => {
  it("renders the recap with all four components summing to the agreed total", () => {
    const b = computeBreakdown(40)!;
    const s = formatClosingRecapSentence(b);
    expect(s).toContain("base ₹24 LPA");
    expect(s).toContain("variable ₹8 LPA");
    expect(s).toContain("joining bonus ₹4 LPA");
    expect(s).toContain("PF and benefits ₹4 LPA");
    expect(s).toContain("total ₹40 LPA CTC");
  });
});

describe("composeClosingRecapReply", () => {
  it("preserves the LLM warmth lead-in and appends the templated recap + logistics tail", () => {
    const reply = composeClosingRecapReply("Wonderful, glad we got here", 27)!;
    expect(reply.startsWith("Wonderful, glad we got here.")).toBe(true);
    expect(reply).toContain("base ₹16.2 LPA");
    expect(reply).toContain("total ₹27 LPA CTC");
    expect(reply).toContain("offer letter");
    expect(reply).toContain("notice-period");
  });

  it("strips rupee figures the LLM tried to emit in its lead-in (the flat-breakdown bug)", () => {
    // The original bug: LLM wrote "base ₹49, variable ₹49, joining ₹49" — every
    // slot equal to the headline. Server scrubs those before appending the
    // real recap. The bogus repeated-headline pattern must not survive.
    const reply = composeClosingRecapReply(
      "Great — base ₹49 LPA, variable ₹49 LPA, joining ₹49 LPA, total ₹49 LPA",
      49,
    )!;
    expect(reply).not.toMatch(/base\s+₹49\s+LPA[\s,]+variable\s+₹49/i);
    // Real templated recap with distinct slot values lands at the end.
    expect(reply).toContain("base ₹29.4 LPA");
    expect(reply).toContain("variable ₹9.8 LPA");
    expect(reply).toContain("total ₹49 LPA CTC");
  });

  it("falls back to a default warmth line when the LLM left followUpText empty", () => {
    const reply = composeClosingRecapReply("", 30)!;
    expect(reply.startsWith("Wonderful — really glad we landed somewhere that works for both sides.")).toBe(true);
    expect(reply).toContain("total ₹30 LPA CTC");
  });

  it("returns null when agreedTotal is invalid", () => {
    expect(composeClosingRecapReply("anything", 0)).toBeNull();
    expect(composeClosingRecapReply("anything", NaN)).toBeNull();
    expect(composeClosingRecapReply("anything", -10)).toBeNull();
  });

  it("[Pine Labs T5 fix] does not re-ask notice period when caller signals it was already provided", () => {
    const reply = composeClosingRecapReply("Great", 30, { noticeAlreadyProvided: true })!;
    expect(reply).not.toMatch(/notice[-\s]period\s+situation/i);
    expect(reply).not.toMatch(/when\s+would\s+you\s+ideally\s+start/i);
    expect(reply).toMatch(/let me know if you have any other questions/i);
  });
});
