/* Per-flag confidence scoring for the candidate-profile parser
 * (2026-05-14).
 * ─────────────────────────────────────────────────────────────────────
 * The 107-flag extractor in _candidate-profile.ts returns booleans /
 * enums but no confidence — a single oblique mention of "I might
 * possibly be on a bond" sets serviceBondAccepted=true with the same
 * weight as "I signed a 3-year bond". That false-positive surfaces in
 * the brief and the LLM frames the close around a bond that may not
 * exist.
 *
 * This module is a PARALLEL layer: it runs AFTER extraction and
 * re-scores each true flag with a 0..1 confidence based on:
 *   (a) regex-match density (more mentions → higher confidence),
 *   (b) span-vs-text ratio (matched span dominates → higher),
 *   (c) hedging words ("maybe", "I think", "possibly") nearby → drop 0.3,
 *   (d) explicit numerical anchors (₹, LPA, year, %, lakh) → boost 0.2.
 *
 * We deliberately do NOT touch the 107 detectors. The brief-builder /
 * kernel-audit layer can call `lowConfidenceFlags` to de-emphasize
 * uncertain flags in the brief without changing the underlying
 * extraction behaviour. Pure — no IO, no clocks. */

import type { CandidateProfileResult } from "./_candidate-profile";

type ProfileKey = keyof CandidateProfileResult;
export type ConfidenceScores = Record<ProfileKey, number>;

const HEDGE_RE = /\b(?:maybe|might|possibly|perhaps|i\s+think|i\s+guess|sort\s+of|kind\s+of|not\s+sure|probably|i\s+suppose)\b/i;
const NUMERIC_ANCHOR_RE = /(?:₹|\bLPA\b|\blakh\b|\bcrore\b|\d+\s*(?:%|year|yrs|months?|mo)\b|\$\s*\d|\d+\s*(?:k|l|cr)\b)/i;

/** Loose lexicon-per-flag for a coarse match-density signal. Only the
 *  ~30 most ambiguous flags get an entry; the rest default to the
 *  "value is present" baseline confidence (0.6) which is the parser's
 *  own threshold. This is intentionally not exhaustive — see header. */
const FLAG_LEXICON: Partial<Record<ProfileKey, RegExp>> = {
  careerGapMonths: /\b(?:gap|break|hiatus|sabbatical|time\s+off|career\s+break)\b/gi,
  tenureSignal: /\b(?:switched|hopped|changed\s+jobs|tenure|stable|short\s+stint)\b/gi,
  levelMismatch: /\b(?:over[-\s]?qualified|under[-\s]?qualified|short\s+on\s+yoe|level\s+(?:up|down))\b/gi,
  domainPivot: /\b(?:pivot|transition|switch(?:ing)?\s+(?:to|into)|career\s+change)\b/gi,
  transferableSkillsClaimed: /\btransferable\s+skills?\b/gi,
  serviceBondAccepted: /\b(?:bond|service\s+agreement|training\s+bond)\b/gi,
  probationCompMentioned: /\bprobation\b/gi,
  internshipConversion: /\b(?:PPO|pre[-\s]?placement|convert(?:ing)?\s+(?:my\s+)?internship)\b/gi,
  collegeTier: /\b(?:IIT|NIT|BITS|IIIT|tier[-\s]?[123])\b/gi,
  earlySwitcher: /\b(?:1\s*year|6\s*months?|early\s+switch)\b/gi,
  lowCtcAlert: /\b(?:underpaid|low\s+ctc|below\s+market)\b/gi,
  serviceCompanyBackground: /\b(?:TCS|Infosys|Wipro|Cognizant|HCL|TechM|Mindtree|LTI|service\s+background)\b/gi,
  compBreakupUnknown: /\b(?:don't\s+know|not\s+sure|no\s+idea)\b.*\b(?:breakup|split|fixed|variable)\b/gi,
  recentLayoff: /\b(?:laid\s+off|layoff|let\s+go|shutdown|mass\s+layoff)\b/gi,
  hotDomainPremium: /\b(?:AI|ML|GenAI|LLM|security|appsec|quant|HFT)\b/gi,
  pipDisclosed: /\b(?:PIP|performance\s+improvement|asked\s+to\s+leave|forced\s+exit)\b/gi,
  verbalOnlyOffer: /\b(?:verbal\s+offer|no\s+offer\s+letter|waiting\s+(?:on|for)\s+(?:the\s+)?(?:written|letter))\b/gi,
  culturalJoiningConstraint: /\b(?:muhurat|wedding|Diwali|festival|family\s+function)\b/gi,
  peopleManagementClaimed: /\b(?:manage|managed|leading|lead|EM|engineering\s+manager|director)\b.*\b(?:team|people|engineers|reports)\b/gi,
  crossBorderAnchor: /\b(?:Bay\s+Area|Singapore|Dubai|London|US|overseas|abroad)\b.*\b(?:tc|ctc|salary|comp)\b/gi,
  unvestedEquityLossClaim: /\b(?:unvested|RSU|stock\s+options?|underwater)\b/gi,
  explodingOfferPressure: /\b(?:exploding\s+offer|24\s*hours?|48\s*hours?|deadline)\b/gi,
  gardenLeaveDisclosed: /\bgarden\s+leave\b/gi,
  nonCompeteFlagged: /\b(?:non[-\s]?compete|restrictive\s+covenant)\b/gi,
};

/* Default baseline confidence when a flag is true but we have no
 * lexicon entry. 0.6 corresponds to "detector fired but we haven't
 * independently corroborated." */
const BASELINE_CONFIDENCE = 0.6;

/** True iff the flag value indicates "the detector fired". null + false
 *  + empty-string are all "did not fire". */
function flagIsActive(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.length > 0;
  /* The "hasAny" aggregate / nested objects are not scored here — we
   * only attribute confidence to leaf detectors. */
  return false;
}

function countMatches(text: string, re: RegExp): { count: number; spanLen: number } {
  /* Reset regex state — the gi-flag carries .lastIndex across calls. */
  const flags = re.flags.includes("g") ? re.flags : `${re.flags}g`;
  const cloned = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  let count = 0;
  let spanLen = 0;
  while ((m = cloned.exec(text)) !== null) {
    count++;
    spanLen += m[0].length;
    if (m.index === cloned.lastIndex) cloned.lastIndex++;
    if (count > 50) break; // safety
  }
  return { count, spanLen };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Score a single active flag. Returns a value in [0,1]. */
function scoreOne(text: string, flag: ProfileKey): number {
  const lex = FLAG_LEXICON[flag];
  let base = BASELINE_CONFIDENCE;
  if (lex) {
    const { count, spanLen } = countMatches(text, lex);
    /* Match-density: 0 matches → keep baseline (the parent detector
     * fired on a phrasing not in this coarse lexicon); 1 match → +0.15;
     * 2+ → +0.25. */
    if (count === 1) base += 0.15;
    else if (count >= 2) base += 0.25;
    /* Span-vs-text ratio. Capped contribution so a one-word utterance
     * doesn't trivially saturate. */
    const ratio = text.length > 0 ? spanLen / text.length : 0;
    base += clamp01(ratio) * 0.1;
  }
  /* Hedging penalty. */
  if (HEDGE_RE.test(text)) base -= 0.3;
  /* Numerical-anchor boost — "₹26 LPA", "3 years", "10% hike" all
   * sharpen the claim. */
  if (NUMERIC_ANCHOR_RE.test(text)) base += 0.2;
  return clamp01(base);
}

/** Score every flag in `profile`. Inactive flags get 0. */
export function scoreProfileConfidence(
  text: string,
  profile: CandidateProfileResult,
): ConfidenceScores {
  const out: Partial<Record<ProfileKey, number>> = {};
  for (const k of Object.keys(profile) as ProfileKey[]) {
    out[k] = flagIsActive(profile[k]) ? scoreOne(text || "", k) : 0;
  }
  return out as ConfidenceScores;
}

/** Return the list of flag-keys whose confidence is below `threshold`
 *  (default 0.4) AND that fired (score > 0). The kernel can use this
 *  to de-emphasize uncertain flags in the LLM brief. */
export function lowConfidenceFlags(
  scores: ConfidenceScores,
  threshold = 0.4,
): Array<ProfileKey> {
  const out: ProfileKey[] = [];
  for (const k of Object.keys(scores) as ProfileKey[]) {
    const s = scores[k];
    if (s > 0 && s < threshold) out.push(k);
  }
  return out;
}
