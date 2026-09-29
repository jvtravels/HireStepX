/* HireStepX — Employer console shared types.
   Backed by real Supabase tables (employers, employer_requirements,
   requirement_matches) — see server-handlers/employer-*.ts and the
   "Employer talent-roster feature" block in supabase-schema.sql.

   Candidate fields are limited to what the real schema backs: target
   role, resume-derived city/skills, session count, last-active recency,
   and a normalized resume detail block (see
   server-handlers/_resume-detail-helpers.ts). There is no "exclusive"
   flag on real candidate data, so that fixture-only field from the
   original mocked pass is not part of this shape. `resume.noticePeriod`
   / `resume.currentCtc` are exactly what the candidate's resume text
   said, not a verified figure — always render them as self-reported. */

export interface CandidateResumeDetail {
  summary: string;
  headline: string | null;
  seniorityLevel: string | null;
  yearsExperience: number | null;
  keyAchievements: string[];
  industries: string[];
  experience: Array<{ title: string; company: string; period: string }>;
  education: Array<{ degree: string; school: string; year: string }>;
  certifications: string[];
  linkedin: string | null;
  phone: string | null;
  noticePeriod: string | null;
  currentCtc: string | null;
}

export interface MatchBreakdown {
  roleMatch: number;
  skillMatch: number;
  locationMatch: number;
}

/** Per-candidate hiring-pipeline status against ONE requirement — distinct
 *  from RequirementStage, which tracks the posting as a whole. Mirrors
 *  CANDIDATE_STATUSES in server-handlers/_employer-candidate-status-helpers.ts. */
export type CandidateStatus =
  | "shortlisted"
  | "interview_invited"
  | "interviewing"
  | "hired"
  | "rejected"
  | "not_a_fit"
  | "no_response";

export interface Candidate {
  id: string; // requirement_matches row id
  name: string;
  targetRole: string;
  city: string;
  matchScore: number; // fit against THIS requirement only
  matchBreakdown?: MatchBreakdown; // why matchScore is what it is
  rosterScore: number; // lifetime performance across all practice sessions
  sessionsCompleted: number;
  lastActiveDaysAgo: number;
  skills: string[];
  unlocked: boolean;
  contact?: { email: string; phone?: string };
  resume?: CandidateResumeDetail;
  candidateStatus: CandidateStatus;
  candidateStatusNote: string | null;
  interviewScheduledAt: string | null;
}

export type RequirementStatus = "generating" | "ready" | "partial" | "zero" | "failed" | "closed";

/** Manually-set hiring-pipeline stage — distinct from RequirementStatus,
 *  which tracks AI matching/generation lifecycle. Mirrors RequirementStage
 *  in server-handlers/_employer-requirements-helpers.ts. */
export type RequirementStage = "ai_matching" | "ready_for_review" | "interviewing" | "hired";

export type WorkMode = "remote" | "onsite" | "hybrid";

export type EmploymentType = "full-time" | "part-time" | "contract" | "internship";

export type SalaryType = "per-month" | "fixed" | "per-annum";

/** One Strong Match candidate's real, non-fabricated detail — mirrors
 *  StrongMatchCandidate in server-handlers/_employer-requirements-helpers.ts. */
export interface StrongMatchCandidate {
  id: string;
  name: string;
  initials: string;
  yearsExperience: number | null;
  skills: string[];
}

/** Jobs-table "AI Screening" summary — mirrors AiScreeningSummary in
 *  server-handlers/_employer-requirements-helpers.ts. */
export interface AiScreeningSummary {
  evaluated: number;
  scoreLow: number | null;
  scoreHigh: number | null;
  topMatches: number;
  strongAvgScore: number | null;
  strongMatchInitials: string[];
  strongMatchExtra: number;
  strongMatches: StrongMatchCandidate[];
}

/** Disposition chosen when archiving a requirement — whether the
 *  still-open candidate pipeline gets bulk-rejected or left untouched.
 *  Mirrors the DB check constraint on employer_requirements.archive_disposition. */
export type ArchiveDisposition = "keep_candidates" | "reject_remaining";

export interface RequirementSummary {
  id: string;
  title: string;
  location: string;
  noticePeriodPref: string;
  status: RequirementStatus;
  stage: RequirementStage;
  department: string | null;
  experienceMin: number | null;
  experienceMax: number | null;
  dueDate: string | null;
  budgetMin: number | null; // INR lakhs when salaryType is per-annum, else a raw INR amount
  budgetMax: number | null;
  salaryType: SalaryType | null;
  locations: string[];
  openPositions: number | null;
  workMode: WorkMode | null;
  skills: string[];
  employmentType: EmploymentType | null;
  durationWeeks: number | null;
  hoursPerWeek: number | null;
  createdAt: string;
  candidateCount: number;
  aiScreening: AiScreeningSummary;
}

export interface Requirement {
  id: string;
  title: string;
  location: string;
  noticePeriodPref: string;
  description: string;
  status: RequirementStatus;
  stage: RequirementStage;
  department: string | null;
  archiveReason: string | null;
  archiveDisposition: ArchiveDisposition | null;
  experienceMin: number | null;
  experienceMax: number | null;
  dueDate: string | null;
  budgetMin: number | null; // INR lakhs when salaryType is per-annum, else a raw INR amount
  budgetMax: number | null;
  salaryType: SalaryType | null;
  locations: string[];
  openPositions: number | null;
  workMode: WorkMode | null;
  skills: string[];
  customSkillSets: string[];
  responsibilities: string;
  niceToHave: string;
  preferredIndustry: string;
  preferredDomain: string;
  workSchedule: string;
  availability: string;
  relevantExperience: string;
  portfolioRequired: boolean;
  preferredColleges: string[];
  targetCompanies: string[];
  perksAndBenefits: string[];
  employmentType: EmploymentType | null;
  durationWeeks: number | null;
  hoursPerWeek: number | null;
  createdAt: string;
  candidates: Candidate[];
}

/** Shape the create/edit requirement form submits — mirrors what
    employer-requirements.ts (POST) and employer-requirement-detail.ts
    (PATCH) accept. Single source of truth for RequirementForm and
    EmployerDataContext.addRequirement/updateRequirement so the two never
    drift apart. */
export interface RequirementFormValues {
  title: string;
  locations: string[];
  department?: string;
  noticePeriodPref?: string;
  description?: string;
  experienceMin?: number;
  experienceMax?: number;
  dueDate?: string;
  budgetMin?: number;
  budgetMax?: number;
  openPositions?: number;
  workMode?: WorkMode;
  employmentType?: EmploymentType;
  skills?: string[];
  responsibilities?: string;
  niceToHave?: string;
  preferredIndustry?: string;
  preferredColleges?: string[];
  targetCompanies?: string[];
  perksAndBenefits?: string[];
  salaryType?: SalaryType;
  preferredDomain?: string;
  workSchedule?: string;
  availability?: string;
  relevantExperience?: string;
  portfolioRequired?: boolean;
  customSkillSets?: string[];
  durationWeeks?: number;
  hoursPerWeek?: number;
}
