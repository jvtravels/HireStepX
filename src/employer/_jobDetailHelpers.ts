/* Pure derivations behind the employer job details screen: skill tiers, the
   per-candidate fit/gap/availability/evidence cells, tab membership and the
   job summaries. Everything here is computed from fields the API
   already returns, so the screen never invents data. */

import type { Candidate, CandidateStatus, Requirement } from "./mockData";
import { matchRequiredSkills } from "../skillNormalize";
import { REJECT_REASONS, parseRejectReasons, type RejectReason } from "./_passReasons";

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

/** Free text from the resume where a required skill may be named without being listed as a skill. */
export function resumeCorpus(candidate: Candidate): string {
  const r = candidate.resume;
  if (!r) return "";
  return [
    r.headline,
    r.summary,
    ...r.keyAchievements,
    ...r.certifications,
    ...r.experience.flatMap((e) => [e.title, e.scope ?? "", ...(e.topProjects ?? []), ...(e.bullets ?? [])]),
  ].filter(Boolean).join("\n");
}

/** Every skill name we hold for the candidate, from the flat list and the depth-graded one. */
export function candidateSkillNames(candidate: Candidate): string[] {
  return [...candidate.skills, ...(candidate.resume?.skillsDetailed.map((s) => s.name) ?? [])];
}

/** Matched/gap split of the required skills. Pass the resume text so a skill
    named in the candidate's work history counts, exactly as on the candidate page. */
export function skillFit(candidateSkills: string[], required: string[], corpus = ""): { matched: string[]; gaps: string[] } {
  const have = new Set(candidateSkills.map(key));
  const alsoMatched = new Set(matchRequiredSkills(required, candidateSkills, corpus));
  const matched: string[] = [];
  const gaps: string[] = [];
  for (const skill of dedupe(required)) (have.has(key(skill)) || alsoMatched.has(skill) ? matched : gaps).push(skill);
  return { matched, gaps };
}

/** skillFit over everything we hold for one candidate. */
export function candidateSkillFit(candidate: Candidate, required: string[]): { matched: string[]; gaps: string[] } {
  return skillFit(candidateSkillNames(candidate), required, resumeCorpus(candidate));
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

/** Named sources other than interviews, so the table can say what backs a
    profile instead of showing icons the employer has to decode. */
export function evidenceLabels(e: Pick<EvidenceSources, "resume" | "github" | "web">): string[] {
  const out: string[] = [];
  if (e.resume) out.push("Resume");
  if (e.github > 0) out.push("GitHub");
  if (e.web > 0) out.push("Portfolio");
  return out;
}

/** The first GitHub link and the first other link a candidate shared, so the
    table can open them directly. The API sends none for a locked match. */
export function evidenceLinks(c: Pick<Candidate, "portfolioLinks">): { github: string | null; web: string | null } {
  const links = (c.portfolioLinks ?? []).filter((l) => /^https?:\/\//i.test(l.url));
  const github = links.find((l) => /(^|\/\/|\.)github\.com\b/i.test(l.url));
  const web = links.find((l) => l !== github && !/(^|\/\/|\.)github\.com\b/i.test(l.url));
  return { github: github?.url ?? null, web: web?.url ?? null };
}

/* ── Job status + summaries ── */

export type JobStatusTone = "success" | "brand" | "neutral" | "warning" | "error";

export function jobStatusPill(status: Requirement["status"]): { label: string; tone: JobStatusTone } {
  switch (status) {
    case "ready":
    case "partial":
      return { label: "Active", tone: "success" };
    case "generating":
      return { label: "Matching", tone: "brand" };
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

/** What clicking an insight narrows the candidate list to. Carries its own
    data so the filter never depends on the page re-deriving it. */
export type InsightFilter =
  | { kind: "all-must"; skills: string[] }
  | { kind: "gap"; skill: string }
  | { kind: "interview" }
  | { kind: "portfolio" }
  | { kind: "immediate" }
  | { kind: "overdue" }
  | { kind: "recent" }
  | { kind: "waiting" }
  | { kind: "pass-reason"; reason: string };

/** Practiced this recently counts as actively preparing, so an invite is likely to land. */
export const RECENT_ACTIVITY_DAYS = 3;

/** An interview whose date has passed while the candidate is still at an interview stage: the employer owes an outcome. */
export function interviewOverdue(c: Candidate, now = Date.now()): boolean {
  if (c.candidateStatus !== "interview_invited" && c.candidateStatus !== "interviewing") return false;
  if (!c.interviewScheduledAt) return false;
  const at = new Date(c.interviewScheduledAt).getTime();
  return !Number.isNaN(at) && at < now;
}

/** An unlocked candidate still waiting for a decision this long means the employer paid and then stalled. */
export const WAITING_DAYS = 5;

export function waitingDays(c: Candidate, now = Date.now()): number | null {
  if (!c.unlocked || c.candidateStatus !== "shortlisted" || !c.waitingSince) return null;
  const since = new Date(c.waitingSince).getTime();
  if (Number.isNaN(since)) return null;
  return Math.floor((now - since) / 86_400_000);
}

export interface JobInsight {
  id: string;
  text: string;
  label: string;
  filter: InsightFilter;
}

export function matchesInsight(c: Candidate, f: InsightFilter, now = Date.now()): boolean {
  switch (f.kind) {
    case "all-must":
      return candidateSkillFit(c, f.skills).gaps.length === 0;
    case "gap":
      return candidateSkillFit(c, [f.skill]).gaps.length > 0;
    case "interview":
      return (interviewScore(c) ?? 0) >= 70;
    case "portfolio":
      return (c.portfolioLinks?.length ?? 0) > 0;
    case "immediate":
      return availabilityOf(c.resume?.noticePeriod).label === "Immediate";
    case "overdue":
      return interviewOverdue(c, now);
    case "recent":
      return c.candidateStatus === "shortlisted" && c.lastActiveDaysAgo >= 0 && c.lastActiveDaysAgo <= RECENT_ACTIVITY_DAYS;
    case "waiting":
      return (waitingDays(c, now) ?? -1) >= WAITING_DAYS;
    case "pass-reason":
      return c.candidateStatus === "rejected" && parseRejectReasons(c.candidateStatusNote).some((r) => r === f.reason);
  }
}

/** Reasons given when passing on candidates, most common first (ties keep the dialog's order). */
export function passReasonCounts(list: Candidate[]): { reasons: Array<[RejectReason, number]>; withReasons: number } {
  const counts = new Map<RejectReason, number>();
  let withReasons = 0;
  for (const c of list) {
    if (c.candidateStatus !== "rejected") continue;
    const given = parseRejectReasons(c.candidateStatusNote);
    if (given.length === 0) continue;
    withReasons += 1;
    for (const r of given) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const order = (r: RejectReason) => REJECT_REASONS.indexOf(r);
  const reasons = [...counts.entries()].sort((a, b) => b[1] - a[1] || order(a[0]) - order(b[0]));
  return { reasons, withReasons };
}

/** Plain-language observations, emitted only when the data supports them. */
export function jobInsights(r: Pick<Requirement, "skills" | "portfolioRequired" | "candidates">, now = Date.now()): JobInsight[] {
  const out: JobInsight[] = [];
  const list = r.candidates;
  if (list.length === 0) return out;

  /* Things the employer owes someone come first; the 4-item cap drops the descriptive ones. */
  const overdue = list.filter((c) => interviewOverdue(c, now)).length;
  if (overdue > 0) {
    out.push({ id: "overdue", text: `${overdue} ${overdue === 1 ? "interview is" : "interviews are"} past the scheduled date. Record the outcome.`, label: "Interview date passed", filter: { kind: "overdue" } });
  }

  const waiting = list.filter((c) => matchesInsight(c, { kind: "waiting" }, now)).length;
  if (waiting > 0) {
    out.push({ id: "waiting", text: `${waiting} unlocked ${waiting === 1 ? "candidate has" : "candidates have"} had no update for ${WAITING_DAYS}+ days. Move them forward or close them.`, label: `No update for ${WAITING_DAYS}+ days`, filter: { kind: "waiting" } });
  }

  const must = dedupe(r.skills);
  if (must.length > 0) {
    const gapCount = new Map<string, number>();
    let meetsAll = 0;
    for (const c of list) {
      const { gaps } = candidateSkillFit(c, must);
      if (gaps.length === 0) meetsAll += 1;
      for (const g of gaps) gapCount.set(g, (gapCount.get(g) ?? 0) + 1);
    }
    if (meetsAll > 0) {
      out.push({
        id: "all-must",
        text: `${meetsAll} ${meetsAll === 1 ? "candidate meets" : "candidates meet"} every must-have skill.`,
        label: "Meets every must-have",
        filter: { kind: "all-must", skills: must },
      });
    }
    const top = [...gapCount.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 2 && top[1] / list.length >= 0.4) {
      out.push({ id: "top-gap", text: `${top[0]} is the most common gap, missing for ${top[1]} candidates.`, label: `Missing ${top[0]}`, filter: { kind: "gap", skill: top[0] } });
    }
  }

  const passes = passReasonCounts(list);
  const topPass = passes.reasons[0];
  if (topPass && topPass[1] >= 2) {
    out.push({
      id: "pass-reason",
      text: `${topPass[0]} is the top reason you passed, given for ${topPass[1]} of ${passes.withReasons} ${passes.withReasons === 1 ? "candidate" : "candidates"}.`,
      label: `Passed: ${topPass[0].toLowerCase()}`,
      filter: { kind: "pass-reason", reason: topPass[0] },
    });
  }

  const proven = list.filter((c) => matchesInsight(c, { kind: "interview" })).length;
  if (proven > 0) {
    out.push({ id: "interview", text: `${proven} ${proven === 1 ? "candidate scores" : "candidates score"} 70 or higher in HireStepX mock interviews.`, label: "Interview score 70+", filter: { kind: "interview" } });
  }

  const recent = list.filter((c) => matchesInsight(c, { kind: "recent" })).length;
  if (recent > 0) {
    out.push({ id: "recent", text: `${recent} ${recent === 1 ? "candidate" : "candidates"} to review practiced in the last ${RECENT_ACTIVITY_DAYS} days.`, label: `Practiced in the last ${RECENT_ACTIVITY_DAYS} days`, filter: { kind: "recent" } });
  }

  const withLinks = list.filter((c) => matchesInsight(c, { kind: "portfolio" })).length;
  if (withLinks > 0) {
    out.push({ id: "portfolio", text: `${withLinks} ${withLinks === 1 ? "candidate shares" : "candidates share"} portfolio or GitHub links.`, label: "Shares portfolio or GitHub", filter: { kind: "portfolio" } });
  }

  const quick = list.filter((c) => matchesInsight(c, { kind: "immediate" })).length;
  if (quick > 0) {
    out.push({ id: "immediate", text: `${quick} ${quick === 1 ? "candidate is" : "candidates are"} available immediately.`, label: "Available immediately", filter: { kind: "immediate" } });
  }

  return out.slice(0, 4);
}
