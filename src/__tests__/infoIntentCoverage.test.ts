/**
 * Session B (2026-05-14) — Area 4 audit.
 *
 * Corpus coverage for InfoIntent detection in
 * server-handlers/_negotiation-kernel.ts::detectInfoIntents.
 *
 * Each case asserts that a representative natural-language utterance —
 * including code-mixed Hindi-English and informal phrasing — routes to
 * the documented intent. Declarative variants ("I counted the benefits")
 * must NOT trip the corresponding interrogative-shaped intent.
 *
 * Two new intents added this session:
 *   - notice-period-ask  (was extraction-only; now also info-intent)
 *   - hike-percentage-ask
 */

import { describe, it, expect } from "vitest";
import { parseCandidateAnswer } from "../../server-handlers/_negotiation-kernel";

type Case = { input: string; intent: string };

function intentOf(input: string): string[] {
  return parseCandidateAnswer(input).infoAsked;
}

describe("info-intent coverage — benefits-overview", () => {
  const cases: Case[] = [
    { input: "what are the benefits?", intent: "benefits-overview" },
    { input: "tell me about benefits", intent: "benefits-overview" },
    { input: "perks?", intent: "benefits-overview" },
    { input: "what's included in the benefits?", intent: "benefits-overview" },
    { input: "any goodies in the benefits package?", intent: "benefits-overview" },
    { input: "fringe benefits?", intent: "benefits-overview" },
    { input: "what do I get apart from base?", intent: "benefits-overview" },
    { input: "benefits kya hain?", intent: "benefits-overview" },
    { input: "package mein kya hai benefits?", intent: "benefits-overview" },
    { input: "tell me about wellness benefits", intent: "benefits-overview" },
  ];
  for (const c of cases) {
    it(`"${c.input}" → ${c.intent}`, () => {
      expect(intentOf(c.input)).toContain(c.intent);
    });
  }

  it("declarative 'I counted the benefits.' does NOT match benefits-overview", () => {
    expect(intentOf("I counted the benefits.")).not.toContain("benefits-overview");
  });
  it("declarative 'fringe benefits of equity are nice' does NOT match benefits-overview", () => {
    /* No interrogative shape, no leading verb. */
    expect(intentOf("fringe benefits of equity are nice")).not.toContain("benefits-overview");
  });
});

describe("info-intent coverage — compensation-breakdown / variable / equity", () => {
  const cases: Case[] = [
    { input: "variable comp?", intent: "compensation-breakdown" },
    { input: "ESOPs?", intent: "compensation-breakdown" },
    { input: "tell me about RSU details", intent: "compensation-breakdown" },
    { input: "what's the OTE?", intent: "compensation-breakdown" },
    { input: "bonus structure?", intent: "compensation-breakdown" },
    { input: "explain stock options", intent: "compensation-breakdown" },
    { input: "share the performance bonus details", intent: "compensation-breakdown" },
    { input: "what's the joining bonus amount?", intent: "compensation-breakdown" },
  ];
  for (const c of cases) {
    it(`"${c.input}" → ${c.intent}`, () => {
      expect(intentOf(c.input)).toContain(c.intent);
    });
  }

  it("'is base fixed or variable?' → fixed-vs-variable", () => {
    expect(intentOf("is base fixed or variable?")).toContain("fixed-vs-variable");
  });
  it("'fixed vs variable split?' → fixed-vs-variable", () => {
    expect(intentOf("fixed vs variable split?")).toContain("fixed-vs-variable");
  });

  it("'vesting schedule?' → vest-schedule", () => {
    expect(intentOf("vesting schedule?")).toContain("vest-schedule");
  });
  it("'cliff period?' → vest-schedule", () => {
    expect(intentOf("cliff period?")).toContain("vest-schedule");
  });

  it("declarative 'the variable was 12% last year' does NOT match compensation-breakdown", () => {
    expect(intentOf("the variable was 12% last year")).not.toContain("compensation-breakdown");
  });
});

describe("info-intent coverage — notice-period-ask", () => {
  const cases = [
    "notice period?",
    "what is the notice period?",
    "when can I join?",
    "how soon can I start?",
    "earliest start date?",
    "expected joining date?",
    "joining date?",
    "buyout?",
    "do you offer a buyout?",
    "can you cover the buyout?",
  ];
  for (const input of cases) {
    it(`"${input}" → notice-period-ask`, () => {
      expect(intentOf(input)).toContain("notice-period-ask");
    });
  }
  it("declarative 'I have a 60-day notice' does NOT match notice-period-ask", () => {
    expect(intentOf("I have a 60-day notice")).not.toContain("notice-period-ask");
  });
});

describe("info-intent coverage — hike-percentage-ask", () => {
  const cases = [
    "what hike is this?",
    "is this a 30% hike?",
    "% raise?",
    "what's the hike on my current?",
    "how much hike?",
    "what is the increment?",
  ];
  for (const input of cases) {
    it(`"${input}" → hike-percentage-ask`, () => {
      expect(intentOf(input)).toContain("hike-percentage-ask");
    });
  }
  it("declarative 'I want a 30% hike' does NOT match hike-percentage-ask", () => {
    /* No question shape + leading "I want" pins it as a candidate ask
     * (target), not a candidate query about the offer. */
    expect(intentOf("I want a 30% hike")).not.toContain("hike-percentage-ask");
  });
});

describe("info-intent coverage — false-positive guard battery", () => {
  /* Declarative statements that mention intent keywords must not trip
   * the interrogative-shape intents. */
  const negatives: Array<[string, string]> = [
    ["I counted the benefits.", "benefits-overview"],
    ["The variable last year was 12 percent.", "compensation-breakdown"],
    ["My notice is 60 days.", "notice-period-ask"],
    ["I'm asking for a 30% hike.", "hike-percentage-ask"],
  ];
  for (const [input, intent] of negatives) {
    it(`"${input}" does NOT match ${intent}`, () => {
      expect(intentOf(input)).not.toContain(intent);
    });
  }
});
