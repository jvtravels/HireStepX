/* Phase 30 (2026-05-14) — mid-session fresh-grad band rebase.
 *
 * The detector existed (detectFreshGradDisclosure) and flipped
 * freshGradDisclosed sticky-true + zeroed candidateApplicableYoe, but
 * the band stored on state was frozen at init. Result: a senior-band
 * session (resume said 5 yrs) that mid-conversation revealed "I'm
 * actually pre-grad" continued anchoring senior numbers — the entire
 * point of the disclosure was lost.
 *
 * These tests pin the new behavior:
 *   (1) when freshGradDisclosed flips true, state.band re-resolves to
 *       entry-tier for the (role, company).
 *   (2) the close-floor invariant is preserved: if the AI already
 *       offered something, the new ceiling cannot drop below it.
 *   (3) re-resolution is idempotent on subsequent turns (no further
 *       rebase once the flag is sticky).
 *   (4) when no offer has been made yet, the band collapses cleanly to
 *       entry.
 */
import { describe, it, expect } from "vitest";
import {
  initState,
  applyCandidateAnswer,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import { resolveServerBand } from "../../server-handlers/_band-resolver";

/* A senior-shaped band — the kind init would lock in if the resume
 * said "5 yrs Senior Java Developer". Numbers are illustrative; the
 * test asserts a DROP, not exact values. */
const SENIOR_BAND: NegotiationBand = {
  initialOffer: 35,
  maxStretch: 65,
  walkAway: 28,
  hasEquity: true,
};

describe("Phase 30 — fresh-grad mid-session band rebase", () => {
  it("rebases band to entry-tier when 'I'm a fresh graduate' is disclosed mid-session", () => {
    const state = initState({
      sessionId: "s-rebase-1",
      role: "Software Engineer",
      company: "accenture",
      band: SENIOR_BAND,
      candidateApplicableYoe: 5,
    });

    const next = applyCandidateAnswer(state, "Actually I'm a fresh graduate, just out of college.");

    expect(next.freshGradDisclosed).toBe(true);
    expect(next.candidateApplicableYoe).toBe(0);

    /* The new ceiling should be strictly below the senior ceiling.
     * Exact entry numbers depend on the (role, company) lookup; we
     * only assert the rebase happened. */
    expect(next.band.maxStretch).toBeLessThan(SENIOR_BAND.maxStretch);
    expect(next.band.initialOffer).toBeLessThan(SENIOR_BAND.initialOffer);

    /* Sanity: the rebased band matches what resolveServerBand returns
     * with applicableYoe=0 (entry-tier). */
    const expected = resolveServerBand("Software Engineer", "accenture", "entry", 0);
    expect(next.band.initialOffer).toBe(expected.initialOffer);
    expect(next.band.walkAway).toBe(expected.walkAway);
  });

  it("does NOT lower the ceiling below highestOfferMade (close-floor invariant)", () => {
    /* AI has already offered ₹40L before the candidate's fresh-grad
     * disclosure. The rebased entry-band ceiling would normally be
     * far below ₹40L, but the invariant pins it to the prior offer. */
    const base = initState({
      sessionId: "s-rebase-2",
      role: "Software Engineer",
      company: "accenture",
      band: SENIOR_BAND,
      candidateApplicableYoe: 5,
    });
    const state = { ...base, highestOfferMade: 40 };

    const next = applyCandidateAnswer(state, "I'm pre-grad, still in college.");

    expect(next.freshGradDisclosed).toBe(true);
    /* The ceiling is pinned to highestOfferMade — we cannot claw back
     * a commitment already made. */
    expect(next.band.maxStretch).toBeGreaterThanOrEqual(40);
  });

  it("does not rebase a second time once freshGradDisclosed is sticky", () => {
    const state = initState({
      sessionId: "s-rebase-3",
      role: "Software Engineer",
      company: "accenture",
      band: SENIOR_BAND,
      candidateApplicableYoe: 5,
    });

    const afterFirst = applyCandidateAnswer(state, "I'm a fresh graduate.");
    const rebasedBand = afterFirst.band;

    /* A second disclosure on a later turn should be a no-op — band
     * stays at the already-rebased entry-tier values. */
    const afterSecond = applyCandidateAnswer(afterFirst, "Like I said, fresh grad.");
    expect(afterSecond.band).toEqual(rebasedBand);
  });

  it("rebases cleanly to entry when no offer has been made yet", () => {
    const state = initState({
      sessionId: "s-rebase-4",
      role: "Software Engineer",
      company: "accenture",
      band: SENIOR_BAND,
      candidateApplicableYoe: 5,
    });
    /* highestOfferMade starts at 0; no clamp applies. */

    const next = applyCandidateAnswer(state, "I haven't graduated yet.");

    const expected = resolveServerBand("Software Engineer", "accenture", "entry", 0);
    expect(next.band.maxStretch).toBe(expected.maxStretch);
    expect(next.band.initialOffer).toBe(expected.initialOffer);
  });
});
