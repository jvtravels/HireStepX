/* Deterministic register enforcement for candidate-facing coaching prose.
 *
 * WHY THIS EXISTS (a second, GUARANTEED layer — not patchwork):
 * VOICE_DICTION_DIRECTIVE (see _evaluate-session-prompts.ts) asks the model
 * not to write LLM-isms. On the 70b report scorer that mostly holds. On the
 * 8b "fast" scorer behind /api/evaluate it does NOT — "Delve deeper into
 * technical details", "Additionally,", "seamless transition" leak verbatim
 * into the copy the candidate reads (observed live on staging, every other
 * generation). A prompt directive is probabilistic; user-facing copy needs a
 * deterministic guarantee. This module is that guarantee: a word-level
 * rewrite of the unambiguous AI tells, applied after the LLM returns.
 *
 * Deliberately CONSERVATIVE. Words that carry real domain meaning in
 * interview coaching are intentionally NOT rewritten here — they are left to
 * the prompt so we never misquote a candidate or corrupt a rubric term:
 *   - "leverage"  — a core salary-negotiation competency (BATNA leverage).
 *   - "robust" / "scalable" / "navigate" — legitimate technical vocabulary a
 *     candidate may have actually used; mechanically rewriting could misquote.
 * Only tells with a safe 1:1 plain swap and no legitimate use here are handled
 * mechanically. Everything else stays the prompt's job.
 */

/** Preserve the casing of the matched token on its replacement (only the
 * first character matters for our word-level swaps). */
function preserveCase(match: string, replacement: string): string {
  const first = match.charAt(0);
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/* Ordered rules: multi-word patterns FIRST so a later single-word rule can't
 * partially rewrite them. Each entry is [pattern (global), plain replacement].
 * Inflections are listed longest/most-specific first within each family. */
const RULES: ReadonlyArray<readonly [RegExp, string]> = [
  // ── multi-word tells ──
  [/\b(?:deep[- ]dive|dive deep)(?=\s+into\b)/gi, "dig"], // "deep dive into X" → "dig into X"
  [/\b(?:deep[- ]dive|dive deep)\b/gi, "dig deeper"], // standalone
  [/\bcircle back\b/gi, "follow up"],
  [/\b(?:world-class|best-in-class)\b/gi, "top"],
  // ── delve family (the single most recognisable AI tell; no legit use here) ──
  [/\bdelved\b/gi, "dug"],
  [/\bdelves\b/gi, "digs"],
  [/\bdelving\b/gi, "digging"],
  [/\bdelve\b/gi, "dig"],
  // ── utilize family ──
  [/\butilizing\b/gi, "using"],
  [/\butilized\b/gi, "used"],
  [/\butilizes\b/gi, "uses"],
  [/\butilize\b/gi, "use"],
  // ── facilitate family ──
  [/\bfacilitating\b/gi, "helping"],
  [/\bfacilitated\b/gi, "helped"],
  [/\bfacilitates\b/gi, "helps"],
  [/\bfacilitate\b/gi, "help"],
  // ── ideate family ──
  [/\bideation\b/gi, "brainstorming"],
  [/\bideating\b/gi, "brainstorming"],
  [/\bideates\b/gi, "brainstorms"],
  [/\bideate\b/gi, "brainstorm"],
  // ── seamless family ──
  [/\bseamlessly\b/gi, "smoothly"],
  [/\bseamless\b/gi, "smooth"],
  // ── connective openers (work mid-sentence and as openers alike) ──
  [/\badditionally\b/gi, "also"],
  [/\bfurthermore\b/gi, "also"],
  [/\bmoreover\b/gi, "also"],
];

/** Rewrite the unambiguous AI tells out of a single string. Returns the input
 * unchanged when it isn't a non-empty string. */
export function sanitizeVoice(text: string): string {
  if (!text || typeof text !== "string") return text;
  let out = text;
  for (const [re, replacement] of RULES) {
    out = out.replace(re, (m) => preserveCase(m, replacement));
  }
  return out;
}

/** Deep-walk any JSON-shaped value, applying sanitizeVoice to every string.
 * Safe to run over a whole evaluation/report object: the rule set targets only
 * tells with no legitimate domain meaning, so enum/quote fields are untouched.
 * Returns a NEW value; the input is not mutated. */
export function sanitizeVoiceValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeVoice(value);
  if (Array.isArray(value)) return value.map((v) => sanitizeVoiceValue(v));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeVoiceValue(v);
    }
    return out;
  }
  return value;
}
