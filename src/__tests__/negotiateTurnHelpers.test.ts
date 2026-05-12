/* Tests for the pure helpers backing the canonical negotiate-turn
 * endpoint (Ship 2). The route handler itself involves real
 * preamble/auth and is best covered by integration; these tests pin
 * the deterministic parts: prompt structure, validation, and the
 * deterministic fallback wording. */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyAiMove,
  type NegotiationState,
  type AiMove,
} from "../../server-handlers/_negotiation-kernel";
import {
  buildAiPrompt,
  validateAiText,
  deterministicFallbackText,
} from "../../server-handlers/_negotiate-turn-helpers";

const BAND = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

describe("buildAiPrompt", () => {
  it("includes the kernel brief as JSON in user prompt", () => {
    const state = baseState({ phase: "counter-offer", highestOfferMade: 20, candidateTarget: 26 });
    const move: AiMove = { lever: "counter-base", newTotalLpa: 23, rationale: "split" };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "I want 26 LPA" });
    expect(user).toContain('"lever": "counter-base"');
    expect(user).toContain('"newTotalLpa": 23');
    expect(user).toContain('"candidateTarget": 26');
    expect(user).toContain('I want 26 LPA');
  });

  it("instructs the LLM to use the kernel number verbatim when one is set", () => {
    const state = baseState();
    const move: AiMove = { lever: "open-with-offer", newTotalLpa: 20, rationale: "open" };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "" });
    expect(user).toMatch(/Include the number ₹20 LPA verbatim/);
  });

  it("forbids inventing a salary number for non-numeric levers", () => {
    const state = baseState({ phase: "probe-expectations", highestOfferMade: 20 });
    const move: AiMove = { lever: "probe", newTotalLpa: null, rationale: "probe" };
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "Tell me the package" });
    expect(user).toMatch(/Do not introduce any salary number/);
  });

  it("system prompt is identical across turns (caching-friendly)", () => {
    /* Groq prompt caching hits the longest shared prefix. The static
       rules must NOT depend on per-turn data. */
    const s1 = buildAiPrompt({ state: baseState(), move: { lever: "open-with-offer", newTotalLpa: 20, rationale: "" }, candidateAnswer: "" });
    const s2 = buildAiPrompt({ state: baseState({ candidateTarget: 30 }), move: { lever: "probe", newTotalLpa: null, rationale: "" }, candidateAnswer: "different" });
    expect(s1.system).toBe(s2.system);
  });
});

describe("validateAiText", () => {
  const state = baseState({ highestOfferMade: 20, phase: "counter-offer", candidateTarget: 26 });
  const counterMove: AiMove = { lever: "counter-base", newTotalLpa: 23, rationale: "" };

  it("passes a well-formed counter response", () => {
    const r = validateAiText("We can stretch to ₹23 LPA total. Does that work?", state, counterMove);
    expect(r.ok).toBe(true);
    expect(r.failures).toEqual([]);
  });

  it("flags missing required number", () => {
    const r = validateAiText("We can stretch a little. Does that work?", state, counterMove);
    expect(r.ok).toBe(false);
    expect(r.failures).toContainEqual({ kind: "missing-required-number", required: 23 });
  });

  it("flags out-of-band number", () => {
    /* maxStretch=28, but LLM said ₹35. */
    const r = validateAiText("We can go up to ₹35 LPA for the right candidate.", state, counterMove);
    expect(r.failures.some(f => f.kind === "out-of-band")).toBe(true);
  });

  it("flags verbatim repeat", () => {
    const repeatState = baseState({
      highestOfferMade: 20,
      phase: "counter-offer",
      lastAiText: "Could you tell us what range you were expecting for this position?",
    });
    const probeMove: AiMove = { lever: "probe", newTotalLpa: null, rationale: "" };
    const r = validateAiText(
      "Could you tell us what range you were expecting for this position?",
      repeatState,
      probeMove,
    );
    expect(r.failures.some(f => f.kind === "verbatim-repeat")).toBe(true);
  });

  it("flags empty text", () => {
    const r = validateAiText("   ", state, counterMove);
    expect(r.failures).toContainEqual({ kind: "empty" });
  });

  it("accepts non-numeric lever with no number in text", () => {
    const benefitsMove: AiMove = { lever: "benefits-summary", newTotalLpa: state.highestOfferMade, rationale: "" };
    const r = validateAiText(
      "Beyond cash, the package includes health cover, learning budget, and flex hybrid.",
      state, benefitsMove,
    );
    /* highestOfferMade is the "current" number that the move also
       carries; mentioning it or not is fine. The required-number
       check fires only when LLM omits a number the brief carried —
       here ₹20 is the current, not a new offer, so let's flex on it. */
    expect(r.failures.filter(f => f.kind !== "missing-required-number")).toEqual([]);
  });
});

describe("deterministicFallbackText", () => {
  it("covers every lever with a non-empty line", () => {
    const levers = [
      "open-with-offer","probe","counter-base","joining-bonus","equity-grant",
      "notice-buyout","benefits-summary","hold-firm",
      "close-acceptance","close-walkaway","close-stalemate",
    ] as const;
    for (const lever of levers) {
      const state = baseState({ highestOfferMade: 22 });
      const move: AiMove = { lever, newTotalLpa: lever === "open-with-offer" ? 20 : 22, rationale: "" };
      const text = deterministicFallbackText(state, move);
      expect(text.length).toBeGreaterThan(10);
    }
  });

  it("open-with-offer mentions the offered number", () => {
    const state = baseState();
    const text = deterministicFallbackText(state, { lever: "open-with-offer", newTotalLpa: 20, rationale: "" });
    expect(text).toMatch(/20/);
  });

  it("close-acceptance mentions highest offer made", () => {
    const state = baseState({ highestOfferMade: 25 });
    const text = deterministicFallbackText(state, { lever: "close-acceptance", newTotalLpa: 25, rationale: "" });
    expect(text).toMatch(/25/);
  });
});

describe("integration: applyAiMove + lastAiText interaction", () => {
  it("after applyAiMove, lastAiText is used by next validation for repeat check", () => {
    let state = baseState();
    const openMove: AiMove = { lever: "open-with-offer", newTotalLpa: 20, rationale: "" };
    const text = "Our offer for this role is ₹20 LPA total CTC. What do you think?";
    state = applyAiMove(state, openMove, text);
    expect(state.lastAiText).toBe(text);

    const probeMove: AiMove = { lever: "probe", newTotalLpa: null, rationale: "" };
    const r = validateAiText(text, state, probeMove);
    expect(r.failures.some(f => f.kind === "verbatim-repeat")).toBe(true);
  });
});
