/* Pure derivations behind the employer job details screen: skill tiers, the
   per-candidate fit/gap/availability/evidence cells, tab membership and the
   right-rail summaries. Everything here is computed from fields the API
   already returns, so the screen never invents data. */

import type { Candidate, CandidateStatus, Requirement } from "./mockData";
import { STRONG_MATCH_THRESHOLD } from "../../server-handlers/_requirement-match-helpers";

const key = (s: string): string => s.trim().toLowerCase();

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
  important: string[];
  niceToHave: string[];
}

export function skillTiers(r: Pick<Requirement, "skills" | "customSkillSets" | "niceToHave">): SkillTiers {
  const mustHave = dedupe(r.skills);
  const taken = new Set(mustHave.map(key));
  const important = dedupe(r.customSkillSets).filter((s) => !taken.has(key(s)));
  important.forEach((s) => taken.add(key(s)));
  const niceToHave = parseNiceToHave(r.niceToHave).filter((s) => !taken.has(key(s)));
  return { mustHave, important, niceToHave };
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

export type EvidenceKind = "resume" | "web" | "github" | "practice";

export interface EvidenceSources {
  count: number;
  kinds: EvidenceKind[];
}

export function evidenceSources(c: Pick<Candidate, "resume" | "portfolioLinks" | "sessionsCompleted">): EvidenceSources {
  const kinds = new Set<EvidenceKind>();
  let count = 0;
  if (c.resume) {
    kinds.add("resume");
    count += 1;
  }
  for (const link of c.portfolioLinks ?? []) {
    kinds.add(/github\.com/i.test(link.url) ? "github" : "web");
    count += 1;
  }
  if (c.resume?.linkedin) {
    kinds.add("web");
    count += 1;
  }
  if (c.sessionsCompleted > 0) {
    kinds.add("practice");
    count += 1;
  }
  const order: EvidenceKind[] = ["resume", "web", "github", "practice"];
  return { count, kinds: order.filter((k) => kinds.has(k)) };
}

/* ── Tabs ── */

export type CandidateTab = "recommended" | "all" | "interviewing" | "hired" | "not_a_fit";

const NOT_A_FIT: ReadonlySet<CandidateStatus> = new Set(["rejected", "not_a_fit"]);
const INTERVIEWING: ReadonlySet<CandidateStatus> = new Set(["interview_invited", "interviewing"]);

export const TAB_LABEL: Record<CandidateTab, string> = {
  recommended: "Recommended",
  all: "All candidates",
  interviewing: "Interviewing",
  hired: "Hired",
  not_a_fit: "Not a fit",
};

export function isRecommended(c: Pick<Candidate, "matchScore" | "candidateStatus">): boolean {
  return c.matchScore >= STRONG_MATCH_THRESHOLD && !NOT_A_FIT.has(c.candidateStatus);
}

export function inTab(c: Pick<Candidate, "matchScore" | "candidateStatus">, tab: CandidateTab): boolean {
  switch (tab) {
    case "all":
      return true;
    case "recommended":
      return isRecommended(c);
    case "interviewing":
      return INTERVIEWING.has(c.candidateStatus);
    case "hired":
      return c.candidateStatus === "hired";
    case "not_a_fit":
      return NOT_A_FIT.has(c.candidateStatus);
  }
}

export function tabCounts(candidates: Array<Pick<Candidate, "matchScore" | "candidateStatus">>): Record<CandidateTab, number> {
  const out: Record<CandidateTab, number> = { recommended: 0, all: candidates.length, interviewing: 0, hired: 0, not_a_fit: 0 };
  for (const c of candidates) {
    if (isRecommended(c)) out.recommended += 1;
    if (INTERVIEWING.has(c.candidateStatus)) out.interviewing += 1;
    if (c.candidateStatus === "hired") out.hired += 1;
    if (NOT_A_FIT.has(c.candidateStatus)) out.not_a_fit += 1;
  }
  return out;
}

/** Hired only earns a tab once someone is hired, so the bar stays short. */
export function visibleTabs(counts: Record<CandidateTab, number>): CandidateTab[] {
  const tabs: CandidateTab[] = ["recommended", "all", "interviewing"];
  if (counts.hired > 0) tabs.push("hired");
  tabs.push("not_a_fit");
  return tabs;
}

/* ── Job status + right rail ── */

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
  recommended: number;
  /** 0 to 100, share of the matched pool we show and score. */
  coverage: number;
}

export function matchingSummary(r: Pick<Requirement, "status" | "totalMatched" | "candidates">): MatchingSummary {
  const evaluated = r.candidates.length;
  const pool = Math.max(r.totalMatched ?? 0, evaluated);
  return {
    state: r.status === "generating" ? "running" : r.status === "failed" || r.status === "zero" ? "stopped" : "complete",
    evaluated,
    recommended: r.candidates.filter(isRecommended).length,
    coverage: pool === 0 ? 0 : Math.round((evaluated / pool) * 100),
  };
}

export interface PipelineRow {
  tab: CandidateTab;
  label: string;
  count: number;
  highlight: boolean;
}

export function pipelineRows(counts: Record<CandidateTab, number>): PipelineRow[] {
  return [
    { tab: "all", label: "Evaluated", count: counts.all, highlight: false },
    { tab: "recommended", label: "Recommended", count: counts.recommended, highlight: true },
    { tab: "interviewing", label: "Interviewing", count: counts.interviewing, highlight: false },
    { tab: "hired", label: "Hired", count: counts.hired, highlight: false },
  ];
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

  const strong = list.filter(isRecommended).length;
  if (strong > 0) out.push({ id: "strong", text: `${strong} of ${list.length} candidates are a strong match for this role.` });

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

  const withLinks = list.filter((c) => (c.portfolioLinks?.length ?? 0) > 0).length;
  if (withLinks > 0) out.push({ id: "portfolio", text: `${withLinks} ${withLinks === 1 ? "candidate shares" : "candidates share"} portfolio or GitHub links.` });

  const quick = list.filter((c) => availabilityOf(c.resume?.noticePeriod).label === "Immediate").length;
  if (quick > 0) out.push({ id: "immediate", text: `${quick} ${quick === 1 ? "candidate is" : "candidates are"} available immediately.` });

  return out.slice(0, 4);
}
