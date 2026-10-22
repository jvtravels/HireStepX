import { describe, it, expect } from "vitest";
import {
  buildSalaryReport,
  type OverridesMap,
} from "../../data/_salary-report";

/** Minimal band factory — only the fields the report reads. */
function band(totalMin: number, totalMax: number, extra: Record<string, unknown> = {}) {
  return {
    totalMin,
    totalMax,
    source: "test",
    lastVerified: "2026-01-01",
    ...extra,
  } as never;
}

const label = (s: string) => s.toUpperCase();

describe("buildSalaryReport", () => {
  it("rolls entry/mid/senior SWE bands into a per-company row", () => {
    const overrides: OverridesMap = {
      acme: {
        "software-engineer": {
          entry: band(10, 16),
          mid: band(16, 26),
          senior: band(26, 42, { equityType: "esop", lastVerified: "2026-06-01" }),
        },
      },
    };
    const { rows } = buildSalaryReport([{ slug: "acme" }], overrides, label, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      slug: "acme",
      label: "ACME",
      entryMin: 10,
      entryMax: 16,
      midMin: 16,
      seniorMax: 42,
      equityType: "esop",
    });
    // lastVerified = latest across the three bands
    expect(rows[0].lastVerified).toBe("2026-06-01");
  });

  it("skips companies with no software-engineer override at all", () => {
    const overrides: OverridesMap = {
      acme: { "product-manager": { mid: band(20, 30) } },
      beta: {},
    };
    const { rows, stats } = buildSalaryReport(
      [{ slug: "acme" }, { slug: "beta" }],
      overrides,
      label,
      new Set(),
    );
    expect(rows).toHaveLength(0);
    expect(stats.companyCount).toBe(0);
  });

  it("includes a company that has only a partial (mid-only) band", () => {
    const overrides: OverridesMap = {
      acme: { "software-engineer": { mid: band(18, 28) } },
    };
    const { rows } = buildSalaryReport([{ slug: "acme" }], overrides, label, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].entryMin).toBeUndefined();
    expect(rows[0].midMin).toBe(18);
  });

  it("computes median bands across companies (odd + even count)", () => {
    const mk = (slug: string, lo: number, hi: number): OverridesMap[string] => ({
      "software-engineer": { entry: band(lo, hi) },
    });
    const overrides: OverridesMap = {
      a: mk("a", 10, 20),
      b: mk("b", 12, 24),
      c: mk("c", 14, 28),
    };
    const { stats } = buildSalaryReport(
      [{ slug: "a" }, { slug: "b" }, { slug: "c" }],
      overrides,
      label,
      new Set(),
    );
    // odd count → middle value
    expect(stats.entryMedian).toEqual({ min: 12, max: 24 });
  });

  it("averages the two middle values for an even company count", () => {
    const overrides: OverridesMap = {
      a: { "software-engineer": { entry: band(10, 20) } },
      b: { "software-engineer": { entry: band(20, 40) } },
    };
    const { stats } = buildSalaryReport(
      [{ slug: "a" }, { slug: "b" }],
      overrides,
      label,
      new Set(),
    );
    // (10+20)/2 = 15, (20+40)/2 = 30
    expect(stats.entryMedian).toEqual({ min: 15, max: 30 });
  });

  it("identifies the top payer by senior max CTC", () => {
    const overrides: OverridesMap = {
      a: { "software-engineer": { senior: band(30, 50) } },
      b: { "software-engineer": { senior: band(40, 99) } },
      c: { "software-engineer": { senior: band(20, 60) } },
    };
    const { stats } = buildSalaryReport(
      [{ slug: "a" }, { slug: "b" }, { slug: "c" }],
      overrides,
      label,
      new Set(),
    );
    expect(stats.topPayer).toEqual({ label: "B", slug: "b", seniorMax: 99 });
  });

  it("flags emerging companies and counts them", () => {
    const overrides: OverridesMap = {
      krutrim: { "software-engineer": { mid: band(45, 75) } },
      tcs: { "software-engineer": { entry: band(3, 7) } },
    };
    const { rows, stats } = buildSalaryReport(
      [{ slug: "krutrim" }, { slug: "tcs" }],
      overrides,
      label,
      new Set(["krutrim"]),
    );
    expect(rows.find((r) => r.slug === "krutrim")?.emerging).toBe(true);
    expect(rows.find((r) => r.slug === "tcs")?.emerging).toBe(false);
    expect(stats.emergingCount).toBe(1);
  });

  it("tolerates the kebab-vs-spaced override key mismatch", () => {
    const overrides: OverridesMap = {
      "goldman sachs": { "software-engineer": { entry: band(20, 35) } },
    };
    const { rows } = buildSalaryReport(
      [{ slug: "goldman-sachs" }],
      overrides,
      label,
      new Set(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].entryMin).toBe(20);
  });

  it("reports the latest lastVerified date across all rows", () => {
    const overrides: OverridesMap = {
      a: { "software-engineer": { entry: band(10, 20, { lastVerified: "2026-03-01" }) } },
      b: { "software-engineer": { entry: band(12, 22, { lastVerified: "2026-07-15" }) } },
    };
    const { stats } = buildSalaryReport(
      [{ slug: "a" }, { slug: "b" }],
      overrides,
      label,
      new Set(),
    );
    expect(stats.lastVerified).toBe("2026-07-15");
  });
});
