/* User-reported Flipkart transcript (2026-05-22) — three bugs:
 *   1. T11/T13: candidate asked twice for the ₹41 LPA offer breakdown
 *      ("Can you share the breakdown of 41 LPA offer", "what is base,
 *      variable, bonus"); bot refused both times with "broadly aligned"
 *      filler. The ctc-inflation-truth lever was the only path that
 *      could ship a real breakdown and it was gated on a prior
 *      ctc-inflation-anchor lever firing, which never happens for a
 *      plain anchor-with-offer turn.
 *   2. T17/T19: byte-identical "Coming back to the structure — okay.
 *      Happy to address that — let me come back to where we were."
 *      twice in a row. The defer text bypassed at least one path's
 *      verbatim-repeat guard.
 *   3. T16 "can you summarize the offer again please" — no recap
 *      because classifyCandidateQuestion didn't match summari[sz]e or
 *      "breakdown" tokens.
 *
 * Fixes shipped:
 *   - `INTENT_PATTERNS["fixed-variable-split"]` widened to include
 *     `breakdown`, `breakup`, `summari[sz]e the offer`, `recap the
 *     offer`, `what is base`, `base, variable, bonus`, `share the
 *     breakdown/structure/components`.
 *   - Planner has a new offer-breakdown disclosure branch downstream
 *     of the inflation-truth branch: fires on ANY breakdown request
 *     when `highestOfferMade > 0` (or `band.initialOffer`), reusing
 *     `planCtcInflationTruth` (same numbers, honest framing).
 *   - Response-pipeline final boundary normalized-recent-prose de-dup:
 *     last 3 AI turns can't be byte-identical after normalization;
 *     dup → LOOP_BREAKER_STUB. */
import { describe, it, expect } from "vitest";
import {
  classifyCandidateQuestion,
} from "../../../server-handlers/_candidate-question";
import {
  detectOfferBreakdownRequest,
  detectInHandFollowupAfterInflation,
  planNextAction,
  BREAKDOWN_REQUEST_RE,
} from "../../../server-handlers/_next-action-planner";
import { classifyAcceptance } from "../../../server-handlers/_acceptance-classifier";
import { initState } from "../../../server-handlers/_negotiation-kernel";

describe("Flipkart 2026-05-22 — breakdown disclosure + repeat de-dup", () => {
  describe("classifyCandidateQuestion picks up breakdown / summarize tokens", () => {
    const cases: Array<[string, string]> = [
      ["Can you share the breakdown of 41 LPA offer", "fixed-variable-split"],
      ["but I need breakdown of this number, what is base, variable, bonus", "fixed-variable-split"],
      ["can you summarize the offer again please", "fixed-variable-split"],
      ["please summarise the offer", "fixed-variable-split"],
      ["share the structure of the offer", "fixed-variable-split"],
      ["share the components of the package", "fixed-variable-split"],
    ];
    for (const [text, expected] of cases) {
      it(`"${text}" → ${expected}`, () => {
        expect(classifyCandidateQuestion(text)).toBe(expected);
      });
    }
  });

  describe("detectOfferBreakdownRequest", () => {
    it("matches every phrasing from the user-reported transcript", () => {
      expect(detectOfferBreakdownRequest("Can you share the breakdown of 41 LPA offer")).toBe(true);
      expect(detectOfferBreakdownRequest("but I need breakdown of this number, what is base, variable, bonus")).toBe(true);
      expect(detectOfferBreakdownRequest("can you summarize the offer again please")).toBe(true);
      expect(detectOfferBreakdownRequest("what's the in-hand?")).toBe(true);
      expect(detectOfferBreakdownRequest("what's the split?")).toBe(true);
    });
    it("does not false-positive on neutral utterances", () => {
      expect(detectOfferBreakdownRequest("I like the offer")).toBe(false);
      expect(detectOfferBreakdownRequest("yes do it")).toBe(false);
      expect(detectOfferBreakdownRequest("")).toBe(false);
    });
    it("BREAKDOWN_REQUEST_RE is exported and matches request phrasings", () => {
      expect(BREAKDOWN_REQUEST_RE.test("share the breakdown")).toBe(true);
      expect(BREAKDOWN_REQUEST_RE.test("summarize the offer")).toBe(true);
      // Bare nouns alone (past-tense observations) should NOT match.
      expect(BREAKDOWN_REQUEST_RE.test("I've reviewed the breakup")).toBe(false);
    });
  });

  describe("acceptance classifier — 'I like the offer'", () => {
    it("classifies as accepted (medium)", () => {
      const r = classifyAcceptance("I like the offer", { offerOnTable: true });
      expect(r.accepted).toBe(true);
      expect(r.confidence).toBe("medium");
    });
  });

  describe("planner — offer-breakdown branch fires on breakdown request after a plain anchor", () => {
    it("ships ctc-inflation-truth shape when candidate asks for breakdown post-offer", () => {
      const state = initState({
        sessionId: "flipkart-breakdown-2026-05-22",
        company: "Flipkart",
        role: "Senior Product Designer",
        band: { initialOffer: 41, maxStretch: 50, walkAway: 35, hasEquity: true },
        recruiterPersona: "consultative",
        marketMode: "neutral",
      });
      // Simulate: bot anchored at 41 LPA (plain anchor-with-offer, NOT
      // ctc-inflation-anchor); candidate asks for the breakdown.
      state.highestOfferMade = 41;
      state.phase = "counter-offer";
      state.conversationLog = [
        { speaker: "ai", text: "So for this grade, the fitment we're able to offer is ₹41 LPA. The cash sits inside our band; ESOP grant is on top. Let me know your thoughts." },
        { speaker: "candidate", text: "Can you share the breakdown of 41 LPA offer" },
      ];
      state.turnIndex = 5;
      const action = planNextAction(state);
      expect(action.kind).toBe("ctc-inflation-truth");
      // Sanity: the action carries component numbers around ~41 LPA.
      const a = action as unknown as { ctcLpa: number; fixedLpa: number; variableLpa: number };
      expect(a.ctcLpa).toBe(41);
      expect(a.fixedLpa).toBeGreaterThan(20);
      expect(a.variableLpa).toBeGreaterThan(5);
    });
  });

  describe("inflation-truth gate still ONLY fires when inflation-anchor lever has been used", () => {
    it("returns false without the lever even if utterance matches", () => {
      const state = initState({
        sessionId: "flipkart-breakdown-2026-05-22",
        company: "Flipkart",
        role: "Senior Product Designer",
        band: { initialOffer: 41, maxStretch: 50, walkAway: 35, hasEquity: true },
        recruiterPersona: "consultative",
        marketMode: "neutral",
      });
      expect(detectInHandFollowupAfterInflation(state, "breakdown please")).toBe(false);
    });
  });
});
