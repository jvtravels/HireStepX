import type { Candidate } from "@/employer/mockData";
import { candidateSkillFit, interviewScore } from "@/employer/_jobDetailHelpers";
import { candidateDisplayName } from "./requirementFormat";

export type CompareMetric = "match" | "skills" | "interview" | "sessions";

interface Facts {
  id: string;
  name: string;
  match: number | null;
  matched: number;
  required: number;
  gaps: string[];
  interview: number | null;
  sessions: number;
}

/* Smallest gap that counts as a real difference; below it the page says nothing, so noise is never presented as insight. */
const MIN_GAP: Record<CompareMetric, number> = { match: 5, skills: 1, interview: 10, sessions: 2 };
const LABEL: Record<CompareMetric, string> = { match: "job match", skills: "required skills", interview: "interview score", sessions: "practice sessions" };

function factsOf(c: Candidate, required: string[]): Facts {
  const { matched, gaps } = candidateSkillFit(c, required);
  return {
    id: c.id,
    name: candidateDisplayName(c),
    match: Number.isFinite(c.matchScore) ? Math.round(c.matchScore) : null,
    matched: matched.length,
    required: matched.length + gaps.length,
    gaps,
    interview: interviewScore(c),
    sessions: c.sessionsCompleted,
  };
}

function value(f: Facts, m: CompareMetric): number | null {
  return m === "match" ? f.match : m === "skills" ? (f.required > 0 ? f.matched : null) : m === "interview" ? f.interview : f.sessions;
}

/** The candidate ids that clearly lead on a metric. Empty when fewer than two have a value or the top is not ahead by a real margin. */
export function metricLeaders(candidates: Candidate[], required: string[], metric: CompareMetric): Set<string> {
  const rows = candidates.map((c) => factsOf(c, required)).flatMap((f) => { const v = value(f, metric); return v === null ? [] : [{ id: f.id, v }]; });
  if (rows.length < 2) return new Set();
  const sorted = [...rows].sort((a, b) => b.v - a.v);
  if (sorted[0].v - sorted[1].v < MIN_GAP[metric]) return new Set();
  return new Set([sorted[0].id]);
}

export interface CompareNote {
  id: string;
  tone: "positive" | "action" | "attention" | "neutral";
  title: string;
  body: string;
}

export interface CompareSummary {
  differences: CompareNote[];
  questions: CompareNote[];
  /** How many of the four measures each candidate clearly leads on. */
  leads: Map<string, number>;
}

const unit = (m: CompareMetric, v: number, f: Facts): string => (m === "interview" ? `${v}/100` : m === "skills" ? `${v} of ${f.required}` : `${v}`);

export function summarizeComparison(candidates: Candidate[], required: string[]): CompareSummary {
  const facts = candidates.map((c) => factsOf(c, required));
  const byId = new Map(facts.map((f) => [f.id, f]));
  const differences: CompareNote[] = [];
  const leads = new Map(facts.map((f) => [f.id, 0]));
  const leaderOf = new Map<CompareMetric, string>();

  (["match", "interview", "skills", "sessions"] as CompareMetric[]).forEach((m) => {
    const [id] = metricLeaders(candidates, required, m);
    if (!id) return;
    leaderOf.set(m, id);
    leads.set(id, (leads.get(id) ?? 0) + 1);
    const top = byId.get(id)!;
    const others = facts.filter((f) => f.id !== id && value(f, m) !== null);
    const rest = others.map((f) => unit(m, value(f, m) as number, f)).join(" and ");
    differences.push({ id: `lead-${m}`, tone: "positive", title: `${top.name} leads on ${LABEL[m]}`, body: `${unit(m, value(top, m) as number, top)} against ${rest}.` });
  });

  const noInterview = facts.filter((f) => f.interview === null);
  if (noInterview.length > 0 && noInterview.length < facts.length) {
    differences.push({
      id: "no-interview",
      tone: "attention",
      title: "No graded interviews yet",
      body: `${joinNames(noInterview.map((f) => f.name))} ${noInterview.length === 1 ? "has" : "have"} none, so there is no interview evidence to compare.`,
    });
  }

  const sharedGaps = required.length > 0 ? facts.map((f) => f.gaps).reduce((a, b) => a.filter((g) => b.includes(g))) : [];
  if (sharedGaps.length > 0) {
    differences.push({ id: "shared-gaps", tone: "attention", title: `${facts.length === 2 ? "Neither" : "None"} lists ${joinNames(sharedGaps)}`, body: "This job requires it, so confirm it in the interview." });
  }

  const matchLead = leaderOf.get("match");
  const interviewLead = leaderOf.get("interview");
  if (matchLead && interviewLead && matchLead !== interviewLead) {
    differences.push({ id: "split", tone: "neutral", title: "They split", body: "One fits the job better on paper, the other has stronger interview evidence. Neither leads on every measure." });
  }

  const questions: CompareNote[] = [];
  for (const f of facts) {
    if (f.gaps.length > 0 && questions.length < 3) questions.push({ id: `gap-${f.id}`, tone: "action", title: `Ask ${f.name} about ${joinNames(f.gaps.slice(0, 3))}`, body: "They do not list it, and this job requires it." });
  }
  for (const f of facts) {
    if (f.interview !== null && f.interview < 50 && questions.length < 3) questions.push({ id: `project-${f.id}`, tone: "action", title: `Ask ${f.name} to walk through a recent project`, body: `Their practice interviews average ${f.interview}/100.` });
  }

  return { differences, questions, leads };
}

function joinNames(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** A stable string for a candidate's value in a row, so rows where everyone matches can be hidden. */
export function sameAcross(candidates: Candidate[], key: (c: Candidate) => string): boolean {
  return new Set(candidates.map(key)).size <= 1;
}
