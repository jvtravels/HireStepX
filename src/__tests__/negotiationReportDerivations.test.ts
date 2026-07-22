/* PDF#45 audit regression (2026-05-26).
 *
 * These tests lock the *honest* contract of the report's
 * derivation layer after the data-honesty fix:
 *
 *   1. `deriveConcessionsFromOffers` MUST return [] — no inference
 *      of "held / deflected / conceded" from offer-delta math.
 *   2. `deriveAnchorBracket` MUST NOT fabricate a `type: "single"`
 *      verdict when the candidate named a counter but the
 *      classifier produced no bracket. It returns `null` in that
 *      case so the panel renders an honest empty state.
 *   3. `deriveAnchorBracket` MUST still return `type: "none"` when
 *      the candidate did NOT name a counter — that branch is
 *      factual (candidateAsk is tracked, not inferred).
 *   4. `derivePhases` lights up phases on the documented action
 *      signals, never on trivial presence.
 *   5. `computeNpvRows` is a pure function of NPV_MODEL — the
 *      tests use the named constants so changing the slab in one
 *      place moves the expected values too.
 *
 * If any of these regress, the report goes back to lying to users.
 * Treat a red here as a P0.
 */
import { describe, it, expect } from "vitest";
import {
  NPV_MODEL,
  derivePhases,
  deriveConcessionsFromOffers,
  deriveAnchorBracket,
  computeNpvRows,
  negotiationHeadlineVerdict,
  type NegotiationOutcome,
} from "../sessionReport/derivations";

function makeOutcome(overrides: Partial<NegotiationOutcome> = {}): NegotiationOutcome {
  return {
    offers: [],
    finalTotal: null,
    outcome: "no_agreement",
    candidateAsk: null,
    ...overrides,
  } as NegotiationOutcome;
}

describe("deriveConcessionsFromOffers (P0 — no fabricated verdicts)", () => {
  it("returns [] with no offers", () => {
    expect(deriveConcessionsFromOffers(makeOutcome())).toEqual([]);
  });

  it("returns [] even when offers move upward (would have been 'held')", () => {
    const o = makeOutcome({
      offers: [
        { turn: 1, total: 20, question: "" },
        { turn: 3, total: 24, question: "" },
      ],
    });
    expect(deriveConcessionsFromOffers(o)).toEqual([]);
  });

  it("returns [] even when offers stay flat (would have been 'conceded')", () => {
    const o = makeOutcome({
      offers: [
        { turn: 1, total: 20, question: "" },
        { turn: 3, total: 20, question: "" },
        { turn: 5, total: 20, question: "" },
      ],
    });
    expect(deriveConcessionsFromOffers(o)).toEqual([]);
  });
});

describe("deriveAnchorBracket (P0 — kills 'single' fabrication)", () => {
  it("returns the classifier-supplied bracket verbatim when present", () => {
    const bracket = {
      type: "range_with_justification" as const,
      quote: "I'm targeting 28-32 based on recent offers",
      verdict: "Strong defended range — well anchored.",
    };
    const o = makeOutcome({ candidateAsk: 30, anchorBracket: bracket });
    expect(deriveAnchorBracket(o)).toBe(bracket);
  });

  it("returns type: 'none' (factual) when candidate named no counter", () => {
    const result = deriveAnchorBracket(makeOutcome({ candidateAsk: null }));
    expect(result).not.toBeNull();
    expect(result!.type).toBe("none");
    expect(result!.verdict).toMatch(/didn't name a counter-number/i);
  });

  it("returns null when candidate DID name a counter but classifier produced no bracket", () => {
    // Prior buggy behavior was to fabricate type: "single" with a
    // "you should have defended a range" verdict. New contract: null.
    const result = deriveAnchorBracket(makeOutcome({ candidateAsk: 30 }));
    expect(result).toBeNull();
  });
});

describe("derivePhases (grounded action-signal gating — REPORT-6)", () => {
  it("no counter, no signals → every stage missing", () => {
    const phases = derivePhases(makeOutcome());
    expect(phases.map((p) => p.reached)).toEqual([false, false, false, false, false]);
  });

  it("bare counter (no justification signal) lights up ONLY phase 1", () => {
    // REPORT-6: naming a number no longer auto-credits 'justified'.
    const phases = derivePhases(makeOutcome({ candidateAsk: 30 }));
    expect(phases[0].reached).toBe(true);
    expect(phases[1].reached).toBe(false);
    expect(phases[2].reached).toBe(false);
    expect(phases[3].reached).toBe(false);
  });

  it("recruiter offers ALONE never credit the candidate (anti-fabrication)", () => {
    // Three rising recruiter offers but zero candidate-action signals →
    // stages 2/3/4 stay unreached. This is the core REPORT-6 fix.
    const phases = derivePhases(
      makeOutcome({
        candidateAsk: 30,
        offers: [
          { turn: 1, total: 20, question: "" },
          { turn: 3, total: 22, question: "" },
          { turn: 5, total: 24, question: "" },
        ],
      }),
    );
    expect(phases[1].reached).toBe(false);
    expect(phases[2].reached).toBe(false);
    expect(phases[3].reached).toBe(false);
  });

  it("a defended range reaches phase 2 (justified)", () => {
    const phases = derivePhases(
      makeOutcome({
        candidateAsk: 30,
        anchorBracket: { type: "range_with_justification", quote: "", verdict: "" },
      }),
    );
    expect(phases[1].reached).toBe(true);
    expect(phases[1].note).toBe("Framed a defended range");
  });

  it("a Voss tactic reaches phases 2 (justified) + 3 (pushback handled)", () => {
    const phases = derivePhases(
      makeOutcome({ candidateAsk: 30, tacticsUsed: ["calibrated-question"] }),
    );
    expect(phases[1].reached).toBe(true);
    expect(phases[2].reached).toBe(true);
  });

  it("a held/deflected classifier pushback reaches phase 3", () => {
    const phases = derivePhases(
      makeOutcome({
        candidateAsk: 30,
        pushbacks: [{ pushback: "budget is tight", outcome: "held", detail: "" }],
      }),
    );
    expect(phases[2].reached).toBe(true);
  });

  it("S16-B5: leverDiversity alone (a RECRUITER-side signal) does NOT reach phase 4", () => {
    // `leverDiversity` counts the recruiter's move levers and is ≥1 once any
    // turn occurs — it must not credit the candidate for exploring levers.
    const phases = derivePhases(makeOutcome({ candidateAsk: 30, leverDiversity: 2, infoAsked: [] }));
    expect(phases[3].reached).toBe(false);
    expect(phases[3].note).toBeUndefined();
  });

  it("infoAsked reaches phases 2 (justified) + 4 (levers)", () => {
    // S19-B6: stage 4 only reaches on expert-level lever intents (clawback-period,
    // vest-schedule, strike-price, etc.) — not on generic routing intents.
    const phases = derivePhases(
      makeOutcome({ candidateAsk: 30, infoAsked: ["vest-schedule"] }),
    );
    expect(phases[1].reached).toBe(true);
    expect(phases[3].reached).toBe(true);
  });

  /* S13-B9 — recruiter-ELICITED disclosure must NOT credit stage 2 ("You
     justified your number"). Stage 2 now keys on the candidate-INITIATED
     subset (infoAskedInitiated); stage 4 (explored levers) still keys on the
     full infoAsked set (an elicited component ask is still a real component
     ask). */
  it("S13-B9: recruiter-elicited-only disclosure does NOT reach phase 2 (justified)", () => {
    // The candidate disclosed comp structure, but ONLY because the recruiter
    // asked — infoAskedInitiated is empty. Stage 2 must stay unreached.
    const phases = derivePhases(
      makeOutcome({
        candidateAsk: 30,
        infoAsked: ["fixed-vs-variable"],
        infoAskedInitiated: [],
      }),
    );
    expect(phases[1].reached).toBe(false);
    expect(phases[1].note).toBeUndefined();
  });

  it("S13-B9: candidate-INITIATED justification DOES reach phase 2 (justified)", () => {
    const phases = derivePhases(
      makeOutcome({
        candidateAsk: 30,
        infoAsked: ["clawback-period"],
        infoAskedInitiated: ["clawback-period"],
      }),
    );
    expect(phases[1].reached).toBe(true);
    expect(phases[1].note).toBe("Asked about comp structure to support it");
  });

  it("S13-B9: legacy row without infoAskedInitiated falls back to infoAsked (behaviour unchanged)", () => {
    // Rows persisted before the split have NO infoAskedInitiated key; the
    // adapter back-fills from infoAsked so their stage-2 behaviour is preserved.
    const phases = derivePhases(
      makeOutcome({ candidateAsk: 30, infoAsked: ["vest-schedule"] }),
    );
    expect(phases[1].reached).toBe(true);
  });

  /* S3-B2 — Phase-11 hike-rationale (rationaleKind) must credit stage 2
     ("You justified your number") when the candidate gave a grounded reason
     for their ask. Without this, market-data / YOE / competing-offer
     justifications were invisible to the stage tracker. */
  it("S3-B2: rationaleKind 'market-data' reaches phase 2 with the right note", () => {
    const phases = derivePhases(makeOutcome({ candidateAsk: 30, rationaleKind: "market-data" }));
    expect(phases[1].reached).toBe(true);
    expect(phases[1].note).toBe("Backed it with market-rate data");
  });

  it("S3-B2: rationaleKind 'competing-offer' reaches phase 2 with the right note", () => {
    const phases = derivePhases(makeOutcome({ candidateAsk: 30, rationaleKind: "competing-offer" }));
    expect(phases[1].reached).toBe(true);
    expect(phases[1].note).toBe("Used a competing offer as the anchor");
  });

  it("S3-B2: rationaleKind 'tenure-yoe' reaches phase 2 with the right note", () => {
    const phases = derivePhases(makeOutcome({ candidateAsk: 30, rationaleKind: "tenure-yoe" }));
    expect(phases[1].reached).toBe(true);
    expect(phases[1].note).toBe("Justified by experience and tenure");
  });

  it("S3-B2: rationaleKind 'scope-expansion' reaches phase 2 with the right note", () => {
    const phases = derivePhases(makeOutcome({ candidateAsk: 30, rationaleKind: "scope-expansion" }));
    expect(phases[1].reached).toBe(true);
    expect(phases[1].note).toBe("Justified by expanded scope and responsibility");
  });

  it("S3-B2: rationaleKind 'specialization' reaches phase 2 with the right note", () => {
    const phases = derivePhases(makeOutcome({ candidateAsk: 30, rationaleKind: "specialization" }));
    expect(phases[1].reached).toBe(true);
    expect(phases[1].note).toBe("Justified by niche skill or specialization");
  });

  it("S3-B2: unknown rationaleKind reaches phase 2 with the fallback note", () => {
    const phases = derivePhases(makeOutcome({ candidateAsk: 30, rationaleKind: "col-relocation" }));
    expect(phases[1].reached).toBe(true);
    expect(phases[1].note).toBe("Gave a grounded reason for the number");
  });

  it("S3-B2: bare counter with NO rationaleKind does NOT reach phase 2 (anti-fabrication)", () => {
    // Verifies rationaleKind=undefined does not credit stage 2 on its own.
    const phases = derivePhases(makeOutcome({ candidateAsk: 30 }));
    expect(phases[1].reached).toBe(false);
  });

  it("outcome accepted → phase 5 reached, named 'You closed the deal', 'Accepted' note", () => {
    const phases = derivePhases(makeOutcome({ outcome: "accepted" }));
    expect(phases[4].reached).toBe(true);
    expect(phases[4].name).toBe("You closed the deal");
    expect(phases[4].note).toBe("Accepted");
  });

  /* PRI-63 — a walk-away reaches the close STAGE but must not render under
   * "You closed the deal"; the name tracks the milestone, the note the outcome. */
  it("outcome walked_away → phase 5 reached, named 'You reached the close', 'Walked away' note", () => {
    const phases = derivePhases(makeOutcome({ outcome: "walked_away" }));
    expect(phases[4].reached).toBe(true);
    expect(phases[4].name).toBe("You reached the close");
    expect(phases[4].note).toBe("Walked away");
  });

  it("outcome no_agreement → phase 5 NOT reached", () => {
    const phases = derivePhases(makeOutcome({ outcome: "no_agreement" }));
    expect(phases[4].reached).toBe(false);
  });
});

describe("computeNpvRows (pure function of NPV_MODEL)", () => {
  it("returns [] when there are no offers", () => {
    expect(computeNpvRows(makeOutcome())).toEqual([]);
  });

  it("returns [] when opening and closing are equal (zero delta)", () => {
    const o = makeOutcome({
      offers: [
        { turn: 1, total: 20, question: "" },
        { turn: 3, total: 20, question: "" },
      ],
      finalTotal: 20,
    });
    expect(computeNpvRows(o)).toEqual([]);
  });

  it("positive delta produces +signed tone=good rows that scale by NPV_MODEL", () => {
    const o = makeOutcome({
      offers: [
        { turn: 1, total: 20, question: "" },
        { turn: 3, total: 24, question: "" },
      ],
      finalTotal: 24,
    });
    const rows = computeNpvRows(o);
    expect(rows).toHaveLength(4);
    const delta = 4;
    const fourYr = delta * NPV_MODEL.horizonYears;
    const afterTax = Math.round(fourYr * (1 - NPV_MODEL.incomeTaxRate) * 10) / 10;
    const npv = Math.round(afterTax * NPV_MODEL.inflationDiscountFactor * 10) / 10;
    expect(rows[0].value).toBe(`+₹${fourYr}L`);
    expect(rows[1].value).toBe(`+₹${afterTax}L take-home`);
    expect(rows[2].value).toBe(`+₹${npv}L`);
    expect(rows[3].value).toBe(`+₹${npv}L`);
    expect(rows.every((r) => r.tone === "good")).toBe(true);
    expect(rows[0].label).toMatch(/Extra base salary over \d+ years/);
  });

  it("negative delta produces minus-signed tone=bad rows with 'Missed' label", () => {
    const o = makeOutcome({
      offers: [
        { turn: 1, total: 24, question: "" },
        { turn: 3, total: 20, question: "" },
      ],
      finalTotal: 20,
    });
    const rows = computeNpvRows(o);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.tone === "bad")).toBe(true);
    expect(rows[0].label).toMatch(/^Missed base salary/);
    // Minus sign is the typographic "−" (U+2212), not ASCII hyphen.
    expect(rows[0].value.startsWith("−₹")).toBe(true);
    expect(rows[3].label).toMatch(/what accepting cost you/i);
  });

  it("falls back to last offer total when finalTotal is null", () => {
    const o = makeOutcome({
      offers: [
        { turn: 1, total: 20, question: "" },
        { turn: 3, total: 24, question: "" },
      ],
      finalTotal: null,
    });
    const rows = computeNpvRows(o);
    expect(rows[0].value).toBe(`+₹${4 * NPV_MODEL.horizonYears}L`);
  });

  it("label percentages reflect NPV_MODEL constants", () => {
    const o = makeOutcome({
      offers: [
        { turn: 1, total: 20, question: "" },
        { turn: 3, total: 24, question: "" },
      ],
      finalTotal: 24,
    });
    const rows = computeNpvRows(o);
    expect(rows[1].label).toContain(`${Math.round(NPV_MODEL.incomeTaxRate * 100)}%`);
    expect(rows[2].label).toContain(`${Math.round(NPV_MODEL.annualInflation * 100)}%`);
  });
});

/* REPORT-3e (2026-07-13, live staging — session 686b5699, Senior Product
 * Designer @ Flipkart): the hero headline verdict is now kernel-derived, not the
 * raw LLM string. On a no-counter/no-deal session the LLM produced "You
 * negotiated well but didn't quantify results" — a false claim beside the
 * report's own "0 of 5 skills / never named a number", carrying leaked STAR
 * phrasing. Pin the headline to the kernel outcome across every branch: it must
 * never claim negotiation success the kernel denies, and never leak behavioural
 * ("quantify results") wording. */
describe("negotiationHeadlineVerdict — kernel-grounded, never a false success claim", () => {
  const NEGOTIATED_WELL = /negotiated well|great job|strong negotiation|well done/i;
  const BEHAVIOURAL_LEAK = /quantif|STAR|results|situation|task/i;

  it("no-deal, no counter (the live bug) states the miss plainly", () => {
    // Live REPORT-3e shape: the recruiter DID put a number on the table; the
    // candidate never countered, so their opening stood. (S17-B2: the empty-
    // offers variant now reads "before any number was on the table" — covered
    // in negotiationReportSurfaceRegression.test.ts.)
    const v = negotiationHeadlineVerdict(
      makeOutcome({
        outcome: "no_agreement",
        candidateAsk: null,
        offers: [{ turn: 1, total: 50, question: "" }],
        finalTotal: null,
      }),
    );
    expect(v).not.toMatch(NEGOTIATED_WELL);
    expect(v).not.toMatch(BEHAVIOURAL_LEAK);
    expect(v.toLowerCase()).toContain("no counter");
  });

  it("no-deal after countering says the deal never closed", () => {
    const v = negotiationHeadlineVerdict(
      makeOutcome({ outcome: "no_agreement", candidateAsk: 60, offers: [{ turn: 1, total: 50, question: "" }] }),
    );
    expect(v).not.toMatch(NEGOTIATED_WELL);
    expect(v.toLowerCase()).toContain("never closed");
  });

  it("accepted with upward movement credits the close", () => {
    const v = negotiationHeadlineVerdict(
      makeOutcome({
        outcome: "accepted",
        candidateAsk: 65,
        offers: [{ turn: 1, total: 50, question: "" }],
        finalTotal: 58,
      }),
    );
    expect(v.toLowerCase()).toContain("closed the deal");
    expect(v).not.toMatch(BEHAVIOURAL_LEAK);
  });

  it("accepted flat with a counter says they took the opening", () => {
    const v = negotiationHeadlineVerdict(
      makeOutcome({
        outcome: "accepted",
        candidateAsk: 65,
        offers: [{ turn: 1, total: 51, question: "" }],
        finalTotal: 51,
      }),
    );
    expect(v.toLowerCase()).toContain("closed the deal");
    expect(v.toLowerCase()).toContain("opening");
  });

  it("accepted the first offer with no counter is honest about it", () => {
    const v = negotiationHeadlineVerdict(
      makeOutcome({ outcome: "accepted", candidateAsk: null, offers: [{ turn: 1, total: 51, question: "" }], finalTotal: 51 }),
    );
    expect(v.toLowerCase()).toContain("accepted the first offer");
  });

  it("walked away is never phrased as an acceptance or success", () => {
    const v = negotiationHeadlineVerdict(
      makeOutcome({ outcome: "walked_away", candidateAsk: 70, offers: [{ turn: 1, total: 40, question: "" }], finalTotal: null }),
    );
    expect(v.toLowerCase()).toContain("walked away");
    expect(v).not.toMatch(NEGOTIATED_WELL);
    expect(v.toLowerCase()).not.toContain("accepted");
  });
});
