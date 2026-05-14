/* PDF #17 architectural fix (2026-05-15) — variable-comfort
 * system-prompt rule + detector. */
import { describe, it, expect } from "vitest";
import { NEGOTIATION_SYSTEM_PROMPT } from "../../server-handlers/_negotiate-turn-helpers";
import { detectVariableComfortAsked } from "../../server-handlers/_trial-close-detector";

describe("VARIABLE-COMFORT TEST rule + detector", () => {
  it("the negotiation system prompt includes the VARIABLE-COMFORT TEST block", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/VARIABLE-COMFORT TEST/);
  });

  it("the rule references the >20% threshold", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/>20%/);
  });

  it("the rule mentions average payout disclosure", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/average payout/i);
  });

  it("detectVariableComfortAsked fires on a 'how comfortable are you with variable' probe", () => {
    expect(
      detectVariableComfortAsked(
        "How comfortable are you with 25% of your package being variable?",
      ),
    ).toBe(true);
  });

  it("detectVariableComfortAsked ignores a plain variable disclosure", () => {
    expect(
      detectVariableComfortAsked("Your variable will be 25% of CTC."),
    ).toBe(false);
  });
});
