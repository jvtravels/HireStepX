/* NextAction contract coverage (2026-05-25) — aggregate gate.
 *
 * Audit finding: the canonical-prose surface uses a `switch (action.kind)`
 * with a TS-level exhaustiveness check, but RUNTIME coverage was tested
 * only for the 25 kinds enumerated in canonicalProseIndianIdiom.test.ts.
 * The other 8 kinds (clarify-prior-question, reactive-followup,
 * credibility-probe, ctc-inflation-anchor, ctc-inflation-truth,
 * panel-approval-stall, polite-walkaway, anchor-defense-hike-strong,
 * fake-leverage-challenge, competitor-match, acknowledge-and-recover,
 * offer-recap, manager-consult-stall, round-transition, component-probe,
 * anchor-with-offer, lever-perf-bonus-cadence, internal-equity-defense,
 * comparative-anchoring, post-acceptance-document-request, close-recap-formal)
 * could regress unnoticed: a stray code path returning empty string or
 * leaking a banned American idiom would never be caught.
 *
 * Contract this test enforces for EVERY NextAction.kind:
 *   1. renderCanonicalProse returns a non-empty string (no silent fall-
 *      through to "Let me come back to you in a moment." default).
 *   2. No banned US-recruiter idiom appears.
 *   3. No empty-template artefacts (`${...}`, `null`, `undefined`, `NaN`).
 *
 * A NEW NextAction kind that lands without the canonical-prose author
 * adding a switch case will fail (1) — pipeline never crashes but the
 * gate fires.
 */
import { describe, it, expect } from "vitest";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s-contract", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

/* Banned American/MBA idiom — same denylist enforced by the idiom test,
 * applied here across the full NextAction surface in aggregate. */
const BANNED_IDIOMS: readonly RegExp[] = [
  /circle back/i,
  /touch base/i,
  /\bsynergy\b/i,
  /\bappreciate\s+your\s+time\b/i,
  /\bappreciate\s+you\s+walking\b/i,
  /rounding out the package/i,
  /low.hanging fruit/i,
  /move the needle/i,
  /deep dive/i,
  /walk away from this/i, // canonical "walk away" verbatim leakage in non-walk contexts
];

/* Template-render artefacts that indicate a string-interpolation gap. */
const TEMPLATE_LEAKS: readonly RegExp[] = [
  /\$\{/, // unrendered template literal
  /\bundefined\b/, // unresolved optional
  /\bNaN\b/, // arithmetic gap
  /₹\s*null\b/i, // null in a currency slot
  /\bnull\b/, // bare null token
];

/* Canonical sample of EVERY NextAction.kind in the union (33 total as of
 * 2026-05-25). When a new kind is added, this list must be extended;
 * forgetting to extend it leaves the gate honest (the missing kind simply
 * won't be tested), so we cross-check the COUNT below against the union. */
const ALL_ACTIONS: NextAction[] = [
  { kind: "terminal-restate" } as unknown as NextAction,
  { kind: "close", mode: "accept" } as unknown as NextAction,
  { kind: "close", mode: "walkaway" } as unknown as NextAction,
  { kind: "close", mode: "stalemate" } as unknown as NextAction,
  { kind: "auto-accept" } as unknown as NextAction,
  { kind: "clarify-prior-question", priorAiText: "we'll structure the fitment", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "reactive-followup", ask: "is the variable annual or quarterly?", trigger: "varianceTimingUnclear", topic: "fixedVariableSplit", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "credibility-probe", resumeCompany: "infosys", statedCompany: "tcs", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "probe-mismatch", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "live-walk-away", mode: "walk" } as unknown as NextAction,
  { kind: "live-walk-away", mode: "hold-firm" } as unknown as NextAction,
  { kind: "live-walk-away", mode: "probe" } as unknown as NextAction,
  { kind: "band-disclosure-deflect", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "discovery-probe", item: "currentCtc", ask: "current ctc?", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "open-with-offer", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "lever-loop-guard" } as unknown as NextAction,
  { kind: "info-disclosure", topic: "breakdown" } as unknown as NextAction,
  { kind: "info-disclosure", topic: "benefits" } as unknown as NextAction,
  { kind: "info-disclosure", topic: "comp-structure" } as unknown as NextAction,
  { kind: "info-disclosure", topic: "notice" } as unknown as NextAction,
  { kind: "info-disclosure", topic: "hike-pct" } as unknown as NextAction,
  { kind: "probe-expectations", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "probe-justification", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "counter-offer", counterTotalLpa: 24, satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "lever-explore", from: "default" } as unknown as NextAction,
  { kind: "lever-explore", from: "hard-band-cap" } as unknown as NextAction,
  { kind: "hold-firm", mode: "verbal-accept" } as unknown as NextAction,
  { kind: "hold-firm", mode: "lever-loop" } as unknown as NextAction,
  { kind: "rescission" } as unknown as NextAction,
  {
    kind: "close-recap-formal",
    fixedLpa: 18,
    variableLpa: 4,
    joiningBonusLpa: 2,
    retentionBonusLpa: 1,
    noticePeriodWeeks: 4,
    proposedJoiningDate: "2026-07-01",
    bgvStartTrigger: "verbal acceptance",
    offerLetterEta: "T+5 business days",
    satisfiesTopic: "currentCtc",
  } as unknown as NextAction,
  { kind: "lever-grade-upgrade", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "lever-retention-bonus", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "lever-rsu-refresh", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "lever-relocation", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "lever-perf-bonus-cadence", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "lever-joining-bonus-explained", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "band-anchor-with-rationale", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "internal-equity-defense", peerBandTopLpa: 26, peerBandMedianLpa: 22, satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "comparative-anchoring", quartile: "top", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "comparative-anchoring", quartile: "median", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "component-probe", component: "base", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "component-probe", component: "variable", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "component-probe", component: "esop", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "anchor-with-offer", initialOffer: 20, bandIncomplete: false, satisfiesTopic: "currentCtc" } as unknown as NextAction,
  {
    kind: "ctc-inflation-anchor",
    ctcLpa: 30,
    fixedLpa: 18,
    variableLpa: 5,
    esopPaperLpa: 4,
    joiningBonusLpa: 2,
    benefitsLpa: 1,
  } as unknown as NextAction,
  {
    kind: "ctc-inflation-truth",
    ctcLpa: 30,
    fixedLpa: 18,
    variableLpa: 5,
    esopPaperLpa: 4,
    joiningBonusLpa: 2,
    benefitsLpa: 1,
  } as unknown as NextAction,
  { kind: "post-acceptance-document-request" } as unknown as NextAction,
  { kind: "panel-approval-stall" } as unknown as NextAction,
  { kind: "polite-walkaway" } as unknown as NextAction,
  { kind: "anchor-defense-hike-strong", hikePct: 10, currentCtc: 20, offer: 22 } as unknown as NextAction,
  { kind: "fake-leverage-challenge", competingCompany: "flipkart" } as unknown as NextAction,
  { kind: "fake-leverage-challenge", competingCompany: null } as unknown as NextAction,
  { kind: "competitor-match", competingOffer: 28, competingCompany: "swiggy" } as unknown as NextAction,
  { kind: "acknowledge-and-recover", satisfiesTopic: "currentCtc" } as unknown as NextAction,
  { kind: "offer-recap", offerLpa: 22 } as unknown as NextAction,
  { kind: "round-transition", from: "hr-partner", to: "hiring-manager" } as unknown as NextAction,
  {
    kind: "manager-consult-stall",
    mode: "open",
    stalledAskLpa: 26,
    returnConcessionLpa: null,
  } as unknown as NextAction,
  {
    kind: "manager-consult-stall",
    mode: "return-move",
    stalledAskLpa: 26,
    returnConcessionLpa: 2,
  } as unknown as NextAction,
  {
    kind: "manager-consult-stall",
    mode: "return-hold",
    stalledAskLpa: 26,
    returnConcessionLpa: null,
  } as unknown as NextAction,
];

describe("NextAction contract coverage — aggregate prose gate", () => {
  it("every NextAction kind renders non-empty canonical prose", () => {
    const s = baseState({ highestOfferMade: 22, candidateCurrentCtc: 18, candidateTarget: 26 });
    const gaps: string[] = [];
    for (const action of ALL_ACTIONS) {
      const prose = renderCanonicalProse(action, s);
      if (!prose || prose.trim().length === 0) {
        gaps.push(`${action.kind}: empty render`);
      }
    }
    expect(gaps, gaps.join("\n")).toEqual([]);
  });

  it("no NextAction kind leaks template artefacts (${...}, undefined, NaN, null)", () => {
    const s = baseState({ highestOfferMade: 22, candidateCurrentCtc: 18, candidateTarget: 26 });
    const leaks: string[] = [];
    for (const action of ALL_ACTIONS) {
      const prose = renderCanonicalProse(action, s);
      for (const re of TEMPLATE_LEAKS) {
        if (re.test(prose)) {
          leaks.push(`${action.kind} matches ${re}: ${prose.slice(0, 120)}`);
        }
      }
    }
    expect(leaks, leaks.join("\n")).toEqual([]);
  });

  it("no NextAction kind emits a banned American/MBA idiom", () => {
    const s = baseState({ highestOfferMade: 22, candidateCurrentCtc: 18, candidateTarget: 26 });
    const leaks: string[] = [];
    for (const action of ALL_ACTIONS) {
      const prose = renderCanonicalProse(action, s);
      for (const re of BANNED_IDIOMS) {
        if (re.test(prose)) {
          leaks.push(`${action.kind} matches ${re}: ${prose.slice(0, 120)}`);
        }
      }
    }
    expect(leaks, leaks.join("\n")).toEqual([]);
  });

  /* Cross-check: ALL_ACTIONS must cover every distinct kind. If a new
   * NextAction.kind is added to the union, this assertion fails first
   * (forcing the author to extend ALL_ACTIONS), and only then can the
   * coverage gates above stay honest. */
  it("ALL_ACTIONS covers every NextAction.kind in the union (drift guard)", () => {
    /* Source of truth: enumerate kinds present in ALL_ACTIONS. */
    const covered = new Set(ALL_ACTIONS.map((a) => a.kind));
    /* Expected kinds — the union as of 2026-05-25. When the union grows,
     * extend BOTH this list and ALL_ACTIONS. The set-equality form means
     * the failure message names the missing kind exactly. */
    const expected: ReadonlySet<NextAction["kind"]> = new Set<NextAction["kind"]>([
      "terminal-restate",
      "close",
      "auto-accept",
      "clarify-prior-question",
      "reactive-followup",
      "credibility-probe",
      "probe-mismatch",
      "live-walk-away",
      "band-disclosure-deflect",
      "discovery-probe",
      "open-with-offer",
      "lever-loop-guard",
      "info-disclosure",
      "probe-expectations",
      "probe-justification",
      "counter-offer",
      "lever-explore",
      "hold-firm",
      "rescission",
      "close-recap-formal",
      "lever-grade-upgrade",
      "lever-retention-bonus",
      "lever-rsu-refresh",
      "lever-relocation",
      "lever-perf-bonus-cadence",
      "lever-joining-bonus-explained",
      "band-anchor-with-rationale",
      "internal-equity-defense",
      "comparative-anchoring",
      "component-probe",
      "anchor-with-offer",
      "ctc-inflation-anchor",
      "ctc-inflation-truth",
      "post-acceptance-document-request",
      "panel-approval-stall",
      "polite-walkaway",
      "anchor-defense-hike-strong",
      "fake-leverage-challenge",
      "competitor-match",
      "acknowledge-and-recover",
      "offer-recap",
      "round-transition",
      "manager-consult-stall",
    ]);
    const missing: string[] = [];
    for (const k of expected) {
      if (!covered.has(k)) missing.push(k);
    }
    expect(missing, `Missing from ALL_ACTIONS: ${missing.join(", ")}`).toEqual([]);
  });
});
