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
import { getSessionById } from "./supabase";
import { loadLocalSession, type LocalSession } from "./sessionDetailHelpers";
import type { DashboardSession } from "./dashboardTypes";

// Lazy-load the report so the dashboard route stays slim.
const SessionReport = dynamic(
  () => import("./sessionReport/SessionReport").then((m) => ({ default: m.SessionReport })),
  { ssr: false }
);

/* ─── Loading + not-found shells (cream surface) ─────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#FAF7F0",
        minHeight: "100vh",
        fontFamily: "'Satoshi', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#0E0C08",
        padding: "20px 32px",
      }}
    >
      {children}
    </div>
  );
}

function LoadingScreen() {
  return (
    <Shell>
      <div style={{ maxWidth: 560, margin: "120px auto 0", textAlign: "center" }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "2px solid #EBE5D2",
            borderTopColor: "#312E81",
            margin: "0 auto 24px",
            animation: "ir-spin 800ms linear infinite",
          }}
        />
        <p style={{ fontFamily: "'Instrument Serif', serif", fontSize: 22, color: "#0E0C08", margin: 0, fontWeight: 400 }}>
          Loading your session…
        </p>
      </div>
      <style>{`@keyframes ir-spin { to { transform: rotate(360deg); } }`}</style>
    </Shell>
  );
}

function LoadErrorScreen({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack: () => void }) {
  return (
    <Shell>
      <div style={{ maxWidth: 560, margin: "120px auto 0", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: "#0E0C08", margin: "0 0 12px", fontWeight: 400 }}>
          Couldn&apos;t load this session
        </h1>
        <p style={{ fontSize: 14, color: "#6E6759", margin: "0 0 8px", lineHeight: 1.55 }}>
          Something went wrong fetching your report. This is usually temporary.
        </p>
        <p style={{ fontSize: 12, color: "#988E7E", margin: "0 0 24px", fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>
          {message}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: "#312E81", color: "#FAF7F0", border: "none",
              padding: "10px 20px", borderRadius: 10, fontWeight: 600,
              fontSize: 13, cursor: "pointer",
            }}
          >
            Try again
          </button>
          <button
            type="button"
            onClick={onBack}
            style={{
              background: "transparent", color: "#312E81", border: "1px solid #312E81",
              padding: "10px 20px", borderRadius: 10, fontWeight: 600,
              fontSize: 13, cursor: "pointer",
            }}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </Shell>
  );
}

function NotFoundScreen({ onBack }: { onBack: () => void }) {
  return (
    <Shell>
      <div style={{ maxWidth: 560, margin: "120px auto 0", textAlign: "center" }}>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: "#0E0C08", margin: "0 0 12px", fontWeight: 400 }}>
          Session not found
        </h1>
        <p style={{ fontSize: 14, color: "#6E6759", margin: "0 0 24px", lineHeight: 1.55 }}>
          We couldn&apos;t locate this session. It may have been deleted or hasn&apos;t synced yet.
        </p>
        <button
          type="button"
          onClick={onBack}
          style={{
            background: "#312E81",
            color: "#FAF7F0",
            border: "none",
            padding: "10px 20px",
            borderRadius: 10,
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Back to Dashboard
        </button>
      </div>
    </Shell>
  );
}

/* ─── LocalSession → DashboardSession adapter ────────────────────── */

function localSessionToDashboardSession(local: LocalSession): DashboardSession {
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
    role: local.focus || "Candidate",
    score: local.score ?? 0,
    change: 0, // not surfaced from local-only sessions; report's recent-scores fetch fills the trend
    duration,
    difficulty: local.difficulty,
    company: undefined,
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
  }, [id, user?.id]);

  const dashboardSession = useMemo(
    () => (session ? localSessionToDashboardSession(session) : null),
    [session]
  );

  /* Referrer-aware back: if the user arrived from /sessions, send them
     back there with a matching label; otherwise default to /dashboard.
     document.referrer is read once at mount — clicking around inside the
     report shouldn't change the meaning of "back". */
  const [backTarget] = useState<{ href: string; label: string }>(() => {
    if (typeof document === "undefined") return { href: "/dashboard", label: "Back to Dashboard" };
    try {
      const ref = new URL(document.referrer);
      if (ref.origin === window.location.origin && ref.pathname.startsWith("/sessions")) {
        return { href: "/sessions", label: "Back to Sessions" };
      }
    } catch { /* invalid or empty referrer — fall through to default */ }
    return { href: "/dashboard", label: "Back to Dashboard" };
  });
  const onBack = () => router.push(backTarget.href);

  if (loading) return <LoadingScreen />;
  if (loadError) return <LoadErrorScreen message={loadError} onRetry={() => { setLoadError(null); setLoading(true); /* trigger effect */ }} onBack={onBack} />;
  if (!dashboardSession) return <NotFoundScreen onBack={onBack} />;

  return <SessionReport session={dashboardSession} onBack={onBack} backLabel={backTarget.label} />;
}
