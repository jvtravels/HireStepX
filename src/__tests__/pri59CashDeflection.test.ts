import { describe, it, expect } from "vitest";
import { runConversation } from "./_negotiationSim";
import { isSalaryPush } from "../../server-handlers/_question-router";
import type { NegotiationBand } from "../../server-handlers/_negotiation-kernel";

/* PRI-59 regression guard (2026-06-25, real prod salary-negotiation session).
 *
 * A candidate stated a competing offer and then made repeated, explicit cash
 * demands ("put your best fixed number on the table", "forget the perks —
 * what's your best fixed, final answer?"). The deterministic planner deflected
 * EVERY such turn to a non-cash lever (WFH promise, then a benefits/insurance
 * recap) and NEVER named where the cash actually stood — reading as evasion of
 * a direct cash demand, the worst real-world failure mode short of a
 * false-close.
 *
 * Root cause was three coordinated gaps, each fixed at its single source:
 *   1. SALARY_PUSH_RE missed the demand-form "best fixed [number]" / "number on
 *      the table" / "forget the perks" phrasings (the canonical cash-push
 *      detector — `_question-router.ts`).
 *   2. the answer-direct reactive branch answered a push as a topic question.
 *   3. the kernel stamps `infoAsked` from keyword presence, so a NEGATED
 *      mention ("forget the PERKS") spuriously triggered the benefits
 *      info-disclosure override.
 *
 * The invariant these tests pin: an explicit cash/fixed PUSH over a standing
 * offer is always answered in CASH terms — the response NAMES the standing
 * fixed figure (the cash anchor) before any non-cash pivot, and is never a
 * pure perks/benefits recap. */

const FLIPKART_EM: NegotiationBand = {
  initialOffer: 44,
  maxStretch: 56,
  walkAway: 38,
  hasEquity: true,
  variableMax: 8,
} as NegotiationBand;

describe("isSalaryPush — demand-form cash pushes (PRI-59)", () => {
  const PUSHES = [
    "Put your best fixed number on the table right now.",
    "What's your best fixed, final answer?",
    "Forget the perks. What's your best fixed?",
    "Forget the benefits — just the base.",
    "Cash only. What can you do on the fixed?",
    "Just give me the best base.",
    "Put a number on the table.",
  ];
  for (const p of PUSHES) {
    it(`detects: "${p}"`, () => {
      expect(isSalaryPush(p)).toBe(true);
    });
  }

  it("does not false-fire on benign topic questions", () => {
    for (const benign of [
      "What's the team size?",
      "Can you move the start date closer to August?",
      "Tell me about the growth path.",
      "What are the standard benefits?",
    ]) {
      expect(isSalaryPush(benign)).toBe(false);
    }
  });
});

describe("planner names the cash anchor on repeated fixed demands (PRI-59)", () => {
  /* The reproduction transcript: competing offer + two explicit numberless
   * cash demands after a standing offer is on the table. */
  const turns = [
    "I'm an EM with 9 years, currently at 48 LPA fixed.",
    "I have a competing offer from Razorpay at 62 LPA fixed. If you can get close to that on cash, I'm ready to sign.",
    "Can you get the fixed to 58 LPA? If you can do that, we have a deal.",
    "Put your best fixed number on the table right now.",
    "Forget the perks. What's your best fixed, final answer?",
  ];

  const { transcript } = runConversation({
    sessionId: "pri59-guard",
    role: "Engineering Manager",
    company: "Flipkart",
    band: FLIPKART_EM,
    initExtras: { applicableYoe: 9, experienceLevel: "senior" },
    stopOnTerminal: false,
    turns,
  });

  /* T4 and T5 are the repeated explicit cash demands (index 4 and 5 in the
   * transcript: index 0 is the opener, 1-5 mirror the five candidate turns). */
  const cashDemandTurns = [transcript[4], transcript[5]];

  it("ships a response for both cash-demand turns", () => {
    expect(cashDemandTurns.every(Boolean)).toBe(true);
  });

  it("names the standing cash anchor on every repeated cash demand", () => {
    for (const t of cashDemandTurns) {
      /* The standing fixed figure (₹55L after the T3 counter) must appear —
       * the candidate hears where the cash stands, not a silent perk pivot. */
      expect(t.aiText).toContain("₹55L");
      expect(t.aiText.toLowerCase()).toMatch(/on the fixed|on cash|the base sits/);
    }
  });

  it("never answers a cash demand with a pure perks/benefits recap", () => {
    for (const t of cashDemandTurns) {
      const lower = t.aiText.toLowerCase();
      /* A benefits/insurance enumeration that does NOT also name the cash
       * anchor is the exact deflection PRI-59 forbids. */
      const isPureBenefitsRecap =
        /medical|insurance|gratuity|\bpf\b|term life/.test(lower) &&
        !lower.includes("₹55l");
      expect(isPureBenefitsRecap).toBe(false);
    }
  });

  /* PRI-65 (2026-06-26) — anti-broken-record. The candidate pinned a fixed
   * close to ₹58L at T3 only; T4/T5 are fresh numberless cash pushes that never
   * restated it. The scope-reconcile line ("On closing at ₹58L fixed …") reads
   * the sticky candidateTargetFixed, so it used to replay verbatim on every
   * later turn — a bot fixated on a stale number. A numberless push must answer
   * in present cash terms (cash-ceiling ack), never re-litigate the old ask. */
  it("does not replay the stale fixed-ask scope-reconcile line on numberless pushes", () => {
    for (const t of cashDemandTurns) {
      expect(t.aiText).not.toContain("On closing at ₹58L fixed");
    }
  });

  it("does not concede free cash above the standing offer on stonewall pushes", () => {
    /* Naming the ceiling must not also bid the number up — the offer stays at
     * the ₹55L reached by the genuine T3 counter. */
    for (const t of cashDemandTurns) {
      expect(t.highestOfferMade).toBeLessThanOrEqual(55.3);
    }
  });
});
