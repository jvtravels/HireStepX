import type { Candidate, Requirement } from "@/employer/mockData";
import type { FitRow, FitStatus } from "./helpers";

/* Fit rows built from fields the job and the candidate already carry but the
   criteria card never compared: pay, work mode and the job's background
   preferences. Kept apart from helpers.ts so that file stays under its size cap. */

const LAKH = 100_000;
const CRORE = 10_000_000;

/** Low and high LPA figure in free text ("20-26 LPA", "₹24,00,000", "18L"); a single figure gives min = max. */
export function parsePayRangeLpa(text: string | null | undefined): { min: number; max: number } | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/,/g, "").replace(/[₹]|rs\.?|inr/g, " ");
  const nums: number[] = [];
  const re = /(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lpa|l|k)?\b/g;
  for (let m = re.exec(t); m; m = re.exec(t)) {
    const n = Number(m[1]);
    const unit = m[2] ?? "";
    if (!Number.isFinite(n) || n <= 0 || unit === "k") continue;
    if (/^cr/.test(unit)) nums.push((n * CRORE) / LAKH);
    else if (/^(lakh|lac|lpa|l$)/.test(unit)) nums.push(n);
    else if (n >= LAKH) nums.push(n / LAKH);
    else if (n >= 1) nums.push(n);
  }
  const ok = nums.filter((n) => n >= 1 && n <= 500);
  if (ok.length === 0) return null;
  return { min: Math.min(...ok), max: Math.max(...ok) };
}

/** The job's pay as a yearly range in lakhs. Fixed fees are not comparable to a candidate's yearly ask. */
export function budgetRangeLpa(r: Pick<Requirement, "budgetMin" | "budgetMax" | "salaryType">): { min: number | null; max: number | null } | null {
  if (r.budgetMin == null && r.budgetMax == null) return null;
  if (r.salaryType === "fixed") return null;
  const toLpa = (v: number | null) => (v == null ? null : r.salaryType === "per-month" ? (v * 12) / LAKH : v);
  return { min: toLpa(r.budgetMin), max: toLpa(r.budgetMax) };
}

const lpa = (n: number) => `₹${Number.isInteger(n) ? n : n.toFixed(1)} LPA`;
const spanText = (a: number, b: number) => (a === b ? lpa(a) : `₹${a}–${b} LPA`);

export function payFitRow(candidate: Candidate, requirement: Requirement): FitRow | null {
  const r = candidate.resume;
  const budget = budgetRangeLpa(requirement);
  const ask = parsePayRangeLpa(r?.expectedCtc ?? r?.expectedCtcBand);
  if (!budget || budget.max == null || !ask) return null;
  const has = r?.expectedCtc ?? r?.expectedCtcBand ?? "";
  const asked = budget.min != null && budget.min !== budget.max ? spanText(budget.min, budget.max) : `Up to ${lpa(budget.max)}`;
  let status: FitStatus;
  let reason: string;
  if (ask.max <= budget.max) {
    status = "meets";
    reason = "Expected pay sits inside the budget.";
  } else if (ask.min <= budget.max) {
    status = "partial";
    reason = `The top of their range runs ${lpa(ask.max - budget.max)} above the budget; the low end fits.`;
  } else {
    status = "gap";
    reason = `Expects at least ${lpa(ask.min - budget.max)} more than the budget allows.`;
  }
  return { id: "pay", label: "Pay", asked, has, status, reason, source: "resume" };
}

const MODE_LABEL: Record<string, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

export function workModeFitRow(candidate: Candidate, requirement: Requirement): FitRow | null {
  const pref = candidate.resume?.workModePref;
  const job = requirement.workMode;
  if (!pref || !job || !MODE_LABEL[pref] || !MODE_LABEL[job]) return null;
  let status: FitStatus;
  let reason: string;
  if (pref === job) {
    status = "meets";
    reason = "Prefers the way this job works.";
  } else if (pref === "remote" && job === "onsite") {
    status = "gap";
    reason = "Wants remote work; the job is on-site.";
  } else {
    status = "partial";
    reason = `Prefers ${MODE_LABEL[pref].toLowerCase()} work; the job is ${MODE_LABEL[job].toLowerCase()}.`;
  }
  return { id: "workmode", label: "Work mode", asked: MODE_LABEL[job], has: MODE_LABEL[pref], status, reason, source: "profile" };
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
/** Loose two-way containment so "IIT Bombay" finds "Indian Institute of Technology Bombay (IIT B)" only when one name holds the other. */
const sameName = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return x.length >= 3 && y.length >= 3 && (x.includes(y) || y.includes(x));
};

/** Matches only: a preference the candidate misses is not a gap, so this row never counts against them. */
export function backgroundFitRow(candidate: Candidate, requirement: Requirement): FitRow | null {
  const r = candidate.resume;
  if (!r) return null;
  const colleges = requirement.preferredColleges ?? [];
  const companies = requirement.targetCompanies ?? [];
  const hits: string[] = [];
  const school = (r.education ?? []).find((e) => colleges.some((c) => sameName(c, e.school)));
  if (school) hits.push(`studied at ${school.school}`);
  const firm = (r.experience ?? []).find((e) => companies.some((c) => sameName(c, e.company)));
  if (firm) hits.push(`worked at ${firm.company}`);
  const wanted = (requirement.preferredIndustry ?? "").trim();
  if (wanted && (r.industries ?? []).some((i) => sameName(wanted, i))) hits.push(`has ${wanted} experience`);
  if (hits.length === 0) return null;
  const asked = [...colleges.slice(0, 1), ...companies.slice(0, 1), wanted].filter(Boolean).join(", ");
  return {
    id: "background",
    label: "Preferred background",
    asked: asked || "Listed preferences",
    has: hits.join("; ").replace(/^./, (c) => c.toUpperCase()),
    status: "meets",
    reason: "Matches a background the job lists as preferred.",
    source: "resume",
  };
}

/** Where this score stands among the other matches for the same job; null until there are enough to compare. */
export function poolStanding(score: number, others: ReadonlyArray<{ matchScore: number }>): { below: number; total: number } | null {
  if (others.length < 4) return null;
  return { below: others.filter((o) => o.matchScore < score).length, total: others.length };
}

export interface DecisionBrief { strengths: string[]; risks: Array<{ text: string; gap: boolean }> }

const SHORT: Record<string, (r: FitRow) => string> = {
  skills: (r) => `${r.has} required skills`,
  pay: (r) => `Pay ${r.has} vs ${r.asked.toLowerCase().startsWith("up to") ? "budget " + r.asked.toLowerCase() : "budget " + r.asked}`,
};

const brief = (r: FitRow) => (SHORT[r.id] ? SHORT[r.id](r) : `${r.label}: ${r.has}`);

/** The two strongest reasons to move forward and the two things to check first, from the criteria card. */
export function buildDecisionBrief(rows: FitRow[]): DecisionBrief {
  return {
    strengths: rows.filter((r) => r.status === "meets").slice(0, 2).map(brief),
    risks: rows
      .filter((r) => r.status !== "meets")
      .sort((a, b) => (a.status === b.status ? 0 : a.status === "gap" ? -1 : 1))
      .slice(0, 2)
      .map((r) => ({ text: brief(r), gap: r.status === "gap" })),
  };
}

/** One plain sentence on what the score rests on, from the criteria card only; null when there is nothing to compare. */
export function scoreReason(rows: FitRow[], hasPractice: boolean): string | null {
  if (rows.length === 0) return null;
  const meets = rows.filter((r) => r.status === "meets").length;
  const gaps = rows.filter((r) => r.status === "gap").map((r) => r.label.toLowerCase());
  const parts = [`${meets} of ${rows.length} ${rows.length === 1 ? "criterion" : "criteria"} fully met`];
  if (gaps.length > 0) parts.push(`gaps in ${gaps.slice(0, 2).join(" and ")}${gaps.length > 2 ? ` and ${gaps.length - 2} more` : ""}`);
  return `${parts.join(", ")}.${hasPractice ? "" : " No graded practice yet, so this reflects the resume only."}`;
}
