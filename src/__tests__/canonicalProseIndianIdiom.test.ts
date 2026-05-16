/* Fix 2 (2026-05-16) — Indian recruiter idiom rewrite for canonical prose.
 *
 * Verifies the canonical prose surface uses Indian-recruiter cadence
 * ("fitment", "revert", "as per our band", "broadly aligned",
 * "let me run this past leadership") and never US-recruiter idiom
 * ("circle back", "on board", "touch base", "package", "we're aligned").
 *
 * Asserts every canonical NextAction branch in aggregate; if a new kind
 * lands without idiom updates the aggregate check fails.
 */
import { describe, it, expect } from "vitest";
import {
  renderCanonicalProse,
  buildRestylePrompt,
} from "../../server-handlers/_canonical-prose";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../server-handlers/_negotiation-kernel";
import type { NextAction } from "../../server-handlers/_next-action-planner";

const BAND: NegotiationBand = { initialOffer: 20, maxStretch: 28, walkAway: 16, hasEquity: true };
const baseState = (overrides: Partial<NegotiationState> = {}): NegotiationState => ({
  ...initState({ sessionId: "s-idiom", role: "swe", company: "acme", band: BAND }),
  ...overrides,
});

const BANNED_IDIOMS = [
  /circle back/i,
  /on[ -]board/i,
  /touch base/i,
  /\bsynergy\b/i,
  /rounding out the package/i,
  /we['’]re aligned\b/i,
];

const INDIAN_MARKERS = [
  /fitment/i,
  /revert/i,
  /as per our band/i,
  /broadly aligned|broadly covered|broadly|leadership/i,
];

const SAMPLE_ACTIONS: NextAction[] = [
  { kind: "close", mode: "accept" } as NextAction,
  { kind: "close", mode: "walkaway" } as NextAction,
  { kind: "close", mode: "stalemate" } as NextAction,
  { kind: "auto-accept" } as NextAction,
  { kind: "range-disclosure" } as NextAction,
  { kind: "probe-expectations" } as NextAction,
  { kind: "probe-justification" } as NextAction,
  { kind: "lever-explore", from: "default" } as NextAction,
  { kind: "lever-loop-guard" } as NextAction,
  { kind: "hold-firm", mode: "verbal-accept" } as NextAction,
  { kind: "rescission" } as NextAction,
  { kind: "terminal-restate" } as NextAction,
  { kind: "live-walk-away", mode: "hold-firm" } as NextAction,
  { kind: "live-walk-away", mode: "walk" } as NextAction,
  { kind: "info-disclosure", topic: "breakdown" } as NextAction,
  { kind: "info-disclosure", topic: "benefits" } as NextAction,
  { kind: "info-disclosure", topic: "comp-structure" } as NextAction,
  { kind: "info-disclosure", topic: "notice" } as NextAction,
  { kind: "info-disclosure", topic: "hike-pct" } as NextAction,
  { kind: "counter-offer", counterTotalLpa: 24 } as NextAction,
  { kind: "discovery-probe", item: "currentCtc", ask: "x" } as NextAction,
  { kind: "discovery-probe", item: "expectedCtc", ask: "x" } as NextAction,
  { kind: "discovery-probe", item: "noticePeriod", ask: "x" } as NextAction,
  { kind: "probe-mismatch" } as NextAction,
  { kind: "open-with-offer" } as NextAction,
];

describe("canonical prose — Indian idiom rewrite (Fix 2)", () => {
  it("no canonical line uses any banned US-recruiter idiom", () => {
    const s = baseState({ highestOfferMade: 22 });
    for (const action of SAMPLE_ACTIONS) {
      const prose = renderCanonicalProse(action, s);
      for (const re of BANNED_IDIOMS) {
        expect(prose, `kind=${action.kind} prose=${prose}`).not.toMatch(re);
      }
    }
  });

  it("aggregated canonical surface uses Indian recruiter markers (fitment, revert, band, broadly/leadership)", () => {
    const s = baseState({ highestOfferMade: 22 });
    const all = SAMPLE_ACTIONS.map((a) => renderCanonicalProse(a, s)).join("\n");
    for (const re of INDIAN_MARKERS) {
      expect(all).toMatch(re);
    }
  });

  it("close-accept uses 'broadly aligned' + 'revert with the formal offer letter'", () => {
    const s = baseState({ highestOfferMade: 22 });
    const prose = renderCanonicalProse({ kind: "close", mode: "accept" } as NextAction, s);
    expect(prose).toMatch(/broadly aligned/i);
    expect(prose).toMatch(/revert/i);
  });

  it("counter-offer uses 'fitment' wording when number present", () => {
    const s = baseState({ highestOfferMade: 22 });
    const prose = renderCanonicalProse(
      { kind: "counter-offer", counterTotalLpa: 25 } as NextAction,
      s,
    );
    expect(prose).toMatch(/fitment/i);
    expect(prose).toContain("25");
  });

  it("range-disclosure frames using 'as per our band for this grade'", () => {
    const s = baseState();
    const prose = renderCanonicalProse({ kind: "range-disclosure" } as NextAction, s);
    expect(prose).toMatch(/as per our band/i);
  });

  it("hold-firm uses 'as per our band' + 'revert'", () => {
    const s = baseState({ highestOfferMade: 22 });
    const prose = renderCanonicalProse(
      { kind: "hold-firm", mode: "verbal-accept" } as NextAction,
      s,
    );
    expect(prose).toMatch(/as per our band/i);
    expect(prose).toMatch(/revert/i);
  });

  it("discovery-probe on currentCtcFixedVariableSplitDisclosed (Disclosed suffix) strips suffix so ack is not self-referential (defect 4)", () => {
    /* The planner emits this exact `*Disclosed` suffix for the
     * fixed/variable split slot in DISCOVERY_SEQUENCE. Pre-fix only
     * the `*Answered` suffix was stripped, so the un-normalised key
     * never matched the probeItem comparator in buildDiscoveryAck —
     * the ack fired with "Understood on the fixed/variable structure"
     * even when the probe itself was the fixed/variable structure. */
    const s = baseState({
      highestOfferMade: 22,
      lastTurnDelta: {
        candidateSentiment: "neutral",
        disclosedExpectedCtc: false,
        disclosedCurrentCtc: false,
        disclosedFixedVariableSplit: true,
        disclosedNoticePeriod: false,
        disclosedCompetingOffer: false,
        disclosedValueProof: false,
      } as NegotiationState["lastTurnDelta"],
    });
    const prose = renderCanonicalProse(
      {
        kind: "discovery-probe",
        item: "currentCtcFixedVariableSplitDisclosed",
        ask: "x",
      } as NextAction,
      s,
    );
    /* The probe BODY (split question) must be present. */
    expect(prose.toLowerCase()).toMatch(/fixed and variable|fixed.*variable/);
    /* The ack must NOT have been prepended (self-referential). */
    expect(prose).not.toMatch(/Understood on the fixed\/variable/i);
  });
});

describe("buildRestylePrompt — Indian English cadence", () => {
  it("system prompt has Indian-cadence ban list and positive examples", () => {
    const s = baseState();
    const { system } = buildRestylePrompt("Test canonical.", s);
    expect(system).toMatch(/Indian English cadence/i);
    /* Banned list now sourced from BANNED_RECRUITER_IDIOM constant. */
    expect(system).toMatch(/circle back/i);
    expect(system).toMatch(/touch base/i);
    expect(system).toMatch(/synergy/i);
    expect(system).toMatch(/on board/i);
    expect(system).toMatch(/reach out/i);
    /* Preferred list now sourced from PREFERRED_RECRUITER_IDIOM. */
    expect(system).toMatch(/let me check with leadership/i);
    expect(system).toMatch(/fitment/i);
    expect(system).toMatch(/\brevert\b/i);
    expect(system).toMatch(/as per the band for this grade/i);
    expect(system).toMatch(/broadly aligned/i);
  });
});
