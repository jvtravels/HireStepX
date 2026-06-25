/* Unified candidate-question router (PDF#51 — 2026-05-28).
 *
 * Why this exists
 * ─────────────────────────────────────────────────────────────────
 * Before this module, three independent question classifiers ran
 * at different stages of the turn pipeline:
 *
 *   1. `_candidate-question.ts:classifyCandidateQuestion` → 14-topic
 *      taxonomy paired with a curated response-bank. Called by the
 *      canonical-prose layer; the PLANNER never invoked it.
 *
 *   2. `_question-intent.ts:classifyQuestionIntent` → 20-intent
 *      taxonomy. Used by the discovery-ledger / fact-pack layer.
 *
 *   3. `_response-contract.ts:classifyCandidateQuestion` → local
 *      3-field `{ isNumericQuestion, isDirectQuestion, topics }`
 *      struct. Used POST-LLM by the validator.
 *
 * Plus the planner tested two inline regexes against the candidate's
 * last utterance — `DIRECT_ANCHOR_ASK_RE` (1228) and
 * `BREAKDOWN_REQUEST_RE` (4313) — without calling any classifier.
 *
 * Net: a question that the 14-topic classifier would have answered
 * with curated prose could miss the planner's two inline regexes and
 * fall through to a generic discovery probe, leaving the validator to
 * flag role-reversal post-hoc. Three classifiers, zero shared routing,
 * no deterministic-prose path for known-topic questions.
 *
 * This module collapses the four entry points into one. The planner
 * calls `routeCandidateQuestion` once per turn; the validator reads
 * the SAME function's output via `routeQuestionShape`. The 14-topic
 * and 19-intent classifiers are wrapped here, not duplicated — they
 * remain the authoritative pattern banks; the router is the single
 * routing layer that sits on top.
 *
 * Design rules
 * ─────────────────────────────────────────────────────────────────
 * • Pure. No state, no I/O. Takes a string, returns a discriminated
 *   union. The planner / validator handle business gating (post-anchor
 *   phase, counter-detection, fired-ledger, etc.) against the route.
 *
 * • Precedence is fixed in this file, not the planner: anchor-ask >
 *   breakdown-ask > topical > intent-only > open-direct > null.
 *   Reordering happens here, not at four scattered call sites.
 *
 * • The router classifies SHAPE + TOPIC. It does NOT resolve curated
 *   prose. Prose resolution stays in `renderCandidateQuestionResponse`
 *   so the response-bank module owns persona resolution
 *   (sector / round overrides). The planner calls the renderer with
 *   `route.topic` and ships the result on the new `answer-direct`
 *   NextAction kind.
 */

import {
  classifyCandidateQuestion,
  type CandidateQuestionTopic,
} from "./_candidate-question";
import {
  classifyQuestionIntent,
  type QuestionIntent,
} from "./_question-intent";
/* `topicScores` + `ResponseTopic` live in `_response-contract.ts` —
 * they're the validator's keyword index and we reuse them here as the
 * single source of truth. No cycle: validator imports the router, the
 * router imports the topic helpers, neither depends on the other's
 * routing decisions. */
import {
  topicScores,
  type ResponseTopic,
} from "./_response-contract";

/* The shape of every question, regardless of variant. Pulled out so
 * the validator can drop its local 3-field classifier and consume
 * the same fields the planner sees. */
export interface QuestionShape {
  /** Trailing `?`, sentence-initial interrogative, or "can/could you /
   *  do you have" frame. */
  isDirectQuestion: boolean;
  /** Recognisably asks for a number (how much / what's the base /
   *  give me a figure / is N in budget). Subset of direct questions
   *  for the validator's "answer must contain a number" rule. */
  isNumericQuestion: boolean;
  /** Coarse response-topic keywords present in the text. Empty for
   *  statements (gated on question-shape — see PDF#50 fix in the
   *  validator). Used for drift / repeated-topic checks. */
  topics: ResponseTopic[];
}

/* Discriminated union — six variants ordered by routing priority.
 * The planner switches on `kind` and emits the appropriate
 * NextAction; the validator only needs `.shape`. */
export type QuestionRoute =
  /** Direct ask for the recruiter's headline number. Highest priority
   *  because it gates the anchor-ask preemption (PDF#51 fix 2). */
  | { kind: "anchor-ask"; shape: QuestionShape }
  /** Direct ask for a breakdown / recap of an offer already on the
   *  table. Routes to the inflation-truth / offer-breakdown branch. */
  | { kind: "breakdown-ask"; shape: QuestionShape }
  /** Matches one of the 14 curated topics in `_candidate-question.ts`.
   *  The planner can call `renderCandidateQuestionResponse(topic, ...)`
   *  to get deterministic prose and skip the LLM entirely. */
  | { kind: "topical"; topic: CandidateQuestionTopic; shape: QuestionShape }
  /** Coarse intent recognised by the 20-bucket classifier but not
   *  matched by the 14-topic curated set. The planner still routes
   *  through the LLM factPack path (intent informs the prompt). */
  | { kind: "intent-only"; intent: QuestionIntent; shape: QuestionShape }
  /** Direct question that no classifier recognised. The planner
   *  hands this to the generic answer-direct LLM path. */
  | { kind: "open-direct"; shape: QuestionShape };

/* Regex banks — exported so the planner can drop its inline copies
 * and downstream telemetry / tests can reuse the canonical patterns.
 *
 * Both were lifted verbatim from `_next-action-planner.ts` (line 1228
 * and line 4313 respectively) on 2026-05-28. Keep them here; the
 * planner's inline literals are now removed. */

/** Direct ask FOR the offer — "what's your offer", "share the
 *  number", "what number are we looking at", "what's the budget for
 *  this role". Crack 9 (2026-06-17) widened to catch the natural
 *  phrasings real candidates use to demand the headline number —
 *  "what are you offering", "what can you put on the table", "the
 *  figure you're offering", "I need a concrete/specific number",
 *  "I'd like to hear your number" — which the original tight pattern
 *  silently dropped, leaving the recruiter probing forever instead of
 *  disclosing the offer. Still tight on passing references: "the offer
 *  should be competitive" / "thanks for the offer" must NOT match. */
export const ANCHOR_ASK_RE =
  /\b(?:what(?:'s|\s+is)\s+(?:your|the)\s+(?:offer|package|budget|number)|how\s+much\s+(?:is\s+(?:the|your)\s+offer|are\s+you\s+offering|can\s+you\s+offer)|(?:share|tell\s+me|give\s+me)\s+(?:the\s+)?(?:offer|number|figure|amount)|what\s+number\s+are\s+we\s+looking\s+at|what(?:'s|\s+is)\s+(?:the\s+)?budget\s+for\s+this\s+role|what\s+are\s+you\s+offering|what\s+can\s+you\s+(?:offer|put\s+(?:on\s+the\s+table|forward|down))|what\s+(?:number|figure|offer|amount)\s+can\s+you\s+(?:offer|put\s+(?:on\s+the\s+table|forward|down))|what(?:'s|\s+is)\s+on\s+the\s+table|put\s+(?:a\s+|an\s+)?(?:number|offer|figure)\s+on\s+the\s+table|(?:number|figure|ctc|package|amount)\s+(?:that\s+)?you(?:'re|\s+are)\s+offering|(?:need|want|looking\s+for|like\s+to\s+(?:hear|know|see))\s+(?:a\s+|the\s+|your\s+|an\s+)?(?:concrete\s+|specific\s+|actual\s+|real\s+|exact\s+|ballpark\s+|rough\s+)?(?:number|figure|lpa\s*(?:number|figure)?))\b/i;

/** Breakdown / recap request — "in-hand", "share the breakdown",
 *  "summarise the offer", "components", "what is base, variable,
 *  bonus". Deliberately omits bare `\bbreakup\b` (past-tense
 *  observations were false-firing pre-2026-05-22). */
export const BREAKDOWN_ASK_RE =
  /\b(?:in[\s-]?hand|take[\s-]?home|guaranteed\s+cash|what.?s\s+(?:guaranteed|fixed)|monthly\s+take[\s-]?home|after\s+tax|summari[sz]e|recap)\b|(?:share|give|provide|walk\s+me\s+through|explain|tell\s+me|can\s+you|could\s+you|what(?:'?s| is)|need|want)\s+(?:me\s+|us\s+)?(?:the\s+|a\s+|an\s+)?(?:break(?:down|up)|split|structure|components?)\b|(?:break(?:down|up)|split|structure|components?)\s+of\s+(?:the\s+|this\s+|that\s+|\d)|what\s+is\s+(?:the\s+)?base\b|base\s*,?\s*variable\s*,?\s*bonus/i;

/** Salary-PUSH detector (F1, 2026-06-18, live-staging) — open-phrasing
 *  pressure on a standing offer that carries NO fresh number, so the
 *  numeric-counter detectors (lastCandidateCounterLpa) miss it entirely:
 *  "can you move closer?", "what can you actually do?", "can you do
 *  better?", "is that your best?", "meet me in the middle", "where can
 *  we land?", "any room to move?", "can you stretch / bump it up?".
 *
 *  These are negotiation MOVES, not generic questions. Live symptom: a
 *  candidate pushing with one of these phrasings set `askedQuestion`,
 *  and `planReactiveFollowup`'s answer-direct branch shipped the
 *  content-free "Coming back to the structure — … let me come back to
 *  where we were." filler instead of letting the counter-offer concession
 *  / lever engine own the turn (counter-base when headroom remains,
 *  hold-firm-with-reason when it doesn't). The planner consults
 *  `isSalaryPush` as a sibling skip to the numeric `liveCounterPending`
 *  gate so the negotiation engine — never the candidate-question
 *  answerer — owns a push.
 *
 *  Tight by construction: every alternative pins a negotiation verb
 *  ("do better", "stretch", "bump", "move/come closer to a number") so
 *  benign direct questions ("what can you tell me about the team?",
 *  "can you move the start date closer?") do not match — the `closer`
 *  arm carries a negative lookahead for date/location nouns. */
export const SALARY_PUSH_RE = new RegExp(
  [
    // move / get / come closer (to a number / target) — not a date or place
    "(?:move|get|come)\\s+(?:a\\s+(?:bit|little)\\s+)?closer(?!\\s+to\\s+(?:the\\s+)?(?:office|city|home|location|team|start|joining|date))",
    "closer\\s+to\\s+(?:\\d|my\\s+(?:target|number|ask|expectation|figure)|the\\s+(?:number|target|figure|ask|mark)|that(?:\\s+number)?)",
    // do better / do more / anything more
    "(?:can|could|would)\\s+you\\s+do\\s+(?:any\\s+)?(?:better|more)",
    "do\\s+(?:any\\s+)?better\\s+(?:than\\s+(?:that|this|\\d)|here|on\\s+(?:the\\s+)?(?:base|number|offer))",
    "anything\\s+(?:more|else)\\s+(?:you\\s+can\\s+do|on\\s+the\\s+(?:base|number|offer))",
    // what can you (actually/really) do/offer/stretch/manage/swing
    "what\\s+(?:can|could)\\s+you\\s+(?:actually\\s+|really\\s+)?(?:do|offer|stretch|manage|swing|push)\\b",
    // best offer / best you can do / "is that (really) your best?"
    "(?:your|the)\\s+best\\s+(?:offer|number|you(?:'ve|\\s+have)\\s+got|you\\s+can\\s+do)",
    "is\\s+(?:that|this|\\d+(?:\\.\\d+)?l?)\\s+(?:really\\s+|honestly\\s+|seriously\\s+|truly\\s+)?(?:your|the)\\s+best",
    "best\\s+(?:you\\s+can\\s+do|you(?:'ve|\\s+have)\\s+got|and\\s+final|offer\\s+you\\s+have)",
    // "is that it?" / "is that all?" / "that's all you've got?"
    "is\\s+that\\s+(?:it|all)\\b",
    "that(?:'s|\\s+is)\\s+all\\s+you(?:'ve|\\s+have)\\s+got",
    // meet in the middle / halfway
    "meet\\s+(?:me\\s+)?(?:in\\s+the\\s+middle|half\\s*way)",
    // where can we / you land; can we land
    "where\\s+(?:can|could)\\s+(?:we|you)\\s+land",
    "can\\s+we\\s+land\\s+(?:on|at|around)?\\s*\\d?",
    // room / wiggle room / flexibility
    "(?:any\\s+)?(?:wiggle\\s+)?room\\s+(?:to\\s+move|here|on\\s+(?:the\\s+)?(?:base|number|offer))",
    "(?:any\\s+)?flexibility\\s+on\\s+(?:the\\s+)?(?:base|number|offer|comp|package|ctc)",
    // stretch the band/number/offer
    "(?:can|could)\\s+you\\s+stretch",
    "stretch\\s+(?:a\\s+bit|further|more|the\\s+(?:band|number|offer|range))",
    // bump / nudge / push it up
    "bump\\s+(?:it\\s+|the\\s+(?:base|number|offer|cash|comp|package|salary|pay|ctc)\\s+)?up",
    "(?:can|could)\\s+you\\s+(?:bump|nudge|push)\\s+(?:it|the\\s+(?:number|base|offer|cash|comp|compensation|package|salary|pay|ctc|fixed))",
    "push\\s+(?:it\\s+)?(?:up|higher)",
    // increase / raise / improve the cash/comp/base/offer (live-staging
    // 2026-06-19: "push the cash" / "increase the cash" went undetected,
    // so the planner fell through to a vague-promise divert)
    "(?:can|could)\\s+you\\s+(?:increase|raise|improve|up)\\s+(?:the\\s+)?(?:cash|comp|compensation|package|salary|pay|ctc|base|number|offer|fixed)",
    // bare imperative form — "increase the cash", "raise the base", "improve the package"
    "\\b(?:increase|raise|improve)\\s+(?:the\\s+)?(?:cash|comp|compensation|package|salary|pay|ctc|base|number|offer|fixed)\\b",
    // bare "(a bit) more cash/money/comp" — open-phrasing cash push
    "(?:a\\s+(?:bit|little)\\s+)?more\\s+(?:cash|money|comp|compensation|salary|pay)\\b",
    // come up (on the base/number)
    "come\\s+up\\s+(?:a\\s+(?:bit|little)|on\\s+(?:the\\s+)?(?:base|number|offer))",
    /* PRI-59 (2026-06-25, real prod session) — an explicit, demand-form cash
     * push that names the FIXED/BASE component went undetected, so the planner
     * answered "Put your best fixed number on the table" / "what's your best
     * fixed, final answer?" with a vague-promise WFH divert and a benefits
     * recap instead of engaging the cash. These arms pin the demand-form push
     * on the cash/fixed component (the bare-number "best" arm above misses
     * "best fixed" because the component noun sits between "best" and
     * "number"). */
    // "(your/the) best fixed / best base / best cash"
    "(?:your|the)\\s+best\\s+(?:fixed|base|cash)\\b",
    // "what's / what is your best (…)" — open demand for the top number
    "what(?:'s|\\s+is)\\s+(?:your|the)\\s+best\\b",
    // "(a/your) number on the table" / "put a number on the table"
    "number\\s+on\\s+the\\s+table",
    // "forget the perks/benefits/equity — …" — explicit rejection of non-cash
    // levers IS a cash push: the candidate wants the base, not the structure.
    "forget\\s+(?:the\\s+)?(?:perks?|benefits?|equity|esop|variable|extras?)",
    // "cash only" / "fixed only" / "just the base" — cash-component insistence
    "(?:cash|fixed|base)\\s+only\\b",
    "just\\s+(?:the\\s+)?(?:cash|fixed|base)\\b",
  ].join("|"),
  "i",
);

/** True when the utterance is an open-phrasing salary push (see
 *  SALARY_PUSH_RE). Pure; safe on null/empty. The planner gates this on
 *  an offer already being on the table before treating it as a counter. */
export function isSalaryPush(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return SALARY_PUSH_RE.test(raw);
}

/* Shape detectors — extracted from the validator's local copy so
 * there is exactly one source of truth. */

const NUMERIC_QUESTION_RE_A =
  /\b(?:how\s+much|what(?:'s| is)\s+(?:the\s+)?(?:base|total|ctc|budget|breakdown|number|figure|amount)|give\s+me\s+(?:the\s+)?(?:number|figure|breakdown)|provide\s+(?:the\s+)?(?:clear\s+)?(?:number|breakdown)|can\s+you\s+(?:share|provide|give|tell\s+me)\s+(?:the\s+)?(?:number|figure|breakdown|amount))\b/i;
const NUMERIC_QUESTION_RE_B =
  /\b(?:in\s+your\s+budget|is\s+\d+\s+(?:lpa|lakhs?)\s+in\s+(?:your\s+)?budget)\b/i;
const DIRECT_INTERROGATIVE_RE =
  /^(?:what|how|when|where|why|which|who|is|are|do|does|did|can|could|would|will|should)\b/i;
const DIRECT_FRAME_RE = /\b(?:can\s+you|could\s+you|do\s+you\s+have|is\s+there|are\s+there)\b/i;

/** Compute the shape (isDirect / isNumeric / topics) without picking a
 *  variant. Exposed so the validator can call this when it only needs
 *  shape — e.g. when route is null but the text still has question
 *  punctuation we want to record for telemetry. */
export function routeQuestionShape(text: string): QuestionShape {
  const t = (text || "").trim();
  const isNumericQuestion =
    NUMERIC_QUESTION_RE_A.test(t) || NUMERIC_QUESTION_RE_B.test(t);
  const isDirectQuestion =
    /\?\s*$/.test(t) ||
    DIRECT_INTERROGATIVE_RE.test(t) ||
    DIRECT_FRAME_RE.test(t);
  /* PDF#50 fix carried forward: topics are only meaningful for the
   * drift / role-reversal checks when the candidate ACTUALLY asked
   * something. Statements return []. */
  const topics: ResponseTopic[] =
    isDirectQuestion || isNumericQuestion
      ? Array.from(topicScores(t).keys())
      : [];
  return { isDirectQuestion, isNumericQuestion, topics };
}

/** Main entry point. Returns the highest-priority route or null when
 *  the text is not a question.
 *
 *  Precedence:
 *    1. anchor-ask     — "what's your offer"
 *    2. breakdown-ask  — "share the breakdown / in-hand"
 *    3. topical        — 14-topic curated match
 *    4. intent-only    — 20-intent coarse match (no curated prose)
 *    5. open-direct    — direct-question shape, no recognised topic
 *    6. null           — statement / empty
 *
 *  Discovery-ledger interaction (2026-05-29 audit clarification):
 *  the router runs BEFORE the planner's discovery-checklist cascade.
 *  When a candidate question overlaps a wired-profile discovery topic
 *  (e.g. "what about WFH?" is both `topical:location-remote` AND a
 *  discovery item if remote-policy is on the checklist), the router's
 *  `topical` route ALWAYS wins — the planner's `routeCandidateQuestion`
 *  branch short-circuits to `answer-direct` before the discovery-probe
 *  branch is consulted. This is deliberate: a candidate explicitly
 *  asking a question gets answered first; the discovery item it
 *  satisfies is then marked via the `satisfiesTopic` field on the
 *  emitted action so the ledger doesn't re-probe.
 *
 *  Pure. */
export function routeCandidateQuestion(
  raw: string | null | undefined,
): QuestionRoute | null {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  const shape = routeQuestionShape(text);

  /* 1. Anchor-ask preempts everything else. The candidate has
   * explicitly waived discovery-first ordering — even if they also
   * said "and how does esop work?" in the same breath, the headline
   * number is what they're after. */
  if (ANCHOR_ASK_RE.test(text)) {
    return { kind: "anchor-ask", shape };
  }

  /* 2. Breakdown-ask. Same reasoning as above — when the candidate
   * is asking for a recap of numbers on the table, that's the
   * dominant intent regardless of what other tokens appear. */
  if (BREAKDOWN_ASK_RE.test(text)) {
    return { kind: "breakdown-ask", shape };
  }

  /* 3. Topical — the 14-topic curated bank. `classifyCandidateQuestion`
   * already encodes priority via INTENT_PATTERNS order and handles the
   * vesting+buyout compound disambiguation (PDF#37 BUG-F). */
  const topic = classifyCandidateQuestion(text);
  if (topic != null) {
    return { kind: "topical", topic, shape };
  }

  /* 4. Intent-only — the 20-bucket coarse classifier. Used by the
   * factPack / discovery-ledger path; no curated prose, LLM still
   * runs but with stronger context. */
  const intent = classifyQuestionIntent(text);
  if (intent != null) {
    return { kind: "intent-only", intent, shape };
  }

  /* 5. Open-direct — direct-question shape with no recognised topic
   * or intent. Hands off to the generic answer-direct LLM path. */
  if (shape.isDirectQuestion || shape.isNumericQuestion) {
    return { kind: "open-direct", shape };
  }

  /* 6. Not a question. */
  return null;
}

/** Convenience: pull the most-recent candidate utterance from the
 *  conversation log. The planner does this inline at four sites
 *  pre-2026-05-28; the router centralises it so consumers can call
 *  `routeCandidateQuestion(latestCandidateText(state))` in one line.
 *
 *  Kept here, not on the kernel, because the only callers are the
 *  router's two consumers (planner, validator). */
export function latestCandidateText(state: {
  conversationLog?: ReadonlyArray<{ speaker: string; text?: string }>;
}): string {
  const log = state.conversationLog ?? [];
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].speaker === "candidate") {
      return log[i].text ?? "";
    }
  }
  return "";
}
