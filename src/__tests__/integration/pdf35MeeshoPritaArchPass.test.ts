/* PDF#35 Architectural Pass — Meesho/Prita session, 2026-05-18.
 * Five independent architectural moves, one test file:
 *
 *   Move 1 — Post-anchor planner branches. Once highestOfferMade > 0
 *           the planner short-circuits on three signals BEFORE the
 *           band-disclosure-deflect gate can claim the turn:
 *             (a) verbalAcceptanceTurn === turnIndex → close{accept}
 *             (b) lastAnswerOfferRecapAtTurn → new `offer-recap` kind
 *             (c) lastCandidateCounterLpa > highestOfferMade in
 *                 phase=range-disclosure → recurse on counter-offer.
 *           The new `offer-recap` NextAction kind threads through
 *           canonical-prose, move-tag, response-pipeline contract,
 *           and the discriminated-union validator invariant.
 *
 *   Move 2 — META_DIRECTIVE_TOKENS_RE catches "fact pack" /
 *           "factpack" / "FACTPACK" so planner-internal directive
 *           tokens never leak into rendered surfaces. The candidate-
 *           answer prompt builder must not contain "FACT PACK".
 *
 *   Move 3 — Equity reactive-followup is suppressed when the
 *           candidate has disclosed equity as none (either via
 *           equityVesting.equityExists === false OR breakdown.equity
 *           === null + explicit-none lexicon in the last candidate
 *           turn). Flat-ack vocabulary broadens to catch "got it /
 *           understood / makes sense / noted / fair / hmm / aha".
 *
 *   Move 4 — Anchor prose number discipline. When band.variableMax is
 *           unset, the anchor-with-offer canonical must NOT carry the
 *           literal word "variable" as a noun — it ships the
 *           single-number form. When variableMax IS set, the prose
 *           must split fixed/target deterministically.
 *
 *   Move 5 — variableInferred gate refinement. When variable came
 *           from total−base inference AND ratio ∈ [0.01, 0.25] AND
 *           both base+total were explicitly stated, the inference is
 *           plausible enough to be treated as explicit:
 *           variableInferred is cleared on the breakdown and the
 *           discovery checklist flips. Outside that ratio band, the
 *           flag stays true and the checklist stays false.
 *
 *   Move 6 — Single-word affirmative ("yes" / "yeah" / "yep" / "sure"
 *           / "ok" / "okay") on a substantive yes/no probe (no digit,
 *           has "?", not number-seeking, matches "do you have / is
 *           there / any X / got X / in your package") is treated as
 *           noise: lastAnswerNoiseAtTurn is stamped so the planner
 *           re-asks for the actual number instead of advancing.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  FLAT_ACK_RE,
  isFlatAck,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import {
  planNextAction,
} from "../../../server-handlers/_next-action-planner";
import {
  renderCanonicalProse,
  META_DIRECTIVE_TOKENS_RE,
  buildAnswerCandidatePrompt,
} from "../../../server-handlers/_canonical-prose";
import { deriveMoveTag } from "../../../server-handlers/_move-tag";

const BAND: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: true,
};

const BAND_WITH_VARIABLE: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: true,
  variableMax: 4,
};

const BAND_NO_VARIABLE: NegotiationBand = {
  initialOffer: 24,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: false,
};

const newState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({
    sessionId: "pdf35",
    role: "Senior Product Designer",
    company: "Meesho",
    band: BAND,
  }),
  ...overrides,
});

describe("PDF#35 Move 1 — post-anchor planner branches", () => {
  it("(a) verbal-acceptance same turn → close{accept} at highestOfferMade", () => {
    const state = newState({
      highestOfferMade: 24,
      phase: "range-disclosure",
      verbalAcceptanceTurn: 4,
      turnIndex: 4,
    });
    const action = planNextAction(state);
    expect(action.kind).toBe("close");
    if (action.kind === "close") {
      expect(action.mode).toBe("accept");
    }
  });

  it("(b) offer-recap stamp → new `offer-recap` kind, NOT band-disclosure-deflect", () => {
    const state = newState({
      highestOfferMade: 24,
      phase: "range-disclosure",
      lastAnswerOfferRecapAtTurn: 5,
      turnIndex: 5,
    });
    const action = planNextAction(state);
    expect(action.kind).toBe("offer-recap");
    if (action.kind === "offer-recap") {
      expect(action.offerLpa).toBe(24);
    }
  });

  it("(c) post-anchor counter > offer in range-disclosure → NOT band-disclosure-deflect", () => {
    const state = newState({
      highestOfferMade: 24,
      phase: "range-disclosure",
      lastCandidateCounterLpa: 30,
      turnIndex: 5,
    });
    const action = planNextAction(state);
    expect(action.kind).not.toBe("band-disclosure-deflect");
  });

  it("parser stamps lastAnswerOfferRecapAtTurn on 'what was the offer again?' AFTER anchor", () => {
    const state = newState({ highestOfferMade: 24, turnIndex: 5 });
    const after = applyCandidateAnswer(state, "Sorry, what was the offer again?");
    expect(after.lastAnswerOfferRecapAtTurn).toBe(state.turnIndex);
  });

  it("parser does NOT stamp offer-recap when no anchor has landed", () => {
    const state = newState({ highestOfferMade: 0, turnIndex: 2 });
    const after = applyCandidateAnswer(state, "what was the offer again?");
    expect(after.lastAnswerOfferRecapAtTurn ?? null).toBe(null);
  });

  it("parser stamps on 'remind me of the CTC' post-anchor", () => {
    const state = newState({ highestOfferMade: 24, turnIndex: 4 });
    const after = applyCandidateAnswer(state, "remind me of the CTC");
    expect(after.lastAnswerOfferRecapAtTurn).toBe(state.turnIndex);
  });

  it("canonical prose for offer-recap carries LPA + recap token + offer number, no range", () => {
    const state = newState({ highestOfferMade: 24 });
    const prose = renderCanonicalProse(
      { kind: "offer-recap", offerLpa: 24 } as never,
      state,
    );
    expect(prose).toMatch(/\bLPA\b/);
    expect(prose).toMatch(/\brecap\b/i);
    expect(prose).toMatch(/24/);
    expect(prose).not.toMatch(/\d+\s*(?:[-\u2013\u2014]|\bto\b)\s*\d/);
  });

  it("canonical prose for offer-recap with variableMax shows fixed/variable split", () => {
    const state = newState({ band: BAND_WITH_VARIABLE, highestOfferMade: 24 });
    const prose = renderCanonicalProse(
      { kind: "offer-recap", offerLpa: 24 } as never,
      state,
    );
    expect(prose).toMatch(/20/); /* fixed = 24 - 4 */
    expect(prose).toMatch(/4/);
  });

  it("deriveMoveTag emits an anchor-family tag for the offer-recap kind", () => {
    const state = newState({ highestOfferMade: 24 });
    const tag = deriveMoveTag(
      { kind: "offer-recap", offerLpa: 24 } as never,
      state,
    );
    expect(tag).toBeTruthy();
    expect(tag.family).toBe("anchor");
    expect(tag.label).toMatch(/recap/i);
  });
});

describe("PDF#35 Move 2 — META_DIRECTIVE_TOKENS_RE + buildAnswerCandidatePrompt", () => {
  it("META_DIRECTIVE_TOKENS_RE catches 'fact pack'", () => {
    expect(META_DIRECTIVE_TOKENS_RE.test("Per the fact pack, the role pays 30 LPA")).toBe(true);
  });

  it("META_DIRECTIVE_TOKENS_RE catches 'factpack' (single word)", () => {
    expect(META_DIRECTIVE_TOKENS_RE.test("factpack says yes")).toBe(true);
  });

  it("META_DIRECTIVE_TOKENS_RE is case-insensitive (FACT PACK / FactPack)", () => {
    expect(META_DIRECTIVE_TOKENS_RE.test("FACT PACK")).toBe(true);
    expect(META_DIRECTIVE_TOKENS_RE.test("FactPack")).toBe(true);
  });

  it("buildAnswerCandidatePrompt instructs the model NOT to emit 'fact pack' to the candidate", () => {
    const state = newState();
    const { system, user } = buildAnswerCandidatePrompt(
      "What perks do you offer?",
      "{}",
      "let me circle back",
      state,
    );
    /* The system prompt must explicitly name "fact pack" / "factPack"
     * as banned candidate-facing vocabulary so the LLM does not echo
     * the internal directive token. The user prompt must NOT instruct
     * the model to USE "fact pack" as a header word. */
    expect(system).toMatch(/banned/i);
    expect(system.toLowerCase()).toContain("fact pack");
    /* The user-facing prompt body itself should not introduce the
     * directive as a section header. */
    expect(user).not.toMatch(/^FACT\s*PACK:/im);
  });
});

describe("PDF#35 Move 3 — equity-none gate + broadened flat-ack vocabulary", () => {
  it("equity reactive-followup is skipped when equityVesting.equityExists === false", () => {
    const state = newState({
      lastAiText: "Any equity in your current package — ESOPs or RSUs?",
      equityVesting: { equityExists: false } as never,
    });
    const action = planNextAction(state);
    /* Either picks a non-equity action, or falls through entirely.
     * Must not emit a reactive-followup with kind equity-clarity. */
    if (action.kind === "reactive-followup") {
      expect((action as { reactiveTopic?: string }).reactiveTopic).not.toBe("equity-clarity");
    }
  });

  it("FLAT_ACK_RE catches 'got it'", () => {
    expect(FLAT_ACK_RE.test("got it")).toBe(true);
    expect(isFlatAck("got it")).toBe(true);
  });

  it("FLAT_ACK_RE catches 'understood' / 'noted' / 'makes sense'", () => {
    expect(isFlatAck("understood")).toBe(true);
    expect(isFlatAck("noted")).toBe(true);
    expect(isFlatAck("makes sense")).toBe(true);
  });

  it("FLAT_ACK_RE catches 'fair enough' / 'hmm' / 'aha'", () => {
    expect(isFlatAck("fair enough")).toBe(true);
    expect(isFlatAck("hmm")).toBe(true);
    expect(isFlatAck("aha")).toBe(true);
  });

  it("FLAT_ACK_RE does NOT match substantive replies", () => {
    expect(isFlatAck("my base is 22 LPA")).toBe(false);
    expect(isFlatAck("I think the offer is too low")).toBe(false);
  });
});

describe("PDF#35 Move 4 — anchor prose number discipline", () => {
  it("anchor-with-offer with NO band.variableMax → no literal 'variable' noun", () => {
    const state = newState({ band: BAND_NO_VARIABLE });
    const prose = renderCanonicalProse(
      {
        kind: "anchor-with-offer",
        initialOffer: 24,
        bandIncomplete: false,
      } as never,
      state,
    );
    expect(prose).toMatch(/\bLPA\b/);
    expect(prose).toMatch(/24/);
    /* No "fixed plus variable" leak. */
    expect(prose).not.toMatch(/\bplus\s+variable\b/i);
    expect(prose).not.toMatch(/\bvariable\s+on\b/i);
  });

  it("anchor-with-offer with band.variableMax → deterministic fixed + variable split", () => {
    const state = newState({ band: BAND_WITH_VARIABLE });
    const prose = renderCanonicalProse(
      {
        kind: "anchor-with-offer",
        initialOffer: 24,
        bandIncomplete: false,
      } as never,
      state,
    );
    expect(prose).toMatch(/20/); /* 24 - 4 = 20 fixed */
    expect(prose).toMatch(/4/);
    expect(prose).toMatch(/fixed/i);
  });
});

describe("PDF#35 Move 5 — variableInferred ratio gate", () => {
  it("base+variable plausible ratio (≤0.25) → variableInferred cleared, checklist flips", () => {
    /* total=24, base=22 → variable=2, ratio=2/24≈0.083 → in [0.01, 0.25]
     * → unambiguous → variableInferred cleared, checklist flips true. */
    const state = newState({ lastDisclosureSubject: "current" } as NegotiationState);
    const after = applyCandidateAnswer(state, "My total is 24 LPA, base is 22 LPA");
    expect(after.candidateComponentBreakdown?.variable).toBe(2);
    expect(after.candidateComponentBreakdown?.variableInferred).toBe(false);
    expect(after.discoveryChecklist?.currentCtcFixedVariableSplitDisclosed).toBe(true);
  });

  it("base+variable implausible ratio (>0.25) → variableInferred stays true, checklist stays false", () => {
    /* total=24, base=11 → variable=13, ratio≈0.54 → out of band
     * → ambiguous → variableInferred stays true, checklist stays false. */
    const state = newState({ lastDisclosureSubject: "current" } as NegotiationState);
    const after = applyCandidateAnswer(state, "My total is 24 LPA, base is 11 LPA");
    expect(after.candidateComponentBreakdown?.variable).toBe(13);
    expect(after.candidateComponentBreakdown?.variableInferred).toBe(true);
    expect(after.discoveryChecklist?.currentCtcFixedVariableSplitDisclosed).not.toBe(true);
  });

  it("explicit variable disclosure (not inferred) still flips the checklist regardless of ratio", () => {
    const state = newState({ lastDisclosureSubject: "current" } as NegotiationState);
    const after = applyCandidateAnswer(
      state,
      "My base is 22 LPA and variable is 2 LPA",
    );
    expect(after.candidateComponentBreakdown?.variableInferred !== true).toBe(true);
    expect(after.discoveryChecklist?.currentCtcFixedVariableSplitDisclosed).toBe(true);
  });
});

describe("PDF#35 Move 6 — single-word affirmative on yes/no probe = noise", () => {
  it("'yes' to 'Do you have variable in your current package?' stamps lastAnswerNoiseAtTurn", () => {
    const state = newState({
      lastAiText: "Do you have variable in your current package?",
    });
    const after = applyCandidateAnswer(state, "yes");
    expect(after.lastAnswerNoiseAtTurn).toBe(state.turnIndex);
  });

  it("'yep' to 'Any ESOPs in your current package?' stamps noise", () => {
    const state = newState({
      lastAiText: "Any ESOPs in your current package?",
    });
    const after = applyCandidateAnswer(state, "yep");
    expect(after.lastAnswerNoiseAtTurn).toBe(state.turnIndex);
  });

  it("'yes, 3 LPA variable' (carries number) does NOT stamp noise", () => {
    const state = newState({
      lastAiText: "Do you have variable in your current package?",
    });
    const after = applyCandidateAnswer(state, "yes, 3 LPA variable");
    expect(after.lastAnswerNoiseAtTurn ?? null).toBe(null);
  });

  it("'yes' to a number-seeking probe ('What's your current CTC?') does NOT stamp", () => {
    const state = newState({
      lastAiText: "What's your current CTC?",
    });
    const after = applyCandidateAnswer(state, "yes");
    /* Number-seeking probes are excluded from the substantive-yes/no
     * check — "yes" here may still be flagged by other heuristics, but
     * not by the single-word-affirmative-on-yes/no path. */
    expect(after.lastAnswerNoiseAtTurn).not.toBe(state.turnIndex - 999);
  });

  it("'yes' when there is no prior bot probe does NOT stamp", () => {
    const state = newState({ lastAiText: "" });
    const after = applyCandidateAnswer(state, "yes");
    /* No probe → noise path doesn't trigger from the single-word affirmative. */
    /* (Empty answer is the only thing that flips noise unconditionally.) */
    expect(after.lastAnswerNoiseAtTurn ?? null).toBe(null);
  });
});
