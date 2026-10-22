/* Fix A — Indian comma-format absolute rupee parsing (2026-07-22).
 *
 * Validates that parseSalaryFacts and classifyNumberRoles both handle
 * Indian comma-grouped absolute-rupee amounts (18,50,000 / 28,00,000)
 * regardless of whether an explicit salary cue word is present in the
 * surrounding text. Before Fix A, `substituteAbsoluteRupees` was gated
 * on `VAGUE_DECADE_MONEY_CUE_RE`, which did NOT contain "targeting" —
 * so "I am targeting around 28,00,000" was silently dropped and
 * discovery never completed the targetSalary item.
 *
 * Fix B — variable-pay component not classified as target (2026-07-22).
 *
 * Validates that numbers whose context identifies them as a CTC component
 * (variable / performance bonus) are NOT bound to the `target` role even
 * when the probe-expectations phase is active. Before Fix B,
 * "the variable component comes to 8" in probe-expectations returned
 * target=8, which the planner treated as the candidate's total ask —
 * causing a false-accept or a false-low counter offer. */

import { describe, it, expect } from "vitest";
import { parseSalaryFacts, substituteAbsoluteRupees } from "../../server-handlers/_fact-parser";
import { classifyNumberRoles } from "../../server-handlers/_number-role-classifier";

/* ── Fix A — substituteAbsoluteRupees ─────────────────────────────── */

describe("substituteAbsoluteRupees — Fix A (no cue gate for absolute amounts)", () => {
  it("converts 18,50,000 even without a salary cue word", () => {
    /* The key fix: "targeting" was NOT in VAGUE_DECADE_MONEY_CUE_RE, so
     * the old function returned the input unchanged for this string. */
    const out = substituteAbsoluteRupees("I am targeting around 28,00,000");
    expect(out).toContain("LPA");
    expect(out).not.toContain("28,00,000");
  });

  it("converts ₹18,50,000 to ~18.5 LPA (per-annum cue present)", () => {
    const out = substituteAbsoluteRupees("I am currently at 18,50,000 per annum");
    expect(out).toContain("LPA");
    expect(out).not.toContain("18,50,000");
  });

  it("leaves numbers below 1 lakh untouched", () => {
    const out = substituteAbsoluteRupees("I need 50,000 for travel");
    expect(out).toContain("50,000");
  });
});

/* ── Fix A — parseSalaryFacts end-to-end ──────────────────────────── */

describe("parseSalaryFacts — Fix A Indian comma-format numbers", () => {
  it('"I am currently at 18,50,000 per annum" → currentCtc ≈ 18.5 LPA', () => {
    const facts = parseSalaryFacts("I am currently at 18,50,000 per annum");
    expect(facts.length).toBeGreaterThan(0);
    const val = facts[0].value;
    expect(val).toBeCloseTo(18.5, 1);
  });

  it('"I am targeting around 28,00,000" → ~28 LPA (no salary cue word needed)', () => {
    const facts = parseSalaryFacts("I am targeting around 28,00,000");
    expect(facts.length).toBeGreaterThan(0);
    const val = facts[0].value;
    expect(val).toBeCloseTo(28, 0);
  });

  it('"currently at 18,50,000 and targeting 28,00,000" → both values parsed', () => {
    const facts = parseSalaryFacts(
      "I am currently at 18,50,000 per annum and targeting around 28,00,000",
    );
    const values = facts.map((f) => f.value).sort((a, b) => a - b);
    expect(values.length).toBeGreaterThanOrEqual(2);
    expect(values[0]).toBeCloseTo(18.5, 0);
    expect(values[values.length - 1]).toBeCloseTo(28, 0);
  });

  it("₹24,00,000 with rupee prefix → 24 LPA", () => {
    const facts = parseSalaryFacts("My offer was ₹24,00,000");
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].value).toBeCloseTo(24, 0);
  });

  it("Western comma grouping 4,800,000 → 48 LPA", () => {
    const facts = parseSalaryFacts("I currently earn 4,800,000 rupees annually");
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].value).toBeCloseTo(48, 0);
  });
});

/* ── Fix A — classifyNumberRoles end-to-end ───────────────────────── */

describe("classifyNumberRoles — Fix A Indian comma-format numbers", () => {
  it('"I am currently at 18,50,000 per annum" → currentCtc ≈ 18.5', () => {
    const r = classifyNumberRoles("I am currently at 18,50,000 per annum");
    expect(r.currentCtc).not.toBeNull();
    expect(r.currentCtc!).toBeCloseTo(18.5, 0);
  });

  it('"I am targeting around 28,00,000" → target ≈ 28', () => {
    const r = classifyNumberRoles("I am targeting around 28,00,000", {
      phase: "probe-expectations",
    });
    expect(r.target).not.toBeNull();
    expect(r.target!).toBeCloseTo(28, 0);
  });

  it('"currently at 18,50,000 and targeting 28,00,000" → both currentCtc and target', () => {
    const r = classifyNumberRoles(
      "I am currently at 18,50,000 per annum and targeting around 28,00,000",
    );
    expect(r.currentCtc).not.toBeNull();
    expect(r.target).not.toBeNull();
    expect(r.currentCtc!).toBeCloseTo(18.5, 0);
    expect(r.target!).toBeCloseTo(28, 0);
  });
});

/* ── Fix B — variable-pay component classification ─────────────────── */

describe("classifyNumberRoles — Fix B variable-pay not classified as target", () => {
  it('"variable component comes to 8" in probe-expectations → NOT target', () => {
    const r = classifyNumberRoles("the variable component comes to 8", {
      phase: "probe-expectations",
    });
    expect(r.target).toBeNull();
  });

  it('"performance bonus 6 LPA" → NOT target', () => {
    const r = classifyNumberRoles("My performance bonus is 6 LPA", {
      phase: "probe-expectations",
    });
    expect(r.target).toBeNull();
  });

  it('"variable 8 LPA" in probe-expectations already suppressed (existing guard)', () => {
    const r = classifyNumberRoles("variable 8 LPA", { phase: "probe-expectations" });
    expect(r.target).toBeNull();
  });

  it('"variable amounts to 5" in probe-expectations → NOT target', () => {
    const r = classifyNumberRoles("the variable amounts to 5", {
      phase: "probe-expectations",
    });
    expect(r.target).toBeNull();
  });

  it('"variable pay comes to 6" in probe-expectations → NOT target', () => {
    const r = classifyNumberRoles("variable pay comes to 6", {
      phase: "probe-expectations",
    });
    expect(r.target).toBeNull();
  });

  it("a genuine target alongside variable component is still bound", () => {
    /* "I want 40 LPA total; the variable component comes to 8"
     * — target=40 should be bound, variable=8 suppressed. */
    const r = classifyNumberRoles(
      "I want 40 LPA total; the variable component comes to 8",
    );
    expect(r.target).not.toBeNull();
    expect(r.target!).toBeCloseTo(40, 0);
  });

  it('"incentive 5 lakh" → NOT target in probe-expectations', () => {
    const r = classifyNumberRoles("incentive 5 lakh", { phase: "probe-expectations" });
    expect(r.target).toBeNull();
  });
});
