/* PRI-94 (2026-07-11, batch-18) — a fresh ADVERSARIAL PROBE of the
 * acceptance-classifier surfaced three more FIGURELESS demand families welded to
 * a close, plus a NEGATION-TRAP false-reject. All fixed at the single superset
 * gate both acceptance gates consult — the demand-intent extractor
 * (_utterance-intent.ts) — NOT patched into the classifier:
 *
 *   LEAK A — VAGUE-IMPROVE demand: "sweeten it a bit", "push it a little",
 *     "make it worth my while", "do a bit better", "come back with a better
 *     number". Each imperatively asks the recruiter to RAISE the offer with no
 *     figure — a sibling of vague-relative-bump (bump/nudge) and
 *     convergence-demand (split the difference), but keyed on the improve verbs
 *     those miss, so they false-closed at the un-bumped offer. New
 *     "vague-improve-demand" core; the directional tail on push/nudge/move and
 *     the compare-verb frame on better keep defer/satisfaction prose out.
 *
 *   LEAK B — PEER-MATCH demand: "match what you paid the last senior hire",
 *     "pay me what the other seniors make". A lift-to-a-cohort-benchmark ask;
 *     beat-match bound only a possessive OFFER object (their/Google's offer), so
 *     the "what <peer> earns" clause slipped it. New "peer-match-demand" core.
 *
 *   LEAK C — FUTURE-GUARANTEE demand: "guarantee a review in six months",
 *     "promise me a raise at review". A forward commitment the recruiter never
 *     granted — welding it to a close fabricates agreement. New
 *     "future-guarantee-demand" core, gated on a commit verb + raise/review noun.
 *
 *   FALSE-REJECT — NEGATION TRAP: "No need to bump it, I'll take it." is a
 *     genuine accept WAIVING a demand, yet the negated "bump it" trigger vetoed
 *     it. Fixed with a single shared dismissal-frame guard in analyzeDemand
 *     ("no need to / don't need / don't have to / not asking for" abutting the
 *     trigger), which also immunizes the new match/more cores against the
 *     "you don't have to match anyone, I accept" trap.
 */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // LEAK A — vague-improve, no figure
  "Sweeten it a bit and I'll take it.",
  "Make it worth my while and I accept.",
  "Push it a little and I'm in.",
  "Come back with a better number and I'll sign.",
  "Do a bit better and I'll take it.",
  // LEAK B — peer-match, unnamed cohort benchmark
  "Match what you paid the last senior hire and I'm in.",
  "Pay me what the other seniors make and I'll sign.",
  // LEAK C — future guarantee
  "Guarantee a review in six months and I accept.",
  "Promise me a raise at review and I accept.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  "I accept.",
  "That works for me, let's close.",
  // NEGATION TRAPS — a waived demand must not veto the accept
  "No need to bump it, I'll take it.",
  "You don't have to match anyone — I accept.",
  "I don't need any more, I accept.",
  // already-satisfied condition → confirmation, not a fresh demand
  "You already added the bonus, so I accept.",
  "Since you bumped it to 45, I'm in.",
  // bare procedural closes
  "Fine, I'll take the offer as it stands.",
  "That's fair, you've got a deal.",
  "Good enough for me, I accept.",
];

describe("PRI-94 adversarial battery — vague-improve, peer-match, future-guarantee & negation traps", () => {
  for (const t of HOSTILE_MUST_VETO) {
    it(`vetoes hostile figureless demand: "${t}"`, () => {
      expect(acc(t)).toBe(false);
    });
  }
  for (const t of GENUINE_MUST_ACCEPT) {
    it(`accepts genuine close: "${t}"`, () => {
      expect(acc(t)).toBe(true);
    });
  }
});
