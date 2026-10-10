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

/** A real border instead of the Card's translucent ring: the ring is clipped
 *  at the page edge by the shell's overflow container and reads too faint. */
export const CARD = "border border-border ring-0";
export const TITLE = "flex items-center gap-2 text-lg leading-snug font-bold";
export const MAIN_SIDE = "grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]";

export interface CandidateLink { label: string; url: string; host: string }

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function normalizeUrl(raw: string): string {
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

/** Everything the candidate chose to share, shown as-is: LinkedIn first, then
 *  portfolio/work links, deduped by URL. */
export function candidateLinks(candidate: Candidate): CandidateLink[] {
  const out: CandidateLink[] = [];
  const seen = new Set<string>();
  const add = (label: string, raw: string) => {
    const url = normalizeUrl(raw.trim());
    const key = url.replace(/\/$/, "").toLowerCase();
    if (!raw.trim() || seen.has(key)) return;
    seen.add(key);
    out.push({ label, url, host: hostOf(url) });
  };
  if (candidate.resume?.linkedin) add("LinkedIn", candidate.resume.linkedin);
  for (const l of candidate.portfolioLinks ?? []) add(l.title || hostOf(l.url), l.url);
  return out;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthIndex(token: string): number | null {
  const m = token.trim().toLowerCase().match(/^([a-z]{3})[a-z]*\.?\s+(\d{4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[1]);
    return mi < 0 ? null : Number(m[2]) * 12 + mi;
  }
  const y = token.trim().match(/^(\d{4})$/);
  return y ? Number(y[1]) * 12 : null;
}

/** Months covered by "Sep 2025 – Jul 2026" / "2021 – Present"; null if unparseable. */
export function periodMonths(period: string, now = new Date()): number | null {
  const parts = period.split(/\s[-–—]\s|\sto\s/i);
  if (parts.length !== 2) return null;
  const start = monthIndex(parts[0]);
  const end = /present|current|now/i.test(parts[1]) ? now.getFullYear() * 12 + now.getMonth() : monthIndex(parts[1]);
  if (start == null || end == null || end < start) return null;
  return Math.max(1, end - start);
}

export interface ResumeInsights {
  snapshot: string;
  strengths: string[];
  probes: string[];
  avgTenureMonths: number | null;
}

/** Deterministic read of the structured resume data against the requirement.
 *  No model call and no invented facts: every line cites a field we hold. */
export function buildResumeInsights(candidate: Candidate, requirement: Requirement, matched: string[], unmatched: string[]): ResumeInsights {
  const r = candidate.resume;
  const latest = r?.experience[0];
  const lead = [r?.seniorityLevel, candidate.targetRole].filter(Boolean).join(" ");
  const years = r?.yearsExperience != null ? ` with ${r.yearsExperience} year${r.yearsExperience === 1 ? "" : "s"} of experience` : "";
  const recent = latest?.company ? `, most recently ${latest.title || "in a role"} at ${latest.company}${latest.period ? ` (${latest.period})` : ""}` : "";
  const snapshot = `${lead || "Candidate"}${years}${recent}.`;

  const tenures = (r?.experience ?? []).map((e) => periodMonths(e.period)).filter((n): n is number => n != null);
  const avgTenureMonths = tenures.length ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length) : null;

  const strengths: string[] = [];
  if (matched.length) strengths.push(`Lists ${matched.length} of ${requirement.skills.length} required skills: ${matched.slice(0, 5).join(", ")}.`);
  const measurable = (r?.keyAchievements ?? []).filter((a) => /\d/.test(a));
  if (measurable.length) strengths.push(`${measurable.length} achievement${measurable.length === 1 ? "" : "s"} with measurable results, for example: ${measurable[0]}`);
  if (r?.certifications.length) strengths.push(`Holds ${r.certifications.length} certification${r.certifications.length === 1 ? "" : "s"}: ${r.certifications.slice(0, 3).join(", ")}.`);
  if (avgTenureMonths != null && avgTenureMonths >= 24) strengths.push(`Stays in roles: about ${Math.round(avgTenureMonths / 12 * 10) / 10} years on average.`);
  if (candidate.sessionsCompleted > 0) strengths.push(`Practises: ${candidate.sessionsCompleted} graded mock interview${candidate.sessionsCompleted === 1 ? "" : "s"} on record.`);

  const probes: string[] = [];
  if (unmatched.length) probes.push(`Required skills not on the resume: ${unmatched.slice(0, 4).join(", ")}. Ask for hands-on examples.`);
  if (avgTenureMonths != null && tenures.length >= 2 && avgTenureMonths < 12) probes.push(`Short stints (about ${avgTenureMonths} months per role). Ask what drove each move.`);
  if (r?.noticePeriod) probes.push(`Notice period is self-reported as ${r.noticePeriod}. Confirm before planning a start date.`);
  if (r?.currentCtc) probes.push(`Current CTC is self-reported as ${r.currentCtc}. Confirm against your budget early.`);
  if (candidate.sessionsCompleted === 0) probes.push("No practice interviews yet, so there is no spoken-answer evidence. Use your own screen.");

  return { snapshot, strengths: strengths.slice(0, 4), probes: probes.slice(0, 4), avgTenureMonths };
}
