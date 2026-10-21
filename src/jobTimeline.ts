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
  const response = normalizeResponse(job.candidateResponse);
  const responseStep: TimelineStep | null = response
    ? { key: "response", label: response === "interested" ? "You told the employer you're interested" : "You told the employer you're not interested", at: job.candidateRespondedAt, state: "done" }
    : null;
  // A timestamped answer sorts into the story; an undated one (older rows) trails it.
  if (responseStep?.at) dated.push(responseStep);
  dated.sort(byTime);

  const steps = [...dated];
  if (responseStep && !responseStep.at) steps.push(responseStep);
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

export interface JobStatusBadge {
  label: string;
  tone: "neutral" | "brand" | "success";
  tip: string;
}

/* The header badge reports the furthest point of the story the timeline tells,
   so the two never disagree. Rejections are never shown (see STAGE_LABEL). */
export function jobStatusBadge(job: JobMatch, closed: boolean): JobStatusBadge {
  if (closed) return { label: "Role closed", tone: "neutral", tip: "The employer has closed this role. Your profile stays visible to other employers." };
  if (job.candidateStatus === "hired") return { label: "Hired", tone: "success", tip: "The employer marked you as hired for this role." };
  if (job.interviewScheduledAt || job.candidateStatus === "interviewing") {
    return { label: "Interview stage", tone: "brand", tip: "You are in the interview stage for this role." };
  }
  if (job.candidateStatus === "interview_invited") return { label: "Interview invited", tone: "brand", tip: "The employer invited you to interview for this role." };
  if (normalizeResponse(job.candidateResponse) === "declined") return { label: "You declined", tone: "neutral", tip: "You told the employer you're not interested. You can change your answer below." };
  if (job.unlocked) return { label: "Employer interested", tone: "brand", tip: "This employer viewed your profile and can message you." };
  return { label: "Matched", tone: "success", tip: "Your profile fits this role. The employer hasn't contacted you yet." };
}
