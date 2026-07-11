/* PRI-92 (2026-07-11) — a fresh ADVERSARIAL PROBE of the acceptance-classifier
 * (a new hostile-accept × genuine-accept matrix, distinct from pri73–91) surfaced
 * THREE more false-close LEAKS, all fixed at the single superset gate both
 * acceptance gates consult — the demand-intent extractor (_utterance-intent.ts) —
 * NOT patched into the classifier:
 *
 *   LEAK A — a raise-to-target demand wearing ROUNDING FILLER. The raise-to-target
 *     core anchored "make it <N>" / "get it to <N>", but a rounding qualifier
 *     between the verb and the figure ("make it A ROUND 45", "make it AN EVEN 50")
 *     slipped the pattern, so "Make it a round 45 and I'm in." false-closed at the
 *     un-bumped ₹40. Extended raise-to-target to tolerate an optional rounding
 *     filler (a round / an even / a clean / a flat / a nice / a solid / a cool)
 *     between "make it" and the number. Still offer-gated: 45 > 40 → unmet demand.
 *
 *   LEAK B — a VAGUE RELATIVE bump with no figure at all. "Bump it a little and
 *     I'll sign." / "Nudge the base up a touch and we're done." name no target and
 *     no lever add-on, so every figure-bearing core missed them and the close idiom
 *     dominated → false close. New "vague-relative-bump" core: a bump verb (bump/
 *     nudge/hike/jack/boost/lift/kick) governing an anaphoric/lever object (it/that/
 *     the number/figure/offer/base/fixed/cash/salary/ctc/package/pay) with an
 *     optional direction/magnitude tail (up/higher/a little/a touch/slightly/…).
 *     An upward bump is by definition unmet — no figure, no offer gate.
 *
 *   LEAK C — an ANAPHORIC terms-change: a comp lever named in one clause, then
 *     "fix/sort THAT and I accept" in the next. "The equity's weak — sort that out
 *     and I'll sign." refers to the lever by pronoun, so improve-lever (which needs
 *     the verb adjacent to the lever noun) missed it. New "anaphoric-terms-change"
 *     core: a lookahead requiring a comp lever OR sweetener anywhere in the text,
 *     welded to a change verb (fix/sort/handle/adjust/revise/rework/improve/sweeten)
 *     governing a bare anaphor (that/it/this). An upward terms-change on a named
 *     lever is always an unmet demand.
 *
 * Pins both polarities. The overreach guards that keep genuine accepts intact:
 *   - an accept-after-grumble that merely REFERENCES a low lever without any change
 *     verb ("The base is low, but fine, I accept." / "Honestly not thrilled, but I
 *     accept.") carries no bump/fix imperative → NOT vetoed;
 *   - a bare procedural close ("I'll take it.", "You've got a deal.") has no lever,
 *     no figure, no anaphoric fix → still accepts.
 */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // LEAK A — raise-to-target with rounding filler
  "Make it a round 45 and I'm in.",
  "Make it an even 50 and we have a deal.",
  "Make it a clean 46 and I'll sign.",
  "Get it to a flat 48 and I accept.",
  // LEAK B — vague relative bump, no figure
  "Bump it a little and I'll sign.",
  "Nudge the base up a touch and we're done.",
  "Boost the fixed slightly and I'm in.",
  "Just kick the number up a notch and we have a deal.",
  // LEAK C — anaphoric terms-change on a named lever
  "The equity's weak — sort that out and I'll sign.",
  "The base is light. Fix that and I accept.",
  "Your joining bonus is thin — sweeten that and we're done.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  "I accept.",
  "I accept the offer.",
  "You've got a deal.",
  "Alright, I'm in at 40.",
  "Fine, let's close this — I accept.",
  "I'll take it.",
  // accept-after-grumble: references a low lever but issues NO change verb
  "The base is low, but fine, I accept.",
  "Honestly not thrilled, but I accept.",
  "The equity's weak, but okay — I accept the offer.",
];

describe("PRI-92 adversarial battery — rounding-filler, vague-bump & anaphoric-terms leaks", () => {
  for (const t of HOSTILE_MUST_VETO) {
    it(`vetoes hostile conditional demand: "${t}"`, () => {
      expect(acc(t)).toBe(false);
    });
  }
  for (const t of GENUINE_MUST_ACCEPT) {
    it(`accepts genuine close: "${t}"`, () => {
      expect(acc(t)).toBe(true);
    });
  }
});
