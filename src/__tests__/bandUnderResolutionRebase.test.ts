/* Bug (2026-06-20, live staging) — IT-services senior/lateral band
 * UNDER-resolution rebase.
 *
 * The legacy salary-lookup pipeline silently DROPS the experience signal
 * for some IT-services × role combinations: a Senior SWE (8 YoE) at
 * Infosys resolved to init=8.9 / maxStretch=9.4 — a FRESHER band — even
 * though the YoE-aware tier table puts the senior floor well above that.
 * The recruiter then opened a pay-cut anchor BELOW the candidate's own
 * current CTC and the walk-away gap-gate read every realistic ask as
 * "structurally unbridgeable", walking away at turn ~4.
 *
 * resolveServerBand now rebases UP when the resolved band sits ENTIRELY
 * below the tier-table floor for the resolved seniority — symmetric with
 * the existing one-way DOWN ratchet. These pin:
 *   (1) senior IT-services laterals resolve at/above the tier floor (no
 *       fresher band, no pay-cut anchor);
 *   (2) the rebased band equals the canonical tier-table band;
 *   (3) healthy bands (already above floor) are untouched.
 */
import { describe, it, expect } from "vitest";
import { resolveServerBand } from "../../server-handlers/_band-resolver";
import {
  classifyCompanyTier,
  getBandForRole,
} from "../../server-handlers/_company-band-tiers";

const IT_SERVICES_LATERALS = ["infosys", "wipro", "cognizant", "hcl", "tcs"];

describe("band under-resolution rebase (UP) — IT-services senior laterals", () => {
  it.each(IT_SERVICES_LATERALS)(
    "%s senior SWE (8 YoE) resolves at/above the tier-table floor — not a fresher band",
    (company) => {
      const band = resolveServerBand("Software Engineer", company, "senior", 8);
      const tier = classifyCompanyTier(company);
      const tierBand = getBandForRole(tier, "Software Engineer", 8);

      /* The whole point: the ceiling cannot sit below the senior floor —
       * that was the degenerate fresher band that caused the pay-cut anchor. */
      expect(band.maxStretch).toBeGreaterThanOrEqual(tierBand.floor);
      /* And the opener must clear the floor too, so the recruiter never
       * anchors below the candidate's own senior-level CTC. */
      expect(band.initialOffer).toBeGreaterThanOrEqual(tierBand.floor);
    },
  );

  it("Infosys senior SWE rebases to the canonical tier-table band (not 8.9/9.4)", () => {
    const band = resolveServerBand("Software Engineer", "infosys", "senior", 8);
    const tierBand = getBandForRole(classifyCompanyTier("infosys"), "Software Engineer", 8);

    /* Was the degenerate fresher band; must now equal the tier band. */
    expect(band.initialOffer).toBe(tierBand.target);
    expect(band.maxStretch).toBe(tierBand.ceil);
    expect(band.maxStretch).toBeGreaterThan(12);
  });

  it("does NOT touch healthy bands already above the tier floor", () => {
    /* Big-tech and product bands resolve well above their tier floor —
     * the up-rebase trigger (whole band below floor) must never fire. */
    const google = resolveServerBand("Software Engineer", "google", "senior", 8);
    const googleFloor = getBandForRole(classifyCompanyTier("google"), "Software Engineer", 8).floor;
    expect(google.maxStretch).toBeGreaterThan(googleFloor);
    /* Google senior SWE is a lakhs-50+ band — a sanity floor that would
     * trip instantly if the rebase wrongly clamped it to a tier target. */
    expect(google.maxStretch).toBeGreaterThan(60);

    const flipkart = resolveServerBand("Software Engineer", "flipkart", "senior", 8);
    const flipkartFloor = getBandForRole(classifyCompanyTier("flipkart"), "Software Engineer", 8).floor;
    expect(flipkart.maxStretch).toBeGreaterThan(flipkartFloor);
  });
});
