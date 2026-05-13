/* Audit Session C — response-hint prose for the 2 new info intents
 * (notice-period-ask, hike-percentage-ask) added in Session B.
 *
 * Session B wired the intents into the kernel state and parser; this
 * session wires the response-hint disclosure block + the lever routing
 * so the LLM actually answers the candidate's question instead of
 * defaulting to probe / re-close. These tests pin:
 *
 *   1. Detection: parseCandidateAnswer populates infoAsked.
 *   2. Prompt: buildAiPrompt injects the right disclosure block when
 *      the intent is in state.infoAsked.
 *   3. Routing: pickAiMove picks notice-period-summary / hike-context-summary
 *      in non-terminal phases.
 *   4. Terminal preservation: in terminal phases (accepted/walkaway/etc.)
 *      the kernel does NOT re-route the move into a non-terminal lever.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  parseCandidateAnswer,
  pickAiMove,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { buildAiPrompt } from "../../server-handlers/_negotiate-turn-helpers";

const BAND = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s", role: "Software Engineer", company: "Razorpay", band: BAND }),
  ...overrides,
});

describe("notice-period-ask disclosure", () => {
  it("detection: parser flags notice-period-ask on 'what's the notice on your side?'", () => {
    const r = parseCandidateAnswer("And what's the notice period on your side?");
    expect(r.infoAsked).toContain("notice-period-ask");
  });

  it("prompt: buildAiPrompt injects NOTICE PERIOD DISCLOSURE block when intent present", () => {
    const state = baseState({ infoAsked: ["notice-period-ask"] });
    const move = pickAiMove(state);
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "" });
    expect(user).toMatch(/NOTICE PERIOD DISCLOSURE/);
    expect(user).toMatch(/Razorpay|60[- ]day|joining window/i);
  });

  it("prompt: generic-India fallback applied when company is unknown", () => {
    const state = baseState({
      company: "ZZZ-NotARealCompany",
      infoAsked: ["notice-period-ask"],
    });
    const move = pickAiMove(state);
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "" });
    expect(user).toMatch(/60-90 days/);
  });

  it("routing: pickAiMove routes to notice-period-summary in non-terminal phase", () => {
    const state = baseState({
      phase: "counter-offer",
      highestOfferMade: 22,
      infoAsked: ["notice-period-ask"],
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("notice-period-summary");
    expect(move.newTotalLpa).toBe(22);
  });

  it("terminal preservation: pickAiMove does NOT re-trigger close-acceptance in accepted phase", () => {
    /* In the accepted (terminal) phase, the move-picker short-circuits
     * via isTerminalPhase. The notice-period-ask intent must NOT pull
     * the state back into a non-terminal lever. */
    const state = baseState({
      phase: "accepted",
      highestOfferMade: 25,
      infoAsked: ["notice-period-ask"],
    });
    const move = pickAiMove(state);
    expect(move.lever).not.toBe("notice-period-summary");
    expect(["terminal-restate", "close-acceptance"]).toContain(move.lever);
  });
});

describe("hike-percentage-ask disclosure", () => {
  it("detection: parser flags hike-percentage-ask on 'what hike is this?'", () => {
    const r = parseCandidateAnswer("What hike is this for me?");
    expect(r.infoAsked).toContain("hike-percentage-ask");
  });

  it("prompt: buildAiPrompt computes delta when both currentCtc and offer are known", () => {
    const state = baseState({
      candidateCurrentCtc: 20,
      highestOfferMade: 26,
      infoAsked: ["hike-percentage-ask"],
    });
    const move = pickAiMove(state);
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "" });
    expect(user).toMatch(/HIKE CALCULATION/);
    /* (26-20)/20 = 30% */
    expect(user).toMatch(/30%/);
    expect(user).toMatch(/₹20 LPA/);
  });

  it("prompt: falls back to asking for current package when currentCtc is unknown", () => {
    const state = baseState({
      candidateCurrentCtc: null,
      highestOfferMade: 26,
      infoAsked: ["hike-percentage-ask"],
    });
    const move = pickAiMove(state);
    const { user } = buildAiPrompt({ state, move, candidateAnswer: "" });
    expect(user).toMatch(/HIKE CALCULATION/);
    expect(user).toMatch(/current CTC|current package/i);
    expect(user).toMatch(/15-30%/);
  });

  it("routing: pickAiMove routes to hike-context-summary in non-terminal phase", () => {
    const state = baseState({
      phase: "counter-offer",
      highestOfferMade: 24,
      candidateCurrentCtc: 18,
      infoAsked: ["hike-percentage-ask"],
    });
    const move = pickAiMove(state);
    expect(move.lever).toBe("hike-context-summary");
  });

  it("terminal preservation: hike-percentage-ask in accepted phase does NOT route to hike-context-summary", () => {
    const state = baseState({
      phase: "accepted",
      highestOfferMade: 26,
      candidateCurrentCtc: 20,
      infoAsked: ["hike-percentage-ask"],
    });
    const move = pickAiMove(state);
    expect(move.lever).not.toBe("hike-context-summary");
    expect(["terminal-restate", "close-acceptance"]).toContain(move.lever);
  });
});
