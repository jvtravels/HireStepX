import { describe, it, expect, vi } from "vitest";
import {
  aggregateRatings,
  fetchProductRatingAggregate,
  isValidRating,
  RATING_K_ANON_FLOOR,
} from "../../server-handlers/_product-rating-helpers";

function makeRatings(values: number[]) {
  return values.map((rating) => ({ rating }));
}

describe("isValidRating", () => {
  it("accepts integers 1-5", () => {
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(5)).toBe(true);
    expect(isValidRating(3)).toBe(true);
  });

  it("rejects out-of-range, non-integer, and non-number values", () => {
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(6)).toBe(false);
    expect(isValidRating(3.5)).toBe(false);
    expect(isValidRating("3")).toBe(false);
    expect(isValidRating(null)).toBe(false);
    expect(isValidRating(undefined)).toBe(false);
  });
});

describe("aggregateRatings — k-anonymity", () => {
  it("returns null below the K-anonymity floor", () => {
    const rows = makeRatings(Array(RATING_K_ANON_FLOOR - 1).fill(5));
    expect(aggregateRatings(rows)).toBeNull();
  });

  it("returns an aggregate at exactly the floor", () => {
    const rows = makeRatings(Array(RATING_K_ANON_FLOOR).fill(4));
    const agg = aggregateRatings(rows);
    expect(agg).not.toBeNull();
    expect(agg!.count).toBe(RATING_K_ANON_FLOOR);
    expect(agg!.average).toBe(4);
  });

  it("rounds the average to 1 decimal", () => {
    const rows = makeRatings([...Array(RATING_K_ANON_FLOOR - 1).fill(5), 4]);
    const agg = aggregateRatings(rows);
    expect(agg!.average).toBeCloseTo(4.95, 1);
  });
});

describe("fetchProductRatingAggregate", () => {
  const cfg = { supabaseUrl: "https://example.supabase.co", serviceKey: "svc" };

  it("returns null when config is missing", async () => {
    const r = await fetchProductRatingAggregate({ supabaseUrl: "", serviceKey: "" });
    expect(r).toBeNull();
  });

  it("returns null on non-OK response", async () => {
    const fake = vi.fn().mockResolvedValue({ ok: false } as Response);
    const r = await fetchProductRatingAggregate(cfg, fake as unknown as typeof fetch);
    expect(r).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    const fake = vi.fn().mockRejectedValue(new Error("network"));
    const r = await fetchProductRatingAggregate(cfg, fake as unknown as typeof fetch);
    expect(r).toBeNull();
  });

  it("returns null below the K-anonymity floor", async () => {
    const fake = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRatings([5, 4, 3]),
    } as unknown as Response);
    const r = await fetchProductRatingAggregate(cfg, fake as unknown as typeof fetch);
    expect(r).toBeNull();
  });

  it("returns the aggregate once past the floor and hits the service-role endpoint", async () => {
    const fake = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => makeRatings(Array(RATING_K_ANON_FLOOR).fill(5)),
    } as unknown as Response);
    const r = await fetchProductRatingAggregate(cfg, fake as unknown as typeof fetch);
    expect(r).toEqual({ count: RATING_K_ANON_FLOOR, average: 5 });
    expect(fake).toHaveBeenCalledWith(
      expect.stringContaining("/rest/v1/product_ratings"),
      expect.objectContaining({ headers: expect.objectContaining({ apikey: "svc" }) }),
    );
  });
});
