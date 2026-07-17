import { describe, it, expect } from "vitest";
import { generateNegotiationBand } from "../../data/salary-lookup";
import { matchRoleKeyResolved, matchRoleKey } from "../../data/salaries";

/**
 * OA-B10 / OA-B19 / OA-B22 — the salary lookup used to silently substitute a
 * confident arbitrary default whenever the company, the role, or the role's
 * data was unmapped, shipping a wrong-but-authoritative band. The fix threads
 * a single {value, resolved} provenance contract (companyTierResolved +
 * roleResolved) to the one derivation site so consumers can tell an estimate
 * from a researched number. These tests lock that contract.
 */
describe("band resolution provenance (OA-B10/B19/B22)", () => {
  describe("matchRoleKeyResolved (single source of truth for role mapping)", () => {
    it("reports matched=true for a known role and matchRoleKey delegates", () => {
      const r = matchRoleKeyResolved("Senior Product Manager");
      expect(r.matched).toBe(true);
      expect(r.key).toBe("product-manager");
      expect(matchRoleKey("Senior Product Manager")).toBe(r.key);
    });

    it("reports matched=false for an unmapped role that falls to the SWE catch-all", () => {
      const r = matchRoleKeyResolved("Interdimensional Vibe Curator");
      expect(r.matched).toBe(false);
      expect(r.key).toBe("software-engineer");
    });

    it("reports matched=false for empty input", () => {
      expect(matchRoleKeyResolved("").matched).toBe(false);
    });
  });

  describe("OA-B10 — unmapped company", () => {
    it("flags companyTierResolved=false when the company is not in the tier map", () => {
      const band = generateNegotiationBand({
        role: "Software Engineer",
        company: "Totally Fictional Ltd XYZ",
        experienceLevel: "senior",
      });
      expect(band.companyTierResolved).toBe(false);
    });

    it("flags companyTierResolved=true for a known company", () => {
      const band = generateNegotiationBand({
        role: "Software Engineer",
        company: "Google",
        experienceLevel: "senior",
      });
      expect(band.companyTierResolved).toBe(true);
    });
  });

  describe("OA-B19 — unmapped role", () => {
    it("flags roleResolved=false when the role is unmapped", () => {
      const band = generateNegotiationBand({
        role: "Interdimensional Vibe Curator",
        company: "Google",
        experienceLevel: "senior",
      });
      expect(band.roleResolved).toBe(false);
    });

    it("flags roleResolved=true for a mapped role with real data", () => {
      const band = generateNegotiationBand({
        role: "Software Engineer",
        company: "Google",
        experienceLevel: "senior",
      });
      expect(band.roleResolved).toBe(true);
    });
  });

  describe("OA-B22 — cross-family SWE data borrow", () => {
    it("flags an unmapped role at an unmapped company as a non-researched estimate", () => {
      // No company override can fire (unmapped company) and the role is
      // unmapped, so the band is a pure estimate — provenance must say so
      // instead of shipping a confident tier-default/company-override number.
      const band = generateNegotiationBand({
        role: "Interdimensional Vibe Curator",
        company: "Totally Fictional Ltd XYZ",
        experienceLevel: "senior",
      });
      expect(band.roleResolved).toBe(false);
      expect(band.companyTierResolved).toBe(false);
      // Whatever layer priced it, it must not masquerade as a researched
      // role band — never "tier-default", which implies real role data.
      expect(band.bandSource).not.toBe("tier-default");
    });
  });

  it("does not regress a fully-resolved band (known company + known role)", () => {
    const band = generateNegotiationBand({
      role: "Product Manager",
      company: "Flipkart",
      experienceLevel: "senior",
    });
    expect(band.companyTierResolved).toBe(true);
    expect(band.roleResolved).toBe(true);
    expect(band.initialOffer).toBeGreaterThan(0);
    expect(band.maxStretch).toBeGreaterThanOrEqual(band.initialOffer);
  });
});
