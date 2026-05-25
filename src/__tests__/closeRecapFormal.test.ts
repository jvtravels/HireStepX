/* Fix 4 (2026-05-16) — close-recap-formal planner state.
 *
 * When phase==="closing-push" or "accepted" AND the candidate has
 * verbally accepted, the planner emits a structured `close-recap-formal`
 * action carrying Fixed | Variable target | JB | Retention | Notice |
 * Proposed joining | BGV trigger | Offer letter ETA. Canonical prose
 * enumerates these.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction, type NextAction } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: false };
const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s-recap", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

describe("close-recap-formal planner state (Fix 4)", () => {
  it("verbal accept + closing-push → emits close-recap-formal", () => {
    const s = init({
      phase: "closing-push",
      highestOfferMade: 24,
      verbalAcceptanceTurn: 6,
      turnIndex: 6,
      lastJoiningBonusOffered: 2,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("close-recap-formal");
  });

  it("close-recap-formal carries fixed / variable / JB / notice / BGV trigger / OL ETA when discussed", () => {
    /* PDF#45 B2 (2026-05-26) — recap-hallucination guard. Notice / BGV
     * / OL ETA only render when the corresponding discovery topics
     * were discussed (state.infoAsked / state.noticeJoining). Populate
     * those signals so the full structured recap renders. */
    const s = init({
      phase: "closing-push",
      highestOfferMade: 24,
      verbalAcceptanceTurn: 6,
      turnIndex: 6,
      lastJoiningBonusOffered: 2,
      infoAsked: ["notice-period-ask"],
      candidateProfile: { bgvAnxiety: true } as never,
      noticeJoining: {
        noticePeriodDays: 60,
        buyoutRequested: false,
        joiningBonusAsk: null,
        earlyJoinPreferred: false,
        joiningBonusClawbackDiscussed: false,
        lastWorkingDayText: null,
        hasAny: true,
      },
    });
    const action = planNextAction(s);
    if (action.kind !== "close-recap-formal") throw new Error("wrong kind");
    expect(action.fixedLpa).toBeGreaterThan(0);
    expect(action.noticePeriodWeeks).toBeGreaterThan(0);
    expect(action.joiningBonusLpa).toBe(2);
    expect(action.bgvStartTrigger).toMatch(/post[- ]accept|offer letter|signed/i);
    expect(action.offerLetterEta).toMatch(/business day|week|hours/i);
  });

  it("close-recap-formal OMITS notice / BGV / OL ETA when never discussed (PDF#45 B2)", () => {
    /* PDF#45 B2 (2026-05-26) — verify the recap does NOT hallucinate
     * notice / BGV / OL ETA when the underlying topics were never
     * raised in the session. Pure-state acceptance with no discovery
     * on process topics → recap renders ONLY the cash fitment. */
    const s = init({
      phase: "closing-push",
      highestOfferMade: 24,
      verbalAcceptanceTurn: 6,
      turnIndex: 6,
      lastJoiningBonusOffered: 2,
    });
    const action = planNextAction(s);
    if (action.kind !== "close-recap-formal") throw new Error("wrong kind");
    expect(action.noticePeriodWeeks).toBeUndefined();
    expect(action.bgvStartTrigger).toBeUndefined();
    expect(action.offerLetterEta).toBeUndefined();
    const prose = renderCanonicalProse(action, s);
    expect(prose).not.toMatch(/notice/i);
    expect(prose).not.toMatch(/BGV|background verif/i);
    expect(prose).not.toMatch(/offer letter/i);
  });

  it("canonical prose enumerates fitment + variable + JB + notice + BGV + OL + 'sounds good?' when discussed", () => {
    const s = init({
      phase: "closing-push",
      highestOfferMade: 24,
      verbalAcceptanceTurn: 6,
      turnIndex: 6,
      lastJoiningBonusOffered: 2,
      infoAsked: ["notice-period-ask"],
      candidateProfile: { bgvAnxiety: true } as never,
      noticeJoining: {
        noticePeriodDays: 60,
        buyoutRequested: false,
        joiningBonusAsk: null,
        earlyJoinPreferred: false,
        joiningBonusClawbackDiscussed: false,
        lastWorkingDayText: null,
        hasAny: true,
      },
    });
    const action = planNextAction(s);
    const prose = renderCanonicalProse(action, s);
    expect(prose).toMatch(/fixed/i);
    expect(prose).toMatch(/variable/i);
    expect(prose).toMatch(/joining bonus|JB/i);
    expect(prose).toMatch(/notice/i);
    expect(prose).toMatch(/BGV|background verif/i);
    expect(prose).toMatch(/offer letter/i);
    expect(prose).toMatch(/sounds good\??/i);
  });

  it("no verbal accept → no close-recap-formal", () => {
    const s = init({
      phase: "closing-push",
      highestOfferMade: 24,
      verbalAcceptanceTurn: null,
      turnIndex: 6,
    });
    const action: NextAction = planNextAction(s);
    expect(action.kind).not.toBe("close-recap-formal");
  });
});
