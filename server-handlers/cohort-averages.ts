/* Vercel Edge Function — Cohort Averages
 *
 * Replaces the static seed averages in src/roleBenchmarks.ts with rolling
 * aggregates over the most recent ~1000 sessions in the last 60 days.
 * Computes an average score for each skill name observed in the corpus
 * and returns sample size + lastUpdated so the UI can gate display
 * (don't show "+12 vs avg" when n=3).
 *
 * Aggregation is global per skill (not partitioned by role_family) — skill
 * names like "Technical Depth" or "Communication" appear across multiple
 * role families and the UI looks up the family-relevant subset by name.
 *
 * Caching: results are deterministic given the corpus, so we cache the
 * aggregate in-memory at the edge for 1 hour. Cold start recomputes.
 *
 * GET /api/cohort-averages
 *   → { byName: { [skill]: { avg, n } }, totalSessions, lastUpdated }
 */

export const config = { runtime: "edge" };

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
const LOOKBACK_DAYS = 60;
const MAX_SESSIONS = 1500;

interface SkillAverages {
  /* p50/p75/p90 added so the UI can render "Top 10%" / "Top 25%" /
     "Top 50%" badges, not just the avg comparison. avg is kept for
     backward compatibility with callers that already render the
     deviation from cohort mean. */
  [skill: string]: { avg: number; n: number; p50?: number; p75?: number; p90?: number };
}
interface CachedResult {
  byName: SkillAverages;
  totalSessions: number;
  lastUpdated: string;
}

let CACHE: { result: CachedResult; ts: number } | null = null;

function corsHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Cache-Control": "public, max-age=900", // 15min CDN cache too
  };
}

interface SessionRow {
  skill_scores: Record<string, unknown> | null;
}

async function fetchCorpus(): Promise<SessionRow[]> {
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const url = `${SUPABASE_URL}/rest/v1/sessions?created_at=gte.${encodeURIComponent(since)}&skill_scores=not.is.null&order=created_at.desc&limit=${MAX_SESSIONS}&select=skill_scores`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[cohort-averages] supabase fetch failed: HTTP ${res.status}: ${body.slice(0, 200)}`);
    return [];
  }
  return (await res.json()) as SessionRow[];
}

/* Pick a percentile from a SORTED ascending array. Linear interpolation
   between the two surrounding samples — same algorithm as numpy default. */
function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Compute per-skill averages and percentiles from raw sessions. Each
 * row's skill_scores can be either Record<string, number> or
 * Record<string, { score: number }>. We retain raw arrays to compute
 * p50/p75/p90 in addition to the running average.
 */
function aggregate(rows: SessionRow[]): CachedResult {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.skill_scores || typeof row.skill_scores !== "object") continue;
    for (const [name, raw] of Object.entries(row.skill_scores)) {
      let score: number | null = null;
      if (typeof raw === "number" && isFinite(raw)) score = raw;
      else if (raw && typeof raw === "object" && "score" in (raw as Record<string, unknown>)) {
        const s = (raw as { score: unknown }).score;
        if (typeof s === "number" && isFinite(s)) score = s;
      }
      if (score === null || score < 0 || score > 100) continue;
      const cur = buckets.get(name) || [];
      cur.push(score);
      buckets.set(name, cur);
    }
  }
  const byName: SkillAverages = {};
  for (const [name, scores] of buckets.entries()) {
    if (scores.length < 5) continue; // require minimum sample for a meaningful average
    /* Percentiles need a sorted copy. Sort in place — we don't reuse
       the array after this point. Mutating bucket is faster than slice
       for our typical 1k-element arrays. */
    scores.sort((a, b) => a - b);
    const total = scores.reduce((s, v) => s + v, 0);
    byName[name] = {
      avg: Math.round(total / scores.length),
      n: scores.length,
      p50: Math.round(quantile(scores, 0.5)),
      p75: Math.round(quantile(scores, 0.75)),
      p90: Math.round(quantile(scores, 0.9)),
    };
  }
  return { byName, totalSessions: rows.length, lastUpdated: new Date().toISOString() };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders() });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "Not configured" }), { status: 503, headers: corsHeaders() });
  }

  // Cache hit — serve immediately. Edge isolate cold-starts will recompute
  // but a warm instance amortizes the cost across many requests.
  const now = Date.now();
  if (CACHE && now - CACHE.ts < CACHE_TTL_MS) {
    return new Response(JSON.stringify({ ...CACHE.result, cached: true }), { status: 200, headers: corsHeaders() });
  }

  try {
    const rows = await fetchCorpus();
    const result = aggregate(rows);
    CACHE = { result, ts: now };
    return new Response(JSON.stringify({ ...result, cached: false }), { status: 200, headers: corsHeaders() });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[cohort-averages] failed: ${msg.slice(0, 200)}`);
    // Fall back to last cached value if we have one, otherwise empty.
    if (CACHE) {
      return new Response(JSON.stringify({ ...CACHE.result, cached: true, stale: true }), { status: 200, headers: corsHeaders() });
    }
    return new Response(JSON.stringify({ byName: {}, totalSessions: 0, lastUpdated: new Date().toISOString(), error: msg }), { status: 200, headers: corsHeaders() });
  }
}
