/* Phase-6.2 — answer ↔ question topical-alignment detector.
 *
 * Catches a failure mode the existing analyzer misses: the candidate
 * answers a *different* question than the one the AI asked. Common at
 * pace — the AI asks about "a time you handled conflict" and the
 * candidate launches into a leadership story they had warmed up.
 *
 * Pure / deterministic / no LLM. Two cheap signals:
 *
 *   1. Intent-tag match. We tag the question with one of a small set
 *      of behavioural intents (conflict / failure / leadership /
 *      ambiguity / feedback / decision-making / mentorship / metric-
 *      impact / deadline-pressure). We then check the answer for
 *      signals of the SAME intent. A question with a strong intent
 *      tag and an answer with none of those signals is a flag candidate.
 *
 *   2. Content-token overlap. Stopword-filtered tokens that appear in
 *      BOTH the question and the answer. ≤1 overlap means the answer
 *      isn't reusing the question's vocabulary either — strengthens the
 *      "off-topic" call.
 *
 * Both signals must agree for `isAnswerOffTopic` to return true — keeps
 * the false-positive rate low. The analyzer additionally requires the
 * pattern to repeat (≥2 occurrences) before emitting the session-level
 * `answer_off_topic` flag, so a single misfire doesn't trip the gate.
 */

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "can", "of", "to", "in", "on", "at",
  "by", "for", "with", "about", "from", "into", "as", "that", "this", "these",
  "those", "i", "you", "he", "she", "it", "we", "they", "me", "my", "your",
  "his", "her", "its", "our", "their", "us", "them", "so", "if", "then",
  "than", "when", "where", "what", "which", "who", "whom", "whose", "how",
  "why", "tell", "time", "story", "example", "share", "describe", "talk",
  "walk", "give", "going", "got", "get", "really", "very", "just", "also",
  "any", "some", "all", "one", "two", "three", "many", "few", "lot",
  "thing", "things", "stuff", "way", "ways", "okay", "yeah", "well", "like",
  "kind", "sort", "actually", "basically", "probably", "definitely",
  "around", "right", "left", "good", "bad", "great", "nice", "fine",
]);

/** Lower-case, alpha-only tokens that survived stopword filtering and
 *  are ≥3 chars. The intersection between question and answer tokens
 *  is the "shared vocabulary" signal. */
export function extractContentTokens(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]+/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w)),
    ),
  );
}

export type BehavioralIntent =
  | "conflict"
  | "failure"
  | "leadership"
  | "ambiguity"
  | "feedback"
  | "decision-making"
  | "mentorship"
  | "metric-impact"
  | "deadline-pressure";

/** Question-side intent classifier. Returns the FIRST matching intent
 *  — questions occasionally span two intents ("decision under deadline
 *  pressure") but for off-topic detection the first-hit anchor is
 *  enough. Returns null when none match (universal / scenario-style
 *  prompts), in which case we don't run the off-topic check. */
export function detectQuestionIntent(question: string): BehavioralIntent | null {
  const q = question.toLowerCase();
  if (/\b(disagree(?:d|ment|ing)?|conflict|pushback|push back|clash(?:ed|ing)?|argument|tension|friction)\b/.test(q)) return "conflict";
  if (/\b(failed|failure|mistake|fell short|went wrong|didn'?t (?:work|go|land)|setback|missed (?:the )?(?:deadline|target|goal))\b/.test(q)) return "failure";
  if (/\b(led|leading|leadership|drove|owned|initiative|rallied|aligned the team|set (?:the )?(?:vision|direction))\b/.test(q)) return "leadership";
  if (/\b(ambiguous|unclear|undefined|fuzzy|no\s+clear|figure(?:d)? out|create clarity|without (?:clear|enough) (?:direction|requirements))\b/.test(q)) return "ambiguity";
  if (/\b(critique|feedback|review|comments?|change(?:d)? (?:your|the) (?:direction|mind|approach)|after (?:critique|feedback|research))\b/.test(q)) return "feedback";
  if (/\b(decision|trade[\s-]?off|trade[\s-]?offs?|prioritis|prioritiz|chose|choose between|weighed|judgment call)\b/.test(q)) return "decision-making";
  if (/\b(mentor|mentored|mentoring|coach(?:ed|ing)?|junior|onboard(?:ed|ing)?|raised the (?:bar|quality)|grew the team)\b/.test(q)) return "mentorship";
  if (/\b(impact|metric|moved the needle|measurable|outcome|business goal|revenue|growth|users? impact)\b/.test(q)) return "metric-impact";
  if (/\b(tight deadline|under pressure|short timeline|crunch|last minute|launch (?:by|deadline)|ship(?:ped|ping) under)\b/.test(q)) return "deadline-pressure";
  return null;
}

/** Answer-side signal scanner. Returns the set of intents for which
 *  this answer carries some lexical evidence. Looser than the question
 *  classifier on purpose — answers are paraphrased differently than
 *  the question wording. */
export function detectAnswerIntentSignals(answer: string): Set<BehavioralIntent> {
  const a = answer.toLowerCase();
  const hits = new Set<BehavioralIntent>();
  if (/\b(disagree|disagreement|conflict|pushback|push back|argument|tension|clash|friction|aligned (?:them|him|her|after))\b/.test(a)) hits.add("conflict");
  if (/\b(failed|failure|mistake|fell short|went wrong|didn'?t (?:work|go|land)|setback|missed (?:the )?(?:deadline|target|goal)|in hindsight|i would have)\b/.test(a)) hits.add("failure");
  if (/\b(i led|i drove|i owned|i rallied|i aligned|set the vision|set the direction|i decided|i took ownership)\b/.test(a)) hits.add("leadership");
  if (/\b(ambiguous|unclear|undefined|fuzzy|no\s+clear|figure(?:d)? out|created clarity|with(?:out)? (?:clear|enough) (?:direction|requirements|brief))\b/.test(a)) hits.add("ambiguity");
  if (/\b(critique|feedback|review|comments?|after (?:critique|feedback|research|the review)|changed (?:my|the) (?:direction|mind|approach|design))\b/.test(a)) hits.add("feedback");
  if (/\b(decision|trade[\s-]?off|trade[\s-]?offs?|prioritis|prioritiz|chose|choose between|weighed|judgment call|i decided)\b/.test(a)) hits.add("decision-making");
  if (/\b(mentor|mentored|mentoring|coach(?:ed|ing)?|junior|onboard(?:ed|ing)?|raised the (?:bar|quality)|grew the team|design crit)\b/.test(a)) hits.add("mentorship");
  if (/\b(impact|metric|moved the needle|measurable|outcome|business goal|revenue|growth|users impacted|reduced|increased|improved|by \d|\d\s?%)\b/.test(a)) hits.add("metric-impact");
  if (/\b(tight deadline|under pressure|short timeline|crunch|last minute|launch (?:by|deadline)|ship(?:ped|ping) under|two weeks|one week)\b/.test(a)) hits.add("deadline-pressure");
  return hits;
}

export interface OffTopicCheck {
  offTopic: boolean;
  /** Why we decided (or didn't) — preserved for the analyzer to surface
   *  in `rubric_gaps` evidence strings. */
  reason: string;
  questionIntent: BehavioralIntent | null;
  answerIntents: BehavioralIntent[];
  /** Count of content tokens shared between question and answer. */
  overlapCount: number;
}

/** Joint signal. Off-topic = question has a clear intent AND the answer
 *  carries NONE of that intent AND token overlap is ≤1. All three must
 *  agree to keep false positives down. */
export function isAnswerOffTopic(
  question: string,
  answer: string,
): OffTopicCheck {
  const questionIntent = detectQuestionIntent(question);
  const answerIntents = detectAnswerIntentSignals(answer);
  const qTokens = new Set(extractContentTokens(question));
  const aTokens = new Set(extractContentTokens(answer));
  let overlapCount = 0;
  for (const t of qTokens) if (aTokens.has(t)) overlapCount += 1;

  if (!questionIntent) {
    return {
      offTopic: false,
      reason: "no question intent — skipped",
      questionIntent,
      answerIntents: Array.from(answerIntents),
      overlapCount,
    };
  }
  /* Short answers are excluded upstream (≥60 chars). If the answer
   * carries the same intent signal, it's on-topic regardless of token
   * overlap (e.g. "we clashed on the API contract" answers a conflict
   * question without re-saying "conflict"). */
  if (answerIntents.has(questionIntent)) {
    return {
      offTopic: false,
      reason: `answer carries ${questionIntent} signal`,
      questionIntent,
      answerIntents: Array.from(answerIntents),
      overlapCount,
    };
  }
  /* Vocabulary fallback — even without an intent match, a well-
   * anchored answer reuses ≥2 content tokens from the question. */
  if (overlapCount >= 2) {
    return {
      offTopic: false,
      reason: `${overlapCount} shared content tokens`,
      questionIntent,
      answerIntents: Array.from(answerIntents),
      overlapCount,
    };
  }
  return {
    offTopic: true,
    reason: `question intent=${questionIntent} not present in answer; overlap=${overlapCount}`,
    questionIntent,
    answerIntents: Array.from(answerIntents),
    overlapCount,
  };
}
