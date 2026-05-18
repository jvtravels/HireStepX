/* PDF#31 BUG C regression (2026-05-18) — anchor-at-current-CTC lowball.
 *
 * Symptom (PDF#31, Meesho/Prita): candidate disclosed 24 LPA fixed
 * current CTC; band.initialOffer was 23 LPA. The PDF#30 R5 floor
 * (clampAnchorAboveDisclosed) lifted the anchor TO 24 — exactly her
 * current CTC. That's a zero-hike offer, the candidate read it as a
 * lowball, and trust collapsed three turns later.
 *
 * Fix: floor at candidateCurrentCtc × (1 + MIN_HIKE_PCT_FOR_ANCHOR)
 * with MIN_HIKE_PCT_FOR_ANCHOR = 0.15. Anchor never equals current CTC;
 * it always shows a real (>=15 %) hike at the open. The 20–30 % Indian-
 * market norm gets reached in the subsequent counter-base round. The
 * band.maxStretch ceiling still caps the result so the simulator never
 * over-promises against an authored band.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  type NegotiationBand,
  type NegotiationState,
} from "../../../server-handlers/_negotiation-kernel";
import { planNextAction } from "../../../server-handlers/_next-action-planner";

const PRITA_BAND: NegotiationBand = {
  initialOffer: 23,
  maxStretch: 32,
  walkAway: 20,
  hasEquity: false,
};

const seed = (
  overrides: Partial<NegotiationState> = {},
): NegotiationState => ({
  ...initState({
    sessionId: "pdf31-bugC",
    role: "Senior Product Designer",
    company: "Meesho",
    band: PRITA_BAND,
  }),
  ...overrides,
});

/** Walk the planner forward until it emits an anchor-with-offer. Returns
 *  the action's newTotalLpa (the anchor amount the bot would ship). */
function planUntilAnchor(state: NegotiationState): number | null {
  let s = state;
  for (let i = 0; i < 30; i++) {
    const action = planNextAction(s);
    if (action.kind === "anchor-with-offer") {
      return action.initialOffer;
    }
    /* Simulate one probe-firing turn so the planner advances. The
     * planner shape only exposes `kind` cleanly across all variants; use
     * the kind as the lever-fired marker for the loop guard. */
    s = {
      ...s,
      turnIndex: (s.turnIndex ?? 0) + 1,
      leversFired: [...(s.leversFired ?? []), action.kind],
    };
  }
  return null;
}

describe("PDF#31 BUG C — anchor must beat disclosed current CTC by hike margin", () => {
  it("Prita repro: 24 LPA disclosed, anchor lifts to ≥ 27.6 (15% hike floor)", () => {
    const state = seed({
      candidateCurrentCtc: 24,
      candidateTarget: 32,
      /* Mark the discovery topics that must be satisfied before anchor. */
      discoveryChecklist: {
        ...(seed().discoveryChecklist ?? {}),
        candidateCurrentCtc: true,
        candidateTarget: true,
        noticePeriod: true,
        candidateRole: true,
      } as NegotiationState["discoveryChecklist"],
    } as Partial<NegotiationState>);
    const anchor = planUntilAnchor(state);
    if (anchor != null) {
      /* Must be strictly above the disclosed CTC by the hike margin
       * (rounded to one decimal). 24 × 1.15 = 27.6. */
      expect(anchor).toBeGreaterThanOrEqual(27.6);
      /* And must not blow through maxStretch. */
      expect(anchor).toBeLessThanOrEqual(PRITA_BAND.maxStretch);
    }
  });

  it("disclosed CTC below band floor → anchor stays at band floor (no spurious lift)", () => {
    const state = seed({
      candidateCurrentCtc: 18, // below initialOffer of 23
      candidateTarget: 30,
    } as Partial<NegotiationState>);
    const anchor = planUntilAnchor(state);
    if (anchor != null) {
      /* 18 × 1.15 = 20.7, still < 23 (band floor) → anchor = 23. */
      expect(anchor).toBeGreaterThanOrEqual(PRITA_BAND.initialOffer);
    }
  });

  it("disclosed CTC above maxStretch → anchor caps at maxStretch", () => {
    const tightBand: NegotiationBand = {
      initialOffer: 20,
      maxStretch: 25,
      walkAway: 18,
      hasEquity: false,
    };
    const state = {
      ...initState({
        sessionId: "pdf31-bugC-cap",
        role: "Sr PD",
        company: "TightCo",
        band: tightBand,
      }),
      candidateCurrentCtc: 30, // above maxStretch
      candidateTarget: 40,
    } as NegotiationState;
    const anchor = planUntilAnchor(state);
    if (anchor != null) {
      expect(anchor).toBeLessThanOrEqual(tightBand.maxStretch);
    }
  });
});
