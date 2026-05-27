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

  /* 2026-05-27 follow-up — gap-closing regressions. */
  describe("Layer 4 enforcement — repeated-topic violation", () => {
    it("rejects re-explanation of a topic already covered (candidate didn't ask)", () => {
      const state = baseState({
        conversationLog: [
          { speaker: "ai", text: "The standard medical cover includes family, self, and parents — group policy." },
          { speaker: "candidate", text: "ok" },
          { speaker: "ai", text: "PF is as per statute." },
          { speaker: "candidate", text: "what's the base?" },
        ],
      });
      const r = validateResponseContract({
        text: "The medical insurance covers family, self, and parents under a group medical policy. The medical cover is comprehensive.",
        move: BASE_MOVE,
        state,
        candidateLastUtterance: "what's the base?",
      });
      expect(r.ok).toBe(false);
      expect(r.violations).toContain("repeated-topic");
    });

    it("allows re-confirmation when the candidate asked again", () => {
      const state = baseState({
        conversationLog: [
          { speaker: "ai", text: "The standard medical cover includes family, self, and parents." },
        ],
      });
      const r = validateResponseContract({
        text: "The medical cover does include parents, yes — group medical policy. Family medical + parents medical, full coverage.",
        move: BASE_MOVE,
        state,
        candidateLastUtterance: "can you confirm the medical cover includes parents?",
      });
      expect(r.violations).not.toContain("repeated-topic");
    });
  });

  describe("Role-reversal violation", () => {
    it("rejects bouncing a direct question back as another question", () => {
      const r = validateResponseContract({
        text: "What aspect of the offer would you like to discuss? Are you looking at base, or total?",
        move: BASE_MOVE,
        state: baseState(),
        candidateLastUtterance: "what is the base?",
      });
      expect(r.ok).toBe(false);
      expect(r.violations).toContain("role-reversal");
    });

    it("allows answer-then-ask (answer first, ask second)", () => {
      const r = validateResponseContract({
        text: "The base is ₹20 LPA of the ₹30.4 LPA total. Does that work for your end?",
        move: BASE_MOVE,
        state: baseState({
          conversationLog: [
            { speaker: "ai", text: "fitment 30.4" },
            { speaker: "candidate", text: "what is the base?" },
          ],
        }),
        candidateLastUtterance: "what is the base?",
      });
      expect(r.violations).not.toContain("role-reversal");
    });

    it("allows a clean deferral (no question, no number, but an explicit defer)", () => {
      const r = validateResponseContract({
        text: "Let me come back to you with the exact base number in writing before the offer letter.",
        move: BASE_MOVE,
        state: baseState(),
        candidateLastUtterance: "what is the base?",
      });
      expect(r.violations).not.toContain("role-reversal");
    });
  });

  describe("Topic-drift — false-positive reduction", () => {
    it("allows a CTC-breakdown answer that incidentally mentions medical once", () => {
      const r = validateResponseContract({
        text: "The total CTC of ₹30.4 LPA breaks down as ₹20 LPA base, ₹4 LPA variable, ₹4 LPA ESOP, ₹2 LPA fixed cash, plus medical and PF on top.",
        move: BASE_MOVE,
        state: baseState(),
        candidateLastUtterance: "can you give me the CTC breakdown?",
      });
      /* Response is dominantly about base/variable/esop/fixed-cash —
       * a single mention of medical should not trigger drift. */
      expect(r.violations).not.toContain("topic-drift");
    });
  });

  describe("Expanded terminal-intent patterns", () => {
    it("catches 'I'm gonna have to say no'", () => {
      expect(detectTerminalIntent("I'm gonna have to say no")).toBe("reject-offer");
    });

    it("catches 'this isn't going to work for me'", () => {
      expect(detectTerminalIntent("this isn't going to work for me")).toBe("reject-offer");
    });

    it("catches 'I'll have to pass'", () => {
      expect(detectTerminalIntent("yeah, I'll have to pass")).toBe("reject-offer");
    });

    it("catches 'take myself out of the process'", () => {
      expect(detectTerminalIntent("I'm going to take myself out of the process")).toBe("withdraw");
    });

    it("still does not false-positive on negotiation moves", () => {
      expect(detectTerminalIntent("this number isn't going to work for the base alone")).toBeNull();
    });
  });

  describe("Fallback prose for new violations", () => {
    it("returns a forward-motion answer for role-reversal", () => {
      const p = contractFallbackProse(["role-reversal"]);
      expect(p).toMatch(/confirm|in writing|share/i);
    });

    it("returns a topic-acknowledge fallback for repeated-topic", () => {
      const p = contractFallbackProse(["repeated-topic"]);
      expect(p).toMatch(/covered|earlier|specifics/i);
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
