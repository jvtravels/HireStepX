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
];

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

  /* Heuristic 2 first — breakdown asks need a number-or-deferral. */
  const isBreakdownAsk = BREAKDOWN_ASK_PATTERNS.some((p) => p.test(cand));
  if (isBreakdownAsk) {
    if (NUMBER_RE.test(bot)) return { coherent: true };
    if (DEFERRAL_PHRASES.some((p) => p.test(bot))) return { coherent: true };
    return {
      coherent: false,
      reason: "Candidate asked for a breakdown but bot reply has no number and no explicit deferral.",
    };
  }

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
