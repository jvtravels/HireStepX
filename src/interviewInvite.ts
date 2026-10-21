import type { InterviewEvent } from "./dashboardHelpers";
import type { JobMatch } from "./DashboardJobs";
import { isDateOnlyInstant } from "./interviewWhen";
import { profileFromRole } from "./roleInterviewMatrix";
import { FOCUS_TO_TYPE, isFocusComingSoon, recommendFocus, type FocusPick } from "./setupFocus";
import { roundStatusByLabel, type FocusRound } from "./focusRounds";

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

export function recommendedFocusFor(job: Pick<JobMatch, "roleTitle" | "candidateStatus">, rounds?: readonly FocusRound[]): FocusPick {
  return recommendFocus({
    role: job.roleTitle,
    stage: job.candidateStatus,
    relevant: new Set(profileFromRole(job.roleTitle).focuses),
    isComingSoon: isFocusComingSoon,
    rounds: roundStatusByLabel(rounds),
  });
}

/* The live rounds this role's interview loop can include, with where the
   candidate stands in each. Hidden entirely when none apply. */
export function roundsForRole(job: Pick<JobMatch, "roleTitle">, rounds: readonly FocusRound[]): FocusRound[] {
  const relevant = new Set<string>(profileFromRole(job.roleTitle).focuses);
  return rounds.filter((r) => relevant.has(r.label) && !isFocusComingSoon(r.label));
}

export function invitePracticeHref(job: Pick<JobMatch, "id" | "roleTitle" | "companyName" | "unlocked" | "candidateStatus">, rounds?: readonly FocusRound[]): string {
  const params = new URLSearchParams({ role: job.roleTitle, invite: job.id });
  if (job.unlocked && job.companyName) params.set("company", job.companyName);
  params.set("focus", FOCUS_TO_TYPE[recommendedFocusFor(job, rounds).focus] ?? "behavioral");
  return `/session/new?${params.toString()}`;
}

const JD_MAX_CHARS = 1200;
const JD_KEY_PREFIX = "hsx-invite-jd:";

/** Compact posting text the question generator tailors a prep session to. */
export function inviteJobDescription(job: Pick<JobMatch, "roleTitle" | "skills" | "description" | "responsibilities">): string {
  const parts = [
    job.skills.length > 0 ? `Key skills: ${job.skills.join(", ")}.` : "",
    job.description ?? "",
    job.responsibilities ? `Responsibilities: ${job.responsibilities}` : "",
  ];
  return parts.map((p) => p.replace(/\s+/g, " ").trim()).filter(Boolean).join(" ").slice(0, JD_MAX_CHARS);
}

export function stashInviteJd(job: Pick<JobMatch, "id" | "roleTitle" | "skills" | "description" | "responsibilities">): void {
  try {
    sessionStorage.setItem(`${JD_KEY_PREFIX}${job.id}`, inviteJobDescription(job));
  } catch { /* private mode: the practice session simply is not tailored */ }
}

export function readInviteJd(inviteId: string | null): string {
  if (!inviteId) return "";
  try {
    return sessionStorage.getItem(`${JD_KEY_PREFIX}${inviteId}`) ?? "";
  } catch {
    return "";
  }
}
