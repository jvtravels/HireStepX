/* Pure helpers for the daily AI quality digest.
 *
 * The cron passes structured aggregates; these helpers turn that into
 * a compact prompt and parse the LLM's response into named paragraphs.
 * Pure = unit-testable without mocking the LLM.
 */

export interface DigestInput {
  day: string;                                  // "YYYY-MM-DD"
  byFocus: { focus: string; sessions: number; avg_drift: number; hallucination_rate: number; top_flags: { flag: string; count: number }[] }[];
  resolutionsToday: { focus: string; status: string; count: number }[];
  recentCommits: { sha: string; subject: string; date: string }[];
  weekTrend: { focus: string; flag: string; today_count: number; week_avg: number }[];
  totalAnalyzed: number;
  totalOpenIssues: number;
}

export interface DigestOutput {
  fixes_summary: string;
  improvements_summary: string;
  patterns_summary: string;
  recommendations: string;
}

export function buildDigestPrompt(input: DigestInput): string {
  const { day, byFocus, resolutionsToday, recentCommits, weekTrend, totalAnalyzed, totalOpenIssues } = input;
  const focusLines = byFocus
    .map((f) => `  - ${f.focus}: ${f.sessions} sessions, drift=${f.avg_drift.toFixed(1)}, halluc=${(f.hallucination_rate * 100).toFixed(1)}%, top: ${(f.top_flags || []).slice(0, 3).map((x) => `${x.flag}(${x.count})`).join(", ") || "none"}`)
    .join("\n");
  const resLines = resolutionsToday.length
    ? resolutionsToday.map((r) => `  - ${r.focus}: ${r.count} ${r.status}`).join("\n")
    : "  (none)";
  const commitLines = recentCommits.length
    ? recentCommits.slice(0, 8).map((c) => `  - ${c.sha} (${c.date}): ${c.subject.slice(0, 100)}`).join("\n")
    : "  (no analyzer/data commits in the last 24h)";
  const trendLines = weekTrend.length
    ? weekTrend.slice(0, 8).map((t) => `  - ${t.focus} / ${t.flag}: today=${t.today_count} vs 7d avg=${t.week_avg.toFixed(1)}`).join("\n")
    : "  (no notable changes)";

  return `You are the quality lead for an AI interview platform (HireStepX).
Today is ${day}. Write a concise daily digest from the data below.
Respond ONLY with JSON in this exact shape:
{
  "fixes_summary":         "<2-4 sentences. Resolutions logged today + their effect.>",
  "improvements_summary":  "<2-4 sentences. Code changes that landed (analyzer/data) and what they target.>",
  "patterns_summary":      "<2-4 sentences. Cross-session patterns: which flags spiked, which focus is degrading, anything correlated.>",
  "recommendations":       "<2-3 actionable recommendations the team should consider tomorrow. Each as a short sentence.>"
}

Be specific. Cite focus names and flag names. Avoid filler.

DATA:
Day: ${day}
Sessions analyzed today: ${totalAnalyzed}
Total open issues across all focuses: ${totalOpenIssues}

Per-focus rollup:
${focusLines || "  (no analyzed sessions today)"}

Resolutions logged today:
${resLines}

Recent code changes (last 24h, analyzer/data files only):
${commitLines}

Week-over-week trend (today vs 7-day average):
${trendLines}
`.trim();
}

/**
 * Defensive parser: never throws, returns empty fields on bad LLM output
 * so the cron writes something to daily_digests rather than failing.
 */
export function parseDigest(jsonText: string): DigestOutput {
  const out: DigestOutput = { fixes_summary: "", improvements_summary: "", patterns_summary: "", recommendations: "" };
  try {
    const parsed = JSON.parse(jsonText) as Partial<DigestOutput>;
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.fixes_summary === "string") out.fixes_summary = parsed.fixes_summary.slice(0, 1500);
      if (typeof parsed.improvements_summary === "string") out.improvements_summary = parsed.improvements_summary.slice(0, 1500);
      if (typeof parsed.patterns_summary === "string") out.patterns_summary = parsed.patterns_summary.slice(0, 1500);
      if (typeof parsed.recommendations === "string") out.recommendations = parsed.recommendations.slice(0, 1500);
    }
  } catch {
    /* fall through with empty fields */
  }
  return out;
}

/**
 * Severity tier for a session insight. Keep in sync with the SQL default.
 */
export function computeSeverity(opts: {
  hallucinationCount: number;
  scoreDrift: number | null;
  flagCount: number;
}): "high" | "medium" | "low" {
  if (opts.hallucinationCount > 0) return "high";
  if (typeof opts.scoreDrift === "number" && Math.abs(opts.scoreDrift) >= 10) return "high";
  if (opts.flagCount > 0) return "medium";
  return "low";
}
