/* Pure formatting + candidate helpers for the requirement detail surfaces. */

import type { Requirement } from "@/employer/EmployerDataContext";
import type { Candidate, RequirementStage } from "@/employer/mockData";
import { formatNumber } from "@/utils";

export function experienceLabel(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}–${max} yrs experience`;
  if (min != null) return `${min}+ yrs experience`;
  return `Up to ${max} yrs experience`;
}

function daysUntil(dueDate: string): number {
  return Math.round((new Date(`${dueDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
}

export function dueLabel(dueDate: string): { text: string; overdue: boolean } {
  const days = daysUntil(dueDate);
  if (days < 0) {
    const late = Math.abs(days);
    return { text: `Overdue by ${late} ${late === 1 ? "day" : "days"}`, overdue: true };
  }
  if (days === 0) return { text: "Due today", overdue: false };
  return { text: `Due in ${days} ${days === 1 ? "day" : "days"}`, overdue: false };
}

export function timeAgoLabel(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** budgetMin/budgetMax's unit depends on salaryType: whole INR lakhs for
    per-annum roles, a raw INR amount for per-month/fixed ones. Mirrors
    asBoundedBudget in server-handlers/_employer-requirements-helpers.ts. */
export function budgetLabel(req: Requirement): string | null {
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

export const STAGE_HINT: Record<RequirementStage, string> = {
  ai_matching: "The AI is still scoring the practicing pool against this posting.",
  ready_for_review: "Candidates have been scored. Review the shortlist and unlock the ones worth contacting.",
  interviewing: "You're actively interviewing candidates from this shortlist.",
  hired: "This posting resulted in a hire.",
};

/* ── Candidate identity ── */

/** Mirrors maskedCandidateName() on the server so a locked candidate reads the
    same everywhere (table, evidence, compare, outcome, messages). */
export function maskedName(matchId: string): string {
  return `Candidate #${matchId.slice(0, 6)}`;
}

export function candidateDisplayName(c: Pick<Candidate, "id" | "name" | "unlocked">): string {
  return c.unlocked ? c.name : maskedName(c.id);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function candidateSubtitle(c: Candidate): string {
  return [c.targetRole, c.city].filter((part) => part && part !== "Not specified").join(" · ");
}

export type CandidateResponse = "none" | "interested" | "declined";

/** `candidateResponse` is an additive field on match rows that the shared
    Candidate type does not declare yet, so it is read defensively. */
export function candidateResponseOf(c: Candidate): CandidateResponse {
  if ("candidateResponse" in c) {
    const v = c.candidateResponse;
    if (v === "interested" || v === "declined") return v;
  }
  return "none";
}

/** In-platform messaging: always after unlock; before unlock only once the
    candidate has said they're interested (the server enforces the same rule). */
export function canMessageCandidate(c: Candidate): boolean {
  const response = candidateResponseOf(c);
  if (response === "declined") return false;
  return c.unlocked || response === "interested";
}

/** Formats interview_scheduled_at as the pipeline substep under a status chip. */
export function interviewSubstep(c: Candidate): string | null {
  if (c.candidateStatus !== "interview_invited" && c.candidateStatus !== "interviewing") return null;
  if (!c.interviewScheduledAt) return null;
  const when = new Date(c.interviewScheduledAt);
  if (Number.isNaN(when.getTime())) return null;
  const diffDays = Math.round((when.getTime() - Date.now()) / 86_400_000);
  const dateLabel = when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (diffDays < 0) return `Interview was ${dateLabel}`;
  if (diffDays === 0) return `Interview today · ${dateLabel}`;
  return `Interview ${dateLabel}`;
}

/** Statuses a candidate can still be rejected from (hired/rejected/not_a_fit/
    no_response are terminal on the server). */
export function canReject(c: Candidate): boolean {
  return c.candidateStatus === "shortlisted" || c.candidateStatus === "interview_invited" || c.candidateStatus === "interviewing";
}

const READINESS_LABEL: Record<NonNullable<Requirement["minReadinessBand"]>, string> = {
  leanHire: "Lean hire or better",
  hire: "Hire or better",
  strongHire: "Strong hire only",
};

export interface RoleDetailRow {
  label: string;
  text?: string;
  tags?: string[];
  wide?: boolean;
}

/** Saved posting fields the summary header doesn't render; empty ones are skipped. */
export function roleDetailRows(r: Requirement): RoleDetailRow[] {
  const rows: RoleDetailRow[] = [];
  const text = (label: string, value: string | null | undefined, wide = false) => {
    if (value && value.trim()) rows.push({ label, text: value.trim(), wide });
  };
  const tags = (label: string, values: string[]) => {
    if (values.length > 0) rows.push({ label, tags: values, wide: true });
  };
  text("Department", r.department);
  if (r.openPositions != null) text("Open positions", String(r.openPositions));
  text("Notice period", r.noticePeriodPref && r.noticePeriodPref !== "Any" ? r.noticePeriodPref : null);
  text("Work schedule", r.workSchedule);
  text("Relevant experience", r.relevantExperience);
  if (r.minReadinessBand) text("Minimum readiness", READINESS_LABEL[r.minReadinessBand]);
  if (r.minStarCompleteness != null) text("Minimum STAR completeness", `${r.minStarCompleteness}%`);
  text("Responsibilities", r.responsibilities, true);
  text("Nice to have", r.niceToHave, true);
  tags("Other skills", r.customSkillSets);
  tags("Preferred colleges", r.preferredColleges);
  tags("Target companies", r.targetCompanies);
  tags("Perks and benefits", r.perksAndBenefits);
  return rows;
}
