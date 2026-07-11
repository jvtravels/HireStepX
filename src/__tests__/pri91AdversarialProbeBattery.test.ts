/* PRI-91 (2026-07-11) — a fresh ADVERSARIAL PROBE of the acceptance-classifier
 * (a new hostile-accept × genuine-accept matrix, distinct from pri73–90) surfaced
 * two more false-close LEAKS, both fixed with new DemandCores in the demand-intent
 * extractor (_utterance-intent.ts) — the single superset gate both acceptance
 * gates consult:
 *
 *   LEAK A — a named NON-COMP PERK demanded as a close condition. SWEETENER covers
 *     generic "perks"/"benefits", but a SPECIFIC perk named inline ("give me a
 *     corner office and I'll sign", "throw in a parking spot and we have a deal")
 *     slipped every core, so the perk-conditioned close false-closed at the
 *     un-bumped offer. New "grant-perk" core: a grant verb (give me/throw in/
 *     include/…) governing a concrete perk noun (NONCOMP_PERK: corner office/
 *     parking/company car/gym membership/health cover/laptop/…). A perk is a
 *     fresh ask on top of the package → always unmet, no offer gate.
 *
 *   LEAK B — a counterfactual accept pinned to a HIGHER figure. "Even at 42 I'd
 *     accept, but this is only 40" names the number the offer WOULD need to reach
 *     and disparages the standing offer, yet the bare "I'd accept" dominated and
 *     it false-closed at ₹40. New "counterfactual-accept-higher" core anchors
 *     "even at <N> … I('d)? accept/sign/take it", offer-gated so it only fires
 *     when N beats the offer.
 *
 * Pins both polarities. The overreach guards that keep genuine accepts intact:
 *   - procedural forward-closes carry no perk/figure ("that works, send the
 *     paperwork") → NOT vetoed;
 *   - an at-offer counterfactual ("even at 40 I'd accept" against a ₹40 offer,
 *     40 ≤ 40) is met → still accepts.
 *
 * KNOWN LIMITATION (deliberately NOT fixed here): a temporally-DEFERRED accept
 * ("I'll accept next week", "give me till Monday and I'll sign") is still read as
 * an accept. A deferred accept is genuinely ambiguous with real accept-intent, and
 * temporal deferral is a distinct concern from compensation demand — folding a
 * date-deferral veto into the demand extractor would be patchwork and risks
 * over-blocking legitimate "I'll accept" phrasings. Tracked for a future pass. */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // LEAK A — named non-comp perk welded to a close idiom
  "Give me a corner office and I'll sign.",
  "Throw in a parking spot and we have a deal.",
  "Include a company car and I'm in.",
  "Give me a gym membership and I'll accept.",
  "Throw in health cover and we're done.",
  "Sort out relocation assistance and I'll sign.",
  "Give me a MacBook and it's a deal.",
  // LEAK B — counterfactual accept pinned to a higher figure
  "Even at 42 I'd accept, but this is only 40.",
  "Even at 45 I'd sign, this is too low.",
  "Even at 44 I would take it, but not at 40.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  "I accept.",
  "I accept the offer.",
  "Okay, deal — I accept.",
  "You've got a deal.",
  "Sounds good, let's do it.",
  "Yes, I'll sign today.",
  "Great, I'm in at 40.",
  // procedural forward-close: no perk, no higher figure
  "That works, send the paperwork.",
  "Send me the offer letter and I'll sign.",
  // at-offer counterfactual: 40 ≤ 40 is met, must still accept
  "Even at 40 I'd accept, and this is 40.",
];

describe("PRI-91 adversarial battery — perk-close & counterfactual-higher leaks", () => {
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
