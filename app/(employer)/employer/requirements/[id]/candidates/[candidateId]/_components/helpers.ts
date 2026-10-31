import type { Candidate, CandidateStatus } from "@/employer/mockData";
import type { Requirement, CandidateEvidence, EvidenceDelivery, EvidenceQuestion } from "@/employer/EmployerDataContext";
import { availabilityOf, candidateSkillFit, interviewScore } from "@/employer/_jobDetailHelpers";
import { CANDIDATE_STATUS_LABEL, matchBand } from "@/employer/_atoms";
import type { DotTone } from "@/employer/_panelParts";
import { formatTenure, periodMonths, roleDateMonths } from "@/employer/roleDates";
import { backgroundFitRow, payFitRow, workModeFitRow } from "./fitExtras";

/* Pure helpers for the candidate detail page. Everything here derives from
   fields the API actually returns — no synthesized or seeded values. */

export const READINESS_LABEL: Record<"strongHire" | "hire" | "leanHire", string> = {
  strongHire: "Strong interview readiness",
  hire: "Interview ready",
  leanHire: "Nearly interview ready",
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

/** The one practice number for this page: the mean of the graded sessions we can list, so the header,
 *  summary and Practice history agree. The stored roster average also covers sessions that are not
 *  graded for employers, so it is only the fallback while evidence is missing (locked or loading). */
export function gradedScore(candidate: Pick<Candidate, "rosterScore" | "sessionsCompleted">, evidence: CandidateEvidence | null): number | null {
  const trend = evidence?.sessionTrend ?? [];
  if (trend.length > 0) return Math.round(trend.reduce((sum, t) => sum + t.score, 0) / trend.length);
  return interviewScore(candidate);
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

/** The one experience figure shown everywhere: role dates when readable (owner decision, Oct 31 2026), else the resume's stored whole years. */
export function formatExperience(months: number): string {
  return months % 12 === 0 ? formatYears(months / 12) : formatTenure(months);
}

export function experienceMonthsOf(r: { experience: ReadonlyArray<{ period: string }>; yearsExperience: number | null; roleMonths?: number | null } | null | undefined): number | null {
  if (!r) return null;
  return r.roleMonths ?? roleDateMonths(r.experience ?? []) ?? (r.yearsExperience != null ? r.yearsExperience * 12 : null);
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
  const expMonths = experienceMonthsOf(r);
  const years = expMonths != null ? ` with ${formatExperience(expMonths)} of experience` : "";
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
  resume: "Self-reported, from the resume",
  profile: "Self-reported, from the candidate profile",
  practice: "Graded in practice interviews",
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

export { formatTenure, periodMonths, roleDateMonths };

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
  const expMonths = experienceMonthsOf(r);
  if (expMonths != null && (min != null || max != null)) {
    const y = expMonths / 12;
    const gap = (n: number) => formatExperience(Math.round(n * 12));
    const below = min != null && y < min;
    const above = max != null && y > max;
    const status: FitStatus = !below && !above ? "meets" : (below && y >= min - 1) || (above && y <= max + 2) ? "partial" : "gap";
    const reason = below
      ? `${gap(min - y)} short of the ${formatYears(min)} asked.`
      : above
        ? `${gap(y - max)} above the ${formatYears(max)} ceiling.`
        : `${formatExperience(expMonths)} sits inside the range asked.`;
    rows.push({ id: "experience", label: "Experience", asked: experienceAsk(min, max), has: formatExperience(expMonths), status, reason, source: "resume" });
  }

  const hasCity = !!candidate.city && candidate.city !== "Not specified";
  if (hasCity && (requirement.workMode === "remote" || requirement.locations.length > 0)) {
    const inCity = requirement.locations.some((l) => l.toLowerCase().includes(candidate.city.toLowerCase()) || candidate.city.toLowerCase().includes(l.toLowerCase()));
    const remote = requirement.workMode === "remote";
    const reason = remote
      ? "The job is remote, so location does not limit them."
      : inCity
        ? `Based in ${candidate.city}, where the job is hiring.`
        : r?.openToRelocate
          ? `Based in ${candidate.city}, but open to relocating to ${requirement.locations.slice(0, 2).join(" or ")}.`
          : `Based in ${candidate.city}; the job is hiring in ${requirement.locations.slice(0, 2).join(" or ")}.`;
    rows.push({
      id: "location",
      label: "Location",
      asked: remote ? "Remote" : requirement.locations.slice(0, 2).join(", "),
      has: candidate.city,
      status: remote || inCity ? "meets" : r?.openToRelocate ? "partial" : "gap",
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

  for (const extra of [payFitRow(candidate, requirement), workModeFitRow(candidate, requirement), backgroundFitRow(candidate, requirement)]) {
    if (extra) rows.push(extra);
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
export function fitHeadline(fit: FitSummary, rows?: FitRow[]): string | null {
  if (fit.total === 0) return null;
  // A lone criterion reads oddly as "0 of 1 fully met" next to a job with many skills; say what it measured.
  if (fit.total === 1 && rows?.length === 1) return `${rows[0].label}: ${rows[0].has}`;
  const partly = fit.close.length;
  return `${fit.meets} of ${fit.total} ${fit.total === 1 ? "criterion" : "criteria"} fully met${partly > 0 ? `, ${partly} partly` : ""}`;
}

export type CandidateSignalKey = "strong" | "fair" | "low";

/** The one-word read shown beside the score. It follows the score band only, so the same number reads
 *  the same on every screen; unmet criteria are shown by the criteria card, not by a different label. */
export function candidateSignal(score: number, fit: FitSummary): { key: CandidateSignalKey; label: string; tone: DotTone } {
  const band = matchBand(score);
  if (band === "strong") return { key: "strong", label: "Strong match", tone: "good" };
  const meetsNothing = fit.total > 0 && fit.meets === 0 && fit.close.length === 0;
  if (band === "fair" && !meetsNothing) return { key: "fair", label: "Fair match", tone: "soon" };
  return { key: "low", label: "Low match", tone: "unknown" };
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
    rows.push({ id: "pace", label: "Speaking pace", value: sparse ? "Not measured" : `${w} wpm`, hint: "Easy to follow is roughly 110 to 170 words a minute.", ...(sparse ? unreliable : w < 110 ? { note: "Slow", tone: "warning" as const } : w > 170 ? { note: "Fast", tone: "warning" as const } : { note: "Easy to follow", tone: "success" as const }) });
  }
  if (d.fillersPerMin != null) {
    const f = d.fillersPerMin;
    rows.push({ id: "fillers", label: "Filler words", value: sparse || f === 0 ? "Not measured" : `${f} / min`, hint: "Counts um, uh, like, you know, so, basically and similar.", ...read(f, f <= 3 ? { note: "Low", tone: "success" } : f <= 6 ? { note: "Moderate", tone: "warning" } : { note: "High", tone: "error" }) });
  }
  if (d.responseSec != null) {
    const s = d.responseSec;
    rows.push({ id: "response", label: "Time to start answering", value: sparse || s === 0 ? "Not measured" : `${s}s`, hint: "Median pause between the question ending and the answer starting.", ...read(s, s <= 3 ? { note: "Quick", tone: "success" } : s <= 6 ? { note: "Considered", tone: "neutral" } : { note: "Slow to start", tone: "warning" }) });
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

export const VERDICT_LABEL: Record<EvidenceQuestion["verdict"], string> = { strong: "Strong", complete: "Adequate", partial: "Partial", weak: "Weak", skipped: "Skipped" };
export const VERDICT_TONE: Record<EvidenceQuestion["verdict"], "success" | "warning" | "error" | "neutral"> = { strong: "success", complete: "success", partial: "warning", weak: "error", skipped: "neutral" };
export const DIFFICULTY_LABEL: Record<NonNullable<EvidenceQuestion["difficulty"]>, string> = { warmup: "Warm-up", standard: "Standard", hard: "Hard" };
export const LENGTH_LABEL: Record<NonNullable<EvidenceQuestion["length"]>["verdict"], string> = { "too-brief": "Too brief", right: "Right length", "too-long": "Too long" };

function questionWords(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

/** Drops a later question that repeats an earlier one (the interviewer sometimes re-asks with
 *  near-identical wording), so the list and its counts don't double-count one prompt. */
/** The strongest graded answer to lead with: highest score, ties go to the one covering more STAR parts. */
/** The interviewer's opening line ("Hi, thanks for making the time... I'll be your interviewer") is rapport, not an assessed answer. */
export function isOpeningSmallTalk(question: string): boolean {
  return /^\s*(hi|hello|hey|good (morning|afternoon|evening))\b/i.test(question) || /thanks for (making|taking) the time|i'?ll be your interviewer/i.test(question);
}

export function bestGradedAnswer(questions: EvidenceQuestion[] | undefined): EvidenceQuestion | null {
  const starCount = (q: EvidenceQuestion) => (q.star ? Object.values(q.star).filter(Boolean).length : 0);
  const pool = (questions ?? []).filter((q) => q.verdict !== "skipped" && q.question.trim() && !isOpeningSmallTalk(q.question));
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => b.score - a.score || starCount(b) - starCount(a))[0];
}

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
export function noticePhrase(noticePeriod: string | null | undefined): string | null {
  if (!noticePeriod) return null;
  if (availabilityOf(noticePeriod).label === "Immediate") return "Immediate joiner";
  const days = noticeDays(noticePeriod);
  if (days == null || days <= 0) return null;
  return days % 30 === 0 && days >= 60 ? `${days / 30}-month notice` : `${days}-day notice`;
}

/** One line of facts for the top of the candidate page. Built from stored fields only, so it never
 *  states anything the data does not hold; parts we have no data for are left out. */
export function buildEvidenceSummary(candidate: Candidate, requirement: Pick<Requirement, "skills">, matched: string[], evidence: CandidateEvidence | null = null): string | null {
  const parts: string[] = [];
  const score = gradedScore(candidate, evidence);
  if (score != null) parts.push(`Overall interview score ${score} out of 100, across ${plural(candidate.sessionsCompleted, "practice interview")}`);
  if (requirement.skills.length > 0) parts.push(`${matched.length} of ${requirement.skills.length} required skills`);
  if (candidate.city && candidate.city !== "Not specified") parts.push(candidate.city);
  const notice = noticePhrase(candidate.resume?.noticePeriod);
  if (notice) parts.push(notice);
  return parts.length > 0 ? `${parts.join(", ")}.` : null;
}

/** HireStepX's own read of a candidate, composed from every stored signal: resume facts, skills,
 *  tenure, graded practice, hiring facts and fit. Sentences are only emitted for data that exists, and
 *  company names stay out so it is as safe for a locked candidate as the rest of the page. The
 *  candidate's own summary is shown separately and labelled as theirs. */
export function buildProfileSummary(candidate: Candidate, requirement: Pick<Requirement, "title" | "skills">, matched: string[], evidence: CandidateEvidence | null): string | null {
  const r = candidate.resume;
  const out: string[] = [];
  const list = (xs: string[], n = 3) => xs.slice(0, n).join(", ");

  const seniority = r?.seniorityLevel?.trim().toLowerCase();
  const expMonthsOut = experienceMonthsOf(r);
  const years = expMonthsOut != null ? formatExperience(expMonthsOut) : null;
  const where = candidate.city && candidate.city !== "Not specified" ? candidate.city : null;
  const latestTitle = r?.experience[0]?.title?.trim();
  const who = [`${seniority ? `${seniority} candidate` : "Candidate"}${years ? ` with ${years} of experience` : ""}${r?.industries?.length ? ` across ${list(r.industries, 2)}` : ""}`, where && `based in ${where}`, latestTitle && `most recently ${latestTitle}`].filter(Boolean).join(", ");
  if (years || seniority || where || latestTitle) out.push(`${who.replace(/^./, (c) => c.toUpperCase())}.`);

  const tenure = r ? averageTenureMonths(r.experience) : null;
  if (tenure != null && (r?.experience.length ?? 0) >= 2) out.push(`Stays about ${formatTenure(tenure)} per role.`);

  const primary = (r?.skillsDetailed ?? []).filter((s) => s.depth === "primary").map((s) => displaySkillName(s.name));
  const missing = requirement.skills.filter((s) => !matched.includes(s));
  if (requirement.skills.length > 0) {
    const cover = `Covers ${matched.length} of ${requirement.skills.length} skills this role asks for${matched.length > 0 ? ` (${list(matched, 4)})` : ""}`;
    out.push(`${cover}${missing.length > 0 ? `; missing ${list(missing)}` : ""}.`);
  }
  if (primary.length > 0) out.push(`Deepest in ${list(primary, 4)}.`);

  const score = gradedScore(candidate, evidence);
  if (score != null) {
    const ranked = [...(evidence?.skills ?? [])].sort((a, b) => b.score - a.score);
    const best = ranked[0];
    const weak = ranked.length > 1 ? ranked[ranked.length - 1] : null;
    const verdict = evidence?.readiness ? `, rated ${READINESS_LABEL[evidence.readiness.band].toLowerCase()}` : "";
    const spread = best ? `; strongest on ${best.name} (${best.score})${weak && weak.score < best.score ? `, weakest on ${weak.name} (${weak.score})` : ""}` : "";
    out.push(`Scored ${score} across ${candidate.sessionsCompleted} graded practice interview${candidate.sessionsCompleted === 1 ? "" : "s"}${verdict}${spread}.`);
  } else {
    out.push("Has not completed a graded practice interview yet.");
  }

  const ctc = r?.expectedCtc ?? r?.expectedCtcBand;
  const notice = noticePhrase(r?.noticePeriod);
  const mode = r?.workModePref ? { onsite: "on-site", hybrid: "hybrid", remote: "remote" }[r.workModePref as "onsite" | "hybrid" | "remote"] : null;
  const terms = [notice, ctc && `expects ${ctc}`, mode && `prefers ${mode} work`, r?.openToRelocate && "open to relocating"].filter(Boolean);
  if (terms.length > 0) out.push(`${terms.join(", ").replace(/^./, (c) => c.toUpperCase())}.`);

  const unshared = [!r?.noticePeriod && "notice period", !r?.currentCtc && "current CTC", !ctc && "expected CTC"].filter(Boolean);
  if (unshared.length > 0) out.push(`Not yet shared: ${unshared.join(", ")}.`);

  return out.length > 0 ? out.join(" ") : null;
}

export function buildCandidateSummary(candidate: Candidate, requirement: Requirement, matched: string[], evidence: CandidateEvidence | null, url: string): string {
  const rows = buildRoleFit(candidate, requirement, matched, evidence);
  const fit = summarizeFit(rows);
  const resume = candidate.resume;
  const average = evidenceAverage(evidence);
  const missing = requirement.skills.filter((s) => !matched.includes(s));
  const lines = [
    `${maskedName(candidate)} for ${requirement.title}`,
    `Match: ${candidate.matchScore} out of 100 (${candidateSignal(candidate.matchScore, fit).label.toLowerCase()})${fitHeadline(fit, rows) ? `, ${fitHeadline(fit, rows)}` : ""}`,
    `Stage: ${CANDIDATE_STATUS_LABEL[candidate.candidateStatus]}`,
    experienceMonthsOf(resume ?? null) != null && `Experience: ${formatExperience(experienceMonthsOf(resume ?? null) ?? 0)}${resume?.seniorityLevel ? `, ${resume.seniorityLevel}` : ""}`,
    candidate.city && candidate.city !== "Not specified" && `Location: ${candidate.city}`,
    matched.length > 0 && `Matched skills: ${matched.join(", ")}`,
    missing.length > 0 && `Missing skills: ${missing.join(", ")}`,
    fit.gaps.length > 0 && `Gaps: ${fit.gaps.join(", ")}`,
    candidate.sessionsCompleted > 0 && `Practice: ${candidate.sessionsCompleted} graded session${candidate.sessionsCompleted === 1 ? "" : "s"}${average != null ? `, average skill score ${average}` : ""}`,
    url,
  ];
  return lines.filter(Boolean).join("\n");
}

/** "Confirmed today" / "Confirmed 3d ago"; stale marks a confirmation older than 30 days. */
export function availabilityConfirmedLabel(iso: string | null | undefined, nowMs: number = Date.now()): { text: string; stale: boolean } | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  const days = Math.max(0, Math.floor((nowMs - t) / 86_400_000));
  return { text: days === 0 ? "Confirmed today" : `Confirmed ${days}d ago`, stale: days > 30 };
}

/** Up to three screening questions drawn only from gaps already computed for this candidate. */
export function buildInterviewQuestions(candidate: Candidate, requirement: Pick<Requirement, "title">, unmatched: string[]): string[] {
  const questions: string[] = [];
  for (const skill of unmatched.slice(0, 2)) {
    questions.push(`Walk me through a project where you used ${skill}. What was your part, and what would you do differently?`);
  }
  const avg = averageTenureMonths(candidate.resume?.experience ?? []);
  if (avg != null && avg < 12 && (candidate.resume?.experience.length ?? 0) >= 2) {
    questions.push("What drove each of your last few moves, and what would make this role a longer stay?");
  }
  /* With no skill gaps or short stints to probe, three role-grounded openers beat one generic question. */
  const generic = [
    `What is the hardest problem you solved recently that is closest to this ${requirement.title} role?`,
    "Tell me about a piece of work you are proud of. What was your part, and how did you know it worked?",
    "Describe a time something you built or ran went wrong. What did you do next?",
  ];
  for (const q of generic) if (questions.length < 3) questions.push(q);
  return questions.slice(0, 3);
}

/** Deal-breaker facts for the header, from fields the candidate chose to share. Nothing is guessed when missing. */
export function dealBreakerParts(r: Candidate["resume"]): { key: "notice" | "pay"; text: string }[] {
  const out: { key: "notice" | "pay"; text: string }[] = [];
  const notice = noticePhrase(r?.noticePeriod);
  if (notice) out.push({ key: "notice", text: notice });
  const ask = r?.expectedCtc ?? r?.expectedCtcBand;
  if (ask) out.push({ key: "pay", text: `Expects ${ask}` });
  return out;
}
