/* PRI-90 (2026-07-11) — a fresh ADVERSARIAL PROBE of the acceptance-classifier
 * (a new hostile-accept × genuine-accept matrix, distinct from pri73–89) surfaced
 * a TERMS-CHANGE-IMPERATIVE false-close LEAK, fixed with one new DemandCore in the
 * demand-intent extractor (_utterance-intent.ts) — the single superset gate both
 * acceptance gates consult — NOT a new classifier regex:
 *
 *   LEAK — an upward terms-change imperative on a NAMED comp lever welded to a
 *     close idiom. The grant-sweetener core fires an upward verb only when it
 *     lands on a SWEETENER add-on ("sweeten the BONUS"), and verb-magnitude only
 *     fires with an adjacent figure — so a bare "make this lever better" imperative
 *     on a CORE cash component slipped both gates. "Fix the equity and I'll accept."
 *     and "Sweeten the base and we have a deal." FALSE-CLOSED at the un-bumped
 *     offer: the candidate is demanding an unquantified raise, not accepting.
 *     New "improve-lever" DemandCore anchors an upward-only verb (fix/improve/
 *     sweeten/beef up/firm up/revise/bump up/…) directly governing a comp lever
 *     (SWEETENER ∪ CORE_COMP: base/fixed/cash/CTC/package/salary/equity/…). The
 *     verb set is upward-only ("fix the base" can only mean raise it), so it is
 *     always an unmet demand — no figure or offer gate.
 *
 * Pins both polarities. The overreach guards that keep genuine accepts intact:
 *   - procedural forward-closes carry no comp lever ("send me the offer letter and
 *     I'll sign") → NOT vetoed;
 *   - satisfaction references to a lever with no upward verb ("the base works,
 *     deal") → NOT vetoed.
 *
 * NOTE (deliberate, not a bug): "I'll accept that." / "Yes, I accept that." are
 * conservatively NOT read as accepts — "accept that <deixis/clause>" is the
 * concession idiom ("I accept that you're firm, but I'm still not signing"), an
 * ambiguity worth guarding against. A genuine close names the offer/deal ("I
 * accept the offer", "you've got a deal") or stands alone ("I accept."). */
import { describe, it, expect } from "vitest";
import { classifyAcceptance } from "../../server-handlers/_acceptance-classifier";

const ctx = { offerLpa: 40, offerOnTable: true, phase: "counter" };
const acc = (t: string) => classifyAcceptance(t, ctx).accepted;

const HOSTILE_MUST_VETO: string[] = [
  // verb × core-comp-lever matrix
  "Fix the equity and I'll accept.",
  "Sweeten the base and we have a deal.",
  "Improve the CTC and I'm in.",
  "Bump up the cash and it's a deal.",
  "Sort out the package and I'll sign.",
  "Firm up the base and I'll take it.",
  "Beef up the fixed and we're done.",
  "Revise the salary and I accept.",
  "Fix the base and I'll sign today.",
  // verb × sweetener lever (was only partly covered before)
  "Fix the equity story and I'm in.",
  "Improve the joining bonus and we have a deal.",
];

const GENUINE_MUST_ACCEPT: string[] = [
  "I accept.",
  "I accept the offer.",
  "Okay, I accept — let's do it.",
  "You've got a deal.",
  "Sounds good, I accept.",
  "That works for me, I accept.",
  "Great, let's close at 40 — I accept.",
  // procedural forward-close: no comp lever, must still accept
  "Send me the offer letter and I'll sign.",
  "Email me the paperwork and I'm in.",
  // satisfaction reference to a lever with no upward verb
  "The base works for me, deal.",
];

describe("PRI-90 adversarial battery — terms-change-imperative leak", () => {
  for (const t of HOSTILE_MUST_VETO) {
    it(`vetoes hostile terms-change imperative: "${t}"`, () => {
      expect(acc(t)).toBe(false);
    });
  }
  for (const t of GENUINE_MUST_ACCEPT) {
    it(`accepts genuine close: "${t}"`, () => {
      expect(acc(t)).toBe(true);
    });
  }
});
