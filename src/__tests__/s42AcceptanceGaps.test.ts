import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

describe("S42 acceptance gap verification", () => {
  const ctx = { offerOnTable: true, highestOfferMade: 50 };

  it.each([
    // Should pass (already covered)
    ["sounds good to me", true],
    ["alright, I'll take it", true],
    ["I'll take it", true],
    ["I'm good with the offer", true],
    ["I'm happy with that", true],
    ["works for me", true],
    // S42 gap phrases
    ["I'm good with that", true],
    ["yeah, I'm good with it", true],
    ["I'm good with it", true],
    ["I'm good with this", true],
  ] as const)(
    '"%s" signalsAcceptance should be %s',
    (phrase, expected) => {
      const r = classifyAcceptance(phrase, ctx);
      expect(r.accepted).toBe(expected);
    },
  );
});
