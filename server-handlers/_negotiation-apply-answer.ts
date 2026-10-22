/* Negotiation kernel: fold a parsed candidate answer into state. */

import { type NegotiationState, type UserClaims, type ContradictionSignal, type PowerSignals, computeRecruiterPower } from "./_negotiation-state-types";
import { type ParsedAnswer, parseCandidateAnswer, applyMoodShift, applyAffinitySignals, AFFINITY_MAX, AFFINITY_MIN, recruiterElicitedDisclosure } from "./_negotiation-parse";
import { normalizeQuotes, computeTurnDelta, mergeCumulativeUrgency, markAccepted, attachPostAcceptanceMessage } from "./_negotiation-turn-delta";
import { isWalkAway } from "./_walkaway-detection";
import { isTerminalPhase, _callNextActionPlanner, type NegotiationBand } from "./_negotiation-vocab";
import { isOfferOnTable, isFlatAck, maybeAdvanceRound, statedTotalTargetCtcLpa, detectCurrentEmployer, canCloseSession, effectiveTargetCtcLpa } from "./_negotiation-factory";
import { USER_FRUSTRATION_RE } from "./_user-signals";
import { appendConversation, derivePhase } from "./_negotiation-moves";
import { classifyFromLog } from "./_candidate-register";
import { detectInHandFraming, backComputeCtcFromInHand } from "./_in-hand-vs-ctc";
import { recordFact } from "./_conversation-ledger";
import { type CandidateComp, EMPTY_COMP, observationsFromParsed, applyObservations } from "./_compensation-model";
import { mergeBreakdown } from "./_component-breakdown";
import { computeHikePercent } from "./_hike-rationale";
import { mergeNoticeJoining } from "./_notice-joining";
import { mergeEquityVesting } from "./_equity-vesting";
import { mergeLocationMode } from "./_location-mode";
import { mergeCompetingOfferDetail, isCompetingOfferRevoked } from "./_competing-offer-detail";
import { mergeDecisionDeadline } from "./_decision-deadline";
import { detectStatedCurrentCompany, resumeConfirmsCompany } from "./_resume-fact-pack";
import { mergeCandidateProfile, detectFreshGradDisclosure } from "./_candidate-profile";
import { resolveServerBand } from "./_band-resolver";
import { getCompanyTier } from "../data/company-tiers";
import { clampBandToTierP50 } from "./_band-sanity";
import { mergeMiscSignals } from "./_misc-signals";
import { mergeRetentionCounter } from "./_retention-counter";
import { detectRecoverySignals, mergeCandidateStance } from "./_candidate-stance";
import { extractNonSalaryConstraints, mergeNonSalaryConstraints } from "./_non-salary-constraints";
import { extractSalesOTE, mergeSalesOTE, extractContractRate, mergeContractRate } from "./_comp-structure";
import { detectCandidateDisclosures } from "./_candidate-disclosure-tracker";
import { detectTrialCloseAsked, detectTrialCloseResponse } from "./_trial-close-detector";
import { syncChecklistFromParsedFacts } from "./_discovery-stage";
import { detectExplicitAcceptance } from "./_acceptance-classifier";
import type { NegotiationFacts } from "../src/interviewEvaluation";

/* ─── State transition: fold candidate's answer into state ───────── */

/** #115 fast-follow (2026-06-20, live staging) — disclosed-CTC floor on the
 *  band-accept close path.
 *
 *  When a candidate ACCEPTS a stated band with no concrete point offer (the
 *  `!hasOffer && state.band` arm in applyCandidateAnswer), the kernel locks
 *  `state.band.initialOffer` in as the standing offer. But initialOffer is the
 *  anchor-LOW band floor; for a candidate whose DISCLOSED current CTC sits
 *  above that floor, closing there finalizes a pay CUT. Live evidence: a
 *  Flipkart Engineering Manager at ₹48L current accepted and closed at ₹27.8L
 *  fixed / ₹32.7L total — a 42% cut nobody would ever sign.
 *
 *  The planner's anchor path already honours this via
 *  clampAnchorAboveDisclosed; this is the symmetric guard for the kernel's
 *  accept-on-band path, which cannot import the planner (import cycle —
 *  planner depends on this module). The hike-percent rule MIRRORS the
 *  planner's minHikePctForRole (25% for senior/lead/≥4-YoE, else 15%);
 *  kept inline rather than shared to avoid the cycle. The floor is capped at
 *  the band ceiling (maxStretch) so a structurally-tight band (ceil below the
 *  candidate's CTC — the overqualified / down-level case) still resolves to
 *  the best the band allows rather than overshooting it. When current CTC is
 *  undisclosed the band floor is returned unchanged (back-compat). Pure. */
export function bandAcceptOfferFloor(state: NegotiationState): number {
  const base = state.band.initialOffer;
  const disclosed = state.candidateCurrentCtc;
  if (typeof disclosed !== "number" || disclosed <= 0) return base;
  const role = (state.role || "").toLowerCase();
  const seniorRoleRe = /\b(?:senior|lead|principal|staff|sr\.?|director|head|manager|vp|chief)\b/i;
  const isSenior = seniorRoleRe.test(role) || (state.candidateApplicableYoe ?? 0) >= 4;
  const hikePct = isSenior ? 0.25 : 0.15;
  const hikeFloor = Math.round(disclosed * (1 + hikePct));
  const ceil = state.band.maxStretch ?? base;
  return Math.min(Math.max(base, hikeFloor), Math.max(base, ceil));
}

/** OA-B69 (2026-07-18) — single predicate for "the candidate had verbally
 *  accepted and is now re-opening the deal". A reopen requires a NEW demand:
 *  either a fresh target number, a sign-today bundle push, OR a non-cash
 *  lever ask (higher base, a joining bonus, or relocation assistance). It is
 *  NOT tripped by acceptance itself, and — preserving AUDIT-W02 BUG-5 — NOT
 *  by an info-only clarifying question ("what's the joining date again?"):
 *  `parsed.infoAsked` is deliberately absent from every arm below. The lever
 *  arms read the demand-shaped signals (a stated joining-bonus ASK, a
 *  relocation REQUEST, a base-push component) — never the info/literacy
 *  fields (equity vesting familiarity, notice-period disclosure), which are
 *  clarifications, not new asks. */
export function isPostAcceptReopen(parsed: ParsedAnswer): boolean {
  if (parsed.signalsAcceptance) return false;
  const newNumberOrBundle =
    parsed.target != null || parsed.vossTactics.includes("sign-today-bundle");
  const newLeverAsk =
    parsed.componentBreakdown.base != null || // wants-higher-base (base-push counter)
    parsed.noticeJoining.joiningBonusAsk != null || // wants-joining-bonus
    parsed.locationMode.relocationRequested; // wants-relocation-allowance
  return newNumberOrBundle || newLeverAsk;
}

/** Apply a candidate turn to state. Returns a new state — never
 *  mutates the input. Terminal phases are sticky: if state.phase is
 *  already terminal, returns state unchanged. */
export function applyCandidateAnswer(state: NegotiationState, rawAnswerInput: string): NegotiationState {
  /* Audit Pass 2 Fix D (2026-05-16) — normalize curly/smart quotes at
   * the input boundary BEFORE anything else reads `answer`. Every
   * downstream regex bank assumes ASCII `'`/`"`. Single point of fix
   * for iOS / macOS / smart-typography paste paths. */
  const answer = normalizeQuotes(rawAnswerInput ?? "");
  /* Negotiation-flow redesign commit 1 (2026-05-15): capture pre-state
   * snapshot for TurnDelta computation. The single pre/post diff is
   * recomputed at every return point via finalize() below to keep
   * the 8+ return branches consistent. */
  const pre = state;
  /* Walk-away-and-return: if state is terminal `walked-away` but the
     candidate sends a non-empty engagement, re-open the conversation
     with a penalty flag. This is the only path out of a terminal phase
     and it's a one-way trapdoor (the flag is sticky). */
  if (state.phase === "walked-away" && (answer || "").trim().length > 0 &&
      !isWalkAway(answer)) {
    /* 2026-05-29 audit pass — walkAwayReturned is documented as a
     * one-way trapdoor (sticky once true). If the kernel ever re-enters
     * this reopen branch with the flag ALREADY true, something
     * upstream reset the flag illegally — surface it as a hard error
     * rather than silently re-flipping. The flag drives split-half
     * stiffening in the planner and event emission in kernel-audit;
     * a silent reset breaks both. */
    if (state.walkAwayReturned === true) {
      throw new Error(
        "kernel-invariant: walkAwayReturned reset to false between turns " +
        `(session=${state.sessionId} turn=${state.turnIndex})`,
      );
    }
    const reopened: NegotiationState = {
      ...state,
      leversUsed: [...state.leversUsed],
      vossTacticsUsed: [...state.vossTacticsUsed],
      infoAsked: [...state.infoAsked],
      infoAskedInitiated: [...(state.infoAskedInitiated ?? [])],
      phase: "counter-offer",
      walkAwayReturned: true,
      walkedAwayAtTurn: null,
      /* Audit Pass 3 / Fix 1 (2026-05-16) — clear stalemate ledger
       * symmetrically with walkedAwayAtTurn when the session reopens. */
      stalemateAtTurn: null,
    };
    return applyCandidateAnswer(reopened, answer);
  }
  if (isTerminalPhase(state.phase)) return state;

  /* `offerOnTable` lets the acceptance classifier veto commitment
     idioms ("sounds good") that arrive before any number has been
     quoted — structural phase gate (Phase 9).

     Bug-D fast-follow (2026-06-19) — a band presented as a RANGE
     (`band-anchor-with-rationale`, when the candidate's CTC sits below
     the band floor) sets no `highestOfferMade`, yet it IS a concrete
     number the candidate can accept. Without counting it as an offer-
     on-table the classifier vetoes the candidate's "that works for me,
     let's close" as pre-offer filler, signalsAcceptance stays false,
     and the session can never close against the stated band. Treating a
     presented band as an offer-on-table is exactly what the phase gate
     is meant to express — we are past discovery the moment the band is
     communicated. */
  const offerOnTable = isOfferOnTable(state);
  const parsed = parseCandidateAnswer(answer, state.lastAiText, state.phase, offerOnTable, state.turnIndex, state.candidateCurrentCtc ?? null, state.company ?? null, state.highestOfferMade ?? null);
  /* Per-month periodicity (2026-06-15, unbiased-review HIGH) is normalized at
   * the SOURCE — _number-role-classifier.ts annualizes each salary span by its
   * own trailing context, so parsed.target / currentCtc / competing already
   * arrive in LPA regardless of monthly framing. The earlier whole-utterance
   * normalization here was removed: it suppressed annualization whenever ANY
   * annual marker appeared in the sentence, which re-opened the false-accept
   * on the common mixed phrasing "I make 18 LPA now, I want 2.4 lakh per
   * month". Per-span attribution at the classifier fixes that class properly. */
  /* PDF#27 Fix 2 (2026-05-17) — repetition-complaint detection. The
   * candidate flags that the bot is repeating itself ("stop repeating",
   * "I already answered that", "asked this before"). Stamp the turn so
   * the planner force-advances past the topic next turn. */
  const REPETITION_COMPLAINT_RE =
    /\b(?:repeat(?:ing)?|same\s+question|already\s+(?:answered|asked|told|said)|asked\s+(?:this|that)\s+(?:before|already)|stop\s+repeating|why\s+(?:are\s+you|do\s+you)\s+keep\s+asking)\b/i;
  const repetitionComplaintAtTurn = REPETITION_COMPLAINT_RE.test(answer)
    ? state.turnIndex
    : (state.repetitionComplaintAtTurn ?? null);
  /* PDF#29 Bug 7 (2026-05-18) — frustration signal. Distinct from the
   * repetition-complaint stamp (which lives forever for analyzer
   * audit): this is a one-turn fold the planner consumes to fire the
   * acknowledge-and-recover lever. Cleared in applyAiMove. */
  const lastUserFrustrated = USER_FRUSTRATION_RE.test(answer);
  /* PDF#27 Fix 5 (2026-05-17) — offer-ask detection. Candidate asks
   * what the company is offering; the band-disclosure lever reads this
   * to fire on the very next planner call. */
  /* PDF#42 BUG-D (2026-05-21) — widen to include "final offer", "last
   * offer", "best (and) final". Candidate's "what is your final offer?"
   * after multiple deflections must route to a closing-push restate,
   * NOT fall through the question-intent classifier into a generic
   * budget-deflection (which masked the ask and trickled into an
   * abrupt-termination chain). The kernel stamp `offerAskedAtTurn`
   * lets the planner pick the closing-push lever on the very next call. */
  /* PDF#44 (2026-05-26) — STRUCTURAL widening. Prior regex enumerated
   * fixture-specific spellings ("what's the offer", "share the offer")
   * and missed real fixtures like "what is your offer?" (Flipkart
   * Sr-PD T3) — the determiner "the" vs possessor "your" should not
   * make the difference. Rewrote as three structural shapes:
   *
   *   (A) ASK-VERB + (possessor) + OFFER-NOUN
   *       Verbs: what(?:'s| is| are), tell me, share, give me, can
   *       you (share|tell|give), provide.
   *       Possessor (optional): the / your / this / a.
   *       Offer-nouns: offer, fitment, number(s), package, range,
   *       on offer, offer range.
   *
   *   (B) Adjective-qualified offer ask (final / last / best) —
   *       preserved from PDF#42.
   *
   *   (C) Bare "best and final" — preserved.
   *
   * Generalises across "what's the offer?", "what is your offer?",
   * "tell me the offer", "share your number", "what's the package"
   * without enumerating each fixture. */
  /* 2026-06-17 — RECALL WIDENING (live-staging finding). The original
   * shapes (A)-(D) required the offer-noun to sit IMMEDIATELY after a fixed
   * ask-verb, so natural request frames slipped through and left
   * offerAskedAtTurn null — which starves the planner's Fix-5 anchor gate
   * (it anchors regardless of discovery completeness ONLY when this fires),
   * looping the recruiter on discovery-probe deflections forever instead of
   * putting a number down. A live negotiation stalled exactly this way on
   * "what fitment can you put on the table?" and "where does the offer
   * land?" — both unmatched. Shapes (E)-(H) add the missing frames.
   *
   * COST MODEL — unlike the _output-rail-offer-ask detector (which biases
   * PRECISION because a false positive there swaps a real interaction for a
   * canned stub), THIS gate biases RECALL: a false positive merely anchors
   * the offer a touch early, which post-discovery is always legitimate HR
   * behaviour. So the two detectors are deliberately NOT consolidated; they
   * optimise opposite error costs. The "on the table" / "land" frames are
   * scoped to a candidate REQUEST ("can you …", "put a number …", wh-form)
   * so a candidate DISCLOSURE ("I have a competing offer on the table")
   * does not trip the gate. Locked by negotiationOfferAskDetection.test. */
  const OFFER_ASK_RE = new RegExp(
    [
      // (A) ASK-VERB + optional possessor + offer-noun
      String.raw`\b(?:what(?:'?s|\s+is|\s+are)|tell\s+me|share|give\s+me|can\s+you\s+(?:share|tell\s+me|give\s+me|provide)|provide)\s+(?:the\s+|your\s+|this\s+|a\s+|me\s+)*(?:initial\s+|standing\s+)?(?:offer|fitment|number|numbers|package|range|on\s+offer|offer\s+range)\b`,
      // (B) adjective-qualified (final / last / best (and final))
      String.raw`(?:what(?:'?s|\s+is)\s+your\s+)?\b(?:final|last|best(?:\s+and\s+final)?)\s+(?:offer|number|fitment)\b`,
      // (C) bare "best and final"
      String.raw`\bbest\s+and\s+final\b`,
      // (D) "what are you offering"
      String.raw`\bwhat\s+are\s+you\s+offering\b`,
      // (E1) request to put something "on the table": "can you put … on the table"
      String.raw`\b(?:can|could|would|will)\s+you\b[^.?!]{0,40}\bon\s+the\s+table\b`,
      // (E2) "put a number/offer/fitment on the table"
      String.raw`\bput\s+(?:a\s+|the\s+|your\s+|some\s+)?(?:number|offer|fitment|figure|range)\s+on\s+the\s+table\b`,
      // (F1) wh-form "where does/will/can the offer/number/… (land)"
      String.raw`\bwhere\s+(?:does|will|would|can|is)\b[^.?!]{0,30}\b(?:offer|fitment|number|package|range)\b`,
      // (F2) offer-noun + landing verb ("the offer lands / comes in at")
      String.raw`\b(?:offer|fitment|number|package|range)\b[^.?!]{0,25}\b(?:land|lands|come\s+in|comes\s+in)\b`,
      // (G) "what [offer-noun] can you offer / put / share / do / bring / stretch"
      String.raw`\bwhat\s+(?:offer|fitment|number|package|range|figure)?\s*can\s+you\s+(?:offer|do|put|bring|stretch|share|give|provide)\b`,
      // (H) "how much can you (offer) / are you offering"
      String.raw`\bhow\s+much\s+(?:can\s+you|are\s+you\s+offering)\b`,
    ].join("|"),
    "i",
  );
  const offerAskedAtTurn = OFFER_ASK_RE.test(answer)
    ? state.turnIndex
    : (state.offerAskedAtTurn ?? null);
  /* FL5 / Audit Pass 4 (PDF#27, 2026-05-17) — uncertainty detection.
   * When the candidate hedges on the value ("not sure", "around 30",
   * "I think", "approximately", "don't remember"), the planner should
   * offer a range / escape hatch on the NEXT turn instead of
   * grinding on an exact number. Stamp the turn index; the planner
   * consults state.lastAnswerUncertainAt to route off-script. */
  const UNCERTAINTY_RE =
    /\b(?:not\s+sure|don'?t\s+remember|don'?t\s+know|approximat(?:e|ely)?|around|roughly|i\s+think|maybe|forget|forgot)\b/i;
  const lastAnswerUncertainAt = UNCERTAINTY_RE.test(answer)
    ? state.turnIndex
    : (state.lastAnswerUncertainAt ?? null);
  /* PDF#32 BUG H (2026-05-18) — unparseable / noise candidate input.
   *
   * Prita replay T19: candidate's STT layer surfaced the literal string
   * "audible" (a stage-direction artifact, not actual speech) as the
   * answer to the bot's "what's the base split?" probe. Downstream the
   * bot:
   *   1. Marked "base" satisfied on the askedTopics ledger anyway
   *      (the push happens at applyAiMove time, BEFORE the candidate
   *      answers — so an unparseable answer left "base" looking
   *      satisfied).
   *   2. Planner advanced past base, fired the esop component-probe.
   *   3. LLM-restyle drifted the question into a fabricated-disclosure
   *      statement ("ESOPs do kick in, but vesting cliff…"). [BUG G]
   *   4. Session terminated abruptly.
   *
   * Architectural fix: detect the small, well-bounded set of "this is
   * not a real answer" signals at the kernel input boundary, and REWIND
   * the askedTopics tail so the prior probe re-fires on the next turn.
   * The bot then re-asks instead of advancing past a topic the
   * candidate never actually addressed.
   *
   * Conservative-by-design: matches only literal stage-direction
   * artifacts and bracket-wrapped transcription tags. Real terse
   * answers ("yes", "no", "k", "fine") are NOT noise and must pass
   * through — those are legitimate signal the parser handles. */
  const NOISE_ANSWER_RE =
    /^[\s"'""''.,!?\-—–]*(?:\[(?:noise|unclear|silence|inaudible|crosstalk|unintelligible)\]|<(?:silence|noise|unclear|inaudible)>|(?:in)?audible|unintelligible|crosstalk|silence|\.{2,}|—+|-{2,})[\s"'""''.,!?\-—–]*$/i;
  /* PDF#35 Move 6 (2026-05-18) — single-word affirmative on a substantive
   * yes/no probe should be treated as noise (not as a discovery signal).
   *
   * Symptom: bot asks "Do you have variable in your current package?" —
   * a yes/no probe whose useful follow-up needs a NUMBER. Candidate
   * answers "Yes." The parser treated this as substantive, advanced
   * past the variable slot, and the bot never got the actual split.
   *
   * Fix: when the most recent bot turn was a substantive probe (asks
   * about a specific component, contains "?" but DOES NOT itself
   * contain a digit and is NOT framed as "what's the X / how much /
   * what number"), AND the candidate's reply is a bare single-word
   * affirmative, stamp lastAnswerNoiseAtTurn so the askedTopics tail
   * gets rewound and the planner re-asks for the actual number.
   *
   * Conservative gate: only fires on bare single-word affirmatives —
   * "yes, I do have variable" or "yes, 3 LPA" pass through normally
   * (the parser binds the number; the affirmative is decoration). */
  const SINGLE_WORD_AFFIRMATIVE_RE = /^\s*(?:yes|yeah|yep|yup|sure|ok|okay)\.?\s*$/i;
  const lastBotProbeIsYesNoSubstantive = (() => {
    const t = (state.lastAiText || "").trim();
    if (t.length === 0) return false;
    if (!/\?/.test(t)) return false;
    if (/\d/.test(t)) return false; /* a probe quoting numbers wants confirmation, not a number back */
    /* Substantive yes/no probes about a component / current package. */
    return /\b(?:do\s+you\s+have|is\s+there|any\s+(?:variable|equity|esop|rsu|bonus|stock|grants?)|got\s+(?:variable|equity|esops?|rsus?|bonus|stock)|in\s+your\s+(?:current\s+)?package)\b/i.test(t);
  })();
  /* PDF#41 BUG-A (2026-05-21) — number-seeking probe + bare "yes" = noise.
   * Prior gate (lastBotProbeIsYesNoSubstantive) EXCLUDED number-seeking
   * probes ("what's your current CTC?"), letting a bare "yes" reply
   * fall through as a substantive answer — the parser bound no facts,
   * the planner re-emitted the same probe, isVerbatimRepeat fired the
   * generic recovery stub, and the candidate perceived the UI as frozen
   * (PDF#41: "screen is stuck no way to speak"). A bare "yes" to ANY
   * number-seeking probe is noise too — it answers nothing. */
  const lastBotProbeIsNumberSeeking = (() => {
    const t = (state.lastAiText || "").trim();
    if (t.length === 0 || !/\?/.test(t)) return false;
    if (/\d/.test(t)) return false;
    return /\b(?:what(?:'s)?|how\s+much|how\s+many|what\s+number|what\s+figure|share\s+the|range|fitment)\b/i.test(t);
  })();
  const lastAnswerWasSingleWordYesOnProbe =
    (lastBotProbeIsYesNoSubstantive || lastBotProbeIsNumberSeeking) &&
    SINGLE_WORD_AFFIRMATIVE_RE.test(answer);
  /* PDF#35 Move 3 (2026-05-18) — flat-ack on a substantive bot probe
   * is noise. If the prior bot turn ended in "?" (a real probe) and
   * the candidate replies with a bare acknowledgement ("got it",
   * "noted", "makes sense"), the slot did not advance — stamp noise
   * so the planner re-asks instead of advancing past the probe. */
  const lastBotEndedInQuestion = /\?\s*$/.test((state.lastAiText ?? "").trim());
  const lastAnswerWasFlatAckOnProbe =
    lastBotEndedInQuestion && isFlatAck(answer);
  const lastAnswerWasNoise =
    answer.trim().length === 0 ||
    NOISE_ANSWER_RE.test(answer) ||
    lastAnswerWasSingleWordYesOnProbe ||
    lastAnswerWasFlatAckOnProbe;
  const lastAnswerNoiseAtTurn = lastAnswerWasNoise
    ? state.turnIndex
    : (state.lastAnswerNoiseAtTurn ?? null);

  /* PDF#34 Fix 3 (2026-05-18) — clarification-request detector.
   *
   * PDF#34 Meesho/Prita T6: bot asked "what's the vesting schedule?"
   * → candidate said "what is that?" — a comprehension question about
   * the term `vesting`. Pre-fix, the off-topic detector flagged the
   * utterance (14 chars, no on-topic lexicon, no digit, turn ≥ 2) and
   * the LLM freelanced "I'm not sure what you're referring to. This
   * conversation is about Senior Product Designer at Meesho." — a
   * persona break that misread a clarification as a topic-drift.
   *
   * Real recruiters answer the clarification ("vesting is the
   * schedule on which equity grants become yours") before re-asking.
   * The detector below is conservative: short utterance (≤ 40 chars)
   * AND matches a clarification shape ("what is X", "what does X
   * mean", "what's that", "huh", "I don't understand", "explain",
   * "?" alone). Stamps the turn so the planner can route to a
   * `clarify-prior-question` action instead of advancing discovery
   * or letting the LLM freelance a deflection.
   *
   * The detector does NOT fire when the utterance also carries a
   * number — that's typically a substantive answer (e.g. "what is
   * 22 LPA" probably came from a confused parse, not a clarification
   * request). */
  /* PDF#41 BUG-C (2026-05-21) — bare "why?" / "why not" / "how come"
   * added. Live Flipkart session: candidate said "why?" after the AI
   * refused a breakdown ask, and the AI emitted the verbatim refusal
   * a second time. Routing "why" to clarify-prior-question forces the
   * canonical-prose surface to re-explain inline rather than letting
   * the LLM re-emit the prior refusal sentence. */
  /* PDF#44 (2026-05-26) — STRUCTURAL clarification detector.
   *
   * Clarification asks have one of FOUR structural shapes — all
   * other "WH-word + noun" forms are substantive content asks
   * (e.g. "what's the offer?" — asks for the offer; "what does
   * the equity look like?" — asks about equity) and MUST NOT be
   * routed to clarify-prior-question:
   *
   *   (A) WH-word paired with a deictic pronoun (no topical noun):
   *       "what is that", "what does this mean", "what do you
   *       mean", "why is that", etc. The deictic refers BACK to
   *       the bot's prior turn — a definitional clarification ask.
   *   (B) Bare WH-word / interjection of confusion:
   *       "what?", "why?", "huh?", "pardon?", "sorry?", "?".
   *   (C) First-person confusion frame:
   *       "i don't understand", "i'm not sure what", "i'm
   *       confused", "i don't know what this/that is".
   *   (D) Explicit clarification verb:
   *       "can you clarify / specify / repeat / rephrase /
   *       elaborate / explain", "come again", "explain that".
   *
   * Covers every captured fixture (PDF#34 "what is that?",
   * PDF#41 "why?", PDF#44 "can you specify…?") without flagging
   * topic-bearing asks like "what's the offer?". */
  const CLARIFICATION_REQUEST_RE = new RegExp(
    [
      // (A) WH + deictic
      String.raw`^[\s"'""''.,!?-]*what(?:'?s|\s+is|\s+does|\s+are)?\s+(?:that|this|it|those|these|they)(?:\s+mean(?:s|ing)?)?\s*\??[\s.!]*$`,
      String.raw`^[\s"'""''.,!?-]*what\s+(?:do\s+you\s+mean|does\s+(?:that|this|it)\s+mean)\s*\??[\s.!]*$`,
      String.raw`^[\s"'""''.,!?-]*why(?:\s+not|\s+is\s+(?:that|this|it))?\s*\??[\s.!]*$`,
      String.raw`^[\s"'""''.,!?-]*how\s+come\s*\??[\s.!]*$`,
      // (B) bare WH / interjections
      String.raw`^[\s"'""''.,!?-]*(?:huh|pardon|sorry,?\s*what|meaning(?:\s+of\s+(?:that|this|it))?|\?)\s*\??[\s.!]*$`,
      // (C) first-person confusion
      String.raw`^[\s"'""''.,!?-]*i\s+(?:don'?t\s+(?:understand|know\s+what(?:'?s|\s+(?:that|this)))|am\s+(?:confused|not\s+sure\s+what)|'?m\s+(?:confused|not\s+sure\s+what))`,
      // (D) explicit clarification verb (allowed to carry a tail —
      //     "can you specify which number" is a clarifying ask)
      String.raw`\bcan\s+you\s+(?:clarify|specify|repeat|rephrase|elaborate|explain)\b`,
      String.raw`^[\s"'""''.,!?-]*(?:come\s+again|explain(?:\s+(?:that|this|it|please))?)\s*\??[\s.!]*$`,
    ].join("|"),
    "i",
  );
  const aTrim = answer.trim();
  const lastAnswerWasClarification =
    aTrim.length > 0 &&
    aTrim.length <= 40 &&
    !/\d/.test(aTrim) &&
    CLARIFICATION_REQUEST_RE.test(aTrim);
  const lastAnswerClarificationAtTurn = lastAnswerWasClarification
    ? state.turnIndex
    : (state.lastAnswerClarificationAtTurn ?? null);

  /* PDF#35 Move 1 (2026-05-18) — post-anchor offer-recap detector.
   *
   * Fires only when highestOfferMade > 0 — i.e. the anchor has already
   * landed and the candidate is asking to be REMINDED of the standing
   * offer. Pre-anchor offer asks ("what's the offer?") are handled by
   * OFFER_ASK_RE which routes to anchor-with-offer. */
  /* PDF#36 Fix A3 (2026-05-19) — broadened recap phrasings. Prior gate
   * only matched verb-template forms (what's/repeat/restate/summarize).
   * Candidate utterances like "I want to know CTC", "tell me the
   * numbers", "what are the numbers" and "share the offer" fell through
   * and got routed to band-disclosure-deflect instead of recap.
   *
   * Expanded verb branches: want-to-know / tell-me / what-are / give-
   * me / share. Expanded offer-word aliases: salary, total comp,
   * numbers, breakdown, split. */
  const OFFER_RECAP_RE =
    /\b(?:(?:what'?s|repeat|restate|remind\s+me(?:\s+of)?|summari[sz]e|summari[sz]e\s+the|what\s+was)\s+(?:the\s+)?(?:offer|ctc|fitment|number|numbers|package|total|total\s+comp(?:ensation)?|salary|breakdown|split)|want\s+to\s+know\s+(?:the\s+)?(?:offer|ctc|fitment|number|numbers|package|total|total\s+comp(?:ensation)?|salary|breakdown|split)|tell\s+me\s+(?:about\s+)?(?:the\s+)?(?:offer|ctc|fitment|number|numbers|package|total|total\s+comp(?:ensation)?|salary|breakdown|split)|what\s+(?:are|were)\s+(?:the\s+)?(?:offer|ctc|numbers|components|breakdown|split|package|total)|(?:share|give)\s+(?:me\s+)?(?:the\s+)?(?:offer|ctc|numbers|breakdown|split|package|total|fitment|salary)|offer\s+again|sorry,?\s+what\s+was|come\s+again\s+on\s+the\s+(?:offer|ctc|number|numbers)|where\s+(?:are|were)\s+we\s+(?:at|landing))\b/i;
  const lastAnswerOfferRecapAtTurn =
    state.highestOfferMade > 0 && OFFER_RECAP_RE.test(answer)
      ? state.turnIndex
      : (state.lastAnswerOfferRecapAtTurn ?? null);
  const nextConversationLog = appendConversation(state.conversationLog, "candidate", answer);
  /* 2026-05-29 realism-pass — recompute candidate register from the
   * fresh log (including the just-applied candidate utterance). Pure
   * call, idempotent, defaults to "neutral" when signal is thin. */
  const candidateRegister = classifyFromLog(nextConversationLog);
  const next: NegotiationState = {
    ...state,
    leversUsed: [...state.leversUsed],
    vossTacticsUsed: [...state.vossTacticsUsed],
    infoAsked: [...state.infoAsked],
    infoAskedInitiated: [...(state.infoAskedInitiated ?? [])],
    conversationLog: nextConversationLog,
    repetitionComplaintAtTurn,
    offerAskedAtTurn,
    lastAnswerUncertainAt,
    lastUserFrustrated,
    lastAnswerNoiseAtTurn,
    lastAnswerClarificationAtTurn,
    lastAnswerOfferRecapAtTurn,
    candidateRegister,
  };
  /* PDF#32 BUG H (2026-05-18) — askedTopics tail rewind.
   * When the prior AI turn pushed an askedTopics entry and the
   * candidate's reply to it was noise, pop that tail entry so the
   * planner re-fires the same probe instead of advancing. The pop is
   * scoped to the most-recent entry only — historical asked-topics are
   * preserved (they were answered, possibly imperfectly, but answered).
   *
   * Idempotent: if there's no tail entry or it was pushed at a turn
   * other than the last AI turn, leave the ledger alone. */
  if (lastAnswerWasNoise) {
    const prior = state.askedTopics ?? [];
    const tail = prior[prior.length - 1];
    if (tail != null && tail.atTurn === state.turnIndex) {
      next.askedTopics = prior.slice(0, -1);
    }
  }
  /* Commit 1 (2026-05-15): finalize() stamps state.lastTurnDelta from the
   * pre-state snapshot before every return. Keeps the 8+ return branches
   * (terminal-accept / soft-accept / walk-away / regular / phase-only)
   * symmetric. Pure — mutates the draft `n` in place. */
  const finalize = (n: NegotiationState): NegotiationState => {
    /* 2026-05-29 mood-shift-pass — recruiter mood shift transitions.
     * Runs BEFORE planNextAction so the planner-emitted prose this
     * turn already reflects any cool/rewarm shift. Pure; only mutates
     * the dynamic-mood ledger fields. */
    applyMoodShift(n, pre, parsed, answer);
    /* Affinity-dynamic feature (2026-05-29) — runs AFTER applyMoodShift
     * so this turn's mood-shift reads pre.recruiterAffinity (the prior
     * cumulative value). The planner call below reads the freshly
     * updated affinity via n.recruiterAffinity. */
    applyAffinitySignals(n, pre, answer);
    n.lastTurnDelta = computeTurnDelta(pre, n, parsed, answer);
    /* Perfect 3 (2026-05-16) — promote per-turn urgencySignal to sticky
     * state.cumulativeUrgency via the monotone upgrade rule. Done BEFORE
     * planNextAction so the planner's urgency-aware nudges read the
     * already-merged value, not the prior turn's. */
    n.cumulativeUrgency = mergeCumulativeUrgency(
      pre.cumulativeUrgency,
      n.lastTurnDelta.urgencySignal,
    );
    /* Phase 5 Session A (2026-05-19) — evaluate round-end trigger BEFORE
     * planNextAction so the planner sees the post-transition state (new
     * persona, opening phase, swapped band, fresh round). Default-OFF:
     * typed no-op when `multiRoundEnabled` is false. */
    const advanced = maybeAdvanceRound(n);
    if (advanced !== n) {
      /* In-place copy of advanced fields onto `n` so the rest of finalize
       * sees the post-transition state. */
      Object.assign(n, advanced);
    }
    /* Bad-faith tactic detection (2026-05-29). If the candidate's
     * latest utterance names a tactic the recruiter has already used
     * this session, push the tactic kind onto userCaughtTactics so the
     * report layer can credit a positive coaching signal. Inlined here
     * to avoid a kernel → planner cycle; mirrors detectUserCaughtTactic
     * in _next-action-planner.ts. */
    {
      const used = n.tacticsUsed ?? [];
      if (used.length > 0 && typeof answer === "string" && answer.length > 0) {
        const u = answer.toLowerCase();
        const caught = [...(n.userCaughtTactics ?? [])];
        const pushIfNew = (k: string) => {
          if (used.includes(k) && !caught.includes(k)) caught.push(k);
        };
        if (/\b(exploding|deadline|artificial|pressur(?:e|ing)|why\s+(?:the\s+)?rush|by\s+(?:eod|friday|tomorrow))\b/.test(u)) {
          pushIfNew("exploding-offer-pressure");
        }
        if (/\b(another\s+candidate|competing\s+candidate|other\s+candidate|that'?s\s+(?:a\s+)?(?:bluff|pressure))\b/.test(u)) {
          pushIfNew("fake-competing-candidate");
        }
        if (/\b(non[-\s]?binding|in\s+writing|written|vague|let'?s\s+put\s+(?:it|that)\s+in\s+(?:the\s+)?offer|specific|commit(?:ment)?|guarantee)\b/.test(u)) {
          pushIfNew("vague-promise");
        }
        n.userCaughtTactics = caught;
      }
    }
    /* Commit 3 (2026-05-15) — stamp planNextAction so the brief and the
     * move-picker read the SAME action without recomputing. The planner
     * registers itself via _planner-registry at module load (see commit
     * 4 — registerNextActionPlanner at the bottom of
     * _next-action-planner.ts) to avoid an import cycle. */
    n.plannedNextAction = _callNextActionPlanner(n);
    return n;
  };

  /* Bind newly-stated facts. Last-stated wins (the candidate may
     revise their target mid-conversation; that's allowed). Phase 25a
     also records the FIRST anchored target, frozen — used by the
     red-flag layer to detect upward drift. */
  if (parsed.target != null) {
    /* Audit Fix (2026-05-19) — Target-component routing. When the
     * classifier flags the target as fixed-scoped ("₹26 LPA fixed at
     * minimum"), it goes to candidateTargetFixed and does NOT touch
     * candidateTarget (which holds the total-package anchor). Only
     * total-scoped targets feed lastCandidateCounterLpa /
     * firstAnchoredTarget — those signals are about the overall ask. */
    if (parsed.targetComponent === "fixed") {
      next.candidateTargetFixed = parsed.target;
      /* PDF#40 BUG-2 (2026-05-21) — a base-only counter (e.g. "39.2L
       * as base salary") IS a counter signal — the candidate is naming
       * the single most negotiable component. Without this stamp the
       * planner's post-anchor counter-engagement override (gate at
       * _next-action-planner.ts L1427) never fires (it reads
       * lastCandidateCounterLpa), the planner falls through to a
       * generic info/benefits lever, and the candidate gets a
       * non-sequitur (live Flipkart session: AI replied with medical
       * floater info to a base-counter ask). Stamp fresh-counter on
       * material change, mirroring the total-scope branch below. */
      const priorFixed = state.candidateTargetFixed;
      if (priorFixed == null || Math.abs(priorFixed - parsed.target) > 0.05) {
        next.lastCandidateCounterLpa = parsed.target;
        /* Mark this counter fixed-scoped so the auto-accept gate doesn't
         * compare a base ask against a total offer (deflect-loop fix). */
        next.lastCounterComponent = "fixed";
      }
    } else {
      /* Bug-report 12 (2026-05-14) — per-turn fresh-counter signal.
         Only count as a fresh counter when the parsed number is
         materially different from the prior sticky candidateTarget; a
         candidate re-asserting the same intake number doesn't unlock
         the auto-accept gate. */
      const prior = state.candidateTarget;
      if (prior == null || Math.abs(prior - parsed.target) > 0.05) {
        next.lastCandidateCounterLpa = parsed.target;
        next.lastCounterComponent = "total";
      }
      next.candidateTarget = parsed.target;
      /* S48-B6 (2026-07-24) — track whether the most recent total-target
       * was a range upper bound or a specific point. The range-to-point
       * probe in the planner reads this to suppress re-probing once the
       * candidate has already given a point. */
      next.candidateTargetWasRange = parsed.targetAsRange;
      if (next.firstAnchoredTarget == null) next.firstAnchoredTarget = parsed.target;
      /* S42-B8 / S43-B7 — counter stated vs a live offer. Only set when the
       * recruiter has already put a number on the table. Discovery-phase targets
       * (stated before any offer) must NOT populate this slot — they shouldn't
       * appear as "YOUR ASK" in the report when the candidate never explicitly
       * countered against the offer. First-wins (monotone null→set). */
      /* S54-B8 (2026-07-24) — when parseCandidateAnswer returns parsed.target=null
       * but parsed.currentCtc is ABOVE the standing offer, the number was almost
       * certainly a counter mis-classified as CTC (e.g. due to a prior CTC re-ask
       * in state.lastAiText confusing the parser). A genuine CTC disclosure cannot
       * logically exceed the recruiter's live offer; anything above the offer is
       * unambiguously a counter-ask, so treat it as such when parsed.target is null. */
      const _counterSignal =
        parsed.target ??
        (parsed.currentCtc != null && parsed.currentCtc > (state.highestOfferMade ?? 0)
          ? parsed.currentCtc
          : null);
      if (next.firstCounterVsOffer == null && (state.highestOfferMade ?? 0) > 0) {
        next.firstCounterVsOffer = _counterSignal;
      }
      /* S43-B8 — last-wins complement: always overwrite so the report shows
       * the FINAL explicit counter vs the offer, not just the first one. */
      if ((state.highestOfferMade ?? 0) > 0) {
        next.lastCounterVsOffer = _counterSignal;
      }
      /* Sprint B.3 (2026-05-15) — in-hand framing disambiguation, scoped to
       * the TOTAL target it describes. If this utterance frames the number
       * as in-hand / take-home, flag it and back-compute a CTC-equivalent
       * so downstream consumers (statedTotalTargetCtcLpa, totalScopedCounter)
       * can switch frames. Class-A in-hand-counter fix (2026-06-15): recompute
       * EVERY time the total target is (re)stated — set when in-hand framed,
       * CLEAR otherwise — so a later total-framed counter can't inherit a stale
       * take-home→CTC equivalent and false-accept ~13-25% low. The raw number
       * stays in candidateTarget (candidate's units) so existing counter math
       * doesn't silently shift frame; only the derived equivalent moves. */
      if (detectInHandFraming(answer)) {
        next.candidateTargetIsInHand = true;
        next.candidateTargetCtcEquivalentLpa = backComputeCtcFromInHand(parsed.target);
      } else {
        next.candidateTargetIsInHand = false;
        next.candidateTargetCtcEquivalentLpa = null;
      }
    }
  }
  /* S21-B3: guard against the classifier mis-binding the counter-ask as
   * currentCtc. Pattern: CTC established (28), target established (36),
   * candidate re-mentions 36, "currently looking for 36" → parsed.currentCtc=36
   * overwrites the real 28 → hike tile reads −17% from ₹36 on an accepted deal.
   * The classifier's own disambiguation already drops target==currentCtc WITHIN
   * one utterance; here we apply the symmetric protection ACROSS turns: if an
   * already-established CTC (state slot is set) would be overwritten with the
   * value that IS the established target, it's almost certainly the counter-ask
   * being mis-classified — skip the overwrite. Safe guards:
   *   - only fires when CTC was already established (hasEstablishedCTC), so a
   *     first-turn disclosure that happens to equal an already-stated target is
   *     allowed through;
   *   - uses the pre-update target (next or state) to catch both the same-turn
   *     and cross-turn shapes;
   *   - tolerance ±0.05 LPA to absorb rounding artefacts.
   * S71-B2 (2026-07-25): isLikelyCounterAsk is hoisted above the
   * if-block so the compensation model (which runs unconditionally) can
   * suppress the counter-ask from being fed as a "new CTC observation"
   * to observationsFromParsed. Without this guard the comp model sees the
   * ₹48L counter-ask as a ₹28L→₹48L drift on the total axis, fires a
   * contradiction, and the planner emits "you said ₹28 earlier, now ₹48
   * — which one?" to the candidate — incorrectly treating their counter
   * as a conflicting CTC disclosure. */
  const _ctcOfferOnTable = (next.highestOfferMade ?? state.highestOfferMade ?? 0) > 0;
  const _ctcHasEstablished = state.candidateCurrentCtc != null;
  const isLikelyCounterAsk = parsed.currentCtc != null
    && _ctcHasEstablished && _ctcOfferOnTable
    && parsed.currentCtc > (next.highestOfferMade ?? state.highestOfferMade ?? 0);
  if (parsed.currentCtc != null) {
    const establishedTarget = next.candidateTarget ?? state.candidateTarget;
    const hasEstablishedCTC = _ctcHasEstablished;
    const ctcEqualsTarget = establishedTarget != null && Math.abs(parsed.currentCtc - establishedTarget) < 0.05;
    /* S55-B8 (2026-07-24): once a CTC is already established AND an offer is
     * on the table, any candidate number ABOVE the offer is a counter-ask, not
     * a CTC re-disclosure. Guard: only blocks when hasEstablishedCTC is true —
     * a first-time CTC disclosure that happens to exceed the standing offer
     * (e.g. ₹45 CTC > ₹41 offer) must still update the slot. Without the
     * hasEstablishedCTC guard the ctcAwareBandLift invariant breaks.
     * (isLikelyCounterAsk is hoisted above — see S71-B2 note.) */
    if (!(hasEstablishedCTC && ctcEqualsTarget) && !isLikelyCounterAsk) {
      next.candidateCurrentCtc = parsed.currentCtc;
    }
    /* S52-WL-B9 (2026-07-24) — rescue counter mis-classified as CTC.
     * S55-B8 blocks the CTC-slot overwrite when isLikelyCounterAsk is true,
     * but that only prevents corruption of candidateCurrentCtc. The counter
     * signal is still silently dropped: lastCandidateCounterLpa / first/last
     * CounterVsOffer stay null → totalScopedCounter returns null → the
     * conditional close gate falls through to closeAt=offer (standing price)
     * and fires a false close ("we're in the same range") even when the
     * candidate explicitly countered. Root cause: when parseCandidateAnswer
     * returns parsed.target=null (recruiter's CTC re-ask confused the parser),
     * the parsed.target != null block (L5115) is entirely skipped, so no
     * counter stamp fires. Rescue: when isLikelyCounterAsk — a number above
     * the live offer classified as CTC — route it to counter slots so the
     * planner sees the real ask and the report records the counter. */
    if (isLikelyCounterAsk && parsed.target == null) {
      const rescued = parsed.currentCtc;
      const priorTarget = next.candidateTarget ?? state.candidateTarget;
      if (priorTarget == null || Math.abs(priorTarget - rescued) > 0.05) {
        next.lastCandidateCounterLpa = rescued;
        next.lastCounterComponent = "total";
      }
      if (next.firstCounterVsOffer == null) {
        next.firstCounterVsOffer = rescued;
      }
      next.lastCounterVsOffer = rescued;
    }
  }
  if (parsed.competing != null) next.competingOffer = parsed.competing;
  if (parsed.targetAsRange) next.candidateAskedAsRange = true;

  /* PR-2 (PDF #28) — dual-write parsed facts onto the conversation
   * ledger. Existing slot writes above continue as the live source of
   * truth; the ledger accumulates an append-only audit trail with
   * first-wins semantics so PR-3/4 can migrate readers off the slots.
   * Read paths still use the slots — zero behavior change this PR. */
  if (next.ledger) {
    let led = next.ledger;
    if (parsed.target != null) {
      led = recordFact(led, "target-ctc", parsed.target, "main-parser", next.turnIndex, answer);
    }
    if (parsed.currentCtc != null) {
      led = recordFact(led, "current-ctc", parsed.currentCtc, "main-parser", next.turnIndex, answer);
    }
    if (parsed.competing != null) {
      led = recordFact(led, "competing-offer", parsed.competing, "main-parser", next.turnIndex, answer);
    }
    /* QUALITY-3 (EVAL-6) — extend dual-write to component-* FactKinds.
     * Previously the kernel updated slot mirrors (componentBase/Variable/
     * Equity) but never wrote the components to the ledger, so getFact()
     * returned null for any caller that consulted the read-layer
     * contract. The `expectedDisclosures` rubric criterion surfaced this
     * gap on `long-horizon-trajectory` and `variable-as-percentage`. */
    if (parsed.componentBreakdown.base != null) {
      led = recordFact(led, "component-base", parsed.componentBreakdown.base, "main-parser", next.turnIndex, answer);
    }
    if (parsed.componentBreakdown.variable != null) {
      led = recordFact(led, "component-variable", parsed.componentBreakdown.variable, "main-parser", next.turnIndex, answer);
    }
    if (parsed.componentBreakdown.equity != null) {
      led = recordFact(led, "component-equity", parsed.componentBreakdown.equity, "main-parser", next.turnIndex, answer);
    }
    /* AUDIT-2 (2026-06-08) — extend dual-write to notice-period-days.
     * Previously only the disclosure-tracker fallback wrote notice to
     * the ledger; the main parser produced parsed.noticeJoining.
     * noticePeriodDays but never recorded it. The expectedDisclosures
     * audit on 10 high-confidence scenarios surfaced this on 8/10 —
     * exact same shape as QUALITY-3 with components. */
    if (parsed.noticeJoining.noticePeriodDays != null) {
      led = recordFact(led, "notice-period-days", parsed.noticeJoining.noticePeriodDays, "main-parser", next.turnIndex, answer);
    }
    next.ledger = led;
  }

  /* Memory feature (2026-05-29) — record claims on first mention; on
   * subsequent mentions detect contradictions outside ±10%. The kernel
   * stamps `lastContradiction` once per turn; the planner reads it to
   * fire `contradiction-callout` next. applyAiMove clears the signal
   * so a single contradiction doesn't re-fire forever. */
  const claimsBefore: UserClaims = state.userClaims ?? {};
  const claimsNext: UserClaims = { ...claimsBefore };
  let contradiction: ContradictionSignal | null = state.lastContradiction ?? null;
  const NUMERIC_TOLERANCE = 0.10;
  const recordNumeric = (
    topic: "currentCtc" | "expectedCtc" | "noticePeriod",
    parsedValue: number | null | undefined,
    opts?: { selfRevisable?: boolean },
  ): void => {
    if (parsedValue == null || !Number.isFinite(parsedValue)) return;
    const prior = claimsBefore[topic];
    if (prior == null) {
      claimsNext[topic] = { value: parsedValue, firstSeenTurn: state.turnIndex };
      return;
    }
    const drift = Math.abs(parsedValue - prior.value) / Math.max(Math.abs(prior.value), 1e-9);
    if (drift > NUMERIC_TOLERANCE && contradiction == null) {
      /* #126 (2026-06-21) — the candidate's OWN ask (expectedCtc / target)
       * is theirs to revise mid-negotiation. Lowering it ("I wanted 50, but
       * if you can do 38 I'm in") is a concession; raising it is re-anchoring.
       * Neither is a factual inconsistency, so the "which one should I take
       * to the panel?" contradiction-callout — designed for immutable FACTS
       * the candidate can't legitimately restate (current CTC, a competing
       * offer's amount) — must NOT fire here. Track the latest stated ask
       * (firstSeen pinned) and skip the callout. Before this guard a normal
       * self-lowered ask false-fired a contradiction and derailed the close. */
      if (opts?.selfRevisable) {
        claimsNext[topic] = { value: parsedValue, firstSeenTurn: prior.firstSeenTurn };
        return;
      }
      contradiction = {
        topic,
        oldValue: prior.value,
        newValue: parsedValue,
        firstSeenTurn: prior.firstSeenTurn,
      };
    }
  };
  /* Scope-typed current-comp folding (architecture upgrade, 2026-06-17).
   * The flat `recordNumeric("currentCtc", …)` path is RETIRED for current
   * pay: it compared base/variable component figures against the single
   * stored total and fired a spurious contradiction on a consistent
   * breakdown ("36 base + 12 variable = 48 total"), looping the bot into a
   * forced stalemate. We now fold the turn's parsed figures onto distinct
   * axes (total / fixed / variable / equity) via the compensation model. A
   * component can never contradict the total — only a genuine SAME-axis
   * total move (48 → 60) fires. The total-axis contradiction is mapped back
   * to the historical ContradictionSignal topic "currentCtc" so the planner
   * and prose paths are unchanged. We still mirror the model's total into
   * claimsNext.currentCtc so every downstream reader of userClaims keeps
   * working. See _compensation-model.ts. */
  {
    const compBefore: CandidateComp = state.candidateComp ?? { ...EMPTY_COMP };
    /* S71-B2: suppress counter-ask from comp model. When isLikelyCounterAsk
     * is true the number is a counter, not a CTC re-disclosure; feeding it
     * to observationsFromParsed as a total-axis observation would trigger a
     * spurious contradiction signal (old=28, new=48) and the planner would
     * ask "you said ₹28 earlier, now I'm hearing ₹48 — which one?" */
    const observations = observationsFromParsed(
      {
        currentCtc: isLikelyCounterAsk ? null : parsed.currentCtc,
        componentBase: parsed.componentBreakdown.base,
        componentVariable: parsed.componentBreakdown.variable,
        componentEquity: parsed.componentBreakdown.equity,
      },
      state.turnIndex,
      (answer || "").toString(),
    );
    const folded = applyObservations(compBefore, observations);
    next.candidateComp = folded.comp;
    // Mirror the reconciled headline total into the legacy flat claim so
    // downstream consumers (reports, ledgers, summaries) keep reading it.
    const total = folded.comp.total;
    if (total != null) {
      const priorFlat = claimsBefore.currentCtc;
      if (priorFlat == null) {
        claimsNext.currentCtc = { value: total.value, firstSeenTurn: total.firstSeenTurn };
      } else {
        /* Pin to the first-seen value within tolerance. The compensation
           model folds small same-axis drift (e.g. 18 → 19, ~5.5%) into the
           comp total WITHOUT raising a contradiction, but the legacy flat
           claim must stay sticky like recordNumeric does — overwriting it
           here made userClaims.currentCtc.value silently track the latest
           rounded figure, which the prose/report then surfaced as if the
           candidate had restated their pay. Only a genuine same-axis move
           past tolerance (which also raises the contradiction below)
           advances the mirrored value. */
        const drift =
          Math.abs(total.value - priorFlat.value) /
          Math.max(Math.abs(priorFlat.value), 1e-9);
        claimsNext.currentCtc = {
          value: drift > NUMERIC_TOLERANCE ? total.value : priorFlat.value,
          firstSeenTurn: priorFlat.firstSeenTurn,
        };
      }
    }
    // A genuine same-axis total contradiction maps to the historical topic.
    if (folded.contradiction != null && folded.contradiction.axis === "total" && contradiction == null) {
      contradiction = {
        topic: "currentCtc",
        oldValue: folded.contradiction.oldValue,
        newValue: folded.contradiction.newValue,
        firstSeenTurn: folded.contradiction.firstSeenTurn,
      };
    }
  }
  /* Audit Fix #2 contract — a "fixed"-scoped target ("₹26 LPA fixed at
   * minimum") refers to a component, not the total package; routing it
   * to candidateTargetFixed (above) means it must NOT be compared
   * against the prior total-package expectedCtc claim or the
   * contradiction detector spuriously fires. Only total-scoped targets
   * feed the expectedCtc ledger. */
  if (parsed.targetComponent !== "fixed") {
    recordNumeric("expectedCtc", parsed.target, { selfRevisable: true });
  }
  recordNumeric("noticePeriod", parsed.noticeJoining.noticePeriodDays);

  /* Competing offer — composite (company + amount). Contradict when the
   * company matches but the amount drifts beyond ±10%, OR when the
   * company changes and an amount is given (we treat that as a new
   * claim — last-stated wins for company tracking, no callout). */
  const competingCompany = parsed.competingOfferDetail.company;
  const competingAmount = parsed.competingOfferDetail.amount ?? parsed.competing ?? null;
  if (competingCompany != null && competingAmount != null && Number.isFinite(competingAmount)) {
    const prior = claimsBefore.competingOffer;
    if (prior == null) {
      claimsNext.competingOffer = {
        value: { company: competingCompany, amount: competingAmount },
        firstSeenTurn: state.turnIndex,
      };
    } else if (prior.value.company.toLowerCase() === competingCompany.toLowerCase()) {
      const drift = Math.abs(competingAmount - prior.value.amount) /
        Math.max(Math.abs(prior.value.amount), 1e-9);
      if (drift > NUMERIC_TOLERANCE && contradiction == null) {
        contradiction = {
          topic: "competingOffer",
          oldValue: prior.value.amount,
          newValue: competingAmount,
          firstSeenTurn: prior.firstSeenTurn,
          oldLabel: prior.value.company,
          newLabel: competingCompany,
        };
      }
    }
  }

  /* currentRole tracking is reserved on the type; a parser hook for
   * role-restatement claims will be wired in alongside the role-mismatch
   * detector. For now the field is populated only via direct state
   * seeding (e.g. tests / replay fixtures). */

  next.userClaims = claimsNext;
  next.lastContradiction = contradiction;

  /* Recruiter-power-dynamics feature (2026-05-29) — mid-session
   * competing-process disclosure detector. Regex sweep on the raw
   * candidate utterance. If matched AND the signal hasn't already been
   * flipped, set powerSignals.candidateHasCompetingProcess = true and
   * recompute recruiterPower. Pure / idempotent: a second match no-ops. */
  {
    const a = (answer || "").toString();
    const COMPETING_PROCESS_RES: RegExp[] = [
      /another offer (in hand|already)/i,
      /in (the )?final round(s)? at /i,
      /competing offer/i,
      /I have an offer from /i,
      /interviewing (with|at) (next week|tomorrow)/i,
    ];
    const priorSignals = next.powerSignals ?? {};
    if (priorSignals.candidateHasCompetingProcess !== true) {
      const hit = COMPETING_PROCESS_RES.some((re) => re.test(a));
      if (hit) {
        const updated: PowerSignals = {
          ...priorSignals,
          candidateHasCompetingProcess: true,
        };
        next.powerSignals = updated;
        next.recruiterPower = computeRecruiterPower(updated);
      }
    }
  }

  /* Paraphrase-loop feature (2026-05-29) — confirmation-gate detection.
   * If the LAST AI turn shipped a paraphrase-recap (state.paraphraseFired
   * went true on the prior applyAiMove) AND the candidate just replied
   * with a "no, actually X" pattern, log a correction event so subsequent
   * planner cascades can reference it as priorContext. The simple
   * yes/right/correct reply is a no-op (no behavioral change). */
  if (state.paraphraseFired === true) {
    const a = (answer || "").trim();
    if (a) {
      const NEG_CORRECTION_RE =
        /\b(?:no|nope|actually|correction|to clarify|wait,?\s+)\b[^.!?]{0,200}/i;
      const lowered = a.toLowerCase();
      const isAffirm = /^(?:yes|yeah|right|correct|that'?s right|got it|sure)\b/.test(lowered);
      if (!isAffirm && NEG_CORRECTION_RE.test(a)) {
        const corrections = [...(state.paraphraseCorrections ?? [])];
        /* Lightweight topic detection — surface the dominant noun. */
        let topic = "general";
        if (/\bnotice\b/i.test(a)) topic = "noticePeriod";
        else if (/\bjoining|join\b/i.test(a)) topic = "joining";
        else if (/\bbase|expected|ask\b/i.test(a)) topic = "expectedCtc";
        else if (/\bcurrent\b/i.test(a)) topic = "currentCtc";
        else if (/\bcompeting|offer\b/i.test(a)) topic = "competingOffer";
        corrections.push({
          turn: state.turnIndex,
          topic,
          correction: a.slice(0, 240),
        });
        next.paraphraseCorrections = corrections;
      }
    }
  }

  /* Calibrated-surprise lowball feature (2026-05-29) — branch detection.
   * If the PRIOR turn shipped the probe (state.calibratedSurpriseContext
   * is populated), classify the candidate's reply into one of:
   *   A — double-down: yes/comfortable/no number revision  → acceptedLowball
   *   B — revise up:   utterance contains a NEW higher number → wasn't lowballing
   *   C — ask why:     "why / what's the band / what should it be"
   * Each branch updates the affinity ledger; A also stamps acceptedLowball.
   * Context is cleared so the classification only fires once per probe.
   */
  if (state.calibratedSurpriseContext != null) {
    const ctx = state.calibratedSurpriseContext;
    const raw = (answer || "").trim();
    const lowered = raw.toLowerCase();
    /* Branch C — ask why / band probe. Check FIRST so questions don't
     * get mis-classified as a double-down. */
    const ASK_WHY_RE =
      /\b(?:why\s+(?:do\s+you|would\s+you|did\s+you)|what(?:'?s|\s+is)\s+(?:the|your)?\s*band|what\s+should\s+it\s+be|how\s+(?:come|did\s+you)|on\s+what\s+basis|what(?:'?s|\s+is)\s+the\s+(?:floor|range|benchmark))\b/i;
    /* Numeric-revision detection: look for an explicit revision phrase
     * OR a number that is materially HIGHER than the prior anchor. */
    const REVISION_HINT_RE =
      /\b(?:actually|on reflection|revise|let me revise|reconsider|raise|bump|change(?:d)?\s+(?:my\s+)?(?:mind|number)|update(?:d)?\s+(?:my\s+)?(?:ask|number))\b/i;
    /* Cheap LPA-shaped number scan — anything plausibly above prior anchor. */
    const numRe = /(\d+(?:\.\d+)?)\s*(?:l|lpa|lakh|lakhs|cr|crore)?/gi;
    let revisedAnchor: number | null = null;
    let m: RegExpExecArray | null;
    while ((m = numRe.exec(lowered)) !== null) {
      const n = Number(m[1]);
      if (!Number.isFinite(n)) continue;
      /* Treat 5..200 as a plausible LPA value. Bigger numbers (like
       * "60000 USD" or "180000") are not interpreted here. */
      if (n > ctx.candidateAnchor && n >= 5 && n <= 200) {
        if (revisedAnchor == null || n > revisedAnchor) revisedAnchor = n;
      }
    }
    const isAskWhy = ASK_WHY_RE.test(raw);
    const isRevise =
      revisedAnchor != null ||
      (REVISION_HINT_RE.test(raw) && /\d/.test(raw));
    const ledger = [...(next.affinityLedger ?? state.affinityLedger ?? [])];
    let nextAffinity = next.recruiterAffinity ?? state.recruiterAffinity ?? 0;
    if (isAskWhy) {
      /* Branch C — no flag change, no affinity delta. */
    } else if (isRevise && revisedAnchor != null) {
      /* Branch B — transparency reward. */
      ledger.push({ turn: state.turnIndex, delta: 1, reason: "transparency" });
      nextAffinity = Math.min(AFFINITY_MAX, nextAffinity + 1);
      /* Update userClaims.expectedCtc to the revised number so the rest
       * of the cascade engages with the new anchor. */
      const claims = { ...(next.userClaims ?? state.userClaims ?? {}) };
      claims.expectedCtc = {
        value: revisedAnchor,
        firstSeenTurn:
          claims.expectedCtc?.firstSeenTurn ?? state.turnIndex,
      };
      next.userClaims = claims;
      next.candidateTarget = revisedAnchor;
    } else {
      /* Branch A (default) — double-down. */
      next.acceptedLowball = true;
      ledger.push({ turn: state.turnIndex, delta: -1, reason: "wasted-time" });
      nextAffinity = Math.max(AFFINITY_MIN, nextAffinity - 1);
    }
    next.affinityLedger = ledger;
    next.recruiterAffinity = nextAffinity;
    /* Clear the context — branch classification is one-shot. */
    next.calibratedSurpriseContext = null;
  }

  /* Component breakdown — merge non-null fields into sticky state.
     Last-stated wins per component; previously-stated components
     persist when the current turn names only one. */
  if (parsed.componentBreakdown.hasAny) {
    next.candidateComponentBreakdown = mergeBreakdown(
      state.candidateComponentBreakdown,
      parsed.componentBreakdown,
    );

    /* PDF#18 follow-up P3 (2026-05-15) — current-vs-expected fixed/
     * variable split disambiguation. When the candidate's utterance
     * carries a fixed+variable breakdown AND the bot's previous
     * question was tagged with `lastDisclosureSubject`, route the
     * split to the right flag:
     *   subject='current'  → currentCtcFixedVariableSplitDisclosed=true
     *   subject='expected' → expectedCtcFixedVariableSplitDisclosed=true
     * The legacy umbrella `fixedVariableSplitAnswered` flag is also
     * monotone-true so legacy checklists clear. Monotone-up. */
    /* BUG-3 follow-up (PDF#24, 2026-05-16): a percentage-shaped split
     * ("80% fixed, 20% variable") is also a valid disclosure of the
     * fitment structure — accept either absolute OR percent shape so
     * the subject-specific flag flips for percent-only candidates too.
     * Without this, the umbrella `fixedVariableSplitAnswered` was being
     * set (via syncChecklistFromParsedFacts) but the subject-specific
     * `currentCtcFixedVariableSplitDisclosed` /
     * `expectedCtcFixedVariableSplitDisclosed` stayed false, leaving
     * downstream consumers that key on the subject-specific flag blind
     * to the percent-only disclosure. Monotone-up. */
    /* PDF#34 Fix 1 (2026-05-18) — variableInferred provenance gate on
     * the discovery checklist.
     *
     * PDF#33 Move B1 stamped `variableInferred=true` on the breakdown
     * when `variable` arrived via the total−base complement (the
     * candidate stated total + base but not variable). The
     * nextComponentProbe consumer was taught to treat the inferred
     * value as needs-confirmation. But this checklist setter was NOT —
     * an inferred variable would still flip
     * `currentCtcFixedVariableSplitDisclosed=true`, advancing the
     * discovery sequence past the split slot without the candidate
     * ever confirming the number.
     *
     * In the PDF#34 Meesho/Prita repro: total=24, base=22 → variable
     * inferred=2. Checklist flag flipped → sequence advanced → planner
     * jumped to vesting/esop before the variable was ratified. Move
     * B1's component-probe path SHOULD have caught it, but the
     * discovery cascade was already racing ahead.
     *
     * Fix: gate `splitHasBoth` on the variable being EXPLICITLY
     * disclosed, not inferred. The percent-shape path is unaffected
     * (percentages are always explicit). */
    /* PDF#35 Move 5 (2026-05-18) — variableInferred unambiguous-math
     * refinement. PDF#34 Fix 1's gate was too coarse: it forced
     * `variableInferred=true` on every total−base inference, including
     * cases where the math is completely unambiguous (total=24, base=22
     * → variable=2 with no plausible alternative). The kernel was then
     * re-asking the variable even after the candidate had clearly
     * stated total + base, producing a perceived loop.
     *
     * Refinement: when variable came via the total−base complement AND
     * the resulting ratio variable/total is in [0.01, 0.25] (small
     * residual = credible variable component, not a parser slip) AND
     * both total and base were explicitly stated in the same utterance,
     * treat the inference as unambiguous — drop the inferred flag for
     * the checklist gate so the split slot advances naturally. Outside
     * that range (e.g. base=11, total=24 → variable=13, ratio≈0.54)
     * keep variableInferred=true: a 54% variable share is implausible
     * enough that we should re-confirm rather than silently advance.
     *
     * "Explicitly stated in the same utterance" is signalled here by
     * `currentCtc != null` (this turn parsed a total) AND `base != null`
     * (this turn parsed a base). The complement is derived inside
     * extractComponentBreakdown, so when both are present this turn,
     * the inference is from THIS utterance, not stale state. */
    const variableCameFromInference =
      parsed.componentBreakdown.variableInferred === true;
    let variableUnambiguous = false;
    if (
      variableCameFromInference &&
      parsed.componentBreakdown.base != null &&
      parsed.componentBreakdown.variable != null &&
      parsed.currentCtc != null &&
      parsed.currentCtc > 0
    ) {
      const ratio = parsed.componentBreakdown.variable / parsed.currentCtc;
      if (ratio >= 0.01 && ratio <= 0.25) {
        variableUnambiguous = true;
      }
    }
    /* PDF#36 Fix B2 (2026-05-19) — cross-turn unambiguous-math gate.
     * The same-turn gate above only fires when base + total both arrive
     * in a single utterance. Real candidates often disclose total on
     * one turn and base on another ("My CTC is 24 LPA" → next turn:
     * "base is 22 LPA"). Re-evaluate the unambiguous gate using prior
     * sticky state values, ratio window unchanged.
     *
     * We require:
     *   - variable came from inference THIS turn (variableInferred true)
     *   - we now have BOTH a base value (parsed this turn OR sticky)
     *     and a total (parsed this turn OR sticky)
     *   - both explicit (not previously inferred — base has no inferred
     *     flag in the schema, so its presence implies explicit; total
     *     never carries inferred provenance)
     *   - ratio of variable/total is in [0.01, 0.25]. */
    if (!variableUnambiguous && variableCameFromInference) {
      const baseCross =
        parsed.componentBreakdown.base ??
        state.candidateComponentBreakdown?.base ??
        null;
      const totalCross =
        parsed.currentCtc ??
        state.candidateCurrentCtc ??
        null;
      const variableNow = parsed.componentBreakdown.variable;
      if (
        baseCross != null &&
        totalCross != null &&
        totalCross > 0 &&
        variableNow != null
      ) {
        const ratio = variableNow / totalCross;
        if (ratio >= 0.01 && ratio <= 0.25) {
          variableUnambiguous = true;
        }
      }
    }
    const variableExplicitlyDisclosed =
      parsed.componentBreakdown.variable != null &&
      (parsed.componentBreakdown.variableInferred !== true || variableUnambiguous);
    const splitHasBoth =
      (parsed.componentBreakdown.base != null &&
        variableExplicitlyDisclosed) ||
      (parsed.componentBreakdown.basePercent != null &&
        parsed.componentBreakdown.variablePercent != null);
    /* When the math was unambiguous, also clear the inferred flag on
     * the breakdown so downstream consumers (component-probe path)
     * treat the variable as settled. */
    if (variableUnambiguous && next.candidateComponentBreakdown) {
      next.candidateComponentBreakdown = {
        ...next.candidateComponentBreakdown,
        variableInferred: false,
      };
    }
    if (splitHasBoth && state.discoveryChecklist != null) {
      const subject = state.lastDisclosureSubject ?? null;
      const checklist = { ...state.discoveryChecklist };
      checklist.fixedVariableSplitAnswered = true;
      if (subject === "current") {
        checklist.currentCtcFixedVariableSplitDisclosed = true;
      } else if (subject === "expected") {
        checklist.expectedCtcFixedVariableSplitDisclosed = true;
      } else {
        /* No subject tag (legacy session / split offered unprompted):
         * fall back to the legacy umbrella flag only. Conservative —
         * doesn't accidentally tag a split against the wrong CTC. */
      }
      next.discoveryChecklist = checklist;
    }
  }

  /* Phase 12c (2026-05-13) — structural hard-band-cap detection. If
   * the candidate's stated base floor exceeds the band's
   * baseStretch, the cap is structural (not just band): no amount
   * of total-CTC stretching satisfies the constraint, because base
   * is the binding component. Flip hardBandCap so the move-picker
   * redirects all concession energy to non-cash levers instead of
   * inching the total toward maxStretch on impossible base.
   *
   * BUG-3 follow-up (PDF#24, 2026-05-16): when the candidate stated
   * the split as a percentage ("80% fixed, 20% variable") but no
   * absolute base was parsed, derive base = basePercent% of the
   * stated current CTC. That lets the cap detection work for
   * percent-only disclosures, broadly aligned with how a recruiter
   * would mentally derive the fixed component from a known total
   * fitment and a stated split. Last-stated wins: absolute base
   * (when present) is authoritative; the derived value only fires
   * when the absolute is missing. */
  let candidateStatedBaseLpa: number | null =
    next.candidateComponentBreakdown.base ?? null;
  if (
    candidateStatedBaseLpa == null &&
    next.candidateComponentBreakdown.basePercent != null &&
    next.candidateCurrentCtc != null
  ) {
    candidateStatedBaseLpa =
      (next.candidateComponentBreakdown.basePercent / 100) *
      next.candidateCurrentCtc;
  }
  if (
    candidateStatedBaseLpa != null &&
    state.band.baseStretch != null &&
    candidateStatedBaseLpa > state.band.baseStretch
  ) {
    next.hardBandCap = true;
  }

  /* Phase 11 — hike% is recomputed each turn from the LATEST
     target+currentCtc (after current-turn binding). Rationale is
     sticky: last-stated wins, prior preserved when current turn
     mentions no rationale cue. */
  /* Class-A (2026-06-15) — hike% off the in-hand-adjusted total. A candidate
   * who asks for "₹16L in-hand" is asking a ~₹18.4L CTC; computing the hike
   * off the raw 16 understated their ask. statedTotalTargetCtcLpa handles the
   * conversion and returns null for fixed-only asks (no total → no hike). */
  next.hikePercent = computeHikePercent(statedTotalTargetCtcLpa(next), next.candidateCurrentCtc);
  if (parsed.rationale) next.rationale = parsed.rationale;

  /* Phase 13/14/15/16 — merge non-empty parses into sticky state.
     Each merger preserves prior fields when the current turn doesn't
     mention them; non-null new values overwrite. Booleans are
     monotone-up (once requested/refused, stays). */
  if (parsed.noticeJoining.hasAny) {
    next.noticeJoining = mergeNoticeJoining(state.noticeJoining, parsed.noticeJoining);
  }
  if (parsed.equityVesting.hasAny) {
    next.equityVesting = mergeEquityVesting(state.equityVesting, parsed.equityVesting);
  }
  if (parsed.locationMode.hasAny) {
    next.locationMode = mergeLocationMode(state.locationMode, parsed.locationMode);
  }
  if (parsed.competingOfferDetail.hasAny) {
    next.competingOfferDetail = mergeCompetingOfferDetail(
      state.competingOfferDetail,
      parsed.competingOfferDetail,
    );
  }
  /* OA-B65 — competing-offer REVOCATION. state.competingOffer is a
   * monotone-sticky scalar (set at the parsed.competing site, never
   * cleared) and mergeCompetingOfferDetail folds onHold/amount monotone-up,
   * so "actually that offer fell through" would otherwise leave the
   * candidate's leverage permanently on record. A revoked offer carries
   * ZERO leverage — distinct from onHold (delayed but real). Clear the
   * numeric scalar, blank the detail's amount, and drop the userClaims
   * entry so no downstream reader (planner leverage gate, report) still
   * sees a live alternative. Single source of truth: isCompetingOfferRevoked.
   * Gated on an offer actually being on record so a stray match on a turn
   * with no prior offer is a harmless no-op. */
  if (
    isCompetingOfferRevoked(answer) &&
    (state.competingOffer != null ||
      state.competingOfferDetail?.hasAny ||
      next.competingOfferDetail?.hasAny)
  ) {
    next.competingOffer = null;
    const priorDetail = next.competingOfferDetail ?? state.competingOfferDetail;
    if (priorDetail) {
      next.competingOfferDetail = {
        ...priorDetail,
        amount: null,
        onHold: true,
      };
    }
    if (next.userClaims?.competingOffer) {
      const cleared = { ...next.userClaims };
      delete cleared.competingOffer;
      next.userClaims = cleared;
    }
  }

  /* Phase 17 — fold deadline + profile + misc scalars. Same
   * last-stated-wins / monotone-up merge semantics. */
  if (parsed.decisionDeadline.hasAny) {
    next.decisionDeadline = mergeDecisionDeadline(state.decisionDeadline, parsed.decisionDeadline);
  }
  /* ResumeFactPack track (2026-05-16) — detect a stated current-company
   * affiliation from the candidate utterance. Last-stated-wins. The
   * credibility-probe lever in the planner reads this against
   * state.resumeFactPack to flag mismatches. */
  const statedCompany = detectStatedCurrentCompany(answer);
  if (statedCompany) {
    next.candidateStatedCurrentCompany = statedCompany;
    /* When the resume confirms the stated affiliation, log the
     * avoidance so the decision-log shows the planner consciously
     * skipped the probe (rather than appearing to have forgotten). */
    if (next.resumeFactPack && resumeConfirmsCompany(next.resumeFactPack, statedCompany)) {
      next.credibilityProbeAvoidedAt = next.turnIndex;
    }
  }

  if (parsed.candidateProfile.hasAny) {
    next.candidateProfile = mergeCandidateProfile(state.candidateProfile, parsed.candidateProfile);
    /* ResumeFactPack track (2026-05-16) — record provenance="stated"
     * for any flag transitioning false→true via a candidate utterance.
     * Resume-seeded flags already carry provenance="resume" and are
     * left untouched (merge is monotone-up, so the resume fact stands). */
    const provenance: Record<string, "resume" | "stated"> = { ...(state.flagProvenance ?? {}) };
    const trackFlag = (key: "tenureSignal" | "peopleManagementClaimed" | "domesticTopMbaAnchor" | "mncExperience") => {
      if (provenance[key]) return; // resume seed wins; stated only confirms.
      const before = state.candidateProfile[key];
      const after = next.candidateProfile[key];
      if (!before && after) provenance[key] = "stated";
    };
    trackFlag("tenureSignal");
    trackFlag("peopleManagementClaimed");
    trackFlag("domesticTopMbaAnchor");
    trackFlag("mncExperience");
    next.flagProvenance = provenance;
  }

  /* Bug-report 11 (2026-05-14) — fresh-grad disclosure overrides the
   * resume-derived applicableYoe. If the candidate says "I'm pre-grad"
   * / "fresh graduate" / "still in college" mid-session, force
   * candidateApplicableYoe to 0 and flip freshGradDisclosed sticky-true.
   * The brief in _negotiate-turn-helpers surfaces this so the AI
   * acknowledges the disclosure rather than continuing to anchor on
   * the senior bucket inferred from the resume. */
  if (!state.freshGradDisclosed && detectFreshGradDisclosure(answer)) {
    next.freshGradDisclosed = true;
    next.candidateApplicableYoe = 0;
    /* Phase 30 (2026-05-14) — mid-session band rebase.
     *
     * Before this block we only zeroed candidateApplicableYoe, but the
     * band stored on state was already resolved at init from the
     * onboarding-time applicableYoe (e.g. resume said "5 yrs" → senior
     * band locked at ₹35-65L). With the disclosure, the AI should
     * anchor entry-tier numbers from the very next move.
     *
     * Re-resolve the band with applicableYoe=0 → "entry" tier. But never
     * lower the ceiling below what has ALREADY been offered: the close-
     * floor invariant says we cannot claw back commitments. If the AI
     * has already opened at ₹40L and only now learns the candidate is
     * pre-grad, the ceiling pins to the prior offer rather than
     * collapsing the floor underneath an active negotiation. */
    /* Fresher-flow extension (2026-05-14c): thread collegeTier +
     * internshipConversion from the (merged) candidate profile into the
     * rebase. Both are monotone-up, so reading from `next` (the about-to-
     * commit state) captures any disclosure made on this turn. */
    const rebasedRaw = resolveServerBand(state.role, state.company, "entry", 0, {
      collegeTier: next.candidateProfile?.collegeTier ?? null,
      internshipConversion: next.candidateProfile?.internshipConversion ?? false,
    });
    /* Audit follow-up (2026-05-21) — mid-session band re-clamp. The
     * INIT path runs clampBandToTierP50 to catch curator data that
     * would price the opener at >2× the tier P50 (Wipro UI/UX ₹27L
     * regression). The fresher-rebase path used to skip the clamp,
     * which meant a senior PD disclosing pre-grad at TCS could land on
     * a rebased band that still inherited a designer-family curator
     * outlier. Apply the same clamp here, gated by the highest-offer
     * floor below so we still never claw back an already-committed
     * number. */
    const rebasedTier = getCompanyTier(state.company);
    const rebasedClamp = clampBandToTierP50(rebasedRaw, state.role, rebasedTier);
    const rebased = rebasedClamp.clamped
      ? { ...rebasedRaw, ...rebasedClamp.band }
      : rebasedRaw;
    const floor = Math.max(state.highestOfferMade ?? 0, rebased.initialOffer);
    /* `band` is `readonly` on NegotiationState — by design it's an
     * init-time field. Phase 30 is the one explicit case where we
     * rebase, so we narrow the cast to this assignment rather than
     * dropping the readonly contract everywhere. */
    /* Fresher-flow extension (2026-05-14): preserve ALL fields from the
     * rebased band — including probationOffer / probationMonths /
     * isInternshipStipend / internshipMonths / baseStretch / variableMax
     * / minOffer. Previously this assignment listed only the 4 core
     * fields, silently dropping probation + stipend flags when a
     * mid-session rebase happened (e.g. senior PD → discloses pre-grad
     * at TCS). The candidate would see one framing pre-rebase and a
     * different one post-rebase. Spread first, then patch maxStretch
     * for the floor-protection invariant. */
    (next as { band: NegotiationBand }).band = {
      ...rebased,
      maxStretch: Math.max(rebased.maxStretch, floor),
    };
  }
  /* S4-B1 (2026-07-18) — CTC-aware upward band lift.
   * When the candidate discloses a current CTC that exceeds the resolved
   * band's ceiling there is NO win state: the best the recruiter can ever
   * offer is below what the candidate already earns. This happens because
   * salary data lags at the tail of experience ranges — a "senior" band
   * calibrated to 4-6yr earners under-calls an 8yr candidate's real market.
   *   initialOffer = ctc × 0.87  (realistic 13%-below-CTC lowball)
   *   maxStretch   = ctc × 1.12  (12% above CTC — a real win exists)
   * Guards: first disclosure only; only lifts, never compresses; never
   * below highestOfferMade (close-floor invariant).
   *
   * S22-B1 (2026-07-22) — also fire on material MID-SESSION CTC correction.
   * If the candidate initially discloses 28L (within band), the AI anchors;
   * then on a later turn they correct to 38L (above band.maxStretch). The
   * prior guard `state.candidateCurrentCtc == null` only covered first
   * disclosure, leaving the band un-lifted on the correction. Extend to also
   * fire when CTC changed materially upward (>10%) to a value above the
   * ceiling, AND no offer is yet on the table — re-inflating after an offer
   * is made would be confusing and violates the monotone-highestOfferMade
   * invariant. The `only-lifts` guard (liftedInitial/Max computed from ctc)
   * ensures we never compress the band on a correction downward.
   *
   * S12-B25 (2026-07-22) — cap the band lift when CTC grossly exceeds the
   * role's natural ceiling. Without a cap, a ₹50L CTC on a ₹35-40L role
   * inflated the band to ₹56L — unrealistic for that role/company. The lift
   * is now capped at 1.20× the original band ceiling (a modest stretch). For
   * small excesses (CTC within 20% of ceiling) ctc×1.12 wins; for large
   * excesses (CTC 25%+ above ceiling) the cap constrains the lift and the
   * session proceeds with the recruiter's highest realistic offer clearly
   * below the candidate's current CTC (the honest scenario). */
  const isMidSessionCtcLift =
    state.candidateCurrentCtc != null &&
    next.candidateCurrentCtc != null &&
    next.candidateCurrentCtc !== state.candidateCurrentCtc &&
    /* Material upward correction only (>10%) */
    next.candidateCurrentCtc > state.candidateCurrentCtc * 1.10 &&
    /* No offer on the table yet — re-inflating post-offer would be disruptive */
    (next.highestOfferMade ?? 0) === 0;
  if (
    (state.candidateCurrentCtc == null || isMidSessionCtcLift) &&
    next.candidateCurrentCtc != null &&
    next.candidateCurrentCtc > 0 &&
    next.candidateCurrentCtc > next.band.maxStretch
  ) {
    const ctc = next.candidateCurrentCtc;
    const curBand = next.band;
    /* Cap maxStretch at 1.30× original ceiling (S12-B25): prevents unrealistic
       band inflation when CTC grossly exceeds the role's natural pay range.
       1.30 is chosen to stay above the S22-B1 edge case (CTC=42 on a 35L band
       yields 42/35=1.20 ratio — a tighter cap would leave no win state). */
    const MAX_LIFT_RATIO = 1.30;
    const uncappedMax = Math.round(ctc * 1.12 * 10) / 10;
    const liftedMax = Math.min(uncappedMax, Math.round(curBand.maxStretch * MAX_LIFT_RATIO * 10) / 10);
    const rawInitial = Math.round(ctc * 0.87 * 10) / 10;
    const liftedInitial = Math.max(
      state.highestOfferMade ?? 0,
      /* Never let initialOffer exceed liftedMax — close-floor invariant. */
      Math.min(rawInitial, liftedMax - 0.5),
    );
    const rawWalkAway = Math.max(curBand.walkAway, Math.round(ctc * 0.80 * 10) / 10);
    (next as { band: NegotiationBand }).band = {
      ...curBand,
      initialOffer: liftedInitial,
      maxStretch: liftedMax,
      walkAway: Math.min(rawWalkAway, Math.max(liftedInitial - 0.5, 0.5)),
    };
  }
  if (parsed.miscSignals.hasAny) {
    next.miscSignals = mergeMiscSignals(state.miscSignals, parsed.miscSignals);
  }
  if (parsed.retentionCounter.hasAny) {
    next.retentionCounter = mergeRetentionCounter(state.retentionCounter, parsed.retentionCounter);
  }
  /* Phase 21 — pass recovery signals so posture booleans (desperate,
   * salary-only, avoids-anchor, personal-expense, offer-shopping) can
   * decay when the candidate course-corrects in a later turn. Other
   * red flags (badmouth, equity-as-cash, etc.) stay sticky. */
  const recovery = detectRecoverySignals(answer);
  const hasRecovery =
    recovery.desperateRecovered ||
    recovery.salaryOnlyRecovered ||
    recovery.avoidsAnchorRecovered ||
    recovery.personalExpenseRecovered ||
    recovery.offerShoppingRecovered;
  if (parsed.candidateStance.hasAny || hasRecovery) {
    next.candidateStance = mergeCandidateStance(
      state.candidateStance,
      parsed.candidateStance,
      recovery,
    );
  }
  /* Phase 21b recovery actualization (2026-05-13) — mark the AI's next
   * turn as eligible for a small un-stiffening boost in the move-picker.
   * Reset to false in applyAiMove so the bonus is one-shot, not sticky. */
  next.recentRecoveryActive = hasRecovery;

  /* Sprint A.4 (2026-05-15) — current-employer detection. Free-form
   * extraction from "currently at X", "working at X", "I'm with X",
   * "I work at X". Threaded into the counter-offer-risk detector so the
   * well-funded-employer signal can fire. Last-stated-wins; never
   * cleared by an utterance that doesn't mention an employer. */
  if (!next.currentEmployer) {
    const emp = detectCurrentEmployer(answer);
    if (emp) next.currentEmployer = emp;
  }

  /* F6 (2026-05-15) — probe-refusal counter. The move-picker's number-
   * discipline gate watches probeRefusalCount to escalate from "soft
   * probe" → "structural probe" → "close-walkaway" when the candidate
   * keeps dodging the expectation question. Without this counter the
   * gate is dead code — the move-picker can't see that the candidate
   * refused. Increment monotonically when the candidate utterance is a
   * recognisable refusal-of-disclosure. Pattern is intentionally narrow
   * (false positives here would burn the requisition). */
  if (
    /i'?d prefer not|not comfortable sharing|let'?s come back|prefer to keep that|won'?t disclose|skip that|pass on that|rather not say|that's personal/i.test(answer)
  ) {
    next.probeRefusalCount = (state.probeRefusalCount ?? 0) + 1;

    /* P4 (2026-05-15) — refusal-fallback wiring. When the candidate
     * has refused the same discovery item twice (probeRefusalCount
     * ≥ 2 with the same lastDiscoveryItemAsked), mark the item in
     * discoveryRefusedItems so getNextOrderedDiscoveryItem skips it
     * and moves to the next item in sequence. Threshold = 2 gives
     * the candidate one "soft probe" and one "structural probe"
     * before the kernel respects the boundary. */
    const askedItem = state.lastDiscoveryItemAsked;
    if (
      askedItem &&
      (next.probeRefusalCount ?? 0) >= 2
    ) {
      const prior = state.discoveryRefusedItems ?? {};
      next.discoveryRefusedItems = { ...prior, [askedItem]: true };
    }
  }

  /* Tier-2 ship wiring (2026-05-15) — non-salary constraints extraction.
   * Detector is already shipped and the brief-injection site already
   * reads `state.nonSalaryConstraints`; the only missing piece was the
   * extractor call. Merge monotone-up so a constraint disclosed earlier
   * survives a later turn that doesn't restate it. */
  {
    const fresh = extractNonSalaryConstraints(answer);
    if (Object.keys(fresh).length > 0) {
      next.nonSalaryConstraints = mergeNonSalaryConstraints(
        state.nonSalaryConstraints,
        fresh,
      );
    }
  }

  /* Phase 24c — merge sales / contract comp-structure detectors.
   * Only merge when the new utterance carried a signal; otherwise
   * leave prior state intact (we never blank out earlier disclosure). */
  const freshSales = extractSalesOTE(answer);
  if (freshSales.hasAny) {
    next.salesOTE = mergeSalesOTE(state.salesOTE, freshSales);
  }
  const freshContract = extractContractRate(answer);
  if (freshContract.hasAny) {
    next.contractRate = mergeContractRate(state.contractRate, freshContract);
  }

  /* PDF #18 root-cause (2026-05-15) — candidate-disclosure ack tracker.
   * Detect notice-period / current-CTC / competing-offer / joining-date
   * disclosures in the utterance and append to pendingCandidateAcks.
   * The next bot turn MUST acknowledge them (enforced via brief
   * injection + pruneAcknowledged in applyAiMove). De-dupe by kind so
   * a candidate restating the same disclosure across multiple turns
   * doesn't multiply pending entries. */
  {
    const fresh = detectCandidateDisclosures(answer);
    if (fresh.length > 0) {
      const existing = state.pendingCandidateAcks ?? [];
      const merged: typeof existing = [...existing];
      const seen = new Set(existing.map((e) => e.kind));
      for (const entry of fresh) {
        if (!seen.has(entry.kind)) {
          merged.push(entry);
          seen.add(entry.kind);
        }
      }
      if (merged.length !== existing.length) {
        next.pendingCandidateAcks = merged;
      }

      /* PDF #28 (2026-06-07) — disclosure write-through to kernel slots.
       *
       * Previously the disclosure tracker only wrote per-turn ack
       * labels. The kernel had a SEPARATE parser (parseCandidateAnswer
       * → next.candidateCurrentCtc) whose regex was stricter. When the
       * stricter parser missed but the disclosure tracker matched (e.g.
       * "my current ctc is 44 LPA" with extra punctuation that
       * confused the stricter parser), the slot stayed null and the
       * planner re-emitted ctc-ask next turn — the user saw it as the
       * bot forgetting what they just told it.
       *
       * Fix: when the disclosure tracker captures a parsedValue AND
       * the slot is currently null after the main parser ran, write
       * the value through. Never overwrite an existing value — that
       * preserves the main parser's authority where it fired. */
      for (const entry of fresh) {
        if (entry.kind === "current-ctc"
            && typeof entry.parsedValue === "number"
            && next.candidateCurrentCtc == null) {
          next.candidateCurrentCtc = entry.parsedValue;
        } else if (entry.kind === "notice-period"
            && typeof entry.parsedValue === "number"
            && next.noticeJoining.noticePeriodDays == null) {
          next.noticeJoining = {
            ...next.noticeJoining,
            noticePeriodDays: entry.parsedValue,
            hasAny: true,
          };
        } else if (entry.kind === "current-company"
            && typeof entry.parsedString === "string"
            && next.candidateCurrentCompany == null) {
          /* PDF #28 (2026-06-07) — first-disclosure-wins. Locked from
           * the first valid mention so a later misparse can't overwrite
           * a correctly captured current employer. */
          next.candidateCurrentCompany = entry.parsedString;
        } else if (entry.kind === "wfh-flexibility") {
          /* S39 (2026-07-23) — monotone-up: once set, stays true. */
          next.wfhFlexibilityMentioned = true;
        }
        /* PR-2 (PDF #28) — dual-write disclosure-tracker captures to
         * the ledger. Records even when the slot was already set by the
         * main parser, so the ledger preserves which surface caught the
         * disclosure. Reads continue from slots — first-wins protection
         * lives on the ledger but isn't consulted yet. */
        if (next.ledger) {
          if (entry.kind === "current-ctc" && typeof entry.parsedValue === "number") {
            next.ledger = recordFact(next.ledger, "current-ctc", entry.parsedValue, "disclosure-tracker", next.turnIndex, answer);
          } else if (entry.kind === "notice-period" && typeof entry.parsedValue === "number") {
            next.ledger = recordFact(next.ledger, "notice-period-days", entry.parsedValue, "disclosure-tracker", next.turnIndex, answer);
          } else if (entry.kind === "current-company" && typeof entry.parsedString === "string") {
            next.ledger = recordFact(next.ledger, "current-company", entry.parsedString, "disclosure-tracker", next.turnIndex, answer);
          }
        }
      }
    }
  }

  /* ITEM 3 (2026-05-15) — trial-close detector wiring.
   * If the bot's PREVIOUS turn contained a trial-close ask (e.g.
   * "if we land at ₹X, would you accept today?") AND the candidate is
   * replying now, set candidateSignaledClose sticky-true and push
   * "candidate-trial-close" onto reactiveFollowupsFired so the planner
   * can emit a close-confirmation move. Monotone-up: once signaled,
   * stays signaled for the rest of the session.
   *
   * Audit fix (2026-05-22) — the prior gate stamped `candidateSignaledClose`
   * whenever the bot's PRIOR turn was a trial close, regardless of how
   * the candidate actually responded. A hedge ("I'd be comfortable IF
   * X happens", "let me think", "depends") or decline ("not interested",
   * "I'll pass") would still flip the flag → planner shipped a close-
   * confirmation move → bot prematurely treated the candidate as
   * accepting. Now we classify the candidate response and stamp ONLY on
   * explicit accept. Hedge/decline/null → stay in counter-offer. */
  if (!next.candidateSignaledClose && detectTrialCloseAsked(state.lastAiText ?? null)) {
    const response = detectTrialCloseResponse(answer);
    if (response === "accept") {
      /* S53-B5 (2026-07-24) — veto candidateSignaledClose when the candidate's
       * utterance contains a numeric counter ABOVE the standing offer by more
       * than the near-offer gap. "₹24L works for me" (after a trial-close ask
       * at ₹18.1L) matches ACCEPT_PATTERNS via "works for me", but the candidate
       * is explicitly counterproposing at ₹24L, not accepting ₹18.1L. Stamping
       * candidateSignaledClose would route the planner to close-confirmation at
       * ₹18.1L framed as "we're in the same range" — a fabricated false consensus.
       * Guard: block the stamp whenever the candidate's fresh counter (parsed this
       * turn from lastCandidateCounterLpa) sits above the offer by more than
       * max(₹2L, 6%). Falls through to normal counter-offer path instead. */
      const offeredSoFar = next.highestOfferMade ?? 0;
      const freshCounter = next.lastCandidateCounterLpa;
      /* Also check sticky candidateTarget: when a candidate re-asserts an
       * existing target ("₹24 would work" with candidateTarget=24 already
       * recorded), lastCandidateCounterLpa stays null (no fresh counter),
       * but the candidateTarget is still the price they're holding out for.
       * Either a fresh counter OR a known target well above the offer means
       * the accept-pattern match ("works for me") is describing their price,
       * not unconditionally accepting the recruiter's standing offer. */
      const knownTarget = next.candidateTarget;
      const nearGap = Math.max(2, offeredSoFar * 0.06);
      const aboveGap = (lpa: number | null | undefined) =>
        lpa != null && offeredSoFar > 0 && lpa > offeredSoFar && lpa - offeredSoFar > nearGap;
      /* Only fall back to knownTarget when no fresh counter was named this
       * turn — if the candidate said "18.5 LPA works for me" (naming a
       * new concession number), that fresh counter is the signal to trust,
       * not the stale high-water target from the opening discovery turn. */
      const isActuallyACounter =
        aboveGap(freshCounter) || (aboveGap(knownTarget) && freshCounter == null);
      if (!isActuallyACounter) {
        next.candidateSignaledClose = true;
        const priorFired = next.reactiveFollowupsFired ?? [];
        if (!priorFired.includes("candidate-trial-close")) {
          next.reactiveFollowupsFired = [...priorFired, "candidate-trial-close"];
        }
      }
    }
    /* Hedge / decline / null — record on reactiveFollowupsFired so the
     * planner can avoid re-asking the same trial-close immediately, but
     * do NOT stamp candidateSignaledClose. */
    if (response === "hedge" || response === "decline") {
      const priorFired = next.reactiveFollowupsFired ?? [];
      const marker =
        response === "hedge"
          ? "candidate-trial-close-hedge"
          : "candidate-trial-close-decline";
      if (!priorFired.includes(marker)) {
        next.reactiveFollowupsFired = [...priorFired, marker];
      }
    }
  }

  /* Merge tactic + info sets — sticky, never cleared. */
  for (const t of parsed.vossTactics) {
    if (!next.vossTacticsUsed.includes(t)) next.vossTacticsUsed.push(t);
  }
  /* S13-B9 — an info-intent picked up on this candidate turn is
     candidate-INITIATED only when the recruiter's immediately-prior turn did
     NOT solicit that disclosure. `state.lastAiText` is the recruiter utterance
     that preceded this answer, so it is the correct elicitation context. */
  const elicited = recruiterElicitedDisclosure(state.lastAiText);
  for (const i of parsed.infoAsked) {
    if (!next.infoAsked.includes(i)) next.infoAsked.push(i);
    if (!elicited && !next.infoAskedInitiated.includes(i)) next.infoAskedInitiated.push(i);
  }

  /* Negotiation-flow redesign commit 2 (2026-05-15) — sync discovery
   * checklist from parsed facts (audit D5 fix). Parsed-facts → *Answered
   * flag writes were asymmetric: currentCtcAnswered / targetAnswered /
   * noticePeriodAnswered / competingOffersAnswered / valueProofAnswered
   * were written only by the legacy whole-transcript foldFactsIntoState
   * path, so a candidate volunteering "90 days notice" on turn 1 would
   * be acknowledged but the bot would still re-ask notice on turn 2.
   * Runs after fact binding (parsed → next), before phase derivation
   * (terminal-accept / walk-away / derivePhase). Monotone-up. */
  if (next.discoveryChecklist != null) {
    const cb = next.candidateComponentBreakdown;
    /* BUG-3 (PDF#24, 2026-05-16): treat a percentage-shaped split
     * ("80% fixed, 20% variable") as a valid disclosure for checklist
     * purposes — the candidate stated the split, just not in absolute
     * LPA terms. */
    const fixedVariableSplitHasBoth =
      (cb.base != null && cb.variable != null) ||
      (cb.basePercent != null && cb.variablePercent != null);
    const valueProofSignal =
      (next.salesOTE?.hasAny ?? false) ||
      (next.contractRate?.hasAny ?? false) ||
      (parsed.candidateProfile.hasAny &&
        (parsed.candidateProfile.quotaAttainmentClaimed ||
          parsed.candidateProfile.peopleManagementClaimed ||
          parsed.candidateProfile.transferableSkillsClaimed ||
          parsed.candidateProfile.variableTrackRecord));
    next.discoveryChecklist = syncChecklistFromParsedFacts(next.discoveryChecklist, {
      /* N-2 (2026-07-10, live staging) — reconcile targetAnswered against the
       * GROUND TRUTH, not just this-turn's parse. `parsed.target` only carries
       * a soft target parsed on THIS utterance; a target captured via the
       * counter/fixed-ask path lands on next.candidateTarget /
       * candidateTargetFixed instead, leaving parsed.target null. That desync
       * kept the checklist's targetAnswered=false even though the candidate had
       * already anchored a number (observed: candidateTarget=46 captured, yet
       * the planner's anchor gate re-asked "what's your target?"). Fold the
       * persisted target in so the single checklist reconcile is authoritative
       * and every downstream gate that reads targetAnswered stays coherent. */
      target: parsed.target ?? next.candidateTarget ?? next.candidateTargetFixed ?? null,
      /* N-3 (2026-07-23) — same N-2 reconcile for currentCtc. `parsed.currentCtc`
       * is null whenever the classifier didn't extract a CTC from THIS utterance,
       * but the CTC captured on a prior turn lives on next.candidateCurrentCtc.
       * Without the fallback, syncChecklistFromParsedFacts keeps currentCtcAnswered=false
       * on every follow-up turn — the recruiter re-asks CTC even though it was already
       * captured, observed as 7 consecutive sessions with the re-ask bug. */
      currentCtc: parsed.currentCtc ?? next.candidateCurrentCtc ?? null,
      competing: parsed.competing,
      signalsCompetingExistsWithoutNumber: parsed.signalsCompetingExistsWithoutNumber,
      competingOfferDetailHasAny: parsed.competingOfferDetail.hasAny,
      noticeJoiningHasAny: parsed.noticeJoining.hasAny,
      noticePeriodDays: parsed.noticeJoining.noticePeriodDays,
      fixedVariableSplitHasBoth,
      valueProofSignal,
    });
  }

  /* Verbal-acceptance lock — if the candidate previously said yes but
     now is asking for more (target above current offer, or new lever
     request), record the turn so the move-picker can stiffen. We do
     NOT transition to terminal `accepted` in this case; the candidate
     re-opened. */
  /* AUDIT-W02 BUG-5 (2026-06-08) — info-only post-accept asks (e.g.
   * "what's the joining date again?") must NOT count as renegotiation.
   * Renege requires a new target number or a new lever ask, not a
   * clarifying info question. Removed parsed.infoAsked.length signal.
   * OA-B69 (2026-07-18) — the "new demand" test is now a single predicate
   * (isPostAcceptReopen) that ALSO recognises non-cash lever reopens
   * (higher base, joining bonus, relocation), while still excluding
   * info-only asks. */
  const reneging =
    next.verbalAcceptanceTurn != null && isPostAcceptReopen(parsed);
  if (reneging) {
    /* Sticky — leave verbalAcceptanceTurn set so the move-picker keeps
       seeing it across subsequent turns. Phase 25d: also escalate the
       rescission counter so 2+ consecutive renegotiation attempts trip
       a hard close-walkaway path in the move-picker AND a "rescission-
       risk" blocker in the red-flag layer. */
    next.postVerbalRenegotiationCount = state.postVerbalRenegotiationCount + 1;
  }

  /* Fix E (2026-07-22) — discovery-to-anchor transition guard.
   *
   * When the candidate first discloses BOTH their current CTC and their
   * target in a single discovery turn (state had no prior CTC or target,
   * and this utterance sets both), the acceptance classifier MUST NOT
   * trigger a close or walk-away on the same turn. The AUDIT-3 bridge
   * in the planner will route to `anchor-with-offer` to put a number on
   * the table; closing before any offer has been made (or even seen by
   * the candidate) is always wrong. Guard: if this turn produced the
   * first-ever CTC and first-ever target disclosure simultaneously, skip
   * all close/walk-away handling and fall through to derivePhase normally
   * so the planner can anchor on the NEXT bot turn. */
  const isFreshDualDiscovery =
    /* prior state had neither CTC nor target */
    state.candidateCurrentCtc == null &&
    state.candidateTarget == null &&
    state.candidateTargetFixed == null &&
    /* this turn filled in both */
    next.candidateCurrentCtc != null &&
    (next.candidateTarget != null || next.candidateTargetFixed != null) &&
    /* no offer has been made yet — transition to anchor, not close */
    (next.highestOfferMade ?? 0) === 0;

  /* Bug 2 (2026-05-14) — escalation path: explicit acceptance forms
   * like "please send the offer letter" / "let's move forward with this
   * number" don't trip the legacy `classifyAcceptance` performative
   * bank (they're commitment language, not "I accept" verb). Promote
   * them to terminal `accepted` here so the closing path fires. */
  if (!parsed.signalsAcceptance && !isFreshDualDiscovery) {
    const strictBoost = detectExplicitAcceptance(answer);
    if (strictBoost.accepted && state.highestOfferMade > 0 && !isTerminalPhase(next.phase)) {
      /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard.
       * Block accepts before minTurnsBeforeClose unless the candidate
       * explicitly declined. */
      if (canCloseSession(next, answer, "accept")) {
        markAccepted(next, state);
        attachPostAcceptanceMessage(next);
        return finalize(next);
      }
    }
  }

  /* Terminal transitions. */
  if (parsed.signalsAcceptance && !isFreshDualDiscovery) {
    /* Conditional accept ("yes if X") set verbalAcceptanceTurn instead
       of locking terminal. parseCandidateAnswer's acceptPat already
       rejects most conditionals; this is belt-and-suspenders for the
       sign-today-bundle path which carries its own implicit "if". */
    if (parsed.vossTactics.includes("sign-today-bundle")) {
      next.verbalAcceptanceTurn = state.turnIndex;
      next.phase = derivePhase(next);
      return finalize(next);
    }
    /* Bug 2 (2026-05-14) — STAGE GATING. Terminal `accepted` requires
     * an unambiguous explicit acceptance OR three consecutive non-
     * counter, non-info-asking turns from the candidate (proxy for
     * "they're done negotiating"). The `classifyAcceptance` medium-
     * confidence path is too permissive for closing into offer-letter:
     * "sounds good" / "I'd be comfortable moving forward if X" was
     * tripping a premature close. */
    const strict = detectExplicitAcceptance(answer);
    let hasOffer = state.highestOfferMade > 0;
    /* Bug-D fast-follow (2026-06-19, adversarial battery `competing-offer-
     * then-accept`) — accept against a STATED BAND with no concrete point
     * offer. When the candidate's current CTC sits BELOW the band floor the
     * planner presents the band as a range (`band-anchor-with-rationale`,
     * newTotalLpa:null) so they have room to bargain up; the concrete point
     * offer is meant to arrive from their counter. But a candidate can ACCEPT
     * the stated band outright without countering. We are already inside the
     * `parsed.signalsAcceptance` branch, so the candidate HAS accepted — yet
     * with highestOfferMade still 0 every downstream close path gates out
     * (hasOffer false: the strict path at :5739, the soft-accept stamp at
     * :5827, and the planner's post-anchor close gate all require a standing
     * offer), and the session dead-ends on the acceptance — the exact never-
     * close failure. Stating the band IS committing to its floor, so register
     * the band floor as the standing offer and let the existing close logic
     * land on it. NOT gated on `strict.accepted`: the realistic closing
     * register here is the medium-confidence commitment idiom ("that works for
     * me, let's go ahead and close"), identical to how bugD closes once a
     * concrete offer exists — the only difference there is the offer was
     * already on the table. Guarded on the band actually having been PRESENTED
     * (askedTopics ledger) so a candidate who "accepts" before any band was
     * communicated is NOT closed against an unspoken number. firstOfferAtTurn
     * is back-dated to the band-presentation turn (not the current accept
     * turn) so the PDF#48 stamped-this-turn premature-close guard reads the
     * offer as pre-existing, which it semantically is. */
    if (!hasOffer && state.band) {
      const bandTopic = (state.askedTopics ?? []).find(
        (t) => t.topic === "band-anchor-with-rationale",
      );
      /* #115 fast-follow: floor the registered offer to the disclosed-CTC
       * hike floor so accept-on-band never locks a pay cut below the
       * candidate's current CTC. See bandAcceptOfferFloor. */
      const floor = bandAcceptOfferFloor(state);
      if (bandTopic && typeof floor === "number" && floor > 0) {
        /* #124 (2026-06-21) — honor an in-band candidate TARGET on accept.
         * When the candidate accepts a stated band and has named a total
         * target the band can deliver (≤ maxStretch), close at that target,
         * not the bare CTC-hike floor: the band affords it and the candidate
         * explicitly asked for it, so closing below it shortchanges an
         * accepted deal. Falls back to the hike floor when no in-band target
         * was named (the #115 below-floor protection is preserved — floor is
         * the lower bound). Mirrors nearOfferCloseNumber's target-honoring on
         * the concrete-offer path. */
        const ceil = state.band.maxStretch ?? floor;
        const tgt = effectiveTargetCtcLpa(state);
        const registered =
          tgt != null && tgt > floor ? Math.min(tgt, ceil) : floor;
        next.highestOfferMade = registered;
        if (next.firstOfferAtTurn == null) next.firstOfferAtTurn = bandTopic.atTurn;
        hasOffer = true;
      }
    }
    if (!strict.accepted) {
      /* Soft-acceptance fallback: 3+ consecutive non-counter, non-info
       * candidate turns means the candidate has stopped negotiating —
       * acceptable as an implicit-accept proxy. */
      const log = next.conversationLog;
      let trailingNonCounter = 0;
      for (let i = log.length - 1; i >= 0; i--) {
        const e = log[i];
        if (!e || e.speaker !== "candidate") continue;
        const t = e.text || "";
        const isCounter = /(?:\d+\s*(?:lpa|lakh|l\b|cr|crore|k\b)|expecting|target|want\s+\d|asking)/i.test(t);
        const isInfoAsk = /\?|how\s+much|what\s+is|tell\s+me|can\s+you/i.test(t);
        if (isCounter || isInfoAsk) break;
        trailingNonCounter += 1;
        if (trailingNonCounter >= 3) break;
      }
      if (!hasOffer || trailingNonCounter < 3) {
        /* PDF#36 Fix A2 (2026-05-19) — soft-accept idiom on top of an
         * anchored offer ("works for me", "sounds good", etc.) must
         * still stamp verbalAcceptanceTurn so the planner's
         * post-anchor close gate fires on the SAME turn. Prior code
         * dropped the stamp when trailing-non-counter < 3, which meant
         * the planner had to wait for the candidate to fall silent
         * for three more turns — by which point the bot had typically
         * fired another probe and the candidate had to "accept" again.
         *
         * Keep the 3-turn rule for whether to flip terminal
         * phase="accepted" (that still requires the strong proxy);
         * the verbalAcceptanceTurn stamp is the signal the planner
         * needs to route to close-on-acceptance and is safe to set
         * whenever the candidate signals acceptance over a standing
         * offer. */
        if (hasOffer) {
          /* PDF#48 (2026-05-26) — same structural invariant as
           * canCloseSession. The PDF#36 A2 patch stamped
           * verbalAcceptanceTurn here so the planner's post-anchor
           * close gate (_next-action-planner.ts:1765) could fire
           * same-turn. That fast-path is what produced the
           * PDF#48 auto-close: parseAcceptance medium-confidence
           * false-positive → stamp → planner fires close-
           * acceptance on the turn the offer was first announced.
           *
           * Block the stamp ONLY when we can prove the offer
           * landed THIS turn (firstOfferAtTurn === turnIndex) AND
           * the candidate hasn't named a counter. Otherwise (offer
           * was on the table from a prior turn, OR candidate has
           * countered, OR firstOfferAtTurn is null from a fixture/
           * legacy state) the PDF#36 A2 behavior is preserved. */
          const stampedThisTurn =
            state.firstOfferAtTurn != null && state.firstOfferAtTurn === state.turnIndex;
          const candidateCountered =
            state.lastCandidateCounterLpa != null || state.candidateTarget != null;
          /* S53-B5 (2026-07-24) — mirror the candidateSignaledClose veto here.
           * When the candidate's known target (or a fresh counter named this
           * turn) sits above the standing offer by more than the near-offer gap,
           * the "works for me" idiom refers to THEIR PRICE, not the recruiter's
           * offer. Stamping verbalAcceptanceTurn would route the planner to
           * close-acceptance at the recruiter's offer — a fabricated consensus.
           * "18.5 LPA works for me" after ₹18.1L offer has freshCounter=18.5
           * within gap (0.4L < 2L) → stamp is preserved (candidate conceded). */
          const vatOfferedSoFar = next.highestOfferMade ?? 0;
          const vatFreshCounter = next.lastCandidateCounterLpa;
          const vatKnownTarget = next.candidateTarget;
          const vatNearGap = Math.max(2, vatOfferedSoFar * 0.06);
          const vatAboveGap = (lpa: number | null | undefined): boolean =>
            lpa != null &&
            vatOfferedSoFar > 0 &&
            lpa > vatOfferedSoFar &&
            lpa - vatOfferedSoFar > vatNearGap;
          /* Fresh-counter veto: only fires when the named number matches/exceeds
           * the candidate's own prior target — i.e. they are asserting THEIR price,
           * not conceding. "24 LPA works" with target=24 → asserts target (veto).
           * "fine 22 done" with target=24 → concedes below target (no veto). */
          const vatFreshIsAssertingTarget =
            vatFreshCounter != null &&
            vatAboveGap(vatFreshCounter) &&
            (vatKnownTarget == null || vatFreshCounter >= vatKnownTarget - 0.05);
          /* Known-target veto (no fresh number named this turn): only fires when
           * the candidate did NOT use an explicit acceptance commitment word AND
           * did NOT name an accept-frame number at/below the offer.
           * "alright, accepted" → genuine accept (no veto).
           * "Fine, I'll take 38" with offer=40 → accept-frame number 38 ≤ 40 (no veto).
           * "works for me" with no number and target=24 far above offer →
           * ambiguous idiom pointing to their price (veto). */
          const VAT_EXPLICIT_ACCEPT_RE = /\b(?:accept(?:ed)?|deal|agree[sd]?|done)\b/i;
          const VAT_ACCEPT_FRAME_RE =
            /\b(?:take|go\s+with|close\s+(?:this\s+)?at|accept|happy\s+with)\s+(?:the\s+)?(\d+(?:\.\d+)?)/i;
          const vatAcceptFrameMatch = VAT_ACCEPT_FRAME_RE.exec(answer);
          const vatAcceptFrameNum = vatAcceptFrameMatch ? parseFloat(vatAcceptFrameMatch[1]) : null;
          const vatIsAcceptAtOrBelowOffer =
            vatAcceptFrameNum != null &&
            vatOfferedSoFar > 0 &&
            vatAcceptFrameNum <= vatOfferedSoFar + 1e-9;
          const vatKnownTargetIsCounter =
            vatFreshCounter == null &&
            vatAboveGap(vatKnownTarget) &&
            !VAT_EXPLICIT_ACCEPT_RE.test(answer) &&
            !vatIsAcceptAtOrBelowOffer;
          const vatIsCounter = vatFreshIsAssertingTarget || vatKnownTargetIsCounter;
          if ((!stampedThisTurn || candidateCountered) && !vatIsCounter) {
            next.verbalAcceptanceTurn = state.turnIndex;
          }
        }
        /* Not strict-accepted and no implicit-accept proxy: hold the
         * phase instead of closing. Derive phase normally. */
        next.phase = derivePhase(next);
        return finalize(next);
      }
    }
    /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard.
     * Strict-accepted path passes; soft-accept (trailing-non-counter)
     * path is blocked before minTurnsBeforeClose. */
    const closeReason: "accept" | "soft-accept" = strict.accepted ? "accept" : "soft-accept";
    if (!canCloseSession(next, answer, closeReason)) {
      next.phase = derivePhase(next);
      return finalize(next);
    }
    markAccepted(next, state);
    attachPostAcceptanceMessage(next);
    return finalize(next);
  }
  /* Fix E guard: also block walk-away on the first dual-disclosure turn
   * (candidate stating CTC + target for the first time cannot be
   * simultaneously walking away — that's a conflicting signal; the CTC+target
   * disclosure is load-bearing for discovery, the walk-away is noise). */
  if (parsed.signalsWalkAway && !isFreshDualDiscovery) {
    /* S43-B6 (2026-07-23) — grace for a RELUCTANT emotional decline before any
     * offer has been made. "I'm going to have to pass" (with "have to" framing)
     * is emotionally hedged — real HR responds with a retention offer, not an
     * immediate farewell. Decisive walk-aways ("I'm out", "not interested", "no
     * deal") terminate immediately as before. Gate: (a) no offer has been made yet,
     * (b) session is still early (<5 candidate turns), and (c) the phrase carries
     * reluctance ("have to" modal). On the next walk-away (if any), highestOfferMade
     * or turnIndex will have advanced, so the grace doesn't re-fire. */
    const isReluctantDecline = /\bhave\s+to\b/i.test(answer);
    const isPreOfferGrace =
      isReluctantDecline &&
      (next.highestOfferMade ?? 0) === 0 &&
      state.turnIndex < 5;
    if (!isPreOfferGrace) {
      next.phase = "walked-away";
      next.walkedAwayAtTurn = state.turnIndex;
      return finalize(next);
    }
    /* Grace: fall through without terminal-close so the planner can anchor. */
  }

  /* Non-terminal: re-derive phase from updated state. */
  next.phase = derivePhase(next);
  return finalize(next);
}

/** Fold an externally-computed NegotiationFacts (from the legacy
 *  whole-transcript extractor) into state. Useful during the
 *  feature-flag transition: legacy code already has facts, and the
 *  new kernel can adopt them without re-parsing. */
export function foldFactsIntoState(state: NegotiationState, facts: NegotiationFacts): NegotiationState {
  if (isTerminalPhase(state.phase)) return state;
  const next: NegotiationState = {
    ...state,
    leversUsed: [...state.leversUsed],
    vossTacticsUsed: [...state.vossTacticsUsed],
    infoAsked: [...state.infoAsked],
    infoAskedInitiated: [...(state.infoAskedInitiated ?? [])],
  };
  const num = (s: string | null): number | null => {
    if (!s) return null;
    const v = parseFloat(s.replace(/[^\d.]/g, ""));
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const t = num(facts.candidateCounter);
  const c = num(facts.candidateCurrentCTC);
  const comp = num(facts.competingOfferAmount ?? null);
  if (t != null) {
    next.candidateTarget = t;
    if (next.firstAnchoredTarget == null) next.firstAnchoredTarget = t;
  }
  if (c != null) next.candidateCurrentCtc = c;
  if (comp != null) next.competingOffer = comp;
  /* Audit Pass 2 Fix C (2026-05-16) — finalize() symmetry with
   * applyCandidateAnswer. There's no candidate turn here (no answer
   * was parsed), so no lastTurnDelta to stamp. We DO need to re-stamp
   * plannedNextAction so consumers reading from fold-facts state see
   * the planner output for the new phase (the prior bug returned
   * `next` raw, so the planner cascade never ran for fold-facts). */
  const finalize = (n: NegotiationState): NegotiationState => {
    n.plannedNextAction = _callNextActionPlanner(n);
    return n;
  };
  if (facts.acceptedImmediately) {
    markAccepted(next, state);
    attachPostAcceptanceMessage(next);
    return finalize(next);
  }
  if (facts.rejectedOutright) {
    next.phase = "walked-away";
    next.walkedAwayAtTurn = state.turnIndex;
    return finalize(next);
  }
  next.phase = derivePhase(next);
  return finalize(next);
}
