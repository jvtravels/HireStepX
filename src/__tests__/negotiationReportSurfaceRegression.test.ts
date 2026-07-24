/* Report-surface regression lock (2026-07-18 audit).
 *
 * The "Salary Negotiation — Live Scenario Audit" doc tracked a batch of
 * report-display bugs where a negotiation report string contradicted the
 * kernel-authoritative outcome it sat beside. Every OTHER hero/stage surface
 * is now derived from the same kernel outcome, so the whole misattribution /
 * false-close class is retired — but a handful of narrow display strings still
 * mis-read the `offers === []` (no-offer-ever) and recruiter-vs-candidate-signal
 * cases. These tests pin the fixed behaviour of the two pure derivations
 * (`derivePhases`, `negotiationHeadlineVerdict`) so a future "helpful" edit
 * can't silently reintroduce any of them. Each block carries its audit bug id.
 *
 * Pure functions, no kernel replay needed — the whole point of the R-2/PDF#45
 * migration is that these surfaces read one grounded outcome object. */

import { describe, it, expect } from "vitest";
import {
  derivePhases,
  negotiationHeadlineVerdict,
  type NegotiationOutcome,
} from "../sessionReport/derivations";

/* Minimal grounded outcome. Override per test. Defaults describe a
 * no-agreement session with no offer and no candidate action — the hostile
 * baseline the audit rows were found on. */
function outcome(over: Partial<NegotiationOutcome> = {}): NegotiationOutcome {
  return {
    offers: [],
    finalTotal: null,
    outcome: "no_agreement",
    candidateAsk: null,
    gapClosurePct: null,
    leverDiversity: 0,
    tacticsUsed: [],
    infoAsked: [],
    infoAskedInitiated: [],
    ...over,
  } as NegotiationOutcome;
}

const stage = (o: NegotiationOutcome, num: number) =>
  derivePhases(o).find((p) => p.num === num)!;

describe("report-surface audit regression lock", () => {
  it("S16-B5: 'explored package levers' must NOT credit recruiter leverDiversity", () => {
    // Candidate raised no lever and asked about no component, but the recruiter
    // pulled levers (leverDiversity=3). Stage 4 must stay UNREACHED.
    const s4 = stage(outcome({ candidateAsk: 45, leverDiversity: 3, infoAsked: [] }), 4);
    expect(s4.reached).toBe(false);
    expect(s4.note).toBeUndefined();
    // Candidate who asked a specific expert lever question DOES reach it.
    // S19-B6: generic intents (equity, compensation-breakdown, benefits-overview)
    // do not qualify — only the 9 EXPERT_LEVER_INTENTS (vest-schedule, clawback, etc.).
    const reached = stage(outcome({ candidateAsk: 45, leverDiversity: 3, infoAsked: ["vest-schedule"] }), 4);
    expect(reached.reached).toBe(true);
    expect(reached.note).toBe("Asked about non-cash components");
    // Generic-only infoAsked does NOT qualify for the lever stage.
    const generic = stage(outcome({ candidateAsk: 45, leverDiversity: 3, infoAsked: ["compensation-breakdown", "benefits-overview"] }), 4);
    expect(generic.reached).toBe(false);
  });

  it("S16-B4: 'handled their pushback' requires a named counter, not a lone tactic", () => {
    // A calibrated question (tactic) on a pure-discovery session with NO counter
    // must not light up stage 3.
    const noCounter = stage(outcome({ candidateAsk: null, tacticsUsed: ["calibrated-question"] }), 3);
    expect(noCounter.reached).toBe(false);
    // With a counter named, the same tactic legitimately reaches it.
    const withCounter = stage(outcome({ candidateAsk: 50, tacticsUsed: ["calibrated-question"] }), 3);
    expect(withCounter.reached).toBe(true);
  });

  it("S16-B7 / S1-B1: a number with NO prior offer is an opening, not a counter", () => {
    const opening = stage(outcome({ candidateAsk: 38, offers: [] }), 1);
    expect(opening.name).toBe("You named your opening number");
    expect(opening.note).toBe("Asked for ₹38 LPA"); // note stays neutral
    // With a prior recruiter offer it IS a counter.
    const counter = stage(
      outcome({ candidateAsk: 55, offers: [{ turn: 1, total: 50, question: "" }] }),
      1,
    );
    expect(counter.name).toBe("You named a counter number");
    expect(counter.note).toBe("Asked for ₹55 LPA");
  });

  it("S17-B2: no-agreement headline must not claim 'the recruiter's number stood' with no offer", () => {
    expect(negotiationHeadlineVerdict(outcome({ candidateAsk: null, offers: [] }))).toBe(
      "The conversation ended before any number was on the table.",
    );
    // When an offer DID land and no counter was named, the recruiter number stood.
    expect(
      negotiationHeadlineVerdict(
        outcome({ candidateAsk: null, offers: [{ turn: 1, total: 50, question: "" }] }),
      ),
    ).toBe("No counter named — the recruiter's number stood.");
    // S62-B2: opening anchor (no recruiter offer ever tabled) says "named your
    // number", not "countered" — "counter" presumes an offer to respond to.
    expect(negotiationHeadlineVerdict(outcome({ candidateAsk: 55 }))).toBe(
      "You named your number, but no offer came back.",
    );
    // Genuine counter (recruiter made an offer, candidate responded): "countered".
    expect(
      negotiationHeadlineVerdict(
        outcome({ candidateAsk: 58, offers: [{ turn: 1, total: 50, question: "" }] }),
      ),
    ).toBe("You countered, but the deal never closed.");
  });

  it("accepted / walked-away headlines unchanged (no regression)", () => {
    expect(
      negotiationHeadlineVerdict(
        outcome({
          outcome: "accepted",
          candidateAsk: 55,
          offers: [
            { turn: 1, total: 50, question: "" },
            { turn: 3, total: 54, question: "" },
          ],
          finalTotal: 54,
        }),
      ),
    ).toBe("You closed the deal and moved the offer up.");
    expect(negotiationHeadlineVerdict(outcome({ outcome: "walked_away", candidateAsk: 60 }))).toBe(
      "You walked away rather than settle below your counter.",
    );
  });
});
