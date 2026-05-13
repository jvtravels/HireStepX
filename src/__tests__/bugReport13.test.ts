/* Bug-report 13 (2026-05-14) — regression suite for the three fixes:
 *
 *   1. Domain-canonicalisation table now covers operations / management /
 *      business / sales / marketing / customer-success / hr-people /
 *      finance so a Senior Product Designer applying to Operations
 *      Manager classifies as a pivot (applicableYoe = 0).
 *   2. Zepto Operations Manager band added so applicableYoe=0 routes to
 *      a calibrated entry tier (≤₹6L), not the unicorn SWE default.
 *   3. enforceRoleLabel is wired on every return path of generateAiText
 *      (llm, llm-retry, AND fallback) and the deterministic opener uses
 *      state.role verbatim.
 *
 * End-to-end: kernel state with role="Operations Manager", company=
 * "zepto", candidateApplicableYoe=0 → deterministic opener mentions
 * "Operations Manager" (NOT "Senior Operations Manager") and opens
 * ≤ ₹6L.
 */
import { describe, it, expect } from "vitest";
import {
  computeApplicableYoe,
  experienceLevelFromYoe,
} from "../../server-handlers/_candidate-profile";
import {
  initState,
  pickAiMove,
  type NegotiationBand,
} from "../../server-handlers/_negotiation-kernel";
import { deterministicFallbackText } from "../../server-handlers/_negotiate-turn-helpers";
import { enforceRoleLabel } from "../../server-handlers/_role-label";
import { generateNegotiationBand } from "../../data/salary-lookup";

describe("bug-report 13 — Root cause 2: domain-pivot detection covers operations", () => {
  it("Senior Product Designer (5y) → Operations Manager → pivot, applicableYoe = 0", () => {
    const r = computeApplicableYoe({
      totalYoe: 5,
      primaryDomain: "Senior Product Designer",
      targetRole: "Operations Manager",
    });
    expect(r.relation).toBe("pivot");
    expect(r.applicableYoe).toBe(0);
    expect(r.candidateDomainKey).toBe("product-design");
    expect(r.targetDomainKey).toBe("operations");
  });

  it("Backend Engineer (6y) → Operations Manager → pivot, applicableYoe = 0", () => {
    const r = computeApplicableYoe({
      totalYoe: 6,
      primaryDomain: "Backend Engineer",
      targetRole: "Operations Manager",
    });
    expect(r.relation).toBe("pivot");
    expect(r.applicableYoe).toBe(0);
  });

  it("Engineering Manager → Product Manager → adjacent (both within management cluster)", () => {
    const r = computeApplicableYoe({
      totalYoe: 6,
      primaryDomain: "Engineering Manager",
      targetRole: "Product Manager",
    });
    expect(r.relation).toBe("adjacent");
  });

  it("Operations Manager → Supply Chain Manager → match (both 'operations')", () => {
    const r = computeApplicableYoe({
      totalYoe: 4,
      primaryDomain: "Operations Manager",
      targetRole: "Supply Chain Manager",
    });
    expect(r.relation).toBe("match");
    expect(r.applicableYoe).toBe(4);
  });

  it("Recruiter → HR Manager → match (both 'hr-people')", () => {
    const r = computeApplicableYoe({
      totalYoe: 3,
      primaryDomain: "Recruiter",
      targetRole: "HR Manager",
    });
    expect(r.relation).toBe("match");
  });

  it("Business Analyst → Operations Manager → pivot (business and operations are not adjacent)", () => {
    const r = computeApplicableYoe({
      totalYoe: 4,
      primaryDomain: "Business Analyst",
      targetRole: "Operations Manager",
    });
    expect(r.relation).toBe("pivot");
    expect(r.applicableYoe).toBe(0);
  });

  it("applicableYoe = 0 routes to experienceLevel = 'entry'", () => {
    expect(experienceLevelFromYoe(0)).toBe("entry");
  });
});

describe("bug-report 13 — Root cause 3: Zepto Operations Manager band", () => {
  it("entry-level Ops Mgr @ Zepto opens at or below ₹6L (entry tier)", () => {
    const band = generateNegotiationBand({
      role: "Operations Manager",
      company: "zepto",
      experienceLevel: "entry",
    });
    expect(band.initialOffer).toBeGreaterThan(0);
    expect(band.initialOffer).toBeLessThanOrEqual(6);
  });

  it("senior Ops Mgr @ Zepto sits in calibrated senior tier (~₹10-16L)", () => {
    const band = generateNegotiationBand({
      role: "Operations Manager",
      company: "zepto",
      experienceLevel: "senior",
    });
    expect(band.initialOffer).toBeGreaterThanOrEqual(10);
    expect(band.initialOffer).toBeLessThanOrEqual(16);
  });

  it("lead Ops Mgr @ Zepto sits in calibrated senior-lead tier (≤₹24L)", () => {
    const band = generateNegotiationBand({
      role: "Operations Manager",
      company: "zepto",
      experienceLevel: "lead",
    });
    expect(band.initialOffer).toBeLessThanOrEqual(24);
    expect(band.maxStretch).toBeGreaterThanOrEqual(17);
  });
});

describe("bug-report 13 — Root cause 1: enforceRoleLabel strips Senior on opener template", () => {
  it("strips 'Senior' adjective from the literal Bug-13 opener", () => {
    expect(
      enforceRoleLabel(
        "For the Senior Operations Manager role, we'd like to offer you a total CTC of ₹25 LPA.",
        "Operations Manager",
      ),
    ).toBe("For the Operations Manager role, we'd like to offer you a total CTC of ₹25 LPA.");
  });

  it("idempotent on clean opener", () => {
    const clean = "Our offer for the Operations Manager position is ₹5 LPA total CTC.";
    expect(enforceRoleLabel(clean, "Operations Manager")).toBe(clean);
  });
});

describe("bug-report 13 — end-to-end: Ops Mgr @ Zepto with applicableYoe=0", () => {
  it("deterministic opener uses 'Operations Manager' verbatim and opens ≤ ₹6L", () => {
    const band = generateNegotiationBand({
      role: "Operations Manager",
      company: "zepto",
      experienceLevel: "entry",
    });
    const kernelBand: NegotiationBand = {
      initialOffer: band.initialOffer,
      maxStretch: band.maxStretch,
      walkAway: typeof band.minOffer === "number" ? band.minOffer : band.initialOffer * 0.75,
      hasEquity: false,
    };
    const state = initState({
      sessionId: "bug13",
      role: "Operations Manager",
      company: "zepto",
      band: kernelBand,
      candidateTotalYoe: 5,
      candidateApplicableYoe: 0,
      candidatePrimaryDomain: "Product Design",
    });
    const move = pickAiMove(state);
    const rawText = deterministicFallbackText(state, move);
    const cleaned = enforceRoleLabel(rawText, state.role);
    expect(cleaned).toMatch(/Operations Manager/);
    expect(cleaned).not.toMatch(/Senior Operations Manager/i);
    /* Move's newTotalLpa is the opening figure surfaced to the user. */
    if (typeof move.newTotalLpa === "number") {
      expect(move.newTotalLpa).toBeLessThanOrEqual(6);
    }
    expect(band.initialOffer).toBeLessThanOrEqual(6);
  });
});
