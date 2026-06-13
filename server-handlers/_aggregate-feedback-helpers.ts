/* HireStepX — Question-feedback aggregation
 *
 * Pure functions for crunching the question_feedback table into
 * actionable patterns. Lives separately from aggregate-question-feedback.ts
 * (the cron handler) so we can unit-test the maths without booting
 * Supabase or sending real emails.
 *
 * The two key signals we mine:
 *
 *   1. Worst-performing patterns — (company × focus) tuples where the
 *      down:up ratio is high. Tells you which curated bank entries to
 *      refresh, OR which generated-question patterns the LLM keeps
 *      getting wrong.
 *
 *   2. Real-match candidates — questions where the user pressed "this
 *      matched my real interview" thumbs. These are the highest-value
 *      additions for the curated bank. Surfaced separately so they
 *      land in the moderation queue, not the "fix me" bucket.
 *
 * Anything in this file MUST be pure. The cron handler does the I/O;
 * this file just shapes rows into reports.
 */

export interface FeedbackRow {
  question_text: string;
  thumbs: "up" | "down" | "real";
  company: string;
  role: string;
  focus: string;
  created_at: string;
}

export interface PatternStats {
  /** Bucket key, e.g. "flipkart × case-study". Empty company collapses to "(any)". */
  bucket: string;
  company: string;
  focus: string;
  upCount: number;
  downCount: number;
  realCount: number;
  total: number;
  /** Down ÷ (up + down). 0 = perfect, 1 = catastrophic. */
  downRatio: number;
}

export interface RealMatchCandidate {
  questionText: string;
  company: string;
  role: string;
  focus: string;
  realCount: number;
  /** ISO timestamp of the most recent "real" thumbs for this question. */
  lastSeenAt: string;
}

export interface AggregateReport {
  totalRowsAnalysed: number;
  windowDays: number;
  /** Patterns where down-rate is troubling and sample size is meaningful. */
  worstPatterns: PatternStats[];
  /** Verbatim questions that ≥N users marked as matching their real interview. */
  realMatchCandidates: RealMatchCandidate[];
  /** Empty when there's nothing actionable — caller skips the email send. */
  hasFindings: boolean;
}

/** Bucket label — empty company collapses to "(any)" so the row still surfaces. */
export function bucketLabel(company: string, focus: string): string {
  return `${company || "(any)"} × ${focus || "(any)"}`;
}

/** Group rows by (company × focus); ignore "real" thumbs in ratio maths
 *  because that's an additive signal, not a quality penalty. */
export function aggregatePatterns(rows: FeedbackRow[]): PatternStats[] {
  const groups = new Map<string, PatternStats>();
  for (const row of rows) {
    const key = bucketLabel(row.company, row.focus);
    let g = groups.get(key);
    if (!g) {
      g = {
        bucket: key, company: row.company, focus: row.focus,
        upCount: 0, downCount: 0, realCount: 0, total: 0, downRatio: 0,
      };
      groups.set(key, g);
    }
    g.total += 1;
    if (row.thumbs === "up") g.upCount += 1;
    else if (row.thumbs === "down") g.downCount += 1;
    else if (row.thumbs === "real") g.realCount += 1;
  }
  for (const g of groups.values()) {
    const denom = g.upCount + g.downCount;
    g.downRatio = denom === 0 ? 0 : g.downCount / denom;
  }
  return [...groups.values()];
}

/** Pick the worst patterns to surface in the email. Filters by
 *  minimum sample size so a single down-vote can't dominate the report. */
export function pickWorstPatterns(
  patterns: PatternStats[],
  opts: { minSample?: number; topK?: number; minDownRatio?: number } = {},
): PatternStats[] {
  const minSample = opts.minSample ?? 5;
  const topK = opts.topK ?? 10;
  const minDownRatio = opts.minDownRatio ?? 0.30; // 30%+ down-rate is the alert threshold
  return patterns
    .filter(p => p.upCount + p.downCount >= minSample && p.downRatio >= minDownRatio)
    /* Primary sort: highest down-ratio first.
       Secondary: larger sample (more confidence in the signal). */
    .sort((a, b) => b.downRatio - a.downRatio || b.total - a.total)
    .slice(0, topK);
}

/** Group "real" thumbs by question_text so multiple users marking the
 *  same generated question light it up brightly in the candidate list.
 *  Threshold: ≥2 users — single hits are too noisy to add to the bank. */
export function pickRealMatchCandidates(
  rows: FeedbackRow[],
  opts: { minHits?: number; topK?: number } = {},
): RealMatchCandidate[] {
  const minHits = opts.minHits ?? 2;
  const topK = opts.topK ?? 20;
  const groups = new Map<string, RealMatchCandidate>();
  for (const row of rows) {
    if (row.thumbs !== "real") continue;
    /* Normalise the key — case-insensitive, trim — so "Tell me about
       yourself" and "Tell me about yourself." merge into one bucket. */
    const key = row.question_text.trim().toLowerCase().replace(/[.!?]+$/g, "");
    let c = groups.get(key);
    if (!c) {
      c = {
        questionText: row.question_text,
        company: row.company,
        role: row.role,
        focus: row.focus,
        realCount: 0,
        lastSeenAt: row.created_at,
      };
      groups.set(key, c);
    }
    c.realCount += 1;
    if (row.created_at > c.lastSeenAt) c.lastSeenAt = row.created_at;
  }
  return [...groups.values()]
    .filter(c => c.realCount >= minHits)
    /* Sort by real-count first, then recency — newest validated questions
       are most likely still relevant to this quarter's interview formats. */
    .sort((a, b) => b.realCount - a.realCount || b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, topK);
}

/** Top-level entry point — takes raw rows + the analysis window and
 *  returns the full report. `hasFindings` lets the caller skip the
 *  email send entirely on quiet weeks (no need to spam an empty digest). */
export function buildReport(rows: FeedbackRow[], windowDays: number): AggregateReport {
  const patterns = aggregatePatterns(rows);
  const worstPatterns = pickWorstPatterns(patterns);
  const realMatchCandidates = pickRealMatchCandidates(rows);
  return {
    totalRowsAnalysed: rows.length,
    windowDays,
    worstPatterns,
    realMatchCandidates,
    hasFindings: worstPatterns.length > 0 || realMatchCandidates.length > 0,
  };
}

/** Render the report as an HTML email body. Plain inline-styled HTML
 *  for email-client compatibility — no external CSS, no Tailwind. */
export function renderReportHtml(report: AggregateReport): string {
  const { worstPatterns, realMatchCandidates, totalRowsAnalysed, windowDays } = report;
  const headerStyle = "font-family:-apple-system,BlinkMacSystemFont,sans-serif;color:#0E0C08;line-height:1.5;";
  const sectionH = "font-family:Georgia,serif;font-size:18px;font-weight:400;color:#0E0C08;margin:24px 0 8px;";
  const monoSpan = "font-family:'SF Mono',Monaco,monospace;font-size:12px;color:#7B756A;";

  const worstRows = worstPatterns.length === 0
    ? `<p style="color:#7B756A;font-style:italic;">No (company × focus) buckets crossed the 30% down-rate alert threshold this week.</p>`
    : `<table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr style="border-bottom:1px solid rgba(20,17,10,0.10);">
          <th style="text-align:left;padding:8px 4px;color:#7B756A;font-weight:500;">Pattern</th>
          <th style="text-align:right;padding:8px 4px;color:#7B756A;font-weight:500;">Down-rate</th>
          <th style="text-align:right;padding:8px 4px;color:#7B756A;font-weight:500;">Sample</th>
        </tr>
        ${worstPatterns.map(p => `
          <tr style="border-bottom:1px solid rgba(20,17,10,0.05);">
            <td style="padding:8px 4px;">${escapeHtml(p.bucket)}</td>
            <td style="padding:8px 4px;text-align:right;color:#B91C1C;font-family:'SF Mono',Monaco,monospace;">${(p.downRatio * 100).toFixed(0)}%</td>
            <td style="padding:8px 4px;text-align:right;${monoSpan}">${p.upCount + p.downCount}</td>
          </tr>`).join("")}
       </table>`;

  const realRows = realMatchCandidates.length === 0
    ? `<p style="color:#7B756A;font-style:italic;">No questions reached the 2+ "matched my real interview" threshold this week.</p>`
    : realMatchCandidates.map(c => `
        <div style="border:1px solid rgba(180,83,9,0.25);border-radius:8px;padding:10px 14px;margin:8px 0;background:rgba(180,83,9,0.06);">
          <div style="font-size:14px;color:#0E0C08;line-height:1.45;">${escapeHtml(c.questionText)}</div>
          <div style="margin-top:4px;${monoSpan}">${escapeHtml(c.company || "any")} · ${escapeHtml(c.role || "any")} · ${escapeHtml(c.focus || "any")} · ${c.realCount}× confirmed</div>
        </div>`).join("");

  return `<div style="${headerStyle}max-width:640px;margin:0 auto;padding:24px;">
    <h1 style="font-family:Georgia,serif;font-size:22px;font-weight:400;letter-spacing:-0.01em;color:#0E0C08;margin:0;">
      HireStepX <em style="color:#B45309;font-style:italic;">question-feedback</em> digest
    </h1>
    <p style="${monoSpan}margin:4px 0 0;">${totalRowsAnalysed} ratings analysed over the last ${windowDays} days.</p>

    <h2 style="${sectionH}">Worst-performing patterns</h2>
    <p style="font-size:13px;color:#5A554C;margin:0 0 12px;">High down-rate buckets are candidates for a curated-bank refresh, OR signals that the LLM prompt needs a steering instruction for that combination.</p>
    ${worstRows}

    <h2 style="${sectionH}">"Matched my real interview" candidates</h2>
    <p style="font-size:13px;color:#5A554C;margin:0 0 12px;">Questions ≥2 users said matched their actual recent interview. Highest-value additions for the curated bank: review and add to data/interview-question-bank.ts.</p>
    ${realRows}

    <p style="margin-top:32px;font-size:11px;color:#9D9789;border-top:1px solid rgba(20,17,10,0.06);padding-top:16px;">
      Sent by the question-feedback aggregator · cron weekly · skip handling lives in server-handlers/aggregate-question-feedback.ts
    </p>
  </div>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
