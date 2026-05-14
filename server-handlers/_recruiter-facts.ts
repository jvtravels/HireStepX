/* Recruiter-side fact tracker (Bug 7, 2026-05-14).
 *
 * Failure mode: same benefits paragraph repeated four turns in a row.
 * The LLM (or fallback) was citing PF + medical insurance + leave
 * policy + variable structure every turn the candidate engaged
 * benefits — even after we'd already said it.
 *
 * Fix: extract a small token set from each bot turn that we can
 * carry on kernel state and feed back into the brief so the LLM
 * sees "ALREADY-STATED FACTS: medical-insurance, pf, gratuity" and
 * is instructed not to restate them.
 *
 * Tokens are coarse-grained on purpose — we want anti-repetition, not
 * a structured benefits log. Token set is closed (defined here),
 * additions go through code review. */

export type RecruiterFactToken =
  | "medical-insurance"
  | "pf"
  | "gratuity"
  | "learning-platform"
  | "paid-time-off"
  | "hybrid-work"
  | "variable-component"
  | "fixed-variable-split"
  | "performance-review"
  | "sick-leave"
  | "privilege-leave";

export const RECRUITER_FACT_TOKENS: RecruiterFactToken[] = [
  "medical-insurance",
  "pf",
  "gratuity",
  "learning-platform",
  "paid-time-off",
  "hybrid-work",
  "variable-component",
  "fixed-variable-split",
  "performance-review",
  "sick-leave",
  "privilege-leave",
];

const TOKEN_PATTERNS: Array<{ token: RecruiterFactToken; pattern: RegExp }> = [
  { token: "medical-insurance", pattern: /\b(medical\s+insurance|health\s+insurance|family\s+floater|medi[-\s]?claim|gmc|hospitali[sz]ation)\b/i },
  { token: "pf", pattern: /\b(provident\s+fund|\bpf\b|epfo|employee\s+pf)\b/i },
  { token: "gratuity", pattern: /\bgratuity\b/i },
  { token: "learning-platform", pattern: /\b(learning\s+(?:platform|stipend|budget|allowance)|udemy|coursera|pluralsight|upskilling\s+budget)\b/i },
  { token: "paid-time-off", pattern: /\b(paid\s+time\s+off|annual\s+leave|earned\s+leave|\bel\b|vacation\s+days)\b/i },
  { token: "hybrid-work", pattern: /\b(hybrid\s+(?:work|model)|wfh|work\s+from\s+home|remote\s+work|3\s+days\s+(?:in[-\s]?office|wfh))\b/i },
  { token: "variable-component", pattern: /\b(variable\s+(?:component|pay|bonus|portion)|annual\s+bonus|performance\s+bonus)\b/i },
  { token: "fixed-variable-split", pattern: /\b(fixed[-\s]?(?:vs|\/|to|and)[-\s]?variable|\d{1,2}\s*[-/]\s*\d{1,2}\s+split|base\s+plus\s+variable)\b/i },
  { token: "performance-review", pattern: /\b(performance\s+review|annual\s+review|appraisal\s+cycle|review\s+cycle|salary\s+review)\b/i },
  { token: "sick-leave", pattern: /\b(sick\s+leave|\bsl\b\s+(?:days?|policy)|casual\s+leave|\bcl\b\s+(?:days?|policy))\b/i },
  { token: "privilege-leave", pattern: /\b(privilege\s+leave|\bpl\b\s+(?:days?|policy))\b/i },
];

/** Extract recruiter-fact tokens mentioned in a bot turn. */
export function extractRecruiterFacts(botReply: string | null | undefined): RecruiterFactToken[] {
  if (!botReply || typeof botReply !== "string") return [];
  const hits: RecruiterFactToken[] = [];
  for (const { token, pattern } of TOKEN_PATTERNS) {
    if (pattern.test(botReply)) hits.push(token);
  }
  return hits;
}

/* Bug 5 (2026-05-14) — in-hand specificity detector.
 *
 * When the candidate asks for in-hand monthly / take-home / net salary,
 * the bot must give a concrete ₹/month estimate, not a percentage.
 * Detector triggers on the standard phrasings; the invariant test
 * asserts the bot reply contains a ₹-numeric pattern. */
const IN_HAND_PATTERNS: RegExp[] = [
  /\bin[-\s]?hand\b/i,
  /\btake[-\s]?home\b/i,
  /\bnet\s+salary\b/i,
  /\bmonthly\s+(?:net|take|in\s*hand|salary)\b/i,
  /\bafter\s+deductions\b/i,
  /\bafter\s+tax(?:es)?\b/i,
  /\bnet\s+(?:pay|monthly)\b/i,
];

export function detectInHandRequest(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return false;
  for (const p of IN_HAND_PATTERNS) if (p.test(text)) return true;
  return false;
}

/** Convenience: returns true if `botReply` contains an explicit ₹ /
 *  LPA / lakh / k numeric figure. Used by the in-hand invariant test. */
export function containsRupeeAmount(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return false;
  if (/₹\s*\d{1,2},?\d{2,3},?\d{3}/.test(text)) return true;
  if (/₹\s*\d+(?:\.\d+)?\s*(?:l|lpa|lakh|lakhs|k)/i.test(text)) return true;
  if (/\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l\b|lkhs?)/i.test(text)) return true;
  if (/\binr\s*\d/i.test(text)) return true;
  if (/\d{1,3}(?:,\d{3})+/.test(text)) return true;
  return false;
}
