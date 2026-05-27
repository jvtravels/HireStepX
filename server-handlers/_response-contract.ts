/* Response contract — post-LLM enforcement seam (PDF#48 — 2026-05-27).
 *
 * Why this exists
 * ─────────────────────────────────────────────────────────────────
 * Every previous PDF (#44–#48) surfaced a new way the LLM violated
 * the kernel's intent: premature anchor disclosure, walk-away leak,
 * internal taxonomy ("market mode soft") echoed verbatim, topic
 * drift (asked about CTC, answered about medical), generic filler
 * ("specifics determined by company's overall compensation
 * structure"), repeated benefit explanations.
 *
 * The pattern across all five: the kernel decides what to say, the
 * LLM is given latitude to write it, and there is no enforcement
 * layer downstream. `detectTokenLeak` exists but only matches
 * literal kernel jargon; the LLM rephrases enough to slip through.
 * The fix is not a 122nd helper module — it's a contract the
 * response must satisfy or it is rejected.
 *
 * What this enforces
 * ─────────────────────────────────────────────────────────────────
 *   1. Walk-away leak: the walk-away figure (maxStretch + walkAway)
 *      must never appear in prose. Real recruiters never reveal
 *      their ceiling.
 *   2. Internal taxonomy: words like "market mode", "fitment band",
 *      "stretch", "anchor", "cumulative urgency" are kernel
 *      vocabulary, not recruiter vocabulary. Forbidden in prose.
 *   3. Filler patterns: phrases like "specifics depend on", "with
 *      details determined by the company's overall compensation
 *      structure" indicate the LLM produced no information at all.
 *      Reject — better to defer cleanly than ship filler.
 *   4. Topic drift: if the candidate asked a numeric/concrete
 *      question and the response contains no relevant numbers AND
 *      drifts to a different topic (benefits when asked about base,
 *      etc.), it failed to address the candidate.
 *   5. Hard-rejection ignore: if the candidate's last utterance was
 *      a terminal intent (reject/withdraw/end), the response MUST
 *      be a graceful close. Defense-in-depth — the upstream
 *      terminal-intent classifier should already have caught this,
 *      but if anything bypasses it, this layer fires.
 *
 * Output
 * ─────────────────────────────────────────────────────────────────
 * `validateResponseContract` returns either ok:true or ok:false
 * with the violation set + a regeneration hint string suitable for
 * tightening the next prompt. The caller chooses whether to
 * regenerate (one shot) or fall back to canonical text.
 *
 * Forward-compatible shape: `ResponseEnvelope` is the structured-
 * output schema the LLM will emit in a future migration (Layer 5).
 * Until then the validator operates on plain string `text` and the
 * envelope interface is documentation for the next session.
 */

import type { NegotiationState, AiMove } from "./_negotiation-kernel";
import { detectTerminalIntent, type TerminalIntent } from "./_terminal-intent";

/* Future Layer 5 contract — the structured envelope the LLM should
 * eventually emit in place of free-form prose. Keeping the type
 * here means the eventual migration is "swap the prose validator
 * for a schema validator" rather than "design a new contract from
 * scratch". Not used today; documented for the next session. */
export interface ResponseEnvelope {
  /** Brief acknowledgement of what the candidate said. ≤1 sentence. */
  acknowledge: string;
  /** What this turn delivers — numbers MUST be whitelisted by kernel.move. */
  deliver: {
    numbers: number[];
    topics: ResponseTopic[];
    prose: string;
  };
  /** The forward-motion question/ask, if any. ≤1 sentence. */
  ask?: string;
}

export type ResponseTopic =
  | "base"
  | "variable"
  | "fixed-cash"
  | "esop"
  | "joining-bonus"
  | "retention-bonus"
  | "medical"
  | "term-life"
  | "accidental"
  | "pf"
  | "gratuity"
  | "flexi-allowance"
  | "notice-period"
  | "joining-date"
  | "band-floor"
  | "band-explanation"
  | "counter-acknowledge"
  | "graceful-close"
  | "deferral";

export type ContractViolation =
  | "walk-away-leak"
  | "internal-taxonomy"
  | "filler-non-answer"
  | "topic-drift"
  | "terminal-intent-ignored"
  | "unauthorized-number";

export interface ContractResult {
  ok: boolean;
  violations: ContractViolation[];
  /** Tokens / patterns that triggered each violation, for telemetry. */
  evidence: string[];
  /** Suggested prompt addendum for a regeneration attempt. */
  regenerateHint: string;
}

/* Internal kernel vocabulary that should never appear in recruiter
 * prose. Match is word-boundary case-insensitive. Tuned against the
 * PDF#48 transcript where "market mode for the offer is soft" leaked
 * the `MarketMode` enum verbatim. */
const INTERNAL_TAXONOMY_RE =
  /\b(?:market\s+mode|fitment\s+band|stretch\s+band|max[- ]?stretch|walk[- ]?away|anchor(?:ing)?\s+(?:point|number)|cumulative\s+urgency|move\s+tag|lever\s+(?:strict|soft|hold)|kernel|hardBandCap|hard[- ]?band[- ]?cap|finalOfferAsserted|verbalAcceptance|infoAsked|vossTactics)\b/i;

/* Filler-pattern regex — LLM "I have no information so I'll wave
 * my hands" phrases. These shipped in PDF#48 turn 8: "a mix of
 * fixed and variable components, with specifics determined by the
 * company's overall compensation structure" — zero information,
 * just polite filler. Reject and force a regeneration or defer. */
const FILLER_PATTERNS: RegExp[] = [
  /\bspecifics\s+(?:are\s+)?determined\s+by\b/i,
  /\bdepend(?:s|ing)?\s+on\s+(?:the\s+)?company'?s?\s+(?:overall\s+)?(?:compensation|policy)/i,
  /\bvar(?:y|ies)\s+(?:heavily\s+)?based\s+on\b/i,
  /\b(?:final|exact|specific)\s+(?:numbers|details|terms)\s+will\s+be\s+(?:shared|provided|determined)\s+(?:later|in\s+the\s+offer\s+letter)\b.*\bspecific/i,
  /\boverall\s+compensation\s+structure\b/i,
];

/* Topic-keyword map. Coarse — purpose is detecting drift, not
 * semantic search. Each entry is (topic → regex of keywords that
 * indicate the candidate is ASKING about this topic, OR that the
 * response is DELIVERING this topic). */
const TOPIC_KEYWORDS: Record<ResponseTopic, RegExp> = {
  "base": /\b(?:base|fixed\s+salary|base\s+salary|base\s+split)\b/i,
  "variable": /\b(?:variable|bonus\s+structure|variable\s+pay|performance\s+bonus)\b/i,
  "fixed-cash": /\b(?:cash|fixed\s+cash|in[- ]?hand)\b/i,
  "esop": /\b(?:esop|rsu|equity|stock(?:\s+grant)?|stocks)\b/i,
  "joining-bonus": /\b(?:joining\s+bonus|signing\s+bonus|sign[- ]?on)\b/i,
  "retention-bonus": /\b(?:retention\s+bonus|retention)\b/i,
  "medical": /\b(?:medical|health|insurance|mediclaim)\b/i,
  "term-life": /\b(?:term\s+life|life\s+insurance|term\s+insurance)\b/i,
  "accidental": /\b(?:accidental|personal\s+accident)\b/i,
  "pf": /\bpf\b|\bprovident\s+fund\b/i,
  "gratuity": /\bgratuity\b/i,
  "flexi-allowance": /\bflexi(?:[- ]?(?:allowance|basket))?\b/i,
  "notice-period": /\b(?:notice\s+period|notice\b)/i,
  "joining-date": /\bjoining\s+date\b|\bstart\s+date\b/i,
  "band-floor": /\b(?:band|range|budget)\b/i,
  "band-explanation": /\b(?:budget|grade|level|fitment)\b/i,
  "counter-acknowledge": /\b(?:counter|asking\s+for|looking\s+for)\b/i,
  "graceful-close": /\b(?:wrap|close|withdraw|rejected|declined)\b/i,
  "deferral": /\b(?:share\s+later|come\s+back|circle\s+back|check\s+and\s+revert)\b/i,
};

/* Question-shape detectors for the candidate's last utterance.
 * Catches "what is the base?" / "can you give the breakdown" /
 * "is 32 in budget?" — patterns where the candidate asked a
 * specific question and the response is expected to address it. */
function classifyCandidateQuestion(text: string): { isNumericQuestion: boolean; topics: ResponseTopic[] } {
  const t = (text || "").toLowerCase();
  const topics: ResponseTopic[] = [];
  for (const [topic, re] of Object.entries(TOPIC_KEYWORDS) as Array<[ResponseTopic, RegExp]>) {
    if (re.test(t)) topics.push(topic);
  }
  const isNumericQuestion =
    /\b(?:how\s+much|what(?:'s| is)\s+(?:the\s+)?(?:base|total|ctc|budget|breakdown|number|figure|amount)|give\s+me\s+(?:the\s+)?(?:number|figure|breakdown)|provide\s+(?:the\s+)?(?:clear\s+)?(?:number|breakdown)|can\s+you\s+(?:share|provide|give|tell\s+me)\s+(?:the\s+)?(?:number|figure|breakdown|amount))\b/i.test(text || "")
    || /\b(?:in\s+your\s+budget|is\s+\d+\s+(?:lpa|lakhs?)\s+in\s+(?:your\s+)?budget)\b/i.test(text || "");
  return { isNumericQuestion, topics };
}

/* Extract every plausible LPA / lakh / numeric figure from prose.
 * Used to (a) detect walk-away leaks and (b) verify response
 * addresses a numeric question. */
function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /(?:₹\s*)?(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:lpa|lakhs?|l\b|cr|crore)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text || "")) !== null) {
    const n = parseFloat(m[1].replace(",", "."));
    if (!Number.isNaN(n) && n >= 0.5 && n <= 200) out.push(n);
  }
  return out;
}

export interface ContractInput {
  text: string;
  move: AiMove;
  state: NegotiationState;
  candidateLastUtterance: string;
}

export function validateResponseContract(input: ContractInput): ContractResult {
  const { text, state, candidateLastUtterance } = input;
  const violations: ContractViolation[] = [];
  const evidence: string[] = [];
  const hints: string[] = [];

  /* 1. Walk-away leak — the walk-away figure must never appear in
   * prose. Numeric tolerance ±0.05 LPA to account for rounding
   * surface variations (42.4 vs 42.40). */
  const walkAway = state.band?.walkAway;
  const maxStretch = state.band?.maxStretch;
  const proseNumbers = extractNumbers(text);
  for (const n of proseNumbers) {
    if (walkAway != null && Math.abs(n - walkAway) < 0.05) {
      violations.push("walk-away-leak");
      evidence.push(`walk-away=${walkAway} appeared as ${n}`);
      hints.push(`NEVER disclose the walk-away figure (${walkAway} LPA). The candidate must not learn the ceiling.`);
      break;
    }
    if (maxStretch != null && Math.abs(n - maxStretch) < 0.05 && !state.hardBandCap) {
      /* Soft max-stretch should also stay private unless the
       * candidate has been explicitly told the band; for now
       * we treat both as leaks. */
      violations.push("walk-away-leak");
      evidence.push(`max-stretch=${maxStretch} appeared as ${n}`);
      hints.push(`NEVER disclose the max-stretch figure (${maxStretch} LPA).`);
      break;
    }
  }

  /* 2. Internal taxonomy leak. */
  const taxonomyMatch = text.match(INTERNAL_TAXONOMY_RE);
  if (taxonomyMatch) {
    violations.push("internal-taxonomy");
    evidence.push(`taxonomy="${taxonomyMatch[0]}"`);
    hints.push(`Use recruiter-natural language. Forbidden internal terms: "${taxonomyMatch[0]}".`);
  }

  /* 3. Filler / non-answer patterns. */
  for (const re of FILLER_PATTERNS) {
    const m = text.match(re);
    if (m) {
      violations.push("filler-non-answer");
      evidence.push(`filler="${m[0].slice(0, 60)}"`);
      hints.push(`Do not produce filler. Either give a concrete answer with the kernel-provided numbers or defer cleanly ("I'll share the exact figure before the offer letter.").`);
      break;
    }
  }

  /* 4. Topic drift. Only check when the candidate asked a clear
   * question — if they made a statement ("my current is 24 LPA"),
   * no drift check applies. */
  const question = classifyCandidateQuestion(candidateLastUtterance);
  if (question.topics.length > 0 || question.isNumericQuestion) {
    /* Detect the response's topics. */
    const responseTopics: ResponseTopic[] = [];
    for (const [topic, re] of Object.entries(TOPIC_KEYWORDS) as Array<[ResponseTopic, RegExp]>) {
      if (re.test(text)) responseTopics.push(topic);
    }
    const overlap = question.topics.filter(t => responseTopics.includes(t));
    if (question.topics.length > 0 && overlap.length === 0) {
      violations.push("topic-drift");
      evidence.push(`asked=[${question.topics.join(",")}] answered=[${responseTopics.join(",") || "none"}]`);
      hints.push(`The candidate asked about [${question.topics.join(", ")}]. Address that topic, do not pivot to a different topic.`);
    }
    if (question.isNumericQuestion && proseNumbers.length === 0) {
      violations.push("topic-drift");
      evidence.push("numeric-question with no number in response");
      hints.push(`The candidate asked a numeric question. Either give the kernel-provided number or defer explicitly ("I'll come back to you with the number"). Do not produce a vague non-answer.`);
    }
  }

  /* 5. Terminal-intent ignore (defense in depth). */
  const intent: TerminalIntent = detectTerminalIntent(candidateLastUtterance);
  if (intent && !/\b(?:understood|wrap|close|appreciate|withdraw|mark)\b/i.test(text)) {
    violations.push("terminal-intent-ignored");
    evidence.push(`intent=${intent}, response does not acknowledge close`);
    hints.push(`The candidate signalled "${intent}". Respond with a graceful close — acknowledge, do not continue selling.`);
  }

  /* 6. Unauthorized numbers. If the kernel's move specifies the
   * exact figures it wants delivered, prose numbers that aren't on
   * the whitelist are leaks (e.g. the LLM invented a "42 LPA"
   * ceiling that wasn't part of the move). Soft check — only fires
   * when move.newTotalLpa is the authoritative delivery. */
  const moveNumbers = collectMoveNumbers(input.move);
  if (moveNumbers.length > 0 && proseNumbers.length > 0) {
    const unauthorized = proseNumbers.filter(n => !moveNumbers.some(m => Math.abs(n - m) < 0.05) && !isMentionedInRecentLog(n, state));
    if (unauthorized.length > 0) {
      violations.push("unauthorized-number");
      evidence.push(`unauthorized=[${unauthorized.join(",")}], authorized=[${moveNumbers.join(",")}]`);
      hints.push(`Only mention numbers in the kernel-provided set: [${moveNumbers.join(", ")} LPA]. The numbers [${unauthorized.join(", ")}] were not authorised this turn.`);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    evidence,
    regenerateHint: hints.join(" "),
  };
}

function collectMoveNumbers(move: AiMove): number[] {
  const out: number[] = [];
  if (typeof move.newTotalLpa === "number") out.push(move.newTotalLpa);
  /* Future moves may carry additional whitelisted numbers (e.g.
   * joining-bonus, retention figure). Add fields as kernel evolves;
   * for now newTotalLpa is the only authoritative one. */
  return out;
}

function isMentionedInRecentLog(n: number, state: NegotiationState): boolean {
  /* A number that has been openly discussed earlier in the
   * conversation isn't a "new leak" — restating "your current
   * 24 LPA" is fine. Look back 6 entries. */
  const log = state.conversationLog?.slice(-6) ?? [];
  for (const entry of log) {
    const nums = extractNumbers(entry.text || "");
    if (nums.some(m => Math.abs(m - n) < 0.05)) return true;
  }
  /* Also: the highest offer made and any of the candidate's
   * disclosed numbers are conversation-public. */
  if (state.highestOfferMade != null && Math.abs(state.highestOfferMade - n) < 0.05) return true;
  if (state.candidateTarget != null && Math.abs(state.candidateTarget - n) < 0.05) return true;
  return false;
}

/* Helper for tests + callers: derive the topics that have already
 * been disclosed in the conversation so far. This is Layer 4 —
 * spoken-already memory — without requiring state migration. The
 * planner / restyle prompt can consume this to avoid re-explaining
 * topics. */
export function disclosedTopicsFromLog(state: NegotiationState): ResponseTopic[] {
  const log = state.conversationLog ?? [];
  const aiText = log.filter(e => e.speaker === "ai").map(e => e.text).join(" \n ");
  const out: ResponseTopic[] = [];
  for (const [topic, re] of Object.entries(TOPIC_KEYWORDS) as Array<[ResponseTopic, RegExp]>) {
    if (re.test(aiText)) out.push(topic);
  }
  return out;
}

/* Fallback prose used when a regenerated response fails the
 * contract a second time. Chosen to be neutral, brief, and forward-
 * moving so the session doesn't deadlock. The caller picks based on
 * the dominant violation. */
export function contractFallbackProse(violations: ContractViolation[]): string {
  if (violations.includes("terminal-intent-ignored")) {
    return "Understood — let's wrap here. Appreciate the conversation.";
  }
  if (violations.includes("walk-away-leak") || violations.includes("unauthorized-number")) {
    return "Let me confirm the exact figure on our side and come back to you before the offer letter.";
  }
  if (violations.includes("filler-non-answer") || violations.includes("topic-drift")) {
    return "Let me check on that specifically and share the concrete number with you in writing.";
  }
  return "Let me note that and come back to you with specifics.";
}
