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
/* Phase-6-hygiene — tightened from the original loose `?\s*` chain to
 * a single non-capturing optional-filler group with required trailing
 * whitespace. Linear-time on adversarial input; the prior version's
 * optional quantifier + greedy `\s*` was inefficient on long collective
 * pronoun chains. */
export const VAGUE_ANSWER_HINT_RE =
  /\b(?:we|the\s+team|they|everyone|people)\s+(?:(?:kind\s+of|sort\s+of|basically|just|generally|usually|always)\s+)?(?:figured|managed|handled|sorted|worked\s+out|got\s+(?:it|that)\s+done)\b/i;

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

/* Rehearsed-opener detector. Candidates who memorise STAR templates open
 * with stiff stock phrases that don't sound like spontaneous speech. We
 * fire only when the phrase is the FIRST non-trivial chunk of the answer
 * (anchored ^) — a mid-answer "let me tell you" inside otherwise
 * spontaneous prose doesn't count. Light filler tokens (so / well /
 * okay) are allowed before the stock phrase since natural speech often
 * starts with them. */
export const REHEARSED_OPENER_RE =
  /^(?:\s*(?:so|well|okay|alright|sure)\s*[,.-]?\s*){0,2}(?:let\s+me\s+(?:tell|share|walk)\s+you\s+(?:about|through)\s+(?:a\s+(?:time|story|situation|scenario)|the\s+time)|i\s+would\s+like\s+to\s+(?:share|tell|narrate)|i\s+(?:will|would)\s+(?:like\s+to\s+)?(?:begin|start)\s+(?:by|with)|allow\s+me\s+to\s+(?:share|narrate|elaborate)|to\s+answer\s+(?:this|your)\s+question(?:\s+[,.-]?\s*i)?|in\s+response\s+to\s+(?:this|your)\s+question|as\s+per\s+(?:my|the)\s+(?:experience|understanding)|i\s+have\s+a\s+(?:very\s+)?(?:good|relevant|perfect)\s+example|there\s+was\s+(?:one|a)\s+(?:instance|time|situation)\s+(?:in|when|where)\s+my)/i;

/* Hedge-token regex for the low-conviction-delivery signal. Captures
 * filler markers ("um", "uh"), epistemic hedges ("I think", "maybe",
 * "kind of"), and verbal-tic discourse markers ("you know", "basically",
 * "literally", "honestly"). Single occurrences are normal speech;
 * density is the signal — caller gates on ≥3 hits + answer length ≥120. */
export const HEDGE_TOKEN_RE =
  /\b(?:um+|uh+|er+|hmm+|like|maybe|kind\s+of|sort\s+of|i\s+(?:think|guess|believe|feel\s+like|suppose)|i'?m\s+not\s+(?:sure|certain)|probably|possibly|somewhat|i\s+would\s+say|you\s+know|basically|literally|honestly|to\s+be\s+honest|i\s+mean)\b/gi;

/** Detect a rehearsed stock-opener at the head of the answer. Returns
 *  false on micro-replies (length < 40) — those don't carry the
 *  rehearsed-vs-spontaneous signal either way. */
export function detectRehearsedOpener(text: string): boolean {
  if (!text || text.length < 40) return false;
  return REHEARSED_OPENER_RE.test(text);
}

/** Count hedge-token hits in `text`. Used by `isLowConvictionDelivery`
 *  and exported so the report can show the absolute density. */
export function countHedgeTokens(text: string): number {
  if (!text) return 0;
  const matches = text.match(HEDGE_TOKEN_RE);
  return matches ? matches.length : 0;
}

/** Low-conviction delivery: substantive answer (≥120 chars) with hedge
 *  density ≥3. Pure check — caller still gates on per-session min-hits
 *  for the pattern-class flag. */
export function isLowConvictionDelivery(text: string): boolean {
  if (!text || text.length < 120) return false;
  return countHedgeTokens(text) >= 3;
}

/* Conflict-question detector. Fires on AI prompts that ask about
 * disagreements, pushback, alignment battles, or saying-no. Triggers
 * the one-sided-narrative classification on the immediately-following
 * user answer. Distinct from FAILURE_QUESTION_RE — failure is about
 * the candidate's own mistake; conflict is about an interpersonal
 * disagreement that requires two POVs to narrate well. */
export const CONFLICT_QUESTION_RE =
  /\b(?:disagree(?:d|ment)?|conflict|pushed?\s+back|push[\s-]?back|argument|aligned?\s+(?:on|with)|alignment|stakeholder|cross[\s-]?functional|tough\s+conversation|difficult\s+(?:conversation|stakeholder|peer)|said\s+no|saying\s+no|stand\s+(?:your|my)\s+ground|escalat(?:ed?|ion)|got\s+(?:them|him|her)\s+to|won\s+(?:them|him|her)\s+over|change\s+(?:their|someone'?s)\s+mind|convince(?:d)?)\b/i;

/* Counterparty-POV markers. A well-narrated conflict answer mentions
 * what the OTHER side wanted, believed, or feared — not just what the
 * candidate did. We look for explicit second-party framing:
 *   - "they wanted / believed / argued / pushed for / preferred"
 *   - "their concern / position / argument / view was"
 *   - "from their perspective / their side"
 *   - named role + want-verb ("the PM wanted", "engineering pushed for")
 * Conservative — requires a verb form (not just any pronoun mention)
 * so a passing "they were there" doesn't satisfy the check. */
export const COUNTERPARTY_POV_RE =
  /\b(?:they\s+(?:wanted|believed|argued|preferred|insisted|felt|thought|worried|feared|pushed\s+(?:for|back)|were\s+(?:concerned|worried|afraid))|(?:their|his|her)\s+(?:concern|position|argument|view|side|perspective|reasoning|fear|worry|priority|priorities|case)\s+(?:was|were)|from\s+(?:their|his|her)\s+(?:perspective|side|point\s+of\s+view|standpoint)|(?:the\s+)?(?:pm|product|engineering|design|qa|tech\s+lead|tl|manager|director|client|customer|user|stakeholder|leadership|legal|finance|security|sales|marketing|founders?|ceo|cto|cfo|hr|recruiter|team)\s+(?:wanted|believed|argued|insisted|felt|preferred|pushed\s+(?:for|back)|disagreed|objected|was\s+(?:concerned|worried)|thought))\b/i;

/** Detect the AI turn as a conflict-style question. */
export function isConflictQuestion(text: string): boolean {
  if (!text) return false;
  return CONFLICT_QUESTION_RE.test(text);
}

/** Does the user answer include any counterparty-POV framing? A
 *  conflict answer that lacks this reads as one-sided narration — the
 *  candidate steamrolled rather than collaborated. */
export function hasCounterpartyPov(text: string): boolean {
  if (!text || text.length < 60) return false;
  return COUNTERPARTY_POV_RE.test(text);
}

/* Concrete-miss marker for failure stories. Owning a failure isn't
 * enough at senior level — the interviewer wants to hear WHAT
 * specifically the candidate missed: a system, a process, an
 * assumption, a stakeholder, a risk, a tradeoff. Vague ownership
 * ("I underestimated it / I messed up / my mistake") with no named
 * miss-token is hindsight theatre — the candidate sounds accountable
 * without revealing whether they actually understood the failure mode.
 * We require BOTH a miss-verb AND an explicit object (the noun that
 * was missed) within the same clause. "I underestimated the
 * complexity" passes; "I underestimated it" doesn't. */
export const CONCRETE_FAILURE_MISS_RE =
  /\b(?:underestimated|over[\s-]?estimated|didn'?t\s+(?:account\s+for|consider|catch|anticipate|realise|realize|see)|failed\s+to\s+(?:account\s+for|consider|catch|anticipate|spot|notice)|missed|overlooked|skipped|ignored|under[\s-]?invested\s+in|wasn'?t\s+aware\s+of|hadn'?t\s+thought\s+about|lost\s+sight\s+of)\s+(?:the|a|an|my|our|their|how|that|whether|when|why)\s+\w+/i;

/** Did the failure-story answer name a CONCRETE thing the candidate
 *  missed? Returns false for "I made a mistake" / "I owned it" /
 *  "my bad" — these are accountability without specificity. Returns
 *  true for "I underestimated the migration risk" / "I didn't account
 *  for the rollback path" / "I overlooked the monitoring gap". */
export function hasConcreteFailureMiss(text: string): boolean {
  if (!text || text.length < 60) return false;
  return CONCRETE_FAILURE_MISS_RE.test(text);
}
