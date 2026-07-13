/* PRI-94 (2026-07-13) — a fresh ADVERSARIAL PROBE of the acceptance-classifier
 * (equity-manipulation × clause-waiver close conditions, distinct from pri73–91)
 * surfaced three more false-close LEAKS, all fixed with new DemandCores in the
 * demand-intent extractor (_utterance-intent.ts) — the single superset gate both
 * acceptance gates consult:
 *
 *   LEAK A — a figureless MULTIPLIER on a named comp lever. "double the stock",
 *     "triple the equity", "2x the base". multiplier-current needs a
 *     "current/present/existing" anchor AND a figure to derive the target, and
 *     vague-relative-bump covers bump/nudge/hike but not double/triple — so a
 *     bare multiplier on a lever slipped every core and false-closed at the
 *     un-bumped offer. New "multiplier-lever" core: a multiplier verb
 *     (double/twice/triple/2x) governing a CORE_COMP ∪ SWEETENER noun. A
 *     multiplier is inherently upward → always unmet, no offer gate.
 *
 *   LEAK B — a leading INCREASE word directly on a lever, no figure. "give me
 *     more RSUs", "more equity", "extra stock". another-more needs a cash/percent
 *     unit after the increase word and demand-for-more needs a TRAILING more, so
 *     "more <lever>" slipped both. New "more-lever" core: more/extra/additional/
 *     further immediately on a CORE_COMP ∪ SWEETENER noun, always unmet. A
 *     definite/possessive-determiner lookbehind keeps "the extra equity is great,
 *     I accept" (satisfaction) an accept.
 *
 *   LEAK C — a demand to WAIVE a coercive contractual clause. "waive the bond
 *     and I'll sign", "drop the lock-in", "scrap the notice period". No core
 *     covered removal-of-a-term (distinct from a comp raise or sweetener add-on),
 *     so it false-closed at terms the candidate is rejecting. New "waive-clause"
 *     core: a present-imperative removal verb (waive/drop/remove/scrap/…)
 *     governing a CLAUSE noun (bond/lock-in/notice period/non-compete/clawback).
 *     Always unmet; \b-bounded verbs keep past-tense satisfaction ("you waived
 *     the bond, deal") an accept.
 *
 * Pins both polarities. The over-block guards that keep genuine accepts intact:
 *   - a sweetener referenced as ALREADY on the table ("the extra equity is
 *     great, I accept") → NOT vetoed (determiner lookbehind);
 *   - a waiver already GRANTED ("you waived the bond, so I'm in") → NOT vetoed
 *     (past tense);
 *   - a waived demand ("I don't need more equity, deal") → NOT vetoed (global
 *     dismissal-tail guard);
 *   - procedural forward-closes carry no lever/clause ("send me the offer letter
 *     and I'll sign") → NOT vetoed. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx as never).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // LEAK A — figureless multiplier on a comp lever
  "Double the stock and I'll accept.",
  "Triple the equity and I'm in.",
  "2x the base and it's a deal.",
  "Double the base and I'll sign.",
  // LEAK B — leading increase word directly on a lever, no figure
  "Give me more RSUs and we have a deal.",
  "Give me more equity and we're done.",
  "Extra stock and I'll take it.",
  // LEAK C — waive a coercive contractual clause
  "Waive the bond and I'll sign.",
  "Drop the lock-in and I'll sign.",
  "Remove the non-compete and I accept.",
  "Scrap the notice period and I'm in.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  "I accept.",
  "Fine, I'll take 40.",
  "Deal.",
  "Yes, works for me.",
  "Let's finalize it.",
  "Send me the offer letter and I'll sign.",
  "That works, send the paperwork.",
  // over-block traps: satisfaction / already-granted / waived demand
  "The extra equity is great, I accept.",
  "You waived the bond, so I'm in.",
  "I don't need more equity, deal.",
  "I'm happy with the stock, deal.",
];

describe("PRI-94 adversarial battery — equity-multiplier, more-lever & clause-waiver leaks", () => {
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
