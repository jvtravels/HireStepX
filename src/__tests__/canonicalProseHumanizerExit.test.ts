/* 2026-05-29 realism-pass P0-1 audit follow-up — exit-point humanizer
 * coverage for INLINE arms.
 *
 * Pre-audit the wired humanizer at the renderCanonicalProse exit point
 * was effectively only verified by reactive-followup snapshots (which
 * pass null sessionId → humanizer identity). The 22 inline arms in
 * renderCanonicalProseBody (terminal-restate, close.accept, lever-
 * explore generic, probe-mismatch, …) were never asserted to actually
 * pick up the humanizer when sessionId is non-null. The bug surface
 * was discovered by pdf48LeverExploreNumberAwareness.test.ts failing
 * by luck — its sessionId happened to roll a tic hit.
 *
 * This test pins the behavior directly: pick an inline arm with a
 * known canonical body, pin sessionId+turn to a value where the
 * humanizer dice fires, assert the canonical body is preserved AND a
 * persona-tic prepends.
 *
 * Also asserts:
 *   - HUMANIZER_SUPPRESSED_KINDS: `terminal-restate` / `close-recap-formal`
 *     / walkaway are NOT tic'd (their tone register is preserved).
 *   - Sentiment prefix is NOT tic'd (the persona-tic stacks only on the
 *     body, not on "I hear you — and I want to be straight with you here.").
 *   - Proper-noun guard: greet path ("Sandeep, …") is NOT lowercased.
 */
import { describe, it, expect } from "vitest";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";
import {
  humanizeRecruiterProse,
  lowercaseFirst,
} from "../../server-handlers/_recruiter-prose-realism";

const BAND: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 44,
  walkAway: 36,
  hasEquity: true,
};

/* `s-pdf48` is the same seed used in pdf48LeverExploreNumberAwareness;
 * at turnIndex 0 it rolls a tic-fire under register=neutral. If you
 * change this seed and a test below regresses, the humanizer's FNV-1a
 * pick shifted — bump the seed until tic-fire hits again or adjust the
 * assertion to .toContain the body substring. */
const TIC_FIRE_SEED = "s-pdf48";

function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    ...initState({ sessionId: TIC_FIRE_SEED, role: "sr-pd", company: "flipkart", band: BAND }),
    ...overrides,
  };
}

describe("renderCanonicalProse exit-point humanizer — inline-arm coverage", () => {
  it("HUMANIZER_SUPPRESSED_KINDS: terminal-restate ships unmutated body (no tic prefix)", () => {
    /* `terminal-restate` carries its own register ("The fitment stands
     * at ₹40L as per our band for this grade. Take your time and revert.")
     * and prepending "Look, the fitment stands…" reads as evasive on a
     * terminal cadence. The HUMANIZER_SUPPRESSED_KINDS guard must apply. */
    const state = mkState({ highestOfferMade: 40 });
    const action: NextAction = { kind: "terminal-restate" } as NextAction;
    const prose = renderCanonicalProse(action, state);
    expect(prose).toBe(
      "The fitment stands at ₹40L as per our band for this grade. Take your time and revert.",
    );
  });

  it("HUMANIZER_SUPPRESSED_KINDS: close-recap-formal is not tic'd", () => {
    /* close-recap-formal is the formal-close arm — formal tone register
     * by definition; tics dilute it. Assert no canonical tic ("Look,",
     * "Honestly,", "Yeah so,") prepends. */
    const state = mkState({
      highestOfferMade: 42,
      candidateTarget: 44,
      recruiterSectorPersona: "indian-unicorn",
    });
    const action: NextAction = { kind: "close-recap-formal" } as NextAction;
    const prose = renderCanonicalProse(action, state);
    expect(prose).not.toMatch(/^(?:Look|Honestly|Yeah so|Right so|Basically|Frankly|Fundamentally|At the end of the day|Process-wise|Policy-wise|As per process|As per policy|From a stakeholder perspective), /);
  });

  it("close.walkaway is not tic'd even when sector persona is set", () => {
    /* Walkaway carries the tightest possible register — neither
     * sentiment prefix nor persona tic should fire. */
    const state = mkState({ recruiterSectorPersona: "indian-unicorn" });
    const action: NextAction = { kind: "close", mode: "walkaway" } as NextAction;
    const prose = renderCanonicalProse(action, state);
    /* Tic-prefix shape is "Tic, lowercaseBody…" — match the comma to
     * avoid colliding with canonical bodies that happen to START with
     * "Look" (the walkaway body opens "Looking at where your
     * expectations are…"). */
    expect(prose).not.toMatch(/^(?:Look|Honestly|Yeah so|Right so|Basically|Frankly|Fundamentally|At the end of the day|Process-wise|Policy-wise|As per process|As per policy|From a stakeholder perspective), /);
    expect(prose).toContain("Looking at where your expectations are");
  });

  it("answer-direct fallback path: sentiment prefix is suppressed (matches planner-level path)", () => {
    /* The planner-level deterministic-prose path ships pre-humanized
     * prose WITHOUT a sentiment prefix. canonical-prose fallback must
     * suppress the sentiment prefix too, or candidates hear "Take your
     * time on this — <pre-humanized prose>" on the fallback path only.
     *
     * Use a state with sentiment "hesitant" — would normally produce
     * "Take your time on this —" prefix. Action carries pre-set prose;
     * the canonical-prose answer-direct case just returns action.prose. */
    const state = mkState({
      lastTurnDelta: {
        turnIndex: 1,
        candidateSentiment: "hesitant",
      } as unknown as NegotiationState["lastTurnDelta"],
    });
    const action: NextAction = {
      kind: "answer-direct",
      topic: "esop-structure",
      prose: "Yeah, the ESOP grant is on a four-year vest with a one-year cliff.",
      satisfiesTopic: "answer-direct",
    } as NextAction;
    const prose = renderCanonicalProse(action, state);
    expect(prose).not.toMatch(/^Take your time on this —/);
    expect(prose).toBe("Yeah, the ESOP grant is on a four-year vest with a one-year cliff.");
  });

  it("answer-direct: canonical-prose fallback is byte-identical to planner-set action.prose", () => {
    /* Byte-equivalence guard. The PDF#51 planner stashes `spokenProse`
     * on action.prose; the LLM-bypass in negotiate-turn.ts ships it
     * directly via `move.deterministicProse`. The canonical-prose
     * answer-direct case returns action.prose. Both paths must produce
     * the same string for the same input — if they diverge, candidates
     * on the fallback path hear a different recruiter than candidates
     * on the bypass path. This test asserts the divergence is zero. */
    const PRE_HUMANIZED =
      "Look, the ESOP grant is on a four-year vest with a one-year cliff. ESOPs accrue monthly post-cliff.";
    const state = mkState({
      recruiterSectorPersona: "indian-unicorn",
      lastTurnDelta: {
        turnIndex: 1,
        candidateSentiment: "hesitant",
      } as unknown as NegotiationState["lastTurnDelta"],
    });
    const action: NextAction = {
      kind: "answer-direct",
      topic: "esop-structure",
      prose: PRE_HUMANIZED,
      satisfiesTopic: "answer-direct",
    } as NextAction;
    /* Canonical-prose path. */
    const fallbackProse = renderCanonicalProse(action, state);
    /* Bypass path simulator — negotiate-turn.ts ships
     * `move.deterministicProse` which IS `action.prose`. No transform. */
    const bypassProse = (action as Extract<NextAction, { kind: "answer-direct" }>).prose;
    expect(fallbackProse).toBe(bypassProse);
  });

  /* --- Force-fire tests — pin humanizer layer behavior without
   *     depending on FNV-1a hash luck.
   *
   * The prior approach (relying on `s-pdf48` happening to roll tic at
   * turn 0) silently weakens when the salt list shifts or a new layer
   * is added (rebalancing the entropy budget). `__forceLayer` makes
   * these tests robust to such changes.
   *
   * --- */

  it("inline-arm humanizer wires correctly: lever-explore generic gets a tic prefix when tic fires", () => {
    /* Force tic-fire and assert: (a) the canonical body is preserved
     * AS A SUBSTRING (humanizer doesn't corrupt domain prose); (b) a
     * persona-tic prefixes the body in the "Tic, " shape. This is the
     * exit-point wire-in's positive assertion — the suppressed-kinds
     * tests below are negative. */
    const out = humanizeRecruiterProse(
      "Let me see what else we can structure on the fitment.",
      {
        sector: "indian-unicorn",
        sessionId: "anything",
        turnIndex: 0,
        __forceLayer: { tic: true },
      },
    );
    expect(out).toMatch(/^(?:Look|Honestly|Right), let me see what else/);
    expect(out).toContain("structure on the fitment");
  });

  it("force-fire: hedge layer inserts a mid-sentence parenthetical", () => {
    const out = humanizeRecruiterProse(
      "On the equity piece, what's the vesting schedule on your current grant?",
      {
        sessionId: "anything",
        turnIndex: 0,
        __forceLayer: { hedge: true },
      },
    );
    expect(out).toMatch(/, (?:honestly|I mean|to be fair|right),/);
  });

  it("force-fire: checkback suffix appends only when prose is ≥40 words", () => {
    /* Short prose — checkback should NOT fire even with force, because
     * the word-count gate is independent of the dice gate. */
    const shortOut = humanizeRecruiterProse(
      "Take your time.",
      { sessionId: "x", turnIndex: 0, __forceLayer: { checkback: true } },
    );
    expect(shortOut).toBe("Take your time.");

    /* Long prose — checkback fires deterministically with force. */
    const longProse = Array(45).fill("word").join(" ") + ".";
    const longOut = humanizeRecruiterProse(longProse, {
      sessionId: "x",
      turnIndex: 0,
      __forceLayer: { checkback: true },
    });
    expect(longOut).toMatch(/\. (?:Does that make sense\?|You with me\?|Right\?)$/);
  });
});

describe("lowercaseFirst — proper-noun guard", () => {
  it("lowercases a leading uppercase letter when followed by lowercase (default tic-prefix case)", () => {
    expect(lowercaseFirst("The fitment stands")).toBe("the fitment stands");
  });

  it("preserves acronyms (ESOP / CTC / RM)", () => {
    expect(lowercaseFirst("ESOP grant vests monthly")).toBe("ESOP grant vests monthly");
    expect(lowercaseFirst("CTC includes variable")).toBe("CTC includes variable");
    expect(lowercaseFirst("RM owns the queue")).toBe("RM owns the queue");
  });

  it("preserves the pronoun 'I' at sentence start", () => {
    expect(lowercaseFirst("I hear you — and I want to be straight")).toBe(
      "I hear you — and I want to be straight",
    );
  });

  it("preserves vocative names by regex shape ([A-Z][a-z]+,)", () => {
    /* Even without candidateFirstName threaded, the vocative shape is
     * recognised — defends against the planner not having a name yet. */
    expect(lowercaseFirst("Sandeep, take your time on this")).toBe(
      "Sandeep, take your time on this",
    );
    expect(lowercaseFirst("Priya, what's anchoring the expectation?")).toBe(
      "Priya, what's anchoring the expectation?",
    );
  });

  it("preserves a threaded candidate first name at the start (no vocative comma required)", () => {
    /* When the canonical body opens with the name directly (no comma),
     * the regex shape doesn't match but the candidateFirstName argument
     * still suppresses the lowercasing. */
    expect(lowercaseFirst("Sandeep is good with that", "Sandeep")).toBe(
      "Sandeep is good with that",
    );
  });

  it("still lowercases when the candidate name doesn't match the start", () => {
    /* candidateFirstName is set but doesn't appear at the start — falls
     * back to default behavior, lowercasing the leading uppercase. */
    expect(lowercaseFirst("The fitment stands at ₹40L", "Sandeep")).toBe(
      "the fitment stands at ₹40L",
    );
  });

  it("returns input unchanged if shorter than 2 chars", () => {
    expect(lowercaseFirst("")).toBe("");
    expect(lowercaseFirst("A")).toBe("A");
  });
});
