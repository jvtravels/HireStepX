/* The running story of one match, told from what the candidate can see:
   matched, viewed, asked, answered, unlocked, replied, interview. Pure so the
   order and wording are tested without rendering. */

import type { JobMatch } from "./DashboardJobs";
import { normalizeResponse } from "./employerActions";

export type TimelineState = "done" | "action" | "waiting";

export interface TimelineStep {
  key: string;
  label: string;
  detail?: string;
  /** ISO time the step happened; absent when only the fact is known. */
  at?: string | null;
  state: TimelineState;
}

const STAGE_LABEL: Record<string, string> = {
  interview_invited: "Employer invited you to interview",
  interviewing: "You are in the interview stage",
  hired: "Employer marked you as hired",
};

function byTime(a: TimelineStep, b: TimelineStep): number {
  return new Date(a.at ?? 0).getTime() - new Date(b.at ?? 0).getTime();
}

export function buildJobTimeline(job: JobMatch, opts: { closed: boolean; invited: boolean }): TimelineStep[] {
  const dated: TimelineStep[] = [{ key: "matched", label: "Matched to this role", at: job.matchedAt, state: "done" }];

  if (job.profileViewedAt) {
    dated.push({ key: "viewed", label: "An employer reviewed your practice evidence", at: job.profileViewedAt, state: "done" });
  }
  for (const r of job.answeredRequests ?? []) {
    dated.push({
      key: `answered-${r.id}`,
      label: r.outcome === "fulfilled" ? `You answered: ${r.headline}` : `You declined: ${r.headline}`,
      at: r.at,
      state: "done",
    });
  }
  if (job.unlocked) {
    dated.push({ key: "unlocked", label: "Employer unlocked your contact details", at: job.unlockedAt, state: "done" });
  }
  dated.sort(byTime);

  const steps = [...dated];
  const response = normalizeResponse(job.candidateResponse);
  if (response) {
    steps.push({ key: "response", label: response === "interested" ? "You told the employer you're interested" : "You told the employer you're not interested", state: "done" });
  }
  const stage = job.candidateStatus ? STAGE_LABEL[job.candidateStatus] : undefined;
  if (stage) steps.push({ key: "stage", label: stage, state: "done" });
  if (job.interviewScheduledAt) {
    const upcoming = new Date(job.interviewScheduledAt).getTime() > Date.now();
    steps.push({ key: "interview", label: upcoming ? "Interview scheduled" : "Interview took place", at: job.interviewScheduledAt, state: upcoming ? "action" : "done" });
  }

  if (opts.closed) return steps;

  for (const r of job.requests ?? []) {
    steps.push({ key: `asked-${r.id}`, label: `Employer asked: ${r.headline}`, at: r.createdAt, state: "action" });
  }

  const hasPending = (job.requests ?? []).length > 0;
  if (!job.profileViewedAt && !job.unlocked && !hasPending) {
    steps.push({ key: "wait-view", label: "Waiting for an employer to review your evidence", detail: "More graded practice makes your profile easier to approve.", state: "waiting" });
  } else if (!job.unlocked && !hasPending) {
    steps.push({ key: "wait-unlock", label: "Waiting for the employer to decide on contact", state: "waiting" });
  } else if (job.unlocked && !response && !opts.invited) {
    steps.push({ key: "reply", label: "Tell the employer if you're interested", state: "action" });
  }
  return steps;
}
