/* PROSE-LINT-1 (2026-06-08) — deterministic prose-quality detectors.
 *
 * The LLM-judged subjective rubric covers recruiter-persona-authentic,
 * coaching-grounded-in-session, and no-out-of-character-coaching. Some
 * of those criteria have signatures crisp enough to enforce
 * deterministically with regex — and a deterministic check is strictly
 * better than an LLM judge for those (free, fast, reproducible, can
 * gate CI on every PR instead of waiting for a weekly cron).
 *
 * This module returns a list of antipatterns detected in a chunk of
 * bot prose. The eval rubric uses it as a structural criterion
 * `prose-antipatterns-zero`. Production can later wire it into the
 * response-pipeline validator stack (mirrors INTERNAL_TERMINOLOGY_LEAK_RE).
 *
 * Each detector is conservative on purpose: it must NEVER fire on
 * natural recruiter speech. We'd rather miss a real antipattern than
 * burn the CI gate with false positives. Regression rows in
 * proseAntipatterns.test.ts lock both halves: positive examples
 * (this prose SHOULD fire) and negative examples (this prose must
 * NOT fire). */

export interface ProseAntipattern {
  /** Stable id used in scorecards. Don't rename. */
  id: string;
  /** Short human-readable explanation for the eval reason field. */
  label: string;
}

/* --- Antipattern 1: META-NARRATION ----------------------------------- *
 * The bot describes its own role ("as your interview practice
 * partner", "let me coach you on this", "I'll switch to coach mode")
 * instead of staying in the recruiter persona. Coaching belongs in
 * the post-session report — never inside the recruiter's mouth.
 *
 * Pattern is narrow: requires both a self-referential frame AND a
 * coaching-mode token. "I would suggest" alone is ambiguous (a real
 * recruiter says it about offer terms); we don't fire on it. */
const META_NARRATION_RE =
  /\b(?:as\s+your\s+(?:interview\s+)?(?:practice\s+)?(?:partner|coach|tutor|guide|assistant|ai)|let\s+me\s+coach\s+you|switch(?:ing)?\s+to\s+(?:coach|coaching)\s+mode|i'?ll\s+coach\s+you|as\s+your\s+ai\b)/i;

/* --- Antipattern 2: TEMPLATE FILLER ---------------------------------- *
 * "I understand that this is an important decision for you." That
 * exact line is the LLM-template tell — a real recruiter would say
 * something specific. The detector catches a small set of high-
 * frequency template phrases without trying to enumerate every
 * possible one (that's the LLM judge's job). */
const TEMPLATE_FILLER_RE =
  /\b(?:i\s+understand\s+that\s+this\s+is\s+an\s+important\s+decision|i\s+appreciate\s+your\s+(?:patience|honesty|transparency)\s+(?:in|with|about)|thank\s+you\s+for\s+sharing\s+that\s+with\s+me|i\s+(?:completely\s+)?understand\s+where\s+you'?re\s+coming\s+from|that'?s\s+a\s+great\s+question)\b/i;

/* --- Antipattern 3: GENERIC ADVICE LEAK ------------------------------ *
 * Recruiter says something a self-help blog would say — generic
 * career advice that's untethered from the specific session. "Always
 * negotiate your worth." "Don't undersell yourself." Real recruiters
 * never say these things; they're a coach-LLM bleeding through. */
const GENERIC_ADVICE_RE =
  /\b(?:always\s+negotiate\s+your\s+worth|don'?t\s+undersell\s+yourself|know\s+your\s+(?:market\s+)?value|believe\s+in\s+yourself|stay\s+confident\s+and|trust\s+the\s+process)\b/i;

const DETECTORS: ReadonlyArray<{ re: RegExp; pattern: ProseAntipattern }> = [
  { re: META_NARRATION_RE, pattern: { id: "meta-narration", label: "recruiter described own AI/coach role" } },
  { re: TEMPLATE_FILLER_RE, pattern: { id: "template-filler", label: "LLM template phrasing detected" } },
  { re: GENERIC_ADVICE_RE, pattern: { id: "generic-advice", label: "generic self-help advice leaked into recruiter prose" } },
];

/** Scan a single bot utterance. Returns every antipattern that
 *  matched. Empty array on clean prose. */
export function detectProseAntipatterns(text: string): ProseAntipattern[] {
  if (!text || typeof text !== "string") return [];
  return DETECTORS.filter((d) => d.re.test(text)).map((d) => d.pattern);
}

/** Scan an entire transcript (turn-by-turn). Returns a flat list of
 *  detections, each annotated with the turn index where it fired so
 *  the scorecard reason can cite a specific turn. */
export function detectTranscriptAntipatterns(
  turns: ReadonlyArray<{ aiText?: string }>,
): Array<{ turnIndex: number; pattern: ProseAntipattern }> {
  const found: Array<{ turnIndex: number; pattern: ProseAntipattern }> = [];
  for (let i = 0; i < turns.length; i++) {
    const text = turns[i].aiText;
    if (!text) continue;
    for (const p of detectProseAntipatterns(text)) {
      found.push({ turnIndex: i, pattern: p });
    }
  }
  return found;
}
