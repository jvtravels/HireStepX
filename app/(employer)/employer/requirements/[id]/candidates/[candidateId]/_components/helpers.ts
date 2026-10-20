import type { Candidate, CandidateStatus } from "@/employer/mockData";
import type { Requirement, CandidateEvidence, EvidenceDelivery, EvidenceQuestion } from "@/employer/EmployerDataContext";
import { availabilityOf, candidateSkillFit, interviewScore } from "@/employer/_jobDetailHelpers";
import { CANDIDATE_STATUS_LABEL, matchBand } from "@/employer/_atoms";
import type { DotTone } from "@/employer/_panelParts";

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

export function matchedSkillCount(requirementSkills: string[], candidate: Candidate): string[] {
  return candidateSkillFit(candidate, requirementSkills).matched;
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
export function buildResumeInsights(candidate: Candidate, unmatched: string[]): ResumeInsights {
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
  const measurable = (r?.keyAchievements ?? []).filter((a) => /\d/.test(a));
  if (measurable.length) strengths.push(`${measurable.length} achievement${measurable.length === 1 ? "" : "s"} with measurable results, for example: ${measurable[0]}`);
  if (r?.certifications.length) strengths.push(`Holds ${r.certifications.length} certification${r.certifications.length === 1 ? "" : "s"}: ${r.certifications.slice(0, 3).join(", ")}.`);

  const concerns: string[] = [];
  if (avgTenureMonths != null && tenures.length >= 2 && avgTenureMonths < 12) concerns.push(`Short stints, about ${avgTenureMonths} months per role.`);

  const validate: string[] = [];
  if (unmatched.length) validate.push(`Hands-on examples of ${unmatched.slice(0, 3).join(", ")}.`);
  if (avgTenureMonths != null && tenures.length >= 2 && avgTenureMonths < 12) validate.push("What drove each move.");

  return { snapshot, strengths: strengths.slice(0, 4), concerns: concerns.slice(0, 4), validate: validate.slice(0, 4), avgTenureMonths };
}

export const HEADER_ACTION = "text-[13px] font-semibold";

export type FitStatus = "meets" | "partial" | "gap";
export type FitSource = "resume" | "profile" | "practice";
export interface FitRow { id: string; label: string; asked: string; has: string; status: FitStatus; reason: string; source: FitSource }

/** Where the candidate-side value came from, so an employer can tell a self-reported resume line from a graded one. */
export const FIT_SOURCE_LABEL: Record<FitSource, string> = {
  resume: "From the resume",
  profile: "From the candidate profile",
  practice: "From graded practice interviews",
};

export const FIT_RANK: Record<FitStatus, number> = { meets: 0, partial: 1, gap: 2 };

/** Strengths first, then near-misses, then gaps; rows with the same status keep their order. */
export function sortFitRows(rows: FitRow[]): FitRow[] {
  return [...rows].sort((a, b) => FIT_RANK[a.status] - FIT_RANK[b.status]);
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

const BAND_RANK = { leanHire: 1, hire: 2, strongHire: 3 } as const;

/** Days implied by a free-text notice period ("30 days", "2 months", "Immediate"); null when unreadable. */
export function noticeDays(text: string): number | null {
  const t = text.toLowerCase();
  if (/immediate|no notice|serving|available now/.test(t)) return 0;
  const m = t.match(/(\d+(?:\.\d+)?)\s*(day|week|month)/);
  if (!m) return null;
  return Math.round(Number(m[1]) * (m[2] === "day" ? 1 : m[2] === "week" ? 7 : 30));
}

export function formatYears(n: number): string {
  return `${n} ${n === 1 ? "year" : "years"}`;
}

function experienceAsk(min: number | null, max: number | null): string {
  if (min != null && max != null) return min === max ? formatYears(min) : `${min} to ${max} years`;
  return min != null ? `${min}+ years` : `Up to ${max} years`;
}

/** Candidate vs what the posting asks for, one row per criterion we hold both sides of.
 *  Rows with missing data on either side are left out rather than guessed. */
export function buildRoleFit(candidate: Candidate, requirement: Requirement, matched: string[], evidence: CandidateEvidence | null): FitRow[] {
  const rows: FitRow[] = [];
  const r = candidate.resume;

  const asked = requirement.skills.length;
  if (asked > 0) {
    const ratio = matched.length / asked;
    const missing = requirement.skills.filter((s) => !matched.includes(s));
    const reason = ratio === 1
      ? `Has all ${asked} required skills.`
      : matched.length === 0
        ? `None of the ${asked} required skills appear on the resume.`
        : `Has ${matched.length} of ${asked}; missing ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}.`;
    rows.push({ id: "skills", label: "Required skills", asked: `${asked} listed`, has: `${matched.length} of ${asked}`, status: ratio === 1 ? "meets" : ratio >= 0.5 ? "partial" : "gap", reason, source: "resume" });
  }

  const { experienceMin: min, experienceMax: max } = requirement;
  if (r?.yearsExperience != null && (min != null || max != null)) {
    const y = r.yearsExperience;
    const below = min != null && y < min;
    const above = max != null && y > max;
    const status: FitStatus = !below && !above ? "meets" : (below && y >= min - 1) || (above && y <= max + 2) ? "partial" : "gap";
    const reason = below
      ? `${formatYears(min - y)} short of the ${formatYears(min)} asked.`
      : above
        ? `${formatYears(y - max)} above the ${formatYears(max)} ceiling.`
        : `${formatYears(y)} sits inside the range asked.`;
    rows.push({ id: "experience", label: "Experience", asked: experienceAsk(min, max), has: formatYears(y), status, reason, source: "resume" });
  }

  const hasCity = !!candidate.city && candidate.city !== "Not specified";
  if (hasCity && (requirement.workMode === "remote" || requirement.locations.length > 0)) {
    const inCity = requirement.locations.some((l) => l.toLowerCase().includes(candidate.city.toLowerCase()) || candidate.city.toLowerCase().includes(l.toLowerCase()));
    const remote = requirement.workMode === "remote";
    const reason = remote
      ? "The role is remote, so location does not limit them."
      : inCity
        ? `Based in ${candidate.city}, where the role is hiring.`
        : `Based in ${candidate.city}; the role is hiring in ${requirement.locations.slice(0, 2).join(" or ")}.`;
    rows.push({
      id: "location",
      label: "Location",
      asked: remote ? "Remote" : requirement.locations.slice(0, 2).join(", "),
      has: candidate.city,
      status: remote || inCity ? "meets" : "gap",
      reason,
      source: "profile",
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
      const status: FitStatus = days <= limit ? "meets" : days <= limit + 30 ? "partial" : "gap";
      const reason = status === "meets" ? "Can join within the notice asked." : status === "partial" ? "Notice runs a little past what was asked." : "Notice runs well past what was asked.";
      rows.push({ id: "notice", label: "Notice period", asked: pref, has: r.noticePeriod, status, reason, source: "resume" });
    }
  }

  if (requirement.minReadinessBand && evidence?.readiness) {
    const got = BAND_RANK[evidence.readiness.band];
    const want = BAND_RANK[requirement.minReadinessBand];
    const status: FitStatus = got >= want ? "meets" : got === want - 1 ? "partial" : "gap";
    const reason = status === "meets" ? "Practice interviews reach the readiness level asked." : status === "partial" ? "One readiness level below what was asked." : "Practice interviews fall well below the readiness asked.";
    rows.push({ id: "readiness", label: "Interview readiness", asked: `${READINESS_LABEL[requirement.minReadinessBand]} or better`, has: READINESS_LABEL[evidence.readiness.band], status, reason, source: "practice" });
  }

  if (requirement.minStarCompleteness != null && evidence?.starCompleteness) {
    const pct = evidence.starCompleteness.pct;
    const want = requirement.minStarCompleteness;
    const status: FitStatus = pct >= want ? "meets" : pct >= want - 15 ? "partial" : "gap";
    const reason = status === "meets" ? "Answers cover the STAR structure as asked." : status === "partial" ? "Answers are close to the STAR coverage asked." : "Answers often skip parts of the STAR structure.";
    rows.push({ id: "star", label: "STAR coverage", asked: `${want}%+`, has: `${pct}%`, status, reason, source: "practice" });
  }

  return rows;
}

export interface FitSummary { meets: number; total: number; gaps: string[]; close: string[] }

export function summarizeFit(rows: FitRow[]): FitSummary {
  return {
    meets: rows.filter((r) => r.status === "meets").length,
    total: rows.length,
    gaps: rows.filter((r) => r.status === "gap").map((r) => r.label),
    close: rows.filter((r) => r.status === "partial").map((r) => r.label),
  };
}

/** "0 of 1 criterion fully met, 1 partly"; "partly" is what reconciles a criterion like
 *  "Required skills 2 of 4" with a headline that counts whole criteria. */
export function fitHeadline(fit: FitSummary): string | null {
  if (fit.total === 0) return null;
  const partly = fit.close.length;
  return `${fit.meets} of ${fit.total} ${fit.total === 1 ? "criterion" : "criteria"} fully met${partly > 0 ? `, ${partly} partly` : ""}`;
}

export type CandidateSignalKey = "strong" | "promising" | "fair" | "low";

/** The one-word read shown beside the score. The score band alone says "Strong" even when the
 *  criteria card shows gaps, so a strong score with any gap or near-miss reads "Promising". */
export function candidateSignal(score: number, fit: FitSummary): { key: CandidateSignalKey; label: string; tone: DotTone } {
  const band = matchBand(score);
  if (band === "strong") {
    return fit.gaps.length === 0 && fit.close.length === 0
      ? { key: "strong", label: "Strong match", tone: "good" }
      : { key: "promising", label: "Promising match", tone: "soon" };
  }
  const meetsNothing = fit.total > 0 && fit.meets === 0 && fit.close.length === 0;
  if (band === "fair" && !meetsNothing) return { key: "fair", label: "Fair match", tone: "soon" };
  return { key: "low", label: "Low match", tone: "unknown" };
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

/** Below this the transcript is too short for rate-based readings to mean anything. */
const MIN_RELIABLE_WPM = 60;

/** Spoken delivery as plain-language readings. Thresholds are conversational-interview norms, not a hiring bar.
 *  A near-silent sample or an exact zero is "not enough speech", never a positive badge. */
export function describeDelivery(d: EvidenceDelivery | null | undefined): DeliveryRow[] {
  if (!d) return [];
  const rows: DeliveryRow[] = [];
  const sparse = d.paceWpm != null && d.paceWpm < MIN_RELIABLE_WPM;
  const unreliable = { note: "Too little speech to judge", tone: "neutral" as const };
  const read = (value: number, scored: { note: string; tone: DeliveryTone }) => (sparse || value === 0 ? unreliable : scored);
  if (d.paceWpm != null) {
    const w = d.paceWpm;
    rows.push({ id: "pace", label: "Speaking pace", value: `${w} wpm`, hint: "Easy to follow is roughly 110 to 170 words a minute.", ...(sparse ? unreliable : w < 110 ? { note: "Slow", tone: "warning" as const } : w > 170 ? { note: "Fast", tone: "warning" as const } : { note: "Easy to follow", tone: "success" as const }) });
  }
  if (d.fillersPerMin != null) {
    const f = d.fillersPerMin;
    rows.push({ id: "fillers", label: "Filler words", value: `${f} / min`, hint: "Counts um, uh, like, you know, so, basically and similar.", ...read(f, f <= 3 ? { note: "Low", tone: "success" } : f <= 6 ? { note: "Moderate", tone: "warning" } : { note: "High", tone: "error" }) });
  }
  if (d.responseSec != null) {
    const s = d.responseSec;
    rows.push({ id: "response", label: "Time to start answering", value: `${s}s`, hint: "Median pause between the question ending and the answer starting.", ...read(s, s <= 3 ? { note: "Quick", tone: "success" } : s <= 6 ? { note: "Considered", tone: "neutral" } : { note: "Slow to start", tone: "warning" }) });
  }
  if (d.pausePct != null) {
    const p = d.pausePct;
    rows.push({ id: "pauses", label: "Time in long pauses", value: `${p}%`, hint: "Share of the session spent in silences longer than 1.5 seconds.", ...read(p, p <= 10 ? { note: "Steady", tone: "success" } : p <= 25 ? { note: "Some pauses", tone: "warning" } : { note: "Long pauses", tone: "error" }) });
  }
  if (d.hedgesPerMin != null) {
    const h = d.hedgesPerMin;
    rows.push({ id: "hedges", label: "Hedging", value: `${h} / min`, hint: "Softeners such as 'I think', 'maybe' and 'kind of'.", ...read(h, h <= 2 ? { note: "Confident", tone: "success" } : h <= 5 ? { note: "Some hedging", tone: "warning" } : { note: "Heavy hedging", tone: "error" }) });
  }
  return rows;
}

export const VERDICT_LABEL: Record<EvidenceQuestion["verdict"], string> = { strong: "Strong", complete: "Complete", partial: "Partial", weak: "Weak", skipped: "Skipped" };
export const VERDICT_TONE: Record<EvidenceQuestion["verdict"], "success" | "warning" | "error" | "neutral"> = { strong: "success", complete: "success", partial: "warning", weak: "error", skipped: "neutral" };
export const DIFFICULTY_LABEL: Record<NonNullable<EvidenceQuestion["difficulty"]>, string> = { warmup: "Warm-up", standard: "Standard", hard: "Hard" };
export const LENGTH_LABEL: Record<NonNullable<EvidenceQuestion["length"]>["verdict"], string> = { "too-brief": "Too brief", right: "Right length", "too-long": "Too long" };

function questionWords(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

/** Drops a later question that repeats an earlier one (the interviewer sometimes re-asks with
 *  near-identical wording), so the list and its counts don't double-count one prompt. */
export function cleanQuestionText(text: string): string {
  return text.replace(/\s*\[(?:pause|beat|silence)\]\s*/gi, " ").replace(/\s+/g, " ").trim();
}

export function dedupeQuestions(questions: EvidenceQuestion[]): EvidenceQuestion[] {
  const kept: Array<{ q: EvidenceQuestion; words: Set<string> }> = [];
  for (const q of questions) {
    const words = questionWords(q.question);
    const dup = kept.some((k) => {
      const shared = [...words].filter((w) => k.words.has(w)).length;
      return shared / Math.max(1, Math.min(words.size, k.words.size)) >= 0.85;
    });
    if (!dup) kept.push({ q, words });
  }
  return kept.map((k) => k.q);
}

/** Capabilities that say something about hiring for a role. Salary negotiation is candidate-side practice. */
export function employerCapabilities<T extends { key: string }>(capabilities: T[]): T[] {
  return capabilities.filter((c) => c.key !== "salary-negotiation");
}

export interface QuestionSummary { count: number; avg: number; strong: number; weak: number; fullStar: number; starCounted: number }

export function summarizeQuestions(questions: EvidenceQuestion[]): QuestionSummary | null {
  const answered = questions.filter((q) => q.verdict !== "skipped");
  if (answered.length === 0) return null;
  const withStar = answered.filter((q) => q.star && q.difficulty !== "warmup");
  return {
    count: answered.length,
    avg: Math.round(answered.reduce((n, q) => n + q.score, 0) / answered.length),
    strong: answered.filter((q) => q.verdict === "strong" || q.verdict === "complete").length,
    weak: answered.filter((q) => q.verdict === "weak").length,
    fullStar: withStar.filter((q) => q.star && q.star.S && q.star.T && q.star.A && q.star.R).length,
    starCounted: withStar.length,
  };
}

/* ── Skill depth (AI-parsed resumes) ── */

type DetailedSkill = NonNullable<Candidate["resume"]>["skillsDetailed"][number];

const DEPTH_ORDER: Array<{ depth: DetailedSkill["depth"]; label: string }> = [
  { depth: "primary", label: "Core" },
  { depth: "secondary", label: "Working knowledge" },
  { depth: "exposure", label: "Exposure" },
];

/** Resume parsers title-case "React.js" into "React.Js"; fix the suffix at display time. */
export function displaySkillName(name: string): string {
  return name.replace(/\.(js|ts)$/i, (_, ext: string) => `.${ext.toLowerCase()}`);
}

export function skillChipLabel(s: Pick<DetailedSkill, "name" | "yearsUsed">): string {
  const name = displaySkillName(s.name);
  if (!s.yearsUsed) return name;
  return `${name} · ${s.yearsUsed} ${s.yearsUsed === 1 ? "yr" : "yrs"}`;
}

export function groupSkillsByDepth(skills: DetailedSkill[]): Array<{ label: string; skills: DetailedSkill[] }> {
  return DEPTH_ORDER.map(({ depth, label }) => ({ label, skills: skills.filter((s) => s.depth === depth) })).filter((g) => g.skills.length > 0);
}

/* ── Shortlist navigation, rejection reasons and the shareable summary ── */

/** Best match first, ties keep the API order, so previous/next walks the same ranking the shortlist opens with. */
export function rankCandidates(candidates: Candidate[]): Candidate[] {
  return candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.matchScore - a.c.matchScore || a.i - b.i)
    .map((x) => x.c);
}

export interface ShortlistPosition { position: number; total: number; prev: Candidate | null; next: Candidate | null }

export function shortlistPosition(ranked: Candidate[], id: string): ShortlistPosition | null {
  const i = ranked.findIndex((c) => c.id === id);
  if (i < 0) return null;
  return { position: i + 1, total: ranked.length, prev: ranked[i - 1] ?? null, next: ranked[i + 1] ?? null };
}

/** Plain-text brief for pasting into chat or email. Built only from what is visible on the page,
 *  so a locked candidate stays anonymous and no contact details leave the screen. */
/** Notice period in the employer's terms ("30-day notice", "Immediate joiner"); null when we can't read it. */
function noticePhrase(noticePeriod: string | null | undefined): string | null {
  if (!noticePeriod) return null;
  if (availabilityOf(noticePeriod).label === "Immediate") return "Immediate joiner";
  const days = noticeDays(noticePeriod);
  if (days == null || days <= 0) return null;
  return days % 30 === 0 && days >= 60 ? `${days / 30}-month notice` : `${days}-day notice`;
}

/** One line of facts for the top of the candidate page. Built from stored fields only, so it never
 *  states anything the data does not hold; parts we have no data for are left out. */
export function buildEvidenceSummary(candidate: Candidate, requirement: Pick<Requirement, "skills">, matched: string[]): string | null {
  const parts: string[] = [];
  const score = interviewScore(candidate);
  if (score != null) parts.push(`Interview score ${score} across ${plural(candidate.sessionsCompleted, "practice interview")}`);
  if (requirement.skills.length > 0) parts.push(`${matched.length} of ${requirement.skills.length} required skills`);
  if (candidate.city && candidate.city !== "Not specified") parts.push(candidate.city);
  const notice = noticePhrase(candidate.resume?.noticePeriod);
  if (notice) parts.push(notice);
  return parts.length > 0 ? `${parts.join(", ")}.` : null;
}

export function buildCandidateSummary(candidate: Candidate, requirement: Requirement, matched: string[], evidence: CandidateEvidence | null, url: string): string {
  const rows = buildRoleFit(candidate, requirement, matched, evidence);
  const fit = summarizeFit(rows);
  const resume = candidate.resume;
  const average = evidenceAverage(evidence);
  const missing = requirement.skills.filter((s) => !matched.includes(s));
  const lines = [
    `${maskedName(candidate)} for ${requirement.title}`,
    `Match: ${candidate.matchScore} out of 100 (${candidateSignal(candidate.matchScore, fit).label.toLowerCase()})${fitHeadline(fit) ? `, ${fitHeadline(fit)}` : ""}`,
    `Stage: ${CANDIDATE_STATUS_LABEL[candidate.candidateStatus]}`,
    resume?.yearsExperience != null && `Experience: ${formatYears(resume.yearsExperience)}${resume.seniorityLevel ? `, ${resume.seniorityLevel}` : ""}`,
    candidate.city && candidate.city !== "Not specified" && `Location: ${candidate.city}`,
    matched.length > 0 && `Matched skills: ${matched.join(", ")}`,
    missing.length > 0 && `Missing skills: ${missing.join(", ")}`,
    fit.gaps.length > 0 && `Gaps: ${fit.gaps.join(", ")}`,
    candidate.sessionsCompleted > 0 && `Practice: ${candidate.sessionsCompleted} graded session${candidate.sessionsCompleted === 1 ? "" : "s"}${average != null ? `, average skill score ${average}` : ""}`,
    url,
  ];
  return lines.filter(Boolean).join("\n");
}
