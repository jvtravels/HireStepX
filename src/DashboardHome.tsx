"use client";
/* ─── DashboardHome — same flat system as the employer dashboard: one white
   container, hairline-separated sections, no cards inside it. Real data
   only — every stat is backed by the sessions/account contexts or computed
   in dashboardData.ts; no demo-mode mock sections. Two states: a candidate
   with practice history (core.hasData) and a brand-new candidate (the
   "Getting Started" / "What You'll Unlock" variant).

   ResumeFreshnessStrip and OutcomePrompt are pre-existing, shipped
   features (not part of the Figma) kept intact and surfaced right under
   the header so returning users still see them. */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon, CheckIcon, ClockIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "./AuthContext";
import { useDashboardSessions, useDashboardSubscription, useDashboardUIActions } from "./DashboardContext";
import { pickNextMove } from "./nextMove";
import { useDocTitle } from "./useDocTitle";
import { captureClientEvent } from "./posthogClient";
import { computeReadinessGap } from "./dashboardData";
import { isAiResume } from "./resumeParser";
import { hasVisitedAnalytics } from "./dashboardHelpers";
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
  PANEL,
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

/* Secondary bands share the container's flat look: a tinted strip, no box. */
const BAND = "flex items-center gap-3 bg-hx-soft px-5 py-3 min-[640px]:px-7";

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
    <div role="status" className={BAND}>
      <ClockIcon size={16} aria-hidden="true" className="shrink-0 text-hx-indigo" />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13px] font-semibold leading-snug text-hx-coal">Your resume is {fresh.days} days old.</p>
        <p className="m-0 mt-0.5 text-[12px] leading-normal text-hx-ink-soft">
          Targets and panels drift. Refresh to keep practice aligned with your latest work.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRefresh}>Refresh</Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={dismiss}
        aria-label="Dismiss resume freshness reminder"
        className="shrink-0 text-hx-ink-soft pointer-coarse:size-11"
      >
        <XIcon size={16} aria-hidden="true" />
      </Button>
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
      <div role="alert" className={`${BAND} justify-between`}>
        <p className="m-0 text-[13px] leading-snug text-hx-error-ink">Couldn&apos;t save your result. Please try again.</p>
        <Button type="button" variant="outline" size="sm" onClick={() => setStatus("open")}>Retry</Button>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div role="status" className={BAND}>
        <CheckIcon size={16} aria-hidden="true" className="shrink-0 text-hx-success-ink" />
        <p className="m-0 text-[13px] leading-snug text-hx-coal">
          Thank you for sharing. Your result helps improve HireStepX for everyone.
        </p>
      </div>
    );
  }

  if (status === "open") {
    const options = isCampus
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
        ];
    return (
      <section aria-label="Share your job search result" className="bg-hx-soft px-5 py-4 min-[640px]:px-7">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="m-0 text-[14px] font-semibold text-hx-coal">
            {isCampus ? "How did your campus placement go?" : "How did your job search go?"}
          </p>
          <Button
            type="button" variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss outcome prompt"
            className="text-hx-ink-soft pointer-coarse:size-11"
          >
            <XIcon size={16} aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 min-[640px]:grid-cols-2">
          {options.map(({ label, value, set }) => (
            <label key={label} className="flex cursor-pointer items-center gap-2 text-[13px] leading-snug text-hx-coal">
              <input type="checkbox" checked={value} onChange={e => set(e.target.checked)} className="size-3.5 shrink-0 accent-hx-indigo" />
              {label}
            </label>
          ))}
        </div>
        {(offer || accepted) && (
          <div className="mt-3 flex max-w-[520px] flex-col gap-2">
            <Input
              type="text" placeholder="Company (optional)" value={company} maxLength={120}
              onChange={e => setCompany(e.target.value)}
              aria-label="Company name"
              className="bg-white"
            />
            <Input
              type="text" placeholder="Role landed (optional)" value={roleLanded} maxLength={120}
              onChange={e => setRoleLanded(e.target.value)}
              aria-label="Role landed"
              className="bg-white"
            />
            <Textarea
              placeholder="Short testimonial (optional)"
              value={testimonial} maxLength={500}
              onChange={e => setTestimonial(e.target.value)}
              aria-label="Testimonial"
              rows={2}
              className="resize-y bg-white"
            />
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-hx-ink-soft">
              <input type="checkbox" checked={mayShare} onChange={e => setMayShare(e.target.checked)} className="size-3.5 shrink-0 accent-hx-indigo" />
              OK to share anonymously on the site
            </label>
          </div>
        )}
        <Button type="button" onClick={submit} disabled={busy} className="mt-3">
          {busy ? "Saving…" : "Share result"}
        </Button>
      </section>
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
    <div className="mb-16 min-h-full shrink-0 text-hx-coal">
      <div className="mx-stagger divide-y divide-hx-line overflow-hidden rounded-2xl border border-hx-line bg-white">
        <DashboardHeader
          displayName={displayName}
          hasData={sessions.hasData}
          targetRole={user?.targetRole || ""}
          seniorityLevel={seniorityLevel}
          readinessGap={readinessGap}
        />

        <ResumeFreshnessStrip parsedAt={resumeData?.parsedAt} onRefresh={goToResume} />

        <NextMoveCard
          isFirstTimer={!sessions.hasData}
          ctaLabel={nextMoveCtaLabel}
          onStart={nextMoveOnStart}
          sessionMinutes={nextMove.sessionMinutes}
          sessionQuestionCount={nextMove.sessionQuestionCount}
          chips={nextMove.chips}
          headline={nextMove.headline}
        />

        <StatCardsRow
          loading={sessions.sessionsLoading}
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

        {/* Secondary survey: sits below the primary next-move CTA at every width. */}
        <OutcomePrompt
          firstSessionDate={user?.practiceTimestamps?.[0]}
          isCampus={sessions.recentSessions.some((s) => s.focus === "campus-placement")}
        />

        {sessions.sessionsLoading ? (
          <div className={`${PANEL} flex flex-col gap-3`} aria-hidden="true">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-1 divide-y divide-hx-line min-[900px]:grid-flow-col min-[900px]:auto-cols-fr min-[900px]:divide-x min-[900px]:divide-y-0">
            {sessions.hasData ? (
              <>
                <PracticeActivityCard
                  sessionsCompleted={sessions.overallStats.sessionsCompleted}
                  hoursLogged={sessions.overallStats.hoursLogged}
                  questionsAnswered={sessions.overallStats.questionsAnswered}
                />
                <HiringActivityCard />
                <EvidenceCapabilitiesCard capabilities={sessions.evidenceCapabilities} />
              </>
            ) : (
              <>
                <GettingStartedCard
                  hasResume={hasResume}
                  hasTargetRole={!!user?.targetRole}
                  hasFirstSession={sessions.hasData}
                  hasVisitedAnalytics={visitedAnalytics}
                />
                <UnlockTeaserGrid />
              </>
            )}
          </div>
        )}

        <section aria-labelledby="dh-recent-heading">
          <div className="flex items-baseline justify-between gap-3 px-5 pt-5 min-[640px]:px-7 min-[640px]:pt-6">
            <h2 id="dh-recent-heading" className="m-0 text-[15px] font-semibold text-hx-coal">Recent sessions</h2>
            {sessions.hasData && (
              <Button variant="link" size="sm" onClick={goToSessions} className="text-hx-indigo">
                View all
                <ArrowRightIcon size={14} aria-hidden="true" />
              </Button>
            )}
          </div>
          {sessions.sessionsLoading ? (
            <Skeleton className="mx-5 my-4 h-56 min-[640px]:mx-7" />
          ) : sessions.hasData ? (
            <div className="mt-3 border-t border-hx-line">
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
    </div>
  );
}
