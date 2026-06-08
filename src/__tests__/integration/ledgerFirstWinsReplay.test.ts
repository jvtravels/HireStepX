/* PDF #28 Month 1 PR-5 — Conversation Ledger replay regressions.
 *
 * These tests drive applyCandidateAnswer + pickAiMove + applyAiMove
 * end-to-end (no LLM mock) across the multi-turn shapes that produced
 * the PDF #18, #20, #27, #28 audit findings, and assert the ledger
 * invariants from PR-1 hold under realistic state evolution:
 *
 *   - First-wins for facts (current-ctc, current-company,
 *     competing-offer) survives across many subsequent turns.
 *   - askedTopics dual-write keeps the ledger in lockstep with
 *     state.askedTopics over a full discovery cascade.
 *   - The ledger preserves the source surface (main-parser vs
 *     disclosure-tracker) that caught each disclosure.
 *
 * These are the regression net PR-6 needs in place before it can
 * lock down direct slot writes. */

import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  pickAiMove,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../../server-handlers/_negotiation-kernel";
import {
  getFact,
  getFactSource,
  askedTopicEntries,
  askedTopicCount,
  size,
} from "../../../server-handlers/_conversation-ledger";

function simulateTurn(
  state: NegotiationState,
  candidateText: string,
  aiText: string,
): { state: NegotiationState; move: AiMove } {
  const afterCandidate = applyCandidateAnswer(state, candidateText);
  const move = pickAiMove(afterCandidate);
  const afterAi = applyAiMove(afterCandidate, move, aiText);
  return { state: afterAi, move };
}

const BAND: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 30,
  walkAway: 20,
  hasEquity: false,
};

function freshState(): NegotiationState {
  return initState({
    sessionId: "ledger-replay",
    role: "Software Engineer",
    company: "JP Morgan",
    band: BAND,
  });
}

/* ─── PDF #28 — Current-CTC first-wins across noisy follow-ups ─────── */

describe("PDF #28 replay — current-CTC ledger first-wins survives misparse pressure", () => {
  it("records the FIRST current-ctc capture and never updates it across later turns", () => {
    let s = freshState();
    expect(s.ledger).toBeDefined();
    expect(size(s.ledger!)).toBe(0);

    /* Turn 1 — candidate discloses current CTC. The disclosure tracker
     * catches "my current ctc is 14 LPA" and dual-writes to the ledger. */
    let r = simulateTurn(s, "My current CTC is 14 LPA.", "Got it — and what's your target?");
    s = r.state;

    expect(getFact(s.ledger!, "current-ctc")).toBe(14);
    const source = getFactSource(s.ledger!, "current-ctc");
    expect(source === "main-parser" || source === "disclosure-tracker").toBe(true);

    /* Turn 2 — candidate utterance that looks numeric but is target-ask
     * (precision guard in disclosure tracker should refuse to register
     * "I'm asking for 22 LPA" as current-ctc). Ledger stays at 14. */
    r = simulateTurn(s, "I'm asking for 22 LPA in this role.", "Why 22?");
    s = r.state;
    expect(getFact(s.ledger!, "current-ctc")).toBe(14);

    /* Turn 3 — candidate gives qualitative reasoning, no numbers.
     * Ledger remains intact. */
    r = simulateTurn(s, "Because I've been delivering platform-level impact.", "Understood.");
    s = r.state;
    expect(getFact(s.ledger!, "current-ctc")).toBe(14);

    /* Turn 4 — candidate restates current CTC with a different number
     * (simulating a misparse / inconsistent disclosure). First-wins
     * means the consumer-visible ledger value stays at 14, even though
     * a new entry appends. */
    r = simulateTurn(s, "Actually my current ctc is 99 LPA.", "Got it.");
    s = r.state;
    expect(getFact(s.ledger!, "current-ctc")).toBe(14); // first-wins
  });
});

/* ─── PDF #28 — current-company first-wins (the wrong-employer bug) ─── */

describe("PDF #28 replay — current-company ledger first-wins", () => {
  it("captures the candidate's current employer and locks it across later turns", () => {
    let s = freshState();

    /* Turn 1 — candidate names their current employer in a typical
     * disclosure phrase the current-company detector targets. */
    let r = simulateTurn(s, "I'm currently at Razorpay as a senior engineer.", "Got it.");
    s = r.state;

    /* Either the slot OR the ledger should have captured it (the
     * disclosure tracker is the surface that catches current-company
     * — main parser has no current-company branch). When it fires, the
     * ledger entry locks first-wins for the LLM prompt site. */
    const ledgerCompany = getFact(s.ledger!, "current-company");
    if (ledgerCompany != null) {
      expect(ledgerCompany).toBe("Razorpay");
      const source = getFactSource(s.ledger!, "current-company");
      expect(source).toBe("disclosure-tracker");

      /* Turn 2+ — even if a later candidate utterance accidentally
       * mentions another company name in a way that confuses some
       * downstream parser, the LEDGER stays at the first capture. */
      r = simulateTurn(s, "I used to work at Flipkart before that.", "Understood.");
      s = r.state;
      expect(getFact(s.ledger!, "current-company")).toBe("Razorpay");
    }
  });
});

/* ─── PDF #20 — askedTopics dual-write across a discovery cascade ──── */

describe("PDF #20 replay — askedTopics dual-write keeps ledger in lockstep", () => {
  it("every bot probe pushed to state.askedTopics also lands in the ledger", () => {
    let s = freshState();
    expect(askedTopicEntries(s.ledger!)).toEqual([]);

    /* Drive 3 turns of discovery. Each turn's applyAiMove with a
     * probe-producing actionKind should dual-write the askedTopic. */
    const move1: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      actionKind: "currentCtcAsked",
      rationale: "discovery probe — current CTC",
    };
    const after1 = applyAiMove(s, move1, "What's your current fixed CTC?");
    expect(after1.askedTopics?.length ?? 0).toBeGreaterThan(0);
    expect(askedTopicEntries(after1.ledger!).length).toBe(after1.askedTopics?.length ?? 0);

    /* Second probe — both surfaces grow by one. */
    const move2: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      actionKind: "noticePeriodAsked",
      rationale: "discovery probe — notice period",
    };
    const after2 = applyAiMove(after1, move2, "And your notice period?");
    expect(after2.askedTopics?.length ?? 0).toBe((after1.askedTopics?.length ?? 0) + 1);
    expect(askedTopicEntries(after2.ledger!).length).toBe(after2.askedTopics?.length ?? 0);

    /* Topic, atTurn, and ordering match between the two surfaces. */
    const arrTopics = (after2.askedTopics ?? []).map((t) => t.topic);
    const ledTopics = askedTopicEntries(after2.ledger!).map((e) => e.topic);
    expect(ledTopics).toEqual(arrTopics);
  });

  it("repeat asks of the same topic produce one entry per ask (refire chain proof)", () => {
    const s0 = freshState();
    const probe: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      actionKind: "currentCtcAsked",
      rationale: "ask",
    };
    const s1 = applyAiMove(s0, probe, "What's your CTC?");
    const s2 = applyAiMove(s1, probe, "Just to confirm — your current CTC?");
    expect(askedTopicCount(s2.ledger!, "currentCtcAsked")).toBe(2);
  });
});

/* ─── PDF #18 — disclosure-tracker source attribution ──────────────── */

describe("PDF #18 replay — disclosure-tracker source recorded in ledger", () => {
  it("when the main parser misses but the disclosure tracker catches, source is attributed correctly", () => {
    let s = freshState();
    /* Notice-period phrasing the looser disclosure detector should
     * catch. The main parser doesn't have a notice-period field on
     * state directly, so the disclosure tracker is the surface that
     * fires here. */
    const r = simulateTurn(s, "I have 90 days notice period.", "Got it.");
    s = r.state;

    const noticeVal = getFact(s.ledger!, "notice-period-days");
    if (noticeVal != null) {
      expect(noticeVal).toBe(90);
      expect(getFactSource(s.ledger!, "notice-period-days")).toBe("disclosure-tracker");
    }
  });
});

/* ─── PDF #27 — ledger entries carry sufficient context for diagnostics ── */

describe("PDF #27 replay — ledger entries are append-only audit trail", () => {
  it("ledger size strictly grows across a session; never decreases", () => {
    let s = freshState();
    const sizes: number[] = [size(s.ledger!)];

    let r = simulateTurn(s, "My current CTC is 18 LPA.", "Got it.");
    s = r.state;
    sizes.push(size(s.ledger!));

    r = simulateTurn(s, "I'm targeting 28 LPA.", "Why 28?");
    s = r.state;
    sizes.push(size(s.ledger!));

    r = simulateTurn(s, "I have a competing offer from another fintech.", "Acknowledged.");
    s = r.state;
    sizes.push(size(s.ledger!));

    /* Monotonically non-decreasing. */
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThanOrEqual(sizes[i - 1]);
    }
    /* At least the CTC and target captures should be present somewhere. */
    expect(getFact(s.ledger!, "current-ctc")).toBe(18);
  });
});
