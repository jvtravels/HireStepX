/* HireStepX — Reverse-interview question quality classifier
 *
 * At the end of a behavioural interview the interviewer flips the
 * floor: "Do you have any questions for us?" In Indian-context
 * interviews this turn is heavily weighted — the wrong question here
 * (asking about salary on round 1, asking about WFH aggressively,
 * asking "when can I expect promotion?") can drop an otherwise strong
 * candidate from offer to no-offer.
 *
 * Conversely, the RIGHT question signals senior judgement: "What does
 * success in this role look like in 90 days?" / "How is the team
 * structured between onsite and offshore?" / "What's the variable
 * payout history at this band?".
 *
 * This module is a pure classifier — it sorts a candidate's
 * reverse-interview questions into three buckets:
 *
 *   • green  — substance-of-role signal (success criteria, team shape,
 *              tech / decision-making, growth path framed as
 *              contribution not entitlement, recent product wins/losses)
 *   • yellow — neutral or premature without being a red flag (basic
 *              logistics, generic culture questions, "anything else I
 *              should know?")
 *   • red    — high-frequency rejection triggers in Indian interviews
 *              (salary in round 1, aggressive WFH, promotion timeline,
 *              "how much would you pay me", attendance / leave policy
 *              before offer, asking the interviewer to do their HR's job)
 *
 * Why pure: trivially unit-testable, regex-only, runs the same way in
 * the live coach (which can warn before sending) and in the report
 * (which can score the closing turn).
 *
 * The classifier is conservative: when no detector fires we return
 * "yellow" (neutral), NOT "green". A real signal of senior judgement
 * has to match a specific shape, not just an absence of red flags.
 */

export type ReverseQuestionBucket = "green" | "yellow" | "red";

export interface ReverseQuestionClassification {
  bucket: ReverseQuestionBucket;
  /** Short reason code — useful for telemetry and for surfacing a
   *  one-line "why this is green/yellow/red" tooltip in the report. */
  reason: string;
}

/* Green markers — questions that signal substantive engagement with
   the role itself. Conservative: each pattern must clearly map to a
   role / team / decision-making probe, NOT a generic culture-fit. */
const GREEN_PATTERNS: Array<[RegExp, string]> = [
  [/\bwhat\s+(?:does\s+success|would\s+success|good\s+looks?)\s+(?:look\s+like|mean)\s+(?:in|for|after|by)\s+(?:the\s+)?(?:first\s+)?(?:30|60|90|120)\s+days?\b/i, "success_definition"],
  [/\bhow\s+(?:is|are)\s+(?:the\s+team|this\s+team|the\s+role)\s+(?:structured|organi[sz]ed|set\s+up)\b/i, "team_structure"],
  [/\b(?:what'?s|what\s+is)\s+the\s+(?:biggest|hardest|toughest)\s+(?:problem|challenge|technical\s+challenge|trade[\s-]?off)\s+(?:the\s+team|you|this\s+role)\s+(?:is\s+)?(?:facing|currently\s+working\s+on|working\s+on)\b/i, "current_challenge"],
  [/\bhow\s+(?:are|do)\s+(?:decisions|technical\s+decisions|product\s+decisions|architecture\s+decisions)\s+(?:made|taken)\b/i, "decision_making_process"],
  [/\bwhat'?s?\s+(?:the\s+)?(?:variable|bonus|payout)\s+(?:history|payout\s+history|hit\s+rate)\b/i, "variable_payout_history"],
  [/\bwhat\s+(?:are\s+)?(?:you|the\s+team)\s+(?:hoping|expecting)\s+(?:i|the\s+person|this\s+role)\s+(?:would|will|to)\s+(?:bring|change|improve|contribute)\b/i, "expected_contribution"],
  [/\bhow\s+(?:do|does)\s+(?:you|the\s+team|engineering|product)\s+(?:think|approach|decide)\s+about\s+(?:tech\s+debt|prioriti[sz]ation|trade[\s-]?offs|build\s+vs\s+buy)\b/i, "tech_debt_or_tradeoffs"],
  [/\bwhat'?s?\s+(?:something|one\s+thing)\s+(?:that\s+)?(?:didn'?t\s+work|surprised\s+you|you'?d\s+do\s+differently)\b/i, "honest_reflection_invite"],
  [/\b(?:onshore|onsite|offshore|client[\s-]?facing)\s+(?:split|model|setup|structure|cadence)\b/i, "services_structure_probe"],
];

/* Red markers — high-frequency rejection triggers in Indian interviews.
   These are pinned to phrasings that real recruiters / hiring managers
   on Glassdoor / AmbitionBox cite as "instant red flag" or "lowered
   my rating significantly". */
const RED_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:what'?s?\s+the\s+(?:salary|ctc|pay|compensation|package)|how\s+much\s+(?:would\s+|will\s+|do\s+)?(?:you|they)\s+(?:pay|offer)|what'?s?\s+the\s+ctc)\b/i, "salary_too_early"],
  [/\b(?:can\s+i\s+)?(?:work\s+from\s+home|wfh)\s+(?:full\s+time|permanently|always|every\s+day)\b/i, "wfh_aggressive"],
  [/\bwhen\s+(?:can|will|would|should)\s+i\s+(?:expect|get|see)\s+(?:a\s+)?(?:promotion|hike|increment|next\s+level|band\s+jump)\b/i, "promotion_timeline_entitled"],
  [/\b(?:what'?s?|what\s+is)\s+(?:the\s+)?(?:leave\s+policy|attendance\s+policy|sick\s+leave|casual\s+leave|paid\s+leave|annual\s+leave)\b/i, "leave_policy_pre_offer"],
  [/\bhow\s+(?:strict|lenient)\s+(?:is|are)\s+(?:you|the\s+company|hr)\s+(?:about|on)\s+(?:attendance|timing|punctuality)\b/i, "attendance_strictness"],
  [/\b(?:will|do)\s+(?:i\s+have\s+to|you\s+expect\s+me\s+to)\s+(?:work\s+(?:on\s+)?weekends|do\s+night\s+shifts|work\s+overtime)\b/i, "anti_work_signalling"],
  [/\b(?:can\s+(?:i\s+)?(?:negotiate|push\s+for|get)\s+a\s+(?:higher|bigger)\s+(?:joining|signing)\s+bonus)\b/i, "joining_bonus_negotiation_too_early"],
];

/* Yellow patterns — explicitly neutral / mildly premature. Captured to
   distinguish "user asked SOMETHING" from "user said nothing or said
   only red things". A real reverse interview should have at least one
   green; only-yellow reads as low-engagement. */
const YELLOW_PATTERNS: Array<[RegExp, string]> = [
  [/\b(?:tell\s+me\s+more\s+about|what'?s?\s+the\s+culture\s+like|how'?s?\s+the\s+culture)\b/i, "generic_culture"],
  [/\b(?:what'?s?\s+the\s+(?:next\s+steps?|process\s+from\s+here|timeline\s+for\s+a\s+decision))\b/i, "process_basics"],
  [/\b(?:anything\s+(?:else\s+)?i\s+should\s+know|do\s+you\s+have\s+any\s+concerns)\b/i, "generic_closer"],
];

/** Classify a single reverse-interview question. */
export function classifyReverseQuestion(text: string): ReverseQuestionClassification {
  const t = (text || "").trim();
  if (!t) return { bucket: "yellow", reason: "empty" };
  for (const [re, reason] of RED_PATTERNS) {
    if (re.test(t)) return { bucket: "red", reason };
  }
  for (const [re, reason] of GREEN_PATTERNS) {
    if (re.test(t)) return { bucket: "green", reason };
  }
  for (const [re, reason] of YELLOW_PATTERNS) {
    if (re.test(t)) return { bucket: "yellow", reason };
  }
  return { bucket: "yellow", reason: "unclassified" };
}

/* Closing-ritual detection — separate lens from the question-quality
   buckets above. The reverse-interview turn is also where a candidate
   either lands the close gracefully or ends it flat. In Indian HR/behavioural
   loops the polished close has three moves, in roughly this order:

     1. courtesy / gratitude  — "thank you for your time / the conversation"
     2. interest affirmation  — restating genuine enthusiasm for the role
     3. next-steps confirmation — "what are the next steps / when do I hear back"

   These are NOT scored as reverse questions (asking next-steps is yellow as a
   *question*, but as a *closing move* it's a positive courtesy signal — the
   lenses genuinely differ), so we detect them independently and surface them
   as a small closing-ritual readout. Pure regex, conservative: a move only
   counts when it matches a specific shape. */
const CLOSING_THANKS_RE =
  /\b(?:thank\s*(?:you|u)|thanks|thankyou|(?:really|truly|so)?\s*appreciate\s+(?:your|the|you|this)|grateful\s+for\s+(?:your|the|this))\b/i;
const CLOSING_INTEREST_RE =
  /\b(?:(?:i'?m|i\s+am|really|very|genuinely|so)\s+(?:excited|interested|keen|enthusiastic|thrilled|pumped)|look(?:ing)?\s+forward\s+to|would\s+(?:love|be\s+(?:happy|glad|thrilled|excited))\s+to\s+(?:join|work|contribute|be\s+(?:a\s+)?part)|(?:really\s+)?(?:excited|keen|enthusiastic)\s+about\s+(?:this|the)\s+(?:role|opportunity|team|mission|company|position))\b/i;
const CLOSING_NEXT_STEPS_RE =
  /\b(?:next\s+steps?|what(?:'?s|\s+is|\s+are|\s+would\s+be)?\s+(?:the\s+)?(?:next|further\s+steps?)|what\s+(?:happens|comes)\s+(?:next|after\s+this|from\s+here)|when\s+(?:can|should|will|might|do)\s+i\s+(?:expect|hear|know)|hear\s+back|timeline\s+for\s+(?:a\s+)?(?:decision|the\s+(?:process|next\s+round))|process\s+from\s+here|how\s+(?:soon|long)\s+(?:will|until|before|does))\b/i;

export type ClosingRitualVerdict = "polished" | "adequate" | "abrupt";

export interface ClosingRitualSignals {
  /** Candidate thanked the interviewer / expressed courtesy. */
  thanked: boolean;
  /** Candidate restated genuine interest in the role. */
  affirmedInterest: boolean;
  /** Candidate confirmed next steps / decision timeline. */
  confirmedNextSteps: boolean;
  /** Count of the three closing moves performed (0–3). */
  performed: number;
  /** Heuristic verdict: all three = polished, at least one = adequate,
   *  none = abrupt. */
  verdict: ClosingRitualVerdict;
}

/** Detect the closing-ritual moves in a candidate's closing turn. Runs over
 *  the whole answer (not the per-question split) since courtesy / interest
 *  statements rarely end in "?". */
export function detectClosingRitual(text: string): ClosingRitualSignals {
  const t = (text || "").trim();
  const thanked = t.length > 0 && CLOSING_THANKS_RE.test(t);
  const affirmedInterest = t.length > 0 && CLOSING_INTEREST_RE.test(t);
  const confirmedNextSteps = t.length > 0 && CLOSING_NEXT_STEPS_RE.test(t);
  const performed = (thanked ? 1 : 0) + (affirmedInterest ? 1 : 0) + (confirmedNextSteps ? 1 : 0);
  const verdict: ClosingRitualVerdict = performed >= 3 ? "polished" : performed >= 1 ? "adequate" : "abrupt";
  return { thanked, affirmedInterest, confirmedNextSteps, performed, verdict };
}

export interface ReverseInterviewSummary {
  /** Per-question classifications, in the order the candidate asked them. */
  classifications: ReverseQuestionClassification[];
  /** Counts for quick UI rendering / coaching summary. */
  counts: { green: number; yellow: number; red: number };
  /** Heuristic overall verdict for the closing turn. Tuned to match
   *  Indian-hiring-manager expectations: a single green saves a closing
   *  turn; any red is a real signal worth flagging; only-yellow reads as
   *  low engagement. */
  verdict: "strong" | "neutral" | "weak" | "red_flag";
  /** Closing-ritual readout (courtesy / interest / next-steps). Independent
   *  of the question-quality buckets — a turn can have strong questions but
   *  an abrupt close, or vice-versa. */
  closing: ClosingRitualSignals;
}

/** Classify the whole reverse-interview turn — multiple questions in
 *  one answer get split on "?" boundaries. */
export function summarizeReverseInterview(answerText: string): ReverseInterviewSummary {
  const t = (answerText || "").trim();
  if (!t) {
    return {
      classifications: [],
      counts: { green: 0, yellow: 0, red: 0 },
      verdict: "weak", // no question asked when invited = low engagement
      closing: detectClosingRitual(""),
    };
  }
  // Split into individual questions. Conservative: only split on "?"
  // to avoid mis-splitting statements that contain commas.
  const parts = t
    .split(/\?+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 5); // ignore noise fragments

  const classifications = parts.length > 0
    ? parts.map((p) => classifyReverseQuestion(p))
    : [classifyReverseQuestion(t)];

  const counts = { green: 0, yellow: 0, red: 0 };
  for (const c of classifications) counts[c.bucket]++;

  let verdict: ReverseInterviewSummary["verdict"];
  if (counts.red > 0) verdict = "red_flag";
  else if (counts.green >= 1) verdict = "strong";
  else if (counts.yellow >= 1) verdict = "neutral";
  else verdict = "weak";

  return { classifications, counts, verdict, closing: detectClosingRitual(t) };
}
