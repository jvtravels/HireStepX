/* HireStepX — Noun-phrase memory across turns
 *
 * Real interviewers thread the conversation: "Earlier you mentioned
 * the Razorpay migration. How did the team react?" The follow-up LLM
 * already gets full conversation history but has to find these hooks
 * itself in raw transcript text — quality varies.
 *
 * This helper extracts likely-quotable noun phrases from each user
 * answer and accumulates them into a rolling buffer the engine pipes
 * to the next prompt as `previousMentions`. Gives the LLM explicit
 * pickable hooks instead of having to hunt through 5 paragraphs.
 *
 * Heuristic-only — no LLM call. Catches the bulk of useful mentions
 * (proper-noun phrases, numbered things, hyphenated tech terms) at
 * zero latency / cost.
 *
 * See src/__tests__/nounPhraseMemory.test.ts.
 */

/* Words that look like proper-noun starters but are too generic to
   surface as conversation hooks. The LLM doesn't need "I led" or
   "We did" — it needs "the Razorpay migration". */
const GENERIC_STARTERS = new Set([
  "I", "We", "My", "Our", "The", "A", "An", "This", "That", "These", "Those",
  "It", "They", "He", "She", "You", "Your", "His", "Her",
  "Yes", "No", "Yeah", "Okay", "OK", "Right", "So", "Well", "But", "And",
  "Also", "Then", "Now", "Just", "Maybe", "Sure", "Actually", "Basically",
]);

/* Common interview verbs that get capitalized at sentence start but
   aren't useful as accent-extraction hooks. */
const SENTENCE_START_VERBS = new Set([
  "Tell", "Walk", "Describe", "Share", "Explain", "Give", "Take", "Let",
  "Think", "Imagine", "Consider", "Build", "Design", "Make", "Get", "Show",
]);

export interface ExtractOptions {
  /** Max number of phrases to keep per call. Defaults to 5. */
  maxPerTurn?: number;
}

/**
 * Extract noun-phrase-shaped strings from a user answer.
 *
 * Patterns picked up:
 *   - Two-or-more capitalized words in a row ("Razorpay migration",
 *     "Cash on Delivery") — proper-noun-ish phrases
 *   - "the X" / "our X" where X is a 2+-word capitalized phrase
 *   - Hyphenated tech terms ("rate-limiter", "feature-flag")
 *   - Numbered things ("team of 6", "10x growth", "₹25 LPA")
 *   - Quoted phrases ("the new dashboard")
 */
export function extractNounPhrases(text: string, options: ExtractOptions = {}): string[] {
  if (!text) return [];
  const maxPerTurn = options.maxPerTurn ?? 5;
  const found = new Set<string>();

  // 1. Multi-word proper-noun runs (e.g. "Razorpay migration", "Q4 launch")
  //    Allow up to 2 continuation words (≤3 total) — limit greediness so
  //    "Razorpay migration" doesn't swallow trailing "last year" and become
  //    a 4-word phrase. Must start with a capitalized non-stopword token.
  const properNounRe = /\b([A-Z][a-z0-9]+(?:[\s-][a-z0-9][a-zA-Z0-9]*){1,2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = properNounRe.exec(text)) !== null) {
    const phrase = m[1].trim();
    const firstWord = phrase.split(/\s+/)[0];
    if (GENERIC_STARTERS.has(firstWord) || SENTENCE_START_VERBS.has(firstWord)) continue;
    if (phrase.length < 4) continue;
    found.add(phrase);
  }

  // 2. "the X" / "our X" / "my X" + 1-3 capitalized words
  const articleRe = /\b(?:the|our|my|their)\s+([A-Z][a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+){0,2})\b/g;
  while ((m = articleRe.exec(text)) !== null) {
    const phrase = m[1].trim();
    if (phrase.length < 4) continue;
    found.add(phrase);
  }

  // 3. Hyphenated tech terms (3+ chars per side)
  const hyphenRe = /\b([a-z]{3,}-[a-z]{3,}(?:-[a-z]{3,})?)\b/gi;
  while ((m = hyphenRe.exec(text)) !== null) {
    found.add(m[1]);
  }

  // 4. Numbered scope variants. Four distinct patterns matched separately
  //    so each can have appropriate boundaries.
  //
  //    a. "team of 6" / "team of six" — supports both digit and word
  //       numbers ("two", "three", … "twenty"). The trailing word is
  //       captured for context ("team of six engineers").
  const teamOfRe = /\b(?:team|group|cohort|class|crew)\s+of\s+(\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty)(?:\s+([a-z]+))?\b/gi;
  while ((m = teamOfRe.exec(text)) !== null) {
    const tail = m[2] ? ` ${m[2]}` : "";
    found.add(`team of ${m[1]}${tail}`);
  }
  //    b. "10x growth" / "5x improvement"
  const multiplierRe = /\b(\d+x\s+[a-z]+)\b/gi;
  while ((m = multiplierRe.exec(text)) !== null) {
    found.add(m[1]);
  }
  //    c. ₹25 LPA / ₹1.5 crore. Cannot use \b before ₹ because ₹ is a
  //       non-word character — \b between two non-word chars never
  //       matches. Use a lookbehind for start-of-string-or-space instead.
  const rupeeRe = /(?:^|[\s(])(₹\s*\d+(?:\.\d+)?\s*(?:lpa|crore|cr|lakh|l|k))\b/gi;
  while ((m = rupeeRe.exec(text)) !== null) {
    found.add(m[1].trim());
  }
  //    d. "8-week project" / "3 month sprint"
  const durationRe = /\b(\d+[\s-](?:week|month|year|day|sprint|quarter|hour)s?\s+[a-z]+)\b/gi;
  while ((m = durationRe.exec(text)) !== null) {
    found.add(m[1]);
  }

  // 5. Quoted phrases ("the new dashboard", 'feature flag system')
  const quotedRe = /["']([a-zA-Z][^"']{4,40})["']/g;
  while ((m = quotedRe.exec(text)) !== null) {
    found.add(m[1].trim());
  }

  // Return in insertion order, capped
  return Array.from(found).slice(0, maxPerTurn);
}

/**
 * Maintain a rolling buffer of recently-mentioned phrases across turns.
 * Used by the engine to keep ~10 of the most-recent hooks ready for the
 * next follow-up prompt.
 */
export function appendToMemory(
  existing: ReadonlyArray<string>,
  newPhrases: ReadonlyArray<string>,
  maxBuffer = 12,
): string[] {
  const seen = new Set(existing.map(p => p.toLowerCase()));
  const out = [...existing];
  for (const p of newPhrases) {
    const key = p.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  // Keep most-recent maxBuffer entries — the front gets shifted off
  return out.slice(-maxBuffer);
}
