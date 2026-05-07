/* Vercel Cron — Nightly Session Quality Analyzer
 *
 * Pulls completed sessions from the previous 25h that haven't been
 * analyzed yet, dispatches each to its focus-specific analyzer, and
 * writes findings to session_insights. Then aggregates by focus into
 * daily_quality_report so the internal dashboard surfaces drift.
 *
 * Auth: CRON_SECRET in the Authorization header (Vercel sets it
 * automatically for /api/cron/* paths). Manual runs require the same
 * header — no user JWT path.
 *
 * Idempotent: session_insights.session_id is the primary key so
 * re-runs upsert. Safe to invoke twice on the same window.
 *
 * Caps: MAX_SESSIONS_PER_RUN bounds Vercel function time. If a day
 * exceeds the cap, the next run picks up the rest because the filter
 * is "no insight row exists" rather than a date window.
 */

export const config = { runtime: "edge" };

import { pickAnalyzer, registeredFocuses } from "./analyzers/_dispatch";
import type { SessionRowForAnalysis } from "./analyzers/_types";

declare const process: { env: Record<string, string | undefined> };
const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";
const MAX_SESSIONS_PER_RUN = 200;
const LOOKBACK_HOURS = 25;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function authHeaders(): Record<string, string> {
  return {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

async function supa(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers || {}) },
  });
}

/* Fetch sessions completed in the lookback window that don't yet
 * have an insight row. PostgREST left-join via embedded resource +
 * is.null filter avoids a separate SQL function. */
async function fetchUnanalyzedSessions(): Promise<SessionRowForAnalysis[]> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600_000).toISOString();
  const cols = [
    "id", "user_id", "type", "focus", "difficulty",
    "score", "questions", "duration", "transcript",
    "ai_feedback", "skill_scores", "job_description",
    "jd_analysis", "resume_version_id", "created_at",
    "session_insights(session_id)",
  ].join(",");
  const path = `sessions?select=${encodeURIComponent(cols)}` +
    `&created_at=gte.${encodeURIComponent(since)}` +
    `&questions=gt.0` +
    `&order=created_at.asc&limit=${MAX_SESSIONS_PER_RUN}`;
  const res = await supa(path);
  if (!res.ok) {
    console.error(`[analyze-sessions] fetch failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return [];
  }
  const rows = (await res.json()) as Array<SessionRowForAnalysis & { session_insights?: unknown[] | null }>;
  return rows
    .filter((r) => !r.session_insights || (Array.isArray(r.session_insights) && r.session_insights.length === 0))
    .map((r) => {
      // strip the join-only field before passing into the analyzer
      const { session_insights: _omit, ...clean } = r;
      void _omit;
      return clean;
    });
}

interface InsightRow {
  session_id: string;
  user_id: string;
  focus: string;
  analyzer_version: string;
  rescore: number | null;
  score_drift: number | null;
  hallucinations: unknown;
  rubric_gaps: unknown;
  bad_questions: unknown;
  flags: string[];
  coaching_notes: string;
  error: string | null;
  duration_ms: number;
}

async function writeInsights(rows: InsightRow[]): Promise<{ ok: number; failed: number }> {
  if (rows.length === 0) return { ok: 0, failed: 0 };
  const res = await supa(`session_insights?on_conflict=session_id`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error(`[analyze-sessions] insights upsert failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return { ok: 0, failed: rows.length };
  }
  return { ok: rows.length, failed: 0 };
}

interface FocusAggregate {
  day: string;
  focus: string;
  sessions_analyzed: number;
  drift_sum: number;
  drift_count: number;
  hallucination_sessions: number;
  flagged_question_count: number;
  flag_counts: Map<string, number>;
}

async function writeDailyReport(aggs: FocusAggregate[]): Promise<void> {
  if (aggs.length === 0) return;
  const rows = aggs.map((a) => {
    const flags = Array.from(a.flag_counts.entries())
      .map(([flag, count]) => ({ flag, count }))
      .sort((x, y) => y.count - x.count)
      .slice(0, 5);
    return {
      day: a.day,
      focus: a.focus,
      sessions_analyzed: a.sessions_analyzed,
      avg_score_drift: a.drift_count ? a.drift_sum / a.drift_count : 0,
      hallucination_rate: a.sessions_analyzed ? a.hallucination_sessions / a.sessions_analyzed : 0,
      flagged_question_count: a.flagged_question_count,
      top_flags: flags,
      top_weak_signals: [],
    };
  });
  const res = await supa(`daily_quality_report?on_conflict=day,focus`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    console.error(`[analyze-sessions] daily report upsert failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
}

export default async function handler(req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return jsonResponse({ error: "Server misconfigured" }, 503);
  }

  // Vercel sets `Authorization: Bearer <CRON_SECRET>` for /api/cron/*.
  // In dev, allow unauthenticated calls when no secret is configured.
  if (CRON_SECRET) {
    const auth = req.headers.get("authorization") || "";
    if (auth !== `Bearer ${CRON_SECRET}`) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  const t0 = Date.now();
  const sessions = await fetchUnanalyzedSessions();

  const insights: InsightRow[] = [];
  const aggregates = new Map<string, FocusAggregate>();

  for (const session of sessions) {
    const analyzer = pickAnalyzer(session.type);
    const turnT0 = Date.now();
    let row: InsightRow;
    try {
      const result = await analyzer.analyze({ session });
      row = {
        session_id: session.id,
        user_id: session.user_id,
        focus: session.type,
        analyzer_version: analyzer.version,
        rescore: result.rescore,
        score_drift: result.scoreDrift,
        hallucinations: result.hallucinations,
        rubric_gaps: result.rubricGaps,
        bad_questions: result.badQuestions,
        flags: result.flags,
        coaching_notes: result.coachingNotes,
        error: null,
        duration_ms: Date.now() - turnT0,
      };
    } catch (e) {
      row = {
        session_id: session.id,
        user_id: session.user_id,
        focus: session.type,
        analyzer_version: analyzer.version,
        rescore: null,
        score_drift: null,
        hallucinations: [],
        rubric_gaps: [],
        bad_questions: [],
        flags: ["analyzer_error"],
        coaching_notes: "",
        error: String((e as Error)?.message || e).slice(0, 500),
        duration_ms: Date.now() - turnT0,
      };
    }
    insights.push(row);

    // Aggregate by (day, focus) for daily_quality_report.
    const day = (session.created_at || new Date().toISOString()).slice(0, 10);
    const key = `${day}::${session.type}`;
    const agg = aggregates.get(key) || {
      day,
      focus: session.type,
      sessions_analyzed: 0,
      drift_sum: 0,
      drift_count: 0,
      hallucination_sessions: 0,
      flagged_question_count: 0,
      flag_counts: new Map<string, number>(),
    };
    agg.sessions_analyzed += 1;
    if (typeof row.score_drift === "number") {
      agg.drift_sum += row.score_drift;
      agg.drift_count += 1;
    }
    if (Array.isArray(row.hallucinations) && row.hallucinations.length > 0) {
      agg.hallucination_sessions += 1;
    }
    if (Array.isArray(row.bad_questions)) {
      agg.flagged_question_count += row.bad_questions.length;
    }
    for (const flag of row.flags) {
      agg.flag_counts.set(flag, (agg.flag_counts.get(flag) || 0) + 1);
    }
    aggregates.set(key, agg);
  }

  const writeRes = await writeInsights(insights);
  await writeDailyReport(Array.from(aggregates.values()));

  return jsonResponse({
    ok: true,
    scanned: sessions.length,
    written: writeRes.ok,
    failed: writeRes.failed,
    duration_ms: Date.now() - t0,
    registered_focuses: registeredFocuses(),
  });
}
