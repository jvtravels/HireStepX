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
const RESULT_BRIDGE_RE = /\bresult(?:ed|ing)?\b|\bwhich\s+led\s+to\b|\bwhich\s+drove\b|\bso\s+that\b|\bwe\s+saw\b|\bafter\s+(?:that|launch)\b|\bin\s+the\s+end\b|\boutcome\b|\bimpact\b|\bby\s+\d+|\bmost[\s-]used\b|\btop[\s-]rated\b|\bwidely[\s-]adopted\b|\bbecame\s+(?:the|a|our)\b|\bgained\s+(?:traction|adoption|users)\b|\bachieved\b|\b(?:was|were)\s+(?:successful|adopted)\b|\brolled\s+out\s+(?:to|across|org)\b|\bshipped\s+on\s+(?:time|schedule)\b|\bwent\s+(?:live|to\s+prod)\b/i;

export function detectStarPresence(text: string): StarPresence {
  const t = text || "";
  const hasMetrics = METRIC_RE.test(t);
  const situation = SITUATION_RE.test(t);
  const task = TASK_RE.test(t);
  const action = ACTION_RE.test(t);
  const result = hasMetrics || RESULT_BRIDGE_RE.test(t);
  const count = [situation, task, action, result].filter(Boolean).length;
  return { situation, task, action, result, count, hasMetrics };
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
