/* PRI-95 (2026-07-12, batch-19) — a fresh ADVERSARIAL PROBE of the
 * acceptance-classifier surfaced two more FIGURELESS demand families welded to a
 * close. Both fixed at the single superset gate both acceptance gates consult —
 * the demand-intent extractor (_utterance-intent.ts) — NOT patched into the
 * classifier:
 *
 *   LEAK A — BUMP a non-cash lever: "Bump the equity and I accept." The
 *     vague-relative-bump core (bump/nudge/hike/…) pinned its object to a
 *     hardcoded cash-only handle list (base/fixed/cash/ctc/package/salary), so a
 *     bump governing equity/esops/stock/bonus/variable slipped and false-closed
 *     at the un-bumped offer. Fixed by sourcing the bump object from the SHARED
 *     lever vocabulary (CORE_COMP ∪ SWEETENER) the other demand cores already
 *     use — one place to add a lever, covered everywhere.
 *
 *   LEAK B — BENCHMARK-MATCH demand: "match the market", "get me to par with
 *     the team", "get me closer to what I'm worth". A request to lift the offer
 *     to an unnamed external benchmark — distinct from peer-match-demand (needs a
 *     "what <peer> earns" clause) and beat-match (a possessive OFFER object), so
 *     a bare benchmark noun slipped both. New "benchmark-match-demand" core, gated
 *     to a closed benchmark list and the imperative "match" (not the stative
 *     "matches"), with the shared dismissal-tail guard covering the "you don't
 *     have to match the market, I accept" negation trap.
 */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // LEAK A — bump a non-cash lever
  "Bump the equity and I accept.",
  "Nudge the bonus up and I'm in.",
  "Boost the stock and we have a deal.",
  // LEAK B — benchmark-match, unnamed external benchmark
  "Match the market and I accept.",
  "Get me to par with the team and I'll sign.",
  "Just get me closer to what I'm worth and I'm in.",
  "Bring me in line with industry standard and I accept.",
  "Match market rate and we're done.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  "I accept.",
  "Okay, I accept the offer.",
  // NEGATION / WAIVED-DEMAND traps — must not veto the accept
  "No need to improve anything, I accept.",
  "You don't have to match the market — I accept.",
  "Forget the bonus, I'll take it.",
  // stative satisfaction (the offer already matches) → confirmation, not a demand
  "The offer matches the market, so I accept.",
  // bare procedural closes
  "Fine, as it stands, I'm in.",
  "That's plenty, I'll take it.",
];

describe("PRI-95 adversarial battery — bump-any-lever & benchmark-match demands", () => {
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
