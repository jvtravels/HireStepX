import type { RequirementSummary } from "./mockData";
import type { EmployerDashboardData } from "./dashboardData";

export interface ChecklistStep {
  label: string;
  body: string;
  done: boolean;
  href: string;
  cta: string;
}

/** Whether any candidate has moved past To review, from the dashboard feed. Null while it is unknown. */
export function hasProgressedCandidate(dashboard: EmployerDashboardData | null): boolean | null {
  if (!dashboard) return null;
  return dashboard.jobs.some((j) => j.interviewing > 0 || j.hired > 0) || dashboard.upcomingInterviews.length > 0;
}

/** The job whose shortlist is worth opening first: the one with the most strong matches, else the one with the most candidates. */
export function firstShortlistJob(jobs: readonly RequirementSummary[]): RequirementSummary | null {
  let best: RequirementSummary | null = null;
  for (const job of jobs) {
    if (!best || job.aiScreening.topMatches > best.aiScreening.topMatches || (job.aiScreening.topMatches === best.aiScreening.topMatches && job.candidateCount > best.candidateCount)) best = job;
  }
  return best;
}

/** The three setup steps, derived from what the employer has actually done. `reviewed` and `unlocked` are null while unknown, which counts as not done. */
export function deriveOnboardingSteps({ jobs, reviewed, unlocked }: { jobs: readonly RequirementSummary[]; reviewed: boolean | null; unlocked: boolean | null }): ChecklistStep[] {
  const target = firstShortlistJob(jobs);
  const shortlistHref = target ? `/employer/requirements/${target.id}` : "/employer/jobs";
  const hasCandidates = jobs.some((j) => j.candidateCount > 0);
  const hasUnlocked = unlocked === true;
  return [
    {
      label: "Post your first job",
      body: "Tell us the role, location, and notice-period preference, and we'll start matching candidates against it.",
      done: jobs.length > 0,
      href: "/employer/requirements/new",
      cta: "Post a job",
    },
    {
      label: "Review your first match",
      body: hasCandidates
        ? "Open the shortlist, read a candidate's evidence and move them forward or reject them."
        : "Matching runs on your first job. Candidates appear on that job's shortlist as they are scored.",
      done: reviewed === true || hasUnlocked,
      href: shortlistHref,
      cta: hasCandidates ? "Open shortlist" : "View your jobs",
    },
    {
      label: "Unlock your first candidate",
      body: "Unlock a candidate's contact details to reach out and move them into your pipeline.",
      done: hasUnlocked,
      href: shortlistHref,
      cta: "Review strong matches",
    },
  ];
}
