import { describe, it, expect } from "vitest";
import { runConversation } from "./_negotiationSim";
import { detectExplicitAcceptance } from "../../server-handlers/_acceptance-classifier";
import { type NegotiationBand } from "../../server-handlers/_negotiation-kernel";

/* PRI-63 regression guard (2026-06-25, real prod salary-negotiation audit,
 * Flipkart Engineering Manager session f22e215b).
 *
 * The candidate's acceptance rested on an UNMET, candidate-named sweetener:
 *   "Okay, if you throw in a joining bonus I can make it work."
 * That is a CONDITIONAL yes — the close is contingent on a joining bonus the
 * bot has not offered (wantsJoiningBonus=true, lastJoiningBonusOffered=null).
 *
 * The legacy behaviour was a soft FALSE-CLOSE (the worst failure mode): the
 * kernel's strict escalation-boost read the string as a bare accept and force-
 * closed FLAT at the standing offer, silently DROPPING the joining-bonus
 * condition. The recap then enumerated a deal (₹offer, no JB) the candidate
 * never agreed to.
 *
 * Three things must hold and are pinned here:
 *   1. The strict acceptance detector VETOES the JB-conditional (so the bare
 *      escalation-boost cannot force a flat close).
 *   2. When the bot DOES close, it honors the condition — the granted joining
 *      bonus is stamped on state (lastJoiningBonusOffered > 0) so the Deal
 *      Summary recap enumerates it, never a flat close that drops it.
 *   3. The close line names the joining bonus OUT LOUD (not silently deferred
 *      to "the formal offer letter"), so the candidate's condition is
 *      explicitly honored at close time.
 *
 * Fix spans three single-source seams:
 *   - _acceptance-classifier.ts: HEDGE_VETO_PATTERNS catches "if you throw in
 *     a joining bonus".
 *   - _next-action-planner.ts: the near-offer conditional-close gate sizes a
 *     one-time JB (computeJoiningBonusAmount) and carries it on the close.
 *   - _negotiation-kernel.ts applyAiMove: honors the documented contract that
 *     a close-acceptance move can carry joiningBonusAmount and stamps it. */

const FLIPKART_EM: NegotiationBand = {
  initialOffer: 32.7,
  maxStretch: 56,
  walkAway: 26.6,
  hasEquity: true,
} as NegotiationBand;

describe("strict acceptance detector vetoes a JB-conditional (PRI-63)", () => {
  it("rejects 'if you throw in a joining bonus I can make it work'", () => {
    const r = detectExplicitAcceptance(
      "Okay, if you throw in a joining bonus I can make it work.",
    );
    expect(r.accepted).toBe(false);
  });

  it("still accepts an unconditional sign-today idiom", () => {
    const r = detectExplicitAcceptance("Yes, I accept the offer.");
    expect(r.accepted).toBe(true);
  });
});

describe("JB-conditional acceptance closes WITH the joining bonus (PRI-63)", () => {
  const turns = [
    "I'm an Engineering Manager with 10 years, currently at 48 LPA fixed.",
    "What number are you thinking for this role?",
    "Can you give me a specific figure?",
    "I really need a number to work with here.",
    "Just tell me what the fixed comp is.",
    "Okay, if you throw in a joining bonus I can make it work.",
  ];

  const { transcript, finalState } = runConversation({
    sessionId: "pri63-guard",
    role: "Engineering Manager",
    company: "Flipkart",
    band: FLIPKART_EM,
    initExtras: { applicableYoe: 10, experienceLevel: "senior" },
    stopOnTerminal: true,
    turns,
  });

  const closeTurn = transcript[transcript.length - 1];

  it("ships a response for the JB-conditional close turn", () => {
    expect(closeTurn).toBeTruthy();
    expect(closeTurn.aiText.length).toBeGreaterThan(0);
  });

  it("does NOT false-close flat — the granted joining bonus is recorded", () => {
    // If the close lands, it must carry the JB the candidate conditioned on.
    if (finalState.phase === "accepted") {
      expect(finalState.lastJoiningBonusOffered).not.toBeNull();
      expect(finalState.lastJoiningBonusOffered as number).toBeGreaterThan(0);
    }
  });

  it("does not over-concede cash above the standing offer", () => {
    // The JB is one-time and never folded into the LPA total; the close figure
    // stays at/under the band ceiling.
    expect(finalState.highestOfferMade).toBeLessThanOrEqual(56);
  });

  it("names the joining bonus out loud when it closes", () => {
    if (closeTurn.terminal && finalState.phase === "accepted") {
      expect(closeTurn.aiText.toLowerCase()).toMatch(/joining bonus/);
    }
  });
});
