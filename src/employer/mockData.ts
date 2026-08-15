/* HireStepX — Employer console shared types.
   Backed by real Supabase tables (employers, employer_requirements,
   requirement_matches) — see server-handlers/employer-*.ts and the
   "Employer talent-roster feature" block in supabase-schema.sql.

   Candidate fields are limited to what the real schema backs: target
   role, resume-derived city/skills, session count, and last-active
   recency. There is no CTC module, notice-period field, or "exclusive"
   flag on real candidate data, so those fixture-only fields from the
   original mocked pass are not part of this shape. */

export interface Candidate {
  id: string; // requirement_matches row id
  name: string;
  targetRole: string;
  city: string;
  matchScore: number; // fit against THIS requirement only
  rosterScore: number; // lifetime performance across all practice sessions
  sessionsCompleted: number;
  lastActiveDaysAgo: number;
  skills: string[];
  unlocked: boolean;
  contact?: { email: string };
}

export type RequirementStatus = "generating" | "ready" | "partial" | "zero" | "failed" | "closed";

export interface RequirementSummary {
  id: string;
  title: string;
  location: string;
  noticePeriodPref: string;
  status: RequirementStatus;
  experienceMin: number | null;
  experienceMax: number | null;
  dueDate: string | null;
  createdAt: string;
  candidateCount: number;
}

export interface Requirement {
  id: string;
  title: string;
  location: string;
  noticePeriodPref: string;
  status: RequirementStatus;
  experienceMin: number | null;
  experienceMax: number | null;
  dueDate: string | null;
  createdAt: string;
  candidates: Candidate[];
}
