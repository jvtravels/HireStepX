/* S48-B7 / S53-B4 (2026-07-24) — escalatingCloseOut must not emit
 * "I've stretched as far as the band allows" when the recruiter never moved
 * the cash number from the initial offer.
 *
 * Root cause: the line was in the pool unconditionally, so repeat-avoidance
 * (which calls escalatingCloseOut when the canonical body is a verbatim
 * repeat of the prior turn) could emit it even in a zero-movement session
 * where claiming "I've stretched" is factually false.
 *
 * Fix: pool is conditionally filtered — "stretched" line only available when
 * highestOfferMade > band.initialOffer (at least one concession made).
 * Zero-movement sessions get an honest alternative instead. */
import { describe, it, expect } from "vitest";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 28.3,
  maxStretch: 38,
  walkAway: 22,
  hasEquity: false,
};

const counterAction: NextAction = {
  kind: "counter-offer",
  counterTotalLpa: 28.3,
} as NextAction;

function makeState(overrides: Partial<NegotiationState>): NegotiationState {
  return {
    ...initState({ sessionId: "s-s48b7", role: "swe", company: "walmart", band: BAND }),
    ...overrides,
  };
}

/* Force the escalating-close-out path: give a lastAiText that matches the
 * counter-offer canonical so the repeat guard fires and escalatingCloseOut
 * is called. */
function forceEscalation(highestOffer: number, turnIndex: number): string {
  const base = renderCanonicalProse(counterAction, makeState({ highestOfferMade: highestOffer, turnIndex }));
  return renderCanonicalProse(counterAction, makeState({
    highestOfferMade: highestOffer,
    turnIndex,
    lastAiText: base,
  }));
}

const STRETCHED_RE = /stretched?\s+as\s+far\s+as/i;

describe("escalatingCloseOut — zero-movement session (S48-B7 / S53-B4)", () => {
  it("never emits 'stretched as far as' when highestOfferMade === initialOffer (zero movement)", () => {
    for (let turn = 0; turn < 7; turn++) {
      const line = forceEscalation(BAND.initialOffer, turn);
      expect(line).not.toMatch(STRETCHED_RE);
    }
  });

  it("emits non-empty honest prose instead (no empty fallback)", () => {
    const line = forceEscalation(BAND.initialOffer, 3);
    expect(line.trim().length).toBeGreaterThan(20);
  });

  it("honest alternative contains the offer figure", () => {
    const line = forceEscalation(BAND.initialOffer, 3);
    expect(line).toMatch(/28\.3L|₹28/);
  });
});

describe("escalatingCloseOut — WITH concession (S48-B7 guard is off when recruiter moved)", () => {
  it("CAN emit 'stretched as far as the band allows' when highestOfferMade > initialOffer", () => {
    /* Recruiter moved from ₹28.3L → ₹31L. 'Stretched' line should be in the pool. */
    const lines: string[] = [];
    for (let turn = 0; turn < 7; turn++) {
      lines.push(forceEscalation(31, turn));
    }
    /* At least one of the 7 escalation turns emits the 'stretched' phrase
     * (pool has it; dedup ensures variety so not all 7 say it). */
    const hasStretched = lines.some((l) => STRETCHED_RE.test(l));
    expect(hasStretched).toBe(true);
  });

  it("pool dedup still works — 7 turns are all distinct when recruiter conceded", () => {
    const log: NegotiationState["conversationLog"] = [];
    const shipped: string[] = [];
    for (let turn = 0; turn < 7; turn++) {
      const base = renderCanonicalProse(counterAction, makeState({ highestOfferMade: 31, turnIndex: turn }));
      const state = makeState({ highestOfferMade: 31, turnIndex: turn, lastAiText: base, conversationLog: [...log] });
      const line = renderCanonicalProse(counterAction, state);
      shipped.push(line);
      log.push({ speaker: "ai", text: line });
    }
    const unique = new Set(shipped.map((l) => l.trim().toLowerCase()));
    expect(unique.size).toBe(7);
  });
});
