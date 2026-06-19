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
    /* 2026-06-19 — a STRAIGHT fitment (no ctc-inflation-anchor weaponised)
     * must ship the `offer-breakdown` action (fixed/variable derived from
     * the SAME source-of-truth as the close-recap), NOT `ctc-inflation-
     * truth` (the 60/18/12/5/5 model that carves ESOP-paper OUT of the
     * headline). The old behaviour produced a turn-8 "guaranteed cash
     * ₹19.9L" that contradicted the turn-9 close-recap "Fixed ₹28.2L" for
     * the same ₹33.2L offer. */
    it("ships offer-breakdown (not ctc-inflation-truth) when candidate asks for breakdown over a STRAIGHT fitment", () => {
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
      expect(action.kind).toBe("offer-breakdown");
      const a = action as unknown as { totalLpa: number; fixedLpa: number; variableLpa: number };
      expect(a.totalLpa).toBe(41);
      // The straight-fitment split is fixed + variable = total (cash CTC),
      // NOT a 60% carve-out. fixed must be the dominant share.
      expect(a.fixedLpa).toBeGreaterThan(a.variableLpa);
      expect(Math.round((a.fixedLpa + a.variableLpa) * 10) / 10).toBe(41);
    });

    it("breakdown numbers match the close-recap split byte-for-byte (single source of truth)", async () => {
      const { deriveOfferFixedVariable } = await import(
        "../../../server-handlers/_next-action-planner"
      );
      const state = initState({
        sessionId: "consistency-2026-06-19",
        company: "Flipkart",
        role: "Senior Product Designer",
        band: { initialOffer: 33, maxStretch: 40, walkAway: 19, hasEquity: true, baseStretch: 28.2, variableMax: 6 },
        recruiterPersona: "consultative",
        marketMode: "neutral",
      });
      state.highestOfferMade = 33.2;
      state.phase = "closing-push";
      state.conversationLog = [
        { speaker: "ai", text: "Fitment is ₹33.2 LPA." },
        { speaker: "candidate", text: "what's the base vs variable split?" },
      ];
      state.turnIndex = 8;
      const action = planNextAction(state);
      expect(action.kind).toBe("offer-breakdown");
      const a = action as unknown as { fixedLpa: number; variableLpa: number };
      // The close-recap derives its split from the same helper — assert
      // the breakdown the candidate hears mid-negotiation IS what the
      // close-recap will later quote.
      const recap = deriveOfferFixedVariable(state, 33.2);
      expect(a.fixedLpa).toBe(Math.round(recap.fixedLpa * 10) / 10);
      expect(a.variableLpa).toBe(Math.round(recap.variableLpa * 10) / 10);
      // And specifically the live-repro numbers: fixed 28.2, NOT 19.9.
      expect(a.fixedLpa).toBe(28.2);
      expect(a.fixedLpa).not.toBe(19.9);
    });

    it("STILL ships ctc-inflation-truth when an inflation anchor WAS weaponised", () => {
      const state = initState({
        sessionId: "inflation-weaponised-2026-06-19",
        company: "Flipkart",
        role: "Senior Product Designer",
        band: { initialOffer: 41, maxStretch: 50, walkAway: 35, hasEquity: true },
        recruiterPersona: "consultative",
        marketMode: "neutral",
      });
      state.highestOfferMade = 41;
      state.phase = "counter-offer";
      // Inflation anchor fired this session.
      state.leversUsed = ["ctc-inflation-anchor"];
      state.ctcInflationAnchorCtcLpa = 41;
      state.conversationLog = [
        { speaker: "ai", text: "We can do ₹41L total package — ₹24.6L fixed, etc." },
        { speaker: "candidate", text: "Can you share the breakdown of 41 LPA offer" },
      ];
      state.turnIndex = 5;
      const action = planNextAction(state);
      expect(action.kind).toBe("ctc-inflation-truth");
    });
  });

  describe("audit-followup guards (2026-05-22 second pass)", () => {
    function postAnchorState() {
      const s = initState({
        sessionId: "flipkart-audit-2026-05-22",
        company: "Flipkart",
        role: "Senior Product Designer",
        band: { initialOffer: 41, maxStretch: 50, walkAway: 35, hasEquity: true },
        recruiterPersona: "consultative",
        marketMode: "neutral",
      });
      s.highestOfferMade = 41;
      s.phase = "counter-offer";
      s.turnIndex = 5;
      return s;
    }

    /* 2026-06-19 — these straight-fitment guards now assert the action is
     * NEITHER breakdown kind (a counter / non-cash ask must not be
     * mis-routed to either the inflation truth OR the straight-fitment
     * breakdown). */
    const BREAKDOWN_KINDS = ["ctc-inflation-truth", "offer-breakdown"];

    it("does NOT fire breakdown when candidate counters with BARE number ('I had 38 in mind')", () => {
      const s = postAnchorState();
      s.conversationLog = [
        { speaker: "ai", text: "Fitment is ₹41 LPA." },
        { speaker: "candidate", text: "I had 38 in mind, what's your 41 made of" },
      ];
      const action = planNextAction(s);
      expect(BREAKDOWN_KINDS).not.toContain(action.kind);
    });

    it("does NOT fire breakdown for counter-phrase 'looking for 45'", () => {
      const s = postAnchorState();
      s.conversationLog = [
        { speaker: "ai", text: "Fitment is ₹41 LPA." },
        { speaker: "candidate", text: "I'm looking for 45, can you share the breakdown" },
      ];
      const action = planNextAction(s);
      expect(BREAKDOWN_KINDS).not.toContain(action.kind);
    });

    it("does NOT fire CASH breakdown when candidate asks for EQUITY breakdown", () => {
      const s = postAnchorState();
      s.conversationLog = [
        { speaker: "ai", text: "Fitment is ₹41 LPA." },
        { speaker: "candidate", text: "Can you share the structure of the equity / RSU vesting?" },
      ];
      const action = planNextAction(s);
      expect(BREAKDOWN_KINDS).not.toContain(action.kind);
    });

    it("STILL fires breakdown for cash-keyword utterance ('what is base, variable, bonus')", () => {
      const s = postAnchorState();
      s.conversationLog = [
        { speaker: "ai", text: "Fitment is ₹41 LPA." },
        { speaker: "candidate", text: "what is base, variable, bonus" },
      ];
      const action = planNextAction(s);
      // Straight fitment (no inflation anchor) → offer-breakdown.
      expect(action.kind).toBe("offer-breakdown");
    });

    it("does NOT fire CASH breakdown when candidate asks about WFH days structure", () => {
      const s = postAnchorState();
      s.conversationLog = [
        { speaker: "ai", text: "Fitment is ₹41 LPA." },
        { speaker: "candidate", text: "what's the structure of the WFH days?" },
      ];
      const action = planNextAction(s);
      expect(BREAKDOWN_KINDS).not.toContain(action.kind);
    });

    it("does NOT fire CASH breakdown when candidate asks about team / reporting structure", () => {
      const s = postAnchorState();
      s.conversationLog = [
        { speaker: "ai", text: "Fitment is ₹41 LPA." },
        { speaker: "candidate", text: "can you share the structure of the team and reporting manager?" },
      ];
      const action = planNextAction(s);
      expect(BREAKDOWN_KINDS).not.toContain(action.kind);
    });
  });

  describe("trial-close response classification gates candidateSignaledClose (audit fix 2026-05-22)", () => {
    function trialCloseState() {
      const s = initState({
        sessionId: "trial-close-audit",
        company: "Flipkart",
        role: "SWE",
        band: { initialOffer: 22, maxStretch: 28, walkAway: 18, hasEquity: false },
      });
      s.phase = "counter-offer";
      s.highestOfferMade = 22;
      s.lastAiText = "If we land at ₹22 LPA, would you accept this offer today?";
      return s;
    }

    it("STAMPS candidateSignaledClose on explicit accept", async () => {
      const { applyCandidateAnswer } = await import(
        "../../../server-handlers/_negotiation-kernel"
      );
      const s = trialCloseState();
      const next = applyCandidateAnswer(s, "Yes, I accept the offer.");
      expect(
        (next as typeof next & { candidateSignaledClose?: boolean })
          .candidateSignaledClose,
      ).toBe(true);
    });

    it("does NOT stamp candidateSignaledClose on hedge ('I'd be comfortable if you can do 24')", async () => {
      const { applyCandidateAnswer } = await import(
        "../../../server-handlers/_negotiation-kernel"
      );
      const s = trialCloseState();
      const next = applyCandidateAnswer(s, "I'd be comfortable if you can do 24 LPA");
      expect(
        (next as typeof next & { candidateSignaledClose?: boolean })
          .candidateSignaledClose,
      ).toBeFalsy();
      expect(next.reactiveFollowupsFired ?? []).toContain(
        "candidate-trial-close-hedge",
      );
    });

    it("does NOT stamp candidateSignaledClose on decline ('I'll pass')", async () => {
      const { applyCandidateAnswer } = await import(
        "../../../server-handlers/_negotiation-kernel"
      );
      const s = trialCloseState();
      const next = applyCandidateAnswer(s, "I'll pass on this one.");
      expect(
        (next as typeof next & { candidateSignaledClose?: boolean })
          .candidateSignaledClose,
      ).toBeFalsy();
      expect(next.reactiveFollowupsFired ?? []).toContain(
        "candidate-trial-close-decline",
      );
    });

    it("does NOT stamp candidateSignaledClose on ambiguous response ('let me think')", async () => {
      const { applyCandidateAnswer } = await import(
        "../../../server-handlers/_negotiation-kernel"
      );
      const s = trialCloseState();
      const next = applyCandidateAnswer(s, "let me think about it");
      expect(
        (next as typeof next & { candidateSignaledClose?: boolean })
          .candidateSignaledClose,
      ).toBeFalsy();
    });
  });

  describe("normalized-recent-prose dedup handles punctuation variance", () => {
    /* The dedup compares last-3-AI-turns after normalization. Variants
     * differing ONLY by em-dash/comma/colon swap must collapse. We
     * exercise the helper indirectly by importing the response-pipeline
     * and verifying the rotation-repeat detector treats them as same. */
    it("collapses '—' vs ',' vs ':' variants to the same key", async () => {
      const { isLeadingAckRotationRepeat } = await import(
        "../../../server-handlers/_response-pipeline"
      );
      const a = "Coming back to the structure — okay. Happy to address that — let me come back.";
      const b = "Coming back to the structure, okay. Happy to address that, let me come back.";
      const c = "Coming back to the structure: okay. Happy to address that: let me come back.";
      expect(isLeadingAckRotationRepeat(a, b)).toBe(true);
      expect(isLeadingAckRotationRepeat(a, c)).toBe(true);
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
