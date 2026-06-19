/* Polish 1 (2026-05-16) — multi-anchor escalation hierarchy.
 *
 * Currently every kernel hedge anchors to "leadership". Real Indian
 * recruiters route through different escalation points based on what's
 * being asked. The canonical prose now selects an escalation anchor
 * from a small hierarchy via `selectEscalationAnchor(action, state)`:
 *
 *   - Number/fitment hedge (counter-offer, retention-bonus, joining-bonus,
 *     close-accept) → "finance for fitment approval"
 *   - Grade/title hedge (lever-grade-upgrade) → "HR ops on the grade mapping"
 *   - Notice waiver / joining date (info-disclosure[notice],
 *     lever-relocation) → "the hiring manager"
 *   - Equity grant (lever-rsu-refresh) → "the comp team"
 *   - Default / other → "leadership"
 */
import { describe, it, expect } from "vitest";
import {
  renderCanonicalProse,
  selectEscalationAnchor,
} from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s-anchor", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

describe("selectEscalationAnchor — anchor hierarchy", () => {
  const s = baseState({ highestOfferMade: 22 });

  it("counter-offer → finance for fitment approval", () => {
    const a: NextAction = { kind: "counter-offer", counterTotalLpa: 25 } as NextAction;
    expect(selectEscalationAnchor(a, s)).toBe("finance for fitment approval");
  });

  it("lever-retention-bonus → finance for fitment approval", () => {
    const a: NextAction = { kind: "lever-retention-bonus" } as NextAction;
    expect(selectEscalationAnchor(a, s)).toBe("finance for fitment approval");
  });

  it("lever-joining-bonus-explained → finance for fitment approval", () => {
    const a: NextAction = { kind: "lever-joining-bonus-explained" } as NextAction;
    expect(selectEscalationAnchor(a, s)).toBe("finance for fitment approval");
  });

  it("close[accept] → finance for fitment approval (number/fitment hedge)", () => {
    const a: NextAction = { kind: "close", mode: "accept" } as NextAction;
    expect(selectEscalationAnchor(a, s)).toBe("finance for fitment approval");
  });

  it("auto-accept → finance for fitment approval", () => {
    const a: NextAction = { kind: "auto-accept" } as NextAction;
    expect(selectEscalationAnchor(a, s)).toBe("finance for fitment approval");
  });

  it("lever-grade-upgrade → HR ops on the grade mapping", () => {
    const a: NextAction = { kind: "lever-grade-upgrade" } as NextAction;
    expect(selectEscalationAnchor(a, s)).toBe("HR ops on the grade mapping");
  });

  it("info-disclosure[notice] → the hiring manager (notice/joining hedge)", () => {
    const a: NextAction = { kind: "info-disclosure", topic: "notice" } as NextAction;
    expect(selectEscalationAnchor(a, s)).toBe("the hiring manager");
  });

  it("lever-relocation → the hiring manager (joining date / relocation)", () => {
    const a: NextAction = { kind: "lever-relocation" } as NextAction;
    expect(selectEscalationAnchor(a, s)).toBe("the hiring manager");
  });

  it("lever-rsu-refresh → the comp team", () => {
    const a: NextAction = { kind: "lever-rsu-refresh" } as NextAction;
    expect(selectEscalationAnchor(a, s)).toBe("the comp team");
  });

  it("default fallback → leadership (e.g. lever-explore)", () => {
    const a: NextAction = { kind: "lever-explore", from: "default" } as NextAction;
    expect(selectEscalationAnchor(a, s)).toBe("leadership");
  });

  it("default fallback → leadership (e.g. hold-firm)", () => {
    const a: NextAction = { kind: "hold-firm", mode: "verbal-accept" } as NextAction;
    expect(selectEscalationAnchor(a, s)).toBe("leadership");
  });
});

describe("renderCanonicalProse — uses selected escalation anchor", () => {
  const s = baseState({ highestOfferMade: 22 });

  it("close[accept] canonical mentions finance for fitment approval", () => {
    const prose = renderCanonicalProse(
      { kind: "close", mode: "accept" } as NextAction,
      s,
    );
    expect(prose).toMatch(/finance for fitment approval/i);
    expect(prose).not.toMatch(/past leadership/i);
  });

  it("auto-accept canonical mentions finance for fitment approval", () => {
    const prose = renderCanonicalProse({ kind: "auto-accept" } as NextAction, s);
    expect(prose).toMatch(/finance for fitment approval/i);
  });

  it("lever-grade-upgrade canonical mentions HR ops on the grade mapping", () => {
    const prose = renderCanonicalProse(
      { kind: "lever-grade-upgrade" } as NextAction,
      s,
    );
    expect(prose).toMatch(/HR ops on the grade mapping/i);
    expect(prose).not.toMatch(/check with leadership/i);
  });

  it("lever-retention-bonus canonical mentions finance for fitment approval", () => {
    const prose = renderCanonicalProse(
      { kind: "lever-retention-bonus" } as NextAction,
      s,
    );
    expect(prose).toMatch(/finance for fitment approval/i);
  });

  it("lever-relocation canonical mentions the hiring manager", () => {
    const prose = renderCanonicalProse(
      { kind: "lever-relocation" } as NextAction,
      s,
    );
    expect(prose).toMatch(/the hiring manager/i);
  });
});

describe("renderCanonicalProse — escalating verbatim-repeat breaker", () => {
  /* Adversarial-sweep fix (2026-06-19). When the line the kernel is about
   * to ship normalizes EQUAL to the prior AI line (state.lastAiText) AND an
   * offer genuinely stands (highestOfferMade > 0), the candidate is
   * stonewalling and the planner has nothing fresh. Instead of shipping the
   * identical hold/stall a second time (a verbatim loop the user would
   * rightly complain about), the prose boundary emits a forward-moving
   * decision-deadline close-out — what a real recruiter does when a number
   * is already on the table and the candidate keeps circling. */
  const HELD = baseState({ highestOfferMade: 24 });
  const action: NextAction = { kind: "counter-offer", counterTotalLpa: 24 } as NextAction;

  it("ships the SAME line once, then escalates to a close-out on the verbatim repeat", () => {
    const first = renderCanonicalProse(action, HELD);
    expect(first.trim().length).toBeGreaterThan(0);

    /* Second turn: the prior AI line is exactly what we just shipped. */
    const repeated = renderCanonicalProse(action, { ...HELD, lastAiText: first });
    expect(repeated).not.toBe(first);
    /* The close-out is a forward-moving decision beat, not another hold. */
    expect(repeated).toMatch(/circling|stretched as far|round in circles/i);
    expect(repeated).toMatch(/₹24L/);
  });

  it("does NOT escalate pre-anchor (no offer on the table yet)", () => {
    const PRE = baseState({ highestOfferMade: 0 });
    const first = renderCanonicalProse(action, PRE);
    const repeated = renderCanonicalProse(action, { ...PRE, lastAiText: first });
    /* Pre-anchor verbatim repeats are handled upstream (parsing /
     * negotiate-turn same-response guard), NOT by the close-out breaker —
     * which would be nonsensical with no number to close on. */
    expect(repeated).not.toMatch(/round in circles|shall I go ahead and start rolling out/i);
  });
});
