/* HireStepX — Shared STAR-component detection
 *
 * Lightweight regex-based detection of Situation / Task / Action / Result
 * markers in a candidate's behavioural answer.
 *
 * Why a shared module: the live micro-feedback tip ("you set the scene
 * well — what did *you* do?") and the post-session report ("perQuestion.
 * starPresence") both classify the SAME four components on the SAME
 * answer text. Drift between the two surfaces is the worst kind of bug —
 * candidate hears "Situation: present" live but the report says
 * "Missing Situation" — and erodes trust in the entire coaching stack.
 *
 * The regexes here are intentionally conservative (false negatives are
 * preferable to false positives — claiming a component is present when
 * it isn't would teach the candidate the wrong lesson). They handle the
 * common idiomatic STAR shape:
 *
 *   Situation: "at my last company / when I / in 20XX / during the…"
 *   Task     : "the challenge / problem / goal / I needed to / had to"
 *   Action   : first-person verbs (I built / I led / I designed / …)
 *   Result   : metrics (\d%, \$, ₹, "users") + outcome bridges
 *              ("which led to / so that / in the end / impact")
 *
 * Two consumers today:
 *   - src/interviewMicroFeedback.ts (live coach)
 *   - server-handlers/evaluate-session.ts (post-session report sanity)
 *
 * If you need to tune the regexes, update them HERE — both call sites
 * inherit automatically, and the unit tests in
 * src/__tests__/starDetection.test.ts pin the behaviour.
 */

export interface StarPresence {
  situation: boolean;
  task: boolean;
  action: boolean;
  result: boolean;
  /** Count of components present (0-4). */
  count: number;
  /** Metric/number signal — used by Result detection AND by the score rubric. */
  hasMetrics: boolean;
  /** "we"-heavy attribution: the answer narrates collective action ("we
   *  built / we shipped / our team did") without a clear first-person
   *  Action contribution. Indian candidates default to "we" out of cultural
   *  humility; treating that as an automatic Action-miss is a false negative.
   *  When this fires we still want the follow-up to ask "what did *you*
   *  specifically do?" — but framed as ownership clarification, not as
   *  "you didn't act." Optional in the interface so callers that
   *  synthesize a StarPresence by hand (e.g. nextStarGap unit tests)
   *  don't need to set it — detectStarPresence always populates it. */
  weHeavy?: boolean;
  /** STAR+L: Learning. Did the candidate articulate what they took away
   *  from the experience? Especially load-bearing on failure / mistake /
   *  setback questions, where a strong answer doesn't just narrate the
   *  miss — it closes with the lesson and how the candidate would handle
   *  it differently next time. Detected via reflective bridges
   *  ("I learned that…", "in hindsight…", "looking back…", "what I took
   *  away…", "next time I would…", "the lesson was…"). Optional so
   *  callers synthesising StarPresence by hand (nextStarGap unit tests)
   *  don't need to set it — detectStarPresence always populates it. */
  learning?: boolean;
}

/* Numeric / metric markers. ₹50,000 / $5M / 40% / 3x / "50 users". */
const METRIC_RE = /\d+%|\$\d|[0-9]+x\b|₹[\d,]+|[0-9]+\s*(users|customers|engineers|people|team|months|days|crore|lakh|lpa)/i;

/* Situation cues. v2 broadened beyond temporal/employment anchors
   ("at my last company / when I / in 2023") to also accept artifact-for-
   context framing ("for an admin dashboard", "for users in Tier 2
   cities", "on a fintech product") and causal openers ("because every
   module had…"). The previous narrow set false-positived "Jumped
   straight to the action" on perfectly contextual answers — e.g.
   "I built a reusable data table component for an admin dashboard
   because every module had slightly different table patterns" was
   read as having no Situation. Keep all alternates conservative:
   require a concrete artifact / domain noun after the preposition, not
   bare "for it" / "for them". */
const SITUATION_RE = /\bat\s+(?:my\s+last|my\s+previous|my\s+current)?\s*(?:company|job|role|team|firm)\b|\bwhen\s+(?:i|we)\b|\bin\s+(?:20\d\d|q[1-4])\b|\bduring\s+(?:my|the)\b|\bwe\s+were\s+\b|\bfor\s+(?:an?\s+|our\s+)?(?:admin|internal|customer[\s-]?facing|user[\s-]?facing|legacy|new|existing|enterprise|consumer|b2b|b2c|saas|mobile|web|fintech|edtech|healthtech|e[\s-]?commerce|growth|onboarding|checkout|payments?|dashboard|portal|product|platform|system|app|tool|component|service|users?\s+in)\b|\bon\s+(?:an?\s+|our\s+)(?:admin|internal|customer[\s-]?facing|legacy|new|existing|enterprise|consumer|b2b|b2c|saas|mobile|web|fintech|edtech|healthtech|e[\s-]?commerce|growth|onboarding|checkout|payments?|dashboard|portal|product|platform|system)\b|\bin\s+one\s+of\s+my\s+(?:projects|roles|teams)\b|\bin\s+my\s+(?:current|previous|last)\s+(?:project|role|team|company)\b/i;

const TASK_RE = /\b(?:the\s+(?:challenge|problem|goal|task|ask|brief)|needed\s+to|had\s+to|was\s+(?:asked|tasked)\s+to|the\s+target\s+was|our\s+goal\s+was|the\s+brief\s+was)\b/i;

/* First-person action verbs. v3 replaced an exhaustive positive whitelist
   (every literal verb stem someone remembered to add — "designed" but not
   "redesigned", "led" but not "ran"/"volunteered"/"worked") with a shape +
   blacklist approach: match ANY verb-shaped word after "I" (regular -ed
   past tense, or a common irregular past tense), then reject it only if
   it's a mental-state/auxiliary verb ("I think / I was / I felt"). This
   catches real action verbs by construction instead of requiring each one
   to be individually enumerated — the whitelist approach silently missed
   perfectly good STAR answers whose verb just wasn't on the list. */
const NON_ACTION_VERBS = new Set([
  "think", "thought", "feel", "felt", "believe", "believed", "want", "wanted",
  "wonder", "wondered", "know", "knew", "realize", "realized", "realise", "realised",
  "remember", "remembered", "hope", "hoped", "guess", "guessed", "worry", "worried",
  "seem", "seemed", "appear", "appeared", "was", "were", "am", "is", "had", "have", "has",
  "could", "would", "should", "will", "can", "may", "might", "see", "saw", "hear", "heard",
  "understand", "understood", "agree", "agreed", "mean", "meant", "need", "needed",
  "assume", "assumed", "expect", "expected", "fear", "feared", "doubt", "doubted",
  "consider", "considered", "get", "got", "go", "went", "being", "do", "did",
  "like", "liked", "notice", "noticed", "find", "found", "lose", "lost", "keep", "kept",
]);

/* Common irregular past-tense verbs that don't end in "-ed" (regular past
   tense is already caught by the shape check below). Not meant to be an
   exhaustive list of English irregulars — just the ones plausible in a
   work-story context. */
const IRREGULAR_PAST_VERBS = new Set([
  "ran", "led", "drove", "wrote", "made", "spoke", "took", "gave", "sent", "met",
  "grew", "chose", "held", "spent", "drew", "threw", "sat", "stood", "fell", "cut",
  "put", "set", "bet", "hit", "read", "shut", "spread", "cost", "hurt", "let", "split",
  "bought", "caught", "brought", "taught", "sought", "fought", "sold", "told", "wore",
  "tore", "swore", "bore", "dealt", "built", "left", "slept", "bent", "lent", "rode",
  "hid", "fed", "flew", "froze", "hung", "laid", "lit", "rang", "rose", "sang", "shook",
  "slid", "spun", "stole", "stuck", "struck", "swept", "swung", "woke", "wound", "wove",
]);

function isActionVerb(verb: string): boolean {
  const v = verb.toLowerCase();
  if (NON_ACTION_VERBS.has(v)) return false;
  return /ed$/.test(v) || IRREGULAR_PAST_VERBS.has(v);
}

/* Matches "I" (optionally with an adverb — "I personally / then / also
   ran…") followed by the verb to classify via isActionVerb(). */
const FIRST_PERSON_VERB_RE = /\bi\s+(?:personally|then|also|quickly|immediately|eventually|ultimately|actively|directly|independently)?\s*([a-z]+)\b/gi;

function hasFirstPersonAction(text: string): boolean {
  for (const m of text.matchAll(FIRST_PERSON_VERB_RE)) {
    if (isActionVerb(m[1])) return true;
  }
  return false;
}

/* Outcome bridges + the metric pattern. A metric alone counts as a Result
   signal because "we saw 40% lift" is unambiguously an outcome marker. */
/* Outcome bridges + qualitative result markers. Adoption / reception /
   achievement language is a Result signal even without a raw number —
   "became the most-used feature" or "got rolled out org-wide" describe
   outcomes as clearly as "+40%". METRIC_RE stays strict (no false
   positives from random integers); this regex catches the narratively
   phrased wins that strict metric matching would miss. */
/* "We"-action verbs — collective phrasing common in Indian candidates'
   answers ("we built / we shipped / our team launched"). Used in tandem
   with ACTION_RE: if WE_ACTION_RE fires several times but ACTION_RE
   doesn't, the candidate is narrating collective work without claiming a
   personal slice. That's the pronoun-attribution edge case, not a STAR
   failure — handled by the weHeavy flag below, NOT by counting Action as
   present (which would silently approve hiding behind the team). */
const WE_VERB_RE = /\b(?:we|our\s+team|the\s+team)\s+(?:then|also|quickly|eventually|ultimately)?\s*([a-z]+)\b/gi;

function countWeActions(text: string): number {
  let hits = 0;
  for (const m of text.matchAll(WE_VERB_RE)) {
    if (isActionVerb(m[1])) hits += 1;
  }
  return hits;
}

/* STAR+L: Learning bridges. Reflective markers that signal the candidate
   closed the loop on the experience — they didn't just describe what
   happened, they extracted a takeaway and (often) what they'd do
   differently. On failure questions this is the single strongest
   self-awareness signal; on success questions it's a nice-to-have. The
   regex is intentionally narrow — generic phrases like "it was good"
   don't count; we want explicit reflection cues. */
const LEARNING_RE = /\bi\s+learned\b|\bi\s+(?:now\s+)?realize[ds]?\b|\blesson(?:s)?\s+(?:was|were|i\s+took|learned)\b|\bthe\s+takeaway\b|\bwhat\s+i\s+(?:took\s+away|learned)\b|\bin\s+hindsight\b|\blooking\s+back\b|\bnext\s+time\s+i\s+(?:would|will|'d|d)\b|\bwhat\s+i'?d\s+do\s+differently\b|\bgoing\s+forward\s+i\b|\bsince\s+then\s+i\b|\bnow\s+i\s+(?:always|make\s+sure|start\s+by)\b/i;

const RESULT_BRIDGE_RE =/\bresult(?:ed|ing)?\b|\bwhich\s+led\s+to\b|\bwhich\s+drove\b|\bso\s+that\b|\bwe\s+saw\b|\bafter\s+(?:that|launch)\b|\bin\s+the\s+end\b|\boutcome\b|\bimpact\b|\bby\s+\d+|\bmost[\s-]used\b|\btop[\s-]rated\b|\bwidely[\s-]adopted\b|\bbecame\s+(?:the|a|our)\b|\bgained\s+(?:traction|adoption|users)\b|\bachieved\b|\b(?:was|were)\s+(?:successful|adopted)\b|\brolled\s+out\s+(?:to|across|org)\b|\bshipped\s+on\s+(?:time|schedule)\b|\bwent\s+(?:live|to\s+prod)\b/i;

export function detectStarPresence(text: string): StarPresence {
  const t = text || "";
  const hasMetrics = METRIC_RE.test(t);
  const situation = SITUATION_RE.test(t);
  const task = TASK_RE.test(t);
  const action = hasFirstPersonAction(t);
  const result = hasMetrics || RESULT_BRIDGE_RE.test(t);
  const count = [situation, task, action, result].filter(Boolean).length;
  /* Pronoun-attribution signal. Fires when the answer leans on collective
     phrasing (≥2 "we built / our team did" hits) without a balanced
     first-person Action claim. The 2-hit floor avoids tagging a single
     incidental "we shipped" as we-heavy when the rest of the answer is
     "I designed / I led". Threshold tuned to flag answers that are
     materially we-attributed, not ones with passing collective mentions. */
  const weHits = countWeActions(t);
  const weHeavy = weHits >= 2 && !action;
  const learning = LEARNING_RE.test(t);
  return { situation, task, action, result, count, hasMetrics, weHeavy, learning };
}

/** Which STAR component is most useful to nudge next, given current presence
 *  and word count. Returns null when nothing is conspicuously missing or
 *  the answer is too short to coach on STAR shape.
 *
 *  Threshold: 25 words. Earlier version gated at 40, which let a 35-word
 *  half-answer slip past the gap-injection path entirely — exactly the
 *  case where STAR coaching is most useful. 25 is the minimum length at
 *  which "Action present but missing Result" is a meaningful signal (not
 *  just a terse one-liner). */
export function nextStarGap(
  star: StarPresence,
  wordCount: number,
): "action" | "result" | "situation-task" | null {
  if (wordCount < 25) return null;
  // Two pillars present and Action is one of the missing ones — Action gap.
  if (star.count >= 2 && !star.action) return "action";
  // Two pillars present and Result is the missing one — Result gap.
  if (star.count >= 2 && !star.result) return "result";
  // Action present but no Situation OR Task — opened mid-story.
  if (star.action && !star.situation && !star.task) return "situation-task";
  return null;
}
