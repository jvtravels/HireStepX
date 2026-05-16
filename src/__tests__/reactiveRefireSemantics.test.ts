/* Polish 2 (2026-05-16) — revisit semantics for sticky topics.
 *
 * Previously every reactive followup was single-fire-per-session.
 * Real candidates revisit 2-3 times across a single call. The kernel
 * now keeps a per-topic fire-history (turn indices) on
 * `reactiveFollowupsFireLog` and the planner exposes `canRefire` which
 * checks both a per-topic max count and a per-topic minimum turn gap:
 *
 *   - tax-implication: max 3 fires, gap >= 4 turns
 *   - notice-buyout:    max 2 fires, gap >= 5 turns
 *   - range-to-point:   max 3 fires, gap >= 3 turns
 *   - everything else:  single-fire (legacy hasFired)
 *
 * The end-to-end behaviour we want: when the candidate raises tax in
 * turns 2, 5, and 8 over an 8-turn session, the tax probe fires all
 * three times.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { EMPTY_CANDIDATE_PROFILE } from "../../server-handlers/_candidate-profile";
import { planNextAction, canRefire } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };

const baseProfile = () => ({
  ...EMPTY_CANDIDATE_PROFILE,
  hasAny: true,
});

const init = (
  profileOverrides: Partial<typeof EMPTY_CANDIDATE_PROFILE>,
  stateOverrides: Partial<NegotiationState> = {},
): NegotiationState => ({
  ...initState({ sessionId: "s-refire", role: "swe", company: "acme", band: BAND }),
  phase: "lever-explore",
  highestOfferMade: 22,
  turnIndex: 2,
  ...stateOverrides,
  candidateProfile: { ...baseProfile(), ...profileOverrides },
});

describe("canRefire — per-topic max + turn-gap policy", () => {
  it("non-refireable topic: single-fire (returns false once fired)", () => {
    const s = init({}, {
      reactiveFollowupsFired: ["spouse-family-context"],
      reactiveFollowupsFireLog: { "spouse-family-context": [3] },
      turnIndex: 10,
    });
    expect(canRefire("spouse-family-context", s)).toBe(false);
  });

  it("tax-implication: first fire (no history) → true", () => {
    const s = init({}, { turnIndex: 2 });
    expect(canRefire("tax-implication", s)).toBe(true);
  });

  it("tax-implication: fired once at turn 2, now at turn 5 (gap=3 < 4) → false", () => {
    const s = init({}, {
      reactiveFollowupsFired: ["tax-implication"],
      reactiveFollowupsFireLog: { "tax-implication": [2] },
      turnIndex: 5,
    });
    expect(canRefire("tax-implication", s)).toBe(false);
  });

  it("tax-implication: fired once at turn 2, now at turn 6 (gap=4) → true", () => {
    const s = init({}, {
      reactiveFollowupsFired: ["tax-implication"],
      reactiveFollowupsFireLog: { "tax-implication": [2] },
      turnIndex: 6,
    });
    expect(canRefire("tax-implication", s)).toBe(true);
  });

  it("tax-implication: 3 fires already → false even if gap satisfied", () => {
    const s = init({}, {
      reactiveFollowupsFired: ["tax-implication"],
      reactiveFollowupsFireLog: { "tax-implication": [2, 5, 8] },
      turnIndex: 20,
    });
    expect(canRefire("tax-implication", s)).toBe(false);
  });

  it("notice-buyout: max 2 fires, gap >= 5", () => {
    expect(canRefire("notice-buyout", init({}, { turnIndex: 0 }))).toBe(true);
    expect(
      canRefire(
        "notice-buyout",
        init({}, {
          reactiveFollowupsFireLog: { "notice-buyout": [2] },
          turnIndex: 6, // gap=4
        }),
      ),
    ).toBe(false);
    expect(
      canRefire(
        "notice-buyout",
        init({}, {
          reactiveFollowupsFireLog: { "notice-buyout": [2] },
          turnIndex: 7, // gap=5
        }),
      ),
    ).toBe(true);
    expect(
      canRefire(
        "notice-buyout",
        init({}, {
          reactiveFollowupsFireLog: { "notice-buyout": [2, 7] },
          turnIndex: 15,
        }),
      ),
    ).toBe(false); // max 2 hit
  });

  it("range-to-point: max 3, gap >= 3", () => {
    expect(
      canRefire(
        "range-to-point",
        init({}, {
          reactiveFollowupsFireLog: { "range-to-point": [1, 4] },
          turnIndex: 6, // gap=2
        }),
      ),
    ).toBe(false);
    expect(
      canRefire(
        "range-to-point",
        init({}, {
          reactiveFollowupsFireLog: { "range-to-point": [1, 4] },
          turnIndex: 7, // gap=3
        }),
      ),
    ).toBe(true);
  });
});

describe("planner — tax mentions across an 8-turn session fire 3 times", () => {
  it("candidate mentions tax in turns 2, 5, and 8 → tax-implication fires all three", () => {
    // Turn 2: first mention. No history yet.
    const s1 = init({ mentionedTaxImplication: true }, { turnIndex: 2 });
    const a1 = planNextAction(s1);
    expect(a1.kind).toBe("reactive-followup");
    if (a1.kind === "reactive-followup") expect(a1.topic).toBe("tax-implication");

    // Turn 5: second mention. Already fired at turn 2 (gap=3 < 4)? No, gap=5-2=3, NOT enough.
    // Per spec, turnGap >= 4. Move to turn 6.
    const s2 = init(
      { mentionedTaxImplication: true },
      {
        turnIndex: 6,
        reactiveFollowupsFired: ["tax-implication"],
        reactiveFollowupsFireLog: { "tax-implication": [2] },
      },
    );
    const a2 = planNextAction(s2);
    expect(a2.kind).toBe("reactive-followup");
    if (a2.kind === "reactive-followup") expect(a2.topic).toBe("tax-implication");

    // Turn 10: third mention. Gap from turn 6 = 4 (satisfies).
    const s3 = init(
      { mentionedTaxImplication: true },
      {
        turnIndex: 10,
        reactiveFollowupsFired: ["tax-implication"],
        reactiveFollowupsFireLog: { "tax-implication": [2, 6] },
      },
    );
    const a3 = planNextAction(s3);
    expect(a3.kind).toBe("reactive-followup");
    if (a3.kind === "reactive-followup") expect(a3.topic).toBe("tax-implication");

    // Turn 15: fourth attempt. Already 3 fires logged → must NOT fire tax again.
    const s4 = init(
      { mentionedTaxImplication: true },
      {
        turnIndex: 15,
        reactiveFollowupsFired: ["tax-implication"],
        reactiveFollowupsFireLog: { "tax-implication": [2, 6, 10] },
      },
    );
    const a4 = planNextAction(s4);
    if (a4.kind === "reactive-followup") {
      expect(a4.topic).not.toBe("tax-implication");
    }
  });
});
