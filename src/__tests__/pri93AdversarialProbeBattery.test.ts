/* PRI-93 (2026-07-11) — a fresh ADVERSARIAL PROBE of the acceptance-classifier
 * (a new hostile-accept × genuine-accept matrix, distinct from pri73–92) surfaced
 * a NON-NUMERIC DIRECTIONAL-DEMAND leak family — six figureless "move the offer
 * toward me" idioms welded to a close, all fixed at the single superset gate both
 * acceptance gates consult — the demand-intent extractor (_utterance-intent.ts) —
 * NOT patched into the classifier:
 *
 *   LEAK A — CONVERGENCE idioms with no figure and no named lever: "round it up",
 *     "split the difference", "meet me halfway", "close the gap". Each imperatively
 *     moves the standing offer UPWARD (round up, or land at a midpoint / the
 *     candidate's ask above the offer), yet every figure- and lever-anchored core
 *     missed them, so "Let's split the difference and I'll sign." / "Meet me halfway
 *     and I'm in." false-closed at the un-bumped ₹40. New "convergence-demand" core
 *     — always unmet (all move the offer up), present-imperative so PAST-tense
 *     satisfaction ("you met me halfway, I accept") is NOT caught.
 *
 *   LEAK B — a NAMED-PARTY comparative quoted possessively: "Match Google's offer
 *     and I'll sign." The beat-match core bound only pronoun determiners
 *     (their/the/my … offer), so a competitor's offer named possessively slipped it.
 *     Widened beat-match's object set with a `<name>'s (offer|number|…)` arm —
 *     matching a third party's offer is inherently an upward ask.
 *
 *   LEAK C — a TITLE/level grant via a grant/promote verb: "Give me the senior title
 *     and I'll sign.", "Get me to staff level and I accept." title-upgrade only fired
 *     on the "make it a …" frame, so a grant-verb governing a title noun slipped it.
 *     New "title-grant" core — a title/level upgrade is a fresh unmet demand, not an
 *     accept.
 *
 * Pins both polarities. The overreach guards that keep genuine accepts intact:
 *   - a PAST-tense convergence reference ("You met me halfway, I accept.") describes
 *     movement that ALREADY happened → NOT vetoed;
 *   - a bare procedural close ("I'll take it.", "You've got a deal.") has no lever,
 *     no figure, no convergence idiom → still accepts.
 */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // LEAK A — convergence idioms, no figure
  "Round it up and I'll take it.",
  "Let's split the difference and I'll sign.",
  "Meet me halfway and I'm in.",
  "Close the gap to my ask and I accept.",
  "Just meet in the middle and we have a deal.",
  "Bridge the gap and I'll sign today.",
  // LEAK B — named-party comparative, possessive
  "Match Google's offer and I'll sign.",
  "Beat Amazon's number and we're done.",
  // LEAK C — title/level grant via a grant/promote verb
  "Give me the senior title and I'll sign.",
  "Get me to staff level and I accept.",
  "Promote me to principal and we have a deal.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  "I accept.",
  "I accept the offer.",
  "You've got a deal.",
  "Alright, I'm in at 40.",
  "I'll take it.",
  // PAST-tense convergence: the movement already happened → satisfaction, not demand
  "You met me halfway, I accept.",
  "You closed the gap — deal.",
  // references a role/title without any grant verb → not a demand
  "This role is a great fit, I accept the offer.",
];

describe("PRI-93 adversarial battery — convergence, named-party & title-grant leaks", () => {
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
