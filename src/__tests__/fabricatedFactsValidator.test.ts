/* F3 (PDF#19 2026-05-15) — validateNoFabricatedFacts.
 *
 * PDF#19 F3: the LLM occasionally hallucinates context the candidate
 * never disclosed ("you mentioned another offer", "given your X-year
 * notice period"). The conservative patterns this validator detects
 * are tagged as critical so F2 substitutes deterministic prose.
 *
 * Design: false-negatives are acceptable (we can extend the pattern
 * set later); ZERO false-positives is the hard requirement — a
 * legitimate bot reply must never be rejected. Each pattern matches
 * the kernel-side fact the LLM claimed; the validator only rejects
 * when the corresponding state field is empty/null.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { validateNoFabricatedFacts } from "../../server-handlers/_response-validators";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: false };

const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s-f3", role: "Software Engineer", company: "acme", band: BAND }),
  ...overrides,
});

describe("F3 — validateNoFabricatedFacts (kill hallucinated context)", () => {
  it("rejects bot reply claiming candidate mentioned a competing offer they didn't disclose", () => {
    const state = baseState();
    /* No competing offer in state. */
    expect(state.competingOffer).toBeNull();
    expect(state.competingOfferDetail?.hasAny).toBeFalsy();
    const reply = "Since you mentioned another offer, how are you deciding between them?";
    const result = validateNoFabricatedFacts(reply, state);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.join(",")).toMatch(/competing-offer/);
    }
  });

  it("rejects bot reply citing a current CTC the candidate never disclosed", () => {
    const state = baseState();
    expect(state.candidateCurrentCtc).toBeNull();
    const reply = "Given your current CTC, the offer is competitive.";
    const result = validateNoFabricatedFacts(reply, state);
    expect(result.ok).toBe(false);
  });

  it("accepts the same reply when the candidate DID disclose a competing offer", () => {
    const state = baseState({ competingOffer: 24 });
    const reply = "Since you mentioned another offer, how are you deciding between them?";
    const result = validateNoFabricatedFacts(reply, state);
    expect(result.ok).toBe(true);
  });

  it("accepts a reply that doesn't claim any candidate-side facts (zero false-positive)", () => {
    const state = baseState();
    const reply = "Before we go further — what range were you expecting for this role?";
    const result = validateNoFabricatedFacts(reply, state);
    expect(result.ok).toBe(true);
  });
});
