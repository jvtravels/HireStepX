/* Plain-English copy for raw competency keys.
 *
 * Pre-mvp-8 sessions don't have the LLM's structured `coaching` block,
 * so the dashboard card falls back to `topStrength`/`topGap` — and those
 * fields are computed by picking the highest/lowest key out of
 * `skill_scores`. The keys are camelCase machine tokens
 * (`leverageUse`, `composure`, `packageThinking`, etc.) that surface
 * raw on the card and read as broken UI.
 *
 * The vocabulary below maps every known key to two natural phrases:
 *   - `strength` : "what you did well" — past tense, second person
 *   - `gap`      : "what to work on"   — imperative, second person
 *
 * Both are kept under 6 words so they line up with the LLM's
 * `coaching.{strength|gap}.headline` budget and the card's single-line
 * ellipsis. Unknown keys fall back to a camelCase → Title Case split
 * (better than the raw token, still recognisable for any new key the
 * evaluator might add) — never throw, never produce empty strings. */

type Phrasings = { strength: string; gap: string };

const SKILL_VOCAB: Record<string, Phrasings> = {
  // ── Salary-negotiation rubric (interviewEvaluation.ts:86-94) ──
  anchoring:           { strength: "Anchored the number first",     gap: "Anchor your number first" },
  packageThinking:     { strength: "Looked beyond base salary",     gap: "Negotiate the full package" },
  leverageUse:         { strength: "Used your leverage well",       gap: "Build leverage before asking" },
  concessionStrategy:  { strength: "Traded concessions smartly",    gap: "Trade, don't just give" },
  closingTechnique:    { strength: "Closed with a clear summary",   gap: "Close with a written summary" },
  composure:           { strength: "Stayed composed under pressure", gap: "Stay composed when pushed" },
  professionalTone:    { strength: "Kept a professional tone",      gap: "Hold a professional tone" },

  // ── Behavioral / general rubric (interviewEvaluation.ts:105-113) ──
  communication:       { strength: "Clear, confident communication", gap: "Speak in fuller sentences" },
  structure:           { strength: "Well-structured answers",        gap: "Structure your answers better" },
  technicalDepth:      { strength: "Showed real technical depth",    gap: "Go deeper on the technical detail" },
  leadership:          { strength: "Owned the work as a leader",     gap: "Show more ownership" },
  problemSolving:      { strength: "Strong problem-solving instinct", gap: "Break problems down step by step" },
  confidence:          { strength: "Answered with confidence",       gap: "Sound more certain in answers" },
  specificity:         { strength: "Backed claims with specifics",   gap: "Add numbers and specifics" },

  // ── Common analyzer keys (in case evaluator widens vocabulary) ──
  empathy:             { strength: "Showed real user empathy",       gap: "Lead with user empathy" },
  metricsLiteracy:     { strength: "Reasoned with the right metrics", gap: "Pick sharper success metrics" },
  prioritization:      { strength: "Prioritised the right things",   gap: "Be clearer about trade-offs" },
  productSense:        { strength: "Strong product instincts",       gap: "Sharpen your product instincts" },
  systemThinking:      { strength: "Thought in systems, not features", gap: "Think in systems, not features" },
  starStructure:       { strength: "Hit every STAR beat cleanly",    gap: "Walk through Situation → Result" },
};

/* Split a camelCase / snake_case token into spaced Title Case. Used as
 * the last-resort fallback so a never-before-seen key like
 * `riskAppetite` becomes "Risk appetite" instead of a raw token. */
function titleCaseFromKey(raw: string): string {
  const spaced = raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/* Detect a raw machine token: a single word, no spaces, looks like a
 * code identifier (camelCase, snake_case, all-lower, etc.). Anything
 * with whitespace is already a phrase — the LLM wrote it — so pass it
 * through unchanged. */
function isRawKey(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/\s/.test(trimmed)) return false;
  return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(trimmed);
}

/* Turn a raw competency key into a "did well" phrase. Returns the
 * original value untouched when it's already a phrase. */
export function strengthCopy(value: string | null | undefined): string {
  if (!value) return "";
  if (!isRawKey(value)) return value;
  const phrase = SKILL_VOCAB[value]?.strength;
  return phrase || titleCaseFromKey(value);
}

/* Turn a raw competency key into a "work on this" phrase. Returns the
 * original value untouched when it's already a phrase. */
export function gapCopy(value: string | null | undefined): string {
  if (!value) return "";
  if (!isRawKey(value)) return value;
  const phrase = SKILL_VOCAB[value]?.gap;
  return phrase || titleCaseFromKey(value);
}
