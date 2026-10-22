/* Negotiation kernel: per-turn deltas and anchor lock/clamp helpers. */

import { type QuestionIntent, classifyQuestionIntent } from "./_question-intent";
import type { NegotiationState } from "./_negotiation-state-types";
import type { ParsedAnswer } from "./_negotiation-parse";
import { detectExplicitAcceptance } from "./_acceptance-classifier";
import { classifyCandidateArchetype } from "./_candidate-archetype";
import { buildPostAcceptanceMessageChunks } from "./_post-acceptance";

/* ─── Negotiation-flow redesign commit 1 (2026-05-15) — TurnDelta ────
 *
 * Diff between pre- and post-state for a single candidate utterance.
 * Populated by `computeTurnDelta(pre, post, parsed)` inside
 * `applyCandidateAnswer` and stored on `state.lastTurnDelta`. Cleared
 * by `applyAiMove`. Each field is a boolean "this kind of thing just
 * happened this turn" signal — consumers that need the actual value
 * read it from the post-state.
 *
 * Eleven disclosure categories spec'd by the negotiation-flow audit
 * (E row 1):
 *   currentCtc / expectedCtc          — comp facts (new values, not restates)
 *   fixedVariableSplit                — base+variable breakdown disclosed
 *   noticePeriod                      — notice days OR buyout signal
 *   competingOffer                    — competing-offer presence (number or vague)
 *   joiningDate                       — early-join / last-working-day signal
 *   valueProof                        — quota / portfolio / depth signal (sales/contract/profile)
 *   askedQuestion                     — candidate's utterance contains a "?" question
 *   refusedItem                       — probeRefusalCount incremented this turn
 *   freshGrad                         — first-time fresh-grad disclosure
 *   retentionCounter                  — current-employer retention counter disclosed
 */
export interface TurnDelta {
  /** Candidate disclosed a NEW currentCtc value this turn (not a restate). */
  disclosedCurrentCtc: boolean;
  /** Candidate disclosed a NEW expected/target value this turn. */
  disclosedExpectedCtc: boolean;
  /** Candidate disclosed a fixed/variable breakdown for either CTC. */
  disclosedFixedVariableSplit: boolean;
  /** Candidate disclosed notice period or notice-related signal (buyout / LWD). */
  disclosedNoticePeriod: boolean;
  /** Candidate confirmed buyout availability THIS turn (pre.buyoutRequested
   *  false → post true). Distinct from disclosedNoticePeriod which also
   *  fires on bare notice-day disclosures. Used by the reactive-rule
   *  layer to acknowledge buyout before advancing discovery. (Fix 6,
   *  2026-05-16) */
  noticeBuyoutConfirmed: boolean;
  /** Candidate disclosed a competing offer (number OR named-vague signal). */
  disclosedCompetingOffer: boolean;
  /** Candidate disclosed role-specific value proof (quota / ARR / portfolio / shipped systems). */
  disclosedValueProof: boolean;
  /** Candidate utterance contained a direct question ("?"). */
  askedQuestion: boolean;
  /** Structured form of the candidate question. Carries the (trimmed) raw
   *  text and a coarse intent tag so the response pipeline can decide
   *  whether to answer vs. defer without re-detecting the question. */
  candidateAskedQuestion?: { raw: string; intent?: QuestionIntent } | null;
  /** Candidate refused a probe this turn (probeRefusalCount incremented). */
  refusedItem: boolean;
  /** Candidate first-disclosed fresh-grad status this turn. */
  freshGradDisclosed: boolean;
  /** Perfect 2 (2026-05-16) — coarse emotional sentiment classification of
   *  the candidate's utterance this turn. Drives an Indian-recruiter-idiom
   *  acknowledgement prefix in canonical prose for frustrated / excited /
   *  hesitant; decisive and neutral suppress the prefix (decisive needs no
   *  emotional softening, neutral needs no acknowledgement). */
  candidateSentiment?: "frustrated" | "excited" | "hesitant" | "decisive" | "neutral";
  /** Perfect 3 (2026-05-16) — time-pressure signal detected this turn.
   *  "firm" = explicit deadline ("by Friday", "deadline is Monday",
   *  "competing offer expires"); "soft" = directional movement framing
   *  ("looking to move quickly", "in final stages elsewhere"); "none" =
   *  default. Merged into the sticky state.cumulativeUrgency via
   *  applyAiMove (sticky upgrade — firm overrides soft overrides none,
   *  never downgrades within a session). */
  urgencySignal?: "none" | "soft" | "firm";
  /** QA v3 round 3 (2026-05-19) — classified candidate archetype from
   *  `_candidate-archetype.ts`. Per-turn classification on the raw
   *  utterance; `null` when no signal fires. The planner uses this to
   *  disambiguate routing when wired-profile flags don't fully describe
   *  the candidate's stance (e.g. P09_NON_CASH_FOCUS suppresses counter-
   *  offer; P15_HARD_ANCHOR forces band-disclosure-deflect over generic
   *  acknowledge). Pure metadata — no state mutation. */
  candidateArchetype?:
    | import("./_candidate-archetype").CandidateArchetype
    | null;
}

export const EMPTY_TURN_DELTA: TurnDelta = {
  disclosedCurrentCtc: false,
  disclosedExpectedCtc: false,
  disclosedFixedVariableSplit: false,
  disclosedNoticePeriod: false,
  noticeBuyoutConfirmed: false,
  disclosedCompetingOffer: false,
  disclosedValueProof: false,
  askedQuestion: false,
  candidateAskedQuestion: null,
  refusedItem: false,
  freshGradDisclosed: false,
  candidateSentiment: "neutral",
  urgencySignal: "none",
  candidateArchetype: null,
};

/** Perfect 2 (2026-05-16) — coarse emotional sentiment classifier for
 *  the candidate's utterance. Pure regex-based heuristic on raw text.
 *  Patterns are tuned to Indian-English negotiation idiom (frustrated
 *  candidates lean on "honestly" / "frankly" hedges; excited candidates
 *  use "looking forward" / "happy with"; hesitant candidates surface
 *  family / "let me think" framings; decisive candidates use "final
 *  number" / "bottom line").
 *
 *  Priority order matters: decisive and frustrated outrank excited /
 *  hesitant when patterns collide ("honestly, this is my final number"
 *  → frustrated wins because frustration drives the prefix decision).
 *  Default is "neutral". Downstream renderSentimentPrefix suppresses
 *  the prefix for decisive + neutral. */
/* Audit Fix (2026-05-19) — Mask target-context spans of a candidate
 * utterance so downstream DISCLOSURE-context parsers (specifically
 * extractComponentBreakdown) don't bind target-LPA values as if they
 * were the candidate's currently-paid breakdown.
 *
 * A target clause starts at a target-marking cue ("target", "expecting",
 * "want", "looking for", "asking for", "ideal", "would like", "anchor")
 * AND runs until the next sentence boundary (`.` `!` `?` `\n`) OR a
 * clause break that resets to a non-target context. Within the masked
 * span we replace every non-whitespace, non-sentence-boundary char with
 * a space so regex byte-offsets are preserved (no downstream parser
 * relies on contiguous character positions across the mask boundary).
 *
 * Conservative: we mask only when an UNAMBIGUOUS target cue fires.
 * Hedge words alone ("at minimum", "at least") do NOT trigger a mask
 * — they're modifiers, not target markers. */
export const TARGET_CLAUSE_CUES = [
  /\btarget\s+is\b/i,
  /\bmy\s+target\b/i,
  /\bi.?m\s+expecting\b/i,
  /\bi\s+(?:am\s+)?expecting\b/i,
  /\bexpecting\s+(?:around|about|at|near)?\b/i,
  /\bi\s+want\b/i,
  /\bi.?d\s+like\b/i,
  /\bi\s+would\s+like\b/i,
  /\blooking\s+for\b/i,
  /\basking\s+for\b/i,
  /\bideal(?:ly)?\b/i,
  /\bhoping\s+for\b/i,
  /\baim(?:ing)?\s+for\b/i,
  /\banchor(?:ing)?\s+(?:around|at|on)?\b/i,
  /\bcan\s+we\s+revisit\b/i,
  /* Audit Fix (2026-05-19) — conditional close phrasings. When the
   * candidate says "if you can get fixed to ₹X, I'm ready to move
   * forward" they are stating a TARGET condition, not disclosing their
   * current fixed. The ask is forward-looking; the number must not
   * leak into candidateComponentBreakdown.base. */
  /\bif\s+you\s+can\s+(?:get|make|push|move|bring|raise|bump|stretch)\b/i,
  /\bif\s+(?:the\s+)?fixed\s+(?:can\s+)?(?:get|go|move|push|stretch)/i,
  /\bget\s+(?:the\s+)?fixed\s+to\b/i,
  /\bpush\s+(?:the\s+)?fixed\s+to\b/i,
];
export function maskTargetClauses(text: string): string {
  if (!text) return text;
  const out: string[] = text.split("");
  for (const cue of TARGET_CLAUSE_CUES) {
    const m = cue.exec(text);
    if (!m || m.index == null) continue;
    /* Mask from the cue's start up to the next sentence boundary. */
    const start = m.index;
    let end = text.length;
    for (let i = start; i < text.length; i++) {
      if (/[.!?\n]/.test(text[i])) {
        end = i;
        break;
      }
    }
    for (let i = start; i < end; i++) {
      if (!/\s/.test(out[i])) out[i] = " ";
    }
  }
  return out.join("");
}

export function detectCandidateSentiment(
  rawCandidateText: string,
): TurnDelta["candidateSentiment"] {
  if (typeof rawCandidateText !== "string" || !rawCandidateText.trim()) {
    return "neutral";
  }
  const text = rawCandidateText.toLowerCase();
  /* Multiple exclamation marks anywhere → frustrated signal. */
  const multiBang = /!\s*!/.test(rawCandidateText);
  const FRUSTRATED_RE =
    /\b(honestly|frankly|to be very honest|this is not fair|really disappointed|expected more|i don['’]?t think|lowball|very low)\b/i;
  if (multiBang || FRUSTRATED_RE.test(text)) return "frustrated";
  const DECISIVE_RE =
    /\b(final number|bottom line|non[- ]?negotiable|either way|let me be direct|straight up)\b/i;
  if (DECISIVE_RE.test(text)) return "decisive";
  const EXCITED_RE =
    /\b(looking forward|excited to join|happy with|absolutely|great|let['’]?s go ahead|let['’]?s close)\b/i;
  if (EXCITED_RE.test(text)) return "excited";
  const HESITANT_RE =
    /\b(i['’]?m not sure|need to think|let me get back|discuss with family|let me check|kind of|maybe|i suppose)\b/i;
  if (HESITANT_RE.test(text)) return "hesitant";
  return "neutral";
}

/** Perfect 3 (2026-05-16) — time-pressure / urgency signal detector.
 *
 *  Two-bucket classifier (plus default "none") tuned to how Indian
 *  candidates surface time pressure: firm signals carry an explicit
 *  date, named weekday, or "in-hand offer" framing; soft signals are
 *  directional intent without a hard deadline ("looking to move
 *  quickly", "in final stages elsewhere").
 *
 *  Why "firm" outranks "soft": a candidate who says both "looking to
 *  move quickly AND I have to revert by Friday" is firm — the deadline
 *  is the binding constraint, the directional framing is incidental. */
export function detectUrgencySignal(
  rawCandidateText: string,
): TurnDelta["urgencySignal"] {
  if (typeof rawCandidateText !== "string" || !rawCandidateText.trim()) {
    return "none";
  }
  const text = rawCandidateText.toLowerCase();
  const FIRM_RE =
    /\b(have to revert by|deadline is|joining by|by\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|this week|next week|end of (?:the )?week|eow|eod)|have an offer in hand|offer in hand|competing offer expires|need to close this week|close this week)\b/i;
  if (FIRM_RE.test(text)) return "firm";
  const SOFT_RE =
    /\b(soon|looking to move quickly|want to wrap up|in final stages elsewhere|interviewing with others|interviewing elsewhere)\b/i;
  if (SOFT_RE.test(text)) return "soft";
  return "none";
}

/** Perfect 3 (2026-05-16) — sticky upgrade for cumulativeUrgency. Firm
 *  overrides soft overrides none; never downgrades. Pure. */
export function mergeCumulativeUrgency(
  prior: NegotiationState["cumulativeUrgency"],
  fresh: TurnDelta["urgencySignal"],
): "none" | "soft" | "firm" {
  const rank = { none: 0, soft: 1, firm: 2 } as const;
  const p = rank[prior ?? "none"];
  const f = rank[fresh ?? "none"];
  const max = p >= f ? p : f;
  return (Object.keys(rank) as Array<"none" | "soft" | "firm">).find(
    (k) => rank[k] === max,
  ) ?? "none";
}

/** Compute the per-turn delta between pre-state and post-state given
 *  the parsed candidate answer. Pure. Called at every return point of
 *  applyCandidateAnswer so terminal / soft-accept / walk-away paths all
 *  carry an accurate delta for downstream consumers. */
export function computeTurnDelta(
  pre: NegotiationState,
  post: NegotiationState,
  parsed: ParsedAnswer,
  rawAnswer: string,
): TurnDelta {
  const d: TurnDelta = { ...EMPTY_TURN_DELTA };

  /* Comp facts — disclosed iff the post value is different from the pre
   * value (covers null→number AND value-changed cases). Re-stating the
   * same number does NOT count as a fresh disclosure. */
  if (post.candidateCurrentCtc != null && post.candidateCurrentCtc !== pre.candidateCurrentCtc) {
    d.disclosedCurrentCtc = true;
  }
  if (post.candidateTarget != null && post.candidateTarget !== pre.candidateTarget) {
    d.disclosedExpectedCtc = true;
  }

  /* Fixed/variable split — fired when this turn's parsed breakdown
   * carried BOTH base and variable. Captures both "split disclosed for
   * current CTC" and "split disclosed for expected CTC" — consumers
   * disambiguate via state.lastDisclosureSubject if they care. */
  if (
    parsed.componentBreakdown.hasAny &&
    ((parsed.componentBreakdown.base != null && parsed.componentBreakdown.variable != null) ||
      (parsed.componentBreakdown.basePercent != null && parsed.componentBreakdown.variablePercent != null))
  ) {
    /* BUG-3 (PDF#24, 2026-05-16): a percentage-shaped split
     * ("80% fixed, 20% variable") is also a valid disclosure of the
     * fitment split — we just don't know the absolute LPA values
     * without a total. Either form flips this flag. */
    d.disclosedFixedVariableSplit = true;
  }

  /* Notice period — covers both notice-days AND buyout/LWD signals. */
  if (parsed.noticeJoining.hasAny) {
    const pn = pre.noticeJoining;
    const nn = post.noticeJoining;
    if (
      (nn.noticePeriodDays != null && nn.noticePeriodDays !== pn.noticePeriodDays) ||
      (nn.buyoutRequested && !pn.buyoutRequested) ||
      (nn.lastWorkingDayText != null && nn.lastWorkingDayText !== pn.lastWorkingDayText)
    ) {
      d.disclosedNoticePeriod = true;
    }
    /* Buyout confirmation flip (Fix 6, 2026-05-16). Distinguished from
     * disclosedNoticePeriod so the reactive-rule layer can acknowledge
     * the buyout disclosure before advancing ordered discovery. */
    if (nn.buyoutRequested && !pn.buyoutRequested) {
      d.noticeBuyoutConfirmed = true;
    }
  }

  /* Competing offer — either numeric or named-vague signal.
   *
   * Live-staging finding (2026-06-17, completion sink #4): a candidate
   * CLOSING on OUR offer ("happy to accept and move ahead with the offer
   * letter") tripped the competing-offer credibility probe, because the
   * format-status patterns in extractCompetingOfferDetail match a bare
   * "offer letter" — which, in a close context, refers to OUR letter, not a
   * competitor's. That set disclosedCompetingOffer, and the competing-
   * credibility reactive rule pre-empted the post-anchor acceptance close,
   * so the bot deflected instead of closing like a real HR.
   *
   * Fix: a competingOfferDetail whose ONLY signal is a format/state `status`
   * (letter / email / verbal / signed) is ambiguous on its own. Treat it as
   * a competing disclosure only when the SAME utterance is NOT an acceptance
   * of our offer. Concrete competing context (company name, stage, amount,
   * letter-share offer, on-hold) remains an unconditional trigger — a real
   * competing disclosure carries one of those. */
  const acceptingOurOffer =
    parsed.signalsAcceptance || detectExplicitAcceptance(rawAnswer).accepted;
  const competingDetailSignal =
    parsed.competingOfferDetail.hasAny &&
    (parsed.competingOfferDetail.company != null ||
      parsed.competingOfferDetail.stage != null ||
      parsed.competingOfferDetail.letterShareOffered ||
      parsed.competingOfferDetail.onHold ||
      parsed.competingOfferDetail.amount != null ||
      (parsed.competingOfferDetail.status != null && !acceptingOurOffer));
  if (
    (post.competingOffer != null && post.competingOffer !== pre.competingOffer) ||
    parsed.signalsCompetingExistsWithoutNumber ||
    competingDetailSignal
  ) {
    d.disclosedCompetingOffer = true;
  }

  /* Value proof — sales OTE / contract rate / profile signals that
   * speak to role-specific value. Sales/contract aren't in ParsedAnswer;
   * detect via post-state diff against pre-state (extractSalesOTE /
   * extractContractRate are folded into post inside applyCandidateAnswer). */
  if (
    (post.salesOTE.hasAny && !pre.salesOTE.hasAny) ||
    (post.contractRate.hasAny && !pre.contractRate.hasAny)
  ) {
    d.disclosedValueProof = true;
  }
  if (
    parsed.candidateProfile.hasAny &&
    (parsed.candidateProfile.quotaAttainmentClaimed ||
      parsed.candidateProfile.peopleManagementClaimed ||
      parsed.candidateProfile.transferableSkillsClaimed ||
      parsed.candidateProfile.variableTrackRecord)
  ) {
    d.disclosedValueProof = true;
  }

  /* Asked-question — direct question in the candidate's utterance.
   *
   * Populates two fields:
   *   askedQuestion             — back-compat boolean
   *   candidateAskedQuestion    — structured {raw, intent} that the
   *                                response pipeline prefers over a
   *                                fresh re-detection at request time.
   *
   * Audit follow-up (2026-05-21) — DEBT #1 consolidation. The classifier
   * lives in `_question-intent.ts`, called from BOTH this site (write
   * side of the answeredQuestionLedger) and `_fact-pack.ts:detect-
   * CandidateAskedQuestion` / `_response-pipeline.ts` (read side). Same
   * function, same vocabulary, ledger dedup actually fires.
   */
  if (typeof rawAnswer === "string" && rawAnswer.trim()) {
    const trimmed = rawAnswer.trim();
    const Q_LEAD_RE =
      /^\s*(?:what|how|when|where|who|why|can you|could you|do you|is the|are you|tell me about)\b/i;
    const RHETORICAL_BEFORE_RE =
      /\b(thinking|wondering|wonder|guess|suppose|imagine|just|maybe)\b[^.?!]*?\b(what|how|when|where|who|why)\b/i;
    const trailingQ = /\?\s*$/.test(trimmed);
    const leadingQ = Q_LEAD_RE.test(trimmed);
    const rhetorical = RHETORICAL_BEFORE_RE.test(trimmed) && !trailingQ;
    if (!rhetorical && (trailingQ || leadingQ)) {
      d.askedQuestion = true;
      const intent = classifyQuestionIntent(trimmed);
      d.candidateAskedQuestion = {
        raw: trimmed.slice(0, 240),
        ...(intent ? { intent } : {}),
      };
    }
  }

  /* Refused-item — probeRefusalCount incremented this turn. */
  if ((post.probeRefusalCount ?? 0) > (pre.probeRefusalCount ?? 0)) {
    d.refusedItem = true;
  }

  /* Fresh-grad — first-time disclosure (pre=false, post=true). */
  if (!pre.freshGradDisclosed && post.freshGradDisclosed) {
    d.freshGradDisclosed = true;
  }

  /* Perfect 2 (2026-05-16) — emotional sentiment classification. Pure
   * regex on the raw candidate utterance. Drives the canonical-prose
   * acknowledgement prefix when sentiment ∈ {frustrated, excited,
   * hesitant}; decisive + neutral suppress (no preachy prefix). */
  d.candidateSentiment = detectCandidateSentiment(rawAnswer);

  /* Perfect 3 (2026-05-16) — per-turn urgency signal. The sticky session
   * field state.cumulativeUrgency is upgraded by finalize() in applyCandidate-
   * Answer using this value; the delta field stays as the per-turn read. */
  d.urgencySignal = detectUrgencySignal(rawAnswer);

  /* QA v3 round 3 (2026-05-19) — per-turn archetype classification.
   * Reads the post-state candidateProfile so the classifier can boost on
   * wired-profile flags (e.g. wantsHigherBase boosts P18_BREAKUP_PUSHBACK
   * confidence). Stored on the delta so planReactiveFollowup can read it
   * without re-running regex. */
  const classified = classifyCandidateArchetype(
    rawAnswer,
    post.candidateProfile ?? null,
  );
  d.candidateArchetype = classified?.archetype ?? null;

  return d;
}

/* ─── Fix 7 (2026-05-15) — Anchor-lock helpers ───────────────────── */

/** Return the locked anchor LPA if the session already locked one;
 *  otherwise fall back to band.initialOffer. Pure. */
export function effectiveAnchorLpa(state: NegotiationState): number {
  if (state.anchorLocked && state.lockedAnchorLpa != null) {
    return state.lockedAnchorLpa;
  }
  return state.band.initialOffer;
}

/** Lock the session's anchor. Idempotent — once locked, subsequent
 *  calls are no-ops (the original anchor never changes within a
 *  session). Returns a new state. Pure. */
export function lockAnchor(state: NegotiationState, anchorLpa: number): NegotiationState {
  if (state.anchorLocked) return state;
  return { ...state, anchorLocked: true, lockedAnchorLpa: anchorLpa };
}

/* ─── Fix 1 (2026-05-15) — Anchor clamp against candidate ask ──────
 *
 * Real-session bug (PDF #17 re-analysis): candidate asked ₹16L,
 * recruiter anchored ₹24L — volunteering money the candidate never
 * requested. Real recruiters never anchor higher than the candidate's
 * stated target; if the candidate undershoots the band, they accept
 * quickly with a small step-up rather than padding the offer.
 *
 * PDF #18 audit (2026-05-15): tightened unified rule. The cleanest
 * recruiter behavior is: NEVER offer above max(candidateAsk × 1.10,
 * bandFloor). Below-floor asks are handled by the same expression
 * (max picks the floor); above-anchor asks are no-ops (clamp ≥ anchor).
 *
 * clampAnchorAgainstCandidateAsk:
 *   - candidateAskLpa == null/invalid → return originalAnchor unchanged
 *   - else → min(originalAnchor, max(candidateAsk × 1.10, bandFloor))
 *
 * Applied at session-init AND on each turn before re-anchor (anchor
 * is locked per Fix 7, so this only fires at init for the locked
 * value). Pure. */
export function clampAnchorAgainstCandidateAsk(
  originalAnchor: number,
  candidateAskLpa: number | null,
  bandFloor: number,
): number {
  if (candidateAskLpa == null) return originalAnchor;
  if (!Number.isFinite(candidateAskLpa) || candidateAskLpa <= 0) return originalAnchor;
  const cap = Math.max(candidateAskLpa * 1.10, bandFloor);
  return Math.min(originalAnchor, cap);
}

/* Sprint A.3 (2026-05-15) — attach the post-acceptance onboarding
 * message to state at the moment the kernel transitions to `accepted`.
 * Builds once and stores on state so the response layer can concatenate
 * it onto the close turn without the LLM improvising onboarding
 * language. Idempotent — re-attach is a no-op once set. Mutates `next`
 * in place (callers pass a fresh draft just before returning).
 *
 * Dynamic require kept because `_post-acceptance` imports the
 * NegotiationState type from this file and a static import would lock
 * the load order. */
/** Audit Pass 2 Fix D (2026-05-16) — normalize curly / smart quotes
 *  to ASCII at the input boundary. iOS / macOS auto-correct silently
 *  rewrites apostrophes to U+2019 (right single quotation mark) and
 *  double quotes to U+201C/U+201D, but every regex bank in
 *  `_acceptance-classifier.ts` (lines 78/80/82/92/101/133/143/146/147/
 *  198/226/438-465) uses ASCII `'` exclusively. Pre-fix, "I'll accept"
 *  and "I'm in" pasted from iOS Notes never matched any acceptance
 *  pattern. Apply at applyCandidateAnswer entry (kernel-side) AND at
 *  classifyAcceptance entry (defense-in-depth for the legacy
 *  whole-transcript facts path which doesn't route through the kernel). */
export function normalizeQuotes(s: string): string {
  return s
    .replace(/[\u2018\u2019\u02BC\u02BB]/g, "'")
    .replace(/[\u201C\u201D]/g, '"');
}

export function attachPostAcceptanceMessage(next: NegotiationState): void {
  if (next.postAcceptanceMessage) return;
  /* Populate both views in one call so the joined-string consumer
   * (current negotiate-turn dispatch) and the chunks consumer (future
   * engine fan-out) read consistent data — single source, two
   * projections. The chunks array is the forward-compatible shape;
   * see the field doc on NegotiationState.postAcceptanceFollowups. */
  const chunks = buildPostAcceptanceMessageChunks(next);
  next.postAcceptanceFollowups = chunks;
  next.postAcceptanceMessage = chunks.join("\n\n");
}

/** Audit Pass 2 Fix C (2026-05-16) — single helper for the
 *  "candidate verbally accepted, lock in terminal" state-tuple. Three
 *  accept paths in `applyCandidateAnswer` (strict-boost explicit accept,
 *  classifyAcceptance / soft-accept fallthrough, and the strict-acceptance
 *  terminal write) plus `foldFactsIntoState` were each setting `phase` +
 *  `acceptedAtTurn` independently, BUT only one of them set
 *  `verbalAcceptanceTurn`. The next-action planner gates the
 *  close-recap-formal step on `verbalAcceptanceTurn != null`, so the
 *  close-recap never fired on those paths — terminal-restate won
 *  instead. Forcing the field tuple through this helper closes the gap.
 *
 *  Call sites must keep their own site-specific extras (e.g.
 *  `attachPostAcceptanceMessage` or sign-today-bundle attachments) —
 *  this helper only enforces the field tuple, nothing else. */
export function markAccepted(next: NegotiationState, state: NegotiationState): void {
  next.phase = "accepted";
  next.acceptedAtTurn = state.turnIndex;
  next.verbalAcceptanceTurn = state.turnIndex;
}
