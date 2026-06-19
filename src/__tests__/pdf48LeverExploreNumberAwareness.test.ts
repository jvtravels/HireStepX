/* PDF#48 B2 (2026-05-25) — number-aware lever-explore.
 *
 * Captured in the Flipkart Sr PD session: candidate counter-anchored
 * with "sure 46 LPA" after we anchored at ₹42.4L. Planner picked
 * lever-explore (counter above cash band) but the canonical
 * line emitted was generic — "Let me see what else we can structure
 * on the fitment." — with no engagement of the ₹46L number. Real
 * recruiters acknowledge the stated number before pivoting to
 * non-cash levers.
 *
 * Verifies that when state.lastCandidateCounterLpa is set, the
 * lever-explore canonical surfaces the number; when no counter is
 * on file, the generic line ships unchanged (regression guard for
 * the legacy callsites).
 */
import { describe, it, expect } from "vitest";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 40,
  maxStretch: 44,
  walkAway: 36,
  hasEquity: true,
};

function mkState(overrides: Partial<NegotiationState> = {}): NegotiationState {
  return {
    ...initState({ sessionId: "s-pdf48", role: "sr-pd", company: "flipkart", band: BAND }),
    ...overrides,
  };
}

describe("PDF#48 B2 — lever-explore engages the candidate's counter number", () => {
  const action: NextAction = { kind: "lever-explore", from: "default" } as NextAction;

  it("acknowledges the ₹46L counter when lastCandidateCounterLpa is set", () => {
    const state = mkState({
      lastCandidateCounterLpa: 46,
      candidateTarget: 46,
      highestOfferMade: 42.4,
      phase: "counter-offer",
    });
    const prose = renderCanonicalProse(action, state);
    expect(prose).toContain("46");
    expect(prose).toMatch(/above the cash band|cash band/i);
    expect(prose).toMatch(/see what else|structure|put together/i);
  });

  it("ships the generic canonical when no candidate counter is on file", () => {
    const state = mkState({ lastCandidateCounterLpa: null });
    const prose = renderCanonicalProse(action, state);
    /* Substring match — the humanizer at the renderCanonicalProse exit
     * point (2026-05-29 realism-pass P0-1) may prepend a persona-tic
     * ("Right, ...") deterministically by (sessionId, turnIndex). The
     * regression we're guarding is that the generic CANONICAL BODY ships
     * unchanged; the humanizer wrap is intentional and tested in
     * `_recruiter-prose-realism.test.ts`. */
    expect(prose).toContain("let me see what else we can structure on the fitment.");
    expect(prose).not.toContain("46");
  });

  it("does not emit the banned drift phrase 'explore the fitment further'", () => {
    const state = mkState({ lastCandidateCounterLpa: 46 });
    const prose = renderCanonicalProse(action, state);
    expect(prose).not.toMatch(/explore the fitment further/i);
  });
});

describe("anti-teaser-loop — lever-explore NAMES the concrete lever (live-staging 2026-06-19)", () => {
  /* Live bug: pickLeverExploreMove rotates a distinct concrete lever each
   * round (equity → joining-bonus → notice-buyout → benefits) but the
   * canonical arm shipped the same generic "let me see what else we can
   * structure on the fitment." line every time — the candidate heard the
   * identical teaser back-to-back while we silently picked different
   * levers and communicated none of them. The planner now stamps the
   * selected lever on the action (leverKind) so prose names it. */
  const mk = (leverKind: string, extra: Partial<NextAction> = {}) =>
    ({ kind: "lever-explore", from: "default", leverKind, ...extra } as unknown as NextAction);

  it("equity-grant round names the ESOP grant", () => {
    const prose = renderCanonicalProse(mk("equity-grant"), mkState({ highestOfferMade: 40 }));
    expect(prose).toMatch(/ESOP|equity/i);
    expect(prose).not.toContain("let me see what else we can structure on the fitment.");
  });

  it("joining-bonus round names the bonus AND quotes the kernel-sized amount", () => {
    const prose = renderCanonicalProse(
      mk("joining-bonus", { joiningBonusLpa: 3 } as Partial<NextAction>),
      mkState({ highestOfferMade: 40 }),
    );
    expect(prose).toMatch(/joining bonus/i);
    expect(prose).toContain("₹3L");
  });

  it("notice-buyout round names the notice-period buyout", () => {
    const prose = renderCanonicalProse(mk("notice-buyout"), mkState({ highestOfferMade: 40 }));
    expect(prose).toMatch(/notice period|buyout/i);
  });

  it("benefits-summary round lays out concrete non-cash items", () => {
    const prose = renderCanonicalProse(mk("benefits-summary"), mkState({ highestOfferMade: 40 }));
    expect(prose).toMatch(/insurance|ESOP|joining bonus/i);
  });

  it("two consecutive different levers do NOT repeat verbatim", () => {
    const a = renderCanonicalProse(mk("equity-grant"), mkState({ highestOfferMade: 40 }));
    const b = renderCanonicalProse(mk("joining-bonus", { joiningBonusLpa: 2 } as Partial<NextAction>), mkState({ highestOfferMade: 40 }));
    expect(a).not.toBe(b);
  });
});
