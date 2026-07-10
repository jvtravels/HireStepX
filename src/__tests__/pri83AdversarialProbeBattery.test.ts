/* PRI-83 (2026-07-10) — surfaced by a fresh ADVERSARIAL PROBE of the
 * acceptance-classifier (a hand-crafted hostile-accept × genuine-accept matrix
 * distinct from the pri73–82 batteries). Three defects, one of each polarity
 * the audit measures, each fixed at the pattern that already owned its class:
 *
 *   LEAK 1 — "I'll accept a better offer, not this one." The accept verb's
 *     DIRECT OBJECT is a comparative-qualified offer. WRONG_OBJECT_ACCEPT
 *     excludes bare "offer" (so "accept the offer" closes) and
 *     NEGOTIATION_REDIRECT only owns the PP form ("sign up FOR a better offer"),
 *     so the direct-object form slipped both → FALSE-CLOSE on a refusal. Fixed
 *     by COMPARATIVE_OFFER_ACCEPT_PATTERN: the comparative adjective is the
 *     single disambiguator (a genuine close never qualifies its object as
 *     better/higher/different).
 *
 *   LEAK 2 — "Deal? Hard pass." The interrogative deal-noun fires the accept
 *     core; "hard pass" / "hard no" is stock emphatic-refusal slang. Added to
 *     the SARCASTIC_REFUSAL bank alongside "in your dreams" / "fat chance".
 *
 *   OVERREACH — "You've got yourself a new hire." A clear hiring idiom
 *     (sibling of "you've got a deal") was MISSED → the bot ignored a real
 *     accept. Added as CLOSE_CONSENT arm 8b with arm 8's subject scaffold.
 *
 * Pins BOTH polarities so neither fix can drift into re-opening the other. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // LEAK 1 — comparative-object accept = accepting a hypothetical superior offer
  "I'll accept a better offer, not this one.",
  "I'd accept a higher number.",
  "Sure, I'll accept a different package.",
  "I only accept a stronger offer than this.",
  "I accept another offer, not yours.",
  // LEAK 2 — stock emphatic-refusal slang welded to a bare close
  "Deal? Hard pass.",
  "Deal? Hard no.",
  "I'll sign — hard pass.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  // OVERREACH — hiring idiom = accepting the job
  "You've got yourself a new hire.",
  "You've got a new hire.",
  "Well, you have a new hire.",
  // Controls — genuine closes whose object carries NO comparative qualifier
  // must remain untouched by the comparative-offer veto.
  "I accept the offer.",
  "I accept your offer, let's do it.",
  "That works — I'll take the offer.",
];

describe("PRI-83 — adversarial-probe leaks stay vetoed", () => {
  for (const t of HOSTILE_MUST_VETO) {
    it(`does NOT accept: "${t}"`, () => expect(acc(t)).toBe(false));
  }
});

describe("PRI-83 — genuine accepts (incl. hiring idiom) still close", () => {
  for (const t of GENUINE_MUST_ACCEPT) {
    it(`accepts: "${t}"`, () => expect(acc(t)).toBe(true));
  }
});
