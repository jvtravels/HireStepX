/* Next-action planner: paraphrase recaps, calibrated surprise, sweeteners, manager-consult stalls. */

import { type NegotiationState, isTerminalPhase, statedTotalTargetCtcLpa, totalScopedCounter } from "./_negotiation-kernel";
import { type RecruiterSectorPersona, getRecruiterSectorPersona } from "./_indian-recruiter-personas";
import type { PlannedAction } from "./_planner-actions";
import { undeliverableFixedConditionAsk } from "./_planner-close";

/* Paraphrase-loop feature (2026-05-29) — recap-before-decision gate.
 *
 * Fires at most once per session, just before manager-consult-stall OR
 * before phase transition into close (proxied via state.phase ===
 * "closing-push"). Requires ≥3 distinct disclosed facts in userClaims.
 * Skipped if the last 2 AI turns already contained a recap pattern. */
export const PARAPHRASE_MIN_FACTS = 3;
export const RECENT_RECAP_RE = /\bso if i|let me recap|to summari[sz]e\b/i;

export function _collectParaphraseFacts(
  state: NegotiationState,
): Array<{ label: string; value: string }> {
  const claims = state.userClaims ?? {};
  const facts: Array<{ label: string; value: string; firstSeenTurn: number }> = [];
  if (claims.expectedCtc != null) {
    facts.push({
      label: "base ask",
      value: `₹${claims.expectedCtc.value}L`,
      firstSeenTurn: claims.expectedCtc.firstSeenTurn,
    });
  }
  if (claims.noticePeriod != null) {
    facts.push({
      label: "notice",
      value: `${claims.noticePeriod.value}-day notice`,
      firstSeenTurn: claims.noticePeriod.firstSeenTurn,
    });
  }
  if (claims.currentCtc != null) {
    facts.push({
      label: "current",
      value: `current at ₹${claims.currentCtc.value}L`,
      firstSeenTurn: claims.currentCtc.firstSeenTurn,
    });
  }
  if (claims.competingOffer != null) {
    facts.push({
      label: "competing",
      value: `${claims.competingOffer.value.company} at ₹${claims.competingOffer.value.amount}L`,
      firstSeenTurn: claims.competingOffer.firstSeenTurn,
    });
  }
  if (claims.currentRole != null) {
    facts.push({
      label: "current role",
      value: String(claims.currentRole.value),
      firstSeenTurn: claims.currentRole.firstSeenTurn,
    });
  }
  /* Most-recent first (largest firstSeenTurn). */
  facts.sort((a, b) => b.firstSeenTurn - a.firstSeenTurn);
  return facts.slice(0, 4).map((f) => ({ label: f.label, value: f.value }));
}

export function _recentRecapInTranscript(state: NegotiationState): boolean {
  const log = state.conversationLog ?? [];
  let aiSeen = 0;
  for (let i = log.length - 1; i >= 0 && aiSeen < 2; i--) {
    const e = log[i];
    if (e?.speaker !== "ai" || typeof e.text !== "string") continue;
    aiSeen++;
    if (RECENT_RECAP_RE.test(e.text)) return true;
  }
  return false;
}

export function _sectorParaphraseVariant(
  persona: RecruiterSectorPersona,
): "formal" | "casual" {
  if (
    persona === "bfsi" ||
    persona === "psu" ||
    persona === "consulting-mbb" ||
    persona === "consulting-big4"
  ) {
    return "formal";
  }
  return "casual";
}

/** Calibrated-surprise lowball feature (2026-05-29) — planner gate.
 *
 *  Real recruiters who hear a candidate anchor meaningfully BELOW band
 *  floor don't silently accept; they probe with calibrated surprise.
 *  This gate fires when:
 *    1. The candidate has disclosed a numeric anchor (userClaims.expectedCtc
 *       OR candidateTarget).
 *    2. That anchor sits at < 0.80 × band floor (band.walkAway). The
 *       20% threshold is the "meaningful undershoot" mark — anything
 *       smaller (5-19%) is just optimistic anchoring and doesn't fire.
 *    3. Single-fire per session (state.calibratedSurpriseFired).
 *    4. Recruiter affinity ≥ -1. Below -1 the recruiter has already
 *       cooled on the candidate and quietly pockets the lowball — the
 *       cynical real-world variant.
 *
 *  Branch-A follow-up (accept-lowball-quiet) ships when applyCandidateAnswer
 *  classified the candidate's reply as a double-down (acceptedLowball
 *  was stamped). That branch ALSO needs to short-circuit before the
 *  routine cascade so the recruiter quietly closes rather than
 *  re-engaging discovery / counter-offer arms. */
export const CALIBRATED_SURPRISE_THRESHOLD = 0.80;

export function maybePlanCalibratedSurprise(
  state: NegotiationState,
): PlannedAction | null {
  /* Branch A follow-up — applyCandidateAnswer stamped acceptedLowball
   * on the prior turn; ship the quiet accept now. Single-fire by the
   * very nature of `acceptedLowball` being sticky-true and us also
   * requiring `calibratedSurpriseFired` (which only flips once). */
  if (
    state.acceptedLowball === true &&
    state.calibratedSurpriseFired === true &&
    !isTerminalPhase(state.phase)
  ) {
    /* Don't re-fire the accept after the planner has already shipped
     * it once: applyAiMove stamps `acceptLowballQuietFiredAtTurn`. */
    if (state.acceptLowballQuietFiredAtTurn == null) {
      const anchor =
        state.calibratedSurpriseContext?.candidateAnchor ??
        state.userClaims?.expectedCtc?.value ??
        state.candidateTarget ??
        0;
      return {
        kind: "accept-lowball-quiet",
        candidateAnchor: anchor,
        _move: {
          lever: "close-acceptance",
          newTotalLpa: anchor,
          actionKind: "accept-lowball-quiet",
          rationale:
            `Calibrated-surprise lowball — candidate doubled down on ` +
            `₹${anchor}L after the probe. Quiet accept; coaching surfaces ` +
            `acceptedLowball=true on the report.`,
        },
      } as PlannedAction;
    }
  }

  /* Open-gate — already fired? */
  if (state.calibratedSurpriseFired === true) return null;
  /* Recruiter affinity gate. */
  const affinity = state.recruiterAffinity ?? 0;
  if (affinity < -1) return null;
  /* Terminal phases skip. */
  if (isTerminalPhase(state.phase)) return null;
  /* Phase gate — only fire during anchor-discovery; once an offer is on
   * the table or candidate is countering live, the routine close/counter
   * cascade owns the turn. */
  if (
    state.phase !== "opening" &&
    state.phase !== "range-disclosure" &&
    state.phase !== "probe-expectations"
  ) {
    return null;
  }
  /* If recruiter has already put an offer on the table, the surprise
   * window has closed — fall through to the offer/close cascade. */
  if ((state.highestOfferMade ?? 0) > 0) return null;
  if (state.lastCandidateCounterLpa != null) return null;
  /* Numeric anchor must be disclosed. Class-A (2026-06-15): read the
   * total-CTC-scoped target, not the raw field — an in-hand-framed target
   * compared raw against the total walkAway floor produced a false lowball
   * flag (the take-home number is naturally ~13-25% below a CTC floor). */
  const anchor =
    state.userClaims?.expectedCtc?.value ??
    statedTotalTargetCtcLpa(state) ??
    null;
  if (anchor == null || !Number.isFinite(anchor) || anchor <= 0) return null;
  /* Band floor — use walkAway (real recruiter floor). */
  const floor = state.band?.walkAway;
  if (typeof floor !== "number" || floor <= 0) return null;
  /* 20% under floor gate. */
  const ratio = anchor / floor;
  if (ratio >= CALIBRATED_SURPRISE_THRESHOLD) return null;
  const gapPct = 1 - ratio;
  return {
    kind: "calibrated-surprise-lowball",
    tactic: "calibrated-surprise-lowball",
    candidateAnchor: anchor,
    bandFloor: floor,
    gapPct,
    _move: {
      lever: "probe",
      newTotalLpa: null,
      actionKind: "calibrated-surprise-lowball",
      rationale:
        `Calibrated-surprise lowball probe — candidate anchored at ` +
        `₹${anchor}L vs band floor ₹${floor}L (${(gapPct * 100).toFixed(0)}% ` +
        `under). Single-fire; affinity=${affinity}.`,
    },
  } as PlannedAction;
}

export function maybePlanParaphraseRecap(
  state: NegotiationState,
): PlannedAction | null {
  /* Single-fire. */
  if (state.paraphraseFired === true) return null;
  /* Fact-count gate. */
  const facts = _collectParaphraseFacts(state);
  if (facts.length < PARAPHRASE_MIN_FACTS) return null;
  /* Recent-recap skip. */
  if (_recentRecapInTranscript(state)) return null;
  /* Trigger context: about to fire manager-consult-stall (open) OR phase
   * is closing-push. Mirror manager-consult open-gate predicates so the
   * paraphrase runs the turn BEFORE the stall would open. */
  const aboutToStallOpen = (() => {
    if ((state.stallTurnsRemaining ?? 0) > 0) return false; /* return-turn, not open */
    if (state.turnIndex < 1) return false;
    /* Class-A (2026-06-15) — compare a TOTAL-scoped counter against the total
     * maxStretch. totalScopedCounter returns null for a FIXED-scoped counter
     * ("₹26L fixed"), so a base ask can never falsely trip this over-band-total
     * stall (the units-mismatch false-fire). Still reads the fresh this-turn
     * counter, not the sticky intake target. */
    const freshAsk = totalScopedCounter(state);
    if (freshAsk == null || freshAsk <= state.band.maxStretch) return false;
    if ((state.stallsFiredCount ?? 0) >= STALL_SESSION_CAP) return false;
    const personaCfg = getRecruiterSectorPersona(state.recruiterSectorPersona ?? "default");
    const personaIsHighStall =
      personaCfg.id === "psu" ||
      personaCfg.id === "consulting-big4" ||
      personaCfg.stallProbability >= STALL_PROBABILITY_GATE;
    if (!personaIsHighStall) return false;
    if (state.phase !== "counter-offer" && state.phase !== "offer-presented") return false;
    return true;
  })();
  const aboutToClose = state.phase === "closing-push";
  if (!aboutToStallOpen && !aboutToClose) return null;

  const persona: RecruiterSectorPersona = state.recruiterSectorPersona ?? "default";
  const variant = _sectorParaphraseVariant(persona);
  return {
    kind: "paraphrase-recap",
    facts,
    sectorVariant: variant,
    _move: {
      lever: "hold-firm",
      newTotalLpa: state.highestOfferMade || state.band.initialOffer,
      actionKind: "paraphrase-recap",
      rationale:
        `Paraphrase-recap: ${facts.length} disclosed facts; ` +
        `trigger=${aboutToStallOpen ? "pre-manager-stall" : "pre-close"}; ` +
        `variant=${variant}.`,
    },
  } as PlannedAction;
}

/** Proactive-sweetener feature (2026-05-30) — sector-keyed sweetener map.
 *
 *  Each sector picks the non-cash lever it genuinely has the most
 *  flexibility on in the real market:
 *   - it-services      → notice-buyout-help (notice-period buyout is
 *                        the most common cash-adjacent ask at TCS /
 *                        Infosys / Wipro)
 *   - gcc              → relocation (global comp templates routinely
 *                        carry relocation budget separate from band)
 *   - indian-unicorn   → equity-refresh (refresh grants after the
 *                        cliff are the dominant compounding lever)
 *   - early-startup    → equity-refresh (ESOP stretch is the only
 *                        real lever when cash is tight)
 *   - bfsi             → signing-bonus (joining-bonus headroom even
 *                        when grade-pay is rigid)
 *   - psu              → joining-flexibility (cadre pay is fixed but
 *                        joining date is genuinely flexible)
 *   - consulting-big4  → relocation (relocation package is a real
 *                        lever distinct from grade)
 *   - consulting-mbb   → signing-bonus (sign-on is the standard MBB
 *                        sweetener once base is anchored)
 *   - fmcg-management  → joining-flexibility (intake / joining-cycle
 *                        flex is the standard FMCG lever)
 *   - edtech           → equity-refresh (post-correction cash is
 *                        tight; equity is where the upside sits)
 *   - default          → signing-bonus (safe verbal sweetener that
 *                        works across sectors) */
export const SECTOR_SWEETENER_MAP: Record<
  RecruiterSectorPersona,
  | "signing-bonus"
  | "relocation"
  | "equity-refresh"
  | "joining-flexibility"
  | "notice-buyout-help"
> = {
  "it-services": "notice-buyout-help",
  "gcc": "relocation",
  "indian-unicorn": "equity-refresh",
  "early-startup": "equity-refresh",
  "bfsi": "signing-bonus",
  "psu": "joining-flexibility",
  "consulting-big4": "relocation",
  "consulting-mbb": "signing-bonus",
  "fmcg-management": "joining-flexibility",
  "edtech": "equity-refresh",
  "default": "signing-bonus",
};

/** Proactive-sweetener feature (2026-05-30) — planner gate.
 *
 *  Real recruiters offer non-cash sweeteners UNPROMPTED when they
 *  sense the candidate cooling and they're capped on cash. Pre-2026-
 *  05-30 the simulator never volunteered anything — recruiters were
 *  100% reactive, which was the #1 remaining realism gap.
 *
 *  Gates (all must pass):
 *   (1) Single-fire — proactiveSweetenerFired === true → null.
 *   (2) Phase — only counter-offer OR closing-push. Opening / range-
 *       disclosure / probe-expectations / manager-consult phases bail
 *       early (a sweetener volunteered before an offer is even on the
 *       table reads as desperate, not strategic).
 *   (3) Offer-on-table — highestOfferMade > 0. The sweetener supplements
 *       a cash offer; it never substitutes for one.
 *   (4) Cash-capped — highestOfferMade >= band.maxStretch * 0.95. The
 *       recruiter only reaches for non-cash levers when there's no
 *       material cash headroom left. The 95% threshold gives a small
 *       cash-residue buffer (real recruiters don't switch to non-cash
 *       at exactly maxStretch — they switch when they're "basically
 *       there").
 *   (5) Cooling signal — fire when ANY of:
 *         (a) last 2 affinity-ledger entries are net negative
 *         (b) candidate is still asking more than highestOfferMade
 *             (lastCandidateCounterLpa > highestOfferMade)
 *         (c) 2+ turns have elapsed since the last offer with no close
 *             action shipped
 *
 *  Verbal-only: no money math, no band mutation. The prose arm
 *  surfaces the sweetener as a question ("would that help close
 *  this?"); coaching downstream attributes it via
 *  state.proactiveSweetenerKind. */
export function maybePlanProactiveSweetener(
  state: NegotiationState,
): PlannedAction | null {
  /* (0) Byte-equivalence baseline — when sessionId is empty we short-
   * circuit so legacy snapshot tests with no session identity see the
   * unchanged baseline cascade. Live sessions always carry a sessionId.
   * The persona may still be "default" — that path is exercised by the
   * default-sector fallback test (signing-bonus). */
  const sessionId = state.sessionId ?? "";
  if (sessionId.length === 0) return null;
  const persona: RecruiterSectorPersona =
    state.recruiterSectorPersona ?? "default";
  /* (1) Single-fire. */
  if (state.proactiveSweetenerFired === true) return null;
  /* (1b) Scope-reconcile precedence (PRI-60 × PRI-65 regression guard,
   * 2026-07-07). When an undeliverable fixed close-ask is pending over the
   * standing offer, the counter/lever engine owns this turn: it must NAME the
   * cash-band overage out loud ("that's above the cash band I can structure")
   * before pivoting to equity-over-cash — the whole point of PRI-60. Activating
   * the (5c) stale-offer cooling signal in PRI-65 let this sweetener win the
   * SAME turn (offer has been standing ≥2 turns by the close), silently
   * dangling an equity-refresh lever WITHOUT ever reconciling the scope — so the
   * candidate is never told their fixed ask can't be met in cash. Defer to the
   * scope-reconcile counter here; the sweetener still fires on ordinary
   * cash-capped cooling turns where no undeliverable fixed ask is pending. */
  if (undeliverableFixedConditionAsk(state) != null) return null;
  /* (2) Phase gate — only counter-offer OR closing-push. */
  if (state.phase !== "counter-offer" && state.phase !== "closing-push") {
    return null;
  }
  /* (3) Recruiter has an offer on the table. */
  const highest = state.highestOfferMade ?? 0;
  if (highest <= 0) return null;
  /* (4) Cash-capped. band.maxStretch is the recruiter's hard money
   * ceiling; 95% of that is "basically there on cash". */
  const maxStretch = state.band?.maxStretch ?? 0;
  if (maxStretch <= 0) return null;
  if (highest < maxStretch * 0.95) return null;
  /* (5) Cooling signal — three independent triggers. The first match
   * wins so the rationale can attribute correctly. */
  let signal: string | null = null;
  /* (5a) Last 2 affinity-ledger entries net negative. */
  const ledger = state.affinityLedger ?? [];
  if (ledger.length >= 2) {
    const tail = ledger.slice(-2);
    const sum = tail.reduce((acc, e) => acc + (e.delta ?? 0), 0);
    if (sum < 0) signal = "affinity-drop";
  }
  /* (5b) Counter still pending above the recruiter's cap. Class-A
   * (2026-06-15) — only a TOTAL-scoped counter is comparable to `highest` (a
   * total offer); a fixed-component ask is not "pending above the cap". */
  const pendingTotalCounter = totalScopedCounter(state);
  if (
    signal == null &&
    pendingTotalCounter != null &&
    pendingTotalCounter > highest
  ) {
    signal = "counter-still-pending";
  }
  /* (5c) 2+ candidate turns have elapsed since the offer landed with no
   * close action shipped.
   *
   * PRI-65 (2026-07-06, launch-readiness audit) — this branch previously read
   * `state.lastOfferTurn` and `state.highestOfferMadeAtTurn` through
   * `as unknown as` casts. NEITHER property exists anywhere on NegotiationState
   * (nor is written by the kernel), so both casts always resolved to undefined,
   * `lastOfferTurn` was always null, and the entire (5c) stale-offer trigger
   * was dead — the proactive sweetener could only ever fire via (5a)/(5b). The
   * real, kernel-maintained field is `firstOfferAtTurn` (the turn the offer
   * first landed, i.e. highestOfferMade went 0 → >0), whose own contract is to
   * answer "how many candidate turns have elapsed since the offer landed?" —
   * exactly this check. Using it removes both illegal casts and activates the
   * intended cooling signal; it stays gated behind the cash-cap (4) and phase
   * (2) guards above, and (5a)/(5b) still win first. */
  if (signal == null) {
    const firstOfferAtTurn = state.firstOfferAtTurn ?? null;
    if (
      firstOfferAtTurn != null &&
      state.turnIndex - firstOfferAtTurn >= 2 &&
      !state.leversUsed.includes("close-acceptance")
    ) {
      signal = "stale-offer";
    }
  }
  if (signal == null) return null;
  /* Sector-keyed sweetener pick. "default" persona short-circuits the
   * overlay layer downstream, but the planner still picks a sensible
   * sweetener (signing-bonus) so the gate is testable. */
  const sweetenerKind = SECTOR_SWEETENER_MAP[persona];
  return {
    kind: "proactive-sweetener",
    sweetenerKind,
    _move: {
      /* No "soften" lever exists in the NegotiationLever union; the
       * closest non-money lever is hold-firm, which the existing
       * paraphrase-recap and manager-consult-stall arms already use
       * to carry non-numeric prose without touching highestOfferMade. */
      lever: "hold-firm",
      newTotalLpa: null,
      actionKind: "proactive-sweetener",
      sweetenerKind,
      rationale:
        `Proactive sweetener offered — recruiter capped at ` +
        `₹${highest}L vs max-stretch ₹${maxStretch}L. ` +
        `Candidate cooling signal: ${signal}. Single-fire; ` +
        `sweetener=${sweetenerKind} (persona=${persona}).`,
    },
  } as PlannedAction;
}

/** Realism-Audit Fix 3 (2026-05-22) — manager-consult stall gate.
 *
 *  Returns the stall PlannedAction (open OR return) when all gate
 *  conditions are met, else null and the planner cascade proceeds
 *  normally. Pure / deterministic; reads `stallTurnsRemaining`,
 *  `stallsFiredCount`, `lastStallContext`, turn budget, persona's
 *  `stallProbability`, and the candidate's ask vs `band.maxStretch`. */
export const STALL_SESSION_CAP = 3;
export const STALL_PROBABILITY_GATE = 0.40;

export function maybePlanManagerConsultStall(
  state: NegotiationState,
): PlannedAction | null {
  /* (A) Return-turn — a stall is already in flight. Ship the deterministic
   * outcome and let applyAiMove decrement stallTurnsRemaining + clear
   * lastStallContext. The simulator commits to either a small concession
   * OR a hold; choice keys off persona pushback + headroom against
   * highestOfferMade. */
  const inFlight = (state.stallTurnsRemaining ?? 0) > 0;
  if (inFlight) {
    const stalledAskLpa = state.lastStallContext?.stalledAskLpa ?? null;
    const personaCfg = getRecruiterSectorPersona(state.recruiterSectorPersona ?? "default");
    /* Choose return mode. PSU / Big-4 hold harder; unicorn / startup
     * tend to ship a small concession on the return turn. The hold
     * branch is also chosen when there's no headroom left between
     * highestOfferMade and band.maxStretch. */
    const headroom = state.band.maxStretch - state.highestOfferMade;
    const personaHolds =
      personaCfg.pushbackStyle === "cadre-pay-rigid" ||
      personaCfg.pushbackStyle === "internal-equity-cap";
    const returnMode: "return-move" | "return-hold" =
      personaHolds || headroom < 0.5 ? "return-hold" : "return-move";
    /* Concession size — half a LPA on consultative personas, ₹2L on
     * unicorn/startup who actually have JB flex; capped at headroom. */
    let concession: number | null = null;
    if (returnMode === "return-move") {
      const target = personaCfg.id === "indian-unicorn" || personaCfg.id === "early-startup" ? 2.0 : 1.0;
      concession = Math.max(0.5, Math.min(target, headroom));
      concession = Math.round(concession * 10) / 10;
    }
    return {
      kind: "manager-consult-stall",
      mode: returnMode,
      stalledAskLpa,
      returnConcessionLpa: concession,
      _move: {
        lever: "hold-firm",
        newTotalLpa: state.highestOfferMade,
        actionKind: "manager-consult-stall",
        rationale:
          `Manager-consult stall — return turn (mode=${returnMode}, concession=` +
          `₹${concession ?? 0}L). Stalled ask was ₹${stalledAskLpa ?? "?"}L; ` +
          `stallsFiredCount=${state.stallsFiredCount ?? 0}.`,
      },
    } as PlannedAction;
  }

  /* (B) Open-turn gates. */
  /* Gate 1 — not the first AI turn. Recruiter must have heard the ask. */
  if (state.turnIndex < 1) return null;
  /* Gate 2 — candidate just dropped a hard TOTAL ask above band.maxStretch.
   * Uses the fresh this-turn counter (not sticky candidateTarget) so a stale
   * intake target doesn't keep re-triggering stalls across the session.
   * Class-A (2026-06-15): routed through totalScopedCounter so a FIXED-scoped
   * counter ("₹26L fixed") returns null and cannot falsely trip this
   * over-band-total stall — that was the units-mismatch false-fire. */
  const freshAsk = totalScopedCounter(state);
  if (freshAsk == null || freshAsk <= state.band.maxStretch) return null;
  /* Gate 3 — session-wide cap. */
  if ((state.stallsFiredCount ?? 0) >= STALL_SESSION_CAP) return null;
  /* Gate 4 — persona stall probability OR PSU/Big-4 short-circuit
   * (those are dominant-stall sectors per audit). */
  const personaCfg = getRecruiterSectorPersona(state.recruiterSectorPersona ?? "default");
  const personaIsHighStall =
    personaCfg.id === "psu" ||
    personaCfg.id === "consulting-big4" ||
    personaCfg.stallProbability >= STALL_PROBABILITY_GATE;
  if (!personaIsHighStall) return null;
  /* Gate 5 — must not be in a terminal phase. Stalls only make sense
   * once an offer is on the table (offer-presented) or in counter-offer. */
  if (state.phase !== "counter-offer" && state.phase !== "offer-presented") return null;

  return {
    kind: "manager-consult-stall",
    mode: "open",
    stalledAskLpa: freshAsk,
    returnConcessionLpa: null,
    _move: {
      lever: "hold-firm",
      newTotalLpa: state.highestOfferMade,
      actionKind: "manager-consult-stall",
      rationale:
        `Manager-consult stall — open. Candidate asked ₹${freshAsk}L vs band ` +
        `maxStretch ₹${state.band.maxStretch}L (persona=${personaCfg.id}, ` +
        `stallsFiredCount=${state.stallsFiredCount ?? 0}).`,
    },
  } as PlannedAction;
}
