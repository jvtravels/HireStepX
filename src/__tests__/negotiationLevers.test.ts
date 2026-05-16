/* Fix 1 (2026-05-16) — Real Indian-context negotiation levers.
 *
 * Adds new NextAction kinds for lever rotation:
 *   - lever-grade-upgrade
 *   - lever-retention-bonus
 *   - lever-rsu-refresh         (MNC/GCC only)
 *   - lever-relocation
 *   - lever-perf-bonus-cadence
 *   - lever-joining-bonus-explained
 *   - band-anchor-with-rationale
 *
 * Walk-away gap-gate: candidateTarget > bandCeiling * 1.5 → walk-away
 * regardless of turn count.
 *
 * Lever rotation MUST sample on marketMode (RSU refresh only for
 * MNC/GCC). Tracking via state.leversFired (Set<string>).
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../server-handlers/_next-action-planner";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const init = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s-lev", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

describe("Fix 1 — Indian-context negotiation levers", () => {
  it("walk-away gap-gate: target > ceiling * 1.5 → walk-away regardless of turn count", () => {
    // ceiling 28; 28*1.5=42. Set target above that with low turn count.
    const s = init({
      phase: "counter-offer",
      candidateTarget: 45,
      turnIndex: 2,
      minTurnsBeforeClose: 8,
      highestOfferMade: 22,
    });
    const action = planNextAction(s);
    expect(action.kind).toBe("live-walk-away");
    if (action.kind === "live-walk-away") expect(action.mode).toBe("walk");
  });

  it("walk-away gap-gate NOT triggered when target within 1.5× ceiling", () => {
    const s = init({
      phase: "counter-offer",
      candidateTarget: 36, // 36/28 = 1.28 — under 1.5×
      turnIndex: 2,
      minTurnsBeforeClose: 8,
      highestOfferMade: 22,
    });
    const action = planNextAction(s);
    expect(action.kind).not.toBe("live-walk-away");
  });

  it("canonical prose renders lever-grade-upgrade with Indian phrasing", () => {
    const s = init({ marketMode: "neutral", highestOfferMade: 22 });
    const prose = renderCanonicalProse(
      { kind: "lever-grade-upgrade" } as ReturnType<typeof planNextAction>,
      s,
    );
    expect(prose).toMatch(/grade|level/i);
  });

  it("canonical prose renders lever-retention-bonus", () => {
    const s = init({ highestOfferMade: 22 });
    const prose = renderCanonicalProse(
      { kind: "lever-retention-bonus" } as ReturnType<typeof planNextAction>,
      s,
    );
    expect(prose).toMatch(/retention/i);
  });

  it("canonical prose renders lever-rsu-refresh", () => {
    const s = init({ marketMode: "neutral", highestOfferMade: 22 });
    const prose = renderCanonicalProse(
      { kind: "lever-rsu-refresh" } as ReturnType<typeof planNextAction>,
      s,
    );
    expect(prose).toMatch(/RSU|refresh/i);
  });

  it("canonical prose renders lever-relocation", () => {
    const s = init({ highestOfferMade: 22 });
    const prose = renderCanonicalProse(
      { kind: "lever-relocation" } as ReturnType<typeof planNextAction>,
      s,
    );
    expect(prose).toMatch(/relocat/i);
  });

  it("canonical prose renders lever-perf-bonus-cadence", () => {
    const s = init({ highestOfferMade: 22 });
    const prose = renderCanonicalProse(
      { kind: "lever-perf-bonus-cadence" } as ReturnType<typeof planNextAction>,
      s,
    );
    expect(prose).toMatch(/perf|cycle|bonus|appraisal/i);
  });

  it("canonical prose renders lever-joining-bonus-explained with clawback context", () => {
    const s = init({ highestOfferMade: 22, lastJoiningBonusOffered: 3 });
    const prose = renderCanonicalProse(
      { kind: "lever-joining-bonus-explained" } as ReturnType<typeof planNextAction>,
      s,
    );
    expect(prose).toMatch(/joining bonus|clawback/i);
  });

  it("canonical prose renders band-anchor-with-rationale", () => {
    const s = init({ highestOfferMade: 22 });
    const prose = renderCanonicalProse(
      { kind: "band-anchor-with-rationale" } as ReturnType<typeof planNextAction>,
      s,
    );
    expect(prose).toMatch(/band|grade|fitment/i);
  });
});
