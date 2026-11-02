"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmployerHeaderAction } from "@/employer/EmployerShell";
import { useEmployerData, DEFAULT_DASHBOARD_RANGE } from "@/employer/EmployerDataContext";
import { useAuth } from "@/AuthContext";
import { apiFetch } from "@/apiClient";
import { authHeaders } from "@/supabase";
import { ROLE_LABEL, isEmployerRole } from "../../../server-handlers/_employer-team-helpers";
import { emailDomain, isFreeMailDomain } from "../../../server-handlers/_employer-trust";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { EmployerIcon } from "@/employer/_atoms";
import { Card } from "@/components/ui/card";
import { PrimaryLink, PostJobLink, ErrorPanel } from "@/employer/_consoleParts";
import { InlineAlert } from "@/employer/_requirementAtoms";
import {
  DashboardHeader, DashboardFunnel, ActiveJobsCard, RecommendedCandidatesCard,
  UpcomingInterviewsCard, KeyInsightsCard, RecentActivityCard, NextActionCard, DashboardSkeleton,
} from "@/employer/DashboardSections";
import { buildInsights, buildNextAction, buildRecommendedCards, type DashboardRange, type EmployerDashboardData } from "@/employer/dashboardData";
import { defaultCompanyFromEmail, looksLikePlaceholderProfile } from "@/employer/_companyProfileHelpers";
import { deriveOnboardingSteps, hasOpenedProfile, hasProgressedCandidate, type ChecklistStep } from "@/employer/onboardingSteps";
import { useJobRowActions } from "./jobs/_components/useJobRowActions";

/* Flat white surface with a 1px line, the console's one card look. */
const SURFACE = "gap-0 rounded-2xl border border-hx-line bg-white p-6 ring-0";

const ONBOARDING_HIDDEN_KEY = "hirestepx-employer-onboarding-hidden";

/* A Google (or other) sign-in on a free-mail address can't create an employer account: the
   server answers work_email_required. Say so up front instead of after they fill the form. */
function WorkEmailRequired({ email }: { email: string }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto w-full max-w-[560px]">
      <Card className={SURFACE}>
        <div role="alert" className="flex flex-col gap-3 text-foreground">
          <h1 className="m-0 text-2xl font-normal">Employer accounts need a work email</h1>
          <p className="m-0 text-[15px] leading-relaxed text-muted-foreground">
            You are signed in as <strong>{email}</strong>, which is a personal email address. We ask employers to sign up with a company
            email so candidates can trust who is contacting them.
          </p>
          <div>
            <Button
              type="button"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void logout().then(() => router.push("/signup?next=/employer"));
              }}
            >
              {busy ? "Signing out…" : "Sign out and use your work email"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

interface PendingInvite { id: string; companyName: string; role: string; inviterName: string | null }

/* Someone invited by email who signed in without using the link has no company yet. Offer the team
   they were invited to instead of founding a second company that would then block them from joining. */
function PendingInvites({ invites }: { invites: PendingInvite[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async (id: string) => {
    setBusyId(id);
    setError(null);
    const res = await apiFetch<{ ok: boolean; role?: string }>("/api/employer-team-accept", { inviteId: id }, { method: "POST" });
    if (res.ok) {
      const role = res.data?.role;
      window.location.assign(isEmployerRole(role) ? `/employer?joined=${role}` : "/employer");
      return;
    }
    const err = res.errorData as { error?: string } | null;
    setError(err?.error || res.error || "Something went wrong. Please try again.");
    setBusyId(null);
  }, []);

  return (
    <section aria-label="Team invites" className="mx-auto flex w-full max-w-[560px] flex-col gap-3">
      {invites.map((inv) => (
        <Card key={inv.id} className={SURFACE}>
          <div className="flex flex-col gap-3 text-foreground">
            <h2 className="m-0 text-lg font-medium">Join {inv.companyName || "your team"}</h2>
            <p className="m-0 text-[14px] leading-relaxed text-muted-foreground">
              {inv.inviterName ? <><strong className="text-foreground">{inv.inviterName}</strong> invited you</> : "You were invited"}
              {" "}as {isEmployerRole(inv.role) ? ROLE_LABEL[inv.role] : "a teammate"}. Joining gives you access to their jobs and candidates.
            </p>
            <div>
              <Button type="button" disabled={busyId !== null} onClick={() => { void join(inv.id); }}>
                {busyId === inv.id ? "Joining…" : `Join ${inv.companyName || "team"}`}
              </Button>
            </div>
          </div>
        </Card>
      ))}
      {error && <p role="alert" className="m-0 text-[13px] text-destructive">{error}</p>}
    </section>
  );
}

/* There is no company form: a signed-in employer with no company gets one made from what they gave at
   signup (or their work-email domain) and fixes the name in Settings, where a placeholder is nudged.
   Pending invites come first, because founding a company would make them its owner and block the join. */
function CompanyOnboarding() {
  const { user } = useAuth();
  const { submitCompanyProfileResult } = useEmployerData();
  const [invites, setInvites] = useState<PendingInvite[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const freeMail = !!user?.email && isFreeMailDomain(emailDomain(user.email));

  useEffect(() => {
    if (freeMail) return;
    let live = true;
    void (async () => {
      try {
        const res = await fetch("/api/employer-team-accept?mine=1", { headers: await authHeaders() });
        const data = res.ok ? ((await res.json()) as { invites?: PendingInvite[] }) : null;
        if (live) setInvites(data?.invites ?? []);
      } catch {
        if (live) setInvites([]);
      }
    })();
    return () => { live = false; };
  }, [freeMail]);

  useEffect(() => {
    if (freeMail || !user?.email || invites === null || invites.length > 0) return;
    const fallback = defaultCompanyFromEmail(user.email);
    const name = user.pendingCompanyName?.trim() || fallback.companyName;
    const website = user.pendingCompanyWebsite?.trim() || fallback.website;
    let live = true;
    setFailed(false);
    void submitCompanyProfileResult({ companyName: name, website, gstin: "", billingName: "" }).then((res) => {
      if (live && !res.ok) setFailed(true);
    });
    return () => { live = false; };
  }, [freeMail, user?.email, user?.pendingCompanyName, user?.pendingCompanyWebsite, invites, attempt, submitCompanyProfileResult]);

  if (freeMail && user?.email) return <WorkEmailRequired email={user.email} />;
  if (invites && invites.length > 0) return <PendingInvites invites={invites} />;
  if (failed) {
    return (
      <ErrorPanel
        title="We couldn't set up your workspace"
        message="Check your connection and try again. Your details are safe."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  }
  return <DashboardSkeleton withHeader />;
}

/** Stands in for the dashboard until the first job exists, then sits above it until each step is done. */
function OnboardingChecklist({ steps, onDismiss }: { steps: ChecklistStep[]; onDismiss?: () => void }) {
  const doneCount = steps.filter((s) => s.done).length;
  const nextStepIndex = steps.findIndex((s) => !s.done);

  return (
    <section aria-label="Getting started" className="border-b border-hx-line px-7 py-6">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h2 className="m-0 text-[15px] font-semibold text-hx-coal">Getting started</h2>
          <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>
            {doneCount} of {steps.length} done
            {onDismiss && (
              <Button type="button" variant="link" onClick={onDismiss} className="ml-3 h-auto p-0 text-[13px] pointer-coarse:min-h-11">
                Hide
              </Button>
            )}
          </span>
        </div>
        <ol style={{ display: "flex", flexDirection: "column", gap: 4, listStyle: "none", margin: 0, padding: 0 }}>
          {steps.map((step, i) => (
            <li
              key={step.label}
              aria-current={i === nextStepIndex ? "step" : undefined}
              style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 0", borderTop: i > 0 ? `1px solid ${t.line}` : "none" }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center",
                  justifyContent: "center", marginTop: 1,
                  background: step.done ? t.indigo : "transparent",
                  border: step.done ? "none" : `1.5px solid ${t.lineStrong}`,
                  color: step.done ? t.white : t.inkSoft,
                  fontFamily: f.sans, fontSize: 12, fontWeight: 700,
                }}
              >
                {step.done ? <span className="mx-pop mx-check inline-flex"><EmployerIcon.Check /></span> : i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: step.done ? t.inkSoft : t.coal, textDecoration: step.done ? "line-through" : "none" }}>
                  {step.label}
                  {step.done && <span className="sr-only"> (done)</span>}
                </div>
                {i === nextStepIndex && (
                  <>
                    <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, margin: "3px 0 10px", lineHeight: 1.5 }}>{step.body}</p>
                    <PrimaryLink href={step.href}>{step.cta}</PrimaryLink>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
    </section>
  );
}

/* Employer landing after approval. Job-level numbers come from the jobs
   list (EmployerDataContext); pipeline counts, trends, interviews and the
   activity feed come from /api/employer-dashboard. If that call fails the
   sections that only need the jobs list still render, with "n/a" where a
   pipeline figure would be. The shell already renders the <main> landmark. */
function EmployerDashboard() {
  const {
    requirements, requirementsLoading, requirementsError, refreshRequirements,
    companyName, companyWebsite, fetchDashboard, fetchUnlockHistory, limits, suspended,
  } = useEmployerData();
  const [range, setRange] = useState<DashboardRange>(DEFAULT_DASHBOARD_RANGE);
  const [dashboard, setDashboard] = useState<EmployerDashboardData | null>(null);
  const [dashboardState, setDashboardState] = useState<"loading" | "ready" | "failed">("loading");
  const [dashboardNonce, setDashboardNonce] = useState(0);
  // Refreshed on each dashboard load so "quiet for N days" and "interview
  // within 48h" stay current without a ticking clock re-rendering the page.
  const [now, setNow] = useState(() => Date.now());
  const { rowActions, dialogs } = useJobRowActions(dashboard?.jobs);

  useEffect(() => {
    let cancelled = false;
    setDashboardState("loading");
    fetchDashboard(range).then((data) => {
      if (cancelled) return;
      setDashboard(data);
      setNow(Date.now());
      setDashboardState(data ? "ready" : "failed");
    });
    return () => {
      cancelled = true;
    };
  }, [fetchDashboard, range, dashboardNonce]);

  const openRequirements = useMemo(() => requirements.filter((r) => r.status !== "closed"), [requirements]);
  const atJobLimit = openRequirements.length >= limits.openRequirements;
  const statsReady = !requirementsLoading && !requirementsError;
  const recommendedTotal = openRequirements.reduce((sum, r) => sum + r.aiScreening.topMatches, 0);
  const recommendedCards = useMemo(
    () => buildRecommendedCards(openRequirements, dashboard?.recommended ?? null, now),
    [openRequirements, dashboard, now],
  );
  // The search box covers every strong match, not only the 3 cards shown on the page.
  const searchableCandidates = useMemo(
    () => buildRecommendedCards(openRequirements, dashboard?.recommended ?? null, now, 100),
    [openRequirements, dashboard, now],
  );
  const insights = useMemo(
    () => buildInsights(openRequirements, dashboard?.jobs ?? [], now),
    [openRequirements, dashboard, now],
  );
  const canCreate = !suspended && !atJobLimit;
  const refreshing = dashboardState === "loading" && dashboard !== null;
  const nextAction = useMemo(
    () => (dashboard ? buildNextAction(openRequirements, dashboard.upcomingInterviews, dashboard.totals.awaitingReview, now, canCreate, recommendedCards[0] ?? null, dashboard.totals.longestWaiting ?? null) : null),
    [openRequirements, dashboard, now, canCreate, recommendedCards],
  );

  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [checklistHidden, setChecklistHidden] = useState(false);
  // The reminder renders nothing until the stored choice is read, so it never flashes in and then disappears.
  const [prefsRead, setPrefsRead] = useState(false);
  const [openedProfile, setOpenedProfile] = useState(false);
  useEffect(() => {
    try {
      setChecklistHidden(localStorage.getItem(ONBOARDING_HIDDEN_KEY) === "1");
    } catch { /* storage blocked: show the checklist */ }
    setOpenedProfile(hasOpenedProfile());
    setPrefsRead(true);
  }, []);
  const hasJobs = requirements.length > 0;
  useEffect(() => {
    if (!hasJobs) return;
    let cancelled = false;
    void fetchUnlockHistory().then((history) => {
      if (!cancelled) setUnlocked(history ? history.some((p) => !p.refundedAt) : null);
    });
    return () => { cancelled = true; };
  }, [hasJobs, fetchUnlockHistory]);
  const onboardingSteps: ChecklistStep[] = deriveOnboardingSteps({ jobs: requirements, reviewed: hasProgressedCandidate(dashboard, openedProfile), unlocked, profilePlaceholder: looksLikePlaceholderProfile(companyName, companyWebsite) });
  const hideChecklist = () => {
    setChecklistHidden(true);
    try {
      localStorage.setItem(ONBOARDING_HIDDEN_KEY, "1");
    } catch { /* storage blocked: hidden for this visit only */ }
  };
  // Once a job exists the checklist is a reminder above the dashboard, only once everything its
  // steps read has loaded (so the done count and the card never change after it appears) and a
  // step is still open; it can be hidden for good.
  const showSetupReminder = !suspended && statsReady && hasJobs && (unlocked === false || onboardingSteps.some((s) => !s.done)) && unlocked !== null && prefsRead && (dashboard !== null || dashboardState === "failed") && !checklistHidden;
  // The checklist stands in for the dashboard only while there is nothing to
  // show. Once a job exists the real dashboard renders, even if the employer
  // hasn't unlocked a candidate yet.
  const showOnboardingChecklist = !suspended && statsReady && requirements.length === 0;

  return (
    <div style={{ minWidth: 0 }}>
      {canCreate && statsReady && (
        <EmployerHeaderAction>
          <PostJobLink iconOnlyOnPhone />
        </EmployerHeaderAction>
      )}
      <div className="mx-stagger overflow-hidden rounded-2xl border border-hx-line bg-white">
        <DashboardHeader companyName={companyName} range={range} onRangeChange={setRange} jobs={openRequirements} recommended={searchableCandidates} />

        {suspended && (
          <div role="status" className="border-b border-hx-line bg-hx-soft px-7 py-3 text-[14px] text-hx-ink-soft">
            Your account is suspended and read-only.
          </div>
        )}

        {requirementsLoading ? (
          <DashboardSkeleton inline />
        ) : requirementsError ? (
          <ErrorPanel contained={false} title="We couldn't load your jobs" message="Your data is safe. Check your connection and try again." onRetry={() => { void refreshRequirements(); }} />
        ) : showOnboardingChecklist ? (
          <OnboardingChecklist steps={onboardingSteps} />
        ) : (
          <>
            {dashboardState === "failed" && (
              <div className="border-b border-hx-line px-7 py-4"><InlineAlert message="Interview, hiring and activity figures didn't load." onRetry={() => setDashboardNonce((n) => n + 1)} /></div>
            )}
            {showSetupReminder && <OnboardingChecklist steps={onboardingSteps} onDismiss={hideChecklist} />}
            {nextAction && <NextActionCard action={nextAction} />}
            <DashboardFunnel data={dashboard} openJobs={openRequirements} recommendedTotal={recommendedTotal} range={range} busy={refreshing} />
            <div aria-busy={refreshing} className="mx-busy grid grid-cols-1 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
              <div className="min-w-0 divide-y divide-hx-line min-[1100px]:border-r min-[1100px]:border-hx-line">
                {/* People waiting on a decision come before the jobs table; with none waiting, the table leads. */}
                {recommendedCards.length > 0 && <RecommendedCandidatesCard cards={recommendedCards} total={dashboard?.totals.awaitingReview ?? recommendedCards.length} />}
                <ActiveJobsCard jobs={openRequirements} pipeline={dashboard?.jobs ?? null} now={now} rowActions={rowActions} />
                {recommendedCards.length === 0 && <RecommendedCandidatesCard cards={recommendedCards} total={dashboard?.totals.awaitingReview ?? recommendedCards.length} />}
              </div>
              <div className="min-w-0 divide-y divide-hx-line border-t border-hx-line min-[1100px]:border-t-0">
                <UpcomingInterviewsCard items={dashboard?.upcomingInterviews ?? []} />
                <KeyInsightsCard insights={insights} />
                <RecentActivityCard items={dashboard?.activity ?? []} />
              </div>
            </div>
          </>
        )}
      </div>
      {dialogs}
    </div>
  );
}

export default function EmployerHomePage() {
  const { companyStatus, companyStatusLoading, companyStatusError, refreshCompanyStatus } = useEmployerData();

  if (companyStatusLoading) return <DashboardSkeleton withHeader />;
  if (companyStatus === "none" && companyStatusError) {
    return (
      <ErrorPanel
        title="We couldn't load your company"
        message="Check your connection and try again. Your details are safe."
        onRetry={() => { void refreshCompanyStatus(); }}
      />
    );
  }
  if (companyStatus === "none") return <CompanyOnboarding />;
  return <EmployerDashboard />;
}
