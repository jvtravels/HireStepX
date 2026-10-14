import type { RequirementSummary, RequirementStage } from "./mockData";

/* Client shape of GET /api/employer-dashboard plus the pure view logic the
   dashboard sections share (insights, job status, interview slot labels). */

export type DashboardRange = 7 | 30 | 90;

export interface DashboardTrend {
  series: number[];
  current: number;
  previous: number;
}

export interface DashboardJobPipeline {
  requirementId: string;
  interviewing: number;
  hired: number;
  lastUpdatedAt: string | null;
}

export interface DashboardUpcomingInterview {
  matchId: string;
  requirementId: string;
  roleTitle: string;
  candidateName: string;
  initials: string;
  scheduledAt: string;
}

export interface DashboardRecommendedRef {
  matchId: string;
  requirementId: string;
  matchScore: number;
  createdAt: string;
}

export interface DashboardActivityItem {
  id: string;
  actor: "You" | "Candidate" | "HireStepX";
  text: string;
  createdAt: string;
  href: string | null;
}

export interface EmployerDashboardData {
  range: DashboardRange;
  jobs: DashboardJobPipeline[];
  totals: { interviewsScheduled: number; hired: number; awaitingReview: number };
  trends: { jobs: DashboardTrend; recommended: DashboardTrend; interviews: DashboardTrend; hired: DashboardTrend };
  upcomingInterviews: DashboardUpcomingInterview[];
  recommended: DashboardRecommendedRef[];
  activity: DashboardActivityItem[];
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

/** Shallow shape check at the API boundary: arrays and the trend/totals
 *  objects must exist so the sections can read them without optional chains. */
export function isDashboardData(v: unknown): v is EmployerDashboardData {
  if (!isObj(v) || !isObj(v.totals) || !isObj(v.trends)) return false;
  return [v.jobs, v.upcomingInterviews, v.recommended, v.activity].every(Array.isArray)
    && ["jobs", "recommended", "interviews", "hired"].every((k) => isObj((v.trends as Record<string, unknown>)[k]));
}

export const RANGE_LABEL: Record<DashboardRange, string> = { 7: "Last 7 days", 30: "Last 30 days", 90: "Last 90 days" };

/** The "vs previous window" delta shown on a stat card. A percentage when the
 *  previous window had data to compare against, otherwise the raw difference. */
export function trendDelta(trend: DashboardTrend): { diff: number; label: string } {
  const diff = trend.current - trend.previous;
  if (diff === 0) return { diff, label: "No change" };
  const sign = diff > 0 ? "+" : "";
  const label = trend.previous > 0 ? `${sign}${Math.round((diff / trend.previous) * 100)}%` : `${sign}${diff}`;
  return { diff, label };
}

const STALE_DAYS = 14;

/** A one-line health flag for a job row, only when something needs attention. */
export function jobHealth(
  job: RequirementSummary,
  pipeline: DashboardJobPipeline | undefined,
  now: number,
): { tone: "warning" | "error"; label: string } | null {
  if (job.status === "failed") return { tone: "error", label: "Matching failed. Retry from Edit" };
  if (job.status === "generating") return null;
  const last = pipeline?.lastUpdatedAt ?? job.createdAt;
  const idleDays = Math.floor((now - Date.parse(last)) / 86_400_000);
  if (job.aiScreening.topMatches === 0) return { tone: "warning", label: "No strong matches yet" };
  if (idleDays > STALE_DAYS) return { tone: "warning", label: `Quiet for ${idleDays} days` };
  return null;
}

export interface DashboardInsight {
  id: string;
  title: string;
  body: string;
  href: string;
}

/** Up to four plain-language observations computed from real job and pipeline
 *  data. Each is only emitted when it is actually true, so a quiet account
 *  shows fewer insights rather than invented ones. */
export function buildInsights(
  jobs: RequirementSummary[],
  pipeline: DashboardJobPipeline[],
  awaitingReview: number,
  now: number,
): DashboardInsight[] {
  const out: DashboardInsight[] = [];
  const pipelineById = new Map(pipeline.map((p) => [p.requirementId, p]));

  const best = [...jobs].sort((a, b) => b.aiScreening.topMatches - a.aiScreening.topMatches)[0];
  if (best && best.aiScreening.topMatches > 0) {
    const avg = best.aiScreening.strongAvgScore;
    out.push({
      id: "best-pipeline",
      title: "Strongest pipeline",
      body: `${best.title} has ${best.aiScreening.topMatches} strong ${best.aiScreening.topMatches === 1 ? "match" : "matches"}${avg !== null ? `, averaging ${Math.round(avg)}% fit` : ""}.`,
      href: `/employer/requirements/${best.id}`,
    });
  }

  if (awaitingReview > 0) {
    out.push({
      id: "awaiting-review",
      title: "Candidates waiting on you",
      body: `${awaitingReview} recommended ${awaitingReview === 1 ? "candidate is" : "candidates are"} still waiting for your decision.`,
      href: "/employer/jobs",
    });
  }

  const noMatches = jobs.filter((j) => j.status !== "generating" && j.aiScreening.topMatches === 0);
  if (noMatches.length > 0) {
    out.push({
      id: "no-strong",
      title: "Roles with no strong match",
      body: `${noMatches[0].title}${noMatches.length > 1 ? ` and ${noMatches.length - 1} more have` : " has"} no strong matches. Broadening skills or location can help.`,
      href: `/employer/requirements/${noMatches[0].id}/edit`,
    });
  }

  const stale = jobs.filter((j) => {
    const last = pipelineById.get(j.id)?.lastUpdatedAt;
    return last && now - Date.parse(last) > STALE_DAYS * 86_400_000;
  });
  if (stale.length > 0) {
    out.push({
      id: "stale",
      title: "Quiet for a while",
      body: `${stale[0].title}${stale.length > 1 ? ` and ${stale.length - 1} more haven't` : " hasn't"} changed in over ${STALE_DAYS} days.`,
      href: `/employer/requirements/${stale[0].id}`,
    });
  }

  return out.slice(0, 4);
}

export type ExperienceFit = "within" | "below" | "above";

export interface RecommendedCard {
  matchId: string;
  requirementId: string;
  name: string;
  initials: string;
  roleTitle: string;
  /** The job's required skills the candidate lists, in the job's order. When the
   *  job lists none, the candidate's own top skills so the row isn't empty. */
  matchedSkills: string[];
  missingSkills: string[];
  requiredCount: number;
  yearsExperience: number | null;
  experienceFit: ExperienceFit | null;
  /** "4 to 8 yrs" style label of what the job asks for, null when unspecified. */
  experienceAsk: string | null;
  matchScore: number | null;
  createdAt: string | null;
  /** Whole days since the match was created, null when unknown. */
  waitingDays: number | null;
}

export function experienceAsk(min: number | null, max: number | null): string | null {
  if (min !== null && max !== null) return min === max ? `${min} yrs` : `${min} to ${max} yrs`;
  if (min !== null) return `${min}+ yrs`;
  if (max !== null) return `up to ${max} yrs`;
  return null;
}

export function experienceFit(years: number | null, min: number | null, max: number | null): ExperienceFit | null {
  if (years === null || (min === null && max === null)) return null;
  if (min !== null && years < min) return "below";
  if (max !== null && years > max) return "above";
  return "within";
}

/** Joins the server's ranked strong-match refs (best score first, longest
 *  waiting on ties) with the jobs list's candidate detail, and works out why
 *  each one fits: which required skills they cover, which they don't, and
 *  whether their experience sits inside the range the job asks for. Falls back
 *  to the jobs list's own order when the server list is unavailable. */
export function buildRecommendedCards(
  jobs: RequirementSummary[],
  refs: DashboardRecommendedRef[] | null,
  now: number,
  limit = 3,
): RecommendedCard[] {
  const detail = new Map<string, { job: RequirementSummary; c: RequirementSummary["aiScreening"]["strongMatches"][number] }>();
  for (const job of jobs) for (const c of job.aiScreening.strongMatches) detail.set(c.id, { job, c });

  const ordered = refs && refs.length > 0
    ? refs.filter((r) => detail.has(r.matchId)).map((r) => ({ id: r.matchId, createdAt: r.createdAt as string | null, score: r.matchScore as number | null }))
    : Array.from(detail.keys()).map((id) => ({ id, createdAt: null as string | null, score: null as number | null }));

  return ordered.slice(0, limit).map(({ id, createdAt, score }) => {
    const { job, c } = detail.get(id)!;
    const have = new Set(c.skills.map((s) => s.toLowerCase()));
    const matched = job.skills.filter((s) => have.has(s.toLowerCase()));
    return {
      matchId: id,
      requirementId: job.id,
      name: c.name,
      initials: c.initials,
      roleTitle: job.title,
      matchedSkills: job.skills.length > 0 ? matched : c.skills.slice(0, 4),
      missingSkills: job.skills.filter((s) => !have.has(s.toLowerCase())),
      requiredCount: job.skills.length,
      yearsExperience: c.yearsExperience,
      experienceFit: experienceFit(c.yearsExperience, job.experienceMin, job.experienceMax),
      experienceAsk: experienceAsk(job.experienceMin, job.experienceMax),
      matchScore: score,
      createdAt,
      waitingDays: createdAt ? Math.max(0, Math.floor((now - Date.parse(createdAt)) / 86_400_000)) : null,
    };
  });
}

/** The stage a job is really in: candidates already interviewing or hired move
 *  it past the stored "ready for review" stage. */
export function pipelineStage(job: RequirementSummary, pipeline: DashboardJobPipeline | undefined): RequirementStage {
  if (job.stage === "ai_matching") return job.stage;
  if (pipeline && pipeline.hired > 0 && pipeline.hired >= (job.openPositions ?? 1)) return "hired";
  if (pipeline && pipeline.interviewing + pipeline.hired > 0) return "interviewing";
  return job.stage;
}

const slotDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const slotTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZoneName: "short" });

export function interviewSlot(iso: string): { day: string; month: string; time: string } {
  const d = new Date(iso);
  const [day, month] = slotDate.format(d).split(" ");
  return { day, month: month ?? "", time: slotTime.format(d).toUpperCase() };
}

export interface NextAction {
  title: string;
  body: string;
  cta: string;
  href: string;
}

const SOON_MS = 48 * 3_600_000;

/** The single most useful thing to do next, picked from real data in priority
 *  order: a near interview, candidates waiting, a failed job, a job with no
 *  strong matches, then posting a role. Null when there is nothing to push. */
export function buildNextAction(
  jobs: RequirementSummary[],
  upcoming: DashboardUpcomingInterview[],
  awaitingReview: number,
  now: number,
  canCreate: boolean,
): NextAction | null {
  const soon = upcoming.find((i) => Date.parse(i.scheduledAt) - now <= SOON_MS);
  if (soon) {
    const slot = interviewSlot(soon.scheduledAt);
    return {
      title: `Prepare for your interview with ${soon.candidateName}`,
      body: `${soon.roleTitle}, ${slot.day} ${slot.month} at ${slot.time}.`,
      cta: "Open candidate",
      href: `/employer/requirements/${soon.requirementId}/candidates/${soon.matchId}`,
    };
  }
  if (awaitingReview > 0) {
    return {
      title: `${awaitingReview} ${awaitingReview === 1 ? "candidate is" : "candidates are"} waiting for your decision`,
      body: "Recommended candidates move faster when you respond within a couple of days.",
      cta: "Review candidates",
      href: "/employer/jobs",
    };
  }
  const failed = jobs.find((j) => j.status === "failed");
  if (failed) {
    return { title: `Matching failed for ${failed.title}`, body: "Edit and save the job to run matching again.", cta: "Edit job", href: `/employer/requirements/${failed.id}/edit` };
  }
  const empty = jobs.find((j) => j.status !== "generating" && j.aiScreening.topMatches === 0);
  if (empty) {
    return { title: `${empty.title} has no strong matches`, body: "Broadening skills or location usually surfaces more candidates.", cta: "Edit job", href: `/employer/requirements/${empty.id}/edit` };
  }
  if (jobs.length === 0 && canCreate) {
    return { title: "Post your first job", body: "Matched candidates show up here as soon as screening finishes.", cta: "Post a job", href: "/employer/requirements/new" };
  }
  return null;
}
