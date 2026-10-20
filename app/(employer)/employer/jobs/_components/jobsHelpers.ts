import type { Sort } from "@/components/SortableHead";
import type { RequirementActivity } from "@/employer/EmployerDataContext";
import type { RequirementSummary } from "@/employer/mockData";
import { STAGE_LABEL } from "@/employer/_atoms";
import { formatNumber } from "@/utils";

export const RECENT_SEARCHES_KEY = "hirestepx-employer-jobs-recent-searches";

export function experienceLabel(req: RequirementSummary): string | null {
  const { experienceMin, experienceMax } = req;
  if (experienceMin == null && experienceMax == null) return null;
  if (experienceMin != null && experienceMax != null) return `${experienceMin} to ${experienceMax} yrs`;
  if (experienceMin != null) return `${experienceMin}+ yrs`;
  return `Up to ${experienceMax} yrs`;
}

/** budgetMin/budgetMax's unit depends on salaryType — whole INR lakhs for
    per-annum roles, a raw INR amount for per-month/fixed ones. Mirrors
    asBoundedBudget in server-handlers/_employer-requirements-helpers.ts. */
export function budgetLabel(req: RequirementSummary): string | null {
  const { budgetMin, budgetMax, salaryType } = req;
  if (budgetMin == null && budgetMax == null) return null;
  /* The server caps per-annum budgets at 1000 lakhs, so a larger value is a raw
     rupee amount saved before that validation; show it as rupees, not "LPA". */
  const rawRupees = (salaryType === "per-annum" || salaryType == null) && Math.max(budgetMin ?? 0, budgetMax ?? 0) > 1000;
  if (rawRupees) {
    const fmtRaw = (n: number) => `₹${formatNumber(n)}`;
    if (budgetMin != null && budgetMax != null) return `${fmtRaw(budgetMin)} to ${formatNumber(budgetMax)}/year`;
    if (budgetMin != null) return `${fmtRaw(budgetMin)}+/year`;
    return `Up to ${fmtRaw(budgetMax as number)}/year`;
  }
  if (salaryType === "per-annum" || salaryType == null) {
    if (budgetMin != null && budgetMax != null) return `₹${budgetMin} to ${budgetMax} LPA`;
    if (budgetMin != null) return `₹${budgetMin}+ LPA`;
    return `Up to ₹${budgetMax} LPA`;
  }
  const suffix = salaryType === "per-month" ? "/month" : " fixed";
  const fmt = (n: number) => `₹${formatNumber(n)}`;
  if (budgetMin != null && budgetMax != null) return `${fmt(budgetMin)} to ${formatNumber(budgetMax)}${suffix}`;
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
export const ARCHIVE_REASONS = ["Position filled", "Budget cut", "Job on hold", "Other"];

/** The archive's bulk reject only changes status; it sends no message, unlike rejecting one candidate. */
export const ARCHIVE_REJECT_NOTE = "Their status becomes rejected. Archiving doesn't send them a message. You can undo this right after.";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "Up to" because the count includes people already hired or rejected, which the bulk reject skips. */
export function rejectRemainingScope(total: number, interviewing: number | null): string {
  if (total <= 0) return "No candidates are in this job yet, so nothing will be rejected.";
  const base = `Up to ${plural(total, "candidate")} will be rejected`;
  return interviewing && interviewing > 0 ? `${base}, including ${interviewing} in interviews.` : `${base}.`;
}

export function archiveConfirmLabel(rejecting: boolean, total: number): string {
  return rejecting && total > 0 ? `Archive and reject up to ${total}` : "Archive";
}

export function archiveDoneMessage(rejected: number): string {
  return rejected > 0 ? `Job archived. ${plural(rejected, "candidate")} marked rejected.` : "Job archived.";
}

export function archiveUndoneMessage(restored: number): string {
  return `Restored ${plural(restored, "candidate")} to their earlier status.`;
}

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

export type SortColumn = "title" | "location" | "experience" | "stage" | "dueDate" | "topMatches" | "created";
// Newest-posted-first — matches the order employer-requirements.ts already
// returns (created_at.desc), so the initial render isn't silently reordered
// by a due-date sort that's meaningless until a row actually has a due date.
export const DEFAULT_SORT: Sort<SortColumn> = { column: "created", direction: "desc" };

export const COLUMN_LABEL: Record<SortColumn, string> = {
  title: "Job",
  location: "Location",
  experience: "Experience",
  stage: "Stage",
  dueDate: "Due date",
  topMatches: "Matches",
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
    case "topMatches":
      return dir * (a.aiScreening.topMatches - b.aiScreening.topMatches || a.aiScreening.evaluated - b.aiScreening.evaluated);
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
