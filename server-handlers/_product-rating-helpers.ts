/**
 * Pure helpers for /api/product-rating and the /pricing aggregateRating
 * schema.
 *
 * Privacy / anti-gaming: the public aggregate is only ever surfaced once
 * at least RATING_K_ANON_FLOOR distinct users have rated — below that,
 * fetchProductRatingAggregate returns null and the caller must omit
 * aggregateRating entirely rather than publish a tiny, easily-swayed
 * sample as a trust signal.
 */

export const RATING_K_ANON_FLOOR = 20;

export interface ProductRatingAggregate {
  count: number;
  average: number; // rounded to 1 decimal, schema.org ratingValue convention
}

interface RatingRow {
  rating: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function isValidRating(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= 5;
}

/** Reduces raw rating rows into the public aggregate. Returns null below
 *  the K-anonymity floor so a handful of ratings can't be published as a
 *  headline "X stars" figure. */
export function aggregateRatings(rows: RatingRow[]): ProductRatingAggregate | null {
  if (rows.length < RATING_K_ANON_FLOOR) return null;
  const sum = rows.reduce((acc, r) => acc + r.rating, 0);
  return { count: rows.length, average: round1(sum / rows.length) };
}

/** Fetches all product_ratings rows via Supabase REST (service role) and
 *  aggregates them. Returns null on any failure or sub-floor sample so
 *  callers can omit aggregateRating from the schema silently. fetchImpl
 *  is injectable for tests. */
export async function fetchProductRatingAggregate(
  config: { supabaseUrl: string; serviceKey: string },
  fetchImpl: typeof fetch = fetch,
): Promise<ProductRatingAggregate | null> {
  if (!config.supabaseUrl || !config.serviceKey) return null;
  const params = new URLSearchParams({ select: "rating", limit: "20000" });
  try {
    const res = await fetchImpl(`${config.supabaseUrl}/rest/v1/product_ratings?${params}`, {
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as RatingRow[];
    return aggregateRatings(rows);
  } catch {
    return null;
  }
}
