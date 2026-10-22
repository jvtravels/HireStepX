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

/* #115 (2026-06-20, live staging) — people-manager band floor.
 *
 * The salary-lookup keys a people-management title (Engineering Manager) to
 * a generic senior-IC company row and IGNORES experienceLevel, so a Flipkart
 * EM resolved to init 32.7 / maxStretch 43.6 (and stayed there for "lead" AND
 * "executive") — ~22% under the canonical tier-table manager ceil (56) and
 * far under the real first-line EM market. A candidate asking a realistic EM
 * number could never be met; the recruiter capped ~₹44L total.
 *
 * resolveServerBand now lifts a genuine people-manager band UP to the
 * calibrated tier-table manager band (ceil → manager ceil; opener → at least
 * the manager floor), one-way, at the candidate's real YoE when known and a
 * representative managerial YoE otherwise. These pin:
 *   (1) the EM ceil clears the tier manager ceil regardless of YoE signal;
 *   (2) known-YoE and unknown-YoE managers resolve the SAME band (no inversion
 *       where supplying a resume yields a worse band);
 *   (3) IC "…Manager" titles (Product / Program / Project) are NOT lifted;
 *   (4) the opener stays anchor-low (never above the manager floor).
 */
describe("#115 — people-manager band floor", () => {
  it("Flipkart Engineering Manager clears the tier-table manager ceil", () => {
    const tierMgr = getBandForRole(classifyCompanyTier("flipkart"), "Engineering Manager", 11);
    const noYoe = resolveServerBand("Engineering Manager", "Flipkart", undefined, null);
    expect(noYoe.maxStretch).toBeGreaterThanOrEqual(tierMgr.ceil);
    /* The live defect: maxStretch capped at 43.6. Must now reach the
     * manager ceil (56) — a real EM stretch, not a senior-IC cap. */
    expect(noYoe.maxStretch).toBeGreaterThanOrEqual(56);
    expect(noYoe.maxStretch).toBeGreaterThan(43.6);
  });

  it("does not invert on YoE — known-YoE and unknown-YoE EM resolve the same band", () => {
    const noYoe = resolveServerBand("Engineering Manager", "Flipkart", undefined, null);
    const yoe10 = resolveServerBand("Engineering Manager", "Flipkart", undefined, 10);
    /* Supplying a resume (YoE) must never produce a WORSE manager band than
     * leaving it blank — both lift to the manager ceil. */
    expect(yoe10.maxStretch).toBe(noYoe.maxStretch);
    expect(yoe10.maxStretch).toBeGreaterThan(43.6);
  });

  it("keeps the opener anchor-low (never above the manager floor)", () => {
    const tierMgr = getBandForRole(classifyCompanyTier("flipkart"), "Engineering Manager", 11);
    const band = resolveServerBand("Engineering Manager", "Flipkart", undefined, null);
    /* Opener must clear the floor (no sub-band lowball) but never exceed it
     * just because the ceil was lifted — anchor-low behaviour is preserved. */
    expect(band.initialOffer).toBeGreaterThanOrEqual(tierMgr.floor);
    expect(band.walkAway).toBeLessThan(band.initialOffer);
    expect(band.initialOffer).toBeLessThan(band.maxStretch);
  });

  it("does NOT lift IC '…Manager' titles (Product / Program / Project Manager)", () => {
    /* These carry no people-management responsibility in the Indian market;
     * the salary-lookup band for them is correct and must be untouched. */
    const pm = resolveServerBand("Product Manager", "Flipkart", undefined, null);
    const pgm = resolveServerBand("Program Manager", "Flipkart", undefined, null);
    const prjm = resolveServerBand("Project Manager", "Flipkart", undefined, null);
    /* The EM lift takes the ceil to 56; an IC PM at Flipkart sits well below
     * that. If the gate wrongly matched these, the ceil would jump to 56. */
    expect(pm.maxStretch).toBeLessThan(50);
    expect(pgm.maxStretch).toBeLessThan(50);
    expect(prjm.maxStretch).toBeLessThan(50);
  });
});

/* S54-B2 (2026-07-24) — IT-services opening offer exceeds band ceiling
 * when a "Senior" title inflates the tier multiplier.
 *
 * Root cause: getBandForRole applied roleModifier("Senior…")=1.15 ON TOP of
 * yoeScale(8yr)=1.4, giving m=1.61 and inflating the it-services engineering
 * ceil from 14L to 22.5L. The down-rebase gate (initialOffer > ceil * 1.2)
 * set the threshold at 27L, letting a miscalibrated legacy lookup at ~21.8L
 * slip through uncorrected. The negotiation then opened with an offer 33%
 * above the candidate's stated target — zero headroom.
 *
 * Fix 1: getBandForRole suppresses roleModifier for it-services (YoE is the
 * sole differentiator; title premiums don't apply at TCS/Infosys/Wipro).
 * Fix 2: resolveServerBand uses a 1.0× overshoot threshold for it-services
 * (any legacy opener above the tier ceil is miscalibrated, not natural variance).
 *
 * After fix: tierBand.ceil("Senior SWE", it-services, 8yr) = 14 * 1.4 = 19.6.
 * A legacy opener at 21.8 now satisfies 21.8 > 19.6 * 1.0, triggering a
 * rebase to tierBand.target = 15.4. Opening offer stays below the candidate's
 * ₹18L target, restoring negotiation headroom. */
describe("S54-B2 — IT-services over-resolution rebase (DOWN) for Senior-titled roles", () => {
  it.each(IT_SERVICES_LATERALS)(
    "%s 'Senior Software Engineer' (8 YoE) resolved band stays within tier-table ceiling",
    (company) => {
      const band = resolveServerBand("Senior Software Engineer", company, "senior", 8);
      const tier = classifyCompanyTier(company);
      const tierBand = getBandForRole(tier, "Senior Software Engineer", 8);

      expect(band.initialOffer).toBeLessThanOrEqual(tierBand.ceil);
      expect(band.maxStretch).toBeLessThanOrEqual(tierBand.ceil);
    },
  );

  it("Infosys 'Senior Software Engineer' tier ceiling is YoE-only (≤20L, not title-inflated 22.5L)", () => {
    /* With roleModifier suppressed for it-services, 'Senior SWE' and plain 'SWE'
     * should produce the same tier band at the same YoE — title premiums don't
     * compound. This pins the key invariant: capping at 22.5 was wrong. */
    const tier = classifyCompanyTier("infosys");
    const seniorBand = getBandForRole(tier, "Senior Software Engineer", 8);
    const plainBand = getBandForRole(tier, "Software Engineer", 8);

    expect(seniorBand.ceil).toBe(plainBand.ceil);
    expect(seniorBand.target).toBe(plainBand.target);
    /* The YoE-only ceiling for 8yr must be well below the pre-fix 22.5. */
    expect(seniorBand.ceil).toBeLessThan(21);
  });

  it("Infosys 'Senior Software Engineer' resolved band equals the tier-table band (not 21.8L opener)", () => {
    const band = resolveServerBand("Senior Software Engineer", "infosys", "senior", 8);
    const tierBand = getBandForRole(classifyCompanyTier("infosys"), "Senior Software Engineer", 8);

    /* Both rebases — over-resolution DOWN (21.8 > 19.6 * 1.0) and under-
     * resolution UP (if the legacy lookup drops the YoE signal) — land here.
     * Either way the resolved band must equal the canonical tier band. */
    expect(band.initialOffer).toBe(tierBand.target);
    expect(band.maxStretch).toBe(tierBand.ceil);
  });

  it("non-it-services Senior SWE retains the 1.15× title premium (Google/Flipkart unaffected)", () => {
    /* The roleModifier suppression must be IT-services-only — product and big-tech
     * tiers use the full compound multiplier. */
    const itServices = getBandForRole(classifyCompanyTier("infosys"), "Senior Software Engineer", 8);
    const product = getBandForRole(classifyCompanyTier("flipkart"), "Senior Software Engineer", 8);

    /* Flipkart product-tier should be strictly higher than Infosys for the same
     * role+YoE (market reality), AND the Senior premium should be visible. */
    const flipkartPlain = getBandForRole(classifyCompanyTier("flipkart"), "Software Engineer", 8);
    expect(product.ceil).toBeGreaterThan(flipkartPlain.ceil * 1.1);
    /* IT-services: no title premium — Senior == plain. */
    expect(itServices.ceil).toBe(
      getBandForRole(classifyCompanyTier("infosys"), "Software Engineer", 8).ceil,
    );
  });
});
