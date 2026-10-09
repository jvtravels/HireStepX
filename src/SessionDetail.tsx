/* SessionDetail — page-level wrapper for /session/[id].
   Loads the session by ID (local-first, then Supabase), maps the
   LocalSession shape onto the DashboardSession contract, and renders
   the unified `SessionReport` view (cream/indigo/copper, ported from
   the Tempo canvas). One source of truth for the results surface — no
   more divergence between the dashboard's session-detail view and the
   post-interview results page. */

"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { track } from "@vercel/analytics";
import { useAuth } from "./AuthContext";
import { useDashboardBreadcrumb } from "./DashboardLayout";
import { getSessionById } from "./supabase";
import { loadLocalSession, type LocalSession } from "./sessionDetailHelpers";
import type { DashboardSession } from "./dashboardTypes";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "./SessionDetailPanels";
import { tokens as T, fonts as F } from "./auth/_tokens";

// Lazy-load the report so the dashboard route stays slim. Its own loading
// fallback is shape-matched (dark report shell, score circle, card grid,
// chart row) rather than the generic LoadingScreen, since this is always
// the same destination layout.
const SessionReport = dynamic(
  () => import("./sessionReport/SessionReport").then((m) => ({ default: m.SessionReport })),
  { ssr: false, loading: () => <LoadingSkeleton /> }
);

/* ─── Loading + not-found shells (cream surface) ─────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        width: "100%",
        fontFamily: F.sans,
        color: T.coal,
      }}
    >
      {children}
    </div>
  );
}

export function LoadErrorScreen({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <Shell>
      <div style={{ maxWidth: 560, margin: "80px auto 0", textAlign: "center" }}>
        <h1 style={{ fontFamily: F.sans, fontSize: 28, color: T.coal, margin: "0 0 12px", fontWeight: 600 }}>
          Couldn&apos;t load this session
        </h1>
        <p style={{ fontSize: 14, color: T.inkSoft, margin: "0 0 8px", lineHeight: 1.55 }}>
          Something went wrong fetching your report. This is usually temporary.
        </p>
        <p style={{ fontSize: 12, color: T.inkFaint, margin: "0 0 24px", fontFamily: F.mono }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <Button type="button" size="lg" onClick={onRetry}>
            Try again
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            style={{ color: T.indigo, borderColor: T.indigo, fontWeight: 600 }}
          >
            Back to Sessions
          </Button>
        </div>
      </div>
    </Shell>
  );
}

export function NotFoundScreen({ onBack }: { onBack: () => void }) {
  return (
    <Shell>
      <div style={{ maxWidth: 560, margin: "80px auto 0", textAlign: "center" }}>
        <h1 style={{ fontFamily: F.sans, fontSize: 28, color: T.coal, margin: "0 0 12px", fontWeight: 600 }}>
          Session not found
        </h1>
        <p style={{ fontSize: 14, color: T.inkSoft, margin: "0 0 24px", lineHeight: 1.55 }}>
          We couldn&apos;t locate this session. It may have been deleted or hasn&apos;t synced yet.
        </p>
        <Button type="button" size="lg" onClick={onBack}>
          Back to Sessions
        </Button>
      </div>
    </Shell>
  );
}

/* ─── LocalSession → DashboardSession adapter ────────────────────── */

export function localSessionToDashboardSession(local: LocalSession): DashboardSession {
  const dateObj = new Date(local.date);
  const dateLabel = dateObj.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const minutes = Math.floor(local.duration / 60);
  const seconds = Math.round(local.duration % 60);
  const duration = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;

  return {
    id: local.id,
    date: local.date,
    dateLabel,
    type: local.type,
    // Prefer the persisted target role over `focus`. `focus` is "general"
    // when the setup form didn't pass a focus param, which used to collapse
    // the evaluator's roleFamily to the "swe" default — a Senior Product
    // Designer scored against an engineering rubric. See sessionDetailHelpers.
    role: local.targetRole || local.focus || "Candidate",
    score: local.score ?? 0,
    change: 0, // not surfaced from local-only sessions; report's recent-scores fetch fills the trend
    duration,
    difficulty: local.difficulty,
    company: local.targetCompany || undefined,
    focus: local.focus,
    topStrength: local.strengths?.[0] || "",
    topWeakness: local.improvements?.[0] || "",
    feedback: local.ai_feedback || "",
    transcript: (local.transcript || []).map((turn) => ({
      speaker: turn.speaker,
      text: turn.text,
    })),
    // questionScores aren't surfaced here — the SessionReport's LLM
    // pipeline regenerates per-question scoring from the transcript.
    questionScores: [],
    /* Pass the persisted evaluator output through so SessionReport
       can hydrate from cache and skip /api/evaluate-session entirely
       when the row is current. Falls through to a live evaluation
       only when report_json is missing (first view after the
       interview ended) or the version is stale. */
    cachedReport: local.report_json ?? undefined,
    cachedReportVersion: local.report_version ?? undefined,
    /* Kernel-aware negotiation metrics — the report adapter's
       adoptKernelOutcome reads the authoritative offer trajectory,
       candidate ask, and close outcome from here. Dropping it forced the
       adapter onto its transcript-regex heuristic, which rendered a
       cleanly-closed negotiation as "0 of 5 stages / NO COUNTER NAMED". */
    negotiationMetrics: local.negotiationMetrics,
    /* Extract focusMetrics from report_json so buildFocusBanner in the
       adapter gets the real LLM-scored metric values instead of "—".
       report_json is typed as Record<string,unknown>; narrow before use. */
    focusMetrics: (() => {
      const fm = local.report_json?.focusMetrics;
      if (!Array.isArray(fm)) return undefined;
      return fm.filter(
        (m): m is { label: string; value: string; tone: "good" | "watch" | "miss" | "neutral" } =>
          typeof m === "object" && m !== null &&
          typeof (m as Record<string, unknown>).label === "string" &&
          typeof (m as Record<string, unknown>).value === "string",
      );
    })(),
  };
}

/* ─── Page component ──────────────────────────────────────────────── */

export default function SessionDetail() {
  const { id } = useParams() as { id?: string };
  const router = useRouter();
  const { user } = useAuth();
  const [session, setSession] = useState<LocalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Bumped by the retry button to force the load effect to re-run — `id`
  // and `user?.id` don't change on retry, so without this the effect never
  // fires again and setLoading(true) leaves the user stuck on the skeleton.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    // Local-first: instant render when the user has just finished the
    // interview and the session is in localStorage. Falls through to
    // Supabase for cross-device + post-clear access.
    const local = loadLocalSession(id);
    if (local) {
      setSession(local);
      setLoading(false);
      track("session_result_viewed", { score: local.score || 0 });
      return;
    }
    if (user?.id) {
      getSessionById(id, user.id)
        .then((record) => {
          if (record) {
            setSession({
              id: record.id,
              date: record.date,
              type: record.type,
              difficulty: record.difficulty,
              focus: record.focus,
              targetRole: record.target_role || undefined,
              targetCompany: record.target_company || undefined,
              duration: record.duration,
              score: record.score,
              questions: record.questions,
              transcript: record.transcript,
              ai_feedback: record.ai_feedback,
              skill_scores: record.skill_scores,
              /* Persisted evaluator output — hydrated by SessionReport
                 instead of re-running /api/evaluate-session when the
                 row is on the current schema version. */
              report_json: record.report_json ?? null,
              report_version: record.report_version ?? null,
              /* Carry the kernel negotiation metrics through the cross-device
                 / post-clear load path too (mirrors DashboardContext). The
                 column is JSON; narrow to unknown before the typed cast so we
                 avoid an `as unknown as` double-cast. */
              negotiationMetrics:
                (record as { negotiation_metrics?: unknown }).negotiation_metrics as
                  LocalSession["negotiationMetrics"],
            });
            track("session_result_viewed", { score: record.score || 0 });
          }
          setLoading(false);
        })
        .catch((err) => {
          // Surface fetch failures to the user instead of leaving them on a
          // permanent loading spinner. Distinguish from "not found" further
          // down so the user knows whether to retry or it's actually missing.
          console.error("[SessionDetail] failed to load session:", err);
          setLoadError(err instanceof Error ? err.message : "Could not load session");
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [id, user?.id, reloadToken]);

  const dashboardSession = useMemo(
    () => (session ? localSessionToDashboardSession(session) : null),
    [session]
  );

  /* Always return to /sessions — that's the natural parent of a session
     report. We keep the referrer check as a future hook but the default
     is now /sessions, not /dashboard. */
  const [backTarget] = useState<{ href: string; label: string }>(() => {
    return { href: "/sessions", label: "Back to Sessions" };
  });
  const onBack = () => router.push(backTarget.href);

  // Extends the shell's static "Sessions" breadcrumb with the actual
  // interview this report is for, mirroring the employer console's
  // requirement/candidate-detail breadcrumbs (useEmployerBreadcrumb).
  useDashboardBreadcrumb(
    dashboardSession
      ? [{ label: dashboardSession.company ? `${dashboardSession.role} — ${dashboardSession.company}` : dashboardSession.role }]
      : null
  );

  if (loading) return <LoadingSkeleton />;
  if (loadError) return <LoadErrorScreen message={loadError} onRetry={() => { setLoadError(null); setLoading(true); setReloadToken((n) => n + 1); }} onBack={onBack} />;
  if (!dashboardSession) return <NotFoundScreen onBack={onBack} />;

  return <SessionReport session={dashboardSession} onBack={onBack} backLabel={backTarget.label} />;
}
