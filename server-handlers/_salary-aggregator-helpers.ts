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

/** Map free-form experienceLevel strings (engine vocabulary) to the
 *  canonical salary_offers.level enum. Returns null if unrecognized. */
export function normalizeExperienceLevel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (["entry", "fresher", "junior", "0-2"].includes(s)) return "entry";
  if (["mid", "mid-level", "intermediate", "3-5"].includes(s)) return "mid";
  if (["senior", "sr", "5-8"].includes(s)) return "senior";
  if (["lead", "staff", "principal", "8-12"].includes(s)) return "lead";
  if (["executive", "exec", "director", "vp", "12+"].includes(s)) return "executive";
  return null;
}

/** Fetches opted-in salary_offers rows for a (company, role, level) bucket
 *  via Supabase REST and feeds them into aggregateOffers. Returns null on
 *  any failure (missing config, network, empty bucket, sub-K) so callers
 *  can fall back to the static band silently. fetchImpl is injectable
 *  for tests. */
export async function fetchLiveAggregate(
  args: { company: string; role: string; level: string },
  config: { supabaseUrl: string; serviceKey: string },
  fetchImpl: typeof fetch = fetch,
): Promise<OfferAggregate | null> {
  if (!config.supabaseUrl || !config.serviceKey) return null;
  const params = new URLSearchParams({
    select: "user_id,total_ctc_lpa,base_lpa,variable_lpa,joining_bonus_lpa",
    company: `eq.${args.company}`,
    role: `eq.${args.role}`,
    level: `eq.${args.level}`,
    may_share_aggregate: "eq.true",
    limit: "5000",
  });
  try {
    const res = await fetchImpl(`${config.supabaseUrl}/rest/v1/salary_offers?${params}`, {
      headers: {
        apikey: config.serviceKey,
        Authorization: `Bearer ${config.serviceKey}`,
      },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as OfferAggregateInput[];
    return aggregateOffers(rows);
  } catch {
    return null;
  }
}

/** Renders the live aggregate as a prompt-friendly block to append to
 *  bandContext. Caller decides whether to show it (typically only when
 *  the live n is high enough to be more reliable than the static band). */
export function formatLiveAggregateBlock(agg: OfferAggregate): string {
  const lines = [
    "",
    "── LIVE COMMUNITY DATA (HireStepX users) ──",
    `Sample: ${agg.uniqueContributors} self-reports (K-anonymity floor ${K_ANON_FLOOR}).`,
    `Total CTC: p25 ₹${agg.totalCtc.p25}L · p50 ₹${agg.totalCtc.p50}L · p75 ₹${agg.totalCtc.p75}L`,
  ];
  if (agg.base) lines.push(`Base p50: ₹${agg.base.p50}L`);
  if (agg.variable) lines.push(`Variable p50: ₹${agg.variable.p50}L`);
  if (agg.joiningBonus) lines.push(`Joining bonus p50: ₹${agg.joiningBonus.p50}L`);
  lines.push(
    "Treat this as ground truth when it diverges from static band — it reflects",
    "actual closes by candidates with this exact (company, role, level) tuple.",
  );
  return lines.join("\n");
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
