"use client";
/* ─── DashboardHome — "Candidates Dashboard" Figma port.
   Flat black/white/gray surface, single-column layout. Real data only —
   every stat is backed by the sessions/account contexts or computed in
   dashboardData.ts; no demo-mode mock sections. Two states: a candidate
   with practice history (core.hasData) and a brand-new candidate (the
   "Getting Started" / "What You'll Unlock" variant), matching the two
   Figma screens exactly.

   ResumeFreshnessStrip and OutcomePrompt are pre-existing, shipped
   features (not part of the Figma) kept intact and surfaced right under
   the header so returning users still see them. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "./AuthContext";
import { useDashboardSessions, useDashboardSubscription, useDashboardUIActions, useDashboardCore } from "./DashboardContext";
import { pickNextMove } from "./nextMove";
import { useDocTitle } from "./useDocTitle";
import { captureClientEvent } from "./posthogClient";
import { tokens as T, fonts as F } from "./auth/_tokens";
import { computeReadinessGap } from "./dashboardData";
import { isAiResume } from "./resumeParser";
import { daysUntilEvent, hasVisitedAnalytics } from "./dashboardHelpers";
import HiringActivityCard from "./HiringActivityCard";
import { authHeaders } from "./supabase";
import { apiFetch } from "./apiClient";
import {
  computeResumeFreshness,
  parseDismissal,
  freshnessBucket,
  RESUME_FRESHNESS_DISMISS_KEY,
} from "./resumeFreshness";
import {
  DashboardHeader,
  StatCardsRow,
  NextMoveCard,
  PracticeActivityCard,
  EvidenceCapabilitiesCard,
  GettingStartedCard,
  UnlockTeaserGrid,
  NoSessionsEmptyState,
} from "./DashboardHomeSections";
import { SessionsTable, toRow, DEFAULT_SORT } from "./SessionsV2";

/* Funnel telemetry — these event names are the contract PostHog
   dashboards query, so they're stable. */
type StartSurface =
  | "next-move-primary"  // Your Next Move / Your First Step primary CTA
  | "recent-empty";      // "Start Your First Session" empty-state CTA

/* ─── Tokens (derived from auth/_tokens — single source of truth).
 * Audit rule: no hex/rgba literals in this file. Only the subset still
 * needed by the preserved ResumeFreshnessStrip / OutcomePrompt. */
const t = {
  white:        T.white,
  coal:         T.coal,
  inkSoft:      T.inkSoft,
  inkMid:       T.inkFaint,
  indigo:       T.indigo,
  indigo100:    T.indigo100,
  success:      T.success,
  success100:   T.success100,
  error:        T.error,
  error100:     T.error100,
  line:         T.line,
  lineStrong:   T.lineStrong,
} as const;

const f = { sans: F.sans } as const;

const ico = (path: React.ReactNode, size = 16) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);
const Icons = {
  clock: ico(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  check: ico(<path d="M20 6 9 17l-5-5" />, 14),
};

function OutlineCta({ children, onClick, size = "md" }: {
  children: React.ReactNode; onClick?: () => void; size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "9px 16px" : "13px 20px";
  return (
    <Button type="button" variant="outline" onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 8,
      padding: pad, borderRadius: 8, minHeight: 44, height: "auto",
      fontFamily: f.sans, fontSize: 14,
    }}>{children}</Button>
  );
}

/* ResumeFreshnessStrip — nudges returning users whose resume is stale.
   Shows at 30 days, dismissable, reappears at 60. Real timestamp only:
   sourced from StoredResume.parsedAt (no fake "N days ago"). All age /
   dismissal math is in src/resumeFreshness.ts; this renders the result. */
function ResumeFreshnessStrip({ parsedAt, onRefresh }: {
  parsedAt: string | null | undefined; onRefresh: () => void;
}) {
  const [nowMs] = useState(() => Date.now());
  const [dismissedAt, setDismissedAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setDismissedAt(window.localStorage.getItem(RESUME_FRESHNESS_DISMISS_KEY));
    } catch { /* private mode / storage disabled → behave as not dismissed */ }
  }, []);

  const fresh = computeResumeFreshness(parsedAt, nowMs, parseDismissal(dismissedAt));
  if (!fresh.show || fresh.days == null) return null;

  const dismiss = () => {
    const blob = JSON.stringify({ parsedAt, bucket: freshnessBucket(fresh.days as number) });
    try { window.localStorage.setItem(RESUME_FRESHNESS_DISMISS_KEY, blob); } catch { /* ignore */ }
    setDismissedAt(blob);
  };

  return (
    <div role="status" style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "14px 16px",
      background: "oklch(0.359 0.135 278.697 / 0.12)", border: `1px solid oklch(0.359 0.135 278.697 / 0.25)`, borderRadius: 10,
    }}>
      <span style={{ color: t.indigo, flexShrink: 0, display: "inline-flex" }} aria-hidden>{Icons.clock}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: 0, lineHeight: 1.3 }}>
          Your resume is {fresh.days} days old.
        </p>
        <p style={{ fontFamily: f.sans, fontSize: 12, color: t.inkSoft, margin: "2px 0 0", lineHeight: 1.45 }}>
          Targets and panels drift. Refresh to keep practice aligned with your latest work.
        </p>
      </div>
      <OutlineCta size="sm" onClick={onRefresh}>Refresh</OutlineCta>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={dismiss}
        aria-label="Dismiss resume freshness reminder"
        style={{ flexShrink: 0, minWidth: 44, minHeight: 44, color: t.inkMid, fontFamily: f.sans, fontSize: 16 }}
      >×</Button>
    </div>
  );
}

/* ─── OutcomePrompt ─────────────────────────────────────────────────────────
   Appears once when the user has sessions older than 30 days and hasn't yet
   reported a job-search outcome. Dismissable; after submit or dismiss it
   stays hidden. Backend: GET/POST /api/user-outcome. */

const OUTCOME_DISMISS_KEY = "hirestepx_outcome_dismissed";

function OutcomePrompt({ firstSessionDate, isCampus }: { firstSessionDate: string | null | undefined; isCampus?: boolean }) {
  const [status, setStatus] = useState<"idle" | "open" | "done" | "error" | "dismissed">("idle");
  const [applied, setApplied] = useState(false);
  const [interviewed, setInterviewed] = useState(false);
  const [offer, setOffer] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [company, setCompany] = useState("");
  const [roleLanded, setRoleLanded] = useState("");
  const [testimonial, setTestimonial] = useState("");
  const [mayShare, setMayShare] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!firstSessionDate) return;
    const daysSinceFirst = (Date.now() - new Date(firstSessionDate).getTime()) / 86400000;
    if (daysSinceFirst < 30) return;
    try {
      if (localStorage.getItem(OUTCOME_DISMISS_KEY)) return;
    } catch { /* private mode */ }

    (async () => {
      try {
        const res = await fetch("/api/user-outcome", { headers: await authHeaders() });
        if (!res.ok) return;
        const data = (await res.json()) as { outcome: Record<string, unknown> | null } | null;
        if (!data?.outcome) setStatus("open");
      } catch { /* best-effort */ }
    })();
  }, [firstSessionDate]);

  const dismiss = () => {
    try { localStorage.setItem(OUTCOME_DISMISS_KEY, "1"); } catch { /* noop */ }
    setStatus("dismissed");
  };

  const submit = async () => {
    setBusy(true);
    const res = await apiFetch("/api/user-outcome", { applied, interviewed, offer, accepted,
      company: company.trim() || undefined, roleLanded: roleLanded.trim() || undefined,
      testimonial: testimonial.trim() || undefined, mayShare });
    setBusy(false);
    setStatus(res.ok ? "done" : "error");
  };

  if (status === "idle" || status === "dismissed") return null;

  if (status === "error") {
    return (
      <div style={{
        padding: "14px 16px", background: t.error100,
        border: `1px solid ${t.error}`, borderRadius: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
      }}>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: 0, lineHeight: 1.4 }}>
          Couldn&apos;t save your result. Please try again.
        </p>
        <Button
          type="button" variant="ghost" size="sm" onClick={() => setStatus("open")}
          style={{ fontFamily: f.sans, fontSize: 12, color: t.indigo, flexShrink: 0 }}
        >Retry</Button>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div style={{
        padding: "14px 16px", background: t.success100,
        border: `1px solid ${t.success}`, borderRadius: 10,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ color: t.success, display: "inline-flex" }} aria-hidden>{Icons.check}</span>
        <p style={{ fontFamily: f.sans, fontSize: 13, color: t.coal, margin: 0, lineHeight: 1.4 }}>
          Thank you for sharing. Your result helps improve HireStepX for everyone.
        </p>
      </div>
    );
  }

  if (status === "open") {
    return (
      <div style={{
        padding: "14px 16px",
        background: t.indigo100, border: `1px solid ${t.indigo}`, borderRadius: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <p style={{ fontFamily: f.sans, fontSize: 13, fontWeight: 600, color: t.coal, margin: 0 }}>
            {isCampus ? "How did your campus placement go?" : "How did your job search go?"}
          </p>
          <Button
            type="button" variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss outcome prompt"
            style={{ color: t.inkMid, fontSize: 16, minWidth: 44, minHeight: 44 }}
          >×</Button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(
            isCampus
              ? [
                  { label: "Applied to placement drives",    value: applied,     set: setApplied },
                  { label: "Cleared aptitude / tech round",  value: interviewed, set: setInterviewed },
                  { label: "Got an offer letter",            value: offer,       set: setOffer },
                  { label: "Joined the company",             value: accepted,    set: setAccepted },
                ]
              : [
                  { label: "Applied for a role", value: applied,     set: setApplied },
                  { label: "Got an interview",   value: interviewed, set: setInterviewed },
                  { label: "Received an offer",  value: offer,       set: setOffer },
                  { label: "Accepted the offer", value: accepted,    set: setAccepted },
                ]
          ).map(({ label, value, set }) => (
            <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
              fontFamily: f.sans, fontSize: 12, color: t.coal, lineHeight: 1.4 }}>
              <input type="checkbox" checked={value} onChange={e => set(e.target.checked)}
                style={{ accentColor: t.indigo, width: 14, height: 14, flexShrink: 0 }} />
              {label}
            </label>
          ))}
        </div>
        {(offer || accepted) && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              type="text" placeholder="Company (optional)" value={company} maxLength={120}
              onChange={e => setCompany(e.target.value)}
              aria-label="Company name"
              style={{ fontFamily: f.sans, fontSize: 12, padding: "6px 10px",
                border: `1px solid ${t.lineStrong}`, borderRadius: 6, background: t.white,
                color: t.coal, width: "100%", boxSizing: "border-box" }}
            />
            <input
              type="text" placeholder="Role landed (optional)" value={roleLanded} maxLength={120}
              onChange={e => setRoleLanded(e.target.value)}
              aria-label="Role landed"
              style={{ fontFamily: f.sans, fontSize: 12, padding: "6px 10px",
                border: `1px solid ${t.lineStrong}`, borderRadius: 6, background: t.white,
                color: t.coal, width: "100%", boxSizing: "border-box" }}
            />
            <textarea
              placeholder="Short testimonial (optional)"
              value={testimonial} maxLength={500}
              onChange={e => setTestimonial(e.target.value)}
              aria-label="Testimonial"
              rows={2}
              style={{ fontFamily: f.sans, fontSize: 12, padding: "6px 10px",
                border: `1px solid ${t.lineStrong}`, borderRadius: 6, background: t.white,
                color: t.coal, width: "100%", resize: "vertical", boxSizing: "border-box" }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
              fontFamily: f.sans, fontSize: 12, color: t.inkSoft }}>
              <input type="checkbox" checked={mayShare} onChange={e => setMayShare(e.target.checked)}
                style={{ accentColor: t.indigo, width: 14, height: 14, flexShrink: 0 }} />
              OK to share anonymously on the site
            </label>
          </div>
        )}
        <Button
          type="button" onClick={submit} disabled={busy}
          style={{
            marginTop: 12, width: "100%", height: "auto", padding: "8px 0",
            fontFamily: f.sans, fontSize: 13,
          }}
        >
          {busy ? "Saving…" : "Share result"}
        </Button>
      </div>
    );
  }

  return null;
}

/* ─── view ─── */
export default function DashboardHome() {
  const { user } = useAuth();
  const router = useRouter();
  useDocTitle("Dashboard");
  const sessions = useDashboardSessions();
  const account = useDashboardCore();
  const { isFree, sessionsRemaining, creditBalance } = useDashboardSubscription();
  const { setShowUpgradeModal } = useDashboardUIActions();

  const displayName = useMemo(() => {
    const name = user?.name?.trim();
    if (name) return name.split(" ")[0];
    const emailLocal = user?.email?.split("@")[0];
    return emailLocal || "there";
  }, [user]);

  /* Read after mount (not during render) so SSR and the client's first
     paint agree — the flag only exists in localStorage, which is undefined
     on the server. */
  const [visitedAnalytics, setVisitedAnalytics] = useState(false);
  useEffect(() => { setVisitedAnalytics(hasVisitedAnalytics(user?.id)); }, [user?.id]);

  const resumeData = user?.resumeData;
  const hasResume = !!resumeData;
  const resumeScore = isAiResume(resumeData) ? resumeData.resumeScore ?? null : null;
  const seniorityLevel = isAiResume(resumeData) ? resumeData.seniorityLevel || null : null;
  const improvementsCount = isAiResume(resumeData) ? (resumeData.improvements?.length ?? 0) : 0;

  const readinessGap = useMemo(
    () => computeReadinessGap(sessions.hasData, sessions.readinessScore, resumeScore).gap,
    [sessions.hasData, sessions.readinessScore, resumeScore],
  );

  const nearestEvent = useMemo(() => {
    const upcoming = sessions.calendarEvents
      .filter((e) => e.status === "upcoming" && daysUntilEvent(e.date, e.time) >= 0)
      .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
    return upcoming[0] ? { date: upcoming[0].date, time: upcoming[0].time } : null;
  }, [sessions.calendarEvents]);

  /* The "Your Next Move" / "Your First Step" card is driven by the real
   * personalization engine: it reads the user's weakest skill, last-session
   * gap flags, and streak to produce a targeted headline + CTA. */
  const totalSessionCount = user?.practiceTimestamps?.length ?? 0;
  const nextMove = useMemo(() => pickNextMove({
    skills: sessions.skills.map((s) => ({ name: s.name, score: s.score })),
    currentStreak: sessions.currentStreak,
    topGaps: sessions.topGaps,
    sessionCount: totalSessionCount,
  }), [sessions.skills, sessions.currentStreak, sessions.topGaps, totalSessionCount]);

  /* When a brand-new user hasn't uploaded a resume yet, the coaching engine
   * has nothing to personalise against — nudge toward the resume instead of
   * a session that would open generic questions. */
  const isFirstTimerWithoutResume = totalSessionCount === 0 && !hasResume;

  const goToInterview = (surface: StartSurface, href: string = "/session/new") => () => {
    captureClientEvent("dashboard_start_clicked", {
      surface,
      hasData: sessions.hasData,
      sessions_count: sessions.recentSessions.length,
      streak: sessions.currentStreak,
      readiness: sessions.readinessScore,
      next_move_focus: nextMove.coachingFocus?.gapCode ?? nextMove.weakestSkillName ?? null,
    });
    router.push(href);
  };
  const goToResume = () => router.push("/resume");
  const goToSessions = () => router.push("/sessions");
  const goToJobs = () => router.push("/jobs");

  /* North-Star coaching input: a click on the "Your Next Move" primary CTA.
     Fires alongside dashboard_start_clicked but carries the coaching context
     (gap code, weakest skill, drill key) so the coaching loop is measurable
     independently of the generic Start funnel. */
  const goToNextMove = () => {
    let drillKey: string | null = null;
    let effectiveHref = nextMove.ctaHref;
    try {
      const parsed = new URL(nextMove.ctaHref, "https://hirestepx.local");
      drillKey = parsed.searchParams.get("drill");
      if (nextMove.coachingSessionFocus === "campus-placement") {
        const lastCampus = sessions.recentSessions.find((s) => s.focus === "campus-placement");
        if (lastCampus?.role) parsed.searchParams.set("role", lastCampus.role);
        if (lastCampus?.company) parsed.searchParams.set("company", lastCampus.company);
        effectiveHref = parsed.pathname + "?" + parsed.searchParams.toString();
      }
    } catch {
      drillKey = null;
    }
    captureClientEvent("coaching:next_move_cta_clicked", {
      gap_code: nextMove.coachingFocus?.gapCode ?? null,
      weakest_skill_name: nextMove.weakestSkillName ?? null,
      drill_key: drillKey,
    });
    goToInterview("next-move-primary", effectiveHref)();
  };

  const nextMoveBlocked = !isFirstTimerWithoutResume && isFree && sessionsRemaining === 0 && creditBalance === 0;
  const nextMoveOnStart = isFirstTimerWithoutResume
    ? goToResume
    : nextMoveBlocked
      ? () => setShowUpgradeModal(true)
      : goToNextMove;
  const nextMoveCtaLabel = isFirstTimerWithoutResume
    ? "Upload Resume"
    : nextMoveBlocked
      ? "Get More Sessions"
      : nextMove.ctaLabel;

  const openSession = (id: string, surface: string) => {
    const s = sessions.recentSessions.find((r) => r.id === id);
    captureClientEvent("dashboard_session_clicked", {
      session_id: id,
      score: s?.score,
      type: s?.type,
      surface,
    });
    router.push(`/session/${id}`);
  };

  /* Fire dashboard_loaded exactly once per mount, after the first paint
     that has real data attached. */
  const loadedFiredRef = useRef(false);
  useEffect(() => {
    if (loadedFiredRef.current) return;
    if (sessions.sessionsLoading) return;
    loadedFiredRef.current = true;
    captureClientEvent("dashboard_loaded", {
      hasData: sessions.hasData,
      sessions_count: sessions.recentSessions.length,
      streak: sessions.currentStreak,
      readiness: sessions.readinessScore,
      tier: user?.subscriptionTier ?? "unknown",
    });
  }, [
    sessions.sessionsLoading, sessions.hasData, sessions.recentSessions.length,
    sessions.currentStreak, sessions.readinessScore, user?.subscriptionTier,
  ]);

  return (
    <div
      style={{
        minHeight: "100%", flexShrink: 0, fontFamily: f.sans, color: t.coal,
        background: t.white, border: `1px solid ${t.line}`, borderRadius: 16,
        display: "flex", flexDirection: "column", gap: 16, padding: 16,
        margin: "0 0 64px",
      }}
    >
      <DashboardHeader
        displayName={displayName}
        hasData={sessions.hasData}
        targetRole={user?.targetRole || ""}
        seniorityLevel={seniorityLevel}
        readinessGap={readinessGap}
        nearestEvent={nearestEvent}
        hasGoogleToken={account.hasGoogleToken}
        googleSyncStatus={account.googleSyncStatus}
        onConnectCalendar={() => router.push("/calendar")}
      />

      <ResumeFreshnessStrip parsedAt={resumeData?.parsedAt} onRefresh={goToResume} />
      <OutcomePrompt
        firstSessionDate={user?.practiceTimestamps?.[0]}
        isCampus={sessions.recentSessions.some((s) => s.focus === "campus-placement")}
      />

      <StatCardsRow
        hasData={sessions.hasData}
        readinessScore={sessions.readinessScore}
        readinessDelta={sessions.readinessDelta}
        resumeScore={resumeScore}
        improvementsCount={improvementsCount}
        practiceCoverage={sessions.practiceCoverage}
        totalSessions={sessions.overallStats.sessionsCompleted}
        onViewResume={goToResume}
        onViewJobs={goToJobs}
      />


      {sessions.sessionsLoading ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16 }}>
          <Skeleton style={{ flex: "3 1 420px", minWidth: 280, height: 220, borderRadius: 12 }} />
          <Skeleton style={{ flex: "2 1 280px", minWidth: 260, height: 220, borderRadius: 12 }} />
        </div>
      ) : sessions.hasData ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: "3 1 420px", minWidth: 280 }}>
            <NextMoveCard
              isFirstTimer={!sessions.hasData}
              ctaLabel={nextMoveCtaLabel}
              onStart={nextMoveOnStart}
              sessionMinutes={nextMove.sessionMinutes}
              sessionQuestionCount={nextMove.sessionQuestionCount}
              chips={nextMove.chips}
              headline={nextMove.headline}
            />
          </div>
          <div style={{ flex: "2 1 280px", minWidth: 260 }}>
            <PracticeActivityCard
              sessionsCompleted={sessions.overallStats.sessionsCompleted}
              hoursLogged={sessions.overallStats.hoursLogged}
              questionsAnswered={sessions.overallStats.questionsAnswered}
            />
          </div>
        </div>
      ) : (
        <NextMoveCard
          isFirstTimer={!sessions.hasData}
          ctaLabel={nextMoveCtaLabel}
          onStart={nextMoveOnStart}
          sessionMinutes={nextMove.sessionMinutes}
          sessionQuestionCount={nextMove.sessionQuestionCount}
          chips={nextMove.chips}
          headline={nextMove.headline}
        />
      )}

      {sessions.sessionsLoading ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16 }}>
          <Skeleton style={{ flex: "3 1 420px", minWidth: 280, height: 180, borderRadius: 12 }} />
          <Skeleton style={{ flex: "2 1 280px", minWidth: 260, height: 180, borderRadius: 12 }} />
        </div>
      ) : sessions.hasData ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: "3 1 420px", minWidth: 280 }}>
            <HiringActivityCard />
          </div>
          <div style={{ flex: "2 1 280px", minWidth: 260 }}>
            <EvidenceCapabilitiesCard capabilities={sessions.evidenceCapabilities} />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16 }}>
          <div style={{ flex: "2 1 320px", minWidth: 280 }}>
            <GettingStartedCard
              hasResume={hasResume}
              hasTargetRole={!!user?.targetRole}
              hasFirstSession={sessions.hasData}
              hasVisitedAnalytics={visitedAnalytics}
            />
          </div>
          <div style={{ flex: "3 1 380px", minWidth: 280 }}>
            <UnlockTeaserGrid />
          </div>
        </div>
      )}

      <section aria-labelledby="dh-recent-heading">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
          <h2 id="dh-recent-heading" style={{ fontFamily: f.sans, fontSize: 22, fontWeight: 700, color: t.coal, margin: 0 }}>
            Recent Sessions
          </h2>
          {sessions.hasData && (
            <Button variant="ghost" onClick={goToSessions} className="hover:bg-transparent hover:underline underline-offset-4" style={{
              fontFamily: f.sans, fontSize: 13, color: t.indigo,
              padding: "10px 14px", minHeight: 44, height: "auto",
            }}>View all →</Button>
          )}
        </div>
        {sessions.sessionsLoading ? (
          <Skeleton style={{ width: "100%", height: 280, borderRadius: 12 }} />
        ) : sessions.hasData ? (
          <div style={{ border: `1px solid ${t.line}`, borderRadius: 12 }}>
            <SessionsTable
              rows={sessions.recentSessions.slice(0, 5).map((d) => toRow(d, Date.now()))}
              sort={DEFAULT_SORT}
              onSortChange={() => {}}
              onClearFilters={() => {}}
              onOpenSession={(id) => openSession(id, "recent-sessions-table")}
              sortable={false}
              hideFooter
            />
          </div>
        ) : (
          <NoSessionsEmptyState onStart={goToInterview("recent-empty")} />
        )}
      </section>
    </div>
  );
}
