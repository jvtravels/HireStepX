/* Behavioral probing-depth detectors — Phase 3 of the Behavioral
 * score-improvement plan (docs/Interview Focus/SCORE_IMPROVEMENT_PLAN.md).
 *
 * Why this exists:
 *   STAR detection answers "did the candidate cover all four parts?"
 *   It does NOT answer "did the AI follow up when the answer was thin?"
 *   In real interviews, the follow-up is where ownership and depth get
 *   tested. v1 of the analyzer treated every AI reply as opaque — we
 *   couldn't tell whether the AI probed for depth or rolled past a
 *   vague "we kind of figured it out" answer.
 *
 *   This module owns the probing-quality signal set:
 *     - AI_PROBED_DEPTH      — AI asked a clarifying / dig-deeper question
 *     - AI_PROBED_OWNERSHIP  — AI asked "what did *you* do" specifically
 *     - AI_ACCEPTED_VAGUE    — AI moved on from an obviously vague answer
 *     - LEARNING_REFLECTION  — user closed with "what I learned was…"
 *     - OWNS_FAILURE         — user took accountability on a failure question
 *     - DEFLECTS_FAILURE     — user blamed team / process / context
 *
 *   The probing checks run on AI turns that *follow* a user answer; the
 *   reflection/failure checks run on user turns. All patterns require a
 *   verb form, not a noun, to stay conservative (same discipline as
 *   _behavioral-competencies.ts).
 *
 * Why standalone:
 *   behavioral.ts is already ~330 lines and growing. Pulling probing
 *   detectors into a sibling helper keeps the analyzer file readable
 *   and makes the regex set unit-testable in isolation. */

/* AI probed for depth: "how", "what specifically", "walk me through",
 * "tell me more about", "can you elaborate". Excludes generic "did you"
 * yes/no follow-ups which don't push depth. */
export const AI_PROBED_DEPTH_RE =
  /\b(?:how\s+(?:did|do|exactly|specifically)|what\s+(?:specifically|exactly|else)|walk\s+me\s+through|tell\s+me\s+more|can\s+you\s+elaborate|can\s+you\s+(?:go\s+)?deeper|dig\s+into|drill\s+down|what\s+(?:was|were)\s+the\s+(?:trade[\s-]?offs?|alternatives|options))\b/i;

/* AI probed for ownership: directly asks what *the candidate* did
 * vs. what "the team" did. The Indian interview register heavily
 * leans on "we did X" — a good AI presses for "what did *you* do".
 *
 * Mandates first-person pronoun in the question; bare "what was done"
 * doesn't count. */
export const AI_PROBED_OWNERSHIP_RE =
  /\b(?:what\s+(?:did|was)\s+(?:you|your\s+(?:role|specific|individual|personal))|your\s+specific\s+(?:contribution|role|part)|what\s+(?:specifically\s+)?did\s+you\s+(?:personally\s+)?(?:do|build|own|drive|decide)|where\s+did\s+you\s+come\s+in)\b/i;

/* User answer flagged as "vague" when ALL of:
 *   - length ≥ 60 (not a micro-reply)
 *   - no first-person action verb ("I built / I led / I drove")
 *   - heavy collective framing ("we", "the team", "they")
 * AND the next AI turn is short (< 80 chars) or doesn't probe. The
 * combination tells us the AI rolled past a vague answer without
 * pushing back. */
export const VAGUE_ANSWER_HINT_RE =
  /\b(?:we|the\s+team|they|everyone|people)\s+(?:kind\s+of|sort\s+of|basically|just|generally|usually|always)?\s*(?:figured|managed|handled|sorted|worked\s+out|got\s+(?:it|that)\s+done)\b/i;

export const FIRST_PERSON_ACTION_RE =
  /\bi\s+(?:\w+\s+){0,2}(?:led|built|drove|owned|shipped|designed|wrote|chose|decided|negotiated|escalated|proposed|implemented|coded|debugged|root[\s-]?caused|deployed|migrated|refactored|launched)\b/i;

/* Learning reflection — closure beats matter in Indian behavioral
 * rounds. The candidate explicitly names what they took away from the
 * experience. First-person framing required so "lessons learned" boilerplate
 * doesn't count. */
export const LEARNING_REFLECTION_RE =
  /\b(?:i\s+(?:learned|realised|realized|took\s+away|came\s+away|now\s+(?:know|understand)|since\s+then\s+i)|what\s+i\s+(?:learned|took\s+away)|the\s+(?:biggest|key)\s+(?:lesson|takeaway|learning)\s+(?:was|for\s+me)|in\s+hindsight\s+i|looking\s+back\s+i)\b/i;

/* Failure ownership — candidate names a mistake they made and what
 * they'd do differently. The verb has to be first-person AND past-tense
 * to count; vague "mistakes happen" doesn't. */
export const OWNS_FAILURE_RE =
  /\b(?:i\s+(?:was\s+wrong|got\s+it\s+wrong|made\s+(?:a\s+)?(?:mistake|the\s+wrong\s+call)|underestimated|over[\s-]?estimated|missed|misjudged|should\s+have|shouldn'?t\s+have|owned\s+(?:up\s+to|the\s+miss)|admitted)|my\s+(?:mistake|miss|error|fault|bad\s+call))\b/i;

/* Failure deflection — blame routed outward. Conservative: requires
 * an actor noun (team / management / client) paired with a fault verb,
 * not just any mention of others. "We shipped late" doesn't deflect;
 * "The team didn't deliver" does. */
export const DEFLECTS_FAILURE_RE =
  /\b(?:the\s+team|management|leadership|the\s+client|the\s+vendor|the\s+other\s+team|product|design|qa|engineering\s+(?:management|leadership)?)\s+(?:didn'?t|wouldn'?t|couldn'?t|failed\s+to|never|wasn'?t\s+able\s+to|kept|always)\s+\w+/i;

/* Failure-question detector — fires on AI prompts that ask about
 * mistakes, setbacks, or things gone wrong. Triggers the
 * OWNS/DEFLECTS classification on the immediately-following user
 * answer. */
export const FAILURE_QUESTION_RE =
  /\b(?:tell\s+me\s+about\s+(?:a\s+)?time\s+(?:you|when)\s+(?:you\s+)?(?:failed|messed\s+up|got\s+it\s+wrong|missed|made\s+(?:a\s+)?mistake|underestimated|things\s+(?:went|didn'?t\s+go))|(?:biggest|worst)\s+(?:mistake|failure|setback|miss)|something\s+(?:that\s+)?(?:didn'?t\s+go|went\s+wrong)|talk\s+about\s+(?:a\s+)?(?:failure|miss|setback|mistake)|tell\s+me\s+about\s+(?:a\s+)?(?:failure|setback|mistake))\b/i;

/** Classify the AI's probing quality for a follow-up turn. Pure
 *  function — caller decides which AI turn to pass in (typically the
 *  one immediately following a user answer that was missing R or
 *  vague). */
export function classifyAiProbe(text: string): {
  probedDepth: boolean;
  probedOwnership: boolean;
} {
  if (!text) return { probedDepth: false, probedOwnership: false };
  return {
    probedDepth: AI_PROBED_DEPTH_RE.test(text),
    probedOwnership: AI_PROBED_OWNERSHIP_RE.test(text),
  };
}

/** A user answer is "vague" when it leans on collective framing and
 *  lacks any first-person action verb. Length gate keeps micro-replies
 *  ("yeah", "ok") out of the signal. */
export function isVagueAnswer(text: string): boolean {
  if (!text || text.length < 60) return false;
  return VAGUE_ANSWER_HINT_RE.test(text) && !FIRST_PERSON_ACTION_RE.test(text);
}

/** Did the user reflect on what they learned? Pure regex check. */
export function hasLearningReflection(text: string): boolean {
  if (!text) return false;
  return LEARNING_REFLECTION_RE.test(text);
}

/** Failure-question response classification. Returns "owns",
 *  "deflects", or "neutral" (neither clear signal). A response can
 *  trigger both regexes ("I underestimated — and the team didn't
 *  push back"); ownership wins because the candidate did acknowledge
 *  their part. */
export function classifyFailureResponse(
  text: string,
): "owns" | "deflects" | "neutral" {
  if (!text) return "neutral";
  const owns = OWNS_FAILURE_RE.test(text);
  const deflects = DEFLECTS_FAILURE_RE.test(text);
  if (owns) return "owns";
  if (deflects) return "deflects";
  return "neutral";
}

/** Is this AI turn asking a failure-style question? */
export function isFailureQuestion(text: string): boolean {
  if (!text) return false;
  return FAILURE_QUESTION_RE.test(text);
}
