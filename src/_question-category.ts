/* HireStepX — Behavioural question category + framework classifier
 *
 * STAR is the default delivery shape for behavioural answers, but it's
 * the wrong shape for a meaningful subset of behavioural prompts:
 *
 *   - "Tell me about yourself"      → Present-Past-Future (PPF)
 *   - "Why this company / role"     → Hook-Evidence-Fit (HEF)
 *   - "Tell me about a failure"     → SOAR (Situation-Obstacle-Action-Result;
 *                                            emphasizes the LEARNING)
 *   - "Tell me about a conflict"    → SBI (Situation-Behavior-Impact)
 *   - everything else story-shaped  → STAR (default)
 *
 * Coaching STAR on a "tell me about yourself" answer punishes correct
 * behaviour. The candidate isn't supposed to be telling a single Action
 * story — they're supposed to be running a one-minute career arc. The
 * coach should reward chronology + thesis, not Situation/Task/Action/
 * Result decomposition.
 *
 * This module is the single source of truth for that classification —
 * shared by the live follow-up directive AND the post-session evaluator
 * so the candidate hears the same framework name in both surfaces.
 *
 * Pure regex matching. No LLM. Conservative — when in doubt, default to
 * STAR (the broadest framework) rather than mis-categorize.
 */

export type BehavioralCategory =
  | "self-intro"
  | "motivation"
  | "failure"
  | "conflict"
  | "leadership"
  | "ambiguity"
  | "achievement"
  | "generic";

export type CoachingFramework = "STAR" | "PPF" | "HEF" | "SOAR" | "SBI";

/* Each regex anchors on the most reliable phrasing for that category.
   Failure-mode bias: we ONLY match the unambiguous shapes — anything
   else falls through to "generic" + STAR. */

const SELF_INTRO_RE = /\b(?:tell\s+(?:me|us)\s+about\s+yourself|walk\s+(?:me|us)\s+through\s+your\s+(?:background|resume|career)|introduce\s+yourself|brief\s+intro|who\s+are\s+you\s*(?:professionally)?|your\s+story)\b/i;

const MOTIVATION_RE = /\bwhy\s+(?:do\s+you\s+want\s+|are\s+you\s+(?:interested\s+in\s+|leaving|looking|considering|making\s+the\s+switch)|are\s+you\s+)?(?:this\s+(?:company|role|job|position)|us|here|our\s+company|joining|leaving|the\s+switch|your\s+(?:current|present)\s+(?:job|company|role))\b|\bwhat\s+(?:draws|drew|attracts)\s+you\s+to\b|\bwhy\s+(?:our\s+company|this\s+team)\b/i;

/* Failure framing — "failed / didn't go well / mistake / regret /
   wouldn't do again". The phrase "tell me about a time" alone is NOT
   enough; that's the STAR opener for any story prompt. */
const FAILURE_RE = /\b(?:fail(?:ed|ure)|mistake|wrong|regret|didn't\s+(?:go|work)\s+(?:well|out|as\s+planned)|fell\s+short|missed\s+(?:the\s+|a\s+|an\s+)?(?:mark|target|deadline|goal)|setback|worst\s+(?:project|decision)|you\s+wouldn't\s+do\s+again)\b/i;

const CONFLICT_RE = /\b(?:conflict|disagree(?:ment|d)?|push(?:ed|ing)?\s+back|difficult\s+(?:coworker|colleague|teammate|stakeholder|conversation)|tough\s+conversation|stood\s+(?:up\s+to|firm)|clash(?:ed)?|friction|tension)\b/i;

const LEADERSHIP_RE = /\b(?:led\s+(?:a\s+team|the\s+team|cross[\s-]functional)|managed\s+(?:a\s+team|people|reports)|mentor(?:ed|ing|ship)|coach(?:ed)?\s+(?:a|the)\s+(?:junior|peer|team)|grow(?:ing|n)?\s+(?:a|the)?\s*team|hire(?:d)?\s+(?:and|or)\s+grew|performance\s+(?:issue|review))\b/i;

const AMBIGUITY_RE = /\b(?:ambig(?:uous|uity)|unclear\s+(?:direction|requirements|goal)|without\s+(?:clear|much)\s+(?:direction|context|information)|figure\s+(?:it|things)\s+out|incomplete\s+information|no\s+(?:playbook|precedent))\b/i;

const ACHIEVEMENT_RE = /\b(?:proud(?:est)?\s+(?:of|moment)|biggest\s+(?:win|accomplishment|achievement|impact)|greatest\s+(?:hit|achievement)|most\s+(?:impactful|significant|meaningful)|career\s+highlight)\b/i;

export function classifyBehavioralQuestion(question: string): BehavioralCategory {
  const q = (question || "").toLowerCase();
  if (!q) return "generic";
  // Order matters: more specific shapes win over less specific.
  // self-intro and motivation are top because their cues are unambiguous
  // and they're the worst false positives downstream (STAR coaching on
  // "tell me about yourself" is the canonical bad-feedback bug).
  if (SELF_INTRO_RE.test(q)) return "self-intro";
  if (MOTIVATION_RE.test(q)) return "motivation";
  if (FAILURE_RE.test(q)) return "failure";
  if (CONFLICT_RE.test(q)) return "conflict";
  if (AMBIGUITY_RE.test(q)) return "ambiguity";
  if (LEADERSHIP_RE.test(q)) return "leadership";
  if (ACHIEVEMENT_RE.test(q)) return "achievement";
  return "generic";
}

export function frameworkFor(category: BehavioralCategory): CoachingFramework {
  switch (category) {
    case "self-intro": return "PPF";
    case "motivation": return "HEF";
    case "failure":    return "SOAR";
    case "conflict":   return "SBI";
    // leadership / ambiguity / achievement / generic all coach to STAR.
    // These are story-shaped prompts where Situation→Task→Action→Result
    // remains the right grading rubric.
    default: return "STAR";
  }
}

/** One-line LLM hint describing the framework. Used by the follow-up
 *  directive to tell the coach "for THIS question, the right shape is
 *  X, not STAR" — so it doesn't fire a STAR-gap probe on a self-intro
 *  or motivation question. */
export function frameworkDirective(category: BehavioralCategory): string {
  switch (category) {
    case "self-intro":
      return `FRAMEWORK — this is a "Tell me about yourself" prompt. The correct shape is Present → Past → Future (PPF), NOT STAR. Reward chronology + a clear professional thesis. Do NOT coach Situation/Task/Action/Result decomposition. If the candidate omitted the future-aim ("what I'm looking for next"), nudge them there. Otherwise validate and move on.`;
    case "motivation":
      return `FRAMEWORK — this is a "Why this company / role" prompt. The correct shape is Hook → Evidence → Fit, NOT STAR. Reward a specific reason (not generic praise) + a credible link to their career arc. Do NOT coach Situation/Task/Action/Result. If they were generic ("great culture"), probe for ONE specific thing they researched.`;
    case "failure":
      return `FRAMEWORK — this is a failure / mistake prompt. The correct shape is Situation → Obstacle → Action → Result with explicit LEARNING (SOAR). Reward ownership ("I should have…") and concrete learnings applied since. Penalize deflection ("the real problem was the team / the timeline / the requirements"). If they didn't say what they LEARNED, probe for that, NOT for more action detail.`;
    case "conflict":
      return `FRAMEWORK — this is a conflict / disagreement prompt. The correct shape is Situation → Behavior → Impact (SBI), NOT generic STAR. Reward: specific observable behaviour (not character attacks on the other person), how they de-escalated, what changed afterwards. If they framed the other party as the villain, probe for "what could YOU have done differently?"`;
    default:
      return ""; // STAR is the default; no override needed.
  }
}
