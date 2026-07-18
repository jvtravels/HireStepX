/* Pure derivations for NegotiationFullReport.
 *
 * Extracted from the JSX file (2026-05-26) so the data-honesty
 * contract enforced by PDF#45 has direct unit-test coverage. These
 * are the keystone of the audit fix — `deriveConcessionsFromOffers`
 * and `deriveAnchorBracket` no longer fabricate verdicts from
 * offer-delta math. Tests in
 * `src/__tests__/negotiationReportDerivations.test.ts` lock the
 * honest-empty-state behavior so a future "helpful" refactor can't
 * silently re-introduce the hallucination.
 *
 * `computeNpvRows` is exported here for the same reason: its 30% /
 * 6% / 4-year / 0.79-discount-factor assumptions are a MODEL, and
 * the tests pin the math against the named constants in
 * `NPV_MODEL` rather than re-asserting magic literals. */

import type { InterviewResultData } from "./types";

export type NegotiationOutcome = NonNullable<
  InterviewResultData["negotiationOutcome"]
>;

/* NPV math is a MODEL, not a quote. These constants make the
   assumptions visible at one source of truth — change the slab
   here and the report + tests move in lockstep.
   The 0.79 discount factor is the present-value of a ₹1 flat
   annuity over `horizonYears` at `annualInflation`:
     (1 - 1/(1+i)^n) / (i * n)  ≈ 0.7921 at i=0.06, n=4 */
export const NPV_MODEL = {
  incomeTaxRate: 0.30,            // 30% Indian income-tax slab
  annualInflation: 0.06,          // 6% annual inflation
  horizonYears: 4,                // 4-year offer horizon
  inflationDiscountFactor: 0.79,  // PV factor of the above
} as const;

/* 5 stages of a strong negotiation. The previous "you reacted to
   the offer" trivial-presence stage was dropped because reaching
   it was free for any user (visual participation trophy). Every
   reached-stage now reflects an action the candidate took. */
export const TOTAL_PHASES = 5;

/* derivePhases — REPORT-6 audit (2026-06-27).
 *
 * Prior implementation fabricated the three middle stages from the
 * RECRUITER's offer count: `reachedPushback = offers.length >= 2`,
 * `reachedLevers = offers.length >= 3`, `reachedJustification =
 * reachedCounter`. A passive candidate who said "okay" to three rising
 * offers got credited for justifying, handling pushback, and exploring
 * levers — none of which they did. That contradicts the file's own
 * PDF#45 anti-fabrication contract ("Every reached-stage now reflects an
 * action the candidate took").
 *
 * New contract: stages 2/3/4 light up ONLY from grounded candidate-action
 * signals lifted from the kernel final state (adoptKernelOutcome →
 * outcome.tacticsUsed / leverDiversity / infoAsked) or the transcript
 * pushback classifier (outcome.pushbacks). Legacy heuristic rows that
 * carry none of these fall back to an honest "not reached" rather than an
 * inflated count. Stages 1 (named a counter) and 5 (closed) stay keyed on
 * the directly-tracked candidateAsk / outcome — those were never fabricated. */
/* R-5 (2026-07-10, live staging — Senior Product Designer @ Lollypop Design
 * Studio) — DELIBERATE non-fabrication. These five stages are an independent
 * skills CHECKLIST, not a strict monotonic ladder: a candidate can reach the
 * close (5) after accepting without ever handling a pushback (3), because the
 * recruiter simply never pushed. Forcing monotonicity — marking stage 3
 * "reached" merely because stage 5 was — would fabricate a pushback that did
 * not occur, exactly the failure the PDF#45 contract below forbids. The
 * honest per-stage truth stands; `phaseCount` in the hero counts skills shown,
 * not rungs climbed. No code change is the correct resolution here. */
export function derivePhases(outcome: NegotiationOutcome) {
  const tactics = outcome.tacticsUsed ?? [];
  const info = outcome.infoAsked ?? [];
  const heldPushback =
    outcome.pushbacks?.some((p) => p.outcome === "held" || p.outcome === "deflected") ?? false;
  // A "counter" semantically requires a recruiter offer to counter. When no
  // offer ever landed (offers === []), the candidate's stated number is an
  // OPENING ANCHOR, not a counter — labelling it "counter" is the S16-B7 /
  // S1-B1 mislabel. Same single source (outcome.offers) as the hero.
  const offers = outcome.offers ?? [];
  const hasPriorOffer = offers.length > 0;

  const reachedCounter = outcome.candidateAsk !== null;
  // Justified — defended the number with a range, a tactic, or structural
  // discovery; a bare blurted number does NOT reach it.
  const reachedJustification =
    reachedCounter &&
    (outcome.anchorBracket?.type === "range_with_justification" ||
      tactics.length > 0 ||
      info.length > 0);
  // Handled pushback — a held/deflected classifier event or a Voss tactic the
  // candidate played. S16-B4: gated on reachedCounter — you cannot "handle
  // pushback on your number" without having named one, so a lone calibrated
  // question on a pure-discovery session must NOT credit this stage.
  const reachedPushback = reachedCounter && (tactics.length > 0 || heldPushback);
  // Explored levers — S16-B5: `leverDiversity` counts the RECRUITER's move
  // levers (always ≥1 once any turn occurs), so it must NOT credit the
  // candidate. The candidate "explores levers" only by asking about a non-cash
  // component (infoAsked) — a candidate action.
  const reachedLevers = info.length > 0;
  const reachedClose =
    outcome.outcome === "accepted" || outcome.outcome === "walked_away";
  return [
    {
      num: 1,
      // S16-B7 / S1-B1: the STAGE NAME "counter" presumes a recruiter offer to
      // counter — with offers === [] the candidate's number is an OPENING
      // anchor. The NOTE stays the neutral "Asked for ₹X LPA" (true either way).
      name: hasPriorOffer ? "You named a counter number" : "You named your opening number",
      reached: reachedCounter,
      note: outcome.candidateAsk
        ? `Asked for ₹${outcome.candidateAsk} LPA`
        : hasPriorOffer
          ? "No counter named yet"
          : "No number named yet",
    },
    {
      num: 2,
      name: "You justified your number",
      reached: reachedJustification,
      note: reachedJustification
        ? outcome.anchorBracket?.type === "range_with_justification"
          ? "Framed a defended range"
          : tactics.length > 0
            ? `Backed it with ${tactics.length} tactic${tactics.length === 1 ? "" : "s"}`
            : "Asked about comp structure to support it"
        : undefined,
    },
    {
      num: 3,
      name: "You handled their pushback",
      reached: reachedPushback,
      note: reachedPushback
        ? heldPushback
          ? "Held or deflected when they pushed"
          : "Stayed in the back-and-forth with a counter-move"
        : undefined,
    },
    {
      num: 4,
      name: "You explored package levers",
      reached: reachedLevers,
      note: reachedLevers ? "Asked about non-cash components" : undefined,
    },
    {
      num: 5,
      /* PRI-63 (2026-07-06, live staging) — the close STAGE is reached on
       * accept OR walk-away, so a fixed "You closed the deal" name rendered
       * a green ✓ "You closed the deal / Walked away" on a walk-away
       * (contradicting the outcome record). The name tracks the milestone;
       * the note carries the specific. Only an accept "closed the deal". */
      name: outcome.outcome === "accepted" ? "You closed the deal" : "You reached the close",
      reached: reachedClose,
      note:
        outcome.outcome === "accepted"
          ? "Accepted"
          : outcome.outcome === "walked_away"
            ? "Walked away"
            : undefined,
    },
  ];
}

/* PDF#45 audit (2026-05-26) — honest-empty-state refactor.
 *
 * Prior implementation fabricated coaching verdicts ("your push
 * worked", "you held — kept the conversation going") from raw
 * offer-delta math whenever the transcript classifier hadn't
 * produced real `outcome.pushbacks`. Offer deltas alone DO NOT
 * tell us whether the candidate held or folded — the recruiter
 * could have raised in response to silence, a half-hearted
 * "okay…", or anything else. Inventing the verdict from delta
 * sign makes the report a liar the moment the user spots the gap.
 *
 * New contract: this fallback returns [] always. The panel is
 * responsible for rendering an honest empty-state when the
 * classifier has not produced grounded pushback events. The
 * factual round-by-round offer trajectory is already shown in
 * the outcome record block above the panel — no information is
 * lost. */
export function deriveConcessionsFromOffers(
  _outcome: NegotiationOutcome,
): { pushback: string; outcome: "held" | "deflected" | "conceded"; detail: string }[] {
  return [];
}

/* PDF#45 audit (2026-05-26) — kill the fabricated `type: "single"`
 * verdict.
 *
 * Prior: when `outcome.anchorBracket` was null AND `candidateAsk`
 * was set, returned `type: "single"` with the verdict "Strong
 * negotiators name a defended range instead…". That verdict is a
 * fabrication — we don't actually know if the candidate defended
 * the number with market data or just blurted it. The classifier
 * is the only source of truth for HOW the number was named.
 * Without it, render nothing.
 *
 * The `type: "none"` branch (candidateAsk === null) is preserved
 * because it IS a factual observation — `candidateAsk` is tracked
 * directly from session state, not inferred. */
export function deriveAnchorBracket(
  outcome: NegotiationOutcome,
): NonNullable<NegotiationOutcome["anchorBracket"]> | null {
  if (outcome.anchorBracket) return outcome.anchorBracket;
  if (outcome.candidateAsk === null) {
    return {
      type: "none",
      quote: "",
      verdict:
        "You didn't name a counter-number. Without a number, the recruiter's first offer becomes the ceiling. Even a vague range ('I was thinking mid-40s') would have shifted the negotiation surface.",
    };
  }
  return null;
}

/* L-6 (2026-07-10, live staging — walk-away report 599e1c9f): the kernel-quality
   "Anchored at" tile read "Never anchored" beside a stage tracker showing "You
   named a counter number — Asked for ₹43 REACHED ✓" and "+7% pushed back". Root:
   `anchorTurn` is derived from the per-turn candidateTarget snapshot, which only
   records a TOTAL ask — a fixed-only anchor ("46 fixed") sets candidateTargetFixed
   and leaves the snapshot null, so no turn is credited even though the candidate
   clearly named a number. `candidateAskLpa` folds the fixed-only ask (single
   source, same as the kernel's effectiveTargetCtcLpaLocal), so it is the
   authoritative did-they-anchor signal; anchorTurn only carries the WHEN. When we
   have the number but not the turn, say so honestly, not falsely "Never anchored". */
export function anchorAtLabel(
  anchorTurn: number | null,
  candidateAskLpa: number | null | undefined,
): string {
  if (anchorTurn == null) {
    return candidateAskLpa != null ? "Anchored (turn not tracked)" : "Never anchored";
  }
  if (anchorTurn <= 1) return `Turn ${anchorTurn} (early)`;
  if (anchorTurn <= 3) return `Turn ${anchorTurn}`;
  return `Turn ${anchorTurn} (late)`;
}

/* REPORT-3e (2026-07-13, live staging — session 686b5699, Senior Product
   Designer @ Flipkart): the hero's one-line headline verdict. Every OTHER
   negotiation hero surface is grounded in the kernel — strengths are filtered
   by candidateAsk (filterNegotiationStrengths), delivery metrics by the kernel
   ask (buildNegotiationMetrics), per-question rebuilt from the transcript — but
   the headline alone passed the raw LLM `report.verdict` straight through. On a
   no-counter / no-deal session that string read "You negotiated well but didn't
   quantify results": "negotiated well" is false beside the report's own "0 of 5
   skills", 30-second read "never named a number", and N1 "No counter named",
   while "quantify results" is leaked STAR-behavioural phrasing that has no place
   in a negotiation report. Derive the headline from the same single source (the
   kernel outcome) so it can never diverge from the 30-second read it sits above.
   Terse by design — the rich narrative lives in TLDRHero; this is the pull-quote. */
export function negotiationHeadlineVerdict(outcome: NegotiationOutcome): string {
  const offers = outcome.offers ?? [];
  const opening = offers[0]?.total ?? null;
  const closing = outcome.finalTotal ?? (offers[offers.length - 1]?.total ?? null);
  const delta = opening !== null && closing !== null ? closing - opening : null;
  const counterNamed = outcome.candidateAsk !== null;

  if (outcome.outcome === "accepted") {
    if (delta !== null && delta > 0) return "You closed the deal and moved the offer up.";
    if (counterNamed) return "You closed the deal, but took their opening without moving it.";
    return "You accepted the first offer without countering.";
  }
  if (outcome.outcome === "walked_away") {
    return counterNamed
      ? "You walked away rather than settle below your counter."
      : "You walked away without naming a counter.";
  }
  // no_agreement — nothing closed. S17-B2: "the recruiter's number stood" is
  // false when no offer was ever on the table (offers === []); say so honestly.
  if (counterNamed) return "You countered, but the deal never closed.";
  return offers.length > 0
    ? "No counter named — the recruiter's number stood."
    : "The conversation ended before any number was on the table.";
}

export function computeNpvRows(outcome: NegotiationOutcome) {
  const offers = outcome.offers ?? [];
  if (offers.length === 0) return [];
  const opening = offers[0].total;
  const closing = outcome.finalTotal ?? offers[offers.length - 1].total;
  const delta = closing - opening;
  if (delta === 0) return [];
  const sign = delta >= 0 ? "+" : "−";
  const abs = Math.abs(delta);
  const tone: "good" | "bad" = delta >= 0 ? "good" : "bad";
  const fourYr = abs * NPV_MODEL.horizonYears;
  const afterTax = Math.round(fourYr * (1 - NPV_MODEL.incomeTaxRate) * 10) / 10;
  const npv = Math.round(afterTax * NPV_MODEL.inflationDiscountFactor * 10) / 10;
  const taxPct = Math.round(NPV_MODEL.incomeTaxRate * 100);
  const inflationPct = Math.round(NPV_MODEL.annualInflation * 100);
  return [
    {
      label: `${delta >= 0 ? "Extra" : "Missed"} base salary over ${NPV_MODEL.horizonYears} years`,
      value: `${sign}₹${fourYr}L`,
      tone,
    },
    {
      label: `After ${taxPct}% income tax`,
      value: `${sign}₹${afterTax}L take-home`,
      tone,
    },
    {
      label: `After ${inflationPct}% inflation (today's rupees)`,
      value: `${sign}₹${npv}L`,
      tone,
    },
    {
      label:
        delta >= 0
          ? "Total: extra rupees you negotiated"
          : "Total: what accepting cost you",
      value: `${sign}₹${npv}L`,
      tone,
    },
  ];
}
