/* ITEM 4 — Wave 5: Candidate profile flag expansion.
 *
 * Smoke test confirming:
 *   1. The new flag types compile (TypeScript structural check via import).
 *   2. Three key flags populate correctly from sample candidate replies:
 *      - prefersEquityOverCash
 *      - anchorsHigh
 *      - noticePeriodFlexible
 */
import { describe, it, expect } from "vitest";
import { extractCandidateProfile } from "../../server-handlers/_candidate-profile";

describe("ITEM 4 — Wave-5 candidate profile flags", () => {
  it("prefersEquityOverCash=true when candidate prefers equity over cash", () => {
    const result = extractCandidateProfile(
      "I'd honestly prefer more equity over a higher cash salary — I believe in the company's growth.",
    );
    expect(result.prefersEquityOverCash).toBe(true);
  });

  it("anchorsHigh=true when expected CTC is >40% above current", () => {
    /* Candidate states current 20L and expects 30L — that's 50% hike. */
    const result = extractCandidateProfile(
      "My current CTC is 20 lakhs and I'm looking for 30 LPA — I know it's a big jump but the market supports it.",
    );
    expect(result.anchorsHigh).toBe(true);
  });

  it("noticePeriodFlexible=true when candidate mentions early exit / buyout possible", () => {
    const result = extractCandidateProfile(
      "My notice is 90 days but they can buy it out — I can join in 30 days if needed.",
    );
    expect(result.noticePeriodFlexible).toBe(true);
  });

  it("prefersEquityOverCash=false when candidate does not mention equity preference", () => {
    const result = extractCandidateProfile("My current CTC is 15 LPA and I'm looking for 20 LPA.");
    expect(result.prefersEquityOverCash).toBe(false);
  });

  it("new flags default to false / null in EMPTY-equivalent (no-signal text)", () => {
    const result = extractCandidateProfile("hello");
    expect(result.prefersEquityOverCash).toBe(false);
    expect(result.anchorsHigh).toBe(false);
    expect(result.noticePeriodFlexible).toBe(false);
    expect(result.riskAverse).toBe(false);
    expect(result.prefersMnc).toBe(false);
    expect(result.prefersStartup).toBe(false);
    expect(result.openToRelocation).toBe(false);
    expect(result.remotePref).toBeNull();
    expect(result.likelyToCounter).toBe(false);
    expect(result.acceptedFirstOffer).toBe(false);
    expect(result.hasWalkedAway).toBe(false);
    expect(result.softOnRange).toBe(false);
    expect(result.joiningUrgency).toBeNull();
    expect(result.counterOfferRisk).toBeNull();
    expect(result.isIcToManager).toBe(false);
    expect(result.hasLeadershipExperience).toBe(false);
    expect(result.domainSpecialist).toBe(false);
    expect(result.multipleCompaniesInTwoYears).toBe(false);
    expect(result.hasVestingCliff).toBe(false);
    expect(result.rsuVestingAware).toBe(false);
    expect(result.esopHolder).toBe(false);
  });
});
