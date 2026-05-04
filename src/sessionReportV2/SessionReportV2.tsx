/* Session Report V2 — production entry component.
   Owns the LLM evaluation pipeline (loading / error / abort / retry),
   recent-score + cohort fetches, share-link wiring, PDF print hook,
   and analytics. Delegates all rendering to `SessionReportV2View` —
   the pure presentation port of the canvas design.

   Mirrors the contract of the legacy `SessionReportView`:
     props: { session, onBack }
     side-effects: evaluateSessionWithAI(), fetchRecentSessionScores(),
                   fetchLiveCohort(), POST /api/share-report, window.print()

   Loaded via `next/dynamic` from `dashboardComponents.tsx` behind the
   NEXT_PUBLIC_REPORT_V2 flag, so the legacy view still ships in
   bundles where the flag is off. */

"use client";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { track } from "@vercel/analytics";
import {
  evaluateSessionWithAI,
  fetchRecentSessionScores,
  saveStoryToNotebook,
  type SessionReport,
  type SessionTrendPoint,
} from "../dashboardData";
import {
  fetchLiveCohort,
  type LiveCohort,
  type RoleFamily,
} from "../roleBenchmarks";
import type { DashboardSession } from "../dashboardTypes";
import { useAuth } from "../AuthContext";
import SessionReportV2View from "./SessionReportV2View";
import { sessionReportToInterviewResult } from "./adapter";
import { t, f } from "./tokens";

/* ─── Helpers — duplicated from legacy view to keep V2 self-contained.
   Keeping these here (vs importing from SessionReportView.tsx) lets the
   legacy view be deleted in Phase 2 without breaking the V2 entry. */

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

/* ─── Loading + error UIs — match the V2 cream surface ─────────────── */

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

export const SessionReportV2 = memo(function SessionReportV2({
  session,
  onBack,
}: {
  session: DashboardSession;
  onBack: () => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [report, setReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const [trend, setTrend] = useState<SessionTrendPoint[]>([]);
  const [liveCohort, setLiveCohort] = useState<LiveCohort | null>(null);

  const roleFamily: RoleFamily = useMemo(
    () => roleToFamily(session.role),
    [session.role]
  );

  /* ── Evaluate session via LLM ── */
  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    const t0 = Date.now();
    async function load() {
      setLoading(true);
      setErrorMsg("");
      try {
        const meta = {
          role: session.role,
          roleFamily,
          type: session.type,
          targetCompany: user?.targetCompany || null,
          difficulty:
            (session.difficulty as "warmup" | "standard" | "hard") || "standard",
          duration: parseDurationSec(session.duration),
        };
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
            view: "v2",
          });
        }
      } catch (err) {
        if (cancelled || ac.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Failed to generate report";
        setErrorMsg(msg);
        track("report_llm_failed", {
          sessionId: session.id,
          latencyMs: Date.now() - t0,
          error: msg.slice(0, 120),
          view: "v2",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
      ac.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, reloadTick, user?.targetCompany]);

  /* ── Single fire on first successful view ── */
  useEffect(() => {
    if (report) {
      track("report_viewed", {
        sessionId: session.id,
        score: report.overallScore,
        band: report.band,
        view: "v2",
      });
    }
  }, [report, session.id]);

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
    track("report_retry_requested", { sessionId: session.id, view: "v2" });
    setReport(null);
    setErrorMsg("");
    setReloadTick((tk) => tk + 1);
  }, [session.id]);

  const onDownloadPdf = useCallback(() => {
    track("report_pdf_downloaded", { sessionId: session.id, view: "v2" });
    if (typeof window !== "undefined") window.print();
  }, [session.id]);

  const onShare = useCallback(async () => {
    track("report_action_clicked", {
      action: "share",
      sessionId: session.id,
      view: "v2",
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
        "[reportV2] share failed:",
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

  /* ── Routing for action callbacks owned by the view ── */
  const onTryQuestionAgain = useCallback(
    (questionIdx: number) => {
      track("report_action_clicked", {
        action: "try_again",
        sessionId: session.id,
        questionIdx,
        view: "v2",
      });
      // Find the source question on the report (idx in V2 view-model is
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
        view: "v2",
      });
      const slug = skillName.toLowerCase().replace(/\s+/g, "-");
      router.push(`/session/new?type=behavioral&focus=${encodeURIComponent(slug)}`);
    },
    [router, session.id]
  );

  const onSaveTopStory = useCallback(
    async (questionIdxOneBased: number) => {
      // questionIdx in the view is 1-based; report perQuestion is 0-based.
      const q = report?.perQuestion[questionIdxOneBased - 1];
      if (!q) return;
      track("report_action_clicked", {
        action: "save_story",
        sessionId: session.id,
        questionIdx: q.idx,
        view: "v2",
      });
      try {
        // Derive a short title — first 60 chars of the question, trimmed.
        const title = q.question.length > 60 ? `${q.question.slice(0, 60)}…` : q.question;
        await saveStoryToNotebook({
          sessionId: session.id,
          questionIdx: q.idx,
          title,
          question: q.question,
          answerText: q.answerText,
        });
        if (typeof window !== "undefined") {
          window.alert("Saved to your Notebook.");
        }
      } catch (err) {
        console.error("[reportV2] save story failed:", err instanceof Error ? err.message : err);
        if (typeof window !== "undefined") {
          window.alert("Could not save the story. Please try again.");
        }
      }
    },
    [report, session.id]
  );

  const onTrustAnswer = useCallback(
    (value: "yes" | "no") => {
      track("report_trust_poll_submitted", {
        sessionId: session.id,
        fair: value === "yes",
        view: "v2",
      });
    },
    [session.id]
  );

  const onUsefulAnswer = useCallback(
    (value: "yes" | "no") => {
      track("report_usefulness_poll_submitted", {
        sessionId: session.id,
        useful: value === "yes",
        view: "v2",
      });
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
    <SessionReportV2View
      data={viewData}
      onBack={onBack}
      onDownloadPdf={onDownloadPdf}
      onShare={onShare}
      onTryQuestionAgain={onTryQuestionAgain}
      onDrillSkill={onDrillSkill}
      onSaveTopStory={onSaveTopStory}
      onTrustAnswer={onTrustAnswer}
      onUsefulAnswer={onUsefulAnswer}
    />
  );
});
