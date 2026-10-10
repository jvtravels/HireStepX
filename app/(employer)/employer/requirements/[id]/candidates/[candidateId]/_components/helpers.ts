import type { Candidate, CandidateStatus } from "@/employer/mockData";
import type { Requirement, CandidateEvidence } from "@/employer/EmployerDataContext";

/* Pure helpers for the candidate detail page. Everything here derives from
   fields the API actually returns — no synthesized or seeded values. */

export const READINESS_LABEL: Record<"strongHire" | "hire" | "leanHire", string> = {
  strongHire: "Strong hire",
  hire: "Hire",
  leanHire: "Lean hire",
};
export const PROVENANCE = "Scored by HireStepX AI from graded practice sessions";

export function maskedName(c: Candidate): string {
  return c.unlocked ? c.name : `Candidate #${c.id.slice(0, 6)}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function matchedSkillCount(requirementSkills: string[], candidateSkills: string[]): string[] {
  const set = new Set(candidateSkills.map((s) => s.toLowerCase()));
  return requirementSkills.filter((s) => set.has(s.toLowerCase()));
}

/** Only statements backed by returned fields; an empty list is a valid result. */
export function buildFitReasons(candidate: Candidate, requirement: Requirement, matchedSkills: string[]): string[] {
  const reasons: string[] = [];
  if (matchedSkills.length) {
    reasons.push(`Matches ${matchedSkills.length} of ${requirement.skills.length} required skills: ${matchedSkills.slice(0, 4).join(", ")}`);
  }
  if (candidate.resume?.yearsExperience != null) {
    reasons.push(`${candidate.resume.yearsExperience} years of experience on their resume`);
  }
  if (candidate.sessionsCompleted > 0) {
    reasons.push(`Completed ${candidate.sessionsCompleted} practice session${candidate.sessionsCompleted === 1 ? "" : "s"} for this target role`);
  }
  if (candidate.city && requirement.locations.some((l) => l.toLowerCase().includes(candidate.city.toLowerCase()))) {
    reasons.push(`Based in ${candidate.city}, matching the role's location`);
  }
  return reasons.slice(0, 4);
}

/** Mean of the candidate's real per-skill scores; null when there are none
 *  (never falls back to the match score — they measure different things). */
export function evidenceAverage(evidence: CandidateEvidence | null): number | null {
  if (!evidence?.skills.length) return null;
  return Math.round(evidence.skills.reduce((sum, s) => sum + s.score, 0) / evidence.skills.length);
}

export const PIPELINE_STEPS: CandidateStatus[] = ["shortlisted", "interview_invited", "interviewing", "hired"];
export const NEGATIVE_STATUSES: CandidateStatus[] = ["rejected", "not_a_fit", "no_response"];

export function formatSessionDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export const TONE_SUCCESS = "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
export const TONE_WARNING = "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
export const TONE_DANGER = "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300";

/** Text label always accompanies the colour, so the band is never colour-only. */
export function scoreBand(score: number): { label: string; className: string } {
  if (score >= 70) return { label: "Strong match", className: TONE_SUCCESS };
  if (score >= 50) return { label: "Fair match", className: TONE_WARNING };
  return { label: "Low match", className: TONE_DANGER };
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}
