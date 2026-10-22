/* Pure pieces of the hallucination eval (scripts/eval-hallucination.ts):
 * the judge prompt, whitelist cross-check, verdict parsing and roll-up.
 * The script owns all I/O; everything here is deterministic. */

import type { KnownFacts } from "../data/company-known-facts";

/* The judge is NOT handed the company-known-facts whitelist. It only extracts
   the specific claims a question makes; the whitelist cross-check happens in
   code. Two stages is harder to fool with chain-of-thought drift. */
const JUDGE_PROMPT_TEMPLATE = `You are a fact-grounding auditor.

For the interview question below, identify EVERY specific factual claim it makes about {COMPANY}.
A "specific factual claim" is any reference to:
  • A scale number (transactions/day, revenue, headcount, market share)
  • A specific product, service, or internal tool name
  • A founder, executive, or board member by name
  • A recent event (IPO, layoff, acquisition, leadership change)
  • A funding round, valuation, or investor
  • An internal team structure, pod, or business unit
  • A geographic detail (specific office locations, countries)

Question to audit:
"""
{QUESTION}
"""

Reply ONLY with a JSON object of this shape:
{
  "claims": [
    { "claim": "verbatim quote of the claim", "type": "scale|product|person|event|funding|structure|geo" }
  ],
  "isPureHypothetical": true|false,
  "isAnonymized": true|false
}

isPureHypothetical: true if the claim is framed as a design constraint
("design a system handling 10B txn/day for {COMPANY}") rather than
an assertion about {COMPANY}'s actual numbers.

isAnonymized: true if the question uses generic descriptors only
("a major Indian unicorn", "a high-scale fintech") with no
{COMPANY}-specific claims.`;

export function buildJudgePrompt(company: string, question: string): string {
  return JUDGE_PROMPT_TEMPLATE.split("{COMPANY}").join(company).split("{QUESTION}").join(question);
}

export interface JudgedClaim {
  claim: string;
  type: string;
}

export interface JudgeVerdict {
  claims: JudgedClaim[];
  isPureHypothetical: boolean;
  isAnonymized: boolean;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Validate whatever JSON the judge returned. null means unusable (counts as a judge error, not a pass). */
export function parseJudgeVerdict(raw: unknown): JudgeVerdict | null {
  if (!isRecord(raw) || !Array.isArray(raw.claims)) return null;
  const claims: JudgedClaim[] = [];
  for (const c of raw.claims) {
    if (!isRecord(c) || typeof c.claim !== "string") return null;
    claims.push({ claim: c.claim, type: typeof c.type === "string" ? c.type : "unknown" });
  }
  return {
    claims,
    isPureHypothetical: raw.isPureHypothetical === true,
    isAnonymized: raw.isAnonymized === true,
  };
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Claims that are not backed by the whitelist. Blank claims are ignored; no whitelist means nothing is verifiable. */
export function findUnverifiedClaims(claims: readonly JudgedClaim[], facts: KnownFacts | null): string[] {
  const real = claims.filter((c) => normalize(c.claim).length > 0);
  if (!facts) return real.map((c) => c.claim);
  const haystack = [
    facts.description,
    ...(facts.products ?? []),
    ...(facts.competitors ?? []),
    facts.scale ?? "",
    facts.techHints ?? "",
    facts.notes ?? "",
  ]
    .map(normalize)
    .filter((part) => part.length > 0);

  return real
    .filter((c) => {
      const needle = normalize(c.claim);
      return !haystack.some((part) => part.includes(needle) || needle.includes(part));
    })
    .map((c) => c.claim);
}

export interface QuestionAudit {
  question: string;
  claims: JudgedClaim[];
  unverifiedClaims: string[];
  isHallucination: boolean;
}

/** A question hallucinates when it asserts company facts the whitelist cannot back, unless framed as a pure hypothetical. */
export function auditQuestion(question: string, verdict: JudgeVerdict, facts: KnownFacts | null): QuestionAudit {
  const unverifiedClaims = verdict.isAnonymized ? [] : findUnverifiedClaims(verdict.claims, facts);
  return {
    question,
    claims: verdict.claims,
    unverifiedClaims,
    isHallucination: unverifiedClaims.length > 0 && !verdict.isPureHypothetical,
  };
}

export interface AuditSummary {
  judged: number;
  hallucinated: number;
  /** null when nothing was judged */
  rate: number | null;
  exceedsThreshold: boolean;
}

export function summarizeAudit(audits: readonly QuestionAudit[], threshold: number): AuditSummary {
  const judged = audits.length;
  const hallucinated = audits.filter((a) => a.isHallucination).length;
  const rate = judged === 0 ? null : hallucinated / judged;
  return { judged, hallucinated, rate, exceedsThreshold: rate !== null && rate > threshold };
}

/** Rotating window over cells so successive scheduled runs cover the whole matrix. */
export function pickCells<T>(cells: readonly T[], sample: number, offset: number): T[] {
  if (cells.length === 0 || sample <= 0) return [];
  const n = Math.min(sample, cells.length);
  const start = ((offset % cells.length) + cells.length) % cells.length;
  return Array.from({ length: n }, (_, i) => cells[(start + i) % cells.length]);
}
