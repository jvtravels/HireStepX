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
  | "unauthorized-number"
  /* Layer 4 enforcement (2026-05-27) — AI re-explained a topic that
   * was already covered earlier in the conversation. The candidate
   * has heard about medical/PF/joining-bonus already; restating it
   * without being asked reads as filler and burns turn budget.
   * Derived from disclosedTopicsFromLog(state) gated on "the
   * candidate did NOT ask about this topic again." */
  | "repeated-topic"
  /* Role-reversal (2026-05-27) — candidate asked a direct question
   * and the AI responded with another question instead of an answer.
   * Real recruiters answer the question or defer explicitly; they
   * don't bounce it back. */
  | "role-reversal"
  /* Premature close (PDF#49 — 2026-05-27) — the LLM emitted closing-
   * shape prose ("thanks for the conversation, we'll be in touch with
   * next steps") on a turn the planner did NOT route to a terminal
   * action. PDF#49 reproduction: candidate disclosed "my current ctc
   * is 50 LPA" on turn 0 (Senior Product Designer / Flipkart, band
   * 30-50 LPA). Planner correctly emitted `component-probe`, kernel
   * stayed in `opening`, but the LLM jumped to the script's pre-
   * canned closing line as if the negotiation were over. This
   * violation is the post-LLM safety net: closing prose without a
   * planner-emitted terminal action is structurally invalid. */
  | "premature-close";

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
  /\b(?:market\s+mode|fitment\s+band|stretch\s+band|max[- ]?stretch|walk[- ]?away|anchor(?:ing)?\s+(?:point|number)|cumulative\s+urgency|move\s+tag|lever\s+(?:strict|soft|hold)|kernel|hardBandCap|hard[- ]?band[- ]?cap|finalOfferAsserted|verbalAcceptance|infoAsked|vossTactics|(?:opening|discovery|range[- ]?disclosure|probe[- ]?expectations|counter[- ]?offer|lever[- ]?explore|closing[- ]?push|walked[- ]?away|stalemate|accepted)\s+phase|phase\s+(?:opening|discovery|range[- ]?disclosure|probe[- ]?expectations|counter[- ]?offer|lever[- ]?explore|closing[- ]?push)|discovery\s+(?:stage|checklist)|reactive\s+followup|component[- ]?probe|trial[- ]?close|range[- ]disclosure|probe[- ]expectations|lever[- ]explore|closing[- ]push)\b/i;

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

/* Closing-shape detector (PDF#49 — 2026-05-27). Phrases that are
 * structurally a "wrapping the conversation" line: thank-you-for-time
 * pairings, next-steps stamps, get-back-to-you stamps. We match the
 * SHAPE — not literal exact-match — so paraphrases of the canned
 * "Thanks for the conversation today. We'll be in touch with next
 * steps." also trip. The check is gated on planner-non-terminal +
 * no-terminal-intent so legitimate close turns are unaffected. */
const CLOSING_SHAPE_RE = new RegExp(
  [
    String.raw`\bwe.?ll\s+be\s+in\s+touch\b`,
    String.raw`\b(?:we.?ll|i.?ll)\s+(?:get\s+back|come\s+back|circle\s+back|reach\s+out)\s+to\s+you\s+(?:soon|shortly|with|on|about)?(?:\s+next\s+steps)?\b`,
    String.raw`\bnext\s+steps\s+(?:soon|shortly|will\s+follow|will\s+be\s+shared|to\s+follow)\b`,
    String.raw`\b(?:with|about|on|regarding)\s+(?:the\s+)?next\s+steps\b`,
    String.raw`\bthanks?\s+for\s+(?:the\s+)?(?:conversation|chat|call|discussion)\s+today\b`,
    String.raw`\bthank\s+you\s+for\s+(?:the\s+)?(?:conversation|chat|call|discussion)\s+today\b`,
    String.raw`\bthat.?s\s+all\s+(?:from|i\s+had)\s+(?:my\s+side|for\s+(?:today|now))\b`,
    String.raw`\bwe.?ll\s+wrap\s+(?:up\s+)?here\b`,
    String.raw`\bappreciate\s+(?:you\s+)?taking\s+the\s+time\s+today\b`,
  ].join("|"),
  "i",
);

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

/* Topic-scoring (2026-05-27 — false-positive reduction).
 *
 * The original drift check matched topics with a single keyword hit,
 * which produced false-positives in production: a CTC-breakdown
 * answer that incidentally mentioned "medical" once would classify
 * as medical-topic and trip the drift detector against a base-pay
 * question. The fix: count keyword hits per topic and only consider
 * topics with score ≥1, then for drift comparison weight by score.
 *
 * Concretely: an answer scoring base=4 medical=1 will not drift-flag
 * against a base question, even though "medical" appears, because
 * the dominant topic clearly matches what was asked. */
function topicScores(text: string): Map<ResponseTopic, number> {
  const out = new Map<ResponseTopic, number>();
  const lower = (text || "").toLowerCase();
  for (const [topic, re] of Object.entries(TOPIC_KEYWORDS) as Array<[ResponseTopic, RegExp]>) {
    /* Reconstruct with /g so we can count, not just test. The source
     * regexes are defined with /i — preserve case-insensitivity. */
    const globalRe = new RegExp(re.source, "gi");
    const matches = lower.match(globalRe);
    if (matches && matches.length > 0) out.set(topic, matches.length);
  }
  return out;
}

/* Question-shape detectors for the candidate's last utterance.
 * Catches "what is the base?" / "can you give the breakdown" /
 * "is 32 in budget?" — patterns where the candidate asked a
 * specific question and the response is expected to address it. */
function classifyCandidateQuestion(text: string): {
  isNumericQuestion: boolean;
  isDirectQuestion: boolean;
  topics: ResponseTopic[];
} {
  const isNumericQuestion =
    /\b(?:how\s+much|what(?:'s| is)\s+(?:the\s+)?(?:base|total|ctc|budget|breakdown|number|figure|amount)|give\s+me\s+(?:the\s+)?(?:number|figure|breakdown)|provide\s+(?:the\s+)?(?:clear\s+)?(?:number|breakdown)|can\s+you\s+(?:share|provide|give|tell\s+me)\s+(?:the\s+)?(?:number|figure|breakdown|amount))\b/i.test(text || "")
    || /\b(?:in\s+your\s+budget|is\s+\d+\s+(?:lpa|lakhs?)\s+in\s+(?:your\s+)?budget)\b/i.test(text || "");
  /* Direct-question detector — used by the role-reversal check.
   * Fires on (a) a trailing "?", (b) standard interrogatives at
   * sentence start, or (c) "can/could you / do you have" frames. */
  const t = (text || "").trim();
  const isDirectQuestion =
    /\?\s*$/.test(t)
    || /^(?:what|how|when|where|why|which|who|is|are|do|does|did|can|could|would|will|should)\b/i.test(t)
    || /\b(?:can\s+you|could\s+you|do\s+you\s+have|is\s+there|are\s+there)\b/i.test(t);
  /* PDF#50 fix (2026-05-27) — topics are only meaningful for the
   * drift / role-reversal checks when the candidate ACTUALLY asked
   * something. The prior version returned every topic-keyword that
   * appeared in the text, which meant a plain disclosure ("Base is
   * 36 LPA") got read as "candidate asked about base" and any AI
   * response that moved to a different topic (e.g. probing variable
   * next) tripped topic-drift → filler-fallback. The fix: gate
   * topics on question-shape. Statement utterances return [];
   * questions return their topic keywords as before. */
  const topics: ResponseTopic[] =
    isDirectQuestion || isNumericQuestion ? Array.from(topicScores(text).keys()) : [];
  return { isNumericQuestion, isDirectQuestion, topics };
}

/* Dominant topic by score (helper for repeated-topic + drift checks).
 * Returns null when no topic crosses the threshold. */
function dominantTopic(scores: Map<ResponseTopic, number>, minScore = 1): ResponseTopic | null {
  let best: ResponseTopic | null = null;
  let bestScore = minScore - 1;
  for (const [topic, score] of scores) {
    if (score > bestScore) {
      best = topic;
      bestScore = score;
    }
  }
  return best;
}

/* Role-reversal detector — the response is a question (or a string of
 * them) with no concrete deliverable. We define "no concrete
 * deliverable" as: no LPA number AND no graceful-close / deferral
 * acknowledgement. A trailing ask is fine if the response ALSO
 * answered the question first. */
function isResponseAllQuestion(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  /* Strip the question marks and see if anything declarative
   * remains. If the response is mostly questions with no statements,
   * each "sentence" ends in "?" or "?." */
  const sentences = t.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  if (sentences.length === 0) return false;
  const questionSentences = sentences.filter(s => /\?\s*$/.test(s.trim()));
  /* Role-reversal if ≥half the response is questions AND ≥1 question
   * exists AND the whole response has no LPA number. */
  if (questionSentences.length === 0) return false;
  if (questionSentences.length * 2 < sentences.length) return false;
  const hasNumber = /\d+(?:\.\d+)?\s*(?:lpa|lakhs?|l\b|cr)/i.test(t);
  if (hasNumber) return false;
  /* Allow if the response acknowledges + defers explicitly — that's
   * not a bounce-back, that's a clean deferral. */
  if (/\b(?:come\s+back|circle\s+back|let\s+me\s+confirm|share\s+(?:with\s+you\s+)?in\s+writing|in\s+the\s+offer\s+letter)\b/i.test(t)) return false;
  return true;
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

  /* 4. Topic drift — score-based (2026-05-27 false-positive reduction).
   *
   * Drift fires when ALL of these hold:
   *   (a) candidate asked about identifiable topics
   *   (b) response has zero hits on any asked topic
   *   (c) response has a clear dominant topic OF ITS OWN with score≥2
   *
   * (c) is the key safety valve — without it, a generic acknowledgement
   * ("noted, will follow up") that has zero topic keywords trips
   * drift even though it's a valid deferral. With (c), drift only
   * fires when the response is actively about something ELSE. */
  const question = classifyCandidateQuestion(candidateLastUtterance);
  const responseScores = topicScores(text);
  if (question.topics.length > 0 || question.isNumericQuestion) {
    const overlap = question.topics.filter(t => responseScores.has(t));
    const responseDominant = dominantTopic(responseScores, 2);
    if (
      question.topics.length > 0
      && overlap.length === 0
      && responseDominant !== null
      && !question.topics.includes(responseDominant)
    ) {
      violations.push("topic-drift");
      evidence.push(`asked=[${question.topics.join(",")}] dominant-answered=${responseDominant}`);
      hints.push(`The candidate asked about [${question.topics.join(", ")}]. Address that topic, do not pivot to ${responseDominant}.`);
    }
    if (question.isNumericQuestion && proseNumbers.length === 0) {
      violations.push("topic-drift");
      evidence.push("numeric-question with no number in response");
      hints.push(`The candidate asked a numeric question. Either give the kernel-provided number or defer explicitly ("I'll come back to you with the number"). Do not produce a vague non-answer.`);
    }
  }

  /* 4b. Repeated-topic (Layer 4 enforcement, 2026-05-27).
   *
   * The AI re-explained a topic that was already covered in an earlier
   * AI turn AND the candidate didn't ask about it again. Layer 4
   * memory (disclosedTopicsFromLog) gives us the "already-said" set;
   * we gate on "candidate didn't ask" so re-confirmation when
   * specifically asked is still allowed.
   *
   * Only fires for topics where re-explanation has a real signature
   * (≥3 keyword hits in the response — a single mention is fine).
   * This keeps the check from blocking natural language flow where
   * a previously-covered topic surfaces as a brief reference. */
  const disclosed = new Set(disclosedTopicsFromLog(state));
  for (const [topic, score] of responseScores) {
    if (
      score >= 3
      && disclosed.has(topic)
      && !question.topics.includes(topic)
    ) {
      violations.push("repeated-topic");
      evidence.push(`repeated=${topic} (score=${score}, candidate-did-not-ask)`);
      hints.push(`The topic "${topic}" was already covered in an earlier turn and the candidate did not ask again. Move to a new topic instead of re-explaining.`);
      break;
    }
  }

  /* 4c. Role-reversal (2026-05-27).
   *
   * Candidate asked a direct question; AI responded with another
   * question (no answer, no concrete deliverable, no deferral
   * acknowledgement). Fires only when BOTH sides of the reversal hold
   * — a question from candidate AND a question-only response from AI.
   * Allow legitimate "I want to make sure I understand — were you
   * asking about X or Y?" clarifications by gating on no-number AND
   * no-deferral simultaneously inside isResponseAllQuestion. */
  if (question.isDirectQuestion && isResponseAllQuestion(text)) {
    violations.push("role-reversal");
    evidence.push("candidate asked, AI returned a question without answering");
    hints.push(`The candidate asked a direct question. Answer it with the kernel-provided number/topic, or defer explicitly ("I'll come back to you with that"). Do not respond with another question.`);
  }

  /* 4d. Premature close (PDF#49 — 2026-05-27).
   *
   * Closing-shape prose ("thanks for the conversation today",
   * "we'll be in touch with next steps", "appreciate your time —
   * we'll get back to you") is only legal when the planner routed
   * to a terminal action. Otherwise the LLM jumped the script —
   * exact PDF#49 shape: candidate disclosed current CTC on turn 0,
   * LLM shipped the script's pre-canned closing line as if the
   * negotiation were over.
   *
   * Gates (ALL must hold to fire):
   *   (a) response matches CLOSING_SHAPE_RE
   *   (b) planner action.kind is non-terminal
   *   (c) candidate's last utterance did NOT signal terminal intent
   *       (terminal-intent path already catches that — don't double-
   *       fire)
   *   (d) state.phase is non-terminal (kernel didn't itself decide
   *       to close via the walked-away/stalemate/accepted machinery)
   */
  const plannedKindRaw = (state as NegotiationState & {
    plannedNextAction?: { kind?: string } | null;
  }).plannedNextAction;
  const plannedKind: string | null =
    plannedKindRaw && typeof plannedKindRaw === "object" && "kind" in plannedKindRaw
      ? String((plannedKindRaw as { kind?: unknown }).kind ?? "")
      : null;
  const TERMINAL_ACTION_KINDS = new Set<string>([
    "close",
    "terminal-restate",
    "polite-walkaway",
    "live-walk-away",
    "close-recap-formal",
    "auto-accept",
    "post-acceptance-document-request",
  ]);
  const TERMINAL_PHASES = new Set<string>(["accepted", "walked-away", "stalemate"]);
  if (
    CLOSING_SHAPE_RE.test(text)
    && (plannedKind == null || !TERMINAL_ACTION_KINDS.has(plannedKind))
    && detectTerminalIntent(candidateLastUtterance) == null
    && !TERMINAL_PHASES.has(String(state.phase ?? ""))
  ) {
    violations.push("premature-close");
    evidence.push(`closing-shape prose with planner action=${plannedKind ?? "?"}, phase=${state.phase}`);
    hints.push(`Do NOT emit a closing line. The planner routed to "${plannedKind ?? "(unknown)"}" — keep the negotiation moving. Closing prose ("thanks for the conversation", "we'll be in touch", "next steps") is only legal when the candidate has accepted, walked away, or asked to end the call.`);
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
  /* Role-reversal needs a forward-motion answer, not just a deferral.
   * The original response was a bounce-back; the fallback at least
   * commits to producing a real answer next. */
  if (violations.includes("role-reversal")) {
    return "Fair question — let me confirm the specific number with the team and share it back with you in writing.";
  }
  /* Repeated-topic: the AI was re-explaining something already covered.
   * The fallback acknowledges the prior coverage and moves the
   * conversation forward instead of restating. */
  if (violations.includes("repeated-topic")) {
    return "I think we've covered that earlier — happy to revisit any specifics in writing. Is there anything else you'd like me to confirm?";
  }
  /* Premature close — the LLM tried to wrap the conversation while
   * the planner is still mid-negotiation. The fallback steers BACK
   * into the conversation with an open-ended invitation, so the next
   * turn picks up the negotiation instead of stalling on a goodbye. */
  if (violations.includes("premature-close")) {
    return "Got it — noted. What else would you like to walk through on the offer?";
  }
  if (violations.includes("filler-non-answer") || violations.includes("topic-drift")) {
    return "Let me check on that specifically and share the concrete number with you in writing.";
  }
  return "Let me note that and come back to you with specifics.";
}
