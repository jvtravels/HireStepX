import { describe, it, expect } from "vitest";
import { detectCandidateIntent } from "../../server-handlers/_follow-up-helpers";

describe("wave8 probe", () => {
  const cases: [string, string][] = [
    ["I'm totally fine with that.", "acc"],
    ["I'm fine with that.", "acc"],
    ["The offer doesn't meet my requirements.", "rej"],
    ["The offer does not meet my needs.", "rej"],
    ["This falls short of my expectations.", "rej"],
    ["I'd need a higher number.", "rej"],
    ["I'll go for it.", "acc"],
    ["I'd go for it.", "acc"],
    ["I'm afraid we can't reach an agreement.", "walk"],
    ["I'll be passing on this.", "walk"],
  ];
  cases.forEach(([text, expected]) => {
    it(`"${text}" → ${expected}`, () => {
      const r = detectCandidateIntent(text);
      if (expected === "acc") expect({ acc: r.accepted, rej: r.rejected, wa: r.walkAway }).toMatchObject({ acc: true, rej: false });
      else if (expected === "rej") expect({ acc: r.accepted, rej: r.rejected, wa: r.walkAway }).toMatchObject({ rej: true, acc: false });
      else if (expected === "walk") expect({ acc: r.accepted, rej: r.rejected, wa: r.walkAway }).toMatchObject({ wa: true });
    });
  });
});
