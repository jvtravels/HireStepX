/* F4 (PDF#19 2026-05-15) — validateCloseVocabularyMatchesLever.
 *
 * PDF#19 F4: real bot output emitted "Congratulations, we're excited to
 * have you on board!" on a discovery-probe turn (no close, no accept).
 * Closing vocabulary appearing while the move is anything other than
 * close-acceptance is a hallucinated outcome.
 *
 * Patterns: congratulations/on board, welcome to the team, we're
 * excited to have you, offer letter is being / will be, let's get you
 * onboarded. Tagged as critical so F2 substitutes.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type AiMove,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { validateCloseVocabularyMatchesLever } from "../../server-handlers/_response-validators";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: false };

const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s-f4", role: "Software Engineer", company: "acme", band: BAND }),
  ...overrides,
});

const PROBE_MOVE: AiMove = { lever: "probe", newTotalLpa: null, rationale: "" };
const CLOSE_MOVE: AiMove = { lever: "close-acceptance", newTotalLpa: 22, rationale: "" };

describe("F4 — validateCloseVocabularyMatchesLever", () => {
  it("rejects 'Congratulations, on board!' on a probe move", () => {
    const result = validateCloseVocabularyMatchesLever(
      "Congratulations, we're excited to have you on board!",
      baseState(),
      PROBE_MOVE,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects 'welcome to the team' on a probe move", () => {
    const result = validateCloseVocabularyMatchesLever(
      "Welcome to the team! Let's discuss the next steps.",
      baseState(),
      PROBE_MOVE,
    );
    expect(result.ok).toBe(false);
  });

  it("rejects 'offer letter is being prepared' on a counter-base move", () => {
    const result = validateCloseVocabularyMatchesLever(
      "Your offer letter is being prepared as we speak.",
      baseState(),
      { lever: "counter-base", newTotalLpa: 24, rationale: "" },
    );
    expect(result.ok).toBe(false);
  });

  it("accepts the same close vocabulary when the move IS close-acceptance", () => {
    const result = validateCloseVocabularyMatchesLever(
      "Congratulations, we're excited to have you on board!",
      baseState({ phase: "accepted" }),
      CLOSE_MOVE,
    );
    expect(result.ok).toBe(true);
  });

  it("accepts a probe reply with no closing vocabulary (zero false-positive)", () => {
    const result = validateCloseVocabularyMatchesLever(
      "What range were you targeting for this role?",
      baseState(),
      PROBE_MOVE,
    );
    expect(result.ok).toBe(true);
  });
});
