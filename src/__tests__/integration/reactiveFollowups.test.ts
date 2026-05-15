/* Negotiation-flow redesign commit 4 (2026-05-15) — reactive-followup
 * rule table integration tests.
 *
 * Each test drives applyCandidateAnswer with a candidate utterance that
 * trips one reactive trigger, then asserts that planNextAction (cached
 * onto state.plannedNextAction by applyCandidateAnswer's finalize step)
 * emits the matching `reactive-followup` NextAction.
 *
 * Audit ref: /tmp/negotiation-flow-audit.md D2 + section C.2 + commit-plan
 * row E.4.
 *
 * Pattern: build state pre-disclosure, call applyCandidateAnswer with the
 * candidate utterance, inspect state.plannedNextAction.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  pickAiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";

const BAND: NegotiationBand = {
  initialOffer: 22,
  maxStretch: 30,
  walkAway: 18,
  hasEquity: true,
};

const fresh = (
  overrides: Partial<NegotiationState> = {},
): NegotiationState => ({
  ...initState({
    sessionId: "s-reactive-followups",
    role: "Software Engineer",
    company: "acme",
    band: BAND,
  }),
  ...overrides,
});

type Planned = {
  kind: string;
  ask?: string;
  topic?: string;
  trigger?: string;
};

const planned = (s: NegotiationState): Planned | null =>
  (s.plannedNextAction ?? null) as Planned | null;

describe("reactive follow-ups — planner gate (commit 4)", () => {
  it("30% variable share triggers variable-comfort probe", () => {
    /* Candidate volunteers current CTC with a 30% variable share —
     * 14L base + 6L variable = 20L total (30% variable). */
    const s = applyCandidateAnswer(
      fresh({ turnIndex: 1, phase: "opening" }),
      "My current CTC is ₹20L — base is 14L and variable is 6L.",
    );
    const p = planned(s);
    expect(p?.kind).toBe("reactive-followup");
    expect(p?.topic).toBe("variable-comfort");
    expect(p?.ask).toMatch(/variable is significant/);
    expect(p?.ask).toMatch(/comfort/);
  });

  it("low variable share does NOT trigger variable-comfort probe", () => {
    /* 18L base + 0.5L variable = ~2.7% variable. Far below the 25% bar. */
    const s = applyCandidateAnswer(
      fresh({ turnIndex: 1, phase: "opening" }),
      "Current CTC is ₹18.5L — 18L fixed, half a lakh variable.",
    );
    const p = planned(s);
    expect(p?.topic).not.toBe("variable-comfort");
  });

  it("vague competing offer triggers credibility probe", () => {
    const s = applyCandidateAnswer(
      fresh({ turnIndex: 1, phase: "opening" }),
      "I have another offer in the pipeline as well.",
    );
    const p = planned(s);
    expect(p?.kind).toBe("reactive-followup");
    expect(p?.topic).toBe("competing-credibility");
    expect(p?.ask).toMatch(/which company/i);
    expect(p?.ask).toMatch(/written offer|verbal/i);
  });

  it("90-day notice triggers buyout probe", () => {
    const s = applyCandidateAnswer(
      fresh({ turnIndex: 1, phase: "opening" }),
      "My notice period is 90 days.",
    );
    const p = planned(s);
    expect(p?.kind).toBe("reactive-followup");
    expect(p?.topic).toBe("notice-buyout");
    expect(p?.ask).toMatch(/buyout|locked in/i);
  });

  it("short notice does NOT trigger buyout probe", () => {
    const s = applyCandidateAnswer(
      fresh({ turnIndex: 1, phase: "opening" }),
      "I'm on a 30 day notice period.",
    );
    const p = planned(s);
    expect(p?.topic).not.toBe("notice-buyout");
  });

  it("1.4x expected with no value proof triggers hike-justification probe", () => {
    /* Pre-state has current 15L already disclosed (via prior turn);
     * this turn the candidate names a 21L expected → 40% jump. */
    const pre = fresh({
      turnIndex: 2,
      phase: "opening",
      candidateCurrentCtc: 15,
    });
    const s = applyCandidateAnswer(
      pre,
      "I'm looking for ₹21L total CTC for this role.",
    );
    const p = planned(s);
    expect(p?.kind).toBe("reactive-followup");
    expect(p?.topic).toBe("hike-justification");
    expect(p?.ask).toMatch(/justifies/);
  });

  it("candidate question triggers answer-direct (pauses checklist advance)", () => {
    const s = applyCandidateAnswer(
      fresh({ turnIndex: 1, phase: "opening" }),
      "Quick question — what's the fixed/variable split at your end?",
    );
    const p = planned(s);
    expect(p?.kind).toBe("reactive-followup");
    expect(p?.topic).toBe("answer-direct");
    expect(p?.trigger).toBe("askedQuestion");
  });

  it("fired topic does NOT re-fire in the same session", () => {
    /* Turn 1: candidate discloses notice; reactive emits notice-buyout. */
    const t1 = applyCandidateAnswer(
      fresh({ turnIndex: 1, phase: "opening" }),
      "My notice is 90 days.",
    );
    expect(planned(t1)?.topic).toBe("notice-buyout");

    /* AI consumes the move; askedTopic pushes into the ledger. */
    const move = pickAiMove(t1);
    expect(move.askedTopic).toBe("notice-buyout");
    const afterAi = applyAiMove(
      t1,
      move,
      "Got it — would your current employer entertain a buyout?",
    );
    expect(afterAi.reactiveFollowupsFired).toContain("notice-buyout");

    /* Turn 2: candidate re-mentions notice — the same trigger fires
     * via the delta, but the planner consults the ledger and skips it.
     * (Other reactive rules may fire on this turn — assert specifically
     * that notice-buyout doesn't return.) */
    const t2 = applyCandidateAnswer(
      afterAi,
      "Yeah, still 90 days of notice for me.",
    );
    expect(planned(t2)?.topic).not.toBe("notice-buyout");
  });

  it("askedTopic move flows through applyAiMove into reactiveFollowupsFired ledger", () => {
    const t1 = applyCandidateAnswer(
      fresh({ turnIndex: 1, phase: "opening" }),
      "Got another offer brewing as well.",
    );
    const p = planned(t1);
    expect(p?.topic).toBe("competing-credibility");

    const move = pickAiMove(t1);
    expect(move.actionKind).toBe("reactive-followup");
    expect(move.askedTopic).toBe("competing-credibility");

    const after = applyAiMove(t1, move, "Which company is that with?");
    expect(after.reactiveFollowupsFired).toEqual(["competing-credibility"]);
  });
});
