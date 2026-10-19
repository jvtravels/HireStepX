import type { InterviewEvent } from "./dashboardHelpers";
import type { JobMatch } from "./DashboardJobs";
import { isDateOnlyInstant } from "./interviewWhen";

const INVITED_STATUSES = new Set(["interview_invited", "interviewing"]);

export function isInterviewInvite(job: Pick<JobMatch, "candidateStatus" | "candidateResponse">): boolean {
  return INVITED_STATUSES.has(job.candidateStatus ?? "") && job.candidateResponse !== "declined";
}

export function inviteEvent(job: Pick<JobMatch, "id" | "roleTitle" | "companyName" | "interviewScheduledAt">): InterviewEvent | null {
  if (!job.interviewScheduledAt || Number.isNaN(new Date(job.interviewScheduledAt).getTime())) return null;
  const dateOnly = isDateOnlyInstant(job.interviewScheduledAt);
  return {
    id: `invite-${job.id}`,
    title: `Interview: ${job.roleTitle}`,
    company: job.companyName,
    type: "Employer interview",
    date: job.interviewScheduledAt.slice(0, 10),
    time: "",
    start_utc: job.interviewScheduledAt,
    duration: 60,
    all_day: dateOnly,
    location: "",
    notes: dateOnly ? "Invited via HireStepX. The employer has not set a time yet, so confirm it in your messages." : "Invited via HireStepX. Confirm details in your messages.",
    status: "upcoming",
    reminders: true,
    role: job.roleTitle,
  };
}

export function invitePracticeHref(job: Pick<JobMatch, "roleTitle" | "companyName" | "unlocked">): string {
  const params = new URLSearchParams({ role: job.roleTitle });
  if (job.unlocked && job.companyName) params.set("company", job.companyName);
  return `/session/new?${params.toString()}`;
}
