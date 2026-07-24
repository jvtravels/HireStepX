/* S55-B5 (2026-07-24) — double "Just to reconfirm" prefix.
 *
 * Root cause: applyAiMove wrote the full aiText (which may already
 * start with "Just to reconfirm —") into answeredQuestionLedger.
 * On a second reconfirm, the pipeline prepended "Just to reconfirm —"
 * again → "Just to reconfirm, Just to reconfirm, We have your current CTC…"
 *
 * Fix: strip any leading reconfirm prefix before storing in the ledger
 * so the stored answerText is always the clean answer body. */
import { describe, it, expect } from "vitest";
import { applyAiMove, initState, type NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 28,
  maxStretch: 38,
  walkAway: 22,
  hasEquity: false,
};

/* Setting actionKind: "round-transition" puts the move in NON_PROBE_ACTION_KINDS
 * so applyAiMove skips the DiscoveryTopic guard (no askedTopics push). The
 * ledger write we're testing is gated on lastTurnDelta.candidateAskedQuestion,
 * not on the lever class. */
const PROBE_MOVE = {
  lever: "hold-firm" as const,
  actionKind: "round-transition",
  newTotalLpa: null,
  rationale: "test",
};

describe("S55-B5 — answeredQuestionLedger strips reconfirm prefix", () => {
  it("stores clean answer (no prefix) when aiText starts with 'Just to reconfirm —'", () => {
    const s0 = initState({
      sessionId: "s-s55b5",
      role: "swe",
      company: "swiggy",
      band: BAND,
    });
    const stateWithQuestion = {
      ...s0,
      lastTurnDelta: {
        ...(s0.lastTurnDelta ?? {}),
        candidateAskedQuestion: { raw: "What is the joining bonus?", intent: "joining" as const },
      },
    };

    const firstReconfirmText = "Just to reconfirm — The joining bonus is ₹2L, paid on day 30.";
    const s1 = applyAiMove(stateWithQuestion, PROBE_MOVE, firstReconfirmText);

    const ledgerEntry = s1.answeredQuestionLedger?.["joining"];
    expect(ledgerEntry).toBeDefined();
    /* Stored text must NOT start with the reconfirm prefix. */
    expect(ledgerEntry?.answerText).not.toMatch(/^Just to reconfirm/i);
    /* Stored text should be the clean body. */
    expect(ledgerEntry?.answerText).toBe("The joining bonus is ₹2L, paid on day 30.");
  });

  it("does not strip non-reconfirm answers", () => {
    const s0 = initState({
      sessionId: "s-s55b5b",
      role: "swe",
      company: "swiggy",
      band: BAND,
    });
    const stateWithQuestion = {
      ...s0,
      lastTurnDelta: {
        ...(s0.lastTurnDelta ?? {}),
        candidateAskedQuestion: { raw: "What is equity like?", intent: "equity" as const },
      },
    };

    const normalText = "We have RSUs vesting over 4 years with a 1-year cliff.";
    const s1 = applyAiMove(stateWithQuestion, PROBE_MOVE, normalText);

    const ledgerEntry = s1.answeredQuestionLedger?.["equity"];
    expect(ledgerEntry?.answerText).toBe(normalText);
  });

  it("handles em-dash variant 'Just to reconfirm —'", () => {
    const s0 = initState({
      sessionId: "s-s55b5c",
      role: "swe",
      company: "swiggy",
      band: BAND,
    });
    const stateWithQuestion = {
      ...s0,
      lastTurnDelta: {
        ...(s0.lastTurnDelta ?? {}),
        candidateAskedQuestion: { raw: "What about team size?", intent: "team" as const },
      },
    };

    /* em-dash variant — same as the hyphen-based but with U+2014 */
    const emDashText = "Just to reconfirm — You'd be joining a 12-person backend team.";
    const s1 = applyAiMove(stateWithQuestion, PROBE_MOVE, emDashText);

    const ledgerEntry = s1.answeredQuestionLedger?.["team"];
    expect(ledgerEntry?.answerText).not.toMatch(/^Just to reconfirm/i);
    expect(ledgerEntry?.answerText).toBe("You'd be joining a 12-person backend team.");
  });

  it("handles comma variant 'Just to reconfirm, <body>'", () => {
    const s0 = initState({
      sessionId: "s-s55b5d",
      role: "swe",
      company: "swiggy",
      band: BAND,
    });
    const stateWithQuestion = {
      ...s0,
      lastTurnDelta: {
        ...(s0.lastTurnDelta ?? {}),
        candidateAskedQuestion: { raw: "How does WFH policy work?", intent: "wfh" as const },
      },
    };

    const commaText = "Just to reconfirm, we offer 3 WFH days per week.";
    const s1 = applyAiMove(stateWithQuestion, PROBE_MOVE, commaText);

    const ledgerEntry = s1.answeredQuestionLedger?.["wfh"];
    expect(ledgerEntry?.answerText).not.toMatch(/^Just to reconfirm/i);
    expect(ledgerEntry?.answerText).toBe("we offer 3 WFH days per week.");
  });
});
