import { describe, it, expect } from "vitest";
import { normalizeSalaryOffer } from "../../server-handlers/_salary-offer-helpers";

const baseValid = {
  company: "Microsoft",
  role: "Software Engineer",
  level: "mid",
  totalCtcLpa: 35,
  outcome: "accepted",
};

describe("normalizeSalaryOffer", () => {
  it("accepts a minimal valid payload", () => {
    const r = normalizeSalaryOffer("u1", baseValid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.company).toBe("Microsoft");
      expect(r.row.level).toBe("mid");
      expect(r.row.total_ctc_lpa).toBe(35);
      expect(r.row.outcome).toBe("accepted");
      expect(r.row.may_share_aggregate).toBe(false);
      expect(r.row.has_written_letter).toBe(false);
      expect(r.row.source).toBe("self-reported");
    }
  });

  it("rejects missing company", () => {
    const r = normalizeSalaryOffer("u1", { ...baseValid, company: "" });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown level", () => {
    const r = normalizeSalaryOffer("u1", { ...baseValid, level: "principal" });
    expect(r.ok).toBe(false);
  });

  it("rejects unknown outcome", () => {
    const r = normalizeSalaryOffer("u1", { ...baseValid, outcome: "ghosted" });
    expect(r.ok).toBe(false);
  });

  it("rejects out-of-range totalCtc", () => {
    const lo = normalizeSalaryOffer("u1", { ...baseValid, totalCtcLpa: 0 });
    const hi = normalizeSalaryOffer("u1", { ...baseValid, totalCtcLpa: 5000 });
    expect(lo.ok).toBe(false);
    expect(hi.ok).toBe(false);
  });

  it("trims + caps strings", () => {
    const r = normalizeSalaryOffer("u1", {
      ...baseValid,
      company: "  Long Co  ",
      notes: "x".repeat(2000),
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.company).toBe("Long Co");
      expect(r.row.notes?.length).toBe(1000);
    }
  });

  it("preserves optional numeric fields when provided", () => {
    const r = normalizeSalaryOffer("u1", {
      ...baseValid,
      baseLpa: 22,
      variableLpa: 4,
      joiningBonusLpa: 5,
      equityLpa: 8,
      initialOfferLpa: 30,
      finalOfferLpa: 35,
      competingOfferLpa: 40,
      yoeAtOffer: 4.5,
      hasWrittenLetter: true,
      mayShareAggregate: true,
      city: "Bangalore",
      companyTier: "faang",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.base_lpa).toBe(22);
      expect(r.row.equity_lpa).toBe(8);
      expect(r.row.competing_offer_lpa).toBe(40);
      expect(r.row.yoe_at_offer).toBe(4.5);
      expect(r.row.has_written_letter).toBe(true);
      expect(r.row.may_share_aggregate).toBe(true);
      expect(r.row.city).toBe("Bangalore");
      expect(r.row.company_tier).toBe("faang");
    }
  });

  it("treats missing optional numerics as null, not NaN", () => {
    const r = normalizeSalaryOffer("u1", baseValid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.row.base_lpa).toBeNull();
      expect(r.row.equity_lpa).toBeNull();
      expect(r.row.yoe_at_offer).toBeNull();
    }
  });

  it("rejects out-of-range YoE", () => {
    const r = normalizeSalaryOffer("u1", { ...baseValid, yoeAtOffer: 99 });
    expect(r.ok).toBe(false);
  });

  it("rejects negative optional numerics", () => {
    const r = normalizeSalaryOffer("u1", { ...baseValid, baseLpa: -5 });
    expect(r.ok).toBe(false);
  });
});
