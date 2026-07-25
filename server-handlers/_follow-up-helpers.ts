/**
 * Pure logic extracted from server-handlers/follow-up.ts so the intent
 * detection + salary-number extraction can be unit-tested without
 * spinning up the 697-line handler + LLM mock.
 *
 * These functions run against the raw candidate answer before prompt
 * assembly. A bug here means the salary-negotiation interviewer shows
 * the wrong intent banner ("candidate accepted" when they rejected),
 * which causes catastrophic prompt-level misbehaviour.
 */

import { isWalkAway } from "./_walkaway-detection";

export interface CandidateIntent {
  accepted: boolean;
  /** Accepted with a condition/question attached ("I accept but what about equity?") */
  conditionalAccept: boolean;
  rejected: boolean;
  /** Explicitly signalling they're walking away */
  walkAway: boolean;
  /** Deflecting to avoid revealing their number */
  deflected: boolean;
  /** Asking for time / needs to think */
  needsTime: boolean;
  /** Mentioned competing offers */
  mentionedCompeting: boolean;
}

/* S83-B1 (2026-07-26) — `agreed` fired on past-tense references: "As agreed, I
 * expect..." / "We agreed that the base would be 40L" — these are references to
 * prior agreements, not new acceptances. Replaced bare `agreed` with a
 * lookbehind-guarded form that suppresses "as/we/i/they/you/had/have agreed"
 * while preserving bare-affirmative forms ("Agreed!", "Agreed, but I'd like...").
 * S83-B2 (2026-07-26) — `i agree` fired on "I agree [the variable is tricky], but
 * I need more fixed" — agreeing with a point, NOT accepting the offer. Added
 * negative lookahead to suppress "I agree [the/that/this/it/your/with X]".
 * S84 (2026-07-26) — common acceptance phrases missing from acceptWords: i'll take it,
 * that's acceptable, count me in, consider it done, i'm happy to proceed, i'm on board.
 * All added. */
const acceptWords = /\b(i accept|i.?ll accept|accept the offer|sounds good|that works for me|it.?s a deal|i.?m happy with|fine with me|i agree(?!\s+(?:the|that|this|it|your|with)\b)|(?<!as\s)(?<!we\s)(?<!i\s)(?<!they\s)(?<!you\s)(?<!had\s)(?<!have\s)agreed(?!\s+(?:on|that|earlier|previously|upon|by|already))|let.?s go ahead|i(?:.ll|.d|\s+will|\s+would)\s+take\s+it|(?:that|this).?s?\s+(?:is\s+)?acceptable(?:\s+to\s+me)?|count\s+me\s+in|consider\s+it\s+done|(?:i.?m|i\s+am)\s+happy\s+to\s+proceed|(?:i.?m|i\s+am)\s+on\s+board)\b/i;
/* Rejection signals — covers explicit rejection AND number-locking
   ("stick with 26 lakhs", "holding at 30 LPA", "won't go below"). The
   user-reported bug where "No, I would like to stick with 26 lakhs"
   wasn't classified as rejection traced back to this regex missing the
   "stick/hold/stay at <number>" family. The lookahead for an LPA-style
   number after the lock verb prevents false positives like "I'll stick
   with the team I have." */
/* S77-B3 (2026-07-25) — same component-noun lookahead applied here; bare
 * "not interested in the variable/equity/bonus" must not set rejected:true */
/* S83-B3 (2026-07-26) — `don't work` added alongside `won't work` so "the numbers
 * don't work for me" triggers hedgeIsRejection when it appears in the post-hedge
 * segment of "sounds good in theory, but the numbers don't work for me" — previously
 * only `won.?t work` was listed and "don't work" fell through to accepted=true. */
/* S84 (2026-07-26) — `need more/higher [comp-noun]` added to catch post-hedge rejections
 * like "I'm on board but need more fixed" / "happy to proceed but need higher comp".
 * Restricted to salary-component nouns to avoid false positives on "need more time/info".
 * S86-B1 (2026-07-26) — `expecting\s+at\s+least` didn't match "I expect at least 45L"
 *   (no -ing suffix). Broadened to `expect(?:ing)?\s+at\s+least`.
 * S86-B2 (2026-07-26) — "That does not work for me" not classified as rejection.
 *   Added `does\s+not\s+work` alongside existing `don.?t work`. */
const rejectWords = /\b(not acceptable|too low|can.?t accept|absolutely not|not enough|walk away|not interested(?!\s+in\s+(?:(?:a|the|an?|this|that|your|our|their|my)\s+)?(?:\w+\s+)?(?:variable|fixed|equity|stock|rsu|esop|bonus|perks?|benefits?|structure|arrangement|split|breakdown|ratio|format|scheme|component|option|allocation|composition|mix)\b)|i reject|no deal|way too low|that.?s insulting|stick(?:ing)?\s+with(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|hold(?:ing)?\s+(?:at|firm)(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|stay(?:ing)?\s+at(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|firm\s+at(?=[^.]*\b(?:lakh|lpa|crore|cr\b|\d))|won.?t\s+(?:go\s+)?(?:below|under|lower)|don.?t work|does\s+not\s+work|need(?:s)?\s+at\s+least|expect(?:ing)?\s+at\s+least\s*\d|^no\b[^.]*\b(?:lakh|lpa|crore|cr\b)|need\s+(?:more|higher|additional|extra|better)\s+(?:fixed|base|variable|equity|ctc|salary|comp(?:ensation)?|package|money|cash))/i;
/* S84 (2026-07-26) — `if` added to hedgeWords so "I'll take it if X" / "Count me in if X"
 * are correctly marked conditionalAccept=true instead of full accepted=true. */
const hedgeWords = /\b(but|however|only if|unless|provided|on condition|contingent|except|though|if)\b/i;
const deflectWords = /\b(you first|your offer|what.*you.*offer|tell me.*first|don.?t want to share|prefer not|rather not|you tell me)\b/i;
const thinkWords = /\b(need time|think about|sleep on|let me think|consider|talk to.*(?:family|partner|wife|husband)|get back to you|not ready)\b/i;
const competingWords = /\b(other offer|competing|another company|counter.?offer|multiple offers|also talking|interviewing at|got an offer)\b/i;
/* S78-B1 (2026-07-25) — bare `move on` fired on "Let's move on to equity"
 * (topic-redirect). First-person departure frame required, mirroring WALKAWAY_PATTERN. */
/* S78-B2 (2026-07-25) — `i.?m out` fired on "I'm out of ideas/options/moves"
 * (candidate still negotiating). Added `(?!\s+of\b)` to suppress the "out of X" form. */
/* S80-B1 (2026-07-26) — `i.?ll pass` and `have to pass` fired on hand-off phrases:
 * "I'll pass your proposal to my partner" / "I have to pass this to my manager".
 * Added along/to-recipient guard matching WALKAWAY_PATTERN (widened window to 25 chars).
 * S80-B3 (2026-07-26) — `no chance` fired on hardball anchor "No chance I'm settling
 * for less than 45L" — candidate asserting a floor, NOT walking. Added first-person
 * floor-verb guard: suppresses when followed by go-below/settle/accept-less/etc.
 * S81-B1 (2026-07-26) — `not worth` fired on "not worth fighting over 2L — can we split
 * it?" (counter-proposal, not walk). Added dispute-gerund guard.
 * S81-B2 (2026-07-26) — `i decline` fired on "I decline to answer that" (refusing to
 * reveal salary info, NOT walking). Added `to [reveal/answer/disclose/share/...]` guard. */
/* S85 (2026-07-26) — synced guards from canonical WALKAWAY_PATTERN:
 * no deal -> no deal(?!\s+on\s+the\s+table); withdraw exclusion + complaint/concern/etc;
 * isn.?t -> is(?:n.?t|\s+not); departure frame adds bare `am` for "I am moving on" */
const walkAwayWords = /\b(walk away|walking away|i.?m out(?!\s+of\b)|not interested(?!\s+in\s+(?:(?:a|the|an?|this|that|your|our|their|my)\s+)?(?:\w+\s+)?(?:variable|fixed|equity|stock|rsu|esop|bonus|perks?|benefits?|structure|arrangement|split|breakdown|ratio|format|scheme|component|option|allocation|composition|mix)\b)|no chance(?!\s+(?:I(?:'m|\s+am|\s+will|\s+would|\s+'ll|\s+'d|'ll|'d)\s+(?:\w+\s+){0,2}(?:go(?:ing)?\s+(?:below|under)|settl(?:e|ing)(?:\s+for\s+less)?|accept(?:ing)?\s+less|tak(?:e|ing)\s+less|drop(?:ping)?\s+(?:below|under)|lower(?:ing)?|com(?:e|ing)\s+down|reduc(?:e|ing)|budg(?:e|ing))))|i.?ll pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b))|no deal(?!\s+on\s+the\s+table)|withdraw(?!\s+(?:my|your|the|this)\s+(?:counter|demand|ask|offer|request|proposal|requirement|expectation|complaint|concern|feedback|objection|comment|remark|statement|amendment)\b)|decline the offer|i decline(?!\s+to\s+(?:answer|reveal|disclose|share|tell|say|mention|discuss|comment|confirm|provide|give)\b)|pull out(?!\s+(?:all\b|my\b|your\b|our\b|their\b|his\b|her\b|its\b|some\b|any\b))|not worth(?!\s+(?:fight|argu|bicker|quarrel|quibbl|debat|nit.?pick|hassle))|won.?t work|is(?:n.?t|\s+not)\s+going\s+to\s+work|(?:i(?:.m|.ll|.d)|i\s+(?:will|would\s+rather|think\s+i.ll|have\s+to|need\s+to|am\s+going\s+to|am))\s+(?:just\s+|then\s+|probably\s+|simply\s+|now\s+|rather\s+)?move\s+on|take the other|thanks but no|not for me|have to pass(?![^.!?]{0,25}?\b(?:along\b|to\s+(?:my|your|our|their|his|her|the|a|an)\b)))\b/i;
const shortAffirmativeStart = /^(yes|yeah|okay|ok|sure|deal|agreed|accept|sounds good|that works|fine)\b/i;

/** Classify the candidate's answer in a salary negotiation. */
export function detectCandidateIntent(answer: string): CandidateIntent {
  const trimmed = (answer || "").trim();
  if (!trimmed) {
    return { accepted: false, conditionalAccept: false, rejected: false, walkAway: false, deflected: false, needsTime: false, mentionedCompeting: false };
  }

  const isShortAffirmative = trimmed.split(/\s+/).length < 8
    && shortAffirmativeStart.test(trimmed)
    && !hedgeWords.test(trimmed);

  const acceptIdx = trimmed.search(acceptWords);
  const hedgeIdx = trimmed.search(hedgeWords);
  const hasAccept = acceptIdx >= 0;
  const hasHedgeAfterAccept = hasAccept && hedgeIdx > acceptIdx;
  const postHedgeText = hasHedgeAfterAccept ? trimmed.slice(hedgeIdx) : "";
  const hedgeIsRejection = rejectWords.test(postHedgeText);

  const accepted = (hasAccept || isShortAffirmative) && !hedgeIsRejection;
  const conditionalAccept = accepted && hasHedgeAfterAccept && !hedgeIsRejection;
  const rejected = rejectWords.test(trimmed) && !accepted;
  const deflected = deflectWords.test(trimmed);
  const walkAway = walkAwayWords.test(trimmed) && !acceptWords.test(trimmed);

  const candidateNum = extractCandidateSalaryNumber(trimmed);
  // "consider" co-occurring with a number is a counter, not a time request
  const needsTime = thinkWords.test(trimmed) && candidateNum === null;
  const mentionedCompeting = competingWords.test(trimmed);

  return { accepted, conditionalAccept, rejected, walkAway, deflected, needsTime, mentionedCompeting };
}

/**
 * Extract the candidate's target salary number from free-text.
 *
 * Strategy:
 *   1. Find all numbers with LPA/lakh/lakhs/l suffix.
 *   2. If the target-phrase regex matches a number from that list, prefer it.
 *   3. Otherwise, if current-CTC regex matches the first number, use the last
 *      number as the target (e.g. "currently at 20, expecting 30" → 30).
 *   4. Otherwise fall back to the last number in the list.
 *   5. If no LPA-suffixed number found, look for bare numbers prefixed with
 *      ask-intent words, bounded to the salary-plausible range [3, 200].
 *
 * Returns null when no number is found.
 */
export function extractCandidateSalaryNumber(answer: string): string | null {
  if (!answer) return null;

  // Tolerant of common Indian-English STT mishears for "lakhs":
  //   "legs"  — Deepgram occasionally renders this when the speaker
  //             stresses the "h" → "leghs"
  //   "lacks" — common substitution for "lakhs"
  //   "lac"   — singular form (sometimes transcribed as "lakh")
  //   "lax"   — short STT form
  // The user-reported session had "20 legs per annum" — without this
  // tolerance the regex missed the number entirely and the
  // candidateTarget never got set, breaking downstream clamps.
  const salaryNumRe = /₹?\s*(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|lacs?|legs|lax|l\b)/gi;
  const currentCtcRe = /(?:currently|current(?:ly)?|earning|getting|drawing|my ctc|i'm at|making|take home|i get|i earn)\s.*?(\d+(?:\.\d+)?)/i;
  const targetRe = /(?:expecting|looking for|want|need|asking|target|hoping|would like|i'd like|i want|i need|looking at|aiming)\s.*?(\d+(?:\.\d+)?)/i;
  // Competing / in-hand offer — these are the candidate's BATNA, not
  // their target. Pulling them as the "target" causes the AI to
  // counter BELOW the candidate's actual ask. Captured separately so
  // the latest target-prefixed number wins even if a competing-offer
  // figure appears later in the same utterance.
  const competingRe = /(?:offer\s+of|in[-\s]?hand(?:\s+offer)?\s+(?:of|at)?|already\s+have|received|competing\s+offer\s+(?:of|at)?|got\s+an\s+offer\s+(?:of|at)?|another\s+offer\s+(?:of|at)?)\s*₹?\s*(\d+(?:\.\d+)?)/gi;
  const competingNums = new Set<string>();
  let cm: RegExpExecArray | null;
  while ((cm = competingRe.exec(answer)) !== null) competingNums.add(cm[1]);

  const allNums: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = salaryNumRe.exec(answer)) !== null) allNums.push(m[1]);

  // Bare-number fallback when no LPA suffix was found
  if (allNums.length === 0) {
    const bareNumMatch = answer.match(/(?:expecting|want|need|asking|target|hoping|looking for|around|about|at least|minimum)\s+(?:₹?\s*)?(\d+(?:\.\d+)?)\b/i);
    if (bareNumMatch) {
      const v = parseFloat(bareNumMatch[1]);
      if (v >= 3 && v <= 200) allNums.push(bareNumMatch[1]);
    }
  }

  // Strip competing-offer numbers from candidate-target consideration.
  // These get captured by the caller's competingOfferAmount field.
  const targetCandidates = allNums.filter(n => !competingNums.has(n));
  if (targetCandidates.length === 0 && allNums.length === 0) return null;
  // If every number was a competing-offer number, fall back to the last
  // one (preserves prior behaviour for single-number utterances).
  const pool = targetCandidates.length > 0 ? targetCandidates : allNums;

  // Strongest signal: ALL target-prefixed numbers (latest wins).
  // The previous regex took the FIRST target-prefix match, so
  // "I want 20, actually let me say I'd like 25" returned 20.
  // Iterate to find the LAST target-prefix match that appears in pool.
  const allTargetRe = /(?:expecting|looking for|want|need|asking|target|hoping|would like|i'd like|i want|i need|looking at|aiming)\s.*?(\d+(?:\.\d+)?)/gi;
  const targetMatches: string[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = allTargetRe.exec(answer)) !== null) {
    if (pool.includes(tm[1]) && !competingNums.has(tm[1])) targetMatches.push(tm[1]);
  }
  if (targetMatches.length > 0) return targetMatches[targetMatches.length - 1];

  // Single-shot fallback to legacy behaviour for backward compat.
  const targetMatch = targetRe.exec(answer);
  if (targetMatch && pool.includes(targetMatch[1])) return targetMatch[1];

  const currentMatch = currentCtcRe.exec(answer);
  if (currentMatch && pool.length > 1 && pool[0] === currentMatch[1]) {
    return pool[pool.length - 1];
  }

  return pool[pool.length - 1];
}

/**
 * Truncate conversation history to a character budget, preserving the most
 * recent exchanges. Mirrors the historyCharLimit used in follow-up.ts
 * around line 159.
 */
export function truncateConversationHistory(history: string, budget: number): string {
  if (!history) return "";
  if (history.length <= budget) return history;
  // Keep the tail (most recent turns), prefix with marker.
  return `…[earlier turns truncated]\n${history.slice(-Math.max(budget - 40, 100))}`;
}

export interface PhaseFacts {
  acceptedImmediately?: boolean;
  candidateCounter?: string | null;
  hasCompetingOffers?: boolean;
  topicsRaised?: string[];
}

export interface DetectSalaryPhaseInput {
  /** Explicit phase override from client. Wins unconditionally. */
  negotiationPhase?: string;
  /** 0-indexed question number within the negotiation. */
  questionIndex?: number;
  /** Total questions in this negotiation session. */
  totalQuestions?: number;
  /** Extracted negotiation facts. */
  facts?: PhaseFacts | null;
  /** The candidate's most recent answer (for walk-away detection). */
  answer?: string;
}

export type SalaryPhase =
  | "offer-reaction"
  | "probe-expectations"
  | "counter-offer"
  | "benefits-discussion"
  | "closing-pressure"
  | "closing";

/**
 * Determine the negotiation conversation phase from session state.
 *
 * Closing phases require either explicit acceptance OR a stated counter.
 * Without one, late turns route to probe-expectations / counter-offer
 * instead — the negotiation cannot end before a number is on the table.
 */
export function detectSalaryPhase(input: DetectSalaryPhaseInput): SalaryPhase {
  const { negotiationPhase, questionIndex, facts, answer } = input;
  if (negotiationPhase) return negotiationPhase as SalaryPhase;

  /* State-first derivation. Phase follows candidate signal — NOT
     turn-index. This is the architectural fix the audit called out:
     a candidate who counters on turn 1 should route to counter-offer
     immediately, not be marched through probe-expectations because
     the pre-baked arc says so. Turn-index is consulted only for the
     cold-start ramp when zero state signals are available. */

  // 1. Acceptance — closing wins everything.
  if (facts?.acceptedImmediately) return "closing";

  // 2. Walk-away language — switch to closing-pressure (retention).
  if (isWalkAway(answer)) return "closing-pressure";

  // 3. A number is on the table — counter-offer regardless of turn.
  //    Previously gated on idx>=2, which marched-through-probe even
  //    when the candidate had already given a counter on turn 1.
  if (facts?.candidateCounter) return "counter-offer";

  // 4. Competing offers but no concrete counter — keep probing.
  if (facts?.hasCompetingOffers) return "probe-expectations";

  // 5. Multiple non-cash topics raised — benefits territory.
  if (facts?.topicsRaised && facts.topicsRaised.length >= 2) return "benefits-discussion";

  /* No state signals fired. Use turn-index as a cold-start ramp ONLY.
     We never fabricate counter-offer / closing-pressure from index
     alone — those require candidate state. The deepest the cold ramp
     goes is probe-expectations, which is always safe (the AI asks for
     a target; the candidate's answer then provides the signal that
     moves us into a real phase). */
  const idx = questionIndex ?? 0;
  if (idx <= 1) return "offer-reaction";
  return "probe-expectations";
}

export interface PickCounterInput {
  phase: SalaryPhase | string;
  initialOffer: number;
  maxStretch: number;
  walkAway: number;
  /** Highest ₹ already presented this session, if any. */
  highestOfferMade?: number | null;
  /** Candidate's stated target, if any. */
  candidateTarget?: number | null;
}

/**
 * Server-side recommended counter number for the AI's next turn.
 *
 * Removes the LLM's hand from picking ₹ values — it still writes prose
 * around the number but the figure itself is computed deterministically
 * from the band + session state. The post-LLM clamp guards stay in
 * place as a safety net; this just stops the hallucinations at the
 * source instead of reactively repairing them.
 *
 * Returns null when the phase shouldn't introduce a new number
 * (offer-reaction reuses the initial; probe-expectations is asking,
 * not offering; benefits / closing maintain the last counter).
 */
export function pickServerCounter(input: PickCounterInput): number | null {
  const { phase, initialOffer, maxStretch, highestOfferMade, candidateTarget } = input;

  const floor = Math.max(highestOfferMade ?? 0, initialOffer);
  const ceiling = maxStretch;

  // Cap aspiration at the band's ceiling. If the candidate's target is
  // above maxStretch, the AI shouldn't reach for it — it should flag.
  const aspiration = Math.min(candidateTarget ?? ceiling, ceiling);

  // If aspiration is already at or below floor, there's nowhere to move.
  if (aspiration <= floor) return null;

  let next: number | null = null;

  switch (phase) {
    case "offer-reaction":
      // First turn — present the initial offer. Caller usually has this
      // already from initialOfferText; we only return it for completeness.
      next = initialOffer;
      break;

    case "probe-expectations":
    case "benefits-discussion":
      // No new number this turn — these phases ask / discuss, they
      // don't offer.
      return null;

    case "counter-offer":
      // Split the difference between current floor and aspiration.
      next = floor + (aspiration - floor) * 0.5;
      break;

    case "closing-pressure":
      // Push 70% of the way toward aspiration — visible movement to
      // close the deal.
      next = floor + (aspiration - floor) * 0.7;
      break;

    case "closing":
      // Maintain the highest offer made; closing is the recap, not a
      // new bump.
      return null;

    default:
      return null;
  }

  if (next === null || !Number.isFinite(next)) return null;
  // Clamp to band, floor at monotonic, round to 0.1.
  next = Math.max(floor, Math.min(ceiling, next));
  return Math.round(next * 10) / 10;
}

/* ────────────────────────────────────────────────────────────────
 * Typed move picker — pickNextMove
 * ────────────────────────────────────────────────────────────────
 * Until now the LLM decided which lever to pull on each turn (base
 * bump, joining bonus, equity grant, hold firm). That decision drifted
 * under pressure: ESOPs offered on non-equity bands, generic "learning
 * budget" pulled on a designer when conference budget would land
 * harder, the same lever repeated three turns in a row.
 *
 * pickNextMove makes the lever choice a pure server function. The LLM
 * still writes the prose; it no longer chooses the structural move.
 * Lever rotation prevents re-offering the same non-cash item; cash
 * headroom is consumed first via pickServerCounter, then non-cash
 * levers in a deterministic order. Hold-firm is the explicit exit
 * when everything is exhausted — replaces the duplicate-reply rescue
 * path that was papering over "no moves left".
 */

export type NegotiationLever =
  | "open-with-offer"
  | "probe"
  | "counter-base"
  | "joining-bonus"
  | "equity-grant"
  | "notice-buyout"
  | "benefits-summary"
  | "hold-firm"
  | "close-acceptance";

export interface NextMove {
  lever: NegotiationLever;
  /** New headline total CTC the AI should propose this turn, or null
   *  when no money moves (probe / benefits / non-cash levers). */
  newTotalLpa: number | null;
  /** Increment over the highest previous offer. 0 for non-monetary
   *  levers and for open-with-offer (the initial offer isn't an
   *  increment). */
  deltaLpa: number;
  /** One-line server explanation suitable for inclusion in the LLM
   *  prompt as a structural hint. */
  rationale: string;
}

export interface PickNextMoveInput {
  phase: SalaryPhase | string;
  initialOffer: number;
  maxStretch: number;
  walkAway: number;
  highestOfferMade?: number | null;
  candidateTarget?: number | null;
  hasEquity?: boolean;
  /** Sticky: did the candidate accept at any point in this session? */
  isAccepted?: boolean;
  /** Levers the AI has already pulled this session. Used to rotate
   *  non-cash levers so we don't re-offer the same joining bonus
   *  three turns in a row. */
  leversTried?: ReadonlyArray<NegotiationLever>;
}

export function pickNextMove(input: PickNextMoveInput): NextMove {
  const {
    phase,
    initialOffer,
    maxStretch,
    walkAway,
    highestOfferMade,
    candidateTarget,
    hasEquity,
    isAccepted,
    leversTried,
  } = input;

  // 1. Acceptance dominates — recap and close.
  if (isAccepted) {
    return {
      lever: "close-acceptance",
      newTotalLpa: highestOfferMade ?? initialOffer,
      deltaLpa: 0,
      rationale:
        "Candidate has accepted. Recap the agreed package and move to logistics (notice period, joining date). Do NOT introduce a new number.",
    };
  }

  // 2. Phase-locked moves that don't touch numbers.
  if (phase === "offer-reaction") {
    return {
      lever: "open-with-offer",
      newTotalLpa: initialOffer,
      deltaLpa: 0,
      rationale: `Present the initial ₹${initialOffer} LPA offer and ask for the candidate's reaction. Do not move the number yet.`,
    };
  }
  if (phase === "probe-expectations") {
    return {
      lever: "probe",
      newTotalLpa: null,
      deltaLpa: 0,
      rationale:
        "Ask for the candidate's target range and the reasoning behind it before moving any number this turn.",
    };
  }
  if (phase === "benefits-discussion") {
    return {
      lever: "benefits-summary",
      newTotalLpa: null,
      deltaLpa: 0,
      rationale:
        "Lay out the non-cash package (insurance, learning budget, flexibility). Do not move base this turn.",
    };
  }

  // 3. Counter / closing-pressure — try cash headroom first.
  const counter = pickServerCounter({
    phase,
    initialOffer,
    maxStretch,
    walkAway,
    highestOfferMade,
    candidateTarget,
  });
  const floor = Math.max(highestOfferMade ?? 0, initialOffer);
  const triedSet = new Set<NegotiationLever>(leversTried ?? []);

  if (counter !== null && counter > floor) {
    return {
      lever: "counter-base",
      newTotalLpa: counter,
      deltaLpa: Math.round((counter - floor) * 10) / 10,
      rationale: `Move headline CTC to ₹${counter} LPA (split toward candidate target, capped at maxStretch ₹${maxStretch}).`,
    };
  }

  // 4. No cash headroom — rotate non-cash levers in priority order.
  if (!triedSet.has("joining-bonus")) {
    return {
      lever: "joining-bonus",
      newTotalLpa: null,
      deltaLpa: 0,
      rationale:
        "Base is at the ceiling. Offer a one-time joining bonus (₹1–3L typical) — does not inflate CTC commitment.",
    };
  }
  if (hasEquity && !triedSet.has("equity-grant")) {
    return {
      lever: "equity-grant",
      newTotalLpa: null,
      deltaLpa: 0,
      rationale:
        "Base maxed; offer an equity bump (ESOPs / RSUs). Only valid when band.hasEquity=true — verified before reaching this lever.",
    };
  }
  if (!triedSet.has("notice-buyout")) {
    return {
      lever: "notice-buyout",
      newTotalLpa: null,
      deltaLpa: 0,
      rationale:
        "Offer a notice-period buyout to accelerate joining — useful when candidate cites timing constraints.",
    };
  }

  // 5. All levers exhausted — hold firm, ask for a decision.
  return {
    lever: "hold-firm",
    newTotalLpa: floor,
    deltaLpa: 0,
    rationale: `All levers exhausted. State honestly that ₹${floor} LPA is the ceiling and ask for a decision. Do not introduce anything new — that's how duplicate-reply loops start.`,
  };
}

/**
 * Extract mirroring anchors from a candidate's answer — the words and
 * phrases the LLM should echo verbatim in the follow-up to lift rapport.
 *
 * Two passes:
 * 1. High-frequency / proper-noun word ranking (top 5 lowercased keys).
 * 2. "the X" / "my X" / "our X" idiomatic phrases (length ≤4 words),
 *    casing preserved so "the Migration Project" survives.
 *
 * PII scrub: drops always-capitalized, low-frequency tokens that look
 * like personal first names. Tokens with internal caps (PhonePe), known
 * tech / company allowlist members (Stripe, Figma), or company-shape
 * suffixes (-ai, -labs, -tech, -inc, -corp, -io) survive.
 */
/**
 * Did the candidate's message ask for a breakdown of the offer (or any
 * specific component of it)? Used by follow-up.ts to force wantsBreakdown=true
 * on the LLM's parsed output when the LLM forgot to set it itself — the
 * "breakdown-deflection rescue" path. We shipped the same bug four times
 * via the LLM ignoring the wantsBreakdown=true instruction. This guard
 * makes the rescue deterministic at the server boundary.
 *
 * Wide net: matches whole-package asks ("breakdown", "all the parts")
 * AND component-specific asks ("the base salary", "what's the joining
 * bonus"). Both deserve a full templated breakdown — the breakdown
 * sentence is short enough to deliver in one turn regardless of which
 * component was asked.
 */
export function isBreakdownAsk(answer: string): boolean {
  if (!answer) return false;
  const re =
    /\b(?:break\s*down|breakup|components?|structure|split|all\s+the\s+parts|complete\s+breakdown|base\s+salary|the\s+base|variable\s+(?:pay|component)|joining\s+bonus|provident\s+fund|how\s+much\s+is\s+(?:the\s+)?(?:base|variable|joining|pf)|what(?:'?s|\s+is)\s+(?:the\s+)?(?:base|variable|joining|pf))\b/i;
  return re.test(answer);
}

export function extractMirrorTokens(answer: string): string[] {
  if (!answer || answer.length < 30) return [];
  const stop = new Set([
    "the","and","you","your","what","when","where","which","who","whom","whose",
    "how","why","that","this","these","those","with","from","into","onto","upon",
    "have","has","had","was","were","been","being","are","could","should","would",
    "did","does","but","not","all","any","one","two","three","for","its","their","them",
    "they","there","then","than","also","just","like","about","after","before","each",
    "such","very","over","much","more","most","some","many","tell","share","walk",
    "give","make","made","take","took","get","got","said","say","says","really","actually",
    "because","while","whilst","through","across","around","without","within","under","upon",
    "myself","yourself","ourselves","themselves","itself","being","doing","going","saying",
    "people","person","thing","things","stuff","really","quite","kind","sort","still","also",
  ]);
  const NON_PII_CAPS = new Set([
    "stripe","razorpay","paytm","phonepe","figma","github","gitlab","slack","notion","jira",
    "zoom","azure","aws","gcp","docker","kubernetes","python","javascript","typescript",
    "react","node","postgres","mysql","redis","mongodb","graphql","rest","api","sdk",
    "google","microsoft","amazon","apple","meta","netflix","uber","ola","swiggy","zomato",
    "flipkart","myntra","cred","groww","zerodha","freshworks","zoho","tcs","infosys","wipro",
    "accenture","deloitte","mckinsey","bain","bcg","kpmg","ey","pwc","sap","oracle","ibm",
    "android","ios","linux","windows","macos","chrome","firefox","safari","cartesia","groq",
    "gemini","openai","anthropic","claude","supabase","vercel","upstash","deepgram","sarvam",
  ]);
  const COMPANY_SUFFIX = /(?:ai|ml|labs?|tech|inc|corp|io)$/i;

  const cleaned = answer.replace(/[^A-Za-z0-9\s'-]/g, " ");
  const words = cleaned.split(/\s+/).filter(Boolean);
  const freq = new Map<string, { count: number; capitalized: boolean; lowerCount: number; hasInternalCap: boolean }>();
  for (const w of words) {
    if (w.length < 4) continue;
    const lower = w.toLowerCase();
    if (stop.has(lower)) continue;
    const cur = freq.get(lower) || { count: 0, capitalized: false, lowerCount: 0, hasInternalCap: false };
    cur.count++;
    if (/^[A-Z]/.test(w)) cur.capitalized = true;
    else cur.lowerCount++;
    if (/^[A-Za-z].*[A-Z]/.test(w.slice(1))) cur.hasInternalCap = true;
    freq.set(lower, cur);
  }
  const ranked = Array.from(freq.entries())
    .filter(([lower, info]) => {
      if (!info.capitalized || info.lowerCount > 0) return true;
      if (info.count > 2) return true;
      if (lower.length > 10 || lower.length < 3) return true;
      if (NON_PII_CAPS.has(lower)) return true;
      if (info.hasInternalCap) return true;
      if (COMPANY_SUFFIX.test(lower)) return true;
      return false;
    })
    .sort((a, b) => (b[1].count - a[1].count) || ((b[1].capitalized ? 1 : 0) - (a[1].capitalized ? 1 : 0)))
    .slice(0, 5)
    .map(([w]) => w);

  const phraseRe = /\b(?:the|my|our)\s+([a-z][a-z-]{2,})(?:\s+([a-z][a-z-]{2,}))?\b/gi;
  const phrases: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = phraseRe.exec(answer)) !== null && phrases.length < 4) {
    const full = m[0].replace(/\s+/g, " ");
    if (!phrases.some(p => p.toLowerCase() === full.toLowerCase())) phrases.push(full);
  }
  return Array.from(new Set([...ranked, ...phrases])).slice(0, 6);
}

/* ── Duplicate-reply rescue ──────────────────────────────────────────
 * Bug class: the LLM emits a verbatim (or near-verbatim) duplicate of a
 * prior AI turn — usually because it hit the same fallback path twice
 * after failing to ground in the candidate's restated ask. The
 * `duplicate-reply` detector pins this offline; this helper is the
 * runtime fix that swaps the duplicate for a concrete-move escape
 * hatch BEFORE the response ships.
 *
 * The normalization (lowercase, collapse whitespace, strip punctuation)
 * mirrors `normalizeForDuplicate` in _negotiation-failures.ts so the
 * detector and rescue agree on what "duplicate" means. We require
 * ≥ 80 chars before flagging — short acknowledgements ("Got it.")
 * legitimately repeat.
 */
export function normalizeForDuplicate(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[.,;:!?—–-]+/g, " ")
    .replace(/[\s\u00a0]+/g, " ")
    .trim();
}

export function isDuplicateOfRecent(
  text: string,
  prev: readonly string[] | undefined | null,
): boolean {
  if (!prev || prev.length === 0) return false;
  if (!text || text.trim().length < 80) return false;
  const norm = normalizeForDuplicate(text);
  if (!norm) return false;
  for (const p of prev) {
    if (normalizeForDuplicate(p) === norm) return true;
  }
  return false;
}

export interface DuplicateRescueContext {
  /** Highest offer the AI has put on the table this session. */
  highestOfferMade?: number | null;
  /** The band's max-stretch ceiling — never exceeded by the rescue counter. */
  maxStretch?: number | null;
}

/**
 * When the LLM repeats itself verbatim, we replace the reply with a
 * concrete-move sentence: acknowledge we've been circling, then either
 * make a forward counter (if there's headroom between the current offer
 * and the ceiling) or call the question (if we're already at the
 * ceiling and the candidate is the one who has to move).
 *
 * The counter formula: move 60% of the remaining headroom toward the
 * ceiling. That's aggressive enough to feel like real movement, and
 * still leaves a small reserve. Clamped to maxStretch.
 */
export function composeDuplicateReplyRescue(
  ctx: DuplicateRescueContext,
): string {
  const offer = typeof ctx.highestOfferMade === "number" && Number.isFinite(ctx.highestOfferMade) && ctx.highestOfferMade > 0
    ? ctx.highestOfferMade
    : null;
  const stretch = typeof ctx.maxStretch === "number" && Number.isFinite(ctx.maxStretch) && ctx.maxStretch > 0
    ? ctx.maxStretch
    : null;

  // Forward counter path: there's still headroom between the current
  // offer and the ceiling. Move 60% of the way.
  if (offer != null && stretch != null && stretch > offer) {
    const next = Math.min(stretch, Math.round((offer + (stretch - offer) * 0.6) * 10) / 10);
    return `You're right, I've been going in circles — apologies for that. Let me make a concrete move: I can stretch to ₹${next} LPA total CTC. That bumps base, keeps the variable structure intact, and includes our standard benefits. Does that get us closer to a yes, or is there a specific lever — base, joining, equity — you'd want me to revisit instead?`;
  }

  // Already at (or above) the ceiling — call the question rather than
  // re-offer the same number. No rupee figure: the candidate has it.
  if (offer != null && stretch != null && offer >= stretch) {
    return `You're right, I've been circling — apologies. I've shared where I can land today, and I'm at the top of the band for this role. If the package doesn't work I'd rather know now than keep asking the same thing. What would actually move you to yes — or should we pause here?`;
  }

  // Fall-through: we don't have enough context (no offer or no
  // ceiling) to make a numeric move. Still break the loop with
  // honesty + a lever-pointing question.
  return `You're right, I've been circling — apologies for repeating myself. Let me be straight: tell me which lever matters most to you — base, variable, joining bonus, or notice-period flexibility — and I'll work on that one concretely.`;
}

/* ── Behavioural register hygiene ─────────────────────────────────────
 *  The behavioural follow-up coach is prompted (follow-up.ts line ~57)
 *  to avoid American-startup / LLM-ism register — "let's dive in",
 *  "reach out", "circle back" etc. — and speak natural Indian English.
 *  But a prompt-level ban is a *string* ban: it lists a handful of exact
 *  phrases, so the model reliably evades it with an un-listed variant
 *  ("dive deeper", "diving into", "delve into", "unpack that"). Live
 *  staging probing caught "Let's dive deeper into the pilot…" leaking
 *  through on ~1-in-5 samples — the same banned-register class tasks
 *  ISSUE-4 / ISSUE-4b purged from the intro, reappearing in the dynamic
 *  turn because nothing downstream of the LLM enforced it.
 *
 *  This is the structural guarantee the prompt cannot give: a
 *  deterministic post-generation rewrite that maps the whole register
 *  family to clean, meaning-preserving Indian-English equivalents,
 *  independent of how the model phrased it on any given sample. Each
 *  rule is a conservative verb-phrase swap that never changes meaning
 *  (e.g. "dive deeper into X" → "go deeper into X"). Applied ONLY on
 *  the behavioural path — the salary-negotiation surface has its own
 *  register system in _canonical-prose.ts and is left byte-identical.
 *
 *  Scope is deliberately narrow: only unambiguous register offenders,
 *  so it can run unconditionally without risk of mangling good prose. */
interface RegisterRule {
  re: RegExp;
  to: string;
}

const BEHAVIOURAL_REGISTER_RULES: readonly RegisterRule[] = [
  // "dive" verb-as-metaphor family — the ISSUE-4 offender and its variants.
  // Order matters: the more specific "... into" / "... deeper" forms must
  // run before the bare "dive in" / "dive into" rules so the longer phrase
  // wins and the shorter rule never sees a partial leftover.
  { re: /\blet'?s dive in\b/gi, to: "let's get into it" },
  { re: /\bdive deeper into\b/gi, to: "go deeper into" },
  { re: /\bdiving deeper into\b/gi, to: "going deeper into" },
  { re: /\bdive deeper\b/gi, to: "go deeper" },
  { re: /\bdiving deeper\b/gi, to: "going deeper" },
  { re: /\bdive into\b/gi, to: "get into" },
  { re: /\bdiving into\b/gi, to: "getting into" },
  { re: /\bdive in\b/gi, to: "get started" },
  // "delve" — the canonical LLM-ism (see BUG/task #22).
  { re: /\bdelve deeper into\b/gi, to: "go deeper into" },
  { re: /\bdelve deeper\b/gi, to: "go deeper" },
  { re: /\bdelve into\b/gi, to: "go into" },
  { re: /\bdelve\b/gi, to: "look" },
  // "unpack" as a metaphor.
  { re: /\blet'?s unpack\b/gi, to: "let's break down" },
  { re: /\bunpack that\b/gi, to: "break that down" },
  // American-startup connective tissue explicitly banned at the prompt.
  { re: /\bcircle back\b/gi, to: "come back" },
  { re: /\btouch base\b/gi, to: "check in" },
  { re: /\breach out to\b/gi, to: "get in touch with" },
  { re: /\breach out\b/gi, to: "get in touch" },
  // "leverage" as a VERB ("leverage that relationship" → "use that
  // relationship") is corporate filler; "use" is cleaner. But "leverage"
  // as a NOUN ("your leverage in the negotiation", "high leverage", "no
  // leverage") MUST be preserved — rewriting it to "use" mangles meaning.
  // We skip the noun sense by refusing to match when a determiner /
  // quantifier / possessive / adjective immediately precedes it.
  {
    re: /(?<!\b(?:the|a|an|your|my|his|her|its|our|their|more|less|high|low|enough|some|any|no|what|which|that|this|much|little|extra|real|strong|maximum|negotiating|financial|pricing)\s)\bleverage\b/gi,
    to: "use",
  },
];

/** Preserve the leading-letter case of the matched phrase so a
 *  sentence-initial replacement stays capitalized. */
function matchLeadingCase(replacement: string, matched: string): string {
  const first = matched.charAt(0);
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

/**
 * Deterministically rewrite banned American-startup / LLM-ism register
 * in a behavioural follow-up to clean Indian-English equivalents. Pure,
 * idempotent, meaning-preserving. Returns the input unchanged when there
 * is nothing to rewrite (the common case).
 */
export function sanitizeBehaviouralRegister(text: string): string {
  if (typeof text !== "string" || text.length === 0) return text;
  let out = text;
  for (const { re, to } of BEHAVIOURAL_REGISTER_RULES) {
    out = out.replace(re, (matched) => matchLeadingCase(to, matched));
  }
  return out;
}
