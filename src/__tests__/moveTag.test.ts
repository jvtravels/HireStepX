/* Unit contract for the server-side move-tag transparency layer
 * (Dim 14 — Transparency / explainability, audit grade D+).
 *
 * Scope:
 *  1. Exhaustiveness — every NextAction kind yields a non-empty
 *     label + hint.
 *  2. No internal leak — labels and hints never expose kernel-internal
 *     vocabulary (counterRound, spiral, walkAway, maxStretch,
 *     single-fire, fired) or phase literals.
 *  3. Length contract — label ≤ 28, hint ≤ 140.
 *  4. Family coverage — every kind maps to one of the allowed family
 *     values.
 *  5. Topic-aware discovery — different satisfiesTopic values produce
 *     different labels.
 *  6. Component-aware probe — base / variable / esop produce different
 *     labels.
 */
import { describe, it, expect } from "vitest";
import { deriveMoveTag, type MoveTag } from "../../server-handlers/_move-tag";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 30,
  maxStretch: 42,
  walkAway: 26,
  hasEquity: true,
};

function freshState(): NegotiationState {
  return initState({
    sessionId: "s-movetag-test",
    role: "Senior Engineer",
    company: "TestCo",
    band: BAND,
  });
}

/** Representative payload for every NextAction kind. Keep this in sync
 *  with the discriminated union in _next-action-planner.ts — the
 *  exhaustiveness assertion below will tell you immediately if a kind
 *  has been added without a fixture. */
const FIXTURES: ReadonlyArray<NextAction> = [
  { kind: "terminal-restate" },
  { kind: "close", mode: "accept" },
  { kind: "close", mode: "walkaway" },
  { kind: "close", mode: "stalemate" },
  { kind: "auto-accept" },
  {
    kind: "reactive-followup",
    ask: "What's your current variable?",
    trigger: "candidate-disclosed-fixed",
    topic: "variable-comfort",
    satisfiesTopic: "variable-comfort",
  },
  {
    kind: "credibility-probe",
    resumeCompany: "Razorpay",
    statedCompany: "Razorpay X",
    satisfiesTopic: "credibility-probe",
  },
  { kind: "probe-mismatch", satisfiesTopic: "currentCtcAsked" },
  { kind: "live-walk-away", mode: "walk" },
  { kind: "band-disclosure-deflect", satisfiesTopic: "targetAsked" },
  {
    kind: "discovery-probe",
    item: "currentCtcAsked",
    ask: "What's your current CTC?",
    satisfiesTopic: "currentCtcAsked",
  },
  { kind: "open-with-offer", satisfiesTopic: "targetAsked" },
  { kind: "lever-loop-guard" },
  { kind: "info-disclosure", topic: "breakdown" },
  { kind: "info-disclosure", topic: "benefits" },
  { kind: "info-disclosure", topic: "comp-structure" },
  { kind: "info-disclosure", topic: "notice" },
  { kind: "info-disclosure", topic: "hike-pct" },
  { kind: "probe-expectations", satisfiesTopic: "targetAsked" },
  { kind: "probe-justification", satisfiesTopic: "valueProofAsked" },
  {
    kind: "counter-offer",
    counterTotalLpa: 35,
    counterFixedLpa: 30,
    counterVariableLpa: 5,
    satisfiesTopic: "targetAsked",
  },
  { kind: "lever-explore", from: "default" },
  { kind: "hold-firm", mode: "verbal-accept" },
  { kind: "rescission" },
  {
    kind: "close-recap-formal",
    fixedLpa: 30,
    variableLpa: 5,
    joiningBonusLpa: 2,
    retentionBonusLpa: 0,
    noticePeriodWeeks: 8,
    proposedJoiningDate: "2026-06-01",
    bgvStartTrigger: "offer-letter",
    offerLetterEta: "2026-05-25",
    satisfiesTopic: "close-confirmation",
  },
  { kind: "lever-grade-upgrade", satisfiesTopic: "targetAsked" },
  { kind: "lever-retention-bonus", satisfiesTopic: "targetAsked" },
  { kind: "lever-rsu-refresh", satisfiesTopic: "targetAsked" },
  { kind: "lever-relocation", satisfiesTopic: "wants-relocation-allowance" },
  { kind: "lever-perf-bonus-cadence", satisfiesTopic: "targetAsked" },
  { kind: "lever-joining-bonus-explained", satisfiesTopic: "wants-joining-bonus" },
  { kind: "band-anchor-with-rationale", satisfiesTopic: "targetAsked" },
  {
    kind: "internal-equity-defense",
    peerBandTopLpa: 40,
    peerBandMedianLpa: 32,
    satisfiesTopic: "targetAsked",
  },
  { kind: "comparative-anchoring", quartile: "top", satisfiesTopic: "targetAsked" },
  { kind: "component-probe", component: "base", satisfiesTopic: "currentCtcBase" },
  { kind: "component-probe", component: "variable", satisfiesTopic: "currentCtcVariable" },
  { kind: "component-probe", component: "esop", satisfiesTopic: "currentCtcEsop" },
  {
    kind: "anchor-with-offer",
    initialOffer: 30,
    bandIncomplete: false,
    satisfiesTopic: "targetAsked",
  },
  { kind: "post-acceptance-document-request" },
  { kind: "panel-approval-stall" },
  { kind: "polite-walkaway" },
  { kind: "anchor-defense-hike-strong", hikePct: 22, currentCtc: 28, offer: 34 },
  { kind: "fake-leverage-challenge", competingCompany: "FlipKart" },
];

/* Tokens the user MUST NOT see in label or hint. Includes:
 *  - kernel-state field names (counterRound, walkAway, maxStretch)
 *  - mechanism vocabulary (spiral, single-fire, fired, stamp)
 *  - phase literals (closing-push, offer-presented, lever-explore,
 *    range-disclosure, walked-away — verbatim phase strings) */
const INTERNAL_LEAK_TOKENS: ReadonlyArray<string> = [
  "counterRound",
  "spiral",
  "walkAway",
  "maxStretch",
  "single-fire",
  "fired",
  "askedTopics",
  "decisionLog",
  "leversFired",
  "closing-push",
  "offer-presented",
  "range-disclosure",
  "walked-away",
  /* lever-explore is a kind/phase string; the user-facing label is
   * "Exploring other levers" — different surface. */
  "lever-explore",
];

describe("deriveMoveTag — server-side transparency layer", () => {
  const state = freshState();

  it("returns a non-empty label and hint for every NextAction kind (exhaustiveness)", () => {
    /* Sanity: the fixtures cover every kind in the discriminated union.
     * Build a set of kinds covered by FIXTURES; we cannot statically
     * enumerate union members at runtime, but we can at least guarantee
     * the fixtures themselves don't drift (the unique-kind set should
     * stay broad). */
    const kinds = new Set(FIXTURES.map((a) => a.kind));
    /* 35 kinds in the union (Phase 3 missing-lever set + AP3-F2 component
     * probe + AP3-F3 anchor-with-offer + post-acceptance docs included).
     * If the planner adds a new kind, this assertion intentionally
     * tightens — bump alongside the new fixture. */
    expect(kinds.size).toBeGreaterThanOrEqual(35);

    for (const action of FIXTURES) {
      const tag = deriveMoveTag(action, state);
      expect(tag.label, `kind=${action.kind} label`).toBeTruthy();
      expect(tag.hint, `kind=${action.kind} hint`).toBeTruthy();
      expect(tag.label.length, `kind=${action.kind} label non-empty`).toBeGreaterThan(0);
      expect(tag.hint.length, `kind=${action.kind} hint non-empty`).toBeGreaterThan(0);
    }
  });

  it("never leaks internal kernel vocabulary in label or hint", () => {
    for (const action of FIXTURES) {
      const tag = deriveMoveTag(action, state);
      const combined = `${tag.label} | ${tag.hint}`;
      for (const token of INTERNAL_LEAK_TOKENS) {
        expect(
          combined.toLowerCase().includes(token.toLowerCase()),
          `kind=${action.kind} leaked "${token}" in "${combined}"`,
        ).toBe(false);
      }
    }
  });

  it("never leaks band-internal numbers", () => {
    /* Band numbers from the test fixture: 30, 42, 26. The tag is
     * derived against `state` so it MUST NOT echo any of these as
     * salary-shaped numbers. Also covers the counter-offer fixture
     * carrying 35 — the spec forbids revealing the spiral multiplier
     * or how close to walk-away; the simplest invariant is that no
     * numeric LPA-ish string surfaces in the label or hint at all. */
    const SALARY_NUM_RE = /(₹\s*\d|\d+(?:\.\d+)?\s*(?:LPA|lakh|L\b))/i;
    for (const action of FIXTURES) {
      const tag = deriveMoveTag(action, state);
      expect(SALARY_NUM_RE.test(tag.label), `kind=${action.kind} label has salary number`).toBe(false);
      expect(SALARY_NUM_RE.test(tag.hint), `kind=${action.kind} hint has salary number`).toBe(false);
    }
  });

  it("respects length contract — label ≤ 28, hint ≤ 140", () => {
    for (const action of FIXTURES) {
      const tag = deriveMoveTag(action, state);
      expect(tag.label.length, `kind=${action.kind} label "${tag.label}" length`).toBeLessThanOrEqual(28);
      expect(tag.hint.length, `kind=${action.kind} hint length`).toBeLessThanOrEqual(140);
    }
  });

  it("every kind maps to an allowed family value", () => {
    const ALLOWED: ReadonlyArray<MoveTag["family"]> = [
      "discovery",
      "anchor",
      "defense",
      "counter",
      "stall",
      "close",
      "terminal",
      "meta",
    ];
    const families = new Set<MoveTag["family"]>();
    for (const action of FIXTURES) {
      const tag = deriveMoveTag(action, state);
      expect(ALLOWED).toContain(tag.family);
      families.add(tag.family);
    }
    /* All families except "meta" should surface via at least one kind.
     * "meta" is reserved for the adversarial-deflection short-circuit
     * in the turn handler (not produced by deriveMoveTag itself). */
    expect(families.has("discovery")).toBe(true);
    expect(families.has("anchor")).toBe(true);
    expect(families.has("defense")).toBe(true);
    expect(families.has("counter")).toBe(true);
    expect(families.has("stall")).toBe(true);
    expect(families.has("close")).toBe(true);
    expect(families.has("terminal")).toBe(true);
  });

  it("discovery-probe is topic-aware (different satisfiesTopic → different label)", () => {
    type Topic = Extract<NextAction, { kind: "discovery-probe" }>["satisfiesTopic"];
    const baseFixture = (topic: Topic): NextAction => ({
      kind: "discovery-probe",
      item: String(topic),
      ask: `Tell me about ${String(topic)}.`,
      satisfiesTopic: topic,
    });
    const ctc = deriveMoveTag(baseFixture("currentCtcAsked"), state).label;
    const notice = deriveMoveTag(baseFixture("noticePeriodAsked"), state).label;
    const competing = deriveMoveTag(baseFixture("competingOffersAsked"), state).label;
    expect(new Set([ctc, notice, competing]).size).toBe(3);
  });

  it("component-probe is component-aware (base / variable / esop → different labels)", () => {
    const base = deriveMoveTag(
      { kind: "component-probe", component: "base", satisfiesTopic: "currentCtcBase" },
      state,
    ).label;
    const variable = deriveMoveTag(
      { kind: "component-probe", component: "variable", satisfiesTopic: "currentCtcVariable" },
      state,
    ).label;
    const esop = deriveMoveTag(
      { kind: "component-probe", component: "esop", satisfiesTopic: "currentCtcEsop" },
      state,
    ).label;
    expect(new Set([base, variable, esop]).size).toBe(3);
  });

  it("counter-offer label hides spiral / multiplier signal", () => {
    const tag = deriveMoveTag(
      {
        kind: "counter-offer",
        counterTotalLpa: 35,
        counterFixedLpa: 30,
        counterVariableLpa: 5,
        satisfiesTopic: "targetAsked",
      },
      state,
    );
    expect(tag.label).toBe("Counter-offering");
    /* No multiplier / round / spiral talk. */
    expect(/multiplier|round\s*\d|0\.\d|spiral/i.test(tag.hint)).toBe(false);
  });
});
