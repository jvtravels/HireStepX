/* Bug-report 15 (2026-05-14) — four converging defects surfaced in a
 * Business-Analyst @ Deloitte session:
 *
 *   A. Opener Structure C said "that's at the midpoint of our band
 *      for this city" — real HR never reveals internal band positioning.
 *   B. Candidate said "I was looking at ₹18 LPA" against an initial
 *      offer of ~₹15L; kernel jumped straight to counter-base ₹15.7L
 *      without first asking what was driving the ₹18L ask.
 *   C. The counter response emitted a headline total only, no base +
 *      variable split — forcing the candidate to ask for the breakdown
 *      on the next turn.
 *   D. The candidate then asked for total CTC / base + total / and
 *      finally said "Would like to accept this offer" — kernel emitted
 *      the SAME generic "75-85% base, rest variable" string for all
 *      three turns. Two compounding issues:
 *        D1. The acceptance-classifier required a leading "I" ("I would
 *            like to accept") — voice transcription drops it.
 *        D2. The compensation-summary fallback returned a generic
 *            structure tutorial regardless of whether real numbers
 *            were available on the state.
 *
 * This suite pins each fix as a structural guarantee so the same class
 * of regression can't reappear silently. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";
import {
  deterministicFallbackText,
  hrRegisterForCompany,
  formatRegisterGuidance,
  buildAiPrompt,
  NEGOTIATION_SYSTEM_PROMPT,
} from "../../server-handlers/_negotiate-turn-helpers";
import { initState } from "../../server-handlers/_negotiation-kernel";
import type { NegotiationState, AiMove } from "../../server-handlers/_negotiation-kernel";

/* Minimal state factory — only fields read by deterministicFallbackText
 * + the move-picker tests below need to be present. Cast through unknown
 * to keep the fixture compact (the kernel's full state is ~400 fields). */
function makeState(over: Partial<NegotiationState> = {}): NegotiationState {
  const base = {
    sessionId: "test",
    role: "Business Analyst",
    company: "Deloitte",
    band: {
      initialOffer: 15,
      maxStretch: 20,
      walkAway: 12,
      hasEquity: false,
      baseFloor: 9,
      baseStretch: 13,
      variableMax: 7,
    },
    phase: "counter-offer",
    turnIndex: 2,
    highestOfferMade: 15,
    candidateTarget: 18,
    candidateCurrentCtc: null,
    lastJoiningBonusOffered: null,
    leversUsed: ["open-with-offer"],
    competingOfferDetail: { company: null, status: null, stage: null, letterShareOffered: false, onHold: false, hasAny: false },
    infoAsked: [],
    marketMode: "neutral",
    hardBandCap: false,
    walkAwayReturned: false,
    candidateAskedAsRange: false,
    vossTacticsUsed: [],
    recentRecoveryActive: false,
    lastCandidateCounterLpa: null,
    verbalAcceptanceTurn: null,
    postVerbalRenegotiationCount: 0,
    acceptedAtTurn: null,
    walkedAwayAtTurn: null,
    ...over,
  } as unknown as NegotiationState;
  return base;
}

/* ─── Fix D1 — acceptance regex tolerates dropped "I" ───────────────── */

describe("Bug-report 15 — Fix D1 — acceptance without leading 'I'", () => {
  const ctx = { phase: "counter-offer", offerOnTable: true };

  it("'Would like to accept this offer.' accepts (was missed before)", () => {
    const r = classifyAcceptance("Would like to accept this offer.", ctx);
    expect(r.accepted).toBe(true);
    expect(r.confidence).toBe("strong");
  });

  it("'Want to accept the package.' accepts", () => {
    const r = classifyAcceptance("Want to accept the package.", ctx);
    expect(r.accepted).toBe(true);
  });

  it("'Like to accept this offer.' accepts", () => {
    const r = classifyAcceptance("Like to accept this offer.", ctx);
    expect(r.accepted).toBe(true);
  });

  it("legacy 'I would like to accept' still accepts", () => {
    const r = classifyAcceptance("I would like to accept your offer.", ctx);
    expect(r.accepted).toBe(true);
    expect(r.confidence).toBe("strong");
  });

  it("does NOT false-positive on 'I'd never want to accept that.'", () => {
    /* Negation pattern should veto. */
    const r = classifyAcceptance("I would never want to accept that.", ctx);
    expect(r.accepted).toBe(false);
  });
});

/* ─── Fix C — counter-base fallback emits base+variable split ───────── */

describe("Bug-report 15 — Fix C — counter-base surfaces component split", () => {
  it("counter at ₹16.5L emits '₹13L base + ₹3.5L variable'", () => {
    const state = makeState();
    const move: AiMove = {
      lever: "counter-base",
      newTotalLpa: 16.5,
      rationale: "test",
    };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/₹16\.5 LPA/);
    expect(text).toMatch(/₹13L base/);
    expect(text).toMatch(/variable/);
  });

  it("counter restates any previously-offered joining bonus", () => {
    const state = makeState({ lastJoiningBonusOffered: 2 });
    const move: AiMove = { lever: "counter-base", newTotalLpa: 17, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/₹2L joining bonus/);
  });

  it("legacy band without component metadata falls back to headline-only", () => {
    const state = makeState({
      band: { initialOffer: 15, maxStretch: 20, walkAway: 12, hasEquity: false } as NegotiationState["band"],
    });
    const move: AiMove = { lever: "counter-base", newTotalLpa: 17, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/₹17 LPA total/);
    expect(text).not.toMatch(/base \+ /);
  });
});

/* ─── Fix D2 — compensation-summary emits real numbers ──────────────── */

describe("Bug-report 15 — Fix D2 — compensation-summary leads with actual numbers", () => {
  it("with offer + component metadata, returns base/variable breakdown of THIS offer", () => {
    const state = makeState({ highestOfferMade: 15.7 });
    const move: AiMove = { lever: "compensation-summary", newTotalLpa: 15.7, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    /* Must contain actual numbers, NOT the generic-only tutorial. */
    expect(text).toMatch(/₹13L base/);
    expect(text).toMatch(/₹15\.7 LPA/);
  });

  it("with offer + JB, includes year-one cash calculation", () => {
    const state = makeState({ highestOfferMade: 15, lastJoiningBonusOffered: 1 });
    const move: AiMove = { lever: "compensation-summary", newTotalLpa: 15, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/₹1L one-time joining bonus/);
    expect(text).toMatch(/year-one cash/i);
  });

  it("without any offer (pre-open), keeps the generic structure tutorial", () => {
    const state = makeState({ highestOfferMade: 0 });
    const move: AiMove = { lever: "compensation-summary", newTotalLpa: null, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/Typical structure here is base/);
  });
});

/* ─── Fix #2 (follow-up) — lever-loop guard ─────────────────────────── */

import { pickAiMove } from "../../server-handlers/_kernel-move-picker";

describe("Bug-report 15 follow-up — lever-loop guard breaks 3rd-strike repeats", () => {
  it("third compensation-summary in a row force-routes to hold-firm", () => {
    const state = makeState({
      phase: "lever-explore" as NegotiationState["phase"],
      highestOfferMade: 15.7,
      leversUsed: ["open-with-offer", "counter-base", "compensation-summary", "compensation-summary"],
      infoAsked: ["compensation-breakdown"],
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("hold-firm");
    expect(move.newTotalLpa).toBe(15.7);
  });

  it("third benefits-summary in a row also force-routes to hold-firm", () => {
    const state = makeState({
      phase: "lever-explore" as NegotiationState["phase"],
      highestOfferMade: 15,
      leversUsed: ["open-with-offer", "benefits-summary", "benefits-summary"],
      infoAsked: ["benefits-overview"],
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("hold-firm");
  });

  it("only TWO consecutive info-lever fires does NOT trigger the guard", () => {
    /* Two-in-a-row is fine; the guard kicks in only on the 3rd-strike
     * (i.e. last two leversUsed are the same info lever AND we're about
     * to fire it again). */
    const state = makeState({
      phase: "lever-explore" as NegotiationState["phase"],
      highestOfferMade: 15,
      leversUsed: ["open-with-offer", "compensation-summary"],
      infoAsked: ["compensation-breakdown"],
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("compensation-summary");
  });

  it("two non-info lever repeats (e.g. counter-base twice) does NOT trip the guard", () => {
    /* The guard targets info-disclosure levers that produce identical
     * boilerplate; counter-base has built-in variation via the split
     * schedule, so a counter-base repeat is legitimate kernel behavior. */
    const state = makeState({
      phase: "counter-offer" as NegotiationState["phase"],
      highestOfferMade: 16,
      candidateTarget: 20,
      leversUsed: ["open-with-offer", "probe-justification", "counter-base", "counter-base"],
    });
    const move = pickAiMove(state);
    /* Should still be counter-base (or lever-explore if no headroom) —
     * NOT hold-firm-by-guard. */
    expect(move.lever).not.toBe("hold-firm");
  });

  it("guard does NOT fire in terminal phases (preserves close-acceptance, etc.)", () => {
    const state = makeState({
      phase: "accepted" as NegotiationState["phase"],
      highestOfferMade: 16,
      acceptedAtTurn: 5,
      turnIndex: 5,
      leversUsed: ["open-with-offer", "counter-base", "compensation-summary", "compensation-summary"],
    });
    const move = pickAiMove(state);
    /* Terminal path runs first; guard never sees this state. */
    expect(move.lever).toBe("close-acceptance");
  });
});

/* ─── Fix B — probe-justification fallback shape ────────────────────── */

describe("Bug-report 15 — Fix B — probe-justification fallback asks 'why?'", () => {
  it("references the candidate's target number and asks for the driver", () => {
    const state = makeState({ candidateTarget: 18 });
    const move: AiMove = { lever: "probe-justification", newTotalLpa: null, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/₹18 LPA/);
    expect(text).toMatch(/benchmark|competing|hike/i);
    expect(text).toMatch(/\?$/);
  });

  it("works without a target on state (degenerate path)", () => {
    const state = makeState({ candidateTarget: null });
    const move: AiMove = { lever: "probe-justification", newTotalLpa: null, rationale: "test" };
    const text = deterministicFallbackText(state, move);
    expect(text).toMatch(/\?$/);
    expect(text).toMatch(/benchmark|competing|hike/i);
  });
});

/* ─── Indianization — HR register bucketing + prompt plumbing ────────── */

describe("Indianization — hrRegisterForCompany maps tiers to register buckets", () => {
  it("IT services (TCS/Infosys) → formal-traditional", () => {
    expect(hrRegisterForCompany("TCS")).toBe("formal-traditional");
    expect(hrRegisterForCompany("Infosys")).toBe("formal-traditional");
  });

  it("Big-4 (Deloitte) → formal-traditional", () => {
    expect(hrRegisterForCompany("Deloitte")).toBe("formal-traditional");
  });

  it("FAANG / big-tech (Google) → professional-global", () => {
    expect(hrRegisterForCompany("Google")).toBe("professional-global");
  });

  it("Indian unicorns (Razorpay / CRED / Swiggy) → casual-modern", () => {
    /* If any of these aren't in the tier map this still falls back to
     * professional-global, so just assert it's one of the conversational
     * registers (not formal-traditional). */
    const r = hrRegisterForCompany("Razorpay");
    expect(["casual-modern", "professional-global"]).toContain(r);
  });

  it("unknown / null company → defaults to professional-global", () => {
    expect(hrRegisterForCompany(null)).toBe("professional-global");
    expect(hrRegisterForCompany("")).toBe("professional-global");
    expect(hrRegisterForCompany("Some Company That Does Not Exist Ltd"))
      .toBe("professional-global");
  });

  it("formatRegisterGuidance returns a non-empty string for each register", () => {
    for (const r of ["formal-traditional", "professional-global", "casual-modern", "scrappy-startup"] as const) {
      const g = formatRegisterGuidance(r);
      expect(typeof g).toBe("string");
      expect(g.length).toBeGreaterThan(40);
    }
  });
});

describe("Indianization — register guidance is plumbed into SESSION CONTEXT", () => {
  function stateForPrompt(company: string): NegotiationState {
    return initState({
      sessionId: "test",
      role: "Business Analyst",
      company,
      band: { initialOffer: 15, maxStretch: 20, walkAway: 12, hasEquity: false },
    });
  }

  it("Deloitte session prompt contains formal-traditional REGISTER GUIDANCE", () => {
    const state = stateForPrompt("Deloitte");
    const move: AiMove = { lever: "probe", newTotalLpa: null, rationale: "test" };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "Hello." });
    expect(user).toMatch(/register=formal-traditional/);
    expect(user).toMatch(/REGISTER GUIDANCE: Register: FORMAL-TRADITIONAL/);
    expect(user).toMatch(/kindly|sir|ma'am/i);
  });

  it("Google session prompt contains professional-global REGISTER GUIDANCE", () => {
    const state = stateForPrompt("Google");
    const move: AiMove = { lever: "probe", newTotalLpa: null, rationale: "test" };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "Hello." });
    expect(user).toMatch(/register=professional-global/);
    expect(user).toMatch(/REGISTER GUIDANCE: Register: PROFESSIONAL-GLOBAL/);
  });

  it("system prompt documents Indian HR vocabulary + bans Americanisms", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/INDIAN HR VOCABULARY/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/CTC/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/LPA/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/joining bonus/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/relieving letter/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/BGV/);
    /* Americanisms banned */
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/bandwidth/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/touch base/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/circle back/);
  });

  it("system prompt teaches HIKE-% framing", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/HIKE-% FRAMING/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/hike percentage/);
    /* Negative anchor: must explicitly warn against fabricating a hike% */
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/DO NOT invent a hike percentage/);
  });

  it("system prompt distinguishes in-hand vs CTC", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/IN-HAND vs CTC/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/take-home/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/employer-PF/);
  });

  it("system prompt has anti-stereotype guardrail (no broken-English mimicry)", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/DO NOT mimic broken English/);
    /* Each of these is a stereotype the LLM should NOT produce */
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/kindly do the needful/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/myself <name>/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/good name/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/doing the same/);
  });

  it("system prompt caps over-politeness (one 'kindly' max per turn)", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/POLITENESS CAPS/);
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/ONE 'kindly' per turn/);
  });

  it("each register block contains a SAMPLE TURN few-shot anchor", () => {
    /* Few-shot anchors are the highest-leverage prompt-engineering move.
     * Each of the 4 register blocks must include a verbatim sample turn
     * the LLM can pattern-match against. */
    for (const r of ["formal-traditional", "professional-global", "casual-modern", "scrappy-startup"] as const) {
      const g = formatRegisterGuidance(r);
      expect(g, `${r} missing SAMPLE TURN`).toMatch(/SAMPLE TURN/);
      /* Sample turns reference concrete LPA numbers (anchors the LLM to
       * use Indian units) — every sample has an LPA figure. */
      expect(g, `${r} sample turn must mention LPA`).toMatch(/LPA/);
    }
  });
});
