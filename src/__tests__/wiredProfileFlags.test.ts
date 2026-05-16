/* Fix 5 (2026-05-16) — wire 13 previously-dead candidate-profile flags
 * into reactive-followup rules. Each flag, when true on
 * candidateProfile, must emit a reactive-followup with the expected
 * topic. Idempotent: topic key tracked via reactiveFollowupsFired
 * (sticky session ledger).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { EMPTY_CANDIDATE_PROFILE } from "../../server-handlers/_candidate-profile";
import { planNextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };

const init = (
  profileOverrides: Partial<typeof EMPTY_CANDIDATE_PROFILE>,
  stateOverrides: Partial<NegotiationState> = {},
): NegotiationState => ({
  ...initState({ sessionId: "s-wired", role: "swe", company: "acme", band: BAND }),
  phase: "lever-explore",
  highestOfferMade: 22,
  turnIndex: 4,
  ...stateOverrides,
  candidateProfile: { ...EMPTY_CANDIDATE_PROFILE, hasAny: true, ...profileOverrides },
});

const CASES: { flag: keyof typeof EMPTY_CANDIDATE_PROFILE; topic: string }[] = [
  { flag: "wantsHigherBase", topic: "wants-higher-base" },
  { flag: "wantsJoiningBonus", topic: "wants-joining-bonus" },
  { flag: "wantsRelocationAllowance", topic: "wants-relocation-allowance" },
  { flag: "mentionedSpouseFamily", topic: "spouse-family-context" },
  { flag: "askedAboutReporting", topic: "reporting-structure" },
  { flag: "askedAboutGrowthPath", topic: "growth-path" },
  { flag: "askedAboutTeamSize", topic: "team-size" },
  { flag: "mentionedTaxImplication", topic: "tax-implication" },
  { flag: "mentionedBgvConcern", topic: "bgv-concern" },
  { flag: "mentionedMoonlighting", topic: "moonlighting-policy" },
  { flag: "gaveRangeNotPoint", topic: "range-to-point" },
  { flag: "deflectedOnRange", topic: "range-deflection" },
  { flag: "referencedMarketData", topic: "market-data-reference" },
];

describe("Fix 5 — wired candidate-profile flags drive reactive followups", () => {
  for (const { flag, topic } of CASES) {
    it(`profile.${String(flag)} → reactive-followup topic=${topic}`, () => {
      const s = init({ [flag]: true } as Partial<typeof EMPTY_CANDIDATE_PROFILE>);
      const action = planNextAction(s);
      expect(action.kind).toBe("reactive-followup");
      if (action.kind === "reactive-followup") {
        expect(action.topic).toBe(topic);
      }
    });

    it(`profile.${String(flag)} suppressed once topic=${topic} has fired`, () => {
      const s = init(
        { [flag]: true } as Partial<typeof EMPTY_CANDIDATE_PROFILE>,
        { reactiveFollowupsFired: [topic] },
      );
      const action = planNextAction(s);
      if (action.kind === "reactive-followup") {
        expect(action.topic).not.toBe(topic);
      }
    });
  }
});
