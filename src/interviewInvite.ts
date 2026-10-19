import type { InterviewEvent } from "./dashboardHelpers";
import type { JobMatch } from "./DashboardJobs";

const INVITED_STATUSES = new Set(["interview_invited", "interviewing"]);

export function isInterviewInvite(job: Pick<JobMatch, "candidateStatus" | "candidateResponse">): boolean {
  return INVITED_STATUSES.has(job.candidateStatus ?? "") && job.candidateResponse !== "declined";
}

export function inviteEvent(job: Pick<JobMatch, "id" | "roleTitle" | "companyName" | "interviewScheduledAt">): InterviewEvent | null {
  if (!job.interviewScheduledAt || Number.isNaN(new Date(job.interviewScheduledAt).getTime())) return null;
  return {
    id: `invite-${job.id}`,
    title: `Interview: ${job.roleTitle}`,
    company: job.companyName,
    type: "Employer interview",
    date: job.interviewScheduledAt.slice(0, 10),
    time: "",
    start_utc: job.interviewScheduledAt,
    duration: 60,
    location: "",
    notes: "Invited via HireStepX. Confirm details in your messages.",
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
