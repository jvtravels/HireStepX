import type { Sort } from "@/components/SortableHead";
import type { RequirementActivity } from "@/employer/EmployerDataContext";
import type { RequirementSummary } from "@/employer/mockData";
import { STAGE_LABEL } from "@/employer/_atoms";
import { formatNumber } from "@/utils";

export const RECENT_SEARCHES_KEY = "hirestepx-employer-jobs-recent-searches";

export function experienceLabel(req: RequirementSummary): string | null {
  const { experienceMin, experienceMax } = req;
  if (experienceMin == null && experienceMax == null) return null;
  if (experienceMin != null && experienceMax != null) return `${experienceMin}–${experienceMax} yrs`;
  if (experienceMin != null) return `${experienceMin}+ yrs`;
  return `Up to ${experienceMax} yrs`;
}

/** budgetMin/budgetMax's unit depends on salaryType — whole INR lakhs for
    per-annum roles, a raw INR amount for per-month/fixed ones. Mirrors
    asBoundedBudget in server-handlers/_employer-requirements-helpers.ts. */
export function budgetLabel(req: RequirementSummary): string | null {
  const { budgetMin, budgetMax, salaryType } = req;
  if (budgetMin == null && budgetMax == null) return null;
  if (salaryType === "per-annum" || salaryType == null) {
    if (budgetMin != null && budgetMax != null) return `₹${budgetMin}–${budgetMax} LPA`;
    if (budgetMin != null) return `₹${budgetMin}+ LPA`;
    return `Up to ₹${budgetMax} LPA`;
  }
  const suffix = salaryType === "per-month" ? "/month" : " fixed";
  const fmt = (n: number) => `₹${formatNumber(n)}`;
  if (budgetMin != null && budgetMax != null) return `${fmt(budgetMin)}–${formatNumber(budgetMax)}${suffix}`;
  if (budgetMin != null) return `${fmt(budgetMin)}+${suffix}`;
  return `Up to ${fmt(budgetMax as number)}${suffix}`;
}

export function daysUntil(dueDate: string): number {
  return Math.round((new Date(`${dueDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

export function locationText(req: RequirementSummary): string {
  return req.locations.length > 0 ? req.locations.join(", ") : req.location;
}

export const ACTIVITY_LABEL: Record<RequirementActivity["action"], string> = {
  created: "Job posted",
  updated: "Details updated",
  archived: "Archived",
  reopened: "Reopened",
  stage_changed: "Stage updated",
};

export const DUE_OPTIONS = ["Overdue", "Due within 7 days", "No due date"];
export const ARCHIVE_REASONS = ["Position filled", "Budget cut", "Role on hold", "Other"];

export interface NumberRange {
  min: string;
  max: string;
}

export const EMPTY_RANGE: NumberRange = { min: "", max: "" };

/* A requirement's experience/salary is itself a range (experienceMin..Max) —
   this overlaps that range against the filter's range rather than requiring
   a single value to fall inside it, so a role spanning 2-5 yrs still matches
   a "3-10" filter. */
export function rangesOverlap(reqMin: number | null, reqMax: number | null, filter: NumberRange): boolean {
  if (!filter.min.trim() && !filter.max.trim()) return true;
  if (reqMin == null && reqMax == null) return false;
  const filterMin = filter.min.trim() ? Number(filter.min) : -Infinity;
  const filterMax = filter.max.trim() ? Number(filter.max) : Infinity;
  const lo = reqMin ?? -Infinity;
  const hi = reqMax ?? Infinity;
  return lo <= filterMax && hi >= filterMin;
}

export type SortColumn = "title" | "location" | "experience" | "stage" | "dueDate" | "matches" | "topMatches" | "created";
// Newest-posted-first — matches the order employer-requirements.ts already
// returns (created_at.desc), so the initial render isn't silently reordered
// by a due-date sort that's meaningless until a row actually has a due date.
export const DEFAULT_SORT: Sort<SortColumn> = { column: "created", direction: "desc" };

export const COLUMN_LABEL: Record<SortColumn, string> = {
  title: "Opportunity",
  location: "Location",
  experience: "Experience",
  stage: "Stage",
  dueDate: "Due Date",
  matches: "AI Screening",
  topMatches: "Top Matches",
  created: "Date posted",
};

export function compareRows(a: RequirementSummary, b: RequirementSummary, sort: Sort<SortColumn>): number {
  const dir = sort.direction === "asc" ? 1 : -1;
  const due = (r: RequirementSummary) => (r.dueDate ? new Date(`${r.dueDate}T00:00:00Z`).getTime() : Number.POSITIVE_INFINITY);
  switch (sort.column) {
    case "title":
      return dir * a.title.localeCompare(b.title);
    case "location":
      return dir * locationText(a).localeCompare(locationText(b));
    case "experience":
      return dir * ((a.experienceMin ?? a.experienceMax ?? -1) - (b.experienceMin ?? b.experienceMax ?? -1));
    case "stage":
      return dir * STAGE_LABEL[a.stage].localeCompare(STAGE_LABEL[b.stage]);
    case "dueDate":
      return dir * (due(a) - due(b));
    case "matches":
      return dir * (a.aiScreening.evaluated - b.aiScreening.evaluated);
    case "topMatches":
      return dir * (a.aiScreening.topMatches - b.aiScreening.topMatches);
    case "created":
      return dir * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }
}

export function matchesDueFilter(req: RequirementSummary, filter: string): boolean {
  if (!filter) return true;
  if (filter === "No due date") return !req.dueDate;
  if (!req.dueDate) return false;
  const left = daysUntil(req.dueDate);
  if (filter === "Overdue") return left < 0;
  return left >= 0 && left <= 7;
}
