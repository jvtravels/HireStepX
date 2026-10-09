/* Next-action planner: anchors, close numbers, cash-increase intent, skip + uncertainty handling. */

import { type NegotiationState, totalScopedCounter, effectiveTargetCtcLpa, type DiscoveryTopic } from "./_negotiation-kernel";
import { type PlannedAction, readAskedTopics } from "./_planner-actions";
import { isDiscoverySufficientToAnchor } from "./_discovery-stage";
import { classifyRoleFamily } from "./_company-band-tiers";

/** Single declarative source of truth for "what should the bot do next?".
 *  Pure. Order of returns is the priority cascade — first match wins.
 *
 *  AR3 / Audit Pass 4 (PDF#27, 2026-05-17) — the per-phase maxTurns cap
 *  is enforced upstream of the planner inside derivePhase. When the
 *  current phase has overstayed its budget, derivePhase rewrites
 *  state.phase to the next-group entry (discovery → range-disclosure /
 *  stalemate; anchoring → counter-offer; counter → stalemate). That
 *  means planNextAction sees the already-advanced phase and emits the
 *  natural next-group action through the existing cascade — no override
 *  needed at this layer. */
/* Bug-D (2026-06-19, live staging) — recruiter-anchors-once-discovery-
 * sufficient, extracted from the AUDIT-3 Fix A inline bridge (~L3500) so the
 * SAME decision can run at two priority points inside planNextActionInternal:
 *   (1) HOISTED above the reactive-followup / warm-ack / callback-prior-
 *       context / live-walk-away branches — those all sit above the original
 *       L3226 anchor gate and kept winning the turn once current CTC + target
 *       were known, so the planner re-probed forever, NEVER put a number on
 *       the table, and a later candidate acceptance with no standing offer
 *       routed to live-walk-away. A real Indian recruiter, once current+target
 *       are known and nothing is on the table, STATES THE BAND.
 *   (2) the original post-discovery fall-through (kept as a belt-and-braces
 *       second call site).
 * Returns an anchor-with-offer action when the candidate has disclosed current
 * CTC + target, discovery is sufficient, and no offer has been made yet; null
 * otherwise. The equity-clarity and credibility probes remain HIGHER priority
 * than call site (1) — they are legitimate one-shot pre-anchor clarifications. */
export function planDiscoverySufficientAnchor(
  state: NegotiationState,
): PlannedAction | null {
  if (
    !(
      state.highestOfferMade === 0 &&
      state.candidateCurrentCtc != null &&
      (state.candidateTarget != null || state.candidateTargetFixed != null) &&
      state.discoveryChecklist != null &&
      isDiscoverySufficientToAnchor(
        state.discoveryChecklist,
        classifyRoleFamily(state.role),
      ) &&
      readAskedTopics(state).every(
        (t) =>
          t.topic !== "band-anchor-with-rationale" &&
          (t.topic as string) !== "anchor-with-offer",
      )
    )
  ) {
    return null;
  }
  /* Rhythm gate: a real recruiter acknowledges a FRESH comp disclosure before
   * stating the band — they don't slap a number down in the same breath the
   * candidate names their expectation. So when the candidate disclosed a comp
   * fact THIS very turn (current CTC, target, or split), defer to the natural
   * reactive acknowledgment and let the anchor fire on the NEXT turn. This
   * preserves the "react at T(n), anchor at T(n+1)" cadence the happy-path arc
   * locks, while still breaking Bug D's failure mode — where, turn after turn
   * with nothing new disclosed, reactive-followups kept winning and the anchor
   * never got a turn. lastTurnDelta is the precise per-turn signal (it flags
   * only values that CHANGED this turn — a restatement does not count). */
  const disclosedCompThisTurn =
    state.lastTurnDelta?.disclosedCurrentCtc === true ||
    state.lastTurnDelta?.disclosedExpectedCtc === true ||
    state.lastTurnDelta?.disclosedFixedVariableSplit === true;
  if (disclosedCompThisTurn) {
    return null;
  }
  const lo = state.band.initialOffer;
  const hi = state.band.maxStretch;
  /* #PRI-53 — this is the OPENING anchor (gated on highestOfferMade === 0
   * above), so reserve concession headroom below the ceiling rather than
   * pinning maxStretch. clampOpeningAnchor preserves the honest-defer null
   * path and the pay-cut floor; counters/closes elsewhere keep the full band. */
  const anchored = clampOpeningAnchor(lo, hi, state);
  /* AUDIT-W02 BUG-001 — when the band ceiling sits below the candidate's
   * disclosed CTC, stating the band as a range would advertise a pay cut;
   * honest-defer with a point anchor flagged bandIncomplete instead. */
  if (anchored === null) {
    return {
      kind: "anchor-with-offer",
      initialOffer: lo,
      bandIncomplete: true,
      satisfiesTopic: "band-anchor-with-rationale",
      _move: {
        lever: "probe",
        newTotalLpa: null,
        rationale: `AUDIT-W02 BUG-001 — band ceiling (${hi}) below disclosed CTC (${state.candidateCurrentCtc}); honest-defer rather than pay-cut anchor.`,
        askedTopic: "band-anchor-with-rationale",
        actionKind: "anchor-with-offer",
      },
    } as PlannedAction;
  }
  /* Pay-cut-range guard (the second half of Bug D). When the candidate already
   * earns at/above the band FLOOR, narrating the band as a range (₹lo–₹hi)
   * would advertise pay-cut numbers (everything from lo up to their current
   * CTC). Worse, a range move carries newTotalLpa:null, so highestOfferMade
   * stays 0 and the deal can never actually CLOSE — the candidate's eventual
   * acceptance, finding no standing offer, routes to live-walk-away. Emit a
   * concrete POINT anchor at the clamped value instead: it sits above their
   * current pay (clampAnchorAboveDisclosed lifts to currentCtc×(1+hike),
   * capped at the ceiling) AND sets highestOfferMade, so the negotiation has a
   * real number to converge on. */
  if (state.candidateCurrentCtc != null && state.candidateCurrentCtc >= lo) {
    return {
      kind: "anchor-with-offer",
      initialOffer: anchored,
      bandIncomplete: false,
      satisfiesTopic: "band-anchor-with-rationale",
      _move: {
        lever: "probe",
        newTotalLpa: anchored,
        rationale:
          `Bug-D discovery-sufficient point-anchor: candidate's current ₹${state.candidateCurrentCtc}L is at/above the band floor ₹${lo}L, so a range would advertise a pay cut and leave no standing offer; ` +
          `anchor a concrete ₹${anchored}L (lifted above current pay, capped at ceiling ₹${hi}L) the candidate can actually close on.`,
        askedTopic: "band-anchor-with-rationale",
        actionKind: "anchor-with-offer",
      },
    } as PlannedAction;
  }
  /* Clean case — the band floor sits above the candidate's current pay; STATE
   * THE BAND as a range (mirrors the probe-expectations bridge below) so the
   * candidate has a reference range to react to and there's room to bargain
   * up. The candidate's counter drives the concrete offer downstream — and an
   * outright acceptance of the stated band (with no concrete counter) is
   * handled by the kernel's accept path, which treats a presented band as an
   * offer-on-table and closes at the band floor (see the `bandPresented` /
   * `band-anchor-with-rationale` accept handling in _negotiation-kernel.ts).
   * Kept as a pure range here (newTotalLpa: null) so stating the band does NOT
   * flip the phase to counter-offer prematurely and reroute the next probe. */
  return {
    kind: "band-anchor-with-rationale",
    satisfiesTopic: "band-anchor-with-rationale",
    _move: {
      lever: "benefits-summary",
      newTotalLpa: null,
      rationale:
        `Bug-D discovery-sufficient anchor: candidate disclosed current ₹${state.candidateCurrentCtc}L + target ₹${state.candidateTarget ?? state.candidateTargetFixed}L${state.candidateTarget == null ? " (fixed)" : ""} and one acknowledgment has fired; ` +
        `state the band (₹${lo}L–₹${hi}L) as a reference range the candidate can react to.`,
      actionKind: "band-anchor-with-rationale",
      askedTopic: "band-anchor-with-rationale",
    },
  } as PlannedAction;
}

/* #121 (2026-06-21, live staging) — STONEWALL anchor, hoisted to call
 * site (1) alongside planDiscoverySufficientAnchor.
 *
 * The A6 stonewall escape already existed, but ONLY inside the deep
 * discovery-cascade branch (~L3705) — which sits BELOW the reactive-
 * followup branches. Live repro (Flipkart EM, content-free/desperate
 * candidate who refuses every number): the reactive-followups
 * (`ctc-gentle-push`, `range-deflection`, `answer-direct`,
 * `acknowledge-and-recover`) captured every single turn and re-probed,
 * so the deep A6 escape NEVER got a turn. The bot never anchored,
 * `highestOfferMade` stayed 0, and the kernel dumped the session to a
 * ₹0-offer "let's pause here" stalemate close (cardinal failure: no
 * number ever on the table for a candidate who genuinely wanted the
 * job). planDiscoverySufficientAnchor is the hoisted escape for the
 * candidate who DID disclose current+target; this is its companion for
 * the opposite extreme — disclosed NOTHING. A real Indian recruiter
 * breaks both deadlocks the same way: state the band. Hoisting the
 * band-floor anchor ABOVE the reactive-followups guarantees a number
 * lands before stalemate. Gated identically to the deep A6 (nothing
 * disclosed, band complete, no prior anchor, no offer, turn ≥ N) so a
 * mid-disclosure or terse-but-substantive candidate is never short-
 * circuited. The deep A6 stays as a belt-and-braces second call site. */
export const STONEWALL_ANCHOR_TURNS = 5;
export function planStonewallAnchor(state: NegotiationState): PlannedAction | null {
  if (state.highestOfferMade !== 0) return null;
  if (state.discoveryStage !== "discovery" || state.discoveryChecklist == null) {
    return null;
  }
  const tier1Missing =
    state.discoveryChecklist.currentCtcAnswered !== true ||
    state.discoveryChecklist.targetAnswered !== true;
  const phaseEligible =
    state.phase === "opening" ||
    ((state.phase === "range-disclosure" ||
      state.phase === "probe-expectations") &&
      tier1Missing);
  if (!phaseEligible) return null;
  const nothingDisclosed =
    state.candidateCurrentCtc == null &&
    state.candidateTarget == null &&
    state.candidateTargetFixed == null;
  if (!nothingDisclosed) return null;
  if (state.turnIndex < STONEWALL_ANCHOR_TURNS) return null;
  const alreadyAnchored = readAskedTopics(state).some(
    (t) =>
      t.topic === "band-anchor-with-rationale" ||
      (t.topic as string) === "anchor-with-band" ||
      (t.topic as string) === "anchor-with-offer",
  );
  if (alreadyAnchored) return null;
  const lo = state.band?.initialOffer;
  const hi = state.band?.maxStretch;
  if (typeof lo !== "number" || typeof hi !== "number" || !(lo < hi)) {
    return null;
  }
  const anchored = clampAnchorAboveDisclosed(lo, hi, state) ?? lo;
  return {
    kind: "anchor-with-offer",
    initialOffer: anchored,
    bandIncomplete: false,
    satisfiesTopic: "band-anchor-with-rationale",
    _move: {
      lever: "probe",
      newTotalLpa: anchored,
      rationale:
        `A6 stonewall escape (hoisted, #121) — candidate gave ${state.turnIndex} ` +
        `content-free turns with no disclosure; recruiter anchors the band floor ` +
        `(₹${anchored}L) to break the deadlock rather than probe again or stalemate ` +
        `with no offer.`,
      askedTopic: "band-anchor-with-rationale",
      actionKind: "anchor-with-offer",
    },
  } as PlannedAction;
}

/** #93 (2026-06-19, live-staging) — the close number to honor when a
 *  candidate accepts/signals-close AT a concrete figure just above the
 *  standing offer ("36 and I'll sign today"). Sources, in order of
 *  authority: a TOTAL-scoped bound counter, the last bound counter, then
 *  the sticky candidate target (the acceptance/close gates that consult
 *  this only fire when the candidate is closing, so the target is the
 *  number they're signing at, not an aspirational ask). Honored only
 *  when it sits ABOVE the offer, AT/UNDER the band ceiling, and within a
 *  trivial gap (the larger of ₹2L or 6% of the offer) — otherwise the
 *  standing offer stands. Returning a number ABOVE the offer is always
 *  safe: clampToCloseFloor raises, never lowers. */
export function nearOfferCloseNumber(state: NegotiationState): number {
  const offer = state.highestOfferMade;
  if (!(offer > 0)) return offer;
  /* #127/#129 — a figure the candidate RESTATES inside the firm accept
   * ("46 works, I'll sign", "fine 22 done") is the number they agreed to. It
   * is bounded only by the band ceiling, NOT the trivial near-offer gap below:
   * the gap gate exists to reject a far ASPIRATIONAL target leaking into a
   * close, but an explicitly-stated settle figure is not aspirational — it is
   * the close. Honoring it here (above offer, at/under ceiling) keeps every
   * close path on one source of truth and prevents the stealth under-close
   * that hands the candidate the bare standing offer. clampToCloseFloor only
   * ever raises, so returning a figure above the offer is always safe. */
  /* S54-B6/B9 (2026-07-24) — the gap window protects against aspirational
   * mentions leaking into close ("₹27L would be nice" on a ₹21.8L offer).
   * BUT it must NOT clip an explicit commit-token settle figure ("fine 22 done",
   * "done at 22"): those are unambiguously the agreed number regardless of the
   * gap width, because the commit token proves intent, not just proximity to a
   * target. Two-tier logic:
   *   Tier-A: target-corroboration (figure ≈ sticky target) — apply gap window.
   *   Tier-B: commit-token weld ("N done", "done at N") — in-band only; no gap.
   * The gap window lives on tier-A only. #127/#129 (2026-07-24 regression fix). */
  const agreed = acceptanceUtteranceFigure(state);
  const _closeGap = Math.max(2, offer * 0.06);
  if (agreed != null && agreed > offer && agreed <= state.band.maxStretch && agreed - offer <= _closeGap) {
    return agreed;
  }
  /* Tier-B fallback: commit-token settle figure, no gap constraint. */
  const settled = acceptanceCommitFigure(state);
  if (settled != null && settled > offer && settled <= state.band.maxStretch) {
    return settled;
  }
  /* #105 (2026-06-20, live-staging) — scope-aware close number. A
   * FIXED-scoped close signal ("if 17 fixed works, I'll sign") is NOT a
   * total: totalScopedCounter() returns null for it, and the legacy
   * `?? state.lastCandidateCounterLpa` fallback re-admitted that raw fixed
   * figure and compared it against the (total) offer — the units-mismatch
   * class #58/#104, here producing either a false-high close or, when the
   * fixed ask is undeliverable, a silent close at the standing total framed
   * "same range". When the signal is fixed-scoped we convert it to its
   * implied total ONLY if the band can deliver it (fixedScopedCloseTotal);
   * an undeliverable fixed ask yields null → the offer stands (and the
   * close gates below decline rather than stealth-close). When the signal is
   * total-scoped the legacy chain is unchanged. */
  const totalCnum = totalScopedCounter(state);
  /* B4 (2026-07-23) — removed `state.lastCandidateCounterLpa` from the
   * fallback chain. That raw per-turn field is stale across turns: a candidate
   * who made a cash ask two turns ago still has a non-null field even after
   * pivoting to a non-cash ask or falling silent. Using it here as a close
   * anchor produced false-closes at a number the candidate never restated.
   * When totalScopedCounter is null AND there is no fixed close ask, there is
   * no current-turn numeric close signal — the close must stand at the offer.
   * candidateTarget (the longer-lived intake aspiration) is retained as the
   * only fallback because it is explicitly captured on setup, not from any
   * per-turn utterance that could go stale mid-session. */
  const cnum =
    totalCnum != null
      ? totalCnum
      : resolveFixedCloseAsk(state) != null
        ? fixedScopedCloseTotal(state) // implied total iff deliverable, else null
        : state.candidateTarget ?? null;
  if (cnum == null) return offer;
  const gap = Math.max(2, offer * 0.06);
  if (cnum > offer && cnum <= state.band.maxStretch && cnum - offer <= gap) {
    return cnum;
  }
  return offer;
}

/** #129 (2026-06-21, live-staging) — the in-band figure a candidate RESTATES
 *  inside a firm acceptance ("46 works, I'll sign today", "fine 22 done"), or
 *  null. The acceptance classifier clears the per-turn counter on a firm
 *  accept, so totalScopedCounter/lastCandidateCounterLpa are null by the time
 *  the close fires — which made the close land on the bare standing offer, a
 *  stealth under-close that hands the candidate less than the number they just
 *  agreed to (the #105 class, on the total path). We recover the agreed figure
 *  from the acceptance utterance itself, but only when it CORROBORATES the
 *  candidate's sticky target (within the trivial ±max(₹1L,6%) gap) — so a bare
 *  "done"/"ok" (no figure) or an incidental number (a notice-day count, a
 *  current-CTC restate that doesn't match the target) never lifts the close.
 *  Tenure/percent figures are stripped first. Pure. */
export function acceptanceUtteranceFigure(state: NegotiationState): number | null {
  const persisted = effectiveTargetCtcLpa(state) ?? state.candidateTarget ?? null;
  if (persisted == null) return null;
  const log = state.conversationLog ?? [];
  let text = "";
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e && e.speaker === "candidate") {
      text = e.text || "";
      break;
    }
  }
  if (!text) return null;
  /* Drop figures carrying an explicit time/tenure/percent unit — those are
   * never the agreed cash number (notice "45 days", "3 months", "10%"). */
  const cleaned = text.replace(
    /\b\d+(?:\.\d+)?\s*(?:days?|months?|weeks?|yrs?|years?|%|percent)\b/gi,
    " ",
  );
  const tol = Math.max(1, persisted * 0.06);
  const re = /\b(\d+(?:\.\d+)?)\b/g;
  let m: RegExpExecArray | null;
  let best: number | null = null;
  while ((m = re.exec(cleaned)) !== null) {
    const v = parseFloat(m[1]);
    if (!Number.isFinite(v)) continue;
    if (Math.abs(v - persisted) <= tol) {
      if (best == null || Math.abs(v - persisted) < Math.abs(best - persisted)) best = v;
    }
  }
  if (best != null) return best;
  /* #127 tier-B — explicit settle-at figure. When the candidate self-LOWERS
   * inside the accept ("fine 22 done" off a 24 ask, settling at 22), tier-A's
   * target-corroboration rejects it (22 ≠ the sticky 24), yet 22 IS the figure
   * they just committed to. A number welded to a commit token ("22 done",
   * "done at 22", "52 works") is an unambiguous settle figure regardless of the
   * stale target, so we honor it directly. The caller bounds it to
   * (offer, ceiling]; incidental numbers (a notice-day count, a CTC restate)
   * are NOT adjacent to a commit token and so never match here. */
  const settle =
    /\b(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l)?\s*(?:done|deal|sold|works|final(?:ized)?)\b/i.exec(
      cleaned,
    ) ??
    /\b(?:done|deal|sold|settled?|finalized?)\s+(?:at|for|on)\s+(\d+(?:\.\d+)?)\b/i.exec(
      cleaned,
    );
  if (settle) {
    const v = parseFloat(settle[1]);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

/** #127 tier-B (2026-07-24) — the figure a candidate explicitly welds to a
 *  commit token ("fine 22 done", "done at 22", "52 works") in their last
 *  acceptance utterance, or null. Called by nearOfferCloseNumber when the
 *  tier-A target-corroboration check fails the gap window, so a self-lowered
 *  settle ("22 done" off a 24 ask) still closes at 22 not the standing offer.
 *  The commit token is unambiguous intent — no proximity-to-target check needed. */
export function acceptanceCommitFigure(state: NegotiationState): number | null {
  const log = state.conversationLog ?? [];
  let text = "";
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e && e.speaker === "candidate") { text = e.text || ""; break; }
  }
  if (!text) return null;
  const cleaned = text.replace(
    /\b\d+(?:\.\d+)?\s*(?:days?|months?|weeks?|yrs?|years?|%|percent)\b/gi,
    " ",
  );
  const settle =
    /\b(\d+(?:\.\d+)?)\s*(?:lpa|lakhs?|l)?\s*(?:done|deal|sold|works|final(?:ized)?)\b/i.exec(cleaned) ??
    /\b(?:done|deal|sold|settled?|finalized?)\s+(?:at|for|on)\s+(\d+(?:\.\d+)?)\b/i.exec(cleaned);
  if (settle) {
    const v = parseFloat(settle[1]);
    if (Number.isFinite(v)) return v;
  }
  return null;
}

/** PRI-68 (2026-07-07, offline hostile sweep) — the implied TOTAL a candidate
 *  has conditioned acceptance on when they ask for MORE cash on the standing
 *  offer ("I'll accept if you bump the fixed by another 2L"), or null.
 *
 *  This is the missing single source for a relative cash-increase target. The
 *  acceptance classifier flags such an utterance `conditionalAcceptance=true`
 *  (Path 1: an `if` clause + a commitment idiom) but records only a text
 *  snippet — never the magnitude — so the near-offer close gate, lacking a
 *  resolved figure, used to close at the UN-bumped offer, silently dropping
 *  the candidate's condition (a PRI-63-class soft false-close). This resolves
 *  the figure so the gate can meet-and-close a deliverable bump or DECLINE an
 *  undeliverable one.
 *
 *  Two shapes, both returning the implied TOTAL (bumping the fixed by δ raises
 *  the total by δ, so impliedTotal = offer + δ regardless of which cash
 *  component is named):
 *    • delta   — "by 2L" / "another 2L" / "2L more"      → offer + δ
 *    • absolute — "to 54(L)" welded to an increase verb   → 54
 *
 *  Sweetener-scoped conditions (joining/signing/relocation/esop/equity/stock
 *  bonus) are DELIBERATELY excluded — returning null — because the near-offer
 *  gate's PRI-63 path already grants those and closes; stealing them here would
 *  regress that behaviour. A pure non-cash condition ("once you confirm the
 *  band") or a bare accept ("done") carries no magnitude and returns null too,
 *  so the gate closes at the offer as before. Pure. */
/** The parsed cash-INCREASE intent behind a conditional close ("I'll sign if
 *  you …"), or null when the utterance carries no numeric cash condition.
 *
 *  Discriminated so the caller applies the offer once, in one place:
 *   - `delta`    → add `lakhs` to the standing offer ("2L more", "another few
 *                  lakh", "half a lakh", "a lakh more")
 *   - `percent`  → add `pct` % of the standing offer ("bump it 5%", "a couple
 *                  of percent")
 *   - `absolute` → set the total to `lakhs` ("bump it to 45L")
 *
 *  Consolidation of #33 / #33b / #35 / #36 (2026-07-08). Every hostile
 *  surface form used to be a `return offer + …` branch scattered through the
 *  resolver; each new phrasing meant another branch and another soft-false-
 *  close bug when it was missed. Folding them into ONE pure, offer- and
 *  NegotiationState-free parser lets the whole battery be unit-tested in
 *  isolation (conditionalCashIntent.test.ts) and gives future phrasings a
 *  single, bounded home — resolveConditionalCashTarget below is now just an
 *  offer-applying, range-gating wrapper.
 *
 *  ORDERING IS LOAD-BEARING and preserved exactly from the pre-refactor code:
 *  percent is resolved BEFORE the lakh-delta so "another 3 percent" reads as
 *  +3% (not +3L); "half" before the indefinite article so "half a lakh" is
 *  +0.5 (not +1). A magnitude that fails its range cap FALLS THROUGH to the
 *  next shape rather than short-circuiting to null — same as before.
 *
 *  `unitMandatory` (#36): when a bonus is ALSO named in the same breath
 *  ("2L more and a joining bonus"), the base delta must carry an explicit
 *  lakh unit to be trusted, so a bonus AMOUNT ("joining bonus of 2L") and a
 *  non-cash aside ("another 2 weeks and a bonus") are never misread as a base
 *  bump. The percent axis is unaffected (a "%" is itself an explicit unit).
 *  Pure. */
export type CashIncreaseIntent =
  | { kind: "delta"; lakhs: number }
  | { kind: "percent"; pct: number }
  | { kind: "absolute"; lakhs: number };

export function parseCashIncreaseIntent(
  text: string,
  opts: { unitMandatory: boolean },
): CashIncreaseIntent | null {
  if (!text) return null;
  const t = ` ${text.toLowerCase()} `;
  const { unitMandatory } = opts;
  const num = String.raw`(\d+(?:\.\d+)?)\s*(?:l|lpa|lakhs?|lac)?`;
  /* Unit-MANDATORY delta cues — used when a bonus is also named, so the base bump
   * must carry an explicit cash unit to be trusted (see #36 above). */
  const numCash = String.raw`(\d+(?:\.\d+)?)\s*(?:l\b|lpa|lakhs?|lac)`;
  /* Delta cues carry increase intent on their own ("another 2L", "2L more"). */
  const another = new RegExp(String.raw`\banother\s+${num}`).exec(t);
  const anotherCash = new RegExp(String.raw`\banother\s+${numCash}`).exec(t);
  const more = new RegExp(
    String.raw`\b${num}\s+(?:more|extra|additional)\b`,
  ).exec(t);
  const moreCash = new RegExp(
    String.raw`\b${numCash}\s+(?:more|extra|additional)\b`,
  ).exec(t);
  const INCREASE_VERB =
    /\b(bump|raise|increase|push|hike|lift|boost|stretch|nudge|add|jack|bump\s+up|move\s+up)\b/;
  const hasIncreaseVerb = INCREASE_VERB.test(t);
  /* A bare increase adverb ("a lakh MORE", "a couple EXTRA") carries increase
   * intent with no verb — the demand shape "just a lakh more and I'll sign"
   * has neither an increase verb nor a digit-anchored delta, so without this
   * cue the verbal-quantity branches below never fire and it soft-false-closes
   * at the un-bumped offer (#33b). */
  const bareIncreaseCue = /\b(?:more|extra|additional|higher|on\s+top)\b/.test(t);
  const wantsMore = hasIncreaseVerb || bareIncreaseCue;
  /* "by N" / "to N" only count as an increase when welded to an increase verb,
   * so "close by Friday" / "get back to you" never register as a cash bump. */
  const by = hasIncreaseVerb
    ? new RegExp(String.raw`\bby\s+${num}`).exec(t)
    : null;
  const byCash = hasIncreaseVerb
    ? new RegExp(String.raw`\bby\s+${numCash}`).exec(t)
    : null;
  /* #36 — verb-adjacent bare cash amount ("add 2 lakh", "bump the base 2L")
   * with no another/more/by marker. Unit-mandatory, and a trailing bonus noun is
   * excluded so a bonus AMOUNT ("add a 2 lakh joining bonus") is never read as a
   * base bump. */
  const verbCash = hasIncreaseVerb
    ? new RegExp(
        String.raw`\b(?:bump|raise|increase|push|hike|lift|boost|stretch|nudge|add|jack)(?:\s+up)?\s+(?:it\s+|the\s+|my\s+|base\s+|fixed\s+|by\s+|another\s+)*${numCash}(?!\s+(?:joining|signing|sign|retention|relocation|reloc|esops?|rsus?|equity|stock|bonus))`,
      ).exec(t)
    : null;
  const to = hasIncreaseVerb
    ? new RegExp(String.raw`\bto\s+(\d+(?:\.\d+)?)\s*(?:l|lpa|lakhs?|lac)\b`).exec(
        t,
      )
    : null;
  /* couple/few/several magnitude map, shared by the percent resolver below and
   * the word-magnitude lakh branch further down. */
  const WORD_MAGNITUDE: Record<string, number> = {
    couple: 2,
    few: 3,
    several: 4,
  };
  /* #35 (2026-07-08, offline hostile battery) — percentage-axis conditional
   * bump. A cash increase stated as a PERCENT ("bump it 5%", "a couple of
   * percent", "another 3 percent") reached this resolver, but every branch keyed
   * on a lakh noun — "%"/"percent" parsed nowhere — so it returned null and the
   * near-offer close gate finalized at the UN-BUMPED offer: the same soft-false-
   * close class as #33 on a different unit (confirmed via probe: "bump it a
   * couple of percent" → closed at ₹40L, 0% movement). Resolve the percent so
   * the unchanged deliverability gate honors or declines it. Checked BEFORE the
   * lakh-delta parse so "another 3 percent" reads as +3%, not +3L. Gated on the
   * same increase intent as every other branch, so "I'm 100 percent in" (full-
   * acceptance idiom, no increase cue) never registers as a bump. Capped at
   * 100% — an out-of-range figure falls through, never a silent accept. */
  const PCT = String.raw`(?:%|percent|per\s?cent|pct)`;
  const numPct = new RegExp(String.raw`(\d+(?:\.\d+)?)\s*${PCT}`).exec(t);
  const wordPct = new RegExp(
    String.raw`\b(couple|few|several)\s+(?:of\s+)?(?:more\s+)?${PCT}`,
  ).exec(t);
  if (wantsMore || another != null || more != null || by != null) {
    let pct: number | null = null;
    if (numPct) pct = parseFloat(numPct[1]);
    else if (wordPct) pct = WORD_MAGNITUDE[wordPct[1]];
    if (pct != null && Number.isFinite(pct) && pct > 0 && pct <= 100) {
      return { kind: "percent", pct };
    }
  }
  /* #36 — with a bonus also named, trust only unit-bound deltas so the bonus
   * amount is never misread as a base bump; otherwise the loose forms apply. */
  const deltaMatch = unitMandatory
    ? (anotherCash ?? moreCash ?? byCash ?? verbCash)
    : (another ?? more ?? by ?? verbCash);
  if (deltaMatch) {
    const d = parseFloat(deltaMatch[1]);
    if (Number.isFinite(d) && d > 0 && d <= 50) return { kind: "delta", lakhs: d };
  }
  if (to) {
    const v = parseFloat(to[1]);
    if (Number.isFinite(v) && v > 0 && v <= 200) return { kind: "absolute", lakhs: v };
  }
  /* #33 (2026-07-08, live-staging) — word-magnitude cash bumps. A conditional
   * close whose increase is stated in WORDS, not digits ("push the base up by a
   * couple of lakhs", "another few lakh"), fell through every numeric branch to
   * `return null`; the caller then read that null as "no cash condition" and
   * closed at the UN-BUMPED offer — a soft false-close that silently dropped the
   * candidate's condition (confirmed live: "couple of lakhs" closed at ₹45.4L,
   * 0% gap closed, 0% movement). Resolve the common quantifiers to a real delta
   * so the SAME deliverability gate downstream either honors the demand (in-gap,
   * in-band → close at the bumped figure) or declines it (undeliverable → fall
   * through to counter) — never a silent accept at the un-bumped number. Gated
   * on the same increase intent as the numeric path, and welded to a cash noun
   * so "a couple of days"/"a few weeks" never register as a bump. */
  const cashNoun = String.raw`(?:l|lpa|lakhs?|lac|base|fixed|cash|ctc)`;
  const wordDelta = new RegExp(
    String.raw`\b(?:by|another|add|of|up)?\s*a?\s*(couple|few|several)\s+(?:of\s+)?(?:more\s+)?${cashNoun}\b`,
  ).exec(t);
  if ((wantsMore || another != null || more != null) && wordDelta) {
    const d = WORD_MAGNITUDE[wordDelta[1]];
    if (Number.isFinite(d) && d > 0 && d <= 50) return { kind: "delta", lakhs: d };
  }
  /* #33b (2026-07-08, offline hostile battery) — article/fraction-quantified
   * lakh deltas. The same soft-false-close class as the couple/few magnitudes,
   * but the quantity is an indefinite article or "half": "just a lakh more and
   * I'll sign" (+1L), "add half a lakh" (+0.5L). The digit-only parser dropped
   * both (no \d), so the demand closed at the un-bumped offer. Resolve to the
   * delta so the unchanged deliverability gate honors or declines it. Welded to
   * a lakh noun and gated on increase intent, so "a day"/"half an hour" never
   * register. "half" is checked first — "half a lakh" also matches the article
   * pattern, and 0.5 is the correct reading. */
  const lakhNoun = String.raw`(?:l\b|lpa|lakhs?|lac)`;
  const halfLakh = new RegExp(String.raw`\bhalf\s+a\s+${lakhNoun}`).test(t);
  if (wantsMore && halfLakh) return { kind: "delta", lakhs: 0.5 };
  const articleLakh = new RegExp(
    String.raw`\b(?:a|an|one)\s+(?:more\s+)?${lakhNoun}`,
  ).test(t);
  if (wantsMore && articleLakh) return { kind: "delta", lakhs: 1 };
  /* S50-B10 (2026-07-24) — directional-approach absolute target. "Get closer
   * to ₹28L", "move towards 30L", "come nearer to 28" — the candidate names
   * a figure they want the offer to approach. This is an absolute target (the
   * figure IS the destination), but it carries no increase verb, increase
   * adverb, or delta/percent cue, so every branch above missed it and
   * resolveConditionalCashTarget returned null → the near-offer gate closed at
   * the standing offer with "we're in the same range" (19% gap). Add a
   * dedicated directional-approach branch: not gated on wantsMore, gated on
   * directional verb + approach preposition adjacent to the figure so non-comp
   * uses ("get back to you", "come to the meeting") never fire. The caller's
   * gap check (±₹2L or 6%) then correctly decides: within gap → converge;
   * beyond gap → fall through to counter-offer. */
  const approach =
    /\b(?:get|move|come|bring|push|take|work)\s+(?:(?:it|us|things?|the\s+(?:number|package|total|ctc|offer|cash|fixed|comp))\s+)?(?:up\s+)?(?:closer\s+to|nearer\s+to|towards?|approaching?)\s+(?:₹|rs\.?\s*|inr\s*)?(\d+(?:\.\d+)?)\s*(lpa|lakhs?|lac|l\b|k\b|cr|crores?|m\b|mn|million)?\b/i.exec(
      t,
    );
  if (approach) {
    const v = parseFloat(approach[1]);
    if (Number.isFinite(v) && v > 0 && v <= 200) return { kind: "absolute", lakhs: v };
  }
  return null;
}

/** The numeric cash TARGET the candidate has conditioned a close on, or null
 *  when there is no numeric cash condition. Thin wrapper over
 *  parseCashIncreaseIntent: pull the last candidate utterance, decide whether a
 *  bonus co-occurs (→ unitMandatory, #36), parse the intent, then apply the
 *  offer in ONE place. A pure sweetener ("if you throw in a joining bonus")
 *  carries no cash intent and returns null, so the near-offer gate's PRI-63
 *  path still owns it and closes at the offer as before. Pure. */
export function resolveConditionalCashTarget(
  state: NegotiationState,
  offer: number,
): number | null {
  if (!Number.isFinite(offer) || offer <= 0) return null;
  const log = state.conversationLog ?? [];
  let text = "";
  for (let i = log.length - 1; i >= 0; i--) {
    const e = log[i];
    if (e && e.speaker === "candidate") {
      text = e.text || "";
      break;
    }
  }
  if (!text) return null;
  const t = ` ${text.toLowerCase()} `;
  /* #36 — a bonus named in the same breath forces unit-mandatory base-delta
   * parsing so the bonus amount is never misread as a base bump. */
  const bonusPresent =
    /\b(joining|signing|sign[-\s]?on|retention|relocation|reloc|esops?|rsus?|equity|stock|bonus)\b/.test(
      t,
    );
  const intent = parseCashIncreaseIntent(text, { unitMandatory: bonusPresent });
  if (!intent) return null;
  if (intent.kind === "percent") return offer + (offer * intent.pct) / 100;
  if (intent.kind === "delta") return offer + intent.lakhs;
  return intent.lakhs; // absolute
}

/** #105 — the FIXED figure the candidate has pinned a (conditional) close to,
 *  or null. Two shapes occur in the wild:
 *    1. a FIXED-scoped counter — `lastCounterComponent === "fixed"` carries
 *       the number on `lastCandidateCounterLpa`; and
 *    2. a fixed-scoped conditional ask ("if you can do ₹40L fixed, I'll
 *       sign") — the live classifier records this as `candidateTargetFixed`
 *       and leaves `lastCounterComponent` null. A component-only check missed
 *       exactly this (the reported #105 reproduction), so we consult
 *       `candidateTargetFixed` too.
 *  A stated TOTAL counter takes priority over a fixed target (the callers
 *  check `totalScopedCounter` first). Pure. */
export function resolveFixedCloseAsk(state: NegotiationState): number | null {
  if (state.lastCounterComponent === "fixed" && state.lastCandidateCounterLpa != null) {
    return state.lastCandidateCounterLpa;
  }
  if (state.candidateTargetFixed != null) return state.candidateTargetFixed;
  return null;
}

/** #105 — the DELIVERABLE total-equivalent of a FIXED-scoped close ask, or
 *  null when the band cannot deliver it.
 *
 *  A candidate who closes conditionally on a FIXED number ("if you can do
 *  ₹40L fixed, I'll sign today") has not stated a total. The fixed ask still
 *  implies a total — fixed + the band's variable headroom — but honoring it
 *  is only legitimate when the band can actually deliver it: the fixed
 *  component must sit at/under the base ceiling (`band.baseStretch`) AND the
 *  implied total at/under the band ceiling (`band.maxStretch`). When either
 *  bound is exceeded the fixed ask is structurally undeliverable and this
 *  returns null — the caller must DECLINE the condition (naming the unmet
 *  fixed term) rather than silently close on lower total terms.
 *
 *  Returns null when no fixed close-ask is on the table. Pure. */
export function fixedScopedCloseTotal(state: NegotiationState): number | null {
  const fixed = resolveFixedCloseAsk(state);
  if (fixed == null) return null;
  const baseCap = state.band.baseStretch ?? state.band.maxStretch;
  if (fixed > baseCap) return null; // undeliverable as a fixed component
  const impliedTotal = fixed + (state.band.variableMax ?? 0);
  if (impliedTotal > state.band.maxStretch) return null; // undeliverable as total
  return impliedTotal;
}

/** #105 — the candidate's FIXED conditional-close ask IFF the band cannot
 *  deliver it, else null. A non-null result means the close gates must
 *  DECLINE (route the turn to the fixed-counter cascade, which honestly
 *  engages the unmet base/structure cap) instead of firing a close that
 *  silently lands on a lower total framed as meeting the candidate's terms.
 *  Returns the raw undeliverable fixed figure (for rationale/prose). Pure. */
export function undeliverableFixedConditionAsk(
  state: NegotiationState,
): number | null {
  const fixed = resolveFixedCloseAsk(state);
  if (fixed == null) return null;
  return fixedScopedCloseTotal(state) == null ? fixed : null;
}

/** #105 — true when a pending FIXED close-ask cannot be honored AT or NEAR
 *  the standing offer, so a close here would be a stealth under-close (the
 *  "we're in the same range, lock it at ₹X" framing while the candidate
 *  actually asked for a higher fixed number). Blocks when the fixed ask is
 *  either structurally undeliverable OR a real gap above the offer (beyond
 *  the trivial close window). A deliverable fixed ask at/under the offer, or
 *  within the near-offer gap, does NOT block — the close honors it. Pure. */
export function fixedConditionBlocksClose(state: NegotiationState): boolean {
  const fixed = resolveFixedCloseAsk(state);
  if (fixed == null) return false;
  const offer = state.highestOfferMade;
  if (!(offer > 0)) return false;
  const delivered = fixedScopedCloseTotal(state);
  if (delivered == null) return true; // undeliverable fixed ask → block
  const gap = Math.max(2, offer * 0.06);
  return delivered - offer > gap; // deliverable but a real live gap → block
}

/** F7 (PDF#20 2026-05-15) — build a merged "skip" record that combines
 *  discoveryRefusedItems with any topics that were asked in the last
 *  withinTurns turns so getNextOrderedDiscoveryItem skips them both.
 *
 *  BUG-2 ROOT CAUSE FIX (PDF#24, 2026-05-16): the recently-asked branch
 *  was unconditional — any topic asked in the last 3 turns got skipped,
 *  even if the candidate never answered it. Real session: turn 0
 *  canonical opener asked currentCtc; candidate replied with a hike-
 *  rationale (no number). On the next planner turn, currentCtc was in
 *  the recently-asked set so the planner SKIPPED it and fell through
 *  to expected-CTC fitment-split — which was the symptom in PDF#24
 *  turn 4 (bot skipped currentCtc backfill, jumped to fitment-split
 *  the moment the candidate volunteered expected CTC).
 *
 *  The recency suppression is for "don't immediately re-ask what the
 *  candidate JUST answered" — it should only fire when the asked-AND-
 *  answered both hold. We gate the recently-asked block by checking
 *  the discovery checklist: if the corresponding `*Answered`/`*Disclosed`
 *  flag is still false, the candidate dodged the ask, and the planner
 *  must keep the item in the ordered sequence so it can backfill the
 *  gap. */
export function isAskedTopicAnswered(
  checklist: NegotiationState["discoveryChecklist"],
  topic: DiscoveryTopic,
  state?: NegotiationState,
): boolean {
  /* Session #25 root-fix (2026-05-16) — state-derived satisfaction signal.
   * The discovery checklist normally tracks satisfaction, but if
   * syncChecklistFromParsedFacts desyncs (legacy session, parser miss
   * later corrected by foldFactsIntoState, etc.) the planner could
   * re-fire a topic whose fact is already in NegotiationState. Read the
   * fact fields directly as an OR-satisfaction signal — either the
   * checklist OR the bound fact satisfies the topic. */
  if (state != null) {
    if (
      (topic === "currentCtcAnswered" || topic === "currentCtcAsked") &&
      state.candidateCurrentCtc != null
    ) {
      return true;
    }
    if (
      (topic === "targetAnswered" || topic === "targetAsked") &&
      /* S59-B6 (2026-07-24) — also check candidateTargetFixed. When the
       * candidate states a fixed-scoped target ("₹55L fixed"), the kernel
       * writes candidateTargetFixed and leaves candidateTarget null. Without
       * this arm, isAskedTopicAnswered returns false → target probe re-fires
       * despite the target already being known. Mirror line 913 which already
       * checks both fields. */
      (state.candidateTarget != null || state.candidateTargetFixed != null)
    ) {
      return true;
    }
    if (
      (topic === "competingOffersAnswered" || topic === "competingOffersAsked") &&
      (state.competingOffer != null || state.competingOfferDetail?.hasAny)
    ) {
      return true;
    }
  }
  if (checklist == null) return false;
  /* The askedTopic key the planner pushes mirrors the DISCOVERY_SEQUENCE
   * key for discovery probes (currentCtcAnswered, targetAnswered, etc.),
   * which doubles as the satisfied-flag name on DiscoveryChecklist.
   * Look it up directly; treat any unrecognised key as "still pending"
   * so we never accidentally over-skip a topic we can't reason about. */
  const flag = (checklist as unknown as Record<string, boolean | undefined>)[topic];
  if (typeof flag === "boolean" && flag) return true;
  /* Some legacy planner sites use a `*Asked` topic name (e.g.
   * "currentCtcAsked"). Those are pre-F7 sentinels we treat as
   * satisfied iff the matching `*Answered`/`*Disclosed` flag is set;
   * if not, leave them OUT of the skip record so the gap stays
   * visible to the ordered cascade. */
  if (topic.endsWith("Asked")) {
    const root = topic.slice(0, -"Asked".length);
    // Same dynamic-key lookup as `flag` above, for the derived *Answered/*Disclosed names.
    const answered = (checklist as unknown as Record<string, boolean | undefined>)[`${root}Answered`];
    const disclosed = (checklist as unknown as Record<string, boolean | undefined>)[`${root}Disclosed`];
    return Boolean(answered || disclosed);
  }
  return false;
}

export function buildSkipRecord(
  state: NegotiationState,
  withinTurns = 3,
): Partial<Record<DiscoveryTopic, boolean>> | null {
  const refused = state.discoveryRefusedItems ?? null;
  const topics = readAskedTopics(state);
  const cutoff = state.turnIndex - withinTurns;
  const recentlyAsked: Partial<Record<DiscoveryTopic, boolean>> = {};
  for (const t of topics) {
    if (t.atTurn <= cutoff) continue;
    /* Only mark as "skip" if the topic was both asked AND answered
     * within the window. Asked-but-unanswered topics stay re-askable
     * so the discovery cascade can backfill the gap. */
    if (!isAskedTopicAnswered(state.discoveryChecklist, t.topic, state)) continue;
    recentlyAsked[t.topic] = true;
  }
  /* Session #25 root-fix (2026-05-16) — 3-strike consecutive-topic cap.
   * Even when the candidate has dodged a discovery item across multiple
   * turns (and the BUG-2 gate would otherwise keep re-asking it), don't
   * fire the SAME discovery topic three turns in a row. After two
   * consecutive unanswered asks, force-advance so the cascade can move
   * on to the next item. In dev we throw to surface regressions; in
   * prod we silently force-skip and rely on the defensive log
   * downstream. */
  const tail = topics.slice(-2);
  if (tail.length === 2 && tail[0].topic === tail[1].topic) {
    const stuckTopic = tail[0].topic;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[planner] discovery topic "${stuckTopic}" has fired twice in a row at turns ` +
          `${tail[0].atTurn},${tail[1].atTurn}; force-advancing past it on turn ${state.turnIndex}.`,
      );
    }
    recentlyAsked[stuckTopic] = true;
  }
  /* PDF#27 Fix 2 (2026-05-17) — repetition-complaint force-advance.
   * When the candidate explicitly complains the bot is repeating, mark
   * the most-recent-asked topic as skipped so the next probe routes
   * elsewhere. Sticky for one turn — the complaint applies to the
   * topic that triggered it, not to all topics for the session. */
  if (
    state.repetitionComplaintAtTurn != null &&
    state.repetitionComplaintAtTurn >= state.turnIndex - 1 &&
    topics.length > 0
  ) {
    const lastAsked = topics[topics.length - 1].topic;
    recentlyAsked[lastAsked] = true;
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[planner] repetition-complaint at turn ${state.repetitionComplaintAtTurn}; ` +
          `force-advancing past last-asked topic "${lastAsked}" on turn ${state.turnIndex}.`,
      );
    }
  }
  /* PDF #45 second-pass audit (2026-05-22) — POST-FRUSTRATION-RECOVERY
   * force-advance. After `acknowledge-and-recover` fires, the next
   * planner call re-enters the ordered discovery cascade. If the same
   * topic that triggered the frustration is still un-answered, the
   * cascade re-asks it — which is exactly the loop the recovery was
   * meant to break.
   *
   * S52-WL-B6 / S53-B2 (2026-07-24) — skipping only the LAST-ASKED topic
   * was insufficient: the cascade advanced to the NEXT discovery topic
   * (notice period, competing offers, etc.) instead of proceeding to
   * offer-reveal. After an acknowledge-and-recover the recruiter has
   * already apologised for looping — a real recruiter would pivot to
   * the offer at that point, not interrogate a different item. Fix:
   * skip ALL Tier-1/2 discovery topics so the cascade exits discovery
   * and falls through to anchor/open-with-offer. */
  const lastLever = state.leversUsed[state.leversUsed.length - 1];
  if (lastLever === "acknowledge-and-recover") {
    const ALL_DISCOVERY_TOPICS: DiscoveryTopic[] = [
      "currentCtcAsked", "currentCtcAnswered",
      "fixedVariableSplitAsked", "fixedVariableSplitAnswered",
      "noticePeriodAsked", "noticePeriodAnswered",
      "competingOffersAsked", "competingOffersAnswered",
      "valueProofAsked", "valueProofAnswered",
      "targetAsked", "targetAnswered",
    ];
    for (const t of ALL_DISCOVERY_TOPICS) {
      recentlyAsked[t] = true;
    }
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[planner] post-recovery force-advance (S52-WL-B6): skipping ALL discovery topics on turn ${state.turnIndex} to pivot to offer-reveal.`,
      );
    }
  }
  if (refused == null && Object.keys(recentlyAsked).length === 0) return null;
  return { ...(refused ?? {}), ...recentlyAsked };
}

/** AP3-F2 (2026-05-17) — senior comp-negotiation signal. Real Indian
 *  recruiters break the current-CTC into base / variable / ESOP only
 *  when the candidate's profile makes the components material. Two
 *  signals qualify:
 *    - applicableYoe >= 4 (the role-applicable YOE — promoted from the
 *      Phase 29 distinction; total YOE doesn't reliably predict comp-
 *      structure literacy in domain-switch cases);
 *    - target role string matches /senior|lead|principal|staff/i — the
 *      title itself signals the band where components matter.
 *  Either signal is sufficient. Pure. */
export function isSeniorCompProfile(state: NegotiationState): boolean {
  const yoe = state.candidateApplicableYoe;
  if (yoe != null && yoe >= 4) return true;
  if (state.role && /senior|lead|principal|staff/i.test(state.role)) return true;
  return false;
}

/** AP3-F2 (2026-05-17) — pick the next un-probed AND un-satisfied
 *  component in canonical order (base → variable → esop). Returns null
 *  when all components are either populated on
 *  state.candidateComponentBreakdown OR already asked this session
 *  (recorded in state.askedTopics under the matching `currentCtc*`
 *  topic key).
 *
 *  FL4 / Audit Pass 4 (PDF#27, 2026-05-17) — hard precondition:
 *  state.candidateCurrentCtc MUST be non-null. Without the total
 *  in hand, asking for the base split presupposes a number the
 *  candidate hasn't disclosed. The outer planner gate already
 *  enforces this; the local guard makes the invariant local to
 *  nextComponentProbe so any future caller (or a regression that
 *  moves the gate) still cannot fire component-probe on YOE signal
 *  alone. Pure. */
export function nextComponentProbe(
  state: NegotiationState,
): { component: "base" | "variable" | "esop"; topic: DiscoveryTopic } | null {
  /* FL4 root precondition — currentCtc must be in hand. */
  if (state.candidateCurrentCtc == null) return null;
  /* S2-B5 (2026-07-22) — early-exit when the split is already fully answered.
   * The checklist's fixedVariableSplitAnswered flag is set when BOTH base and
   * variable have been disclosed (absolute or percentage). When this is true,
   * re-probing either component is a loop — the candidate already answered the
   * split question; the parser just didn't persist both numbers into bd. Skip
   * base and variable probes; ESOP is still eligible since it's independent. */
  const splitAlreadyAnswered = state.discoveryChecklist?.fixedVariableSplitAnswered === true;
  const bd = state.candidateComponentBreakdown;
  const asked = new Set(readAskedTopics(state).map((t) => t.topic));
  /* PDF#31 BUG A (2026-05-18) — esop component is "populated" when the
   * candidate has explicitly stated NO equity (equityExists === false).
   * Otherwise the bot re-asks "ESOPs in play?" after the candidate
   * already said no — exactly the Meesho/Prita repro. */
  const esopNegated = state.equityVesting?.equityExists === false;
  /* PDF#33 Move B1 (2026-05-18) — when `variable` arrived via complement
   * inference (`variableInferred === true`), the candidate never
   * explicitly stated it. Treat as NOT populated so the variable probe
   * fires for confirmation ("Quick check — variable is the remaining
   * ₹X on that ₹Y total?"). The candidate's reply either confirms the
   * derived number, corrects it, or denies any variable at all (which
   * the next parse will overwrite to a non-inferred value or null). */
  const variablePopulated = bd?.variable != null && bd?.variableInferred !== true;
  const order: { component: "base" | "variable" | "esop"; topic: DiscoveryTopic; populated: boolean }[] = [
    { component: "base", topic: "currentCtcBase", populated: splitAlreadyAnswered || bd?.base != null },
    { component: "variable", topic: "currentCtcVariable", populated: splitAlreadyAnswered || variablePopulated },
    { component: "esop", topic: "currentCtcEsop", populated: bd?.equity != null || esopNegated },
  ];
  for (const o of order) {
    if (o.populated) continue;
    if (asked.has(o.topic)) continue;
    return { component: o.component, topic: o.topic };
  }
  return null;
}

/** FL5 / Audit Pass 4 (PDF#27, 2026-05-17) — uncertainty escape hatch.
 *
 * Called when the planner is about to fire a discovery-probe for
 * `pendingItem`. If the candidate's PRIOR turn was uncertain
 * (state.lastAnswerUncertainAt === state.turnIndex - 1) AND the most-
 * recently-asked topic matches the item we're about to re-ask, the
 * planner picks deterministically between:
 *
 *   - `advance:true` — skip this item on this turn and let the cascade
 *     move on. The caller re-runs getNextOrderedDiscoveryItem with the
 *     stuck topic injected into the skip record.
 *
 *   - `rangeAsk:"<prose>"` — keep the item but swap the canonical
 *     question for a range-shaped one ("rough range — under 30, 30-40,
 *     40+ LPA?") so the candidate can answer without precision.
 *
 * Deterministic by state.turnIndex % 2 — keeps test surfaces stable;
 * the same session always sees the same cadence.
 *
 * Returns `{advance:false, rangeAsk:null}` when uncertainty doesn't
 * apply — caller should ship the default ordered ask. Pure. */
export function applyUncertaintyEscapeHatch(
  state: NegotiationState,
  pendingItem: DiscoveryTopic,
  _defaultAsk: string,
): { advance: boolean; rangeAsk: string | null } {
  const NO_OP = { advance: false, rangeAsk: null } as const;
  const uncertainAt = state.lastAnswerUncertainAt ?? null;
  if (uncertainAt == null) return NO_OP;
  /* PDF#27 FL5 off-by-one fix (2026-05-17) — recency window covers
   * BOTH the same-turn case (planner runs inside applyCandidateAnswer
   * before the next applyAiMove increments turnIndex, so
   * lastAnswerUncertainAt === state.turnIndex) AND the next-turn case
   * (lastAnswerUncertainAt === state.turnIndex - 1, the historical
   * shape this function assumed). Without the same-turn allowance the
   * escape hatch never fired in the kernel-driven test harness — the
   * uncertain candidate utterance and the planner read state at
   * identical turnIndex values. */
  if (uncertainAt !== state.turnIndex && uncertainAt !== state.turnIndex - 1) return NO_OP;
  /* The escape hatch is only triggered when we're about to re-ASK
   * the same topic that triggered the uncertain reply. Looking at
   * state.askedTopics tail tells us the topic the candidate was
   * hedging about — if the cascade has already moved on to a fresh
   * topic, no escape hatch is needed. */
  const tail = readAskedTopics(state).slice(-1)[0]?.topic ?? null;
  if (tail == null) return NO_OP;
  /* Strip the *Answered/*Disclosed suffix so the comparison normalises
   * across the asked-topic ledger and the planner's checklist keys. */
  const tailRoot = (tail as string).replace(/(?:Answered|Disclosed|Asked)$/, "");
  const pendingRoot = (pendingItem as string).replace(/(?:Answered|Disclosed|Asked)$/, "");
  if (tailRoot !== pendingRoot) return NO_OP;
  const advance = state.turnIndex % 2 === 1;
  if (advance) return { advance: true, rangeAsk: null };
  /* Range-ask: pick a topic-appropriate range template. The default
   * is a CTC-shaped range — covers currentCtc / target / expected
   * which are the topics where range framing is sensible. */
  const rangeAsk = buildUncertaintyRangeAsk(pendingRoot);
  return { advance: false, rangeAsk };
}

export function buildUncertaintyRangeAsk(itemRoot: string): string {
  if (/^currentCtc/i.test(itemRoot)) {
    return "Rough range is fine — under 15, 15-25, 25-40, or 40+ LPA?";
  }
  if (/^(?:expectedCtc|target)/i.test(itemRoot)) {
    return "Rough range works too — under 20, 20-30, 30-45, or 45+ LPA?";
  }
  if (/^noticePeriod/i.test(itemRoot)) {
    return "Rough range is fine — under 30 days, 30-60, 60-90, or 90+?";
  }
  /* Fallback for any other discovery topic — just acknowledge the
   * uncertainty and reframe as approximate. */
  return "A rough range is fine — no need for an exact number.";
}

/* Fix 1 (2026-05-16) — sample the next un-fired structural lever based on
 * marketMode. Returns null when every lever has fired (caller falls
 * through to the legacy cash-lever rotation). */
/** PDF#30 R5 (2026-05-18, Meesho/Prita T12) — disclosed-CTC anchor floor.
 *
 *  Real recruiters never anchor BELOW a candidate's already-disclosed
 *  current CTC; doing so signals an immediate lowball and burns trust.
 *  But the planner emits `anchor-with-offer` at the band FLOOR (`lo`)
 *  by design — and when band.initialOffer < candidateCurrentCtc, the
 *  point-offer goes out below the disclosed package.
 *
 *  PDF#30 evidence: Prita disclosed 24 LPA, band.initialOffer was 23,
 *  the anchor went out at ₹23L — below her current CTC. Recoverable
 *  only via R1 (which lifts parser accuracy so candidateCurrentCtc is
 *  populated) PLUS this floor (which honours the disclosure).
 *
 *  Policy: clamp the anchor to max(lo, candidateCurrentCtc * (1 + MIN_HIKE_PCT)).
 *  If that pushes us above `hi`, cap at `hi` — the band is structurally
 *  too tight for this candidate but we still hold the maxStretch ceiling.
 *  When candidateCurrentCtc is null, return `lo` unchanged.
 *
 *  PDF#31 BUG C fix (2026-05-18, Meesho/Prita): the previous version
 *  only lifted the anchor TO currentCtc, not ABOVE — anchoring at the
 *  candidate's current package is functionally a zero-hike offer and
 *  reads as a lowball. Real Indian-market hike norms for a Sr PD switch
 *  are 20–30 %; we anchor at MIN 15 % to leave headroom for the
 *  counter-base bargaining round to land in the 20–30 % zone. The floor
 *  is conservative; the planner's negotiation loop pushes higher on
 *  candidate counter. */
export const MIN_HIKE_PCT_FOR_ANCHOR = 0.15;

/** PDF #45 fix (2026-05-22) — tier-aware hike floor. The flat 15% floor
 *  is junior-grade and reads as a lowball for senior switches. Real
 *  Indian-market norms for a Senior / Lead / Principal / Staff role
 *  with ≥4 YoE applicable are 25–35% on switch. User-reported
 *  Flipkart Sr PD transcript anchored at ₹37 LPA on a candidate with
 *  current CTC ₹32–36 LPA (15% floor = 36.8, rounded to 37) — a
 *  ₹1 LPA hike on switch. Real Sr PD floor is ₹40 LPA (25% floor) or
 *  higher. Returns the role-aware percentage. */
export function minHikePctForRole(state: NegotiationState): number {
  const role = (state.role || "").toLowerCase();
  const seniorRoleRe = /\b(?:senior|lead|principal|staff|sr\.?|director|head)\b/i;
  const isSeniorRole = seniorRoleRe.test(role);
  const applicableYoe = state.candidateApplicableYoe ?? 0;
  if (isSeniorRole || applicableYoe >= 4) return 0.25;
  return MIN_HIKE_PCT_FOR_ANCHOR;
}

/** PDF#31 BUG D fix (2026-05-18, Meesho/Prita T18) — minimum number of
 *  counter-base rounds that must have happened before a hold-firm action
 *  can fire from a non-acceptance, non-rescission emission site. Real
 *  Indian-HR bargaining patterns require at least two counter-rounds
 *  before "we'll hold the fitment" reads as honest negotiation rather
 *  than a stonewall. Verbal-accept hold-firm and the counter-spiral-
 *  exhausted hold-firm (round >= 3) bypass this — those are structurally
 *  later in the flow and the candidate has already consumed the offered
 *  concessions. */
export const MIN_COUNTER_ROUNDS_BEFORE_HOLD_FIRM = 2;

/* AUDIT-W02 BUG-001 (2026-06-08) — Return `number | null`. Null signals
 * "band-incomplete defer" so callers emit a defer rather than a pay-cut
 * anchor when the band ceiling is below the disclosed current CTC.
 * Picked null over { defer: true } because all three callers already
 * have an existing bandIncomplete-defer branch to reuse — minimal churn. */
export function clampAnchorAboveDisclosed(
  lo: number,
  hi: number,
  state: NegotiationState,
): number | null {
  const disclosed = state.candidateCurrentCtc;
  if (typeof disclosed !== "number" || disclosed <= 0) return lo;
  /* Floor = disclosed * (1 + hike) — anchor must beat current CTC by a
   * real margin, not merely match it. PDF #45 (2026-05-22): tier-aware
   * hike — senior roles / ≥4 YoE candidates get a 25% floor instead of
   * 15% to match real Indian-market norms. */
  const hikePct = minHikePctForRole(state);
  const hikeFloor = disclosed * (1 + hikePct);
  /* PDF#39 BUG-D (2026-05-20) — round to INTEGER, not 1 decimal. */
  const hikeFloorRounded = Math.round(hikeFloor);
  const candidate = Math.max(lo, hikeFloorRounded);
  /* AUDIT-W02 BUG-001 — If the hike-floored candidate exceeds the band
   * ceiling AND the candidate's disclosed current already exceeds the
   * band ceiling, clamping to `hi` would emit a pay-cut anchor. Signal
   * defer instead.
   *
   * Deflect-loop terminator (2026-06-18, live-staging finding) — but
   * defer only ONCE. The honest-defer stamps `band-anchor-with-
   * rationale` while putting no number on the table, so on the next
   * relevant turn we'd defer again, and again, forever ("I'll have a
   * firmer number once the panel signs off") — and past the min-turns
   * floor the recruiter can even walk away on the candidate's own
   * acceptance. Once we've already deferred (band-anchor-with-rationale
   * stamped) and STILL have no number out (highestOfferMade === 0), a
   * real recruiter stops stalling and puts their honest ceiling on the
   * table: anchor at `hi`. This is the ONE point all ~6 honest-defer
   * callers funnel through, so the loop can't drift back in at a site
   * we forgot to patch. The first-defer null path is unchanged and stays
   * pinned by clampAnchorAboveDisclosed.belowMaxStretch.test.ts. */
  if (candidate > hi && disclosed > hi) {
    const alreadyDeferred =
      state.highestOfferMade === 0 &&
      readAskedTopics(state).some(
        (t) =>
          t.topic === "band-anchor-with-rationale" ||
          (t.topic as string) === "anchor-with-offer",
      );
    return alreadyDeferred ? hi : null;
  }
  if (candidate <= lo) return lo;
  /* Cap by maxStretch — won't blow through the band ceiling even if the
   * candidate's current CTC is structurally above it. */
  return Math.min(hi, candidate);
}

/* #PRI-53 (2026-06-21, live staging) — OPENING-anchor headroom.
 *
 * clampAnchorAboveDisclosed is shared by the opening anchor, mid-negotiation
 * counters, AND the close — for counters/closes, reaching the band ceiling is
 * correct (that's the whole point of conceding upward). But for the OPENING
 * offer it is a defect: a "tough"/aggressive manager whose disclosed-CTC hike
 * floor overshoots the ceiling (e.g. current ₹48L, band ₹32.7–₹52.3L → 25%
 * hike floor ₹60L) gets clamped to maxStretch and opens AT its own ceiling.
 * The candidate then has nowhere to negotiate up to — the practice is dead on
 * arrival.
 *
 * This wraps clampAnchorAboveDisclosed and, FOR THE OPENING ONLY, backs the
 * anchor off below the ceiling so a concession margin exists. It never opens
 * below a real raise over the disclosed CTC (no pay-cut opening) and never
 * below the band floor; when the band is genuinely too tight to satisfy both
 * (CTC sits right under the ceiling), it prefers the small-raise floor over
 * pinning the exact ceiling. Counters/closes are untouched — they still call
 * clampAnchorAboveDisclosed directly. */
export function clampOpeningAnchor(
  lo: number,
  hi: number,
  state: NegotiationState,
): number | null {
  const base = clampAnchorAboveDisclosed(lo, hi, state);
  if (base === null) return null; // honest-defer path preserved verbatim
  if (!(hi > lo)) return base; // degenerate band — nothing to reserve
  /* S40 (2026-07-23) — BATNA floor. When the candidate has disclosed a
   * competing offer that exceeds the computed anchor, the opening anchor
   * must meet or beat it; otherwise the recruiter opens below the candidate's
   * known alternative and immediately looks weak. Capped at `hi` so the band
   * ceiling is never violated. Only applied at the OPENING (this wrapper is
   * never called for mid-negotiation counters). */
  const competingFloor =
    typeof state.competingOffer === "number" && state.competingOffer > lo
      ? Math.min(hi, state.competingOffer)
      : null;
  const baseWithBatna = competingFloor != null && competingFloor > base ? competingFloor : base;
  /* Reserve ~20% of the band spread (min ₹1L) below the ceiling so the
   * candidate has somewhere to push the offer up to. */
  const headroom = Math.max(1, Math.round((hi - lo) * 0.2));
  const capped = hi - headroom;
  if (baseWithBatna <= capped) return baseWithBatna; // already leaves room — unchanged
  /* base is pinned near/at the ceiling. Back off to `capped`, but never below
   * a minimal (5%) raise over the disclosed CTC, never below the floor, and
   * never below the BATNA floor when one is present. */
  const disclosed = state.candidateCurrentCtc;
  const minRaiseOverCtc =
    typeof disclosed === "number" && disclosed > 0
      ? Math.min(hi, Math.round(disclosed * 1.05))
      : lo;
  const floor = Math.max(lo, minRaiseOverCtc, competingFloor ?? 0);
  const rawAnchor = Math.max(floor, Math.min(baseWithBatna, capped));
  /* S51-B2 (2026-07-24) — when the candidate's target is known and the
   * computed anchor meets or nearly meets it, the simulation has zero
   * negotiation headroom (opener at target → nothing to counter for).
   * Back off to ≤85% of target, floored at the band floor, so there is
   * always a meaningful gap for the candidate to push into. The 3%
   * tolerance avoids spurious triggering when the opener is just slightly
   * below a round-number target (e.g. 27.2 vs 28 is fine). */
  const knownTarget = state.candidateTarget;
  if (
    knownTarget != null &&
    Number.isFinite(knownTarget) &&
    knownTarget > 0 &&
    rawAnchor >= knownTarget * 0.97
  ) {
    const backedOff = Math.round(knownTarget * 0.82 * 10) / 10;
    return Math.max(lo, Math.min(backedOff, rawAnchor - 1));
  }
  return rawAnchor;
}
