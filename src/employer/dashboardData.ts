import type { RequirementSummary } from "./mockData";

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
  viewed: boolean;
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
  totals: { interviewsScheduled: number; hired: number; unviewedRecommended: number };
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

/** The "vs previous window" delta shown on a stat card. */
export function trendDelta(trend: DashboardTrend): { diff: number; label: string } {
  const diff = trend.current - trend.previous;
  return { diff, label: diff === 0 ? "No change" : `${diff > 0 ? "+" : ""}${diff}` };
}

export type JobStatusLabel = "Active" | "Matching" | "Needs retry";

/** Maps the AI-matching lifecycle to what an employer cares about. Closed jobs
 *  are filtered out before this is called. There is no "Paused" state in the
 *  data model. */
export function jobStatusLabel(status: RequirementSummary["status"]): JobStatusLabel {
  if (status === "generating") return "Matching";
  if (status === "failed") return "Needs retry";
  return "Active";
}

export interface DashboardInsight {
  id: string;
  title: string;
  body: string;
  href: string;
}

const STALE_DAYS = 14;

/** Up to four plain-language observations computed from real job and pipeline
 *  data. Each is only emitted when it is actually true, so a quiet account
 *  shows fewer insights rather than invented ones. */
export function buildInsights(
  jobs: RequirementSummary[],
  pipeline: DashboardJobPipeline[],
  unviewedRecommended: number,
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

  if (unviewedRecommended > 0) {
    out.push({
      id: "unviewed",
      title: "Candidates waiting on you",
      body: `${unviewedRecommended} recommended ${unviewedRecommended === 1 ? "candidate hasn't" : "candidates haven't"} been opened yet.`,
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

export interface RecommendedCard {
  matchId: string;
  requirementId: string;
  name: string;
  initials: string;
  roleTitle: string;
  strengths: string[];
  needsValidation: string[];
  createdAt: string | null;
}

/** Joins the server's recency-ordered strong-match refs with the jobs list's
 *  masked candidate detail (skills). "Needs validation" is the job's required
 *  skills the candidate's resume doesn't list. Falls back to the jobs list's
 *  own order when the server list is unavailable. */
export function buildRecommendedCards(
  jobs: RequirementSummary[],
  refs: DashboardRecommendedRef[] | null,
  limit = 3,
): RecommendedCard[] {
  const detail = new Map<string, { job: RequirementSummary; c: RequirementSummary["aiScreening"]["strongMatches"][number] }>();
  for (const job of jobs) for (const c of job.aiScreening.strongMatches) detail.set(c.id, { job, c });

  const ordered = refs && refs.length > 0
    ? refs.filter((r) => detail.has(r.matchId)).map((r) => ({ id: r.matchId, createdAt: r.createdAt as string | null }))
    : Array.from(detail.keys()).map((id) => ({ id, createdAt: null as string | null }));

  return ordered.slice(0, limit).map(({ id, createdAt }) => {
    const { job, c } = detail.get(id)!;
    const have = new Set(c.skills.map((s) => s.toLowerCase()));
    return {
      matchId: id,
      requirementId: job.id,
      name: c.name,
      initials: c.initials,
      roleTitle: job.title,
      strengths: c.skills.slice(0, 3),
      needsValidation: job.skills.filter((s) => !have.has(s.toLowerCase())).slice(0, 2),
      createdAt,
    };
  });
}

const slotDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
const slotTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

export function interviewSlot(iso: string): { day: string; month: string; time: string } {
  const d = new Date(iso);
  const [day, month] = slotDate.format(d).split(" ");
  return { day, month: month ?? "", time: slotTime.format(d).toUpperCase() };
}
