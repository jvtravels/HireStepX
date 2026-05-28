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
 *  this role". Tight on purpose: passing references like "the offer
 *  should be competitive" must NOT match. */
export const ANCHOR_ASK_RE =
  /\b(?:what(?:'s|\s+is)\s+(?:your|the)\s+(?:offer|package|budget|number)|how\s+much\s+(?:is\s+(?:the|your)\s+offer|are\s+you\s+offering|can\s+you\s+offer)|(?:share|tell\s+me|give\s+me)\s+(?:the\s+)?(?:offer|number|figure|amount)|what\s+number\s+are\s+we\s+looking\s+at|what(?:'s|\s+is)\s+(?:the\s+)?budget\s+for\s+this\s+role)\b/i;

/** Breakdown / recap request — "in-hand", "share the breakdown",
 *  "summarise the offer", "components", "what is base, variable,
 *  bonus". Deliberately omits bare `\bbreakup\b` (past-tense
 *  observations were false-firing pre-2026-05-22). */
export const BREAKDOWN_ASK_RE =
  /\b(?:in[\s-]?hand|take[\s-]?home|guaranteed\s+cash|what.?s\s+(?:guaranteed|fixed)|monthly\s+take[\s-]?home|after\s+tax|summari[sz]e|recap)\b|(?:share|give|provide|walk\s+me\s+through|explain|tell\s+me|can\s+you|could\s+you|what(?:'?s| is)|need|want)\s+(?:me\s+|us\s+)?(?:the\s+|a\s+|an\s+)?(?:break(?:down|up)|split|structure|components?)\b|(?:break(?:down|up)|split|structure|components?)\s+of\s+(?:the\s+|this\s+|that\s+|\d)|what\s+is\s+(?:the\s+)?base\b|base\s*,?\s*variable\s*,?\s*bonus/i;

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
