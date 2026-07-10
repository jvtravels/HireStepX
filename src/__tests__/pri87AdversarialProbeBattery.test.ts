/* PRI-87 (2026-07-11) — a fresh ADVERSARIAL PROBE of the acceptance-classifier
 * (a new hostile-accept × genuine-accept matrix, distinct from pri73–86) surfaced
 * an INVERTED-CONDITIONAL false-close LEAK, fixed at a single new arm shared by
 * both gates via FALSE_CLOSE_VETO_PATTERNS:
 *
 *   LEAK — "Were I ten years younger, I'd accept." English forms a hypothetical
 *     protasis two ways: with "if" ("If I were younger, I'd accept") OR by
 *     subject-auxiliary INVERSION that drops "if" ("Were I younger, …", "Should
 *     the number improve, …", "Had the equity been real, …"). The if-form was
 *     already vetoed by the conditional guards, but the inverted form carries no
 *     "if" token, so a fronted irrealis accept — hypothetical, contingent on a
 *     counterfactual that is NOT true — slipped through as a FALSE-CLOSE. Only a
 *     couple were caught incidentally (their protasis happened to name a number
 *     moving); the inverted frame itself was unowned. New
 *     INVERTED_CONDITIONAL_ACCEPT_PATTERN owns it, anchored to clause-initial
 *     "Were/Should/Had" (inversion only ever opens a clause) + a comma-fronted
 *     protasis + a downstream accept verb.
 *
 * Pins both polarities. The overreach guards that keep genuine accepts intact:
 *   - clause-initial anchor: a mid-clause "were/should/had" is ordinary
 *     past/modal, not inversion ("The terms were what I wanted, so I accept.",
 *     "I should accept this." both close — the auxiliary follows its subject);
 *   - the "had" branch also requires a past participle ("been"/an "-ed" word), so
 *     an elided narrative "Had a great chat, I accept." (no participle) still
 *     closes. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // inverted subjunctive "were" protasis governing a hypothetical accept
  "Were I ten years younger, I'd accept.",
  "Were it up to me, I'd accept.",
  "Were the base higher, I would accept this.",
  // inverted "should" hypothetical protasis
  "Should the number improve, I'll accept.",
  "Should you fix the base, I would accept.",
  // inverted "had" past-perfect counterfactual (participle-gated)
  "Had the equity been real, I'd accept.",
  "Had you offered this last year, I would have accepted.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  "I accept.",
  "I accept the offer.",
  "Okay, I accept — let's do it.",
  "You've got a deal.",
  "Sounds good, I accept.",
  // "were" as plain past copula (subject BEFORE it), not an inversion
  "The terms were exactly what I wanted, so I accept.",
  "Your numbers were fair — I accept the offer.",
  "We were aligned, so I accept.",
  // elided narrative "Had a great chat" — no participle → not a conditional
  "Had a great chat, I accept.",
];

describe("PRI-87 — inverted-conditional accepts stay vetoed", () => {
  for (const t of HOSTILE_MUST_VETO) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-87 — genuine accepts still close", () => {
  for (const t of GENUINE_MUST_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
