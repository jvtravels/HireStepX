/* PDF #17 architectural fix (2026-05-15) — number-discipline rule
 * (range before specific number) + detector. */
import { describe, it, expect } from "vitest";
import { NEGOTIATION_SYSTEM_PROMPT } from "../../server-handlers/_negotiate-turn-helpers";
import { detectRangeDisclosure } from "../../server-handlers/_trial-close-detector";

describe("NUMBER DISCIPLINE rule + detector", () => {
  it("the system prompt contains the NUMBER DISCIPLINE block", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/NUMBER DISCIPLINE/);
  });

  it("the rule mentions revealing a RANGE before a specific number", () => {
    expect(NEGOTIATION_SYSTEM_PROMPT).toMatch(/range/i);
  });

  it("detectRangeDisclosure fires on 'between ₹X and ₹Y' phrasing", () => {
    expect(
      detectRangeDisclosure(
        "Our band for this role typically sits between ₹22L and ₹28L.",
      ),
    ).toBe(true);
  });

  it("detectRangeDisclosure fires on '22-28 LPA' phrasing", () => {
    expect(detectRangeDisclosure("typical range is 22-28 LPA")).toBe(true);
  });

  it("detectRangeDisclosure does NOT fire on a single specific number", () => {
    expect(detectRangeDisclosure("Our offer is ₹24L.")).toBe(false);
    expect(detectRangeDisclosure("")).toBe(false);
  });
});
