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
import { llmRescore, isRescoreEnabled } from "./analyzers/_llm-rescore";
import { buildDigestPrompt, parseDigest, computeSeverity, type DigestInput } from "./_digest-helpers";
import { callLLM } from "./_llm";
import { computeOutcome, countFlagInWindow, primaryFlagFor } from "./_fix-outcome-helpers";
import { captureServerEvent } from "./_posthog";

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
  severity: "high" | "medium" | "low";
  error: string | null;
  duration_ms: number;
}

const MAX_RESCORES_PER_RUN = 60;

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
  let rescoreBudget = isRescoreEnabled() ? MAX_RESCORES_PER_RUN : 0;

  // Batch-fetch user feedback for all the sessions we're about to analyze.
  // Drives the blind-spot detector: any non-'helpful' rating on a session
  // the analyzer would otherwise mark clean is a hole worth investigating.
  const feedbackBySession = await fetchFeedbackBySession(sessions.map((s) => s.id));

  for (const session of sessions) {
    const analyzer = pickAnalyzer(session.type);
    const turnT0 = Date.now();
    let row: InsightRow;
    try {
      const result = await analyzer.analyze({ session });

      // Optional LLM rescore — only if budget remains and the focus is supported.
      let rescore: number | null = result.rescore;
      let scoreDrift: number | null = result.scoreDrift;
      if (rescore === null && rescoreBudget > 0) {
        const rs = await llmRescore(session, session.type);
        if (rs) {
          rescore = rs.rescore;
          scoreDrift = rs.rescore - (session.score || 0);
          rescoreBudget -= 1;
          if (rs.evaluator_concerns.length > 0) {
            // Concerns surface in coaching_notes for visibility without bloating schema.
            result.coachingNotes = [result.coachingNotes, `Rescore concerns: ${rs.evaluator_concerns.join("; ")}`].filter(Boolean).join(" — ");
          }
        }
      }

      // Blind-spot detection: user said something was off but the analyzer
      // found nothing. The analyzer is missing this pattern — flag it for
      // human review. 'helpful' ratings don't trigger; only inaccurate /
      // too_harsh / too_generous do.
      const userRating = feedbackBySession.get(session.id);
      if (userRating && userRating !== "helpful" && result.flags.length === 0) {
        result.flags.push("analyzer_blind_spot");
        const note = `User rated this session "${userRating}" but the analyzer found no issues — likely missing pattern in the rubric.`;
        result.coachingNotes = [result.coachingNotes, note].filter(Boolean).join(" — ");
      }

      const hallucinationCount = Array.isArray(result.hallucinations) ? result.hallucinations.length : 0;
      const severity = computeSeverity({
        hallucinationCount,
        scoreDrift,
        flagCount: result.flags.length,
      });

      row = {
        session_id: session.id,
        user_id: session.user_id,
        focus: session.type,
        analyzer_version: analyzer.version,
        rescore,
        score_drift: scoreDrift,
        hallucinations: result.hallucinations,
        rubric_gaps: result.rubricGaps,
        bad_questions: result.badQuestions,
        flags: result.flags,
        coaching_notes: result.coachingNotes,
        severity,
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
        severity: "high",
        error: String((e as Error)?.message || e).slice(0, 500),
        duration_ms: Date.now() - turnT0,
      };
    }
    insights.push(row);

    // Fire a PostHog event per analyzed session for cross-funnel correlation.
    // Best-effort, never throws — telemetry isn't critical-path.
    if (row.flags.length > 0 || (row.hallucinations as unknown[]).length > 0) {
      void captureServerEvent("session_quality_analyzed", session.user_id, {
        session_id: session.id,
        focus: session.type,
        severity: row.severity,
        flag_count: row.flags.length,
        flags_csv: row.flags.join(","),
        hallucination_count: (row.hallucinations as unknown[]).length,
        score_drift: row.score_drift,
        analyzer_version: row.analyzer_version,
      });
    }

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

  // ── Daily AI digest ───────────────────────────────────────────
  // Synthesizes today's data into 4 short paragraphs. Best-effort —
  // a digest failure must not fail the cron.
  let digestStatus: "written" | "skipped" | "failed" = "skipped";
  try {
    const today = new Date().toISOString().slice(0, 10);
    const digestInput = await buildDigestInput(today);
    if (digestInput.totalAnalyzed > 0) {
      const prompt = buildDigestPrompt(digestInput);
      const llmRes = await callLLM({ prompt, temperature: 0.3, maxTokens: 800, jsonMode: true }, 18000, {
        endpoint: "quality-digest",
      });
      const parsed = parseDigest(llmRes.text);
      const digestRow = {
        day: today,
        generated_at: new Date().toISOString(),
        model: llmRes.model,
        fixes_summary: parsed.fixes_summary,
        improvements_summary: parsed.improvements_summary,
        patterns_summary: parsed.patterns_summary,
        recommendations: parsed.recommendations,
        raw_input: digestInput,
        error: null,
      };
      const dRes = await supa(`daily_digests?on_conflict=day`, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([digestRow]),
      });
      digestStatus = dRes.ok ? "written" : "failed";
    }
  } catch (e) {
    console.error(`[analyze-sessions] digest failed: ${(e as Error).message}`);
    digestStatus = "failed";
  }

  // ── Fix-outcome verification ──────────────────────────────────
  // For resolved sessions whose 7-day post-resolution window has now
  // elapsed but where outcome hasn't been computed yet, measure the
  // before/after flag-rate delta. Best-effort.
  let outcomesComputed = 0;
  try {
    outcomesComputed = await computeFixOutcomes();
  } catch (e) {
    console.error(`[analyze-sessions] fix-outcome pass failed: ${(e as Error).message}`);
  }

  // ── Prompt-revision A/B outcomes ──────────────────────────────
  // For each prompt revision deployed >7d ago without an outcome,
  // measure the focus-wide flag-rate before vs after the deployed_at
  // timestamp. Same mechanism as fix_outcome but scoped to the focus.
  let revisionsMeasured = 0;
  try {
    revisionsMeasured = await computeRevisionOutcomes();
  } catch (e) {
    console.error(`[analyze-sessions] revision-outcome pass failed: ${(e as Error).message}`);
  }

  return jsonResponse({
    ok: true,
    scanned: sessions.length,
    written: writeRes.ok,
    failed: writeRes.failed,
    rescore_enabled: isRescoreEnabled(),
    rescore_budget_remaining: rescoreBudget,
    digest: digestStatus,
    fix_outcomes_computed: outcomesComputed,
    revisions_measured: revisionsMeasured,
    duration_ms: Date.now() - t0,
    registered_focuses: registeredFocuses(),
  });
}

/** Pull user feedback rating for a batch of session ids. Returns a map
 *  session_id → rating ('helpful' | 'too_harsh' | 'too_generous' | 'inaccurate'). */
async function fetchFeedbackBySession(sessionIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (sessionIds.length === 0) return out;
  const idsParam = `(${sessionIds.map((id) => `"${id.replace(/"/g, "")}"`).join(",")})`;
  const res = await supa(`feedback?session_id=in.${encodeURIComponent(idsParam)}&select=session_id,rating&order=created_at.desc`);
  if (!res.ok) return out;
  const arr = (await res.json()) as Array<{ session_id: string; rating: string }>;
  for (const row of arr) {
    if (!out.has(row.session_id)) out.set(row.session_id, row.rating);
  }
  return out;
}

/** Walk resolved insights whose post-resolution window has elapsed and
 *  compute before/after flag-rate delta. Writes verdict to fix_outcome.
 *  Returns the number of outcomes computed this run. */
async function computeFixOutcomes(): Promise<number> {
  // Candidates: resolved >= 7 days ago, <= 30 days ago (stop computing eventually),
  // AND fix_outcome IS NULL.
  const upperBoundIso = new Date(Date.now() - 7 * 86400_000).toISOString();
  const lowerBoundIso = new Date(Date.now() - 30 * 86400_000).toISOString();
  const candRes = await supa(`session_insights?resolution_status=eq.resolved&resolved_at=gte.${lowerBoundIso}&resolved_at=lte.${upperBoundIso}&fix_outcome=is.null&select=session_id,focus,flags,resolved_at&limit=50`);
  if (!candRes.ok) return 0;
  const candidates = (await candRes.json()) as Array<{ session_id: string; focus: string; flags: string[] | null; resolved_at: string }>;
  if (candidates.length === 0) return 0;

  // Group candidates by focus so we make one window query per focus.
  const focuses = Array.from(new Set(candidates.map((c) => c.focus)));
  const insightsByFocus = new Map<string, Array<{ flags: string[] | null; analyzed_at: string }>>();
  for (const focus of focuses) {
    // Pull a generous window around the candidates so before/after windows fit.
    const windowStartIso = new Date(Date.now() - 60 * 86400_000).toISOString();
    const wRes = await supa(`session_insights?focus=eq.${encodeURIComponent(focus)}&analyzed_at=gte.${windowStartIso}&select=flags,analyzed_at&limit=2000`);
    if (wRes.ok) {
      insightsByFocus.set(focus, (await wRes.json()) as Array<{ flags: string[] | null; analyzed_at: string }>);
    } else {
      insightsByFocus.set(focus, []);
    }
  }

  let computed = 0;
  for (const cand of candidates) {
    const flag = primaryFlagFor(cand.flags || []);
    if (!flag) continue;
    const focusInsights = insightsByFocus.get(cand.focus) || [];
    const resolvedTs = new Date(cand.resolved_at).getTime();
    const beforeStart = new Date(resolvedTs - 7 * 86400_000).toISOString();
    const beforeEnd = new Date(resolvedTs).toISOString();
    const afterStart = beforeEnd;
    const afterEnd = new Date(resolvedTs + 7 * 86400_000).toISOString();

    const before = countFlagInWindow(focusInsights, flag, beforeStart, beforeEnd);
    const after = countFlagInWindow(focusInsights, flag, afterStart, afterEnd);
    const daysSince = (Date.now() - resolvedTs) / 86400_000;
    const verdict = computeOutcome({ before, after, daysSinceResolution: daysSince });

    const outcome = { ...verdict, primary_flag: flag };
    const url = `${SUPABASE_URL}/rest/v1/session_insights?session_id=eq.${encodeURIComponent(cand.session_id)}`;
    const upd = await fetch(url, {
      method: "PATCH",
      headers: { ...authHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ fix_outcome: outcome }),
    });
    if (upd.ok) computed += 1;
  }
  return computed;
}

/** Pulls the day's data needed by the digest prompt. */
async function buildDigestInput(today: string): Promise<DigestInput> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  // Today's per-focus rollup
  const dailyRes = await supa(`daily_quality_report?day=eq.${today}&select=focus,sessions_analyzed,avg_score_drift,hallucination_rate,top_flags`);
  const dailyArr = dailyRes.ok ? ((await dailyRes.json()) as Array<{ focus: string; sessions_analyzed: number; avg_score_drift: number; hallucination_rate: number; top_flags: { flag: string; count: number }[] | null }>) : [];

  // Resolutions logged today
  const resStartOfDay = `${today}T00:00:00Z`;
  const resRes = await supa(`session_insights?resolved_at=gte.${resStartOfDay}&select=focus,resolution_status&limit=500`);
  const resArr = resRes.ok ? ((await resRes.json()) as Array<{ focus: string; resolution_status: string }>) : [];
  const resGroup = new Map<string, number>();
  for (const r of resArr) {
    const key = `${r.focus}::${r.resolution_status}`;
    resGroup.set(key, (resGroup.get(key) || 0) + 1);
  }

  // Open issue count
  const openCountRes = await supa(`session_insights?resolution_status=eq.open&select=session_id&limit=1`, { headers: { Prefer: "count=exact" } });
  const openRange = openCountRes.headers.get("content-range") || "";
  const openMatch = openRange.match(/\/(\d+)/);
  const totalOpenIssues = openMatch ? parseInt(openMatch[1], 10) : 0;

  // 7d trend per (focus, flag) — pull aggregate data, compute delta vs week avg.
  const weekRes = await supa(`daily_quality_report?day=gte.${sevenDaysAgo}&select=day,focus,top_flags`);
  const weekArr = weekRes.ok ? ((await weekRes.json()) as Array<{ day: string; focus: string; top_flags: { flag: string; count: number }[] | null }>) : [];
  const flagSeries = new Map<string, { today: number; sum: number; days: number }>();
  for (const w of weekArr) {
    for (const f of w.top_flags || []) {
      const key = `${w.focus}::${f.flag}`;
      const s = flagSeries.get(key) || { today: 0, sum: 0, days: 0 };
      if (w.day === today) s.today = f.count;
      else { s.sum += f.count; s.days += 1; }
      flagSeries.set(key, s);
    }
  }
  const weekTrend = Array.from(flagSeries.entries())
    .map(([key, s]) => {
      const [focus, flag] = key.split("::");
      const week_avg = s.days > 0 ? s.sum / s.days : 0;
      return { focus, flag, today_count: s.today, week_avg };
    })
    .filter((t) => t.today_count >= 2 && Math.abs(t.today_count - t.week_avg) >= 1)
    .sort((a, b) => Math.abs(b.today_count - b.week_avg) - Math.abs(a.today_count - a.week_avg));

  return {
    day: today,
    byFocus: dailyArr.map((d) => ({
      focus: d.focus,
      sessions: d.sessions_analyzed,
      avg_drift: d.avg_score_drift,
      hallucination_rate: d.hallucination_rate,
      top_flags: d.top_flags || [],
    })),
    resolutionsToday: Array.from(resGroup.entries()).map(([key, count]) => {
      const [focus, status] = key.split("::");
      return { focus, status, count };
    }),
    recentCommits: [], // populated via git log requires a separate node handler; v1 skips this
    weekTrend,
    totalAnalyzed: dailyArr.reduce((s, d) => s + d.sessions_analyzed, 0),
    totalOpenIssues,
  };
}

/** Measure focus-wide flag-rate for each unmeasured prompt revision >=7d old. */
async function computeRevisionOutcomes(): Promise<number> {
  const upperBoundIso = new Date(Date.now() - 7 * 86400_000).toISOString();
  const lowerBoundIso = new Date(Date.now() - 60 * 86400_000).toISOString();
  const candRes = await supa(`prompt_revisions?deployed_at=gte.${lowerBoundIso}&deployed_at=lte.${upperBoundIso}&outcome=is.null&select=id,focus,deployed_at&limit=20`);
  if (!candRes.ok) return 0;
  const candidates = (await candRes.json()) as Array<{ id: string; focus: string; deployed_at: string }>;
  if (candidates.length === 0) return 0;

  let computed = 0;
  for (const cand of candidates) {
    const deployedTs = new Date(cand.deployed_at).getTime();
    const beforeStart = new Date(deployedTs - 7 * 86400_000).toISOString();
    const afterEnd = new Date(deployedTs + 7 * 86400_000).toISOString();

    // Pull insights for the focus across both windows
    const wRes = await supa(`session_insights?focus=eq.${encodeURIComponent(cand.focus)}&analyzed_at=gte.${beforeStart}&analyzed_at=lte.${afterEnd}&select=flags,analyzed_at&limit=2000`);
    if (!wRes.ok) continue;
    const insights = (await wRes.json()) as Array<{ flags: string[] | null; analyzed_at: string }>;

    // Aggregate flag rate (any-flag) across the focus
    const beforeRows = insights.filter((r) => {
      const ts = new Date(r.analyzed_at).getTime();
      return ts >= deployedTs - 7 * 86400_000 && ts < deployedTs;
    });
    const afterRows = insights.filter((r) => {
      const ts = new Date(r.analyzed_at).getTime();
      return ts >= deployedTs && ts < deployedTs + 7 * 86400_000;
    });
    const beforeTotal = beforeRows.length;
    const beforeFlagged = beforeRows.filter((r) => (r.flags || []).length > 0).length;
    const afterTotal = afterRows.length;
    const afterFlagged = afterRows.filter((r) => (r.flags || []).length > 0).length;

    const daysSince = (Date.now() - deployedTs) / 86400_000;
    const verdict = computeOutcome({
      before: { totalSessions: beforeTotal, flaggedSessions: beforeFlagged },
      after: { totalSessions: afterTotal, flaggedSessions: afterFlagged },
      daysSinceResolution: daysSince,
    });

    const url = `${SUPABASE_URL}/rest/v1/prompt_revisions?id=eq.${encodeURIComponent(cand.id)}`;
    const upd = await fetch(url, {
      method: "PATCH",
      headers: { ...authHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ outcome: verdict }),
    });
    if (upd.ok) computed += 1;
  }
  return computed;
}
