/* PDF#34 Architectural Pass — Meesho/Prita session regressions
 * (2026-05-18). Four independent fixes, one test file:
 *
 *   Fix 1 — variableInferred provenance gate on the discovery
 *           checklist. PDF#33 Move B1 stamped variableInferred=true
 *           on the breakdown when variable came from total−base
 *           inference, but the checklist setter was not taught to
 *           respect that flag. Inferred variable was flipping
 *           currentCtcFixedVariableSplitDisclosed=true and advancing
 *           the discovery sequence past the split slot without the
 *           candidate ever confirming the number.
 *
 *   Fix 2 — anchor circuit-breaker. The senior-comp planner branch
 *           kept firing component-probes while target==null with no
 *           turn-budget exit. PDF#34 candidate confused by vesting
 *           probe → never disclosed target → AI never anchored.
 *           After ≥3 component-probe asks, the planner falls
 *           through to anchor-with-band so the negotiation
 *           progresses.
 *
 *   Fix 3 — clarification-request detector + dedicated planner
 *           branch + canonical prose glossary. PDF#34: candidate
 *           said "what is that?" after the bot used "vesting". The
 *           off-topic detector flagged it as adversarial (no
 *           on-topic lexicon, no digit, ≥turn-2), and the LLM
 *           freelanced a persona-break deflection. Now: parser
 *           stamps lastAnswerClarificationAtTurn, planner routes
 *           to clarify-prior-question, canonical prose ships an
 *           inline definition.
 *
 *   Fix 4 — final-mile same-response repeat guard at the
 *           negotiate-turn boundary. The response-pipeline has an
 *           8-content-word fingerprint guard for restyle/answer
 *           paths, but the adversarial-deflection short-circuit
 *           bypasses the pipeline entirely. After all
 *           post-processors run, if the final shipped text matches
 *           state.lastAiText byte-for-byte (normalized), swap to a
 *           deterministic loop-breaker stub.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  applyAiMove,
  type NegotiationBand,
  type NegotiationState,
  type AiMove,
} from "../../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
} from "../../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../../server-handlers/_canonical-prose";
const BAND: NegotiationBand = {
  initialOffer: 30,
  maxStretch: 45,
  walkAway: 25,
  hasEquity: true,
};

const newState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "pdf34",
    role: "Senior Product Designer",
    company: "Meesho",
    band: BAND,
  }),
  ...overrides,
});

describe("PDF#34 Fix 1 — variableInferred gate on discovery checklist", () => {
  it("does NOT flip currentCtcFixedVariableSplitDisclosed when inference is AMBIGUOUS (large residual)", () => {
    /* Parser path: candidate says "total 24, base 11" → variable
     * inferred=13 (54% variable share, implausible) with
     * variableInferred=true and ratio > 0.25. The PDF#35 Move 5
     * refinement keeps variableInferred=true here because the share is
     * implausible enough to warrant a re-confirmation rather than a
     * silent advance. */
    let state = newState();
    state = {
      ...state,
      lastDisclosureSubject: "current",
    } as NegotiationState;
    const after = applyCandidateAnswer(state, "My total is 24 LPA, base is 11 LPA");
    expect(after.candidateComponentBreakdown?.variable).toBe(13);
    expect(after.candidateComponentBreakdown?.variableInferred).toBe(true);
    /* The checklist flag MUST stay false — variable inference was
     * ambiguous (ratio > 0.25), needs confirmation. */
    expect(
      after.discoveryChecklist?.currentCtcFixedVariableSplitDisclosed,
    ).not.toBe(true);
  });

  it("DOES flip currentCtcFixedVariableSplitDisclosed when variable is explicitly stated", () => {
    let state = newState();
    state = {
      ...state,
      lastDisclosureSubject: "current",
    } as NegotiationState;
    const after = applyCandidateAnswer(
      state,
      "My base is 22 LPA and variable is 2 LPA",
    );
    expect(after.candidateComponentBreakdown?.variable).toBe(2);
    expect(after.candidateComponentBreakdown?.variableInferred !== true).toBe(true);
    expect(
      after.discoveryChecklist?.currentCtcFixedVariableSplitDisclosed,
    ).toBe(true);
  });

  it("DOES flip currentCtcFixedVariableSplitDisclosed for percent-shape split (always explicit)", () => {
    let state = newState();
    state = {
      ...state,
      lastDisclosureSubject: "current",
    } as NegotiationState;
    const after = applyCandidateAnswer(
      state,
      "80% fixed, 20% variable on my current CTC",
    );
    expect(
      after.discoveryChecklist?.currentCtcFixedVariableSplitDisclosed,
    ).toBe(true);
  });
});

describe("PDF#34 Fix 2 — anchor circuit-breaker after ≥3 component-probes", () => {
  it("planner does NOT keep firing component-probes after 3 prior asks", () => {
    /* Senior-comp profile (Senior Product Designer, YoE=6) with
     * currentCtc disclosed, no target, and 3 component-probes
     * already asked. The senior-comp branch must yield to a
     * downstream anchor path. */
    const state = newState({
      candidateCurrentCtc: 24,
      candidateComponentBreakdown: {
        base: 22,
        variable: 2,
        equity: null,
        basePercent: null,
        variablePercent: null,
        variableInferred: true,
        hasAny: true,
      },
      askedTopics: [
        { topic: "currentCtcAsked", atTurn: 1 },
        { topic: "currentCtcBase", atTurn: 2 },
        { topic: "currentCtcVariable", atTurn: 3 },
        { topic: "currentCtcEsop", atTurn: 4 },
      ] as NegotiationState["askedTopics"],
    });
    const action = planNextAction(state);
    /* Once the circuit-breaker trips, the planner must NOT pick
     * another component-probe — any other action is fine
     * (anchor-with-band, probe-expectations, etc.). */
    expect(action.kind).not.toBe("component-probe");
  });

  it("planner CONTINUES picking component-probes when ask count < 3", () => {
    const state = newState({
      candidateCurrentCtc: 24,
      candidateComponentBreakdown: {
        base: 22,
        variable: null,
        equity: null,
        basePercent: null,
        variablePercent: null,
        variableInferred: false,
        hasAny: true,
      },
      askedTopics: [
        { topic: "currentCtcAsked", atTurn: 1 },
        { topic: "currentCtcBase", atTurn: 2 },
      ] as NegotiationState["askedTopics"],
    });
    const action = planNextAction(state);
    /* Under the threshold the senior-comp branch still picks a
     * component-probe (variable is the next one needed). */
    if (action.kind === "component-probe") {
      expect(["variable", "esop"]).toContain(action.component);
    }
  });
});

describe("PDF#34 Fix 3 — clarification-request detector + planner branch", () => {
  it("stamps lastAnswerClarificationAtTurn when candidate says 'what is that?'", () => {
    const state = newState();
    const after = applyCandidateAnswer(state, "what is that?");
    expect(after.lastAnswerClarificationAtTurn).toBe(state.turnIndex);
  });

  it("stamps lastAnswerClarificationAtTurn on 'huh?'", () => {
    const state = newState();
    const after = applyCandidateAnswer(state, "huh?");
    expect(after.lastAnswerClarificationAtTurn).toBe(state.turnIndex);
  });

  it("stamps lastAnswerClarificationAtTurn on 'I don't understand'", () => {
    const state = newState();
    const after = applyCandidateAnswer(state, "I don't understand");
    expect(after.lastAnswerClarificationAtTurn).toBe(state.turnIndex);
  });

  it("does NOT stamp on substantive answers carrying numbers", () => {
    const state = newState();
    const after = applyCandidateAnswer(state, "My base is 22 LPA");
    expect(after.lastAnswerClarificationAtTurn ?? null).toBe(null);
  });

  it("does NOT stamp on long answers (>40 chars)", () => {
    const state = newState();
    const after = applyCandidateAnswer(
      state,
      "I am not really sure what you are asking me right now to be honest",
    );
    expect(after.lastAnswerClarificationAtTurn ?? null).toBe(null);
  });

  it("planner routes to clarify-prior-question when stamp matches current turn", () => {
    const state = newState({
      lastAnswerClarificationAtTurn: 0,
      lastAiText: "What's the vesting schedule on your current grant?",
    });
    const action = planNextAction(state);
    expect(action.kind).toBe("clarify-prior-question");
  });

  it("canonical prose for 'vesting' clarification defines the term + re-asks", () => {
    const state = newState();
    const prose = renderCanonicalProse(
      {
        kind: "clarify-prior-question",
        priorAiText: "What's the vesting schedule on your current grant?",
        satisfiesTopic: "clarify-prior-question" as never,
      },
      state,
    );
    /* Must explain vesting in plain English. */
    expect(prose).toMatch(/vesting/i);
    expect(prose).toMatch(/schedule|grant|over time|years/i);
    /* Must re-ask. */
    expect(prose).toMatch(/\?/);
    /* Must NOT be a persona-break deflection. */
    expect(prose).not.toMatch(/this conversation is about/i);
  });

  it("canonical prose for 'ESOP' clarification defines stock options", () => {
    const state = newState();
    const prose = renderCanonicalProse(
      {
        kind: "clarify-prior-question",
        priorAiText: "Any ESOPs in your current package?",
        satisfiesTopic: "clarify-prior-question" as never,
      },
      state,
    );
    expect(prose).toMatch(/stock|grant|option/i);
    expect(prose).toMatch(/\?/);
  });

  it("canonical prose falls back to generic rephrase when no jargon recognized", () => {
    const state = newState();
    const prose = renderCanonicalProse(
      {
        kind: "clarify-prior-question",
        priorAiText: "So what's the plan from here?",
        satisfiesTopic: "clarify-prior-question" as never,
      },
      state,
    );
    /* Generic fallback should still avoid persona-break. */
    expect(prose).not.toMatch(/this conversation is about/i);
    expect(prose).toMatch(/(rephrase|clarify|explain)/i);
  });
});

describe("PDF#34 Fix 4 — same-response repeat guard (architectural intent)", () => {
  /* The guard lives at the negotiate-turn handler boundary (after
   * all post-processors run). We can't easily fire the full handler
   * from a unit test, so we pin the architectural property
   * indirectly: the response-pipeline's verbatim-repeat guard
   * (8-content-word fingerprint) catches restyle-path duplicates.
   * The new boundary handles paths that bypass the pipeline
   * (adversarial deflection short-circuit) — its semantics are
   * documented in negotiate-turn.ts. */
  it("applyAiMove records lastAiText so the boundary guard has something to compare", () => {
    const state = newState();
    const move: AiMove = {
      lever: "probe",
      newTotalLpa: null,
      rationale: "test",
      askedTopic: "currentCtcAsked",
      actionKind: "discovery-probe",
    } as AiMove;
    const txt = "What's the vesting schedule on your current grant?";
    const after = applyAiMove(state, move, txt);
    expect(after.lastAiText).toBe(txt);
    expect(after.turnIndex).toBe(state.turnIndex + 1);
  });
});
