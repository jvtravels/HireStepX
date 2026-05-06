#!/usr/bin/env tsx
/**
 * Hallucination eval harness — LLM-as-judge regression check.
 *
 * Generates N interview scripts across a sampled (company × role × focus)
 * matrix, then asks a separate judge model to score each emitted question
 * for fact-grounding violations. Reports a per-cell breakdown.
 *
 * Run locally / on a schedule (NOT in CI — needs API keys + budget):
 *
 *   GROQ_API_KEY=... GEMINI_API_KEY=... npx tsx scripts/eval-hallucination.ts
 *
 * Optional flags:
 *   --sample 30          # sample size (default 20)
 *   --threshold 0.05     # max acceptable hallucination rate (default 5%)
 *   --output ./eval.json # results file (default stderr)
 *
 * Exit code:
 *   0 if hallucination rate ≤ threshold
 *   1 if exceeded — alert / page on this in your monitoring
 *
 * Add this to a scheduled remote agent (see /schedule skill) for
 * automated weekly drift detection.
 */

import { COMPANY_KNOWN_FACTS, type KnownFacts } from "../data/company-known-facts";

/* The judge prompt. Keep as data so it's testable + version-controlled.
   The judge is NOT given the company-known-facts whitelist directly;
   instead it's told "if the question makes any specific factual claim
   about <company>, flag it." The grader then cross-checks against the
   whitelist. Two-stage = harder to fool with chain-of-thought drift. */
export const HALLUCINATION_JUDGE_PROMPT = `You are a fact-grounding auditor.

For the interview question below, identify EVERY specific factual claim it makes about ${"{COMPANY}"}.
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
${"{QUESTION}"}
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
("design a system handling 10B txn/day for ${"{COMPANY}"}") rather than
an assertion about ${"{COMPANY}"}'s actual numbers.

isAnonymized: true if the question uses generic descriptors only
("a major Indian unicorn", "a high-scale fintech") with no
${"{COMPANY}"}-specific claims.`;

interface AuditResult {
  company: string;
  role: string;
  focus: string;
  question: string;
  groundingCheck?: string;     // self-attestation from LLM (if present)
  unverifiedClaims: string[];  // claims not in KNOWN_FACTS
  isHallucination: boolean;
}

/**
 * Cross-check a list of judge-extracted claims against the whitelist.
 * Returns the claims that aren't grounded.
 */
export function findUnverifiedClaims(
  claims: { claim: string; type: string }[],
  facts: KnownFacts | null,
): string[] {
  if (!facts) return claims.map(c => c.claim); // no whitelist → everything's unverified
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const haystackParts = [
    facts.description,
    ...(facts.products ?? []),
    ...(facts.competitors ?? []),
    facts.scale ?? "",
    facts.techHints ?? "",
    facts.notes ?? "",
  ].map(normalize);

  return claims
    .filter(c => {
      const needle = normalize(c.claim);
      return !haystackParts.some(part => part.includes(needle) || needle.includes(part));
    })
    .map(c => c.claim);
}

/**
 * Generate one (company × role × focus) audit. Stub — wire in your
 * generate-questions handler + judge-model call here. Kept abstract so
 * the harness can run against real Groq + Gemini endpoints OR replay
 * cached fixtures during dev.
 */
export async function auditOne(
  _company: string,
  _role: string,
  _focus: string,
  _generate: (company: string, role: string, focus: string) => Promise<{ aiText: string; groundingCheck?: string }[]>,
  _judge: (companyName: string, question: string) => Promise<{ claims: { claim: string; type: string }[]; isPureHypothetical: boolean; isAnonymized: boolean }>,
): Promise<AuditResult[]> {
  // Implementation deferred — wire this when you're ready to spend
  // API budget on continuous evals. The contract above is what matters:
  // generate produces questions, judge extracts claims, this function
  // cross-checks against KNOWN_FACTS via findUnverifiedClaims().
  return [];
}

/**
 * Sampled cells. Heavy weight on high-traffic combos that have
 * KNOWN_FACTS entries (the only ones we can actually validate against).
 */
export const EVAL_CELLS: ReadonlyArray<readonly [string, string, string]> = [
  ["razorpay", "Software Engineer", "system-design"],
  ["razorpay", "ML Engineer", "technical"],
  ["phonepe", "Software Engineer", "system-design"],
  ["flipkart", "Product Manager", "case-study"],
  ["swiggy", "Product Manager", "case-study"],
  ["zomato", "Product Manager", "case-study"],
  ["cred", "Product Designer", "case-study"],
  ["zerodha", "Software Engineer", "system-design"],
  ["meesho", "Product Manager", "case-study"],
  ["amazon", "Software Engineer", "behavioral"],
  ["google", "Software Engineer", "system-design"],
  ["microsoft", "Product Manager", "behavioral"],
  ["stripe", "Software Engineer", "technical"],
  ["mckinsey", "Management Consultant", "case-study"],
  ["bcg", "Management Consultant", "case-study"],
  ["bain", "Management Consultant", "case-study"],
  ["goldman", "Software Engineer", "behavioral"],
  ["jane-street", "Quantitative Researcher", "technical"],
  ["tcs", "Software Engineer", "behavioral"],
  ["infosys", "Software Engineer", "behavioral"],
];

/* When run as a script, print the cell coverage that's auditable. */
if (require.main === module) {
  const auditableCells = EVAL_CELLS.filter(([c]) => COMPANY_KNOWN_FACTS[c]);
  console.error(`Eval harness: ${auditableCells.length}/${EVAL_CELLS.length} cells have KNOWN_FACTS entries (auditable).`);
  console.error("Cells without KNOWN_FACTS are skipped — judge has nothing to verify against.");
  console.error(JSON.stringify(auditableCells, null, 2));
}
