/* Negotiation kernel: state validation and (de)serialization. */

import type { NegotiationBand, NegotiationPhase, NegotiationLever, DiscoveryTopic } from "./_negotiation-vocab";
import type { NegotiationState, VossTactic, InfoIntent, MarketMode, RecruiterPersona, AffinityLedgerEntry, PowerSignals } from "./_negotiation-state-types";
import { normalizeForLoopCompare as _normalizeForLoopCompare } from "./_response-pipeline";
import { MAX_LEDGER_ENTRIES } from "./_negotiation-moves";
import { type DiscoveryChecklist, isValidDiscoveryStage, backfillDiscoveryChecklist, type DiscoveryStage } from "./_discovery-stage";
import type { RecruiterSectorPersona } from "./_indian-recruiter-personas";
import type { RecruiterMood, RecruiterMoodDynamic } from "./_recruiter-prose-realism";
import type { TimeContext } from "./_recruiter-time-context";
import type { ComponentBreakdown } from "./_component-breakdown";
import type { RationaleResult } from "./_hike-rationale";
import type { LocationModeResult } from "./_location-mode";
import type { DecisionDeadlineResult } from "./_decision-deadline";
import type { MiscSignalsResult } from "./_misc-signals";
import { type SalesOTEResult, EMPTY_SALES_OTE, type ContractRateResult, EMPTY_CONTRACT_RATE } from "./_comp-structure";
import { type RetentionCounterResult, EMPTY_RETENTION_COUNTER } from "./_retention-counter";
import type { ResumeFactPack } from "./_resume-fact-pack";
import type { NegotiationRoundPersona } from "./_negotiation-rounds";
import type { CompetingOfferDetail } from "./_competing-offer-detail";
import { type CandidateProfileResult, EMPTY_CANDIDATE_PROFILE } from "./_candidate-profile";
import type { CandidateStanceResult } from "./_candidate-stance";
import type { NoticeJoiningResult } from "./_notice-joining";
import type { EquityVestingResult } from "./_equity-vesting";

/* ─── Validation helpers ─────────────────────────────────────────── */

/** Does the LLM's generated text contain a salary number that
 *  violates the band? Returns the first violating number (in LPA) or
 *  null. Used by the route handler to detect when the LLM has invented
 *  a number outside the approved band.
 *
 *  Unit-aware: matches both `LPA / lakh` and `cr / crore` and normalises
 *  crore→LPA (×100). Without crore matching, the LLM could write
 *  "₹2 crore total" and bypass the validator entirely — a real risk
 *  since the upstream parser now accepts crore inputs from candidates. */
/** Phase 31 (2026-05-14) — centralised component-constraint validator.
 *
 *  Before this helper, `pickAiMove` had an inline check (Phase 12b,
 *  ~line 1924) that compared the proposed counter against
 *  `baseStretch + variableMax` but never against `baseFloor`. The audit
 *  flagged this: a band can declare baseFloor as the structural minimum
 *  base the company will quote, yet the kernel completely ignored it,
 *  so a counter below baseFloor could leave the picker.
 *
 *  Semantics:
 *    A total-CTC value T is structurally valid iff there EXISTS a
 *    (base, variable) decomposition with
 *      baseFloor   ≤ base    ≤ baseStretch
 *      0           ≤ variable ≤ variableMax
 *      base + variable = T
 *
 *    Therefore T must satisfy:
 *      baseFloor                       ≤ T   (else base would have to be < baseFloor)
 *      T ≤ baseStretch + variableMax        (else base would have to exceed baseStretch)
 *
 *  Returns { ok, reason }. Reason discriminates the two failure modes
 *  so the move-picker can react differently — below-floor offers
 *  shouldn't happen and indicate a band-resolution bug; above-cap
 *  offers route to non-cash levers.
 *
 *  Fields are all optional. When a field is absent, the corresponding
 *  half of the constraint is unenforced (treated as ±∞). Legacy bands
 *  without any component metadata always validate as ok. */
export type ComponentConstraintReason = "below-base-floor" | "above-component-cap";

export interface ComponentConstraintResult {
  ok: boolean;
  reason?: ComponentConstraintReason;
}

export function validateComponentConstraints(
  band: NegotiationBand,
  proposedTotalLpa: number,
): ComponentConstraintResult {
  if (band.baseFloor != null && proposedTotalLpa + 0.01 < band.baseFloor) {
    return { ok: false, reason: "below-base-floor" };
  }
  if (band.baseStretch != null) {
    const componentCap = band.baseStretch + (band.variableMax ?? 0);
    if (proposedTotalLpa > componentCap + 0.01) {
      return { ok: false, reason: "above-component-cap" };
    }
  }
  return { ok: true };
}

export function findOutOfBandNumber(text: string, band: NegotiationBand): number | null {
  /* Currency prefix accepts ₹, Rs., Rs, INR so an LLM switching
     notation can't sneak past validation. Now ALSO accepts a bare
     number followed by LPA / lakh / cr — production LLMs frequently
     drop the rupee glyph ("35 LPA"), and the prior strict regex was
     letting those slip past as "no numbers found".

     Strip commas before parseFloat for "₹1,50,000 LPA" style.

     SEMANTIC NOTE on band.walkAway: in the kernel state, walkAway is
     the candidate's FLOOR (recruiter going below this loses the
     candidate). The salary-lookup pipeline historically stored a
     RECRUITER ceiling here (= 1.1 × maxStretch), which made this
     check reject every legitimate offer below that ceiling. The
     server-side band resolver (`resolveServerBand` in negotiate-turn)
     now maps salary-lookup's `minOffer` to the kernel's `walkAway` so
     the semantics line up. The defensive `Math.min(...)` here is
     belt-and-suspenders: if anything upstream ever passes a band where
     walkAway >= maxStretch, we ignore the floor check entirely rather
     than spurious-reject every number. */
  /* Audit Pass 3 / Fix 4 (2026-05-16) — extend unit matcher to cover
   * the bare "L" suffix ("32L", "28 L") and the "lac" misspelling
   * ("28 lac"), in addition to the historical LPA / lakh / crore set.
   * Production transcripts show Indian candidates frequently using
   * "32L" / "lac" forms; the pre-fix regex treated these as no-unit
   * numbers and let them slip past the out-of-band guard. Word-boundary
   * \b after L / lac prevents matching mid-word ("Lalit", "lacking"). */
  const re = /(?:₹|Rs\.?\s*|INR\s*)?([\d,]+(?:\.\d+)?)\s*(LPA|lpa|lakhs?|lacs?|crore|\bcr\b|L\b)/gi;
  const effectiveFloor = band.walkAway < band.maxStretch ? band.walkAway : -Infinity;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let n = parseFloat(m[1].replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    if (/cr/i.test(m[2])) n *= 100;
    if (n > band.maxStretch + 0.01 || n < effectiveFloor - 0.01) return n;
  }
  return null;
}

/** Verbatim-repeat check. The LLM occasionally regenerates the
 *  identical question two turns in a row; this catches it without
 *  relying on Jaccard tuning. AUDIT-W02 C1 (2026-06-08) unified this
 *  with the pipeline's `normalizeForLoopCompare` full-text key —
 *  both layers now agree on what counts as a repeat. The min-content-
 *  words guard below avoids false positives on very short closers
 *  like "Sounds good." which legitimately repeat across turns. */
export const MIN_CONTENT_WORDS = 4;

/* PDF#38 BUG-C (2026-05-20) — widen the verbatim-repeat look-back from
 * 1 AI turn (state.lastAiText) to the last 3 AI turns. PDF#38 Flipkart
 * T5 and T7 carried byte-identical canonical phrasing with a non-
 * matching T6 in between; the original guard never compared T7 to T5
 * (only to T6) and let the repeat through. Now we fingerprint the
 * candidate text against EACH of the last 3 AI utterances. */
export const VERBATIM_LOOKBACK_AI_TURNS = 3;
export function isVerbatimRepeat(text: string, state: NegotiationState): boolean {
  if (!text) return false;
  const aKey = _normalizeForLoopCompare(text);
  if (aKey.split(/\s+/).filter(Boolean).length < MIN_CONTENT_WORDS) return false;
  const log = state.conversationLog ?? [];
  const aiTurns: string[] = [];
  for (let i = log.length - 1; i >= 0 && aiTurns.length < VERBATIM_LOOKBACK_AI_TURNS; i--) {
    const entry = log[i];
    if (entry && entry.speaker === "ai" && entry.text) aiTurns.push(entry.text);
  }
  if (aiTurns.length === 0 && state.lastAiText) aiTurns.push(state.lastAiText);
  for (const prior of aiTurns) {
    const bKey = _normalizeForLoopCompare(prior);
    if (bKey.split(/\s+/).filter(Boolean).length < MIN_CONTENT_WORDS) continue;
    if (bKey === aKey) return true;
  }
  return false;
}

export const STOP_WORDS = new Set([
  "the","a","an","is","are","be","you","your","i","we","our","that","this","of","to","for",
  "and","or","but","with","what","how","do","does","can","could","would","should","let","me",
  "just","in","on","at","by","as","so","if","like","than","then","its","it","ll","ve","re",
]);

export function fingerprintWords(s: string): string[] {
  return s.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

/* ─── Serialization ──────────────────────────────────────────────── */

/* JSON-safe state for over-the-wire transit. Sets/Maps and `readonly`
   round-trip cleanly because NegotiationState uses plain arrays. */
/* Audit follow-up (2026-05-21) — wire-format version. Embedded under
 * the reserved `__v` key on every serialized state. The kernel reads
 * it on deserialize to refuse FUTURE-versioned payloads loudly (rather
 * than letting an unknown shape silently coerce through the
 * back-compat backfill chain). Bump this number ONLY when a kernel
 * change makes prior serialized states incompatible (field rename,
 * shape change, enum narrowing). Adding new fields with defaults does
 * NOT require a bump — the backfill block in deserializeState handles
 * that case. */
export const KERNEL_STATE_VERSION = 1;

export function serializeState(state: NegotiationState): string {
  /* Embed `__v` so a future kernel can refuse stale formats. The key
   * is deliberately namespaced (`__` prefix) so it cannot collide with
   * a legitimate state field name. */
  return JSON.stringify({ ...state, __v: KERNEL_STATE_VERSION });
}

export const VALID_PHASES: ReadonlySet<NegotiationPhase> = new Set<NegotiationPhase>([
  "opening",
  "range-disclosure",
  "offer-presented",
  "probe-expectations",
  "counter-offer",
  "lever-explore",
  "closing-push",
  "accepted",
  "walked-away",
  "stalemate",
]);

/* Exhaustive registry of every NegotiationLever, keyed by a
 * `Record<NegotiationLever, true>` so the COMPILER rejects this object the
 * moment a lever is added to the union without being registered here.
 *
 * Gap C (2026-06-17) — `probe-justification` and `acknowledge-and-recover`
 * were both emittable by the planner / move-picker (they assign
 * `move.lever`) but were missing from the old hand-maintained set. Because
 * `applyAiMove` appends `move.lever` to `state.leversUsed` and
 * `validateState` rejects any lever not in this set, the FIRST time either
 * fired (e.g. a contradiction-callout fires `acknowledge-and-recover`) the
 * next turn's `deserializeState` threw `state.leversUsed`, `negotiate-turn`
 * returned 400 "Invalid state", and the session died un-resumably in
 * `phase:"opening"` (the bad lever sticks in the array, so every later turn
 * 400s too — even ones whose own lever is valid). The Record shape is the
 * fix AND the guard: drift can no longer compile. */
export const VALID_LEVER_RECORD: Record<NegotiationLever, true> = {
  "open-with-offer": true,
  "probe": true,
  "probe-justification": true,
  "counter-base": true,
  "joining-bonus": true,
  "equity-grant": true,
  "notice-buyout": true,
  "benefits-summary": true,
  "compensation-summary": true,
  "notice-period-summary": true,
  "hike-context-summary": true,
  "hold-firm": true,
  "close-acceptance": true,
  "close-walkaway": true,
  "close-stalemate": true,
  "terminal-restate": true,
  "acknowledge-and-recover": true,
  "ctc-inflation-anchor": true,
};
export const VALID_LEVERS: ReadonlySet<NegotiationLever> = new Set(
  Object.keys(VALID_LEVER_RECORD) as NegotiationLever[],
);

export function isFiniteNonNegInt(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && Number.isInteger(n);
}
export function isFiniteNumOrNull(n: unknown): n is number | null {
  return n === null || (typeof n === "number" && Number.isFinite(n));
}

/** Throws if `state` is not a structurally valid NegotiationState. The
 *  route relies on this — malformed/out-of-sequence state from the
 *  client must not silently flow into applyCandidateAnswer. */
export function validateState(state: unknown): asserts state is NegotiationState {
  if (!state || typeof state !== "object") throw new Error("state: not an object");
  const s = state as Record<string, unknown>;
  if (typeof s.sessionId !== "string" || !s.sessionId) throw new Error("state.sessionId");
  if (typeof s.role !== "string") throw new Error("state.role");
  if (typeof s.company !== "string") throw new Error("state.company");
  const band = s.band as Record<string, unknown> | undefined;
  if (!band || typeof band !== "object") throw new Error("state.band");
  if (typeof band.initialOffer !== "number" || !Number.isFinite(band.initialOffer)) throw new Error("state.band.initialOffer");
  if (typeof band.maxStretch !== "number" || !Number.isFinite(band.maxStretch)) throw new Error("state.band.maxStretch");
  if (typeof band.walkAway !== "number" || !Number.isFinite(band.walkAway)) throw new Error("state.band.walkAway");
  if (typeof band.hasEquity !== "boolean") throw new Error("state.band.hasEquity");
  /* 2026-05-29 audit pass — band ordering invariants. Pre-existing
   * shape checks only proved the three numbers were finite; nothing
   * caught a band-resolver bug that emitted walkAway > initialOffer
   * (recruiter opens below their own floor) or maxStretch <
   * initialOffer (recruiter can't move up at all). Both were
   * representable in the type, both ship as silently wrong sessions.
   * Assert the natural ordering here so the resolver fails fast
   * instead of producing a session that bottoms out at turn 2. */
  if (!(band.walkAway > 0)) throw new Error("state.band.walkAway-non-positive");
  if (!(band.initialOffer >= band.walkAway)) throw new Error("state.band.initialOffer-below-walkAway");
  if (!(band.maxStretch >= band.initialOffer)) throw new Error("state.band.maxStretch-below-initialOffer");
  /* Component bounds (Phase 12) — when present, base bounds and
   * variable cap must be non-negative and base bounds must be ordered. */
  if (band.baseFloor !== undefined) {
    if (typeof band.baseFloor !== "number" || !Number.isFinite(band.baseFloor) || band.baseFloor < 0) {
      throw new Error("state.band.baseFloor");
    }
  }
  if (band.baseStretch !== undefined) {
    if (typeof band.baseStretch !== "number" || !Number.isFinite(band.baseStretch) || band.baseStretch < 0) {
      throw new Error("state.band.baseStretch");
    }
    if (typeof band.baseFloor === "number" && !(band.baseStretch >= band.baseFloor)) {
      throw new Error("state.band.baseStretch-below-baseFloor");
    }
  }
  if (band.variableMax !== undefined) {
    if (typeof band.variableMax !== "number" || !Number.isFinite(band.variableMax) || band.variableMax < 0) {
      throw new Error("state.band.variableMax");
    }
  }
  /* Fresher-flow probation extension — probationOffer must sit at or
   * below initialOffer (it's the reduced rate during probation, not a
   * higher number). */
  if (band.probationOffer !== undefined) {
    if (typeof band.probationOffer !== "number" || !Number.isFinite(band.probationOffer) || band.probationOffer <= 0) {
      throw new Error("state.band.probationOffer");
    }
    if (band.probationOffer > band.initialOffer) {
      throw new Error("state.band.probationOffer-above-initialOffer");
    }
  }
  if (band.probationMonths !== undefined) {
    if (typeof band.probationMonths !== "number" || !Number.isFinite(band.probationMonths) || band.probationMonths <= 0) {
      throw new Error("state.band.probationMonths");
    }
  }
  if (typeof s.phase !== "string" || !VALID_PHASES.has(s.phase as NegotiationPhase)) throw new Error("state.phase");
  if (!isFiniteNonNegInt(s.turnIndex)) throw new Error("state.turnIndex");
  if (!isFiniteNonNegInt(s.maxTurns) || s.maxTurns === 0) throw new Error("state.maxTurns");
  if (s.turnIndex > s.maxTurns + 1) throw new Error("state.turnIndex exceeds maxTurns");
  if (!isFiniteNumOrNull(s.candidateTarget)) throw new Error("state.candidateTarget");
  if (!isFiniteNumOrNull(s.candidateCurrentCtc)) throw new Error("state.candidateCurrentCtc");
  if (s.candidateCurrentCompany != null && (typeof s.candidateCurrentCompany !== "string" || s.candidateCurrentCompany.length === 0 || s.candidateCurrentCompany.length > 60)) {
    throw new Error("state.candidateCurrentCompany");
  }
  /* PDF #28 PR-1 — ledger shape check. Optional field (pre-PR-1
   * serialized sessions have no ledger). When present, must be an
   * object with an entries array. Entry-level shape is enforced by
   * the discriminated union at every writer site. */
  if (s.ledger !== undefined) {
    const led = s.ledger as { entries?: unknown } | null;
    if (led === null || typeof led !== "object" || !Array.isArray(led.entries)) {
      throw new Error("state.ledger");
    }
  }
  if (!isFiniteNumOrNull(s.competingOffer)) throw new Error("state.competingOffer");
  if (typeof s.highestOfferMade !== "number" || !Number.isFinite(s.highestOfferMade)) throw new Error("state.highestOfferMade");
  if (!Array.isArray(s.leversUsed) || !s.leversUsed.every((l) => typeof l === "string" && VALID_LEVERS.has(l as NegotiationLever))) {
    throw new Error("state.leversUsed");
  }
  if (typeof s.lastAiText !== "string") throw new Error("state.lastAiText");
  /* Phase 28 — sticky JB amount. Optional for back-compat with legacy
     in-flight sessions; deserializeState backfills to null. */
  if (s.lastJoiningBonusOffered !== undefined && !isFiniteNumOrNull(s.lastJoiningBonusOffered)) {
    throw new Error("state.lastJoiningBonusOffered");
  }
  if (s.acceptedAtTurn !== null && !isFiniteNonNegInt(s.acceptedAtTurn)) throw new Error("state.acceptedAtTurn");
  if (
    s.postAcceptanceDocsRequestedAtTurn !== undefined &&
    s.postAcceptanceDocsRequestedAtTurn !== null &&
    !isFiniteNonNegInt(s.postAcceptanceDocsRequestedAtTurn)
  ) {
    throw new Error("state.postAcceptanceDocsRequestedAtTurn");
  }
  if (s.walkedAwayAtTurn !== null && !isFiniteNonNegInt(s.walkedAwayAtTurn)) throw new Error("state.walkedAwayAtTurn");
  if (s.stalemateAtTurn !== undefined && s.stalemateAtTurn !== null && !isFiniteNonNegInt(s.stalemateAtTurn)) throw new Error("state.stalemateAtTurn");
  /* Phase 3 missing-lever set (2026-05-17) — single-fire turn markers. */
  if (
    s.panelApprovalStallFiredAtTurn !== undefined &&
    s.panelApprovalStallFiredAtTurn !== null &&
    !isFiniteNonNegInt(s.panelApprovalStallFiredAtTurn)
  ) {
    throw new Error("state.panelApprovalStallFiredAtTurn");
  }
  if (
    s.politeWalkawayFiredAtTurn !== undefined &&
    s.politeWalkawayFiredAtTurn !== null &&
    !isFiniteNonNegInt(s.politeWalkawayFiredAtTurn)
  ) {
    throw new Error("state.politeWalkawayFiredAtTurn");
  }
  if (
    s.hikeStrongDefenseFiredAtTurn !== undefined &&
    s.hikeStrongDefenseFiredAtTurn !== null &&
    !isFiniteNonNegInt(s.hikeStrongDefenseFiredAtTurn)
  ) {
    throw new Error("state.hikeStrongDefenseFiredAtTurn");
  }
  if (
    s.fakeLeverageChallengeFiredAtTurn !== undefined &&
    s.fakeLeverageChallengeFiredAtTurn !== null &&
    !isFiniteNonNegInt(s.fakeLeverageChallengeFiredAtTurn)
  ) {
    throw new Error("state.fakeLeverageChallengeFiredAtTurn");
  }
  if (
    s.holdGrantedAtTurn !== undefined &&
    s.holdGrantedAtTurn !== null &&
    !isFiniteNonNegInt(s.holdGrantedAtTurn)
  ) {
    throw new Error("state.holdGrantedAtTurn");
  }
  if (
    s.competitorMatchFiredAtTurn !== undefined &&
    s.competitorMatchFiredAtTurn !== null &&
    !isFiniteNonNegInt(s.competitorMatchFiredAtTurn)
  ) {
    throw new Error("state.competitorMatchFiredAtTurn");
  }
  if (
    s.ctcInflationAnchorCtcLpa !== undefined &&
    s.ctcInflationAnchorCtcLpa !== null &&
    !(typeof s.ctcInflationAnchorCtcLpa === "number" && Number.isFinite(s.ctcInflationAnchorCtcLpa) && s.ctcInflationAnchorCtcLpa > 0)
  ) {
    throw new Error("state.ctcInflationAnchorCtcLpa");
  }
  /* Backward-compatible optional fields: tolerate absence (older
     in-flight sessions) but reject malformed values. deserializeState
     backfills defaults so the rest of the kernel sees a fully-shaped
     state. */
  if (s.finalOfferAssertedCount !== undefined && !isFiniteNonNegInt(s.finalOfferAssertedCount)) throw new Error("state.finalOfferAssertedCount");
  if (s.candidateAskedAsRange !== undefined && typeof s.candidateAskedAsRange !== "boolean") throw new Error("state.candidateAskedAsRange");
  if (s.candidateTargetWasRange !== undefined && typeof s.candidateTargetWasRange !== "boolean") throw new Error("state.candidateTargetWasRange");
  if (s.vossTacticsUsed !== undefined && !(Array.isArray(s.vossTacticsUsed) && s.vossTacticsUsed.every((v) => typeof v === "string"))) throw new Error("state.vossTacticsUsed");
  if (s.infoAsked !== undefined && !(Array.isArray(s.infoAsked) && s.infoAsked.every((v) => typeof v === "string"))) throw new Error("state.infoAsked");
  if (s.infoAskedInitiated !== undefined && !(Array.isArray(s.infoAskedInitiated) && s.infoAskedInitiated.every((v) => typeof v === "string"))) throw new Error("state.infoAskedInitiated");
  if (s.verbalAcceptanceTurn !== undefined && s.verbalAcceptanceTurn !== null && !isFiniteNonNegInt(s.verbalAcceptanceTurn)) throw new Error("state.verbalAcceptanceTurn");
  if (s.postVerbalRenegotiationCount !== undefined && !isFiniteNonNegInt(s.postVerbalRenegotiationCount)) throw new Error("state.postVerbalRenegotiationCount");
  /* perfect 1 (2026-05-16) — counterRound spiral counter. Optional for
   * back-compat with sessions serialized before this field shipped. */
  if (s.counterRound !== undefined && !isFiniteNonNegInt(s.counterRound)) throw new Error("state.counterRound");
  if (s.recentRecoveryActive !== undefined && typeof s.recentRecoveryActive !== "boolean") throw new Error("state.recentRecoveryActive");
  if (s.walkAwayReturned !== undefined && typeof s.walkAwayReturned !== "boolean") throw new Error("state.walkAwayReturned");
  if (s.pendingCandidateAcks !== undefined) {
    if (!Array.isArray(s.pendingCandidateAcks)) throw new Error("state.pendingCandidateAcks");
    for (const entry of s.pendingCandidateAcks) {
      if (!entry || typeof entry !== "object") throw new Error("state.pendingCandidateAcks[].shape");
      const e = entry as Record<string, unknown>;
      if (typeof e.kind !== "string") throw new Error("state.pendingCandidateAcks[].kind");
      if (typeof e.label !== "string") throw new Error("state.pendingCandidateAcks[].label");
    }
  }
  /* Negotiation-flow redesign commit 4 (2026-05-15) — reactiveFollowupsFired
   * is optional + sticky. Reject only malformed shape. */
  /* 2026-05-29 realism-pass — candidateQuestionServeCount validator. */
  if (s.candidateQuestionServeCount !== undefined) {
    if (
      s.candidateQuestionServeCount === null ||
      typeof s.candidateQuestionServeCount !== "object" ||
      Array.isArray(s.candidateQuestionServeCount)
    ) {
      throw new Error("state.candidateQuestionServeCount");
    }
    for (const v of Object.values(s.candidateQuestionServeCount)) {
      if (!isFiniteNonNegInt(v)) {
        throw new Error("state.candidateQuestionServeCount.value");
      }
    }
  }
  if (s.reactiveFollowupsFired !== undefined) {
    if (!Array.isArray(s.reactiveFollowupsFired) || !s.reactiveFollowupsFired.every((v) => typeof v === "string")) {
      throw new Error("state.reactiveFollowupsFired");
    }
  }
  /* 2026-05-29 realism-pass — candidateRegister validator. */
  if (s.candidateRegister !== undefined) {
    if (
      s.candidateRegister !== "formal"
      && s.candidateRegister !== "casual"
      && s.candidateRegister !== "direct"
      && s.candidateRegister !== "neutral"
    ) {
      throw new Error("state.candidateRegister");
    }
  }
  /* Polish 2 (2026-05-16) — reactiveFollowupsFireLog validator. */
  if (s.reactiveFollowupsFireLog !== undefined) {
    if (
      s.reactiveFollowupsFireLog === null ||
      typeof s.reactiveFollowupsFireLog !== "object" ||
      Array.isArray(s.reactiveFollowupsFireLog)
    ) {
      throw new Error("state.reactiveFollowupsFireLog");
    }
    for (const [k, v] of Object.entries(s.reactiveFollowupsFireLog)) {
      if (typeof k !== "string") throw new Error("state.reactiveFollowupsFireLog.key");
      if (!Array.isArray(v) || !v.every((n) => typeof n === "number" && Number.isFinite(n))) {
        throw new Error("state.reactiveFollowupsFireLog.value");
      }
    }
  }
  /* Fix 1 (2026-05-16) — leversFired ledger validator. */
  if (s.leversFired !== undefined) {
    if (!Array.isArray(s.leversFired) || !s.leversFired.every((v) => typeof v === "string")) {
      throw new Error("state.leversFired");
    }
  }
  /* Bad-faith tactic ledgers validator (2026-05-29). */
  if (s.tacticsUsed !== undefined) {
    if (!Array.isArray(s.tacticsUsed) || !s.tacticsUsed.every((v) => typeof v === "string")) {
      throw new Error("state.tacticsUsed");
    }
  }
  if (s.userCaughtTactics !== undefined) {
    if (!Array.isArray(s.userCaughtTactics) || !s.userCaughtTactics.every((v) => typeof v === "string")) {
      throw new Error("state.userCaughtTactics");
    }
  }
  /* Audit follow-up (2026-05-21) — answeredQuestionLedger validator.
   * Optional for back-compat. When present, every value must be
   * { answerText: string, turn: finite non-neg int }. */
  if (s.answeredQuestionLedger !== undefined) {
    if (
      s.answeredQuestionLedger === null ||
      typeof s.answeredQuestionLedger !== "object" ||
      Array.isArray(s.answeredQuestionLedger)
    ) {
      throw new Error("state.answeredQuestionLedger");
    }
    for (const [k, v] of Object.entries(s.answeredQuestionLedger)) {
      if (typeof k !== "string" || k.length === 0) {
        throw new Error("state.answeredQuestionLedger.key");
      }
      if (!v || typeof v !== "object") throw new Error("state.answeredQuestionLedger.value");
      const entry = v as { answerText?: unknown; turn?: unknown };
      if (typeof entry.answerText !== "string") throw new Error("state.answeredQuestionLedger.answerText");
      if (!isFiniteNonNegInt(entry.turn)) throw new Error("state.answeredQuestionLedger.turn");
    }
    /* DEBT #2 (2026-05-21) — cardinality cap. applyAiMove evicts LRU-
     * by-turn before re-write, so a well-formed state from THIS kernel
     * will never exceed the cap. Reject any payload that does. */
    if (Object.keys(s.answeredQuestionLedger).length > MAX_LEDGER_ENTRIES) {
      throw new Error("state.answeredQuestionLedger.size");
    }
  }
  if (s.hardBandCap !== undefined && typeof s.hardBandCap !== "boolean") throw new Error("state.hardBandCap");
  if (s.marketMode !== undefined && s.marketMode !== "soft" && s.marketMode !== "neutral" && s.marketMode !== "hot") throw new Error("state.marketMode");
  if (
    s.recruiterPersona !== undefined &&
    s.recruiterPersona !== "hardline" &&
    s.recruiterPersona !== "consultative" &&
    s.recruiterPersona !== "founder" &&
    s.recruiterPersona !== "agency"
  ) {
    throw new Error("state.recruiterPersona");
  }
  /* Phase 3 — recruiterSectorPersona validator. Optional for back-compat
   * with in-flight sessions serialised before Phase 3 shipped. */
  if (
    s.recruiterSectorPersona !== undefined &&
    s.recruiterSectorPersona !== "it-services" &&
    s.recruiterSectorPersona !== "gcc" &&
    s.recruiterSectorPersona !== "indian-unicorn" &&
    s.recruiterSectorPersona !== "early-startup" &&
    s.recruiterSectorPersona !== "bfsi" &&
    /* Realism-Audit Fix 1 (2026-05-22) — three new personas. */
    s.recruiterSectorPersona !== "psu" &&
    s.recruiterSectorPersona !== "consulting-big4" &&
    s.recruiterSectorPersona !== "fmcg-management" &&
    /* 2026-05-29 sector-flavor pass — edtech + MBB personas. */
    s.recruiterSectorPersona !== "edtech" &&
    s.recruiterSectorPersona !== "consulting-mbb" &&
    s.recruiterSectorPersona !== "default"
  ) {
    throw new Error("state.recruiterSectorPersona");
  }
  /* 2026-05-29 mood-pass — recruiterMood validator. Optional for
   * back-compat with in-flight sessions and partial-state test
   * fixtures; deserializeState backfills to "warm". */
  if (
    s.recruiterMood !== undefined &&
    s.recruiterMood !== "warm" &&
    s.recruiterMood !== "brusque" &&
    s.recruiterMood !== "frantic"
  ) {
    throw new Error("state.recruiterMood");
  }
  /* 2026-05-30 time-context validator. Optional; deserializeState
   * backfills to "midweek-standard" when absent on serialized state. */
  if (
    s.timeContext !== undefined &&
    s.timeContext !== "monday-fresh" &&
    s.timeContext !== "midweek-standard" &&
    s.timeContext !== "friday-rush" &&
    s.timeContext !== "lunch-distracted" &&
    s.timeContext !== "after-hours-tired" &&
    s.timeContext !== "weekend-unusual"
  ) {
    throw new Error("state.timeContext");
  }
  /* 2026-05-29 mood-shift-pass — recruiterMoodDynamic validator. */
  if (
    s.recruiterMoodDynamic !== undefined &&
    s.recruiterMoodDynamic !== "baseline" &&
    s.recruiterMoodDynamic !== "cooled" &&
    s.recruiterMoodDynamic !== "rewarmed"
  ) {
    throw new Error("state.recruiterMoodDynamic");
  }
  if (s.candidateComponentBreakdown !== undefined) {
    const cb = s.candidateComponentBreakdown as Record<string, unknown>;
    if (!cb || typeof cb !== "object") throw new Error("state.candidateComponentBreakdown");
    for (const k of ["base", "variable", "equity"] as const) {
      if (!isFiniteNumOrNull(cb[k])) throw new Error(`state.candidateComponentBreakdown.${k}`);
    }
    if (typeof cb.hasAny !== "boolean") throw new Error("state.candidateComponentBreakdown.hasAny");
  }
  /* Phase 11–16 optional fields. Tolerate absence on legacy in-flight
     sessions; deserializeState backfills. Reject only malformed
     shapes. Lightweight checks — we don't enum-validate every value,
     just structural shape, because adversarial state authorship is
     already gated by the route auth + idempotency. */
  if (s.hikePercent !== undefined && !isFiniteNumOrNull(s.hikePercent)) {
    throw new Error("state.hikePercent");
  }
  if (s.rationale !== undefined && s.rationale !== null) {
    const r = s.rationale as Record<string, unknown>;
    if (typeof r !== "object" || typeof r.kind !== "string" || typeof r.evidence !== "string") {
      throw new Error("state.rationale");
    }
  }
  if (s.noticeJoining !== undefined) {
    const nj = s.noticeJoining as Record<string, unknown>;
    if (!nj || typeof nj !== "object") throw new Error("state.noticeJoining");
    if (!isFiniteNumOrNull(nj.noticePeriodDays)) throw new Error("state.noticeJoining.noticePeriodDays");
    if (typeof nj.buyoutRequested !== "boolean") throw new Error("state.noticeJoining.buyoutRequested");
    if (!isFiniteNumOrNull(nj.joiningBonusAsk)) throw new Error("state.noticeJoining.joiningBonusAsk");
    if (typeof nj.earlyJoinPreferred !== "boolean") throw new Error("state.noticeJoining.earlyJoinPreferred");
    if (typeof nj.hasAny !== "boolean") throw new Error("state.noticeJoining.hasAny");
  }
  if (s.equityVesting !== undefined) {
    const ev = s.equityVesting as Record<string, unknown>;
    if (!ev || typeof ev !== "object") throw new Error("state.equityVesting");
    if (!isFiniteNumOrNull(ev.vestingYears)) throw new Error("state.equityVesting.vestingYears");
    if (!isFiniteNumOrNull(ev.cliffMonths)) throw new Error("state.equityVesting.cliffMonths");
    if (ev.preference !== null && typeof ev.preference !== "string") throw new Error("state.equityVesting.preference");
    if (ev.familiarity !== null && typeof ev.familiarity !== "string") throw new Error("state.equityVesting.familiarity");
    if (typeof ev.hasAny !== "boolean") throw new Error("state.equityVesting.hasAny");
  }
  if (s.locationMode !== undefined) {
    const lm = s.locationMode as Record<string, unknown>;
    if (!lm || typeof lm !== "object") throw new Error("state.locationMode");
    if (lm.workMode !== null && typeof lm.workMode !== "string") throw new Error("state.locationMode.workMode");
    if (lm.locationCity !== null && typeof lm.locationCity !== "string") throw new Error("state.locationMode.locationCity");
    if (typeof lm.relocationRequested !== "boolean") throw new Error("state.locationMode.relocationRequested");
    if (typeof lm.relocationRefused !== "boolean") throw new Error("state.locationMode.relocationRefused");
    if (typeof lm.hasAny !== "boolean") throw new Error("state.locationMode.hasAny");
  }
  if (s.competingOfferDetail !== undefined) {
    const co = s.competingOfferDetail as Record<string, unknown>;
    if (!co || typeof co !== "object") throw new Error("state.competingOfferDetail");
    if (co.company !== null && typeof co.company !== "string") throw new Error("state.competingOfferDetail.company");
    if (co.status !== null && typeof co.status !== "string") throw new Error("state.competingOfferDetail.status");
    if (co.stage !== null && typeof co.stage !== "string") throw new Error("state.competingOfferDetail.stage");
    if (typeof co.letterShareOffered !== "boolean") throw new Error("state.competingOfferDetail.letterShareOffered");
    /* fake-leverage-challenge (2026-05-17) — proofRequestedAtTurn /
     * proofProvided are optional on legacy serialized snapshots;
     * deserializeState backfills via backfillCompetingOfferDetail.
     * Validate shape only when present. */
    if (
      co.proofRequestedAtTurn !== undefined &&
      co.proofRequestedAtTurn !== null &&
      !isFiniteNonNegInt(co.proofRequestedAtTurn)
    ) {
      throw new Error("state.competingOfferDetail.proofRequestedAtTurn");
    }
    if (
      co.proofProvided !== undefined &&
      typeof co.proofProvided !== "boolean"
    ) {
      throw new Error("state.competingOfferDetail.proofProvided");
    }
    /* fake-leverage-challenge (2026-05-17) — amount is optional on
     * legacy serialized snapshots; backfilled to null by the
     * backfillCompetingOfferDetail folder. Shape-check when present. */
    if (
      co.amount !== undefined &&
      co.amount !== null &&
      (typeof co.amount !== "number" || !Number.isFinite(co.amount))
    ) {
      throw new Error("state.competingOfferDetail.amount");
    }
    if (typeof co.hasAny !== "boolean") throw new Error("state.competingOfferDetail.hasAny");
  }
  /* Phase 17 optional fields — structural shape checks only. */
  if (s.decisionDeadline !== undefined) {
    const dd = s.decisionDeadline as Record<string, unknown>;
    if (!dd || typeof dd !== "object") throw new Error("state.decisionDeadline");
    if (!isFiniteNumOrNull(dd.deadlineDays)) throw new Error("state.decisionDeadline.deadlineDays");
    if (typeof dd.deadlineExplicit !== "boolean") throw new Error("state.decisionDeadline.deadlineExplicit");
    if (typeof dd.conditionalAcceptance !== "boolean") throw new Error("state.decisionDeadline.conditionalAcceptance");
    if (dd.conditionalEvidence !== null && typeof dd.conditionalEvidence !== "string") throw new Error("state.decisionDeadline.conditionalEvidence");
    if (typeof dd.hasAny !== "boolean") throw new Error("state.decisionDeadline.hasAny");
  }
  /* Phase 29 — role-applicable YOE. All three optional + null-tolerant
   * for back-compat with in-flight sessions. */
  if (s.candidateTotalYoe !== undefined && !isFiniteNumOrNull(s.candidateTotalYoe)) {
    throw new Error("state.candidateTotalYoe");
  }
  if (s.candidateApplicableYoe !== undefined && !isFiniteNumOrNull(s.candidateApplicableYoe)) {
    throw new Error("state.candidateApplicableYoe");
  }
  if (
    s.candidatePrimaryDomain !== undefined &&
    s.candidatePrimaryDomain !== null &&
    typeof s.candidatePrimaryDomain !== "string"
  ) {
    throw new Error("state.candidatePrimaryDomain");
  }
  if (s.candidateProfile !== undefined) {
    const cp = s.candidateProfile as Record<string, unknown>;
    if (!cp || typeof cp !== "object") throw new Error("state.candidateProfile");
    if (!isFiniteNumOrNull(cp.careerGapMonths)) throw new Error("state.candidateProfile.careerGapMonths");
    if (cp.careerGapActivity !== null && typeof cp.careerGapActivity !== "string") throw new Error("state.candidateProfile.careerGapActivity");
    if (cp.tenureSignal !== null && typeof cp.tenureSignal !== "string") throw new Error("state.candidateProfile.tenureSignal");
    if (cp.levelMismatch !== null && typeof cp.levelMismatch !== "string") throw new Error("state.candidateProfile.levelMismatch");
    if (typeof cp.hasAny !== "boolean") throw new Error("state.candidateProfile.hasAny");
  }
  if (s.miscSignals !== undefined) {
    const ms = s.miscSignals as Record<string, unknown>;
    if (!ms || typeof ms !== "object") throw new Error("state.miscSignals");
    if (!isFiniteNumOrNull(ms.candidateFloor)) throw new Error("state.miscSignals.candidateFloor");
    if (!isFiniteNumOrNull(ms.salaryReviewMonths)) throw new Error("state.miscSignals.salaryReviewMonths");
    if (ms.proofOfCtcShareable !== null && typeof ms.proofOfCtcShareable !== "boolean") throw new Error("state.miscSignals.proofOfCtcShareable");
    if (ms.internalCounterRisk !== null && typeof ms.internalCounterRisk !== "string") throw new Error("state.miscSignals.internalCounterRisk");
    if (typeof ms.hasAny !== "boolean") throw new Error("state.miscSignals.hasAny");
  }
  /* Phase 18 — candidate stance. Optional for backwards-compat. */
  if (s.candidateStance !== undefined) {
    const cs = s.candidateStance as Record<string, unknown>;
    if (!cs || typeof cs !== "object") throw new Error("state.candidateStance");
    if (cs.flexibilityPosture !== null && typeof cs.flexibilityPosture !== "string") {
      throw new Error("state.candidateStance.flexibilityPosture");
    }
    for (const k of ["marketReferenceVague", "salaryOnlyFactor", "badmouthsCurrent", "confidentialOvershare", "soundsDesperate", "treatsEquityAsCash", "hasAny"] as const) {
      if (typeof cs[k] !== "boolean") throw new Error(`state.candidateStance.${k}`);
    }
    /* Phase 19 — corpus-derived stance booleans. Optional for back-compat. */
    for (const k of ["avoidsAnchor", "personalExpenseJustification", "offerShoppingDemand", "dismissesVariableRisk", "overpromisesJoining"] as const) {
      if (cs[k] !== undefined && typeof cs[k] !== "boolean") throw new Error(`state.candidateStance.${k}`);
    }
  }
  /* Bug 7 — recruiter-facts-already-said. Optional + string array. */
  if (s.recruiterFactsAlreadySaid !== undefined) {
    if (!Array.isArray(s.recruiterFactsAlreadySaid) || !s.recruiterFactsAlreadySaid.every((v) => typeof v === "string")) {
      throw new Error("state.recruiterFactsAlreadySaid");
    }
  }
  /* Fix 3 (2026-05-15) — pendingPromises optional + string array. */
  if (s.pendingPromises !== undefined) {
    if (!Array.isArray(s.pendingPromises) || !s.pendingPromises.every((v) => typeof v === "string")) {
      throw new Error("state.pendingPromises");
    }
  }
  /* Fix 4 (2026-05-15) — lastBotReply optional + string-or-null. */
  if (s.lastBotReply !== undefined && s.lastBotReply !== null && typeof s.lastBotReply !== "string") {
    throw new Error("state.lastBotReply");
  }
  /* Fix 7 (2026-05-15) — anchorLocked optional boolean, lockedAnchorLpa optional number-or-null. */
  if (s.anchorLocked !== undefined && typeof s.anchorLocked !== "boolean") {
    throw new Error("state.anchorLocked");
  }
  if (
    s.lockedAnchorLpa !== undefined &&
    s.lockedAnchorLpa !== null &&
    (typeof s.lockedAnchorLpa !== "number" || !Number.isFinite(s.lockedAnchorLpa))
  ) {
    throw new Error("state.lockedAnchorLpa");
  }
  /* Fix 3 (PDF #17 follow-up, 2026-05-15) — minTurnsBeforeClose optional number. */
  if (
    s.minTurnsBeforeClose !== undefined &&
    (typeof s.minTurnsBeforeClose !== "number" || !Number.isFinite(s.minTurnsBeforeClose) || s.minTurnsBeforeClose < 0)
  ) {
    throw new Error("state.minTurnsBeforeClose");
  }
  /* PDF #17 architectural fix (2026-05-15) — discoveryChecklist
   * optional; when present every key must be boolean. */
  if (s.discoveryChecklist !== undefined) {
    const dc = s.discoveryChecklist as Record<string, unknown>;
    if (!dc || typeof dc !== "object") throw new Error("state.discoveryChecklist");
    const keys: (keyof DiscoveryChecklist)[] = [
      "currentCtcAsked", "currentCtcAnswered",
      "fixedVariableSplitAsked", "fixedVariableSplitAnswered",
      "noticePeriodAsked", "noticePeriodAnswered",
      "competingOffersAsked", "competingOffersAnswered",
      "valueProofAsked", "valueProofAnswered",
      "targetAsked", "targetAnswered",
      "variableComfortTested", "commitmentValidationAsked",
      "currentCtcFixedVariableSplitDisclosed",
      "expectedCtcFixedVariableSplitDisclosed",
    ];
    for (const k of keys) {
      if (dc[k] !== undefined && typeof dc[k] !== "boolean") {
        throw new Error(`state.discoveryChecklist.${k}`);
      }
    }
  }
  if (s.discoveryStage !== undefined && !isValidDiscoveryStage(s.discoveryStage)) {
    throw new Error("state.discoveryStage");
  }
  /* Prompt-injection defense ledger (2026-05-17) — optional for
     back-compat with sessions serialized before this field shipped.
     When present must be an array of { atTurn, patterns, originalLength,
     sanitizedLength }. */
  if (s.promptInjectionAttempts !== undefined) {
    if (!Array.isArray(s.promptInjectionAttempts)) {
      throw new Error("state.promptInjectionAttempts");
    }
    for (const entry of s.promptInjectionAttempts) {
      if (!entry || typeof entry !== "object") {
        throw new Error("state.promptInjectionAttempts[].shape");
      }
      const e = entry as Record<string, unknown>;
      if (!isFiniteNonNegInt(e.atTurn)) {
        throw new Error("state.promptInjectionAttempts[].atTurn");
      }
      if (!Array.isArray(e.patterns) || !e.patterns.every((p) => typeof p === "string")) {
        throw new Error("state.promptInjectionAttempts[].patterns");
      }
      if (!isFiniteNonNegInt(e.originalLength)) {
        throw new Error("state.promptInjectionAttempts[].originalLength");
      }
      if (!isFiniteNonNegInt(e.sanitizedLength)) {
        throw new Error("state.promptInjectionAttempts[].sanitizedLength");
      }
    }
  }
  /* conversationLog: optional for backwards compat with in-flight
     sessions; when present, every entry must have speaker ∈ {ai, candidate}
     and a string text. */
  if (s.conversationLog !== undefined) {
    if (!Array.isArray(s.conversationLog)) throw new Error("state.conversationLog");
    for (const e of s.conversationLog) {
      const entry = e as Record<string, unknown>;
      if (!entry || typeof entry !== "object") throw new Error("state.conversationLog entry");
      if (entry.speaker !== "ai" && entry.speaker !== "candidate") throw new Error("state.conversationLog.speaker");
      if (typeof entry.text !== "string") throw new Error("state.conversationLog.text");
    }
  }
}

export function deserializeState(json: string): NegotiationState {
  const parsed: unknown = JSON.parse(json);
  /* Audit follow-up (2026-05-21) — wire-format version check. Refuse
   * payloads with __v ABOVE the kernel's current KERNEL_STATE_VERSION:
   * that means the client is running a newer kernel and the server
   * has been rolled back / lags behind. Failing loudly here prevents
   * the back-compat backfill chain from silently coercing a
   * future-shape payload into the legacy default values. Payloads
   * with NO __v (legacy in-flight sessions) and with __v ≤ current
   * are accepted as before.
   *
   * DEBT #3 (2026-05-21) — capture __v into a local BEFORE deletion so
   * a future migration hook (e.g. "if wireVersion < 2, migrate field X")
   * can branch on the original wire version. At KERNEL_STATE_VERSION=1
   * the value is unused beyond the bounds check, but exposing it now
   * means the migration scaffolding is already in place when it's
   * actually needed. The local is named (not just left in place on
   * parsed) so the backfill chain below can still run against a
   * __v-stripped payload — validateState would otherwise reject the
   * reserved key as an unknown field. */
  let wireVersion: number | undefined;
  if (parsed && typeof parsed === "object") {
    const rawV = (parsed as { __v?: unknown }).__v;
    if (rawV !== undefined) {
      if (typeof rawV !== "number" || !Number.isFinite(rawV)) {
        throw new Error(`state.__v: expected finite number, got ${typeof rawV}`);
      }
      if (rawV > KERNEL_STATE_VERSION) {
        throw new Error(
          `state.__v=${rawV} exceeds server KERNEL_STATE_VERSION=${KERNEL_STATE_VERSION} ` +
            `(client is newer than server — refusing rather than coercing)`,
        );
      }
      wireVersion = rawV;
      /* Strip __v before downstream validators run. The version marker
       * is wire-only metadata; it is NOT a field on NegotiationState
       * so leaving it in would trip strict shape checks elsewhere. */
      delete (parsed as { __v?: unknown }).__v;
    }
  }
  /* Future migration hooks read `wireVersion` here. Intentionally
   * referenced (no-op) so the linter doesn't strip the local — the
   * value is part of the contract for the next kernel bump. */
  void wireVersion;
  validateState(parsed);
  /* Backfill defaults for optional fields added after the wire format
     was first deployed. Existing in-flight sessions serialized without
     these keys; we default them on read so the rest of the kernel can
     assume they exist. */
  const s = parsed as NegotiationState & Partial<Record<string, unknown>>;
  return {
    ...parsed,
    candidateAskedAsRange: s.candidateAskedAsRange ?? false,
    candidateTargetWasRange: (s.candidateTargetWasRange as boolean | undefined) ?? undefined,
    /* Schema-stability backfill (2026-06-15) — the in-hand frame fields
     * became required (no longer optional). Default in-flight sessions
     * serialized before this change: not-in-hand, no CTC-equivalent. */
    candidateTargetIsInHand: (s.candidateTargetIsInHand as boolean | undefined) ?? false,
    candidateTargetCtcEquivalentLpa:
      (s.candidateTargetCtcEquivalentLpa as number | null | undefined) ?? null,
    /* Audit Pass 3 / Fix 1 (2026-05-16) — backfill stalemate ledger
     * for in-flight sessions serialized before this field shipped. */
    stalemateAtTurn: (s.stalemateAtTurn as number | null | undefined) ?? null,
    /* Phase 3 missing-lever set (2026-05-17) — backfill single-fire turn
     * markers for sessions serialized before this field shipped. */
    panelApprovalStallFiredAtTurn:
      (s.panelApprovalStallFiredAtTurn as number | null | undefined) ?? null,
    politeWalkawayFiredAtTurn:
      (s.politeWalkawayFiredAtTurn as number | null | undefined) ?? null,
    hikeStrongDefenseFiredAtTurn:
      (s.hikeStrongDefenseFiredAtTurn as number | null | undefined) ?? null,
    fakeLeverageChallengeFiredAtTurn:
      (s.fakeLeverageChallengeFiredAtTurn as number | null | undefined) ?? null,
    holdGrantedAtTurn:
      (s.holdGrantedAtTurn as number | null | undefined) ?? null,
    competitorMatchFiredAtTurn:
      (s.competitorMatchFiredAtTurn as number | null | undefined) ?? null,
    ctcInflationAnchorCtcLpa:
      (s.ctcInflationAnchorCtcLpa as number | null | undefined) ?? null,
    firstAnchoredTarget:
      typeof s.firstAnchoredTarget === "number"
        ? s.firstAnchoredTarget
        : (s.candidateTarget as number | null) ?? null,
    /* S42-B8 / S43-B7 back-compat: legacy sessions that pre-date this field
     * (undefined in persisted JSON) default to undefined (not null) so the
     * metrics layer can distinguish "new row with no counter" (null) from
     * "legacy row pre-field" (undefined) and apply legacy fallback there. */
    firstCounterVsOffer:
      "firstCounterVsOffer" in s
        ? (s.firstCounterVsOffer as number | null)
        : undefined,
    finalOfferAssertedCount: s.finalOfferAssertedCount ?? 0,
    vossTacticsUsed: (s.vossTacticsUsed as VossTactic[] | undefined) ?? [],
    infoAsked: (s.infoAsked as InfoIntent[] | undefined) ?? [],
    infoAskedInitiated: (s.infoAskedInitiated as InfoIntent[] | undefined) ?? [],
    verbalAcceptanceTurn: s.verbalAcceptanceTurn ?? null,
    postAcceptanceDocsRequestedAtTurn:
      (s.postAcceptanceDocsRequestedAtTurn as number | null | undefined) ?? null,
    postVerbalRenegotiationCount: (s.postVerbalRenegotiationCount as number | undefined) ?? 0,
    counterRound: (s.counterRound as number | undefined) ?? 0,
    recentRecoveryActive: (s.recentRecoveryActive as boolean | undefined) ?? false,
    walkAwayReturned: s.walkAwayReturned ?? false,
    hardBandCap: s.hardBandCap ?? false,
    marketMode: (s.marketMode as MarketMode | undefined) ?? "neutral",
    recruiterPersona: (s.recruiterPersona as RecruiterPersona | undefined) ?? "consultative",
    /* 2026-06-20 tactic-rotation back-compat: sessions serialized before
     * this field shipped revive with it undefined, so the planner keeps
     * the legacy session-local tacticHash seeding for them. */
    tacticRotation: s.tacticRotation as number | undefined,
    /* Phase 3 — sector-persona back-compat: in-flight sessions
     * serialised before Phase 3 shipped get "default", which renders
     * the legacy prose surfaces (no persona-conditional overrides). */
    recruiterSectorPersona:
      (s.recruiterSectorPersona as RecruiterSectorPersona | undefined) ?? "default",
    /* 2026-05-29 mood-pass — back-compat: legacy sessions get "warm"
     * (current behaviour). New sessions overwrite at initState. */
    recruiterMood:
      (s.recruiterMood as RecruiterMood | undefined) ?? "warm",
    /* 2026-05-30 time-context — back-compat: serialized state from before
     * this field shipped defaults to "midweek-standard" (no-op). */
    timeContext:
      (s.timeContext as TimeContext | undefined) ?? "midweek-standard",
    /* 2026-05-29 mood-shift-pass — backfill defaults preserve
     * baseline behaviour for legacy sessions. */
    recruiterMoodDynamic:
      (s.recruiterMoodDynamic as RecruiterMoodDynamic | undefined) ?? "baseline",
    recruiterMoodDynamicEnteredAtTurn:
      (s.recruiterMoodDynamicEnteredAtTurn as number | null | undefined) ?? null,
    consecutiveOverBandAsks:
      (s.consecutiveOverBandAsks as number | undefined) ?? 0,
    recruiterMoodColdLineFiredAtTurn:
      (s.recruiterMoodColdLineFiredAtTurn as number | null | undefined) ?? null,
    recruiterMoodRewarmLineFiredAtTurn:
      (s.recruiterMoodRewarmLineFiredAtTurn as number | null | undefined) ?? null,
    recruiterMoodPeakCandidateAskLpa:
      (s.recruiterMoodPeakCandidateAskLpa as number | null | undefined) ?? null,
    /* Realism-Audit Fix 3 (2026-05-22) — manager-consult stall state.
     * In-flight sessions serialised before this fix shipped backfill
     * to 0 / null so the planner gate treats them as "no stall in
     * flight, none fired yet". */
    stallTurnsRemaining: (s.stallTurnsRemaining as number | undefined) ?? 0,
    stallsFiredCount: (s.stallsFiredCount as number | undefined) ?? 0,
    lastStallContext:
      (s.lastStallContext as NegotiationState["lastStallContext"] | undefined) ?? null,
    conversationLog: (s.conversationLog as NegotiationState["conversationLog"] | undefined) ?? [],
    candidateComponentBreakdown: (s.candidateComponentBreakdown as ComponentBreakdown | undefined)
      ?? { base: null, variable: null, equity: null, hasAny: false },
    hikePercent: (s.hikePercent as number | null | undefined) ?? null,
    rationale: (s.rationale as RationaleResult | null | undefined) ?? null,
    noticeJoining: backfillNoticeJoining(s.noticeJoining),
    equityVesting: backfillEquityVesting(s.equityVesting),
    locationMode: (s.locationMode as LocationModeResult | undefined) ?? {
      workMode: null, locationCity: null, relocationRequested: false, relocationRefused: false, hasAny: false,
    },
    competingOfferDetail: backfillCompetingOfferDetail(s.competingOfferDetail),
    decisionDeadline: (() => {
      /* S23-B1 back-compat: sessions serialized before requestsHold shipped
       * won't have that field; backfill to false so old sessions still work. */
      const dd = s.decisionDeadline as DecisionDeadlineResult & { requestsHold?: boolean } | undefined;
      if (!dd) return { deadlineDays: null, deadlineExplicit: false, conditionalAcceptance: false, conditionalEvidence: null, requestsHold: false, hasAny: false };
      return { ...dd, requestsHold: dd.requestsHold ?? false };
    })(),
    candidateProfile: backfillCandidateProfile(s.candidateProfile),
    miscSignals: (s.miscSignals as MiscSignalsResult | undefined) ?? {
      candidateFloor: null, salaryReviewMonths: null, proofOfCtcShareable: null, internalCounterRisk: null, hasAny: false,
    },
    candidateStance: backfillCandidateStance(s.candidateStance),
    lastJoiningBonusOffered: (s.lastJoiningBonusOffered as number | null | undefined) ?? null,
    /* S20-B2 (2026-07-22) — equity grant amount. Optional for back-compat. */
    equityGrantAmountLpa: (s.equityGrantAmountLpa as number | null | undefined) ?? null,
    salesOTE: (s.salesOTE as SalesOTEResult | undefined) ?? { ...EMPTY_SALES_OTE },
    contractRate: (s.contractRate as ContractRateResult | undefined) ?? { ...EMPTY_CONTRACT_RATE },
    retentionCounter: (s.retentionCounter as RetentionCounterResult | undefined) ?? { ...EMPTY_RETENTION_COUNTER },
    /* Phase 29 — role-applicable YOE. Optional for back-compat with
     * in-flight sessions serialized before this field shipped. */
    candidateTotalYoe: (s.candidateTotalYoe as number | null | undefined) ?? null,
    candidateApplicableYoe: (s.candidateApplicableYoe as number | null | undefined) ?? null,
    candidatePrimaryDomain: (s.candidatePrimaryDomain as string | null | undefined) ?? null,
    freshGradDisclosed: (s.freshGradDisclosed as boolean | undefined) ?? false,
    wfhFlexibilityMentioned: (s.wfhFlexibilityMentioned as boolean | undefined) ?? false,
    recruiterFactsAlreadySaid: (s.recruiterFactsAlreadySaid as string[] | undefined) ?? [],
    /* Audit follow-up (2026-05-21) — answeredQuestionLedger back-compat
     * default. In-flight sessions serialized before this field shipped
     * deserialise with an empty ledger; the cross-turn coherence
     * short-circuit becomes inert until the next answered question
     * populates it. */
    answeredQuestionLedger:
      (s.answeredQuestionLedger as NegotiationState["answeredQuestionLedger"]) ?? {},
    pendingPromises: (s.pendingPromises as string[] | undefined) ?? [],
    lastBotReply: (s.lastBotReply as string | null | undefined) ?? null,
    anchorLocked: (s.anchorLocked as boolean | undefined) ?? false,
    lockedAnchorLpa: (s.lockedAnchorLpa as number | null | undefined) ?? null,
    /* Fix 3 (PDF #17 follow-up, 2026-05-15) — premature-close guard. */
    minTurnsBeforeClose: (s.minTurnsBeforeClose as number | undefined) ?? 8,
    /* PDF #17 architectural fix (2026-05-15) — discovery-first state
     * machine fields. Optional for back-compat with in-flight sessions. */
    discoveryChecklist: backfillDiscoveryChecklist(s.discoveryChecklist),
    discoveryStage: (s.discoveryStage as DiscoveryStage | undefined) ?? "discovery",
    /* Bug-report 12 (2026-05-14) — per-turn fresh-counter signal.
     * Optional for back-compat; defaults to null (treat in-flight
     * sessions as if no fresh counter has been parsed). */
    lastCandidateCounterLpa: (s.lastCandidateCounterLpa as number | null | undefined) ?? null,
    /* PDF #18 (2026-05-15) — candidate-disclosure acks. Optional; omit
     * when empty to keep serialized wire size small. */
    pendingCandidateAcks: (s.pendingCandidateAcks as NegotiationState["pendingCandidateAcks"]) ?? undefined,
    /* Negotiation-flow redesign commit 4 (2026-05-15) — reactive-followup
     * ledger. Sticky across the session (never cleared by applyAiMove).
     * Optional for back-compat with sessions serialized before commit 4. */
    reactiveFollowupsFired:
      (s.reactiveFollowupsFired as DiscoveryTopic[] | undefined) ?? [],
    /* 2026-05-29 realism-pass — candidateQuestionServeCount back-compat
     * default. Pre-realism-pass sessions deserialise with an empty map. */
    candidateQuestionServeCount:
      (s.candidateQuestionServeCount as Partial<Record<string, number>> | undefined) ?? {},
    /* 2026-05-29 realism-pass — candidateRegister back-compat default.
     * Pre-realism-pass sessions deserialise as neutral; first candidate
     * turn after resume recomputes. */
    candidateRegister:
      (s.candidateRegister as NegotiationState["candidateRegister"]) ?? "neutral",
    /* Polish 2 (2026-05-16) — per-topic fire-history. Back-compat
     * default = empty record. */
    reactiveFollowupsFireLog:
      (s.reactiveFollowupsFireLog as Partial<Record<DiscoveryTopic, number[]>> | undefined) ?? {},
    /* Fix 1 (2026-05-16) — leversFired back-compat default. */
    leversFired: (s.leversFired as string[] | undefined) ?? [],
    /* ResumeFactPack track (2026-05-16) — back-compat default. Existing
     * in-flight sessions serialized before this field shipped get null,
     * which the credibility-probe and prior-CTC floor levers treat as
     * "no resume context" (inert). */
    resumeFactPack: (s.resumeFactPack as ResumeFactPack | null | undefined) ?? null,
    impliedPriorCtcFromResume:
      (s.impliedPriorCtcFromResume as number | null | undefined) ?? null,
    flagProvenance:
      (s.flagProvenance as Record<string, "resume" | "stated"> | undefined) ?? {},
    candidateStatedCurrentCompany:
      (s.candidateStatedCurrentCompany as string | null | undefined) ?? null,
    credibilityProbeFired:
      (s.credibilityProbeFired as boolean | undefined) ?? false,
    credibilityProbeAvoidedAt:
      (s.credibilityProbeAvoidedAt as number | null | undefined) ?? null,
    /* Prompt-injection defense ledger back-compat default. Sessions
     * serialized before this field shipped deserialize with an empty
     * ledger. */
    promptInjectionAttempts:
      (s.promptInjectionAttempts as NegotiationState["promptInjectionAttempts"] | undefined) ?? [],
    /* Phase 5 Session A (2026-05-19) — multi-round persona switch.
     * Back-compat: legacy sessions serialised before this field shipped
     * deserialise as single-round (multiRoundEnabled=false), with empty
     * transitions and roundIndex=0. `roundPersona` stays undefined so
     * downstream consumers treat the session as legacy. */
    multiRoundEnabled: (s.multiRoundEnabled as boolean | undefined) ?? false,
    roundPersona: (s.roundPersona as NegotiationRoundPersona | undefined) ?? undefined,
    roundIndex: ((s.roundIndex as 0 | 1 | 2 | undefined) ?? 0),
    roundTransitions:
      (s.roundTransitions as NegotiationState["roundTransitions"] | undefined) ?? [],
    perRoundBand: (s.perRoundBand as NegotiationState["perRoundBand"]) ?? undefined,
    /* Affinity-dynamic feature (2026-05-29) — back-compat defaults. */
    recruiterAffinity: (s.recruiterAffinity as number | undefined) ?? 0,
    affinityLedger:
      (s.affinityLedger as AffinityLedgerEntry[] | undefined) ?? [],
    /* Paraphrase-loop feature (2026-05-29) — back-compat default. */
    paraphraseFired: (s.paraphraseFired as boolean | undefined) ?? false,
    paraphraseCorrections:
      (s.paraphraseCorrections as NegotiationState["paraphraseCorrections"]) ?? [],
    /* Calibrated-surprise lowball feature (2026-05-29) — back-compat
     * defaults. Legacy sessions deserialise with the probe never having
     * fired and no acceptance-of-lowball flag set. */
    calibratedSurpriseFired:
      (s.calibratedSurpriseFired as boolean | undefined) ?? false,
    calibratedSurpriseContext:
      (s.calibratedSurpriseContext as NegotiationState["calibratedSurpriseContext"]) ?? null,
    acceptedLowball: (s.acceptedLowball as boolean | undefined) ?? false,
    acceptLowballQuietFiredAtTurn:
      (s.acceptLowballQuietFiredAtTurn as number | null | undefined) ?? null,
    /* Proactive-sweetener feature (2026-05-30) — back-compat defaults.
     * Legacy sessions deserialise as never-fired with no sweetener
     * kind. */
    proactiveSweetenerFired:
      (s.proactiveSweetenerFired as boolean | undefined) ?? false,
    proactiveSweetenerKind:
      (s.proactiveSweetenerKind as NegotiationState["proactiveSweetenerKind"]) ?? undefined,
    /* Recruiter-power-dynamics feature (2026-05-29) — back-compat
     * defaults preserve identity behaviour for legacy sessions. */
    recruiterPower: (s.recruiterPower as number | undefined) ?? 0,
    powerSignals: (s.powerSignals as PowerSignals | undefined) ?? {},
  };
}

/* Phase 27 — competingOfferDetail.onHold was added after the wire format
 * first deployed. Legacy in-flight sessions serialized this without the
 * onHold key; backfill it. */
export function backfillCompetingOfferDetail(raw: unknown): CompetingOfferDetail {
  const v = raw as Partial<CompetingOfferDetail> | undefined;
  return {
    company: v?.company ?? null,
    status: v?.status ?? null,
    stage: v?.stage ?? null,
    letterShareOffered: v?.letterShareOffered ?? false,
    onHold: v?.onHold ?? false,
    /* fake-leverage-challenge (2026-05-17) — backfill the two new
     * proof-tracking fields for legacy in-flight sessions. */
    proofRequestedAtTurn: v?.proofRequestedAtTurn ?? null,
    proofProvided: v?.proofProvided ?? false,
    /* fake-leverage-challenge (2026-05-17) — backfill accumulated
     * amount for legacy in-flight sessions serialized before the field
     * shipped. */
    amount: v?.amount ?? null,
    hasAny: v?.hasAny ?? false,
  };
}

/* Phase 25b — domainPivot / transferableSkillsClaimed / compensationHistoryIssue
 * were added after the wire format first deployed. Legacy in-flight
 * sessions serialized candidateProfile without these keys; backfill them.
 * Uses EMPTY_CANDIDATE_PROFILE spread so new wave flags are always present.
 *
 * Backcompat: the following flags were pruned in commit "perfect 6" but
 * old persisted snapshots may carry them. Silently dropped via the
 * known-keys filter below (raw entries whose key is not in the current
 * EMPTY_CANDIDATE_PROFILE shape are discarded):
 *   prefersEquityOverCash, hasVestingCliff, rsuVestingAware, esopHolder,
 *   riskAverse, prefersMnc, prefersStartup, openToRelocation, remotePref,
 *   likelyToCounter, acceptedFirstOffer, hasWalkedAway, anchorsHigh,
 *   softOnRange, noticePeriodFlexible, joiningUrgency, isIcToManager,
 *   hasLeadershipExperience, domainSpecialist, multipleCompaniesInTwoYears,
 *   currentHasBonus, currentBonusPct, currentHasEsop, currentEsopVested,
 *   currentHasRetentionBonus, currentHasGratuity, currentHasNps,
 *   wantsHigherBonus, wantsFlexibleWork, wantsLearningBudget,
 *   wantsEquityRefresh, wantsProfessionalTitle, hasSeenOffer,
 *   offerDeadlineMentioned, offerDeadlineText, negotiatingMultipleOffers,
 *   prefersCashOverPerks, perksImportant, anchoredFirst, anchorWasHighball,
 *   retreatedFromAnchor, acceptedCounterQuickly, respondedToBudgetCeiling,
 *   pushedBackOnCeiling, expressedUrgency, expressedHesitation,
 *   usedRecruiterName, saidThankYou, askedAboutTeam, askedAboutWorkLifeBalance,
 *   dramaticAnchorJump, mentionedCounterOffer, mentionedLayoffRisk,
 *   seemsRushed, firstOfferReaction, explicitlyRejectedOffer,
 *   askedForTimeToDecide, mentionedRelocation, mentionedPf, mentionedGratuity,
 *   mentionedVariablePayout, mentionedSigningBonus, mentionedRetentionBonus,
 *   mentionedJoiningBonus, askedAboutPerformanceCycle, mentionedTargetRole,
 *   competingOfferIsVerbal, competingOfferCompany, competingOfferDeadline,
 *   showedFrustration, showedExcitement, usedSilence,
 *   backtrackedOnExpectation, escalatedDemand, mentionedRelievingLetterRisk,
 *   mentionedNoticeWaiver, mentionedNoticeBuyout, isFirstJobChange,
 *   hasManagementExperience, mentionedStartupExperience,
 *   mentionedMncExperience, hasPhdOrMba, usedAnchorFirst, mentionedCostOfLiving,
 *   wantsHigherBase (kept as live), wantsRelocationAllowance (kept as live),
 *   wantsJoiningBonus (kept as live).
 */
export function backfillCandidateProfile(raw: unknown): CandidateProfileResult {
  const v = raw as Partial<CandidateProfileResult> | undefined;
  /* Spread EMPTY first so every required field has a default, then overlay
   * whatever the legacy payload carried (undefined values from the partial
   * are filtered out so they don't overwrite the defaults). Pruned-flag
   * keys present in the raw payload but no longer in EMPTY_CANDIDATE_PROFILE
   * are silently dropped via the known-keys filter — see backcompat note
   * above. */
  const knownKeys = new Set(Object.keys(EMPTY_CANDIDATE_PROFILE));
  const defined = Object.fromEntries(
    Object.entries(v ?? {}).filter(
      ([k, val]) => val !== undefined && knownKeys.has(k),
    ),
  ) as Partial<CandidateProfileResult>;
  return { ...EMPTY_CANDIDATE_PROFILE, ...defined };
}

/* Phase 19 — corpus-derived stance fields were added after the wire
 * format first deployed. Legacy in-flight sessions serialized
 * candidateStance without these keys; backfill them. */
export function backfillCandidateStance(raw: unknown): CandidateStanceResult {
  const v = raw as Partial<CandidateStanceResult> | undefined;
  return {
    flexibilityPosture: v?.flexibilityPosture ?? null,
    marketReferenceVague: v?.marketReferenceVague ?? false,
    salaryOnlyFactor: v?.salaryOnlyFactor ?? false,
    badmouthsCurrent: v?.badmouthsCurrent ?? false,
    confidentialOvershare: v?.confidentialOvershare ?? false,
    soundsDesperate: v?.soundsDesperate ?? false,
    treatsEquityAsCash: v?.treatsEquityAsCash ?? false,
    avoidsAnchor: v?.avoidsAnchor ?? false,
    personalExpenseJustification: v?.personalExpenseJustification ?? false,
    offerShoppingDemand: v?.offerShoppingDemand ?? false,
    dismissesVariableRisk: v?.dismissesVariableRisk ?? false,
    overpromisesJoining: v?.overpromisesJoining ?? false,
    complainedAboutHikePercent: v?.complainedAboutHikePercent ?? false,
    stallSignal: v?.stallSignal ?? null,
    hasAny: v?.hasAny ?? false,
  };
}

/* Phase 17D — joiningBonusClawbackDiscussed + lastWorkingDayText were
 * added after the wire format first deployed. Legacy in-flight sessions
 * serialized noticeJoining without these keys; backfill them. */
export function backfillNoticeJoining(raw: unknown): NoticeJoiningResult {
  const v = raw as Partial<NoticeJoiningResult> | undefined;
  return {
    noticePeriodDays: v?.noticePeriodDays ?? null,
    buyoutRequested: v?.buyoutRequested ?? false,
    joiningBonusAsk: v?.joiningBonusAsk ?? null,
    earlyJoinPreferred: v?.earlyJoinPreferred ?? false,
    joiningBonusClawbackDiscussed: v?.joiningBonusClawbackDiscussed ?? false,
    lastWorkingDayText: v?.lastWorkingDayText ?? null,
    hasAny: v?.hasAny ?? false,
  };
}

/* Phase 17E — strikePriceDiscussed / valuationDiscussed /
 * liquidityDiscussed were added after the wire format first deployed.
 * Legacy in-flight sessions serialized equityVesting without these
 * keys; backfill them. */
export function backfillEquityVesting(raw: unknown): EquityVestingResult {
  const v = raw as Partial<EquityVestingResult> | undefined;
  return {
    vestingYears: v?.vestingYears ?? null,
    cliffMonths: v?.cliffMonths ?? null,
    preference: v?.preference ?? null,
    familiarity: v?.familiarity ?? null,
    strikePriceDiscussed: v?.strikePriceDiscussed ?? false,
    valuationDiscussed: v?.valuationDiscussed ?? false,
    liquidityDiscussed: v?.liquidityDiscussed ?? false,
    /* PDF#31 BUG A+B (2026-05-18) — backfill for sessions serialized
     * before the equityExists field existed. */
    equityExists: v?.equityExists ?? null,
    hasAny: v?.hasAny ?? false,
  };
}
