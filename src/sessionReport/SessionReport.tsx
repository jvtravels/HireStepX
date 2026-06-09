/* Session Report — production entry component.
   Owns the LLM evaluation pipeline (loading / error / abort / retry),
   recent-score + cohort fetches, share-link wiring, PDF print hook,
   and analytics. Delegates all rendering to `SessionReportView` —
   the pure presentation port of the canvas design.

   Contract:
     props: { session, onBack }
     side-effects: evaluateSessionWithAI(), fetchRecentSessionScores(),
                   fetchLiveCohort(), POST /api/share-report, window.print()

   Loaded via `next/dynamic` from `dashboardComponents.tsx`. */

"use client";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import { captureClientEvent } from "../posthogClient";
import {
  evaluateSessionWithAI,
  fetchRecentSessionScores,
  fetchSessionCredibility,
  type SessionReport as SessionReportData,
  type SessionTrendPoint,
} from "../dashboardData";
import { summarizeCredibility, type CredibilitySummary } from "../_credibilityCallout";
import {
  fetchLiveCohort,
  type LiveCohort,
  type RoleFamily,
} from "../roleBenchmarks";
import { CLIENT_REPORT_VERSION, type DashboardSession } from "../dashboardTypes";
import { useAuth } from "../AuthContext";
import SessionReportView from "./SessionReportView";
import { sessionReportToInterviewResult, toBehavioralFullReportData } from "./adapter";
import type { AnalyzerMeta } from "../../server-handlers/analyzers/_types";
import { getInterviewerName } from "../InterviewComponents";
import { t, f } from "./tokens";

/* ─── Helpers — small pure functions for transcript shaping + role-
   family inference + duration parsing. Kept local so the entry stays
   self-contained. */

function roleToFamily(role: string | undefined): RoleFamily {
  const r = (role || "").toLowerCase();
  if (r.includes("pm") || r.includes("product")) return "pm";
  if (r.includes("manager") || r.includes("lead") || r.includes("director")) return "em";
  if (r.includes("data") || r.includes("ml") || r.includes("ai")) return "data";
  if (r.includes("hr") || r.includes("behavior")) return "behavioral";
  return "swe";
}

function toTurns(
  transcript: DashboardSession["transcript"]
): Array<{ role: "interviewer" | "candidate"; text: string }> {
  return (transcript || [])
    .filter((t) => t.text && t.text.trim().length > 0)
    .map((t) => ({
      role: t.speaker === "interviewer" ? "interviewer" : "candidate",
      text: t.text,
    }));
}

function parseDurationSec(s: string | undefined): number {
  if (!s) return 0;
  // Matches "12m 34s", "12 min", "5m", "45s".
  const m = s.match(/(\d+)\s*m/i);
  const ss = s.match(/(\d+)\s*s/i);
  return (m ? parseInt(m[1], 10) * 60 : 0) + (ss ? parseInt(ss[1], 10) : 0);
}

/* ─── Loading + error UIs — cream surface to match the report ──────── */

function LoadingShell({ onBack }: { onBack: () => void }) {
  // Phase-walking copy mirrors the legacy ProgressiveLoadingState — gives
  // the user something to read while the LLM crunches. Plain rotation;
  // we don't need state-machine choreography here.
  const phases = [
    "Reading your transcript…",
    "Scoring your delivery…",
    "Looking for patterns worth practising…",
    "Drafting coach notes…",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setIdx((i) => (i + 1) % phases.length), 2400);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      style={{
        background: t.cream,
        minHeight: "100vh",
        fontFamily: f.sans,
        color: t.coal,
        padding: "20px 32px",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "transparent",
          border: "none",
          fontFamily: f.sans,
          fontSize: 14,
          color: t.coal,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: 0,
          marginBottom: 32,
        }}
      >
        ← Back to Dashboard
      </button>
      <div
        style={{
          maxWidth: 560,
          margin: "120px auto 0",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: `2px solid ${t.line}`,
            borderTopColor: t.indigo,
            margin: "0 auto 24px",
            animation: "ir-spin 800ms linear infinite",
          }}
        />
        <h1 style={{ fontFamily: f.serif, fontSize: 32, color: t.coal, margin: "0 0 12px", fontWeight: 400, letterSpacing: "-0.02em" }}>
          Coaching your report
        </h1>
        <p style={{ fontFamily: f.sans, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.55 }}>
          {phases[idx]}
        </p>
        <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkFaint, margin: "24px 0 0" }}>
          Usually takes 15–30 seconds.
        </p>
      </div>
      <style>{`@keyframes ir-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorShell({
  message,
  onRetry,
  onBack,
}: {
  message: string;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div
      style={{
        background: t.cream,
        minHeight: "100vh",
        fontFamily: f.sans,
        color: t.coal,
        padding: "20px 32px",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "transparent",
          border: "none",
          fontFamily: f.sans,
          fontSize: 14,
          color: t.coal,
          cursor: "pointer",
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: 0,
          marginBottom: 32,
        }}
      >
        ← Back to Dashboard
      </button>
      <div style={{ maxWidth: 560, margin: "120px auto 0", textAlign: "center" }}>
        <h1 style={{ fontFamily: f.serif, fontSize: 28, color: t.coal, margin: "0 0 12px", fontWeight: 400 }}>
          Couldn&apos;t generate your report
        </h1>
        <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: "0 0 24px", lineHeight: 1.55 }}>
          {message}
        </p>
        <button
          type="button"
          onClick={onRetry}
          style={{
            background: t.indigo,
            color: t.cream,
            border: "none",
            padding: "10px 20px",
            borderRadius: 10,
            fontFamily: f.sans,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/* ─── Main entry component ─────────────────────────────────────────── */

export const SessionReport = memo(function SessionReport({
  session,
  onBack,
}: {
  session: DashboardSession;
  onBack: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [report, setReport] = useState<SessionReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [trend, setTrend] = useState<SessionTrendPoint[]>([]);
  const [liveCohort, setLiveCohort] = useState<LiveCohort | null>(null);
  const [credibility, setCredibility] = useState<CredibilitySummary | undefined>(undefined);
  /* Campus-placement: tier-aware CGPA calibration the analyzer used.
   * Stored separately from credibility because this block always shows
   * (when present + focus matches) — it's calibration context, not a
   * BGV-defensibility alert. `undefined` until the insights row is
   * fetched OR when the row predates the `meta` column. */
  const [campusPlacementMeta, setCampusPlacementMeta] = useState<{
    companyTier: string;
    collegeTier: string;
    baseCgpaCutoff: number;
    adjustedCgpaCutoff: number;
    statedCgpa: number | null;
    targetCompany?: string | null;
  } | undefined>(undefined);
  /* Salary-negotiation: tier-aware compensation bucket the analyzer
   * scored against + CTC take-home breakdown for the closing offer.
   * Plumbed in parallel to campusPlacementMeta from the same insights
   * row. `undefined` until fetched OR when the row predates v5
   * (salary-negotiation-v5 ships the meta). */
  const [salaryNegotiationMeta, setSalaryNegotiationMeta] = useState<{
    tierBucket?: string;
    tierBucketLabel?: string;
    closingTotalLpa?: number | null;
    monthlyTakeHomeNewRegimeInr?: number | null;
    monthlyTakeHomeOldRegimeInr?: number | null;
    annualTaxNewRegimeLpa?: number | null;
    annualTaxOldRegimeLpa?: number | null;
    /* Phase 3 of Salary-Negotiation plan (2026-05-18) — sector persona. */
    recruiterPersona?: string;
    recruiterPersonaLabel?: string;
  } | undefined>(undefined);
  /* Behavioral v2: analyzer's `meta.behavioral` blob (starBreakdown,
   * competencyCounts, probing, evidence, delivery, conflict). Fed into
   * `toBehavioralFullReportData()` along with the report + session
   * context to build the diagnostic-first report prop bag. `undefined`
   * until the insights row arrives OR when the analyzer hasn't shipped
   * a behavioral block for this session (non-behavioral focus). */
  const [behavioralMeta, setBehavioralMeta] = useState<
    NonNullable<AnalyzerMeta["behavioral"]> | null | undefined
  >(undefined);
  /* Flags surface from the same insights row — drives the dominant
   * coach-flag pick for the one-habit block. */
  const [behavioralFlags, setBehavioralFlags] = useState<string[]>([]);

  const roleFamily: RoleFamily = useMemo(
    () => roleToFamily(session.role),
    [session.role]
  );

  /* ── Hydrate from persisted report when cached ──
     evaluate-session.ts writes report_json + report_version on the
     first run after each interview. Subsequent views surface those
     fields on the DashboardSession (see SessionDetail mapper); when
     the version matches what this client understands we set the
     report synchronously and skip the /api/evaluate-session network
     call entirely — no LLM, no roundtrip, no retry waterfall.
     A stale version (server has been bumped past this client, or
     pre-mvp-8 rows) falls through to the live-evaluation effect
     below so the user always sees a current-shape report. */
  const cachedReport = session.cachedReport as SessionReportData | undefined;
  const cachedVersion = session.cachedReportVersion;
  const hasCachedReport = Boolean(
    cachedReport && cachedVersion === CLIENT_REPORT_VERSION
  );
  useEffect(() => {
    if (!hasCachedReport || !cachedReport) return;
    setReport(cachedReport);
    setLoading(false);
    setErrorMsg("");
    track("report_cache_hydrated", {
      sessionId: session.id,
      version: cachedVersion ?? "",
    });
    /* reloadTick lets the user force a re-evaluation from the error
       UI; when it ticks past 0 we drop the cache path so the live
       effect below runs. */
  }, [hasCachedReport, cachedReport, session.id, cachedVersion]);

  /* ── Evaluate session via LLM ── */
  useEffect(() => {
    /* Cache wins on first render. Skip the network call entirely
       unless the user explicitly asked for a fresh evaluation
       (reloadTick > 0) from the error UI. */
    if (hasCachedReport && reloadTick === 0) return;
    let cancelled = false;
    const ac = new AbortController();
    const t0 = Date.now();
    /* Auto-retry transient 5xx / overload responses with exponential
       backoff before showing the user an error. The previous behavior
       surfaced the generic "service overloaded" message immediately on
       the first 500 — but Gemini / Groq overload spikes typically clear
       in 2-6 seconds. Three attempts (immediate, +2s, +5s) recover
       silently in 80%+ of cases without ever showing an error UI. */
    async function load() {
      setLoading(true);
      setErrorMsg("");
      /* Voice continuity: re-derive the same interviewer name the engine
         used during the live session (deterministic from type-focus-
         company-userId). Threading this into the report prompt keeps
         exemplar/restructured prose in the same voice the candidate
         heard live — otherwise the rich report sounds like a different
         coach. The persona-trait string acts as a personality tag.
         If the resolved name is empty (no userId yet, etc.) we just
         omit the field — handler treats it as "no voice context". */
      const interviewerSeed = `${session.type || "behavioral"}-${session.focus || "general"}-${user?.targetCompany || ""}-${user?.id || ""}`;
      const liveInterviewerName = (() => {
        try { return getInterviewerName(interviewerSeed); } catch { return undefined; }
      })();
      /* Pull resume facts off the client's stored AI-parsed resume so
         the evaluator can ground its report in the candidate's real
         background. Conservative shape — only the fields the evaluator
         actually uses. Skipped silently if absent. */
      const aiProfile = (user?.resumeData as Record<string, unknown> | undefined)?.aiProfile as {
        topSkills?: string[];
        headline?: string;
        careerTrajectory?: string;
        experiences?: Array<{ topProjects?: string[] }>;
      } | undefined;
      const topProjects = (aiProfile?.experiences || [])
        .flatMap(e => Array.isArray(e?.topProjects) ? e.topProjects : [])
        .filter(p => typeof p === "string" && p.trim().length > 0)
        .slice(0, 5);
      const resumeContext = aiProfile && (
        (aiProfile.topSkills && aiProfile.topSkills.length) ||
        topProjects.length ||
        aiProfile.headline ||
        aiProfile.careerTrajectory
      ) ? {
        topSkills: aiProfile.topSkills,
        topProjects: topProjects.length ? topProjects : undefined,
        headline: aiProfile.headline,
        careerTrajectory: aiProfile.careerTrajectory,
      } : undefined;
      const meta = {
        role: session.role,
        roleFamily,
        type: session.type,
        targetCompany: user?.targetCompany || null,
        difficulty:
          (session.difficulty as "warmup" | "standard" | "hard") || "standard",
        duration: parseDurationSec(session.duration),
        interviewerName: liveInterviewerName,
        resumeContext,
      };

      const isTransient = (raw: string) =>
        /\b(429|500|502|503|504)\b/.test(raw)
        || /overload|currently experiencing|temporarily unavailable|rate.?limit/i.test(raw);

      const delays = [0, 2000, 5000]; // immediate, then 2s, then 5s
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < delays.length; attempt++) {
        if (cancelled || ac.signal.aborted) return;
        if (delays[attempt] > 0) {
          await new Promise(r => setTimeout(r, delays[attempt]));
          if (cancelled || ac.signal.aborted) return;
        }
        try {
          const res = await evaluateSessionWithAI(
            { sessionId: session.id, transcript: toTurns(session.transcript), meta },
            ac.signal
          );
          if (!cancelled && res) {
            setReport(res);
            track("report_llm_completed", {
              sessionId: session.id,
              latencyMs: Date.now() - t0,
              score: res.overallScore,
              band: res.band,
              model: res.model,
              view: "main",
              retries: attempt,
            });
            if (!cancelled) setLoading(false);
            return;
          }
          break;
        } catch (err) {
          if (cancelled || ac.signal.aborted) return;
          lastErr = err;
          const raw = err instanceof Error ? err.message : "Failed to generate report";
          if (!isTransient(raw)) break; // non-transient — fail fast
          // Otherwise loop to next backoff
        }
      }

      // All retries exhausted (or non-transient failure)
      const raw = lastErr instanceof Error ? lastErr.message : "Failed to generate report";
      const looksTransient = isTransient(raw);
      const msg = looksTransient
        ? "Our scoring service is taking longer than usual. Please try again in a moment — your transcript is safe and nothing was lost."
        : raw;
      if (!cancelled) {
        setErrorMsg(msg);
        track("report_llm_failed", {
          sessionId: session.id,
          latencyMs: Date.now() - t0,
          error: msg.slice(0, 120),
          view: "main",
          retries: delays.length,
        });
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, reloadTick, user?.targetCompany, hasCachedReport]);

  /* ── Single fire on first successful view ── */
  useEffect(() => {
    if (report) {
      track("report_viewed", {
        sessionId: session.id,
        score: report.overallScore,
        band: report.band,
        view: "main",
      });
      // Mirror to PostHog for the activation funnel — Vercel Analytics
      // only fires aggregate counters, PostHog feeds the funnel dashboard
      // (signup → first interview → first report viewed).
      captureClientEvent("report_viewed", {
        session_id: session.id,
        score: report.overallScore,
        band: report.band,
        is_first_report: (user?.practiceTimestamps?.length ?? 0) <= 1,
      });
    }
  }, [report, session.id, user?.practiceTimestamps?.length]);

  /* ── Fetch trend + live cohort (best-effort) ── */
  useEffect(() => {
    let cancelled = false;
    fetchRecentSessionScores(10)
      .then((points) => {
        if (!cancelled) setTrend(points);
      })
      .catch(() => {});
    fetchLiveCohort()
      .then((cohort) => {
        if (!cancelled) setLiveCohort(cohort);
      })
      .catch(() => {});
    /* Credibility callout — fetches the session_insights row for this
       session and filters to the BGV-checkable subset. Quiet failure:
       the panel simply doesn't render if the analyzer cron hasn't
       written a row yet, or if the row has no credibility flags. */
    fetchSessionCredibility(session.id)
      .then((row) => {
        if (cancelled) return;
        const summary = summarizeCredibility(row);
        setCredibility(summary);
        /* Behavioral v2 flags — for the dominant coach-flag pick. The
         * row's `flags` is `string[]` (already narrowed by the data
         * layer); copy as-is so the adapter can prioritise them. */
        if (row && Array.isArray(row.flags)) {
          setBehavioralFlags(row.flags);
        }
        if (summary.hasIssues) {
          track("report_credibility_callout_shown", {
            sessionId: session.id,
            count: summary.count,
            flags: summary.items.map((i) => i.flag).join(","),
          });
        }
        /* Pluck campus-placement meta from the same insights row so we
         * don't double-fetch. `meta` is a jsonb blob — narrow with
         * shape checks before trusting any field (analyzer code may
         * ship new fields ahead of frontend coercion). */
        const meta = (row as { meta?: unknown } | null)?.meta;
        if (meta && typeof meta === "object") {
          /* Behavioral v2 — narrow `meta.behavioral` to the analyzer
           * shape. Field-level coercion happens inside the adapter; we
           * only need a shape check + starBreakdown sanity here so a
           * malformed row doesn't poison the diagnostic-first render. */
          const b = (meta as { behavioral?: unknown }).behavioral;
          if (b && typeof b === "object" && Array.isArray((b as { starBreakdown?: unknown }).starBreakdown)) {
            setBehavioralMeta(b as NonNullable<AnalyzerMeta["behavioral"]>);
          } else {
            setBehavioralMeta(null);
          }
          const cp = (meta as { campusPlacement?: unknown }).campusPlacement;
          if (cp && typeof cp === "object") {
            const c = cp as Record<string, unknown>;
            const baseN = typeof c.baseCgpaCutoff === "number" ? c.baseCgpaCutoff : NaN;
            const adjN = typeof c.adjustedCgpaCutoff === "number" ? c.adjustedCgpaCutoff : NaN;
            if (Number.isFinite(baseN) && Number.isFinite(adjN)) {
              setCampusPlacementMeta({
                companyTier: typeof c.companyTier === "string" ? c.companyTier : "unknown",
                collegeTier: typeof c.collegeTier === "string" ? c.collegeTier : "unknown",
                baseCgpaCutoff: baseN,
                adjustedCgpaCutoff: adjN,
                statedCgpa: typeof c.statedCgpa === "number" ? c.statedCgpa : null,
                targetCompany: typeof c.targetCompany === "string" ? c.targetCompany : null,
              });
            }
          }
          /* Salary-negotiation meta — same shape narrowing. Render
           * only when at least the tier band is known, so first-time
           * sessions on services / startup tier still get the header
           * chip even before a closing offer is extracted. */
          const sn = (meta as { salaryNegotiation?: unknown }).salaryNegotiation;
          if (sn && typeof sn === "object") {
            const s = sn as Record<string, unknown>;
            const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
            const strOrUndef = (v: unknown) => (typeof v === "string" ? v : undefined);
            setSalaryNegotiationMeta({
              tierBucket: strOrUndef(s.tierBucket),
              tierBucketLabel: strOrUndef(s.tierBucketLabel),
              closingTotalLpa: numOrNull(s.closingTotalLpa),
              monthlyTakeHomeNewRegimeInr: numOrNull(s.monthlyTakeHomeNewRegimeInr),
              monthlyTakeHomeOldRegimeInr: numOrNull(s.monthlyTakeHomeOldRegimeInr),
              annualTaxNewRegimeLpa: numOrNull(s.annualTaxNewRegimeLpa),
              annualTaxOldRegimeLpa: numOrNull(s.annualTaxOldRegimeLpa),
              /* Phase 3 of Salary-Negotiation plan (2026-05-18) —
                 sector persona forwarded to the header chip. */
              recruiterPersona: strOrUndef(s.recruiterPersona),
              recruiterPersonaLabel: strOrUndef(s.recruiterPersonaLabel),
            });
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  /* ── Derived percentile (used by adapter) ──
     Production cohort data is per-skill (`bucketPercentile(skill, …)`),
     not per-overall-score. Until a server-side aggregate lands, the
     percentile sub-stat in the hero stays unrendered (the canvas
     gracefully omits it when undefined). Keeping the liveCohort fetch
     in flight so SkillBar can opt-in later without re-plumbing. */
  const percentile: number | undefined = undefined;
  void liveCohort;

  /* ── Days-until-interview from auth context ── */
  const daysUntilInterview = useMemo(() => {
    const d = user?.interviewDate;
    if (!d) return undefined;
    const ms = new Date(d).getTime() - Date.now();
    if (Number.isNaN(ms) || ms <= 0) return undefined;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }, [user?.interviewDate]);

  /* ── Recent-scores series for the sparkline ── */
  const recentScores = useMemo(
    () => (trend.length >= 2 ? trend.slice(-6).map((p) => p.score) : undefined),
    [trend]
  );

  /* ── Action handlers ── */
  const onRetry = useCallback(() => {
    track("report_retry_requested", { sessionId: session.id, view: "main" });
    setReport(null);
    setErrorMsg("");
    setReloadTick((tk) => tk + 1);
  }, [session.id]);

  const onDownloadPdf = useCallback(() => {
    track("report_pdf_downloaded", { sessionId: session.id, view: "main" });
    if (typeof window !== "undefined") window.print();
  }, [session.id]);

  const onShare = useCallback(async () => {
    track("report_action_clicked", {
      action: "share",
      sessionId: session.id,
      view: "main",
    });
    try {
      const { apiFetch } = await import("../apiClient");
      const res = await apiFetch<{ url?: string; expiresAt?: string; error?: string }>(
        "/api/share-report?action=create",
        { sessionId: session.id, ttlDays: 14 }
      );
      if (!res.ok || !res.data?.url) {
        const msg = res.error || res.data?.error || "Could not create share link";
        if (typeof window !== "undefined") window.alert(msg);
        return;
      }
      const url = res.data.url;
      const ttl = res.data.expiresAt
        ? new Date(res.data.expiresAt).toLocaleDateString()
        : "in 14 days";
      try {
        await navigator.clipboard.writeText(url);
        if (typeof window !== "undefined") {
          window.alert(
            `Share link copied! Anyone with this link can view your report until ${ttl}.\n\n${url}`
          );
        }
      } catch {
        if (typeof window !== "undefined") {
          window.prompt(`Share link (expires ${ttl}). Copy this URL:`, url);
        }
      }
    } catch (err) {
      console.error(
        "[sessionReport] share failed:",
        err instanceof Error ? err.message : err
      );
      if (typeof window !== "undefined") {
        window.alert("Could not create share link. Please try again.");
      }
    }
  }, [session.id]);

  /* ── Adapter: SessionReport → InterviewResultData ── */
  const viewData = useMemo(() => {
    if (!report) return null;
    return sessionReportToInterviewResult({
      report,
      session,
      recentScores,
      percentile,
      daysUntilInterview,
      targetRole: user?.targetRole || session.role,
      targetCompany: user?.targetCompany || session.company,
      // Bias-detector softening for non-native English speakers. Reads
      // a conventional `nonNativeEnglish` flag off the auth user when
      // present; defaults to false. Safe lookup via `in` so we don't
      // widen the AuthContext user type just for this surface.
      nonNativeEnglish:
        user && typeof user === "object" && "nonNativeEnglish" in user
          ? Boolean((user as Record<string, unknown>).nonNativeEnglish)
          : false,
    });
  }, [
    report,
    session,
    recentScores,
    percentile,
    daysUntilInterview,
    user,
  ]);

  /* ── Behavioral v2 report prop bag ──
     Computed only for behavioral focus + when both report and analyzer
     meta are present. The View itself gates rendering behind the env
     flag `NEXT_PUBLIC_BEHAVIORAL_REPORT_V2`; keeping computation
     unconditional (within the focus gate) keeps the prop deterministic
     so the flag flip is a pure render-path swap. Returns undefined for
     non-behavioral focus so the existing panel stack remains untouched
     for SWE / PM / data / negotiation rounds. */
  const behavioralFullReportData = useMemo(() => {
    if (roleFamily !== "behavioral") return undefined;
    if (!report) return undefined;
    // `behavioralMeta` may be null (insights row had no behavioral block)
    // — adapter handles `null` with a stub starBreakdown so we still get
    // a renderable shell rather than blocking the v2 flag entirely.
    return toBehavioralFullReportData(
      {
        report,
        session,
        recentScores,
        percentile,
        flags: behavioralFlags,
      },
      behavioralMeta ?? null,
    );
  }, [
    roleFamily,
    report,
    session,
    recentScores,
    percentile,
    behavioralMeta,
    behavioralFlags,
  ]);

  /* ── Routing for action callbacks owned by the view ── */
  const onTryQuestionAgain = useCallback(
    (questionIdx: number) => {
      track("report_action_clicked", {
        action: "try_again",
        sessionId: session.id,
        questionIdx,
        view: "main",
      });
      // Find the source question on the report (idx in view-model is
      // 1-based; report is 0-based). Best-effort focus payload — falls
      // through to the generic /session/new when missing.
      const q = report?.perQuestion[questionIdx - 1];
      const focus = q?.question
        ? `&focus=${encodeURIComponent(q.question.slice(0, 80))}`
        : "";
      router.push(`/session/new?type=${encodeURIComponent(session.type)}${focus}`);
    },
    [router, session.id, session.type, report]
  );

  const onDrillSkill = useCallback(
    (skillName: string) => {
      track("report_action_clicked", {
        action: "drill_skill",
        sessionId: session.id,
        skill: skillName,
        view: "main",
      });
      const slug = skillName.toLowerCase().replace(/\s+/g, "-");
      router.push(`/session/new?type=behavioral&focus=${encodeURIComponent(slug)}`);
    },
    [router, session.id]
  );

  const onTrustAnswer = useCallback(
    (value: "yes" | "no") => {
      track("report_trust_poll_submitted", {
        sessionId: session.id,
        fair: value === "yes",
        view: "main",
      });
    },
    [session.id]
  );

  const onUsefulAnswer = useCallback(
    (value: "yes" | "no") => {
      track("report_usefulness_poll_submitted", {
        sessionId: session.id,
        useful: value === "yes",
        view: "main",
      });
    },
    [session.id]
  );

  /* Dispute a credibility-callout flag. Per-flag false-positive
     auditing — the PostHog event powers the dashboard breakdown the
     Wave-9 audit identified as the highest-ROI observability gap.
     Fire-and-forget: the optimistic UI flip in CredibilitySection is
     the source of truth client-side, so we never await this and we
     never surface a failure toast. */
  const onDisputeCredibility = useCallback(
    (flag: string) => {
      track("credibility_flag_disputed", {
        sessionId: session.id,
        flag,
      });
      void (async () => {
        try {
          const { apiFetch } = await import("../apiClient");
          await apiFetch("/api/credibility-dispute", {
            sessionId: session.id,
            flag,
          });
        } catch {
          /* Soft-fail — analytics already captured the user intent. */
        }
      })();
    },
    [session.id]
  );


  /* ── Render gates ── */
  if (loading) return <LoadingShell onBack={onBack} />;
  if (errorMsg && !report) {
    return <ErrorShell message={errorMsg} onRetry={onRetry} onBack={onBack} />;
  }
  if (!viewData) {
    // Defensive — should be unreachable since loading covers null reports.
    return <ErrorShell message="No report available." onRetry={onRetry} onBack={onBack} />;
  }

  return (
    <SessionReportView
      data={viewData}
      onBack={onBack}
      onDownloadPdf={onDownloadPdf}
      onShare={onShare}
      onTryQuestionAgain={onTryQuestionAgain}
      onDrillSkill={onDrillSkill}
      onTrustAnswer={onTrustAnswer}
      onUsefulAnswer={onUsefulAnswer}
      credibility={credibility}
      onDisputeCredibility={onDisputeCredibility}
      campusPlacementMeta={campusPlacementMeta}
      salaryNegotiationMeta={salaryNegotiationMeta}
      behavioralFullReportData={behavioralFullReportData}
    />
  );
});
