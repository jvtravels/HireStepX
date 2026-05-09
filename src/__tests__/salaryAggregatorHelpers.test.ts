import { describe, it, expect, vi } from "vitest";
import {
  aggregateOffers,
  parseAggregateQuery,
  K_ANON_FLOOR,
  normalizeExperienceLevel,
  fetchLiveAggregate,
  formatLiveAggregateBlock,
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

  it("accepts level synonyms via normalizeExperienceLevel", () => {
    expect(normalizeExperienceLevel("fresher")).toBe("entry");
    expect(normalizeExperienceLevel("Mid-Level")).toBe("mid");
    expect(normalizeExperienceLevel("staff")).toBe("lead");
    expect(normalizeExperienceLevel("VP")).toBe("executive");
    expect(normalizeExperienceLevel("garbage")).toBeNull();
    expect(normalizeExperienceLevel(null)).toBeNull();
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

describe("fetchLiveAggregate", () => {
  const cfg = { supabaseUrl: "https://example.supabase.co", serviceKey: "svc" };
  const args = { company: "Google", role: "SDE", level: "mid" };

  it("returns null when config is missing", async () => {
    const r = await fetchLiveAggregate(args, { supabaseUrl: "", serviceKey: "" });
    expect(r).toBeNull();
  });

  it("returns null on non-OK response", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: false } as Response);
    const r = await fetchLiveAggregate(args, cfg, fake as unknown as typeof fetch);
    expect(r).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("network"));
    const r = await fetchLiveAggregate(args, cfg, fake as unknown as typeof fetch);
    expect(r).toBeNull();
  });

  it("returns aggregate when bucket has K+ contributors", async () => {
    const rows = [
      { user_id: "u1", total_ctc_lpa: 30 },
      { user_id: "u2", total_ctc_lpa: 32 },
      { user_id: "u3", total_ctc_lpa: 35 },
      { user_id: "u4", total_ctc_lpa: 38 },
      { user_id: "u5", total_ctc_lpa: 40 },
    ];
    const fake = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => rows,
    } as unknown as Response);
    const r = await fetchLiveAggregate(args, cfg, fake as unknown as typeof fetch);
    expect(r).not.toBeNull();
    expect(r!.uniqueContributors).toBe(5);
    expect(fake).toHaveBeenCalledWith(
      expect.stringContaining("may_share_aggregate=eq.true"),
      expect.objectContaining({ headers: expect.objectContaining({ apikey: "svc" }) }),
    );
  });
});

describe("formatLiveAggregateBlock", () => {
  it("renders total CTC + optional components", () => {
    const block = formatLiveAggregateBlock({
      count: 8,
      uniqueContributors: 8,
      totalCtc: { p25: 30, p50: 35, p75: 40 },
      base: { p50: 24 },
    });
    expect(block).toContain("LIVE COMMUNITY DATA");
    expect(block).toContain("8 self-reports");
    expect(block).toContain("p50 ₹35L");
    expect(block).toContain("Base p50: ₹24L");
    expect(block).not.toContain("Variable p50");
  });
});
