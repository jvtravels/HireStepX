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

const SITUATION_RE = /\bat\s+(?:my\s+last|my\s+previous|my\s+current)?\s*(?:company|job|role|team|firm)\b|\bwhen\s+(?:i|we)\b|\bin\s+(?:20\d\d|q[1-4])\b|\bduring\s+(?:my|the)\b|\bwe\s+were\s+\b/i;

const TASK_RE = /\b(?:the\s+(?:challenge|problem|goal|task|ask|brief)|needed\s+to|had\s+to|was\s+(?:asked|tasked)\s+to|the\s+target\s+was|our\s+goal\s+was|the\s+brief\s+was)\b/i;

/* First-person action verbs. Listed exhaustively rather than \bi\s+\w+
   to avoid matching "I think / I feel / I was" as Action. */
const ACTION_RE = /\bi\s+(?:built|designed|shipped|led|drove|created|wrote|made|fixed|launched|coordinated|negotiated|trained|coached|presented|prototyped|tested|migrated|refactored|architected|implemented|defined|aligned|escalated|prioriti[sz]ed|de[\s-]?risked|set\s+up|put\s+together|reached\s+out|owned|delivered|drafted|reviewed|analyzed|analysed|championed|spearheaded|pioneered|steered|stewarded|mobili[sz]ed|rolled\s+out|stood\s+up|cut\s+over|drove\s+alignment|drove\s+a)\b/i;

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
const WE_ACTION_RE = /\b(?:we|our\s+team|the\s+team)\s+(?:built|designed|shipped|led|drove|created|wrote|made|fixed|launched|coordinated|negotiated|trained|coached|presented|prototyped|tested|migrated|refactored|architected|implemented|defined|aligned|escalated|prioriti[sz]ed|delivered|drafted|reviewed|analy[sz]ed|championed|spearheaded|pioneered|steered|rolled\s+out|stood\s+up|cut\s+over)\b/gi;

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
  const action = ACTION_RE.test(t);
  const result = hasMetrics || RESULT_BRIDGE_RE.test(t);
  const count = [situation, task, action, result].filter(Boolean).length;
  /* Pronoun-attribution signal. Fires when the answer leans on collective
     phrasing (≥2 "we built / our team did" hits) without a balanced
     first-person Action claim. The 2-hit floor avoids tagging a single
     incidental "we shipped" as we-heavy when the rest of the answer is
     "I designed / I led". Threshold tuned to flag answers that are
     materially we-attributed, not ones with passing collective mentions. */
  const weHits = (t.match(WE_ACTION_RE) || []).length;
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
