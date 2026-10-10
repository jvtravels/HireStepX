"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/AuthContext";
import { useEmployerData } from "@/employer/EmployerDataContext";
import { tokens as t, fonts as f } from "@/auth/_tokens";
import { Card as AtomCard, Eyebrow, OutlineCta, StatCell, EmployerIcon } from "@/employer/_atoms";
import { OutlineLink, PrimaryLink, PageSkeleton, ErrorPanel } from "@/employer/_consoleParts";
import CompanyProfileForm from "@/employer/CompanyProfileForm";
import { Card, CardContent } from "@/components/ui/card";

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

/** Replaces the Overview stat strip while a new employer hasn't yet
 *  completed the activation path (post → see a match → unlock a
 *  candidate) — the moment they've done all three, this stops rendering
 *  for good and EmployerDashboard falls back to the plain stat cells. */
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

/* Employer landing after approval — lightweight overview only. The full
   requirements list lives on /employer/jobs; this screen is the "how's it
   going" glance (greeting, next move, stat strip, company profile rail).
   The shell already renders the <main> landmark, so this is plain content.
   The rail stacks below 900px via Tailwind variants (no JS width hook, so
   there's no layout flash on first paint). */
function EmployerDashboard() {
  const { user } = useAuth();
  const {
    requirements, requirementsLoading, requirementsError, refreshRequirements,
    companyName, companyLogoUrl, fetchUnlockHistory, limits, suspended, verificationTier,
  } = useEmployerData();
  const [unlockCount, setUnlockCount] = useState<number | null>(null);
  const [unlockSettled, setUnlockSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // On failure the count stays null: we can't claim "no unlocks yet", so the
    // checklist is withheld rather than shown with a wrong step 3.
    fetchUnlockHistory().then((purchases) => {
      if (cancelled) return;
      if (purchases) setUnlockCount(purchases.length);
      setUnlockSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [fetchUnlockHistory]);

  const openRequirements = requirements.filter((r) => r.status !== "closed");
  const totalCandidates = requirements.reduce((sum, r) => sum + r.candidateCount, 0);
  const atJobLimit = openRequirements.length >= limits.openRequirements;
  const statsReady = !requirementsLoading && !requirementsError;

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
      done: totalCandidates > 0,
      href: "/employer/jobs",
      cta: "View your jobs",
    },
    {
      label: "Unlock your first candidate",
      body: "Unlock a candidate's contact details to reach out and move them into your pipeline.",
      done: (unlockCount ?? 0) > 0,
      href: "/employer/jobs",
      cta: "Review candidates",
    },
  ];
  // Hold off until both the requirements and the unlock count have loaded, so
  // a brand-new employer doesn't see the plain stat strip flash before the
  // checklist swaps in, and an existing one doesn't see a wrong "step 1".
  const showOnboardingChecklist = !suspended && statsReady && unlockCount !== null && onboardingSteps.some((s) => !s.done);

  return (
    <div className="grid w-full grid-cols-1 gap-6 rounded-xl border bg-white p-4 min-[640px]:p-6 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] min-[900px]:gap-8" style={{ borderColor: t.line, boxSizing: "border-box" }}>
      {/* ─── Main stage ─── */}
      <div className="mx-stagger" style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>
        <section>
          <h1 style={{ fontFamily: f.sans, fontSize: "clamp(28px, 6vw, 44px)", fontWeight: 400, lineHeight: 1.1, letterSpacing: "-0.02em", color: t.coal, margin: "0 0 6px", overflowWrap: "anywhere" }}>
            Welcome <em style={{ fontWeight: 600, color: t.indigo }}>back</em>, {user?.name || "there"}.
          </h1>
          <p style={{ fontFamily: f.sans, fontSize: 15, color: t.inkSoft, margin: 0, maxWidth: 560 }}>
            {openRequirements.length > 0
              ? "Here's where your open roles and shortlists stand."
              : "Post your first requirement and we'll start matching candidates against it."}
          </p>
        </section>

        {/* Suppressed while the checklist is up — its active step already
            carries whichever CTA actually applies (post/review/unlock). */}
        {!showOnboardingChecklist && !suspended && unlockSettled && (
          <Card>
            <CardContent>
              <Eyebrow tone="indigo">Your next move</Eyebrow>
              <h2 style={{ fontFamily: f.sans, fontSize: 28, fontWeight: 400, lineHeight: 1.2, letterSpacing: "-0.01em", color: t.coal, margin: "8px 0 10px" }}>
                {atJobLimit ? "You've reached your open-jobs limit" : "Post a requirement"}
              </h2>
              <p style={{ fontFamily: f.sans, fontSize: 14, color: t.inkSoft, margin: 0, maxWidth: 520, lineHeight: 1.55 }}>
                {atJobLimit
                  ? `Your account can have ${limits.openRequirements} open jobs at a time. Close a job you've filled to post a new one.`
                  : "Tell us the role, location, and notice-period preference — we'll return a scored shortlist from candidates actively practicing on HireStepX."}
              </p>
              {!atJobLimit && (
                <div style={{ marginTop: 18 }}>
                  <PrimaryLink href="/employer/requirements/new" icon={<EmployerIcon.Plus />}>Post a requirement</PrimaryLink>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {requirementsLoading ? (
          <PageSkeleton label="Loading your overview" />
        ) : requirementsError ? (
          <section aria-labelledby="overview-heading">
            <h2 id="overview-heading" style={{ margin: 0 }}><Eyebrow tone="ink">Overview</Eyebrow></h2>
            <div role="alert" style={{ marginTop: 10, padding: 16, border: `1px solid ${t.line}`, borderRadius: 10, fontFamily: f.sans, fontSize: 14, color: t.errorInk, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 200 }}>We couldn't load your jobs just now.</span>
              <OutlineCta size="sm" onClick={() => { void refreshRequirements(); }}>Retry</OutlineCta>
            </div>
          </section>
        ) : showOnboardingChecklist ? (
          <OnboardingChecklist steps={onboardingSteps} />
        ) : (
          <section aria-labelledby="overview-heading">
            <h2 id="overview-heading" style={{ margin: 0 }}><Eyebrow tone="ink">Overview</Eyebrow></h2>
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 0, margin: "10px 0 0", borderTop: `1px solid ${t.line}`, borderBottom: `1px solid ${t.line}` }}>
              <StatCell label="Open jobs" value={String(openRequirements.length)} unit={`of ${limits.openRequirements}`} />
              <StatCell label="Candidates matched" value={String(totalCandidates)} unit="" />
            </dl>
          </section>
        )}

        <OutlineLink href="/employer/jobs" full>View all jobs</OutlineLink>
      </div>

      {/* ─── Rail ─── */}
      <aside aria-label="Company and help" className="mx-stagger" style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
        <Card>
          <CardContent>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              {companyLogoUrl ? (
                <img src={companyLogoUrl} alt="" style={{ width: 22, height: 22, borderRadius: 6, objectFit: "cover" }} />
              ) : (
                <span aria-hidden="true" style={{ color: t.indigo }}><EmployerIcon.Building /></span>
              )}
              <h2 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: 0, overflowWrap: "anywhere" }}>
                {companyName || "Company profile"}
              </h2>
            </div>
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.55, margin: "0 0 12px" }}>
              {suspended
                ? "Your account is suspended and read-only."
                : verificationTier === "basic"
                  ? "Unverified account."
                  : verificationTier === "email_verified"
                    ? "Work email confirmed."
                    : "Fully verified company."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 style={{ fontFamily: f.sans, fontSize: 14, fontWeight: 600, color: t.coal, margin: "0 0 8px" }}>How matching works</h2>
            <p style={{ fontFamily: f.sans, fontSize: 13, color: t.inkSoft, lineHeight: 1.6, margin: 0 }}>
              Match score reflects fit against this requirement; roster score reflects lifetime interview
              performance across a candidate's practice sessions.
            </p>
          </CardContent>
        </Card>
      </aside>
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
