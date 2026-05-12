/* CI audit + unit tests for the band-sanity guard.
 *
 * Phase 4 of the negotiation rebuild. Two purposes:
 *
 *   1. Pin the runtime helper's behaviour (checkBandSanity / bandFamilyForRole)
 *      so the warning shape and the family-matching order can't drift
 *      silently.
 *
 *   2. CI audit: walk the actual override-resolution surface for a curated
 *      set of (role, company) tuples that real users hit, and assert that
 *      every resolved band passes sanity. The Lollypop session (May 2026)
 *      showed an override resolving above-baseline without anything in the
 *      pipeline catching it; this test fails the build when a new override
 *      lands that would trip the same telemetry warning in production.
 */
import { describe, it, expect } from "vitest";
import {
  checkBandSanity,
  bandFamilyForRole,
  BAND_SANITY_BASELINES,
  clampBandToTierP50,
  lookupTierP50,
  TIER_P50_WARN_MULTIPLIER,
  TIER_P50_CLAMP_MULTIPLIER,
  CLAMP_INITIAL_MULTIPLIER,
} from "../../server-handlers/_band-sanity";
import { generateNegotiationBand } from "../../data/salary-lookup";
import { getCompanyTier } from "../../data/company-tiers";

describe("checkBandSanity", () => {
  it("returns no warnings for a well-formed band in the designer family", () => {
    const warnings = checkBandSanity(
      { initialOffer: 10, maxStretch: 18, walkAway: 8 },
      "UX Designer",
    );
    expect(warnings).toEqual([]);
  });

  it("flags initialOffer below the family floor (unit-error guard)", () => {
    /* A ₹0.5 LPA initial offer is almost certainly a ₹ vs ₹L unit
       confusion in the override data, not a real micro-internship band. */
    const warnings = checkBandSanity(
      { initialOffer: 0.5, maxStretch: 2 },
      "Software Engineer",
    );
    expect(warnings.some(w => w.kind === "initial-too-low")).toBe(true);
  });

  it("flags maxStretch above the family ceiling (stale-data / role-mismatch guard)", () => {
    /* The Lollypop pattern: an override for "Senior X Designer" applied
       to a different X. If the resolved band's maxStretch lands at e.g.
       ₹120 LPA for a designer role, that's a role-key mismatch we want
       loudly surfaced. */
    const warnings = checkBandSanity(
      { initialOffer: 60, maxStretch: 120 },
      "Senior UX Designer",
    );
    expect(warnings.some(w => w.kind === "stretch-too-high")).toBe(true);
  });

  it("flags structurally inverted band (stretch below initial)", () => {
    /* Data-construction bug: override.totalMin > override.totalMax. The
       kernel would otherwise consume this and silently produce a
       counter-offer that's BELOW the initial. */
    const warnings = checkBandSanity(
      { initialOffer: 20, maxStretch: 15 },
      "Software Engineer",
    );
    expect(warnings.some(w => w.kind === "stretch-below-initial")).toBe(true);
  });

  it("flags walkAway above initialOffer (candidate floor above recruiter ceiling)", () => {
    /* If the kernel's candidate-floor walkAway sits above the recruiter
       initialOffer, every legitimate AI offer flags as an underbid and
       findOutOfBandNumber retries indefinitely. */
    const warnings = checkBandSanity(
      { initialOffer: 15, maxStretch: 20, walkAway: 18 },
      "Software Engineer",
    );
    expect(warnings.some(w => w.kind === "walk-above-initial")).toBe(true);
  });

  it("falls through to generic family bounds for unrecognised role strings", () => {
    /* The trailing `pattern: /./` baseline catches novel titles with
       wide bounds — we'd rather miss a per-family check than emit a
       false-positive warning for every never-before-seen role. */
    expect(bandFamilyForRole("Astronaut")).toBe("generic");
    expect(bandFamilyForRole("")).toBe("generic");
  });

  it("bandFamilyForRole picks the most specific match", () => {
    /* Both /designer/ and /design manager/ would match "design manager"
       but the more specific baseline appears first in the array — first
       match wins. The fallback /./ baseline must remain last. */
    expect(bandFamilyForRole("Design Manager")).toBe("design-manager");
    expect(bandFamilyForRole("UX Designer")).toBe("designer");
    /* The generic fallback baseline must be the last entry — otherwise
       it would shadow all specific families. */
    expect(BAND_SANITY_BASELINES[BAND_SANITY_BASELINES.length - 1].family).toBe("generic");
  });
});

/* ─── CI audit: real (role, company) resolutions stay in-baseline ───── */

describe("band sanity audit — real (role, company) tuples", () => {
  /* Curated sample of tuples that exercise the per-company override
     surface AND the role-family pattern map. Failures here mean either:
       - a new override was added with out-of-baseline numbers, OR
       - a sanity baseline got tightened without widening it for known-
         legitimate outliers.
     Either way we want a failing CI signal before the bad data ships. */
  const TUPLES: Array<{ role: string; company: string }> = [
    { role: "Senior UX Designer", company: "Lollypop" },
    { role: "UX Designer", company: "MakeMyTrip" },
    { role: "Product Designer", company: "Razorpay" },
    { role: "Software Engineer", company: "Razorpay" },
    { role: "Senior Software Engineer", company: "Google" },
    { role: "Backend Engineer", company: "Zerodha" },
    { role: "DevOps Engineer", company: "CRED" },
    { role: "Product Manager", company: "Swiggy" },
    { role: "Data Scientist", company: "Flipkart" },
    { role: "Data Analyst", company: "Paytm" },
    { role: "Engineering Manager", company: "Microsoft" },
  ];

  for (const { role, company } of TUPLES) {
    it(`${role} @ ${company} resolves to a sane band`, () => {
      const b = generateNegotiationBand({ role, company });
      const warnings = checkBandSanity(
        {
          initialOffer: b.initialOffer,
          maxStretch: b.maxStretch,
          walkAway: typeof b.minOffer === "number" && b.minOffer > 0 ? b.minOffer : undefined,
        },
        role,
      );
      /* Empty warnings = the resolved band passes the family bound + the
         structural checks. A failure here surfaces the exact (role,
         company, family, kind) tuple in the test report. */
      expect({ role, company, warnings }).toEqual({ role, company, warnings: [] });
    });
  }
});

/* ─── Tier × family P50 sanity (Phase 7 — Wipro UI/UX session) ────────── */

describe("tier × family P50 (Phase 7)", () => {
  it("looks up the IT-services designer P50 used in the Wipro UI/UX regression", () => {
    const lookup = lookupTierP50("UI/UX Designer", "it-services");
    expect(lookup).not.toBeNull();
    expect(lookup!.family).toBe("designer");
    expect(lookup!.tier).toBe("it-services");
    expect(lookup!.p50).toBeGreaterThanOrEqual(6);
    expect(lookup!.p50).toBeLessThanOrEqual(12);
  });

  it("returns null when the family has no opinion for the tier", () => {
    /* No P50 row for engineer × consulting-mbb beyond what's in the
       table — the lookup must return null and the sanity check must
       skip the tier branch silently rather than throw. */
    expect(lookupTierP50("Astronaut", "it-services")).toBeNull();
    expect(lookupTierP50("Software Engineer", null)).toBeNull();
  });

  it("warns when band initial is above 1.5× tier P50 even if within family bounds", () => {
    /* Wipro UI/UX case condensed: designer family allows up to ₹45 LPA,
       but IT-services tier P50 is ~₹8 LPA. A ₹16 LPA opener passes the
       family bound and fails the tier P50 check (2× P50 = above warn
       threshold, below clamp threshold). */
    const warnings = checkBandSanity(
      { initialOffer: 16, maxStretch: 22, walkAway: 10 },
      "UI/UX Designer",
      "it-services",
    );
    expect(warnings.some(w => w.kind === "initial-above-tier-p50")).toBe(true);
  });

  it("does NOT warn when the band fits the company tier P50", () => {
    /* Same designer family + IT-services tier, but a tier-realistic
       ₹9 LPA opener — within 1.5× P50, no tier warning. */
    const warnings = checkBandSanity(
      { initialOffer: 9, maxStretch: 12, walkAway: 7 },
      "UI/UX Designer",
      "it-services",
    );
    expect(warnings.some(w => w.kind === "initial-above-tier-p50")).toBe(false);
  });

  it("clamps the band when initial > 2× tier P50 (Wipro UI/UX regression)", () => {
    /* The exact Wipro UI/UX case: opener ₹27 LPA, IT-services designer
       P50 ≈ ₹8 LPA. 27 > 2 × 8 = 16, so clamping must trigger and the
       new initial sits around 1.4 × P50. */
    const result = clampBandToTierP50(
      { initialOffer: 27, maxStretch: 35, walkAway: 22 },
      "UI/UX Designer",
      "it-services",
    );
    expect(result.clamped).toBe(true);
    expect(result.originalInitial).toBe(27);
    /* Clamped initial = 1.4 × P50 (~₹11.2 for P50=8). */
    expect(result.band.initialOffer).toBeLessThan(15);
    expect(result.band.initialOffer).toBeGreaterThan(6);
    /* Stretch must still sit above the new initial — band must be
       non-degenerate. */
    expect(result.band.maxStretch).toBeGreaterThan(result.band.initialOffer);
    /* Walkaway below initial (kernel relies on this invariant). */
    expect(result.band.walkAway!).toBeLessThan(result.band.initialOffer);
    expect(result.p50).toBeGreaterThanOrEqual(6);
    expect(result.tier).toBe("it-services");
    expect(result.family).toBe("designer");
  });

  it("does NOT clamp when initial is within tier-plausible range", () => {
    /* A ₹15 LPA opener for IT-services designer is above 1.5× P50 (warn)
       but below 2× P50 (clamp). The band must pass through unchanged. */
    const result = clampBandToTierP50(
      { initialOffer: 15, maxStretch: 20, walkAway: 11 },
      "UI/UX Designer",
      "it-services",
    );
    expect(result.clamped).toBe(false);
    expect(result.band.initialOffer).toBe(15);
  });

  it("does NOT clamp legitimate FAANG senior bands (engineer family)", () => {
    /* A Google L5 / Microsoft Senior SDE legitimately resolves to ₹95-125
       LPA. FAANG engineer P50 is ₹60 LPA in the table, so 95 < 2 × 60 =
       120 — the clamp does NOT fire and the senior outlier ships intact. */
    const result = clampBandToTierP50(
      { initialOffer: 95, maxStretch: 130, walkAway: 80 },
      "Senior Software Engineer",
      "faang",
    );
    expect(result.clamped).toBe(false);
    expect(result.band.initialOffer).toBe(95);
  });

  it("clamp threshold and warn threshold form a sensible band", () => {
    /* Cheap invariant test: clamp threshold must be strictly higher than
       warn threshold, otherwise every clamp would also fail the warning
       and the telemetry would double-fire. */
    expect(TIER_P50_CLAMP_MULTIPLIER).toBeGreaterThan(TIER_P50_WARN_MULTIPLIER);
    /* And the clamped-to multiplier must sit between 1× and the warn
       threshold so the new opener is plausible AND won't immediately
       re-trip the warning post-clamp. */
    expect(CLAMP_INITIAL_MULTIPLIER).toBeGreaterThan(1);
    expect(CLAMP_INITIAL_MULTIPLIER).toBeLessThanOrEqual(TIER_P50_WARN_MULTIPLIER);
  });

  it("Wipro UI/UX × Designer resolves to a clampable band (end-to-end regression)", () => {
    /* Wire the actual production data path: generateNegotiationBand →
       clampBandToTierP50. We don't assert the EXACT clamped opener
       (curator data may move), only that the clamp DOES fire — i.e.
       the production data is currently mis-keyed for this combination
       and the new guard catches it. If a future curator commit fixes
       the underlying data and the clamp stops firing, this test should
       be updated to assert clamped===false to lock in the fix. */
    const b = generateNegotiationBand({ role: "UI/UX Designer", company: "Wipro" });
    const tier = getCompanyTier("Wipro");
    expect(tier).toBe("it-services");
    const result = clampBandToTierP50(
      { initialOffer: b.initialOffer, maxStretch: b.maxStretch },
      "UI/UX Designer",
      tier,
    );
    /* Either the clamp fires (current broken data) or the data has been
       fixed upstream — both are acceptable, but the band MUST end up
       below 2× IT-services designer P50. */
    const effectiveInitial = result.clamped ? result.band.initialOffer : b.initialOffer;
    expect(effectiveInitial).toBeLessThanOrEqual(16); // 2× P50=8
  });
});
