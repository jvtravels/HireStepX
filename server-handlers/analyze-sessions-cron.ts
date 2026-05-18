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
import { buildFixPlanPrompt, parseFixPlan, type FixPlanInput } from "./_fix-plan-helpers";
import { fetchResumeForAnalyzer } from "./_resume-versioning";
import { freshnessSnapshot } from "./_data-freshness";

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

/* Fetch sessions in the lookback window that need (re-)analysis.
 *
 * Re-analyzes when EITHER:
 *   (a) no insight row exists (first-time pass), OR
 *   (b) the existing insight's analyzer_version is older than the
 *       analyzer's current version for that focus — i.e. analyzer
 *       code was updated and findings need refreshing.
 *
 * Without (b), shipping new flag detections did NOT cause already-
 * analyzed sessions to get re-checked. That was the bug behind
 * "quality check says all-good after admin found problems".
 *
 * Override window: when overrideHours is provided, look back further
 * than the default — used by /api/admin-quality-run-now via the
 * 'force_reanalyze' parameter to clear out stale insights after a
 * deploy.
 */
async function fetchUnanalyzedSessions(overrideHours?: number, forceReanalyze = false): Promise<SessionRowForAnalysis[]> {
  const lookback = overrideHours || LOOKBACK_HOURS;
  const since = new Date(Date.now() - lookback * 3600_000).toISOString();
  const cols = [
    "id", "user_id", "type", "focus", "difficulty",
    "score", "questions", "duration", "transcript",
    "ai_feedback", "skill_scores", "job_description",
    "jd_analysis", "resume_version_id", "created_at",
    "target_role", "target_company",
    "session_insights(session_id,analyzer_version)",
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
  const rows = (await res.json()) as Array<SessionRowForAnalysis & { session_insights?: { session_id: string; analyzer_version: string }[] | null }>;
  return rows
    .filter((r) => {
      const insights = Array.isArray(r.session_insights) ? r.session_insights : [];
      // No insight yet — first pass.
      if (insights.length === 0) return true;
      // Force-reanalyze flag bypasses staleness checks entirely.
      if (forceReanalyze) return true;
      // Re-analyze if the existing insight was written by a stale
      // analyzer version. pickAnalyzer().version is the current code-level
      // version — if the row's stored version differs, code has shipped
      // since and the row's findings are stale.
      const currentVersion = pickAnalyzer(r.type).version;
      const storedVersion = insights[0]?.analyzer_version || "";
      return storedVersion !== currentVersion;
    })
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
  /* Snapshot of the normalized resume facts we passed into the analyzer.
   * Stored so the dashboard can render "we cross-checked your transcript
   * against THIS view of your resume" without re-running the parser, and
   * so future analyzers can deepen the cross-check without another fetch.
   * `null` when no resume was available for this session. */
  resume_snapshot: unknown;
  /* Optional per-focus structured metadata (AnalyzerMeta). Older
   * insight rows predate this column — render defensively. */
  meta: unknown;
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

  /* Tier-data freshness check. Hardcoded constants (college tier
     patterns, company tier classifier, CGPA cutoffs, salary bands)
     all carry a LAST_VERIFIED_AT stamp in `_data-freshness.ts`. Fire
     one event per cron run per stale source so an operator can see
     "salary bands haven't been re-verified in 120 days" without
     having to grep the codebase. Best-effort; no early-return on
     stale data — the analyzer still runs with what it has. */
  for (const f of freshnessSnapshot()) {
    if (f.stale) {
      void captureServerEvent("tier_data_stale", "system", {
        key: f.key,
        verified_on: f.verifiedOn,
        age_days: f.ageDays,
      });
    }
  }

  // Optional admin overrides: ?force_reanalyze=1 bypasses the staleness
  // filter entirely; ?lookback_hours=168 extends the window (default 25h).
  // Used by the admin "Force re-analyze" button after deploys.
  const url = new URL(req.url);
  const forceReanalyze = url.searchParams.get("force_reanalyze") === "1";
  const overrideHoursParam = url.searchParams.get("lookback_hours");
  const overrideHours = overrideHoursParam ? Math.min(Math.max(parseInt(overrideHoursParam, 10) || 0, 1), 720) : undefined;

  const sessions = await fetchUnanalyzedSessions(overrideHours, forceReanalyze);

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
      // Load resume for the analyzer (best-effort — null on any failure).
      // Threading the parsed resume in unlocks cross-checks like "claim
      // doesn't match resume" that pure-transcript analysis can't do.
      const resume = session.resume_version_id
        ? await fetchResumeForAnalyzer(SUPABASE_URL, SUPABASE_SERVICE_KEY, session.resume_version_id)
        : null;
      // If the session referenced a resume_version_id but we got nothing
      // back, the cross-check capability is silently disabled for this
      // analysis — v4.2/v4.3 resume_* flags can never fire. Fire telemetry
      // so the rate is visible (deleted-version is a legitimate cause; a
      // sudden spike means the read path broke).
      if (session.resume_version_id && !resume) {
        void captureServerEvent("analyzer_resume_fetch_miss", session.user_id, {
          session_id: session.id,
          focus: session.type,
          resume_version_id: session.resume_version_id,
          analyzer_version: analyzer.version,
        });
      }
      const result = await analyzer.analyze({ session, resume });

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
        resume_snapshot: resume ?? null,
        meta: result.meta ?? null,
      };
    } catch (e) {
      const errMsg = String((e as Error)?.message || e).slice(0, 500);
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
        error: errMsg,
        duration_ms: Date.now() - turnT0,
        resume_snapshot: null,
        meta: null,
      };
      // Dedicated event so we can alert on analyzer-throw rate without
      // having to filter `session_quality_analyzed` for flags=analyzer_error.
      // Insight row records the error string for forensics; this event
      // gives us a real-time signal in PostHog.
      void captureServerEvent("analyzer_error", session.user_id, {
        session_id: session.id,
        focus: session.type,
        analyzer_version: analyzer.version,
        error_message: errMsg,
      });
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
      // Per-flag fanout. The aggregated `session_quality_analyzed` event
      // above is great for session-level drilldown but useless for "which
      // single flag is firing most often / at what tier / on what company"
      // — exactly the question the Wave-9 credibility-callout audit asked.
      // Splitting one event per flag here lets a PostHog breakdown over
      // `flag` answer it without server-side aggregation. Best-effort,
      // never throws; missing PostHog key early-returns inside captureServerEvent.
      for (const flag of row.flags) {
        void captureServerEvent("analyzer_flag_fired", session.user_id, {
          session_id: session.id,
          focus: session.type,
          flag,
          severity: row.severity,
          analyzer_version: row.analyzer_version,
          target_company: session.target_company || null,
          target_role: session.target_role || null,
        });
      }
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
    void captureServerEvent("analyze_sessions_subtask_failed", "system", {
      subtask: "digest",
      error_message: String((e as Error)?.message || e).slice(0, 500),
    });
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
    void captureServerEvent("analyze_sessions_subtask_failed", "system", {
      subtask: "fix_outcomes",
      error_message: String((e as Error)?.message || e).slice(0, 500),
    });
  }

  // ── Auto-generate fix recommendations ─────────────────────────
  // Same prompt as "Generate fix plan" but runs nightly so admin
  // sees actionable suggestions without clicking. Dedup by
  // (target_file, title) — re-runs increment seen_count.
  let recommendationsWritten = 0;
  try {
    recommendationsWritten = await generateRecommendations();
  } catch (e) {
    console.error(`[analyze-sessions] recommendations pass failed: ${(e as Error).message}`);
    void captureServerEvent("analyze_sessions_subtask_failed", "system", {
      subtask: "recommendations",
      error_message: String((e as Error)?.message || e).slice(0, 500),
    });
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
    void captureServerEvent("analyze_sessions_subtask_failed", "system", {
      subtask: "revision_outcomes",
      error_message: String((e as Error)?.message || e).slice(0, 500),
    });
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
    recommendations_written: recommendationsWritten,
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

/** Generate fix recommendations from current open issues + flagged sessions.
 *  Idempotent — dedupes by (target_file::title) and increments seen_count
 *  rather than creating duplicates on each cron run. */
async function generateRecommendations(): Promise<number> {
  // Pull open insights to feed the same prompt the dashboard uses.
  const insightsRes = await supa(`session_insights?resolution_status=eq.open&order=analyzed_at.desc&limit=120&select=session_id,focus,flags,hallucinations,severity`);
  if (!insightsRes.ok) return 0;
  const insights = (await insightsRes.json()) as Array<{ session_id: string; focus: string; flags: string[] | null; hallucinations: { type?: string; evidence?: string }[] | null; severity: string }>;
  if (insights.length === 0) return 0;

  // Aggregate flags into FixPlanInput.openIssues
  const flagAgg = new Map<string, { flag: string; count: number; severity_high: number; example_evidence: string[] }>();
  for (const r of insights) {
    for (const f of r.flags || []) {
      const a = flagAgg.get(f) || { flag: f, count: 0, severity_high: 0, example_evidence: [] };
      a.count += 1;
      if (r.severity === "high") a.severity_high += 1;
      if (a.example_evidence.length < 3 && Array.isArray(r.hallucinations)) {
        for (const h of r.hallucinations) {
          if (h.evidence) a.example_evidence.push(h.evidence);
          if (a.example_evidence.length >= 3) break;
        }
      }
      flagAgg.set(f, a);
    }
  }
  if (flagAgg.size === 0) return 0;

  const input: FixPlanInput = {
    openIssues: Array.from(flagAgg.values()).sort((a, b) => b.count - a.count).slice(0, 12),
    flaggedSessions: insights.filter((r) => (r.flags || []).length > 0).slice(0, 8).map((r) => ({
      session_id: r.session_id,
      focus: r.focus,
      flags: r.flags || [],
      hallucinations_summary: (r.hallucinations || []).map((h) => `${h.type}: ${(h.evidence || "").slice(0, 100)}`).slice(0, 2),
    })),
    registeredFocuses: registeredFocuses(),
  };

  let llmText = "";
  try {
    const llmRes = await callLLM({ prompt: buildFixPlanPrompt(input), temperature: 0.2, maxTokens: 1200, jsonMode: true }, 25000, {
      endpoint: "auto-recommendations",
    });
    llmText = llmRes.text;
  } catch (e) {
    console.error(`[recommendations] LLM call failed: ${(e as Error).message}`);
    return 0;
  }
  const plan = parseFixPlan(llmText);
  if (plan.items.length === 0) return 0;

  // Map each item to a focus best-guess based on affected_flags
  const focusForFlag = new Map<string, string>();
  for (const r of insights) {
    for (const f of r.flags || []) {
      if (!focusForFlag.has(f)) focusForFlag.set(f, r.focus);
    }
  }

  let written = 0;
  const nowIso = new Date().toISOString();
  for (const item of plan.items.slice(0, 8)) {
    const dedup = `${item.target_file || "_"}::${item.title}`.slice(0, 400).toLowerCase();
    const focusGuess = (item.affected_flags || []).map((f) => focusForFlag.get(f)).find(Boolean) || "";

    const row = {
      dedup_key: dedup,
      priority: item.priority,
      title: item.title,
      target_file: item.target_file || "",
      change_description: item.change,
      rationale: item.rationale,
      affected_flags: item.affected_flags,
      affected_focus: focusGuess,
      file_grounded: item.file_grounded ?? true,
      last_seen_at: nowIso,
    };

    // Upsert by dedup_key. Use Prefer: resolution=merge-duplicates with
    // the unique constraint we declared on dedup_key. PostgREST won't
    // increment seen_count on conflict, so do it manually after.
    const upsertRes = await supa(`quality_recommendations?on_conflict=dedup_key`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([row]),
    });
    if (!upsertRes.ok) continue;

    // Increment seen_count via PATCH (read-modify-write — race-safe enough
    // since this cron runs once daily).
    const idLookup = await supa(`quality_recommendations?dedup_key=eq.${encodeURIComponent(dedup)}&select=id,seen_count`);
    if (idLookup.ok) {
      const arr = (await idLookup.json()) as Array<{ id: string; seen_count: number }>;
      if (arr[0]) {
        await fetch(`${SUPABASE_URL}/rest/v1/quality_recommendations?id=eq.${arr[0].id}`, {
          method: "PATCH",
          headers: { ...authHeaders(), Prefer: "return=minimal" },
          body: JSON.stringify({ seen_count: (arr[0].seen_count || 1) + 1, last_seen_at: nowIso }),
        });
      }
    }
    written += 1;
  }
  return written;
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
