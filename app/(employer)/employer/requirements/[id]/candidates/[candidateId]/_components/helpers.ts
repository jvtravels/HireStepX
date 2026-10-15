import type { Candidate, CandidateStatus } from "@/employer/mockData";
import type { Requirement, CandidateEvidence, EvidenceDelivery, EvidenceQuestion } from "@/employer/EmployerDataContext";

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

/** Mean months per role across the entries whose period can be read; null when none can. */
export function averageTenureMonths(experience: ReadonlyArray<{ period: string }>): number | null {
  const tenures = experience.map((e) => periodMonths(e.period)).filter((n): n is number => n != null);
  return tenures.length ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length) : null;
}

export interface ResumeInsights {
  snapshot: string;
  strengths: string[];
  concerns: string[];
  validate: string[];
  avgTenureMonths: number | null;
}

/** Deterministic read of the structured resume data against the requirement.
 *  No model call and no invented facts: every line cites a field we hold. */
export function buildResumeInsights(candidate: Candidate, requirement: Requirement, matched: string[], unmatched: string[]): ResumeInsights {
  const r = candidate.resume;
  const latest = r?.experience[0];
  const seniority = r?.seniorityLevel && !candidate.targetRole.toLowerCase().includes(r.seniorityLevel.toLowerCase()) ? r.seniorityLevel : null;
  const lead = [seniority, candidate.targetRole].filter(Boolean).join(" ");
  const years = r?.yearsExperience != null ? ` with ${r.yearsExperience} year${r.yearsExperience === 1 ? "" : "s"} of experience` : "";
  const recent = latest?.company ? `, most recently ${latest.title || "in a role"} at ${latest.company}${latest.period ? ` (${latest.period})` : ""}` : "";
  const snapshot = `${lead || "Candidate"}${years}${recent}.`;

  const tenures = (r?.experience ?? []).map((e) => periodMonths(e.period)).filter((n): n is number => n != null);
  const avgTenureMonths = averageTenureMonths(r?.experience ?? []);

  const strengths: string[] = [];
  if (matched.length) strengths.push(`Lists ${matched.length} of ${requirement.skills.length} required skills: ${matched.slice(0, 5).join(", ")}.`);
  const measurable = (r?.keyAchievements ?? []).filter((a) => /\d/.test(a));
  if (measurable.length) strengths.push(`${measurable.length} achievement${measurable.length === 1 ? "" : "s"} with measurable results, for example: ${measurable[0]}`);
  if (r?.certifications.length) strengths.push(`Holds ${r.certifications.length} certification${r.certifications.length === 1 ? "" : "s"}: ${r.certifications.slice(0, 3).join(", ")}.`);
  if (avgTenureMonths != null && avgTenureMonths >= 24) strengths.push(`Stays in roles: about ${Math.round(avgTenureMonths / 12 * 10) / 10} years on average.`);

  const concerns: string[] = [];
  if (unmatched.length) concerns.push(`Not on the resume: ${unmatched.slice(0, 4).join(", ")}.`);
  if (avgTenureMonths != null && tenures.length >= 2 && avgTenureMonths < 12) concerns.push(`Short stints, about ${avgTenureMonths} months per role.`);

  const validate: string[] = [];
  if (unmatched.length) validate.push(`Hands-on examples of ${unmatched.slice(0, 3).join(", ")}.`);
  if (avgTenureMonths != null && tenures.length >= 2 && avgTenureMonths < 12) validate.push("What drove each move.");

  return { snapshot, strengths: strengths.slice(0, 4), concerns: concerns.slice(0, 4), validate: validate.slice(0, 4), avgTenureMonths };
}

export const HEADER_ACTION = "text-[13px] font-semibold";

export type FitStatus = "meets" | "partial" | "gap";
export interface FitRow { id: string; label: string; asked: string; has: string; status: FitStatus }

const BAND_RANK = { leanHire: 1, hire: 2, strongHire: 3 } as const;

/** Days implied by a free-text notice period ("30 days", "2 months", "Immediate"); null when unreadable. */
export function noticeDays(text: string): number | null {
  const t = text.toLowerCase();
  if (/immediate|no notice|serving|available now/.test(t)) return 0;
  const m = t.match(/(\d+(?:\.\d+)?)\s*(day|week|month)/);
  if (!m) return null;
  return Math.round(Number(m[1]) * (m[2] === "day" ? 1 : m[2] === "week" ? 7 : 30));
}

function experienceAsk(min: number | null, max: number | null): string {
  if (min != null && max != null) return min === max ? `${min} yrs` : `${min} to ${max} yrs`;
  return min != null ? `${min}+ yrs` : `Up to ${max} yrs`;
}

/** Candidate vs what the posting asks for, one row per criterion we hold both sides of.
 *  Rows with missing data on either side are left out rather than guessed. */
export function buildRoleFit(candidate: Candidate, requirement: Requirement, matched: string[], evidence: CandidateEvidence | null): FitRow[] {
  const rows: FitRow[] = [];
  const r = candidate.unlocked ? candidate.resume : null;

  const asked = requirement.skills.length;
  if (asked > 0) {
    const ratio = matched.length / asked;
    rows.push({ id: "skills", label: "Required skills", asked: `${asked} listed`, has: `${matched.length} of ${asked}`, status: ratio === 1 ? "meets" : ratio >= 0.5 ? "partial" : "gap" });
  }

  const { experienceMin: min, experienceMax: max } = requirement;
  if (r?.yearsExperience != null && (min != null || max != null)) {
    const y = r.yearsExperience;
    const below = min != null && y < min;
    const above = max != null && y > max;
    const status: FitStatus = !below && !above ? "meets" : (below && y >= min - 1) || (above && y <= max + 2) ? "partial" : "gap";
    rows.push({ id: "experience", label: "Experience", asked: experienceAsk(min, max), has: `${y} yr${y === 1 ? "" : "s"}`, status });
  }

  const hasCity = !!candidate.city && candidate.city !== "Not specified";
  if (hasCity && (requirement.workMode === "remote" || requirement.locations.length > 0)) {
    const inCity = requirement.locations.some((l) => l.toLowerCase().includes(candidate.city.toLowerCase()) || candidate.city.toLowerCase().includes(l.toLowerCase()));
    const remote = requirement.workMode === "remote";
    rows.push({
      id: "location",
      label: "Location",
      asked: remote ? "Remote" : requirement.locations.slice(0, 2).join(", "),
      has: candidate.city,
      status: remote || inCity ? "meets" : requirement.workMode === "hybrid" ? "partial" : "gap",
    });
  }

  const pref = requirement.noticePeriodPref;
  if (r?.noticePeriod && pref && pref !== "Any") {
    const limit = pref.toLowerCase().startsWith("immediate") && !/to/.test(pref.toLowerCase()) ? 0 : (() => {
      const nums = pref.match(/\d+/g);
      return nums ? Number(nums[nums.length - 1]) : null;
    })();
    const days = noticeDays(r.noticePeriod);
    if (limit != null && days != null) {
      rows.push({ id: "notice", label: "Notice period", asked: pref, has: r.noticePeriod, status: days <= limit ? "meets" : days <= limit + 30 ? "partial" : "gap" });
    }
  }

  if (requirement.minReadinessBand && evidence?.readiness) {
    const got = BAND_RANK[evidence.readiness.band];
    const want = BAND_RANK[requirement.minReadinessBand];
    rows.push({ id: "readiness", label: "Interview readiness", asked: `${READINESS_LABEL[requirement.minReadinessBand]} or better`, has: READINESS_LABEL[evidence.readiness.band], status: got >= want ? "meets" : got === want - 1 ? "partial" : "gap" });
  }

  if (requirement.minStarCompleteness != null && evidence?.starCompleteness) {
    const pct = evidence.starCompleteness.pct;
    const want = requirement.minStarCompleteness;
    rows.push({ id: "star", label: "STAR answers", asked: `${want}%+`, has: `${pct}%`, status: pct >= want ? "meets" : pct >= want - 15 ? "partial" : "gap" });
  }

  return rows;
}

/** "1 yr 4 mo", "7 mo"; used for per-role tenure. */
export function formatTenure(months: number): string {
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y} yr${y === 1 ? "" : "s"}` : `${y} yr ${m} mo`;
}

export type DeliveryTone = "success" | "warning" | "error" | "neutral";
export interface DeliveryRow { id: string; label: string; value: string; note: string; tone: DeliveryTone; hint: string }

/** Spoken delivery as plain-language readings. Thresholds are conversational-interview norms, not a hiring bar. */
export function describeDelivery(d: EvidenceDelivery | null | undefined): DeliveryRow[] {
  if (!d) return [];
  const rows: DeliveryRow[] = [];
  if (d.paceWpm != null) {
    const w = d.paceWpm;
    rows.push({ id: "pace", label: "Speaking pace", value: `${w} wpm`, hint: "Easy to follow is roughly 110 to 170 words a minute.", ...(w < 110 ? { note: "Slow", tone: "warning" as const } : w > 170 ? { note: "Fast", tone: "warning" as const } : { note: "Easy to follow", tone: "success" as const }) });
  }
  if (d.fillersPerMin != null) {
    const f = d.fillersPerMin;
    rows.push({ id: "fillers", label: "Filler words", value: `${f} / min`, hint: "Counts um, uh, like, you know, so, basically and similar.", ...(f <= 3 ? { note: "Low", tone: "success" as const } : f <= 6 ? { note: "Moderate", tone: "warning" as const } : { note: "High", tone: "error" as const }) });
  }
  if (d.responseSec != null) {
    const s = d.responseSec;
    rows.push({ id: "response", label: "Time to start answering", value: `${s}s`, hint: "Median pause between the question ending and the answer starting.", ...(s <= 3 ? { note: "Quick", tone: "success" as const } : s <= 6 ? { note: "Considered", tone: "neutral" as const } : { note: "Slow to start", tone: "warning" as const }) });
  }
  if (d.pausePct != null) {
    const p = d.pausePct;
    rows.push({ id: "pauses", label: "Time in long pauses", value: `${p}%`, hint: "Share of the session spent in silences longer than 1.5 seconds.", ...(p <= 10 ? { note: "Steady", tone: "success" as const } : p <= 25 ? { note: "Some pauses", tone: "warning" as const } : { note: "Long pauses", tone: "error" as const }) });
  }
  if (d.hedgesPerMin != null) {
    const h = d.hedgesPerMin;
    rows.push({ id: "hedges", label: "Hedging", value: `${h} / min`, hint: "Softeners such as 'I think', 'maybe' and 'kind of'.", ...(h <= 2 ? { note: "Confident", tone: "success" as const } : h <= 5 ? { note: "Some hedging", tone: "warning" as const } : { note: "Heavy hedging", tone: "error" as const }) });
  }
  return rows;
}

export const VERDICT_LABEL: Record<EvidenceQuestion["verdict"], string> = { strong: "Strong", complete: "Complete", partial: "Partial", weak: "Weak", skipped: "Skipped" };
export const VERDICT_TONE: Record<EvidenceQuestion["verdict"], "success" | "warning" | "error" | "neutral"> = { strong: "success", complete: "success", partial: "warning", weak: "error", skipped: "neutral" };
export const DIFFICULTY_LABEL: Record<NonNullable<EvidenceQuestion["difficulty"]>, string> = { warmup: "Warm-up", standard: "Standard", hard: "Hard" };
export const LENGTH_LABEL: Record<NonNullable<EvidenceQuestion["length"]>["verdict"], string> = { "too-brief": "Too brief", right: "Right length", "too-long": "Too long" };

export interface QuestionSummary { count: number; avg: number; strong: number; weak: number; fullStar: number; starCounted: number }

export function summarizeQuestions(questions: EvidenceQuestion[]): QuestionSummary | null {
  const answered = questions.filter((q) => q.verdict !== "skipped");
  if (answered.length === 0) return null;
  const withStar = answered.filter((q) => q.star);
  return {
    count: answered.length,
    avg: Math.round(answered.reduce((n, q) => n + q.score, 0) / answered.length),
    strong: answered.filter((q) => q.verdict === "strong" || q.verdict === "complete").length,
    weak: answered.filter((q) => q.verdict === "weak").length,
    fullStar: withStar.filter((q) => q.star && q.star.S && q.star.T && q.star.A && q.star.R).length,
    starCounted: withStar.length,
  };
}
