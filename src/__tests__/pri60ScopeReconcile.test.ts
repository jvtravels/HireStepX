import { describe, it, expect } from "vitest";
import { runConversation } from "./_negotiationSim";
import {
  undeliverableFixedConditionAsk,
  fixedScopedCloseTotal,
} from "../../server-handlers/_next-action-planner";
import { initState, type NegotiationBand } from "../../server-handlers/_negotiation-kernel";

/* PRI-60 regression guard (2026-06-25, real prod salary-negotiation session,
 * Flipkart Engineering Manager).
 *
 * The bot opened framing ₹52.3L as TOTAL comp ("₹46.3L fixed plus a ₹6L
 * target … ESOP grant follows the same level"). The candidate later said "If
 * you can close at 52.3 fixed, that works for me" — asking for the equity-
 * inclusive TOTAL as pure FIXED cash. In production the bot silently agreed
 * ("let's lock it at ₹52.3L"), converting a total into fixed with no
 * acknowledgement: a stealth over-concession AND a number-semantics break (the
 * same figure meant total in the opener and fixed at the close).
 *
 * Two things must hold and are pinned here:
 *   1. NO false-close — the bot never locks the total as fixed.
 *   2. The scope conflict is RECONCILED OUT LOUD — the response names that the
 *      fixed ask sits above the cash band it can structure (the total→fixed
 *      conversion is stated, not silently performed), rather than ducking into
 *      a generic comp-structure recap.
 *
 * Root cause was routing: a prior breakdown ask left `compensation-breakdown`
 * sticky in the cumulative `infoAsked`, so the info-disclosure override
 * hijacked the close turn and shipped a structure tour — the same hijack class
 * as PRI-59 Gap 3. The fix suppresses the info overrides when an undeliverable
 * fixed close-ask is pending over a standing offer, deferring to the
 * counter/close engine (the single place that names the fixed cap). */

const FLIPKART_EM: NegotiationBand = {
  initialOffer: 44,
  maxStretch: 52.3,
  walkAway: 38,
  hasEquity: true,
  variableMax: 6,
} as NegotiationBand;

describe("undeliverableFixedConditionAsk — total-vs-fixed scope detector (PRI-60)", () => {
  it("flags a fixed ask the band cannot deliver as fixed", () => {
    // 52 fixed implies 52 + 6 variable = 58 total > maxStretch 52.3 → undeliverable.
    const state = {
      ...initState({
        sessionId: "u",
        role: "Engineering Manager",
        company: "Flipkart",
        band: FLIPKART_EM,
      } as Parameters<typeof initState>[0]),
      highestOfferMade: 52.3,
      candidateTargetFixed: 52,
    };
    expect(undeliverableFixedConditionAsk(state)).toBe(52);
    expect(fixedScopedCloseTotal(state)).toBeNull();
  });

  it("does NOT flag a deliverable fixed ask (sits inside the cash band)", () => {
    // 44 fixed implies 44 + 6 = 50 total ≤ 52.3 → deliverable, must not block.
    const state = {
      ...initState({
        sessionId: "u",
        role: "Engineering Manager",
        company: "Flipkart",
        band: FLIPKART_EM,
      } as Parameters<typeof initState>[0]),
      highestOfferMade: 50,
      candidateTargetFixed: 44,
    };
    expect(undeliverableFixedConditionAsk(state)).toBeNull();
  });
});

describe("close conflating equity-inclusive TOTAL with FIXED cash (PRI-60)", () => {
  const turns = [
    "I'm an EM with 10 years, currently at 46 LPA fixed plus some ESOPs.",
    "What's the full package you can offer?",
    "Can you walk me through the breakdown — fixed vs ESOP?",
    "If you can close at 52.3 fixed, that works for me.",
  ];

  const { transcript, finalState } = runConversation({
    sessionId: "pri60-guard",
    role: "Engineering Manager",
    company: "Flipkart",
    band: FLIPKART_EM,
    initExtras: { applicableYoe: 10, experienceLevel: "senior" },
    stopOnTerminal: false,
    turns,
  });

  // T4 (index 4) is the "close at 52.3 fixed" turn over the standing total offer.
  const closeTurn = transcript[4];

  it("ships a response for the fixed-scoped close turn", () => {
    expect(closeTurn).toBeTruthy();
    expect(closeTurn.aiText.length).toBeGreaterThan(0);
  });

  it("does NOT false-close the total as fixed", () => {
    expect(closeTurn.kind).not.toBe("close");
    expect(closeTurn.terminal).toBe(false);
    expect(finalState.phase).not.toBe("accepted");
  });

  it("reconciles the scope out loud (names the fixed ask is above the cash band)", () => {
    expect(closeTurn.aiText.toLowerCase()).toMatch(
      /above the cash band|cash band i can structure|on the fixed/,
    );
  });

  it("does not duck into a generic comp-structure recap", () => {
    // The hijack PRI-60 forbids: the "which piece do you want to dig into?"
    // structure tour shipped over an explicit close signal.
    expect(closeTurn.aiText.toLowerCase()).not.toMatch(
      /which piece do you want to dig into/,
    );
  });

  it("does not concede free cash above the standing offer", () => {
    expect(closeTurn.highestOfferMade).toBeLessThanOrEqual(52.3);
  });
});
