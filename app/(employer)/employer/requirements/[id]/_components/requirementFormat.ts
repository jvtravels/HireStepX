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

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** "5m ago" up to "2y ago". Returns null for an unreadable date so callers can
    hide the line instead of printing NaN. A date-only value (createdAt) reads
    as whole days, never a made-up hour count. */
export function timeAgoLabel(iso: string | null | undefined, now: number = Date.now()): string | null {
  if (!iso) return null;
  const dateOnly = DATE_ONLY.test(iso);
  const then = new Date(dateOnly ? `${iso}T00:00:00` : iso).getTime();
  if (Number.isNaN(then)) return null;
  const diffMs = Math.max(0, now - then);
  if (!dateOnly) {
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
  }
  return agoFromDays(Math.floor(diffMs / 86_400_000));
}

function agoFromDays(days: number): string {
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** lastActiveDaysAgo is the newest practice session; the server sends -1 when
    the candidate has never practised. */
export function practisedLabel(lastActiveDaysAgo: number): string | null {
  return lastActiveDaysAgo >= 0 ? `Practised ${agoFromDays(lastActiveDaysAgo)}` : null;
}

/** First words of a description at a word boundary, keeping at most four
    paragraph breaks so a pasted JD never shows a half word or a tall wall. */
export function previewText(text: string, max: number): { text: string; truncated: boolean } {
  const lines = text.trim().split("\n");
  const kept = lines.slice(0, 4).join("\n");
  if (kept.length <= max && lines.length <= 4) return { text: kept, truncated: false };
  const cut = kept.slice(0, max);
  const boundary = cut.search(/\s\S*$/);
  const base = boundary > max * 0.6 ? cut.slice(0, boundary) : cut;
  return { text: base.trimEnd(), truncated: true };
}

/** One line describing how a closed job ended, from what archive stored. */
export function closedSummary(r: Pick<Requirement, "status" | "archiveReason" | "archiveDisposition">): string | null {
  if (r.status !== "closed") return null;
  const parts = ["This requirement is closed."];
  if (r.archiveReason?.trim()) parts.push(`Reason: ${r.archiveReason.trim().replace(/[.\s]+$/, "")}.`);
  if (r.archiveDisposition === "reject_remaining") parts.push("Open candidates were rejected when it closed.");
  else if (r.archiveDisposition === "keep_candidates") parts.push("Open candidates were kept as they were.");
  parts.push("Candidate details are read-only.");
  return parts.join(" ");
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
