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
} from "../../server-handlers/_band-sanity";
import { generateNegotiationBand } from "../../data/salary-lookup";

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
