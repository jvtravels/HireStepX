// Shared formatting for hiring-match cards, used by both the dashboard
// teaser (HiringActivityCard) and the full-detail Jobs tab (DashboardJobs)
// so the two views can't drift on how comp/experience/dates are shown.

import { formatNumber } from "./utils";

export type SalaryType = "per-month" | "fixed" | "per-annum";

export function daysAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

// budgetMin/budgetMax's unit depends on salaryType — whole INR lakhs for
// per-annum roles, a raw INR amount for per-month/fixed ones. Mirrors
// asBoundedBudget in server-handlers/_employer-requirements-helpers.ts.
export function formatComp(min: number | null, max: number | null, salaryType?: SalaryType | null): string | null {
  if (min == null && max == null) return null;
  if (salaryType === "per-annum" || salaryType == null) {
    if (min != null && max != null) return `₹${min}–${max}L`;
    return `₹${min ?? max}L`;
  }
  const suffix = salaryType === "per-month" ? "/month" : " fixed";
  const fmt = (n: number) => `₹${formatNumber(n)}`;
  if (min != null && max != null) return `${fmt(min)}–${formatNumber(max)}${suffix}`;
  return `${fmt((min ?? max) as number)}${suffix}`;
}

export function formatExperience(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} yrs`;
  return `${min ?? max}+ yrs`;
}

export const WORK_MODE_LABEL: Record<string, string> = { remote: "Remote", onsite: "On-site", hybrid: "Hybrid" };

export const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
  internship: "Internship",
};
