/* Pure aggregation for the employer dashboard (GET /api/employer-dashboard).
 * The handler reads raw rows; everything that turns them into counts, trend
 * series and feed lines lives here so it is unit-tested against real code. */

import { maskedCandidateName } from "./_employer-trust";

export const DASHBOARD_RANGES = [7, 30, 90] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];
export const SERIES_BUCKETS = 8;
const DAY_MS = 86_400_000;

export function asDashboardRange(v: unknown): DashboardRange {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return (DASHBOARD_RANGES as readonly number[]).includes(n) ? (n as DashboardRange) : 30;
}

export interface TrendSeries {
  /** Events inside the selected window, oldest bucket first. */
  series: number[];
  current: number;
  previous: number;
}

/** Buckets timestamps across the selected window (for the sparkline) and
 *  counts the window before it so the card can show a "vs previous" delta. */
export function buildTrend(timestamps: string[], now: number, rangeDays: number): TrendSeries {
  const windowMs = rangeDays * DAY_MS;
  const bucketMs = windowMs / SERIES_BUCKETS;
  const start = now - windowMs;
  const series = new Array<number>(SERIES_BUCKETS).fill(0);
  let current = 0;
  let previous = 0;
  for (const ts of timestamps) {
    const t = Date.parse(ts);
    if (Number.isNaN(t) || t > now) continue;
    if (t >= start) {
      series[Math.min(SERIES_BUCKETS - 1, Math.floor((t - start) / bucketMs))] += 1;
      current += 1;
    } else if (t >= start - windowMs) {
      previous += 1;
    }
  }
  return { series, current, previous };
}

export interface DashboardMatchRow {
  id: string;
  requirement_id: string;
  candidate_status: string;
  interview_scheduled_at: string | null;
  candidate_status_updated_at: string | null;
  created_at: string | null;
  unlocked: boolean | null;
  unlocked_candidate_name: string | null;
  match_score: number;
  profile_viewed_at: string | null;
}

export interface JobPipelineRow {
  requirementId: string;
  interviewing: number;
  hired: number;
  lastUpdatedAt: string | null;
}

const INTERVIEW_STATUSES = new Set(["interview_invited", "interviewing"]);

function later(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

/** Per-job pipeline counts plus a "last updated" that is the newest of the job
 *  row itself, its activity log, and any candidate status change. */
export function summarizeJobs(
  requirementIds: string[],
  matches: DashboardMatchRow[],
  lastActivityByRequirement: Map<string, string>,
  createdAtByRequirement: Map<string, string>,
): JobPipelineRow[] {
  const rows = new Map<string, JobPipelineRow>(
    requirementIds.map((id) => [id, {
      requirementId: id, interviewing: 0, hired: 0,
      lastUpdatedAt: later(lastActivityByRequirement.get(id) ?? null, createdAtByRequirement.get(id) ?? null),
    }]),
  );
  for (const m of matches) {
    const row = rows.get(m.requirement_id);
    if (!row) continue;
    if (INTERVIEW_STATUSES.has(m.candidate_status)) row.interviewing += 1;
    if (m.candidate_status === "hired") row.hired += 1;
    row.lastUpdatedAt = later(row.lastUpdatedAt, m.candidate_status_updated_at);
  }
  return Array.from(rows.values());
}

export function candidateLabel(m: Pick<DashboardMatchRow, "id" | "unlocked" | "unlocked_candidate_name">): string {
  return m.unlocked && m.unlocked_candidate_name ? m.unlocked_candidate_name : maskedCandidateName(m.id);
}

export function candidateInitials(label: string, matchId: string): string {
  if (label.startsWith("Candidate #")) return matchId.slice(0, 2).toUpperCase();
  const parts = label.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "C";
}

export interface UpcomingInterview {
  matchId: string;
  requirementId: string;
  roleTitle: string;
  candidateName: string;
  initials: string;
  scheduledAt: string;
}

export function selectUpcomingInterviews(
  matches: DashboardMatchRow[],
  titleByRequirement: Map<string, string>,
  now: number,
  limit = 4,
): UpcomingInterview[] {
  return matches
    .filter((m) => INTERVIEW_STATUSES.has(m.candidate_status) && m.interview_scheduled_at && Date.parse(m.interview_scheduled_at) >= now)
    .sort((a, b) => Date.parse(a.interview_scheduled_at as string) - Date.parse(b.interview_scheduled_at as string))
    .slice(0, limit)
    .map((m) => {
      const name = candidateLabel(m);
      return {
        matchId: m.id,
        requirementId: m.requirement_id,
        roleTitle: titleByRequirement.get(m.requirement_id) ?? "Role",
        candidateName: name,
        initials: candidateInitials(name, m.id),
        scheduledAt: m.interview_scheduled_at as string,
      };
    });
}

export interface RecommendedRef {
  matchId: string;
  requirementId: string;
  matchScore: number;
  createdAt: string;
  viewed: boolean;
}

export function selectRecentRecommended(matches: DashboardMatchRow[], threshold: number, limit = 12): RecommendedRef[] {
  return matches
    .filter((m) => m.match_score >= threshold && m.created_at && m.candidate_status === "shortlisted")
    .sort((a, b) => Date.parse(b.created_at as string) - Date.parse(a.created_at as string))
    .slice(0, limit)
    .map((m) => ({
      matchId: m.id, requirementId: m.requirement_id, matchScore: m.match_score,
      createdAt: m.created_at as string, viewed: !!m.profile_viewed_at,
    }));
}

const STATUS_LABEL: Record<string, string> = {
  shortlisted: "Shortlisted",
  interview_invited: "Interview invited",
  interviewing: "Interviewing",
  hired: "Hired",
  rejected: "Rejected",
  not_a_fit: "Not a fit",
  no_response: "No response",
};

/** Employer-authored lines read as full sentences; candidate/system lines lead
 *  with the candidate since "You" would be wrong. */
export function activityText(actor: string, name: string, toStatus: string): string | null {
  const label = STATUS_LABEL[toStatus];
  if (!label) return null;
  if (actor !== "employer") return `${name} is now ${label}`;
  switch (toStatus) {
    case "interview_invited": return `You invited ${name} to interview`;
    case "hired": return `You marked ${name} as Hired`;
    case "rejected": return `You rejected ${name}`;
    case "not_a_fit": return `You marked ${name} as Not a fit`;
    case "no_response": return `You marked ${name} as No response`;
    default: return `You moved ${name} to ${label}`;
  }
}

export interface StatusEventRow {
  match_id: string | null;
  requirement_id: string;
  to_status: string;
  actor: string;
  note: string | null;
  created_at: string;
}

export interface ActivityItem {
  id: string;
  actor: "You" | "Candidate" | "HireStepX";
  text: string;
  createdAt: string;
  href: string | null;
}

/** Events whose match was since deleted (candidate removed their account) are
 *  dropped rather than shown with a dangling name. */
export function buildActivityFeed(
  events: StatusEventRow[],
  matchById: Map<string, DashboardMatchRow>,
  limit = 6,
): ActivityItem[] {
  const out: ActivityItem[] = [];
  for (const e of events) {
    if (out.length >= limit) break;
    const match = e.match_id ? matchById.get(e.match_id) : undefined;
    if (!match) continue;
    const text = activityText(e.actor, candidateLabel(match), e.to_status);
    if (!text) continue;
    out.push({
      id: `${match.id}-${e.created_at}`,
      actor: e.actor === "employer" ? "You" : e.actor === "candidate" ? "Candidate" : "HireStepX",
      text,
      createdAt: e.created_at,
      href: `/employer/requirements/${e.requirement_id}/candidates/${match.id}`,
    });
  }
  return out;
}
