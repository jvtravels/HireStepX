/* Negotiation battery (2026-06-18) — locks the deterministic ship path
 * (LLM-off worst case) against regressions discovered via the offline
 * simulator. Each scenario replays a full conversation through the REAL
 * kernel + planner + canonical-prose renderer.
 *
 * Invariants asserted on EVERY shipped recruiter line, across every
 * scenario — these are phrasing-independent output contracts, not
 * per-phrase patches:
 *   • Indian-HR register: no honorifics / USD / 401k / PTO / k-salary.
 *   • Indian-HR fluency (D5): no stacked discourse fillers, no broken
 *     capitalization after a sentence-final period.
 *   • No content-free filler shipped once an offer is on the table.
 *
 * Per-scenario behavioural asserts (close on accept, etc.) are added as
 * each structural defect is fixed, so this file is the running spec for
 * "the negotiation is smooth and reaches a real close."
 */
import { describe, it, expect } from "vitest";
import {
  runConversation,
  registerViolations,
  fluencyViolations,
  fillerHit,
  type SimTurn,
} from "./_negotiationSim";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

const band: NegotiationBand = { initialOffer: 28, maxStretch: 40, walkAway: 22, hasEquity: true };

interface Scenario {
  name: string;
  turns: string[];
  band?: NegotiationBand;
}

const SCENARIOS: Scenario[] = [
  {
    name: "S1 happy-path close",
    turns: [
      "I'm a backend engineer with 6 years, currently at 26 LPA.",
      "I'm targeting around 36 LPA total.",
      "Can you move closer to 36?",
      "Is that really your best?",
      "Okay, what about a joining bonus?",
      "Alright, that works. I accept.",
    ],
  },
  {
    name: "S2 competing-offer-with-letter",
    turns: [
      "Currently at 30 LPA, 7 years in data engineering.",
      "I have a written offer from Flipkart at 42 LPA.",
      "Can you match 42?",
      "The Flipkart letter is in hand though, I need you to get closer.",
      "Where can we land on this?",
      "Fine, if you add an early joining bonus I'll sign.",
    ],
    band: { initialOffer: 28, maxStretch: 40, walkAway: 22, hasEquity: true },
  },
  {
    name: "S3 Hinglish pushes",
    turns: [
      "Abhi 24 LPA pe hoon, 5 saal ka experience hai.",
      "Mujhe 34 chahiye total.",
      "Thoda aur ho sakta hai kya?",
      "Yaar thoda stretch karo na.",
      "Theek hai, agar joining bonus mil jaye toh done.",
    ],
  },
  {
    name: "S4 withholding CTC then lowball-from-us pressure",
    turns: [
      "I'd rather not share my current CTC.",
      "Let's just say I'm looking for 38 LPA.",
      "That offer feels low. Can you do better?",
      "Is that it?",
      "I need at least 35 to consider this seriously.",
      "Okay 35 works, I'm in.",
    ],
  },
  {
    name: "S5 notice-period + joining-date depth",
    turns: [
      "I'm at 32 LPA, 8 years, currently serving notice.",
      "I'm targeting 40 LPA.",
      "My notice is 90 days — can you buy it out?",
      "Can I join earlier if you cover the buyout?",
      "Great, then I accept at the revised number.",
    ],
  },
];

function runScenario(sc: Scenario): SimTurn[] {
  return runConversation({
    sessionId: sc.name.replace(/\s+/g, "-"),
    band: sc.band ?? band,
    turns: sc.turns,
  }).transcript;
}

describe("negotiation battery — register + fluency output contracts", () => {
  for (const sc of SCENARIOS) {
    it(`${sc.name}: every line is clean Indian-HR register`, () => {
      for (const t of runScenario(sc)) {
        const v = registerViolations(t.aiText);
        expect(v, `register violation in: ${t.aiText}`).toEqual([]);
      }
    });

    it(`${sc.name}: every line is fluent (no stacked fillers / broken caps)`, () => {
      for (const t of runScenario(sc)) {
        const v = fluencyViolations(t.aiText);
        expect(v, `fluency violation in: ${t.aiText}`).toEqual([]);
      }
    });

    it(`${sc.name}: no content-free filler once an offer is on the table`, () => {
      for (const t of runScenario(sc)) {
        if (t.highestOfferMade > 0) {
          expect(
            fillerHit(t.aiText),
            `filler shipped over a standing offer: ${t.aiText}`,
          ).toBeNull();
        }
      }
    });
  }
});

describe("negotiation battery — reaches a real close", () => {
  it("S1 happy-path accepts and terminates", () => {
    const transcript = runScenario(SCENARIOS[0]);
    const last = transcript[transcript.length - 1];
    expect(last.terminal, "S1 should reach a terminal phase").toBe(true);
    expect(last.phase).toBe("accepted");
  });

  it("S5 buyout path accepts and terminates", () => {
    const transcript = runScenario(SCENARIOS[4]);
    const last = transcript[transcript.length - 1];
    expect(last.terminal, "S5 should reach a terminal phase").toBe(true);
    expect(last.phase).toBe("accepted");
  });
});
