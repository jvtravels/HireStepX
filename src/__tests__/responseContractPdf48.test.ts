/* PDF#48 regression — response contract.
 *
 * Each test pins one of the eight failure modes from the PDF#48
 * transcript (Karthik Nair / Flipkart / Senior Product Designer
 * salary-negotiation session, 2026-05-27 audit). The validator MUST
 * reject prose that exhibits the failure; the terminal-intent
 * classifier MUST catch the literal reject/withdraw/end utterances.
 *
 * If a new bug-class surfaces in a future PDF and the validator
 * passes its prose, the architectural seam is broken and a new
 * rule belongs in `_response-contract.ts` — NOT a new helper
 * module under server-handlers/_*. That's the whole point of this
 * file: failures of the seam regress here, not in production.
 */
import { describe, it, expect } from "vitest";
import {
  validateResponseContract,
  disclosedTopicsFromLog,
  contractFallbackProse,
} from "../../server-handlers/_response-contract";
import { detectTerminalIntent, gracefulCloseResponse } from "../../server-handlers/_terminal-intent";
import type { NegotiationState, AiMove, NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = { initialOffer: 30.4, maxStretch: 42.4, walkAway: 42.4, hasEquity: true };

function baseState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    sessionId: "s",
    role: "swe",
    company: "Flipkart",
    band: BAND,
    phase: "counter-offer",
    turnIndex: 6,
    highestOfferMade: 30.4,
    candidateTarget: 32,
    conversationLog: [],
    infoAsked: [],
    vossTacticsUsed: [],
    /* The kernel state has many other fields; cast through unknown
     * because the validator only reads a small subset. */
    ...overrides,
  } as unknown as NegotiationState;
}

const BASE_MOVE: AiMove = {
  lever: "explain-band-soft-cap",
  newTotalLpa: 30.4,
} as unknown as AiMove;

describe("PDF#48 — response contract", () => {
  describe("Layer 1 — walk-away leak (turn 11)", () => {
    it("rejects prose that discloses the walk-away figure", () => {
      const r = validateResponseContract({
        text: "The budget band for the role is between 30.4 LPA and 42.4 LPA.",
        move: BASE_MOVE,
        state: baseState(),
        candidateLastUtterance: "what's your budget?",
      });
      expect(r.ok).toBe(false);
      expect(r.violations).toContain("walk-away-leak");
    });

    it("allows the floor without the ceiling", () => {
      const r = validateResponseContract({
        text: "We're at ₹30.4 LPA for this fitment.",
        move: BASE_MOVE,
        state: baseState(),
        candidateLastUtterance: "what's the offer?",
      });
      /* May still trigger taxonomy ("fitment" alone is fine — only
       * "fitment band" is in the regex), but should NOT be a
       * walk-away leak. */
      expect(r.violations).not.toContain("walk-away-leak");
    });
  });

  describe("Layer 1 — internal taxonomy leak (turn 11)", () => {
    it("rejects 'market mode' parroting", () => {
      const r = validateResponseContract({
        text: "The market mode for the offer is soft, which means we have flexibility.",
        move: BASE_MOVE,
        state: baseState(),
        candidateLastUtterance: "can you provide 32 LPA?",
      });
      expect(r.ok).toBe(false);
      expect(r.violations).toContain("internal-taxonomy");
    });

    it("rejects 'walk-away' verbatim", () => {
      const r = validateResponseContract({
        text: "Our walk-away on this role is 42 LPA.",
        move: BASE_MOVE,
        state: baseState(),
        candidateLastUtterance: "?",
      });
      expect(r.ok).toBe(false);
      expect(r.violations.some(v => v === "internal-taxonomy" || v === "walk-away-leak")).toBe(true);
    });
  });

  describe("Layer 1 — filler / no-information (turn 8)", () => {
    it("rejects 'specifics determined by the company's overall compensation structure'", () => {
      const r = validateResponseContract({
        text: "The base split for this role is a mix of fixed and variable components, with specifics determined by the company's overall compensation structure.",
        move: BASE_MOVE,
        state: baseState(),
        candidateLastUtterance: "what is the base split?",
      });
      expect(r.ok).toBe(false);
      expect(r.violations).toContain("filler-non-answer");
    });
  });

  describe("Layer 3 — topic drift (turns 6, 7, 12, 13)", () => {
    it("rejects medical answer when asked for total CTC breakdown", () => {
      const r = validateResponseContract({
        text: "The standard medical cover includes family, self, and parents — it's group-policy. What else would you like us to confirm?",
        move: BASE_MOVE,
        state: baseState(),
        candidateLastUtterance: "That's what I'm asking — can you provide the clear number of total CTC & breakdown",
      });
      expect(r.ok).toBe(false);
      expect(r.violations).toContain("topic-drift");
    });

    it("rejects benefits answer when asked 'is 32 in your budget?'", () => {
      const r = validateResponseContract({
        text: "Let's see how we can fit in additional benefits as per your requirements.",
        move: BASE_MOVE,
        state: baseState(),
        candidateLastUtterance: "so 32 LPA is in your budget?",
      });
      expect(r.ok).toBe(false);
      expect(r.violations).toContain("topic-drift");
    });

    it("allows a numeric on-topic answer", () => {
      const r = validateResponseContract({
        text: "The base is ₹20 LPA of the ₹30.4 LPA total fitment.",
        move: BASE_MOVE,
        state: baseState({
          conversationLog: [
            { speaker: "ai", text: "fitment 30.4" },
            { speaker: "candidate", text: "what is the base?" },
          ],
        }),
        candidateLastUtterance: "what is the base?",
      });
      expect(r.violations).not.toContain("topic-drift");
    });
  });

  describe("Layer 2 — terminal-intent classifier (turn 14)", () => {
    it("classifies 'I want to reject this offer' as reject-offer", () => {
      expect(detectTerminalIntent("yes meanwhile I want to reject this offer")).toBe("reject-offer");
    });

    it("classifies 'can we end the interview' as end-interview", () => {
      expect(detectTerminalIntent("can we end the interview")).toBe("end-interview");
    });

    it("classifies withdraw variants", () => {
      expect(detectTerminalIntent("I'm not interested")).toBe("withdraw");
      expect(detectTerminalIntent("withdraw my candidacy please")).toBe("withdraw");
    });

    it("does not false-positive on negotiation moves", () => {
      expect(detectTerminalIntent("this is too low for me")).toBeNull();
      expect(detectTerminalIntent("I am looking for 32 LPA")).toBeNull();
      expect(detectTerminalIntent("can you provide 32 LPA for this offer?")).toBeNull();
    });

    it("produces a graceful close response per intent", () => {
      expect(gracefulCloseResponse("reject-offer")).toMatch(/Understood/);
      expect(gracefulCloseResponse("withdraw")).toMatch(/withdrawn/);
      expect(gracefulCloseResponse("end-interview")).toMatch(/wrap/);
    });
  });

  describe("Layer 1 — terminal-intent ignored (defense in depth)", () => {
    it("rejects a benefits pitch when candidate said reject", () => {
      const r = validateResponseContract({
        text: "Beyond cash, the standard benefits include medical for self, family, and parents, plus term life and accidental coverage under our company group policy. What do you think of the overall fitment here?",
        move: BASE_MOVE,
        state: baseState(),
        candidateLastUtterance: "yes meanwhile I want to reject this offer",
      });
      expect(r.ok).toBe(false);
      expect(r.violations).toContain("terminal-intent-ignored");
    });
  });

  describe("Layer 4 — disclosed-topics memory (no state migration)", () => {
    it("derives covered topics from AI conversation log", () => {
      const state = baseState({
        conversationLog: [
          { speaker: "ai", text: "The standard medical cover includes family, self, and parents." },
          { speaker: "candidate", text: "ok" },
          { speaker: "ai", text: "PF is as per statute." },
        ],
      });
      const topics = disclosedTopicsFromLog(state);
      expect(topics).toContain("medical");
      expect(topics).toContain("pf");
    });
  });

  describe("contract fallback prose", () => {
    it("returns terminal-close prose when terminal-intent was ignored", () => {
      const p = contractFallbackProse(["terminal-intent-ignored"]);
      expect(p).toMatch(/wrap|Understood/);
    });

    it("returns deferral prose for walk-away leak", () => {
      const p = contractFallbackProse(["walk-away-leak"]);
      expect(p).toMatch(/confirm|come back|offer letter/);
    });

    it("returns deferral prose for filler", () => {
      const p = contractFallbackProse(["filler-non-answer"]);
      expect(p).toMatch(/concrete|specifics|in writing/i);
    });
  });
});
