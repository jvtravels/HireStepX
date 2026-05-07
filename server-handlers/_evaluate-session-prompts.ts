/* Pure prompt constants extracted from evaluate-session.ts.
 *
 * Two reasons to keep these in their own file:
 *   1. Testability — we can verify every supported interview type has a
 *      rubric weight (no silent fall-through to no-weighting).
 *   2. Cacheability — these strings are part of the static prompt prefix
 *      that Groq's automatic prompt caching keys on. Pinning them here
 *      makes it harder to accidentally inline a per-call variable that
 *      would defeat the cache. */

export const GROUNDING_DIRECTIVE =
  "GROUNDING REQUIREMENT: Every wins/fixes/red-flag finding in the report MUST quote a SPECIFIC phrase from the transcript (≤15 words). Do NOT produce generic feedback like 'be more specific' or 'use STAR' — point to the exact moment: 'When you said \"we improved performance\", you didn't quantify it — what was the actual %?'. If you can't ground a finding in a transcript quote, omit it.";

export const FAIRNESS_DIRECTIVE =
  "FAIRNESS: Do NOT penalize for accent, non-elite college background, or gender-linked communication style. Score on substance — what they said, the structure, the evidence — not how it sounded. If a candidate uses 'we' frequently as a collectivist framing, probe for the 'I' but don't auto-deduct.";

export const LENGTH_TARGETS_DIRECTIVE =
  "ANSWER-LENGTH TARGETS (per type, calibrate lengthVerdict.targetRange): behavioral STAR 120-240 words, technical/system-design 180-360 words, case-study 200-400 words, HR/intro questions 80-180 words, salary-negotiation 60-180 words (concise + numeric), campus-placement 90-200 words. Penalize too-brief; don't punish slightly-long if substance is high.";

export const SELF_CHECK_DIRECTIVE =
  "SELF-CHECK: Before finalizing, internally verify each fix has a concrete transcript quote and each skill score has at least one supporting moment. If a score and its evidence don't match, recalibrate the score to match the evidence — never fabricate evidence to match a preset score.";

/* Per-type rubric weights — different interview formats prize different
 * dimensions. A perfect case-study answer is structurally rigorous; a
 * perfect behavioral answer follows STAR; a perfect technical answer
 * articulates trade-offs. Surface this to the scorer so the same generic
 * 75/100 doesn't appear across very different formats. */
export const TYPE_RUBRIC_WEIGHTS: Record<string, string> = {
  "behavioral": "Weight HEAVILY: STAR completeness (Situation/Task/Action/Result fully present), specificity (names, numbers, dates), 'I' vs 'we' clarity, learning/reflection. De-weight: technical depth, framework breadth.",
  "case-study": "Weight HEAVILY: structural rigor (explicit framework, MECE, hypothesis-driven), quantitative reasoning (back-of-envelope numbers, sanity checks), clarifying-question quality. De-weight: STAR structure, soft skills.",
  "technical": "Weight HEAVILY: trade-off articulation (every choice has a stated cost), depth-tree handling (going 2-3 levels deep on a topic), correctness on technical claims, system-design completeness. De-weight: STAR structure, soft skills.",
  "strategic": "Weight HEAVILY: framework recognition (RICE, OKR, etc.), real-experience anchoring (not aspirational), prioritization reasoning, business-acumen tells. De-weight: technical depth, STAR.",
  "management": "Weight HEAVILY: actual people-management evidence (hire/fire/comp decisions owned), team-size calibration, difficult-conversation handling, system-thinking on team design. De-weight: technical depth.",
  "hr-round": "Weight HEAVILY: motivation authenticity, self-awareness on weaknesses, company-research depth, communication clarity. De-weight: technical depth, framework breadth.",
  "campus-placement": "Weight HEAVILY: fundamentals clarity, project ownership, learning agility, communication. De-weight: leadership, P&L. Calibrate expectations to fresher level.",
  "salary-negotiation": "Weight HEAVILY: anchoring discipline, multi-lever negotiation (not just base), leverage usage (BATNA, competing offers), professional handling of pressure, NEGOTIATION STYLE (collaborative > adversarial — penalize zero-sum framing), and equity literacy (understanding ESOP cliff/vesting, RSU value, joining-bonus claw-back). De-weight: STAR, technical depth.",
  "panel": "Weight HEAVILY: multi-audience awareness (different framing for HM vs TL vs HR), STAR for behavioral asks, depth for technical asks, cultural-fit signals for HR asks. Look for whether candidate adapted their tone across panelists.",
  "government-psu": "Weight HEAVILY: balanced positioning, policy/scheme/article references, ethical reasoning rigor, current-affairs awareness, public-service genuineness.",
};

/** Lookup the rubric weight for an interview type, returning empty string
 * (= no extra weighting) for unknown types. Empty-string is intentionally
 * the same shape the inline call site produced before extraction. */
export function getRubricWeight(type: string | undefined | null): string {
  if (!type) return "";
  return TYPE_RUBRIC_WEIGHTS[type] || "";
}

/** All interview types we explicitly weight. Useful for dashboards /
 * coverage tests. */
export const SUPPORTED_INTERVIEW_TYPES = Object.keys(TYPE_RUBRIC_WEIGHTS) as ReadonlyArray<string>;
