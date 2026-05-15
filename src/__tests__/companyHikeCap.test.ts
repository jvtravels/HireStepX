import { describe, it, expect } from "vitest";
import { getCompanyHikeCap, COMPANY_HIKE_CAP_PCT, isCounterOfferRiskEmployer, COUNTER_OFFER_RISK_EMPLOYERS } from "../../server-handlers/_company-band-tiers";

describe("_company-band-tiers — getCompanyHikeCap", () => {
  it("Infosys → 30%", () => {
    expect(getCompanyHikeCap("Infosys")).toBe(30);
  });
  it("Flipkart → 50%", () => {
    expect(getCompanyHikeCap("Flipkart")).toBe(50);
  });
  it("Goldman Sachs → 35%", () => {
    expect(getCompanyHikeCap("Goldman Sachs Bangalore")).toBe(35);
  });
  it("Zoho → 25%", () => {
    expect(getCompanyHikeCap("Zoho Corp")).toBe(25);
  });
  it("unknown → null", () => {
    expect(getCompanyHikeCap("Random SME Pvt Ltd")).toBeNull();
    expect(getCompanyHikeCap(null)).toBeNull();
  });
  it("substring match — 'Tata Consultancy Services' resolves", () => {
    expect(getCompanyHikeCap("Tata Consultancy Services")).toBe(30);
  });
});

describe("_company-band-tiers — counter-offer risk set", () => {
  it("Infosys is in the well-funded set", () => {
    expect(isCounterOfferRiskEmployer("Infosys")).toBe(true);
  });
  it("Swiggy is in the well-funded set", () => {
    expect(isCounterOfferRiskEmployer("Swiggy Bangalore")).toBe(true);
  });
  it("Random SME is NOT in the set", () => {
    expect(isCounterOfferRiskEmployer("Random Pvt Ltd")).toBe(false);
  });
  it("null name → false", () => {
    expect(isCounterOfferRiskEmployer(null)).toBe(false);
  });
  it("set has at least the audit-list companies", () => {
    expect(COUNTER_OFFER_RISK_EMPLOYERS.size).toBeGreaterThan(15);
    expect(COMPANY_HIKE_CAP_PCT.size).toBeGreaterThan(20);
  });
});
