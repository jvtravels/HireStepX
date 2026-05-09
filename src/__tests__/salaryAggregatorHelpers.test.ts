import { describe, it, expect } from "vitest";
import {
  aggregateOffers,
  parseAggregateQuery,
  K_ANON_FLOOR,
} from "../../server-handlers/_salary-aggregator-helpers";

function makeOffers(totals: number[], opts: { user_ids?: string[] } = {}) {
  return totals.map((t, i) => ({
    user_id: opts.user_ids?.[i] ?? `u${i}`,
    total_ctc_lpa: t,
  }));
}

describe("aggregateOffers — k-anonymity", () => {
  it("returns null below the K-anonymity floor", () => {
    const rows = makeOffers([20, 22, 25, 27]); // 4 users, < K=5
    expect(aggregateOffers(rows)).toBeNull();
  });

  it("returns null when contributors are below floor even if rows >= floor", () => {
    // 6 rows, 3 distinct users — should still null out.
    const rows = [
      { user_id: "u1", total_ctc_lpa: 20 },
      { user_id: "u1", total_ctc_lpa: 22 },
      { user_id: "u2", total_ctc_lpa: 25 },
      { user_id: "u2", total_ctc_lpa: 27 },
      { user_id: "u3", total_ctc_lpa: 30 },
      { user_id: "u3", total_ctc_lpa: 32 },
    ];
    expect(aggregateOffers(rows)).toBeNull();
  });

  it("returns aggregate when contributors >= floor", () => {
    const rows = makeOffers([20, 22, 25, 27, 30]);
    const agg = aggregateOffers(rows);
    expect(agg).not.toBeNull();
    expect(agg!.uniqueContributors).toBe(5);
    expect(agg!.count).toBe(5);
  });
});

describe("aggregateOffers — percentiles", () => {
  it("computes p25/p50/p75 correctly", () => {
    // 10 offers from 25L to 70L in steps of 5
    const totals = [25, 30, 35, 40, 45, 50, 55, 60, 65, 70];
    const agg = aggregateOffers(makeOffers(totals));
    expect(agg).not.toBeNull();
    // Linear interp with idx=(n-1)*p on length=10:
    // p25: idx=2.25 → 36.25; p50: idx=4.5 → 47.5; p75: idx=6.75 → 58.75
    expect(agg!.totalCtc.p25).toBeCloseTo(36.3, 1);
    expect(agg!.totalCtc.p50).toBeCloseTo(47.5, 1);
    expect(agg!.totalCtc.p75).toBeCloseTo(58.8, 1);
  });

  it("emits component-level percentiles only when each component has K rows", () => {
    // 5 contributors all reporting total, but only 4 reporting base.
    const rows = [
      { user_id: "u1", total_ctc_lpa: 30, base_lpa: 22 },
      { user_id: "u2", total_ctc_lpa: 32, base_lpa: 24 },
      { user_id: "u3", total_ctc_lpa: 35, base_lpa: 26 },
      { user_id: "u4", total_ctc_lpa: 38, base_lpa: 28 },
      { user_id: "u5", total_ctc_lpa: 40 }, // no base
    ];
    const agg = aggregateOffers(rows);
    expect(agg).not.toBeNull();
    expect(agg!.totalCtc.p50).toBeCloseTo(35);
    expect(agg!.base).toBeUndefined();
  });

  it("emits base p50 when 5+ contributors report base", () => {
    const rows = [
      { user_id: "u1", total_ctc_lpa: 30, base_lpa: 22 },
      { user_id: "u2", total_ctc_lpa: 32, base_lpa: 24 },
      { user_id: "u3", total_ctc_lpa: 35, base_lpa: 26 },
      { user_id: "u4", total_ctc_lpa: 38, base_lpa: 28 },
      { user_id: "u5", total_ctc_lpa: 40, base_lpa: 30 },
    ];
    const agg = aggregateOffers(rows);
    expect(agg!.base?.p50).toBeCloseTo(26);
  });

  it("ignores zero / negative / non-finite totals", () => {
    const rows = [
      { user_id: "u1", total_ctc_lpa: 0 },
      { user_id: "u2", total_ctc_lpa: -5 },
      { user_id: "u3", total_ctc_lpa: NaN },
      { user_id: "u4", total_ctc_lpa: 30 },
      { user_id: "u5", total_ctc_lpa: 32 },
    ];
    // Even though we have 5 distinct user_ids, only 2 valid totals → null.
    expect(aggregateOffers(rows)).toBeNull();
  });

  it("exposes K_ANON_FLOOR constant", () => {
    expect(K_ANON_FLOOR).toBe(5);
  });
});

describe("parseAggregateQuery", () => {
  function makeUrl(q: Record<string, string>): URL {
    const params = new URLSearchParams(q).toString();
    return new URL(`https://example.com/api/salary-aggregate?${params}`);
  }

  it("rejects missing company", () => {
    const r = parseAggregateQuery(makeUrl({ role: "SDE", level: "mid" }));
    expect(r.ok).toBe(false);
  });

  it("rejects missing role", () => {
    const r = parseAggregateQuery(makeUrl({ company: "Google", level: "mid" }));
    expect(r.ok).toBe(false);
  });

  it("rejects bad level", () => {
    const r = parseAggregateQuery(
      makeUrl({ company: "Google", role: "SDE", level: "principal" }),
    );
    expect(r.ok).toBe(false);
  });

  it("accepts a valid triple", () => {
    const r = parseAggregateQuery(
      makeUrl({ company: "Google", role: "SDE", level: "mid" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.company).toBe("Google");
      expect(r.role).toBe("SDE");
      expect(r.level).toBe("mid");
    }
  });
});
