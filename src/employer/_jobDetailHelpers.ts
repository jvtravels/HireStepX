/* Pure derivations behind the employer job details screen: skill tiers, the
   per-candidate fit/gap/availability/evidence cells, tab membership and the
   job summaries. Everything here is computed from fields the API
   already returns, so the screen never invents data. */

import type { Candidate, CandidateStatus, Requirement } from "./mockData";

const SKILL_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  reactjs: "react",
  "react js": "react",
  nodejs: "node",
  "node js": "node",
  nextjs: "next",
  "next js": "next",
  vuejs: "vue",
  "vue js": "vue",
  golang: "go",
  postgres: "postgresql",
  k8s: "kubernetes",
  "c#": "csharp",
  ml: "machine learning",
  ai: "artificial intelligence",
};

/** Comparison key for a skill: "ReactJS", "react.js" and "React" are one skill.
    Used on both sides of every comparison, so a false gap can only come from a
    skill that is genuinely absent. */
export function skillKey(raw: string): string {
  const base = raw
    .trim()
    .toLowerCase()
    .replace(/[.\-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const aliased = SKILL_ALIASES[base] ?? base;
  return aliased.length > 3 && aliased.endsWith("s") && !aliased.endsWith("ss") ? aliased.slice(0, -1) : aliased;
}

const key = skillKey;

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const v = raw.trim();
    if (v && !seen.has(key(v))) {
      seen.add(key(v));
      out.push(v);
    }
  }
  return out;
}

/* ── Key requirements ── */

/** niceToHave is saved as prose. Only short comma/line separated tokens read
    as chips; a sentence stays out rather than turning into a wall of tags. */
export function parseNiceToHave(text: string): string[] {
  if (!text.trim()) return [];
  const tokens = text
    .split(/[,;\n•·]+/)
    .map((s) => s.replace(/^[-*\s]+/, "").replace(/[.\s]+$/, ""))
    .filter((s) => s.length >= 2 && s.length <= 32 && s.split(/\s+/).length <= 4);
  return dedupe(tokens).slice(0, 8);
}

export interface SkillTiers {
  mustHave: string[];
  other: string[];
  niceToHave: string[];
}

export function skillTiers(r: Pick<Requirement, "skills" | "customSkillSets" | "niceToHave">): SkillTiers {
  const mustHave = dedupe(r.skills);
  const taken = new Set(mustHave.map(key));
  const other = dedupe(r.customSkillSets).filter((s) => !taken.has(key(s)));
  other.forEach((s) => taken.add(key(s)));
  const niceToHave = parseNiceToHave(r.niceToHave).filter((s) => !taken.has(key(s)));
  return { mustHave, other, niceToHave };
}

/* ── Candidate cells ── */

export function skillFit(candidateSkills: string[], required: string[]): { matched: string[]; gaps: string[] } {
  const have = new Set(candidateSkills.map(key));
  const matched: string[] = [];
  const gaps: string[] = [];
  for (const skill of dedupe(required)) (have.has(key(skill)) ? matched : gaps).push(skill);
  return { matched, gaps };
}

export type AvailabilityTone = "good" | "soon" | "unknown";

export interface Availability {
  label: string;
  tone: AvailabilityTone;
}

const IMMEDIATE = /\b(immediate(ly)?|no notice|available now|notice\s*:?\s*none|0\s*days?)\b/i;

/** Parses the candidate's self-reported notice period. Anything we can't read
    stays as their own words, never a guess. */
export function availabilityOf(noticePeriod: string | null | undefined): Availability {
  const raw = (noticePeriod ?? "").trim();
  if (!raw) return { label: "Not stated", tone: "unknown" };
  if (IMMEDIATE.test(raw)) return { label: "Immediate", tone: "good" };
  const m = raw.match(/(\d+(?:\.\d+)?)\s*(day|week|month|mo)/i);
  if (!m) return { label: raw.length > 28 ? `${raw.slice(0, 27).trimEnd()}…` : raw, tone: "unknown" };
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const days = Math.round(unit.startsWith("day") ? n : unit.startsWith("week") ? n * 7 : n * 30);
  if (days <= 0) return { label: "Immediate", tone: "good" };
  const tone: AvailabilityTone = days <= 15 ? "good" : "soon";
  if (days <= 45) return { label: `Available in ${days} days`, tone };
  const months = Math.round(days / 30);
  return { label: `Available in ${months} months`, tone };
}

/** rosterScore defaults to 50 server-side for someone who never practised, so
    it only counts once at least one graded session exists. */
export function interviewScore(c: Pick<Candidate, "rosterScore" | "sessionsCompleted">): number | null {
  return c.sessionsCompleted > 0 ? Math.round(c.rosterScore) : null;
}

export type ScoreTone = "success" | "warning" | "error";

/** Same cut-offs as the per-skill evidence report. */
export function scoreTone(score: number): ScoreTone {
  return score >= 70 ? "success" : score >= 50 ? "warning" : "error";
}

/* ── Tabs ── */

export type CandidateTab = "all" | "interviewing" | "hired" | "not_a_fit";

const NOT_A_FIT: ReadonlySet<CandidateStatus> = new Set(["rejected", "not_a_fit"]);
const INTERVIEWING: ReadonlySet<CandidateStatus> = new Set(["interview_invited", "interviewing"]);

export const TAB_LABEL: Record<CandidateTab, string> = {
  all: "All candidates",
  interviewing: "Interviewing",
  hired: "Hired",
  not_a_fit: "Not a fit",
};

export function inTab(c: Pick<Candidate, "matchScore" | "candidateStatus">, tab: CandidateTab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "interviewing":
      return INTERVIEWING.has(c.candidateStatus);
    case "hired":
      return c.candidateStatus === "hired";
    case "not_a_fit":
      return NOT_A_FIT.has(c.candidateStatus);
  }
}

export function tabCounts(candidates: Array<Pick<Candidate, "matchScore" | "candidateStatus">>): Record<CandidateTab, number> {
  const out: Record<CandidateTab, number> = { all: candidates.length, interviewing: 0, hired: 0, not_a_fit: 0 };
  for (const c of candidates) {
    if (INTERVIEWING.has(c.candidateStatus)) out.interviewing += 1;
    if (c.candidateStatus === "hired") out.hired += 1;
    if (NOT_A_FIT.has(c.candidateStatus)) out.not_a_fit += 1;
  }
  return out;
}

/** Hired only earns a tab once someone is hired, so the bar stays short. The
    tab being viewed always stays, so rejecting or moving the last candidate
    never makes the active tab vanish. */
export function visibleTabs(counts: Record<CandidateTab, number>, active?: CandidateTab): CandidateTab[] {
  const tabs: CandidateTab[] = ["all", "interviewing"];
  if (counts.hired > 0 || active === "hired") tabs.push("hired");
  tabs.push("not_a_fit");
  return tabs;
}

export interface PipelineRow {
  key: "evaluated" | "interviewing" | "hired" | "not_a_fit";
  label: string;
  count: number;
  tab: CandidateTab;
}

/** One row per candidate tab, so every row opens the list it counts. */
export function pipelineRows(counts: Record<CandidateTab, number>): PipelineRow[] {
  return [
    { key: "evaluated", label: "Evaluated", count: counts.all, tab: "all" },
    { key: "interviewing", label: "Interviewing", count: counts.interviewing, tab: "interviewing" },
    { key: "hired", label: "Hired", count: counts.hired, tab: "hired" },
    { key: "not_a_fit", label: "Not a fit", count: counts.not_a_fit, tab: "not_a_fit" },
  ];
}

export interface EvidenceSources {
  resume: boolean;
  interviews: number;
  github: number;
  web: number;
  total: number;
}

/** What backs a candidate's profile, counted from what the API returned: the
    resume, graded mock interviews (as one source) and each shared link. */
export function evidenceSources(c: Pick<Candidate, "resume" | "sessionsCompleted" | "portfolioLinks">): EvidenceSources {
  const links = c.portfolioLinks ?? [];
  const github = links.filter((l) => /(^|\/\/|\.)github\.com\b/i.test(l.url)).length;
  const web = links.length - github;
  const resume = c.resume != null;
  const interviews = c.sessionsCompleted > 0 ? c.sessionsCompleted : 0;
  return { resume, interviews, github, web, total: (resume ? 1 : 0) + (interviews > 0 ? 1 : 0) + links.length };
}

/* ── Job status + summaries ── */

export type JobStatusTone = "success" | "info" | "neutral" | "warning" | "error";

export function jobStatusPill(status: Requirement["status"]): { label: string; tone: JobStatusTone } {
  switch (status) {
    case "ready":
    case "partial":
      return { label: "Active", tone: "success" };
    case "generating":
      return { label: "Matching", tone: "info" };
    case "closed":
      return { label: "Closed", tone: "neutral" };
    case "zero":
      return { label: "No matches", tone: "warning" };
    case "failed":
      return { label: "Needs attention", tone: "error" };
  }
}

export interface MatchingSummary {
  state: "running" | "complete" | "stopped";
  evaluated: number;
  /** 0 to 100, share of the matched pool we show and score. */
  coverage: number;
}

export function matchingSummary(r: Pick<Requirement, "status" | "totalMatched" | "candidates">): MatchingSummary {
  const evaluated = r.candidates.length;
  const pool = Math.max(r.totalMatched ?? 0, evaluated);
  return {
    state: r.status === "generating" ? "running" : r.status === "failed" || r.status === "zero" ? "stopped" : "complete",
    evaluated,
    coverage: pool === 0 ? 0 : Math.round((evaluated / pool) * 100),
  };
}

export interface JobInsight {
  id: string;
  text: string;
}

/** Plain-language observations, emitted only when the data supports them. */
export function jobInsights(r: Pick<Requirement, "skills" | "portfolioRequired" | "candidates">): JobInsight[] {
  const out: JobInsight[] = [];
  const list = r.candidates;
  if (list.length === 0) return out;

  const must = dedupe(r.skills);
  if (must.length > 0) {
    const gapCount = new Map<string, number>();
    let meetsAll = 0;
    for (const c of list) {
      const { gaps } = skillFit(c.skills, must);
      if (gaps.length === 0) meetsAll += 1;
      for (const g of gaps) gapCount.set(g, (gapCount.get(g) ?? 0) + 1);
    }
    if (meetsAll > 0) out.push({ id: "all-must", text: `${meetsAll} ${meetsAll === 1 ? "candidate meets" : "candidates meet"} every must-have skill.` });
    const top = [...gapCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2 && top[1] / list.length >= 0.4) out.push({ id: "top-gap", text: `${top[0]} is the most common gap, missing for ${top[1]} candidates.` });
  }

  const proven = list.filter((c) => (interviewScore(c) ?? 0) >= 70).length;
  if (proven > 0) out.push({ id: "interview", text: `${proven} ${proven === 1 ? "candidate scores" : "candidates score"} 70 or higher in HireStepX mock interviews.` });

  const withLinks = list.filter((c) => (c.portfolioLinks?.length ?? 0) > 0).length;
  if (withLinks > 0) out.push({ id: "portfolio", text: `${withLinks} ${withLinks === 1 ? "candidate shares" : "candidates share"} portfolio or GitHub links.` });

  const quick = list.filter((c) => availabilityOf(c.resume?.noticePeriod).label === "Immediate").length;
  if (quick > 0) out.push({ id: "immediate", text: `${quick} ${quick === 1 ? "candidate is" : "candidates are"} available immediately.` });

  return out.slice(0, 4);
}
