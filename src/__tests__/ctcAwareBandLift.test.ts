/* S4-B1 (2026-07-18) — CTC-aware upward band lift regression suite.
 *
 * Root cause: Flipkart Senior Product Designer with ₹45 LPA CTC was
 * getting a negotiation band of ₹30.4–₹42.4 (below CTC), making the
 * session unwinnable — the recruiter's best offer would still be a
 * pay cut.
 *
 * Fix: when the candidate first discloses a CTC that exceeds band.maxStretch,
 * the kernel lifts the band mid-session:
 *   initialOffer = ctc × 0.87   (13% lowball — realistic)
 *   maxStretch   = ctc × 1.12   (12% above CTC — a win to aim for)
 *
 * Tests:
 *   (1) When disclosed CTC > maxStretch, band lifts to CTC-relative values
 *   (2) Lift only fires on FIRST disclosure — restate has no effect
 *   (3) When disclosed CTC ≤ maxStretch, band is unchanged (no-op)
 *   (4) close-floor invariant: never drop below highestOfferMade
 *   (5) Flipkart Senior PD (₹45L CTC) — the exact S4-B1 scenario
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";

/* Band that is BELOW the candidate's CTC — the S4-B1 failure shape */
const BELOW_CTC_BAND: NegotiationBand = {
  initialOffer: 30.4,
  maxStretch: 42.4,
  walkAway: 20.9,
  hasEquity: true,
};

/* Band that is ABOVE the candidate's CTC — should be left unchanged */
const ABOVE_CTC_BAND: NegotiationBand = {
  initialOffer: 45,
  maxStretch: 70,
  walkAway: 35,
  hasEquity: true,
};

describe("S4-B1 — CTC-aware upward band lift", () => {
  it("lifts the band when first-disclosed CTC exceeds maxStretch", () => {
    const state = initState({
      sessionId: "s-ctc-lift-1",
      role: "Senior Product Designer",
      company: "Flipkart",
      band: BELOW_CTC_BAND,
    });

    const next = applyCandidateAnswer(
      state,
      "My current CTC is ₹45 LPA at my present company.",
    );

    expect(next.candidateCurrentCtc).toBe(45);
    /* Band MUST have lifted: maxStretch must now exceed the disclosed CTC */
    expect(next.band.maxStretch).toBeGreaterThan(45);
    /* initialOffer should be below CTC (a real lowball, not a pay-cut floor) */
    expect(next.band.initialOffer).toBeLessThan(45);
    /* walkAway < initialOffer < maxStretch invariant */
    expect(next.band.walkAway).toBeLessThan(next.band.initialOffer);
    expect(next.band.initialOffer).toBeLessThan(next.band.maxStretch);
  });

  it("uses ctc×0.87 for initialOffer and ctc×1.12 for maxStretch", () => {
    const state = initState({
      sessionId: "s-ctc-lift-2",
      role: "Senior Product Designer",
      company: "Flipkart",
      band: BELOW_CTC_BAND,
    });

    const next = applyCandidateAnswer(state, "My current salary is 45 lakhs CTC.");
    expect(next.candidateCurrentCtc).toBe(45);

    const expectedInitial = Math.round(45 * 0.87 * 10) / 10; // 39.15 → 39.2
    const expectedMax = Math.round(45 * 1.12 * 10) / 10;     // 50.4

    expect(next.band.initialOffer).toBe(expectedInitial);
    expect(next.band.maxStretch).toBe(expectedMax);
  });

  it("does NOT re-lift on a CTC restate (idempotent after first disclosure)", () => {
    const state = initState({
      sessionId: "s-ctc-lift-3",
      role: "Senior Product Designer",
      company: "Flipkart",
      band: BELOW_CTC_BAND,
    });

    const after1 = applyCandidateAnswer(state, "My current CTC is 45 LPA.");
    expect(after1.candidateCurrentCtc).toBe(45);
    const bandAfter1 = { ...after1.band };

    /* Restate same CTC on the next turn — band must not re-lift */
    const after2 = applyCandidateAnswer(
      after1,
      "As I mentioned, my current package is 45 LPA.",
    );
    expect(after2.band.maxStretch).toBe(bandAfter1.maxStretch);
    expect(after2.band.initialOffer).toBe(bandAfter1.initialOffer);
  });

  it("is a no-op when disclosed CTC is below maxStretch (band already good)", () => {
    const state = initState({
      sessionId: "s-ctc-lift-4",
      role: "Software Engineer",
      company: "Google",
      band: ABOVE_CTC_BAND,
    });

    /* CTC ₹40 is below band maxStretch ₹70 — should not trigger */
    const next = applyCandidateAnswer(state, "I'm currently at 40 LPA.");
    expect(next.candidateCurrentCtc).toBe(40);
    expect(next.band.maxStretch).toBe(ABOVE_CTC_BAND.maxStretch);
    expect(next.band.initialOffer).toBe(ABOVE_CTC_BAND.initialOffer);
  });

  it("preserves close-floor invariant: initialOffer never drops below highestOfferMade", () => {
    const state = initState({
      sessionId: "s-ctc-lift-5",
      role: "Senior Product Designer",
      company: "Flipkart",
      band: BELOW_CTC_BAND,
    });

    /* Simulate a scenario where the recruiter has already made an offer
     * of ₹41 before CTC disclosure. We inject this by mutating state.
     * The lift's initialOffer (45×0.87=39.2) must be floored to 41. */
    const stateWithOffer = { ...state, highestOfferMade: 41 } as typeof state;
    const next = applyCandidateAnswer(
      stateWithOffer,
      "My current CTC is ₹45 LPA.",
    );

    expect(next.candidateCurrentCtc).toBe(45);
    expect(next.band.initialOffer).toBeGreaterThanOrEqual(41);
    expect(next.band.maxStretch).toBeGreaterThan(45);
  });

  it("Flipkart Senior PD S4-B1 exact scenario — band must clear ₹45 CTC", () => {
    /* The exact bug: ₹45L CTC candidate at Flipkart Senior PD
     * was getting band ₹30.4–₹42.4 — entirely below CTC. */
    const state = initState({
      sessionId: "s-ctc-lift-6",
      role: "Senior Product Designer",
      company: "Flipkart",
      band: {
        initialOffer: 30.4,
        maxStretch: 42.4,
        walkAway: 20.9,
        hasEquity: true,
      },
    });

    const next = applyCandidateAnswer(
      state,
      "I'm currently earning ₹45 LPA as total comp at my current employer.",
    );

    /* maxStretch MUST exceed CTC — there must be a win state */
    expect(next.band.maxStretch).toBeGreaterThan(45);
    /* initialOffer should be below CTC (lowball, not a pay-cut floor) */
    expect(next.band.initialOffer).toBeLessThan(45);
    /* Must satisfy band ordering */
    expect(next.band.walkAway).toBeLessThan(next.band.initialOffer);
    expect(next.band.initialOffer).toBeLessThan(next.band.maxStretch);
  });
});
