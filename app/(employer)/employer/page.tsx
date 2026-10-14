"use client";

import { useState, useEffect, useMemo } from "react";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Card as AtomCard, Eyebrow, EmployerIcon } from "@/employer/_atoms";
import { PrimaryLink, PageSkeleton, ErrorPanel, InlineAlert } from "@/employer/_consoleParts";
import CompanyProfileForm from "@/employer/CompanyProfileForm";
import { Card, CardContent } from "@/components/ui/card";
import {
  DashboardHeader, DashboardFunnel, ActiveJobsCard, RecommendedCandidatesCard,
  UpcomingInterviewsCard, KeyInsightsCard, RecentActivityCard, NextActionCard, DashboardSkeleton,
} from "@/employer/DashboardSections";
import { buildInsights, buildNextAction, buildRecommendedCards, type DashboardRange, type EmployerDashboardData } from "@/employer/dashboardData";
import { useJobRowActions } from "./jobs/_components/useJobRowActions";

function CompanyOnboarding() {
  return (
    <div style={{ width: "100%", maxWidth: 560, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <h1 style={{ fontFamily: f.sans, fontSize: "clamp(1.75rem, 4vw, 2.5rem)", fontWeight: 400, letterSpacing: "-0.01em", color: t.coal, margin: "0 0 8px" }}>
          Tell us about your company
        </h1>
        <p style={{ fontFamily: f.sans, fontSize: 15, color: t.inkSoft, margin: 0, lineHeight: 1.6 }}>
          Add your company name and website to start posting roles. You can browse your shortlist right away.
        </p>
      </div>
      <AtomCard>
        <CompanyProfileForm
          idPrefix="onboarding"
          submitLabel="Create company profile"
          busyLabel="Setting up…"
          websiteHelp="Candidates see this on your jobs. Signing in with a work email on this domain raises your limits."
        />
      </AtomCard>

      <section aria-labelledby="onboarding-next" style={{ marginTop: 48 }}>
        <div id="onboarding-next" style={{ textAlign: "center", marginBottom: 20 }}>
          <Eyebrow tone="indigo">What happens next</Eyebrow>
        </div>
        <ol className="grid list-none grid-cols-1 gap-5 p-0 m-0 min-[480px]:grid-cols-2">
          {[
            { icon: <EmployerIcon.Check />, title: "You submit", body: "Company name and website. A logo helps candidates recognize you." },
            { icon: <EmployerIcon.Arrow />, title: "You post roles", body: "Get an AI-matched shortlist, scored on real interview performance." },
          ].map((step) => (
            <li key={step.title} style={{ textAlign: "center" }}>
              <div
                aria-hidden="true"
                style={{
                  width: 36, height: 36, borderRadius: 10, background: t.indigo100, color: t.indigoDeep,
                  display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px",
                }}
              >
                {step.icon}
              </div>
              <div style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 700, color: t.coal, marginBottom: 4 }}>{step.title}</div>
              <div style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.5 }}>{step.body}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

interface ChecklistStep {
  label: string;
  body: string;
  done: boolean;
  href: string;
  cta: string;
}

/** Shown in place of the dashboard until the employer posts a first job. */
function OnboardingChecklist({ steps }: { steps: ChecklistStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const nextStepIndex = steps.findIndex((s) => !s.done);

  return (
    <Card>
      <CardContent>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <h2 style={{ margin: 0 }}><Eyebrow tone="indigo">Getting started</Eyebrow></h2>
          <span style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft }}>{doneCount} of {steps.length} done</span>
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
      </CardContent>
    </Card>
  );
}

/* Employer landing after approval. Job-level numbers come from the jobs
   list (EmployerDataContext); pipeline counts, trends, interviews and the
   activity feed come from /api/employer-dashboard. If that call fails the
   sections that only need the jobs list still render, with "–" where a
   pipeline figure would be. The shell already renders the <main> landmark. */
function EmployerDashboard() {
  const {
    requirements, requirementsLoading, requirementsError, refreshRequirements,
    companyName, fetchDashboard, limits, suspended,
  } = useEmployerData();
  const [range, setRange] = useState<DashboardRange>(30);
  const [dashboard, setDashboard] = useState<EmployerDashboardData | null>(null);
  const [dashboardState, setDashboardState] = useState<"loading" | "ready" | "failed">("loading");
  const [dashboardNonce, setDashboardNonce] = useState(0);
  // Refreshed on each dashboard load so "quiet for N days" and "interview
  // within 48h" stay current without a ticking clock re-rendering the page.
  const [now, setNow] = useState(() => Date.now());
  const { rowActions, dialogs } = useJobRowActions();

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
  const insights = useMemo(
    () => buildInsights(openRequirements, dashboard?.jobs ?? [], now),
    [openRequirements, dashboard, now],
  );
  const canCreate = !suspended && !atJobLimit;
  const nextAction = useMemo(
    () => (dashboard ? buildNextAction(openRequirements, dashboard.upcomingInterviews, dashboard.totals.awaitingReview, now, canCreate) : null),
    [openRequirements, dashboard, now, canCreate],
  );

  const onboardingSteps: ChecklistStep[] = [
    {
      label: "Post your first job",
      body: "Tell us the role, location, and notice-period preference — we'll start matching candidates against it.",
      done: requirements.length > 0,
      href: "/employer/requirements/new",
      cta: "Post a requirement",
    },
    {
      label: "Review your first AI match",
      body: "Once candidates are scored against your requirement, their shortlist shows up on the job's page.",
      done: false,
      href: "/employer/jobs",
      cta: "View your jobs",
    },
    {
      label: "Unlock your first candidate",
      body: "Unlock a candidate's contact details to reach out and move them into your pipeline.",
      done: false,
      href: "/employer/jobs",
      cta: "Review candidates",
    },
  ];
  // The checklist stands in for the dashboard only while there is nothing to
  // show. Once a job exists the real dashboard renders, even if the employer
  // hasn't unlocked a candidate yet.
  const showOnboardingChecklist = !suspended && statsReady && requirements.length === 0;

  return (
    <div className="mx-stagger" style={{ display: "flex", flexDirection: "column", gap: 20, width: "100%", minWidth: 0 }}>
      <DashboardHeader companyName={companyName} range={range} onRangeChange={setRange} jobs={openRequirements} recommended={recommendedCards} />

      {suspended && (
        <div role="status" style={{ padding: "12px 16px", border: `1px solid ${t.line}`, borderRadius: 12, background: t.cream, fontFamily: f.sans, fontSize: 14, color: t.inkSoft }}>
          Your account is suspended and read-only.
        </div>
      )}

      {requirementsLoading ? (
        <DashboardSkeleton />
      ) : requirementsError ? (
        <InlineAlert message="We couldn't load your jobs just now." onRetry={() => { void refreshRequirements(); }} />
      ) : showOnboardingChecklist ? (
        <OnboardingChecklist steps={onboardingSteps} />
      ) : (
        <>
          {dashboardState === "failed" && (
            <InlineAlert message="Interview, hiring and activity figures didn't load." onRetry={() => setDashboardNonce((n) => n + 1)} />
          )}
          {nextAction && <NextActionCard action={nextAction} />}
          <DashboardFunnel data={dashboard} recommendedTotal={recommendedTotal} range={range} />
          <div className="grid grid-cols-1 gap-5 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
            <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
              <ActiveJobsCard jobs={openRequirements} pipeline={dashboard?.jobs ?? null} canCreate={canCreate} now={now} rowActions={rowActions} />
              <RecommendedCandidatesCard cards={recommendedCards} total={dashboard?.totals.awaitingReview ?? recommendedCards.length} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
              <UpcomingInterviewsCard items={dashboard?.upcomingInterviews ?? []} />
              <KeyInsightsCard insights={insights} />
              <RecentActivityCard items={dashboard?.activity ?? []} />
            </div>
          </div>
        </>
      )}
      {dialogs}
    </div>
  );
}

export default function EmployerHomePage() {
  const { companyStatus, companyStatusLoading, companyStatusError, refreshCompanyStatus } = useEmployerData();

  if (companyStatusLoading) return <PageSkeleton label="Loading your company" />;
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
