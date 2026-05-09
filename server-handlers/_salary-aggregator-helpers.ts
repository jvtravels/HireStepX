/**
 * Pure helpers for /api/salary-aggregate.
 *
 * Aggregates user-reported salary_offers into a per-(company, role, level)
 * band. Privacy guarantees:
 *   - K-anonymity: a bucket is only emitted if it has at least
 *     K_ANON_FLOOR distinct users contributing. Below that, no data
 *     leaves the server.
 *   - Aggregate-only: we never emit individual offers; only p25 / p50 /
 *     p75 / count.
 *   - Sharing gate: the storage row's may_share_aggregate=true bit is
 *     enforced upstream by the SQL query; this helper assumes inputs
 *     are already filtered.
 */

export const K_ANON_FLOOR = 5;

export interface OfferAggregateInput {
  user_id: string;
  total_ctc_lpa: number | null | undefined;
  base_lpa?: number | null;
  variable_lpa?: number | null;
  joining_bonus_lpa?: number | null;
}

export interface OfferAggregate {
  count: number;
  uniqueContributors: number;
  totalCtc: { p25: number; p50: number; p75: number };
  base?: { p50: number };
  variable?: { p50: number };
  joiningBonus?: { p50: number };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Returns null when the bucket is below the K-anonymity floor.
 * Caller must NOT log or surface the input rows directly — only the
 * aggregate object.
 */
export function aggregateOffers(rows: OfferAggregateInput[]): OfferAggregate | null {
  const validTotals = rows
    .map((r) => r.total_ctc_lpa)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);

  const uniqueContributors = new Set(rows.map((r) => r.user_id)).size;
  if (uniqueContributors < K_ANON_FLOOR) return null;
  if (validTotals.length < K_ANON_FLOOR) return null;

  const sortedTotals = [...validTotals].sort((a, b) => a - b);
  const out: OfferAggregate = {
    count: validTotals.length,
    uniqueContributors,
    totalCtc: {
      p25: round1(percentile(sortedTotals, 0.25)),
      p50: round1(percentile(sortedTotals, 0.5)),
      p75: round1(percentile(sortedTotals, 0.75)),
    },
  };

  const baseVals = rows
    .map((r) => r.base_lpa)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (baseVals.length >= K_ANON_FLOOR) {
    out.base = { p50: round1(percentile(baseVals, 0.5)) };
  }

  const varVals = rows
    .map((r) => r.variable_lpa)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (varVals.length >= K_ANON_FLOOR) {
    out.variable = { p50: round1(percentile(varVals, 0.5)) };
  }

  const jbVals = rows
    .map((r) => r.joining_bonus_lpa)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (jbVals.length >= K_ANON_FLOOR) {
    out.joiningBonus = { p50: round1(percentile(jbVals, 0.5)) };
  }

  return out;
}

/** Validates and normalizes the GET query params for the aggregator. */
export function parseAggregateQuery(url: URL): {
  ok: true;
  company: string;
  role: string;
  level: string;
} | { ok: false; error: string } {
  const company = (url.searchParams.get("company") ?? "").trim();
  const role = (url.searchParams.get("role") ?? "").trim();
  const level = (url.searchParams.get("level") ?? "").trim().toLowerCase();
  if (!company) return { ok: false, error: "company is required" };
  if (!role) return { ok: false, error: "role is required" };
  if (!["entry", "mid", "senior", "lead", "executive"].includes(level)) {
    return { ok: false, error: "level must be one of entry|mid|senior|lead|executive" };
  }
  return { ok: true, company: company.slice(0, 120), role: role.slice(0, 120), level };
}
