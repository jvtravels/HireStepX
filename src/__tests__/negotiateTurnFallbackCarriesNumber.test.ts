/* Layer B contract-fallback substance (2026-06-18, live-staging finding).
 *
 * The bug the user reported: on a salary push the bot kept replying
 * "Let me note that and come back to you with specifics." — a content-free
 * divert that DISCARDS the number the kernel already decided to deliver.
 *
 * Root cause: when the LLM restyle fails the response contract on a salary
 * turn, `negotiate-turn.ts` shipped `contractFallbackProse(violations)` whose
 * last-resort branch is exactly that deflection. The fix ships the kernel's
 * OWN deterministic prose for the planned move — `renderCanonicalProse` — in
 * preference to the generic divert, so a comp push gets engaged with the real
 * figure (real-HR behavior) instead of being kicked down the road.
 *
 * This locks the PRINCIPLE that makes the negotiate-turn fix correct:
 *   1. the generic fallback IS the content-free divert (no number), and
 *   2. the canonical prose for a salary-bearing move carries the number and
 *      is NOT that divert.
 * If either invariant breaks, the substance fallback silently regresses to
 * the deflection the user complained about.
 */
import { describe, it, expect } from "vitest";
import { renderCanonicalProse } from "../../server-handlers/_canonical-prose";
import { contractFallbackProse } from "../../server-handlers/_response-contract";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = {
  initialOffer: 22.4,
  maxStretch: 31.4,
  walkAway: 16.8,
  hasEquity: true,
};

const state = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s-fallback", role: "swe", company: "acme", band: BAND }),
  phase: "counter-offer",
  turnIndex: 6,
  highestOfferMade: 24.5,
  ...overrides,
});

/** The generic last-resort divert — what the bot used to ship on every
 *  contract-failing salary turn. Filler-non-answer is the violation that
 *  routes to "Let me check on that specifically and share the concrete
 *  number"; the bare last-resort (no recognised violation) is the worst one. */
const GENERIC_DIVERT = contractFallbackProse([]);

describe("Layer B contract fallback ships salary substance, not a divert", () => {
  it("the generic last-resort fallback is the content-free divert (no number)", () => {
    expect(GENERIC_DIVERT).toMatch(/come back to you/i);
    expect(GENERIC_DIVERT).not.toMatch(/\d/); // carries no figure
  });

  it("canonical prose for a counter-offer carries the actual number", () => {
    const action: NextAction = {
      kind: "counter-offer",
      counterTotalLpa: 24.5,
    } as NextAction;
    const prose = renderCanonicalProse(action, state());
    expect(prose.trim().length).toBeGreaterThan(0);
    expect(prose).toMatch(/24\.5/);
  });

  it("canonical salary prose is NOT the generic divert", () => {
    const action: NextAction = {
      kind: "counter-offer",
      counterTotalLpa: 24.5,
    } as NextAction;
    const prose = renderCanonicalProse(action, state()).trim();
    expect(prose).not.toBe(GENERIC_DIVERT.trim());
    expect(prose).not.toMatch(/^Let me note that and come back/i);
  });

  it("the substance-fallback selection (canonical ?? generic) prefers the number-bearing prose", () => {
    // Mirrors the negotiate-turn.ts Layer B decision exactly.
    const action: NextAction = {
      kind: "counter-offer",
      counterTotalLpa: 24.5,
    } as NextAction;
    const canonical = renderCanonicalProse(action, state()).trim();
    const replacement = canonical.length > 0 ? canonical : null;
    const shipped = replacement ?? contractFallbackProse(["filler-non-answer"]);
    expect(shipped).toMatch(/24\.5/);
    expect(shipped).not.toMatch(/come back to you with specifics/i);
  });
});
