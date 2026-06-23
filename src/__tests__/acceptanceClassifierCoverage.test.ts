/**
 * Session B (2026-05-14) — Area 5 audit.
 *
 * Corpus coverage for classifyAcceptance in
 * server-handlers/_acceptance-classifier.ts.
 *
 * The classifier's rule-tier precedence (veto → performative →
 * split-clause → soft-alignment → idiom+offer-ref → idiom+gate) is
 * respected. New patterns are surgically added to STRONG_PERFORMATIVE_
 * PATTERNS / COMMITMENT_IDIOM_PATTERNS / SPLIT_CLAUSE_ACCEPTANCE_
 * PATTERNS rather than the classifier being rewritten.
 *
 * `offerOnTable: true` is passed for the strong-acceptance cases so
 * commitment-idiom-only forms (e.g. "deal", "sold") aren't vetoed by
 * the phase-gate. Ambiguous and walked-away cases pass no context so
 * default behavior is exercised.
 */

import { describe, it, expect } from "vitest";
import {
  classifyAcceptance,
  detectExplicitAcceptance,
} from "../../server-handlers/_acceptance-classifier";

const onTable = { offerOnTable: true };

describe("acceptance classifier — strong acceptance forms", () => {
  const cases = [
    "I accept",
    "deal",
    "done",
    "sold",
    "let's go",
    "I'll join",
    "I'm in",
    "works for me",
    "yes I'll take it",
    "okay let's proceed",
    "alright I'll sign",
  ];
  for (const input of cases) {
    it(`"${input}" → accepted`, () => {
      const r = classifyAcceptance(input, onTable);
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(true);
    });
  }
});

describe("acceptance classifier — strong acceptance + follow-up question", () => {
  /* Each acceptance form is followed by an info-seeking question that
   * must NOT veto the acceptance. The split-clause detector + info-
   * seeking-but exception keep these as accepted. */
  const accepts = ["I accept", "I'll join", "I'm in", "deal", "done", "sold", "let's go", "I'll take it", "okay let's proceed"];
  const followUps = [
    "can you tell me about benefits?",
    "do I get RSUs?",
    "when's the start date?",
  ];
  for (const accept of accepts) {
    for (const fu of followUps) {
      const input = `${accept}. ${fu}`;
      it(`"${input}" → accepted (with follow-up)`, () => {
        const r = classifyAcceptance(input, onTable);
        expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(true);
      });
    }
  }
});

describe("acceptance classifier — negation / hesitation must not accept", () => {
  const cases = [
    "I won't take it",
    "not at this number",
    "not yet",
    "I'll think about it",
    "let me check",
    "give me time",
    "hmm, not sure",
  ];
  for (const input of cases) {
    it(`"${input}" → NOT accepted`, () => {
      const r = classifyAcceptance(input, onTable);
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(false);
    });
  }
});

describe("acceptance classifier — ambiguous fillers (without offer on table) must NOT accept", () => {
  /* The phase-gate fires when offerOnTable === false. Bare "okay" /
   * "alright" / "fine" must not promote to acceptance in that path. */
  const cases = ["okay", "I see", "got it", "alright", "fine"];
  for (const input of cases) {
    it(`"${input}" (no offer) → NOT accepted`, () => {
      const r = classifyAcceptance(input, { offerOnTable: false });
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(false);
    });
  }
});

describe("acceptance classifier — walked-away signals must NOT accept", () => {
  const cases = ["I'm out", "I'll pass", "no thank you", "not interested"];
  for (const input of cases) {
    it(`"${input}" → NOT accepted`, () => {
      const r = classifyAcceptance(input, onTable);
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(false);
    });
  }
});

/* 10/10-plan A1 (2026-06-23) — backfill the two thinnest medium-gate
 * banks. Prior to this block, SOFT_ALIGNMENT_PATTERNS (6 arms) and the
 * post-2026-05 HINDI_MIX accept idioms had no direct corpus coverage,
 * so a silent regex break would not have tripped a test. One
 * representative phrase per arm, through the public API, asserts the
 * arm is reachable and behaves under the offer-on-table gate. */
describe("acceptance classifier — SOFT_ALIGNMENT arms (every arm, offer on table)", () => {
  const cases = [
    "I really like your offer", // arm 1: (really/truly) like the/this/your offer
    "I'm aligned with the offer", // arm 2: aligned with/on the offer
    "we've already aligned on your offer", // arm 3: we/i (have) already aligned on/with
    "your offer aligns with my expectations", // arm 4: the/this/your offer aligns with
    "I'm fine with the offer", // arm 5: i'm fine with the/this/your offer
    "I'm good with this offer", // arm 6: i'm good with the/this/your offer
  ];
  for (const input of cases) {
    it(`"${input}" → accepted (soft-alignment)`, () => {
      const r = classifyAcceptance(input, onTable);
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(true);
    });
  }
});

describe("acceptance classifier — HINDI_MIX accept idioms (offer on table)", () => {
  const cases = [
    "theek hai",
    "theek he",
    "ho jayega",
    "kar do",
    "kar lijiye",
    "manzoor hai",
    "haan ok",
    "haan", // bare Hindi affirmative arm
    "chalega",
    "chal jayega",
    "de do",
    "bhej do",
    "aage badho",
  ];
  for (const input of cases) {
    it(`"${input}" → accepted (hindi-mix idiom)`, () => {
      const r = classifyAcceptance(input, onTable);
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(true);
    });
  }
});

describe("acceptance classifier — HINDI_MIX precision (phase-gate + negation must NOT accept)", () => {
  /* The same idioms must NOT close pre-offer (you can't accept what
   * hasn't been offered), and the negated forms are owned by the
   * walk-away veto which runs before any accept pattern. */
  it("Hindi idioms do NOT accept before an offer is on the table", () => {
    for (const input of ["chalega", "theek hai", "haan", "de do"]) {
      const r = classifyAcceptance(input, { offerOnTable: false });
      expect(r.accepted, `pre-offer must NOT accept: ${input}`).toBe(false);
    }
  });
  it("negated Hindi forms are vetoed even with an offer on the table", () => {
    for (const input of ["nahi chalega", "yeh nahi chalega"]) {
      const r = classifyAcceptance(input, onTable);
      expect(r.accepted, `negation must NOT accept: ${input}`).toBe(false);
    }
  });
});

/* Offline hostile sweep (2026-06-23) — two findings from the adversarial
 * accept/close probe, locked as permanent guards:
 *  1. FALSE-CLOSE: "not a chance I sign today" — the "sign today" performative
 *     arm fired because WALK_AWAY_PATTERN lacked "no chance"/"not a chance".
 *     Worst failure mode (finalizing a rejected deal); now vetoed at step 1.
 *  2. MISSED-CLOSE: "let's finalize it" — a deal-referent finalize commit the
 *     CLOSE_CONSENT bank missed; now closes through both gates, while the
 *     negotiating "finalize the base/numbers" forms stay open. */
describe("acceptance classifier — walk-away 'no chance' must NOT false-close", () => {
  const cases = [
    "not a chance I sign today",
    "no chance I'm signing this",
    "not a chance",
    "no chance at this number",
  ];
  for (const input of cases) {
    it(`"${input}" → NOT accepted (walk-away)`, () => {
      const m = classifyAcceptance(input, onTable);
      const s = detectExplicitAcceptance(input);
      expect(m.accepted, `medium reasons=${m.reasons.join(",")}`).toBe(false);
      expect(s.accepted, "strict must also reject").toBe(false);
    });
  }
});

describe("acceptance classifier — 'finalize it' close idiom (both gates)", () => {
  it("deal-referent finalize commits close through both gates", () => {
    for (const input of [
      "let's finalize it",
      "let's finalize this",
      "let us finalize the deal",
      "happy to finalize the offer",
    ]) {
      const m = classifyAcceptance(input, onTable);
      const s = detectExplicitAcceptance(input);
      expect(m.accepted, `medium reasons=${m.reasons.join(",")}`).toBe(true);
      expect(s.accepted, `strict must also accept: ${input}`).toBe(true);
    }
  });
  it("negotiating 'finalize the <component>' forms stay open (no false-close)", () => {
    for (const input of [
      "let's finalize the base first",
      "can we finalize the numbers",
      "let's finalize the split",
    ]) {
      const m = classifyAcceptance(input, onTable);
      expect(m.accepted, `must NOT close: ${input} (${m.reasons.join(",")})`).toBe(false);
    }
  });
  it("deferral-gated finalize stays vetoed", () => {
    const m = classifyAcceptance("let's finalize it once you confirm the base", onTable);
    expect(m.accepted, `reasons=${m.reasons.join(",")}`).toBe(false);
  });
});

/* Offline hostile sweep batch 2 (2026-06-23) — seven FALSE-CLOSE classes from
 * the second adversarial probe, each a close/accept idiom flipped by a
 * continuation the prior vetoes missed. All now rejected through BOTH gates;
 * the matching genuine accepts (no hostile tail) must still close. */
describe("acceptance classifier — batch-2 FALSE-CLOSE vetoes (must NOT accept, both gates)", () => {
  const cases = [
    "I accept the challenge, not the offer", // accept-proposition (challenge)
    "I'm in agreement that it's below market", // i'm-in hedge (agreement)
    "where do I sign up for a better offer", // negotiation-redirect
    "count me in for another round of talks", // negotiation-redirect
    "make it official only after the revision", // deferred-settle-noun
    "lock it in once the bump comes through", // deferred-settle-noun
    "deal — just kidding, that's way too low", // retraction
    "oh sure, like I'd accept that", // sarcastic counterfactual
  ];
  for (const input of cases) {
    it(`"${input}" → NOT accepted`, () => {
      const m = classifyAcceptance(input, onTable);
      const s = detectExplicitAcceptance(input);
      expect(m.accepted, `medium reasons=${m.reasons.join(",")}`).toBe(false);
      expect(s.accepted, "strict must also reject").toBe(false);
    });
  }
});

describe("acceptance classifier — batch-2 precision (genuine accepts still close)", () => {
  /* The new vetoes must NOT swallow the bare idioms they disambiguate. */
  const cases = [
    "I accept the offer", // not accept-the-challenge
    "I'm in", // not i'm-in-agreement
    "where do I sign up", // not sign-up-for-a-better-offer
    "count me in", // not count-me-in-for-another-round
    "let's make it official", // not deferred
    "let's lock it in", // not deferred
  ];
  for (const input of cases) {
    it(`"${input}" → accepted`, () => {
      const r = classifyAcceptance(input, onTable);
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(true);
    });
  }
});

/* Offline hostile sweep batch 3 (2026-06-23) — conditional-RAISE-demand welded
 * to a close idiom ("make it 45 and we have a deal") was a strict-gate
 * FALSE-CLOSE: the close idiom matched while the candidate was still demanding
 * a raise. Now vetoed through both gates via CONDITIONAL_DEMAND_PATTERN, plus
 * two deferred-accept forms the CONDITIONAL_DEFERRAL extension now catches. The
 * genuine "I'll do 45 and sign today" (no raise verb) must still close. */
describe("acceptance classifier — batch-3 conditional-demand FALSE-CLOSE (both gates)", () => {
  const cases = [
    "make it 45 and we have a deal",
    "raise it to 50 and I'll sign",
    "bump it to 48 then we're done",
    "get it to 52 and count me in",
    "let's close it the day you revise the base",
    "deal once you bump my number",
  ];
  for (const input of cases) {
    it(`"${input}" → NOT accepted`, () => {
      const m = classifyAcceptance(input, onTable);
      const s = detectExplicitAcceptance(input);
      expect(m.accepted, `medium reasons=${m.reasons.join(",")}`).toBe(false);
      expect(s.accepted, "strict must also reject").toBe(false);
    });
  }
});

describe("acceptance classifier — batch-3 precision (genuine accepts still close)", () => {
  /* No raise verb → genuine accept; "do 45" is a commitment, not a demand. */
  const cases = [
    "I'll do 45 and sign today",
    "let's make it official",
    "deal, send the paperwork",
  ];
  for (const input of cases) {
    it(`"${input}" → accepted`, () => {
      const r = classifyAcceptance(input, onTable);
      expect(r.accepted, `reasons=${r.reasons.join(",")}`).toBe(true);
    });
  }
});

describe("strict gate — Hindi deal-close idiom routes through detectExplicitAcceptance", () => {
  /* "bhej do offer letter" carries the unambiguous deal-close sense and
   * is shared into the strict gate via CLOSE_CONSENT_IDIOM_PATTERNS, so
   * the kernel closes on it post-offer identically to "send the offer
   * letter". The bare commitment idiom "bhej do" stays medium-only. */
  it("accepts the explicit Hindi close idiom", () => {
    expect(detectExplicitAcceptance("bhej do offer letter").accepted).toBe(true);
  });
  it("does NOT promote the bare 'bhej do' to a strict close", () => {
    expect(detectExplicitAcceptance("bhej do").accepted).toBe(false);
  });
});
