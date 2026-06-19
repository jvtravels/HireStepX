/* Crack 6 (2026-05-17) — validator-contract invariant.
 *
 * The HireStepX kernel ships a per-NextAction-kind contract table
 * (`NEXT_ACTION_CONTRACT` in `_response-pipeline.ts`) that the restyle
 * validator enforces against the LLM output before shipping it. The
 * audit gap this test closes:
 *
 *   The contract is meant to police LLM RESTYLES of the canonical
 *   prose. It only works if the CANONICAL PROSE ITSELF passes the
 *   contract. Otherwise every LLM restyle of that canonical (which by
 *   construction preserves the canonical's semantic content) gets
 *   silently rejected in production and the bot ships the canonical
 *   verbatim — even when the restyle was good — because the contract
 *   was the gate that bounced it.
 *
 * The invariant tested here: for every entry in NEXT_ACTION_CONTRACT,
 * build a representative NextAction + NegotiationState for that kind,
 * render the canonical prose, then run that prose through
 * `validateRestyle` (canonical == restyled). Assert valid: true.
 *
 * Per-kind variants (e.g. component-probe ∈ {base, variable, esop};
 * anchor-with-offer with bandIncomplete on / off) are covered separately
 * because they exercise distinct canonical branches.
 *
 * Two real contract↔prose drifts were uncovered and fixed in the same
 * commit (post-acceptance-document-request Form-16/payslip leftover;
 * open-with-offer numberPolicy stuck on "required" after the kernel-
 * first inversion turned the opener into a discovery probe).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";
import {
  validateRestyle,
  NEXT_ACTION_CONTRACT,
} from "../../../server-handlers/_response-pipeline";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: true,
};

const mk = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "crack6-contract-invariant",
    role: "Backend Engineer",
    company: "Flipkart",
    band: BAND,
  }),
  ...overrides,
});

/* Per-kind fixture builder. Returns the (action, state) pair the canonical
 * prose renderer needs for this kind. Variant-bearing kinds appear multiple
 * times under different labels. */
type Fixture = {
  label: string;
  action: NextAction;
  state: NegotiationState;
};

const FIXTURES: Fixture[] = [
  /* discovery-probe — opener-style currentCtc probe at turn 0. No
   * lastTurnDelta so buildDiscoveryAck returns null and no FL2 bridge
   * is prepended. */
  {
    label: "discovery-probe:currentCtc",
    action: {
      kind: "discovery-probe",
      item: "currentCtc",
      ask: "",
      satisfiesTopic: "currentCtcAnswered",
    },
    state: mk({ phase: "probe-expectations", turnIndex: 0 }),
  },
  /* probe-justification — number-free "where is the expectation coming
   * from?" body. */
  {
    label: "probe-justification",
    action: { kind: "probe-justification", satisfiesTopic: "targetAnswered" },
    state: mk({ phase: "probe-expectations", turnIndex: 2, candidateTarget: 28 }),
  },
  /* counter-offer — requires numbers; planner pre-computes
   * counterTotalLpa. counterRound=1 so the spiralLead reads naturally. */
  {
    label: "counter-offer:round1",
    action: {
      kind: "counter-offer",
      counterTotalLpa: 24,
      counterFixedLpa: 20,
      counterVariableLpa: 4,
      satisfiesTopic: "targetAnswered",
    },
    state: mk({
      phase: "counter-offer",
      turnIndex: 4,
      counterRound: 1,
      highestOfferMade: 22,
      candidateCurrentCtc: 18,
      candidateTarget: 28,
    }),
  },
  /* open-with-offer (turn 0) — under kernel-first inversion this is
   * actually a discovery probe ("what's your current CTC at the
   * moment?"); no number in the canonical. */
  {
    label: "open-with-offer:turn0",
    action: { kind: "open-with-offer", satisfiesTopic: "currentCtcAnswered" },
    state: mk({ phase: "opening", turnIndex: 0, candidateApplicableYoe: 2 }),
  },
  /* open-with-offer (turn != 0) — falls through to the "Before I put a
   * number out — what fitment were you anchoring on?" branch. */
  {
    label: "open-with-offer:laterTurn",
    action: { kind: "open-with-offer", satisfiesTopic: "open-with-offer" },
    state: mk({ phase: "offer-presented", turnIndex: 3 }),
  },
  /* close-recap-formal — required numbers + the four field tokens
   * (fixed, variable, notice, bgv) enforced by the legacy named-reason
   * branch. */
  {
    label: "close-recap-formal",
    action: {
      kind: "close-recap-formal",
      fixedLpa: 20,
      variableLpa: 4,
      noticePeriodWeeks: 9,
      bgvStartTrigger: "post-acceptance",
      offerLetterEta: "3 working days",
      satisfiesTopic: "targetAnswered",
    },
    state: mk({
      phase: "closing-push",
      turnIndex: 7,
      verbalAcceptanceTurn: 6,
      highestOfferMade: 24,
      candidateCurrentCtc: 18,
      candidateTarget: 26,
    }),
  },
  /* credibility-probe — requires "resume" token. */
  {
    label: "credibility-probe",
    action: {
      kind: "credibility-probe",
      resumeCompany: "Razorpay",
      statedCompany: "PhonePe",
      satisfiesTopic: "currentCtcAnswered",
    },
    state: mk({ phase: "probe-expectations", turnIndex: 1 }),
  },
  /* component-probe variants (base / variable / esop). Each exercises a
   * different canonical branch + per-component requiredToken overlay. */
  {
    label: "component-probe:base",
    action: { kind: "component-probe", component: "base", satisfiesTopic: "currentCtcAnswered" },
    state: mk({ phase: "probe-expectations", turnIndex: 2, candidateCurrentCtc: 28 }),
  },
  {
    label: "component-probe:variable",
    action: { kind: "component-probe", component: "variable", satisfiesTopic: "currentCtcAnswered" },
    state: mk({ phase: "probe-expectations", turnIndex: 2, candidateCurrentCtc: 28 }),
  },
  {
    label: "component-probe:esop",
    action: { kind: "component-probe", component: "esop", satisfiesTopic: "currentCtcAnswered" },
    state: mk({ phase: "probe-expectations", turnIndex: 2, candidateCurrentCtc: 28 }),
  },
  /* anchor-with-offer (band complete) — point-offer + "LPA" + "fitment". */
  {
    label: "anchor-with-offer:bandComplete",
    action: {
      kind: "anchor-with-offer",
      initialOffer: BAND.initialOffer,
      bandIncomplete: false,
      satisfiesTopic: "targetAnswered",
    },
    state: mk({
      phase: "offer-presented",
      turnIndex: 3,
      candidateCurrentCtc: 18,
      candidateTarget: 26,
    }),
  },
  /* anchor-with-offer (band incomplete) — honest-defer path; no point-
   * offer, only "fitment" token required by the validator override. */
  {
    label: "anchor-with-offer:bandIncomplete",
    action: {
      kind: "anchor-with-offer",
      initialOffer: BAND.initialOffer,
      bandIncomplete: true,
      satisfiesTopic: "targetAnswered",
    },
    state: mk({
      phase: "offer-presented",
      turnIndex: 3,
      candidateCurrentCtc: 18,
      candidateTarget: 26,
    }),
  },
  /* band-disclosure-deflect — no internal numbers; "panel" anchor. */
  {
    label: "band-disclosure-deflect",
    action: { kind: "band-disclosure-deflect", satisfiesTopic: "targetAnswered" },
    state: mk({
      phase: "range-disclosure",
      turnIndex: 3,
      highestOfferMade: BAND.initialOffer,
      candidateCurrentCtc: 14,
    }),
  },
  /* post-acceptance-document-request — PAN + Aadhaar + BGV (Crack 6
   * drift fix; was previously requiring Form 16 / payslip — tokens the
   * trimmed canonical no longer carries). */
  {
    label: "post-acceptance-document-request",
    action: { kind: "post-acceptance-document-request" },
    state: mk({
      phase: "closing-push",
      turnIndex: 8,
      verbalAcceptanceTurn: 7,
      acceptedAtTurn: 7,
    }),
  },
  /* panel-approval-stall — "panel" / "leadership" + EOD references. */
  {
    label: "panel-approval-stall",
    action: { kind: "panel-approval-stall" },
    state: mk({
      phase: "counter-offer",
      turnIndex: 5,
      counterRound: 2,
      highestOfferMade: 24,
      candidateCurrentCtc: 18,
      lastCandidateCounterLpa: 28,
    }),
  },
  /* polite-walkaway — "honest" + "other candidates"/"move forward". */
  {
    label: "polite-walkaway",
    action: { kind: "polite-walkaway" },
    state: mk({
      phase: "counter-offer",
      turnIndex: 6,
      counterRound: 1,
      highestOfferMade: 24,
      candidateCurrentCtc: 18,
    }),
  },
  /* anchor-defense-hike-strong — numbers + "% hike" + "peers". */
  {
    label: "anchor-defense-hike-strong",
    action: {
      kind: "anchor-defense-hike-strong",
      hikePct: 10,
      currentCtc: 20,
      offer: 22,
    },
    state: mk({
      phase: "counter-offer",
      turnIndex: 4,
      counterRound: 1,
      highestOfferMade: 22,
      candidateCurrentCtc: 20,
    }),
  },
  /* fake-leverage-challenge — "offer letter" or "redacted" token. Both
   * variants (with named competing company and without) exercise the
   * two canonical branches. */
  {
    label: "fake-leverage-challenge:namedCompany",
    action: { kind: "fake-leverage-challenge", competingCompany: "Razorpay" },
    state: mk({
      phase: "counter-offer",
      turnIndex: 5,
      counterRound: 1,
      highestOfferMade: 24,
      competingOffer: 28,
    }),
  },
  {
    label: "fake-leverage-challenge:noCompany",
    action: { kind: "fake-leverage-challenge", competingCompany: null },
    state: mk({
      phase: "counter-offer",
      turnIndex: 5,
      counterRound: 1,
      highestOfferMade: 24,
      competingOffer: 28,
    }),
  },
  /* PDF#29 Bug 7 (2026-05-18) — acknowledge-and-recover. Frustration
   * recovery turn; no numbers, must carry the "apolog" required token
   * to pin the repair semantics. */
  {
    label: "acknowledge-and-recover",
    action: {
      kind: "acknowledge-and-recover",
      satisfiesTopic: "acknowledge-and-recover",
    },
    state: mk({ phase: "probe-expectations", turnIndex: 3 }),
  },
  /* PDF#29 Bug 3 (2026-05-18) — band-anchor-with-rationale. Point offer
   * at band floor; contract requires LPA + band tokens and bans any
   * dash/"to" between two digits so the LLM cannot reintroduce a band
   * range in the restyle. */
  {
    label: "band-anchor-with-rationale",
    action: {
      kind: "band-anchor-with-rationale",
      satisfiesTopic: "band-anchor-with-rationale",
    },
    state: mk({
      phase: "probe-expectations",
      turnIndex: 3,
      highestOfferMade: 0,
      candidateCurrentCtc: 18,
    }),
  },
  /* PDF#34 Fix 3 (2026-05-18) — clarify-prior-question. Candidate
   * asked "what is that?" about a jargon term in the prior AI turn;
   * canonical prose must define the term inline (required token
   * "let me clarify"/"rephrase"/"mean") and re-ask. Numbers are
   * optional — the vesting/ESOP branches carry no LPA; the
   * base-split branch may include a placeholder. */
  {
    label: "clarify-prior-question",
    action: {
      kind: "clarify-prior-question",
      priorAiText: "What's the vesting schedule on your current grant?",
      satisfiesTopic: "clarify-prior-question",
    },
    state: mk({ phase: "probe-expectations", turnIndex: 3 }),
  },
  /* PDF#35 Move 1 (2026-05-18) — offer-recap. Recap of the standing
   * offer when candidate asks "what was the offer again?". Numbers
   * REQUIRED (must quote the offer); range dashes banned so the LLM
   * cannot reintroduce a band. */
  {
    label: "offer-recap",
    action: { kind: "offer-recap", offerLpa: 24 },
    state: mk({
      phase: "range-disclosure",
      turnIndex: 4,
      highestOfferMade: 24,
      candidateCurrentCtc: 18,
    }),
  },
  /* Straight-fitment breakdown (2026-06-19) — discloses the standing
   * offer's fixed/variable split (single source of truth: the close-recap
   * derivation). Numbers REQUIRED + "fixed"/"variable" tokens. Exercises
   * the canonical prose ↔ contract agreement for the new kind. */
  {
    label: "offer-breakdown",
    action: {
      kind: "offer-breakdown",
      totalLpa: 24,
      fixedLpa: 20.4,
      variableLpa: 3.6,
      joiningBonusLpa: 2,
      satisfiesTopic: "answer-direct",
    },
    state: mk({
      phase: "counter-offer",
      turnIndex: 5,
      highestOfferMade: 24,
      candidateCurrentCtc: 18,
    }),
  },
  /* Phase 5 Session A (2026-05-19) — round-transition handoff stub.
   * No NEXT_ACTION_CONTRACT entry (Session B owns prose + contract);
   * fixture exists to exercise the canonical-prose stub through the
   * validator and to anchor future drift detection when Session B
   * lands the persona-specific phrasing. */
  {
    label: "round-transition:hr-to-hm",
    action: {
      kind: "round-transition",
      from: "hr-partner",
      to: "hiring-manager",
      
    },
    state: mk({
      phase: "opening",
      turnIndex: 5,
      multiRoundEnabled: true,
      roundPersona: "hiring-manager",
      roundIndex: 1,
      roundTransitions: [
        { atTurn: 5, from: "hr-partner", to: "hiring-manager" },
      ],
    }),
  },
];

describe("Crack 6 — validator-contract invariant (canonical prose ↔ NEXT_ACTION_CONTRACT)", () => {
  /* Every kind that has a contract entry must appear in at least one
   * fixture. If a new contract entry ships without a corresponding
   * fixture, this guard fails and the author has to add coverage. */
  it("every NEXT_ACTION_CONTRACT key has at least one fixture", () => {
    const covered = new Set(FIXTURES.map((f) => f.action.kind));
    const contractKinds = Object.keys(NEXT_ACTION_CONTRACT) as NextAction["kind"][];
    const uncovered = contractKinds.filter((k) => !covered.has(k));
    expect(uncovered).toEqual([]);
  });

  for (const f of FIXTURES) {
    it(`canonical prose for ${f.label} passes its NEXT_ACTION_CONTRACT entry`, () => {
      const canonical = renderCanonicalProse(f.action, f.state);
      expect(canonical.length).toBeGreaterThan(0);
      const result = validateRestyle(canonical, canonical, f.state, f.action);
      if (!result.valid) {
        throw new Error(
          `Canonical prose for ${f.label} was rejected by its own contract.\n` +
            `  reason : ${result.reason}\n` +
            `  prose  : ${canonical}\n` +
            `  This is a contract↔prose drift bug. Fix the contract entry in\n` +
            `  _response-pipeline.ts (NEXT_ACTION_CONTRACT) OR the canonical\n` +
            `  in _canonical-prose.ts so the two agree.`,
        );
      }
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  }
});
