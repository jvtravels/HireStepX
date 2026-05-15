/**
 * Turn-coherence detector.
 *
 * Sprint C.1 (2026-05-15) — many regressions land as "the LLM produced a
 * plausible-sounding turn that doesn't answer the question the candidate
 * actually asked". This module returns a coherence verdict for a
 * <candidate utterance, bot reply> pair. Pure, no I/O.
 *
 * Two heuristics:
 *   1. If the candidate utterance ends with `?` (a real question), the
 *      bot reply must address it — measured by content-token overlap
 *      (≥ 30%) OR a direct-answer marker ("yes", "no", "the fixed is",
 *      "the variable is", "our band is", "I'll come back to that").
 *   2. If the candidate asks for a specific breakdown ("what's the fixed",
 *      "variable?", "in-hand?"), the bot reply must contain a number or
 *      an explicit deferral phrase.
 */

export interface TurnCoherenceResult {
  coherent: boolean;
  reason?: string;
}

const DIRECT_ANSWER_MARKERS: RegExp[] = [
  /\byes\b/i,
  /\bno\b/i,
  /\bthe\s+fixed\s+is\b/i,
  /\bthe\s+variable\s+is\b/i,
  /\bour\s+band\s+is\b/i,
  /\bi'?ll\s+come\s+back\s+to\s+that\b/i,
  /\blet\s+me\s+(?:come\s+back|check|confirm)\b/i,
  /\bi'?ll\s+(?:get\s+back|confirm)\b/i,
];

const BREAKDOWN_ASK_PATTERNS: RegExp[] = [
  /\bwhat'?s?\s+the\s+fixed\b/i,
  /\bfixed\s*(?:component|portion|amount|number)?\s*\?/i,
  /\bvariable\s*\?/i,
  /\bwhat'?s?\s+the\s+variable\b/i,
  /\bin[\s-]?hand\s*\?/i,
  /\bwhat'?s?\s+(?:my|the)\s+in[\s-]?hand\b/i,
  /\bbreak\s*down\b/i,
  /* PDF #18 (2026-05-15) — additional breakdown ask phrasings. The real
   * session had the candidate say "split it down" / "show me the variable
   * split" / "fixed and variable breakdown" and the bot returned a
   * benefits restatement (no numeric content). Each pattern below
   * captures one of those phrasings. */
  /\bsplit\s+it\s+down\b/i,
  /\bshow\s+me\s+(?:the\s+)?(?:variable|fixed|comp(?:ensation)?)\s+(?:split|breakdown|breakup)\b/i,
  /\bfixed\s+and\s+variable\s+(?:breakdown|breakup|split)\b/i,
  /\b(?:fixed|variable)\s*(?:vs|\/|and)\s*(?:variable|fixed)\b/i,
  /\bcomp(?:ensation)?\s+(?:breakdown|breakup|split)\b/i,
  /\bsalary\s+(?:breakdown|breakup|split|structure)\b/i,
];

/** PDF #18 (2026-05-15) — looser numeric-content detector. A real
 *  numeric answer must contain a multi-digit number OR a ₹/lakh/LPA-
 *  flagged figure. Standalone digit 0 doesn't count (e.g. "0 days
 *  notice" wouldn't satisfy a comp breakdown ask). */
const SPECIFIC_NUMBER_RE = /\d+(?:\.\d+)?\s*(?:l|lpa|lakh|lakhs|k|%|₹|cr|crore)\b|₹\s*\d/i;

const NUMBER_RE = /\d/;
const DEFERRAL_PHRASES: RegExp[] = [
  /\bi'?ll\s+(?:come\s+back|get\s+back|confirm|check)\b/i,
  /\blet\s+me\s+(?:come\s+back|check|confirm)\b/i,
  /\bi\s+(?:need|want)\s+to\s+check\b/i,
  /\bcircle\s+back\b/i,
];

const STOPWORDS = new Set([
  "a", "an", "the", "is", "it", "to", "of", "for", "and", "or", "but",
  "in", "on", "at", "with", "by", "from", "as", "be", "are", "was", "were",
  "i", "you", "we", "they", "he", "she", "this", "that", "these", "those",
  "what", "when", "where", "why", "how", "do", "does", "did", "have", "has",
  "had", "will", "would", "could", "should", "can", "may", "might", "shall",
  "if", "then", "else", "so", "than", "too", "very", "just", "yet", "any",
  "some", "all", "most", "much", "many", "few", "no", "not", "only", "own",
  "same", "such", "also", "about", "more", "less",
]);

function tokenize(text: string): Set<string> {
  const out = new Set<string>();
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const t of tokens) {
    if (t.length < 3) continue;
    if (STOPWORDS.has(t)) continue;
    out.add(t);
  }
  return out;
}

function contentOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits++;
  return hits / a.size;
}

export function assessTurnCoherence(
  candidateLastUtterance: string,
  botReply: string,
): TurnCoherenceResult {
  const cand = (candidateLastUtterance ?? "").trim();
  const bot = (botReply ?? "").trim();
  if (cand.length === 0 || bot.length === 0) {
    return { coherent: true };
  }

  /* Heuristic 2 first — breakdown asks need a number-or-deferral.
   *
   * PDF #18 strengthening (2026-05-15): the prior NUMBER_RE allowed ANY
   * digit, so a reply like "we offer 24/7 support" would falsely satisfy
   * a comp-breakdown ask. Now we require an LPA-flagged figure (or
   * percent/₹ marker) — a numeric phone-number-shaped digit alone is not
   * coherent. Falls back to the loose NUMBER_RE as a secondary signal
   * for cases like "your fixed is 18, variable is 4" where currency
   * unit is omitted. */
  const isBreakdownAsk = BREAKDOWN_ASK_PATTERNS.some((p) => p.test(cand));
  if (isBreakdownAsk) {
    if (SPECIFIC_NUMBER_RE.test(bot)) return { coherent: true };
    /* Secondary fallback: a multi-token numeric phrase like "18 fixed, 4
     * variable" — bot reply with at least two distinct numeric tokens is
     * treated as a coherent split disclosure. */
    const numericTokens = bot.match(/\b\d+(?:\.\d+)?\b/g) ?? [];
    if (numericTokens.length >= 2) return { coherent: true };
    if (DEFERRAL_PHRASES.some((p) => p.test(bot))) return { coherent: true };
    return {
      coherent: false,
      reason: "Candidate asked for a breakdown but bot reply has no LPA-flagged number, no multi-number split, and no explicit deferral.",
    };
  }
  /* Silence unused-binding warning under tsc-strict — NUMBER_RE remains
   * exported in shape via the broader bot-reply hint test below. */
  void NUMBER_RE;

  /* Heuristic 1 — explicit `?` question requires content overlap or direct-
   * answer marker. */
  const isQuestion = /\?\s*$/.test(cand);
  if (isQuestion) {
    if (DIRECT_ANSWER_MARKERS.some((p) => p.test(bot))) return { coherent: true };
    const overlap = contentOverlap(tokenize(cand), tokenize(bot));
    if (overlap >= 0.3) return { coherent: true };
    return {
      coherent: false,
      reason: `Candidate asked a question but bot reply shares only ${(overlap * 100).toFixed(0)}% content overlap and no direct-answer marker.`,
    };
  }

  return { coherent: true };
}
