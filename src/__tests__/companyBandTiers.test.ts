import { describe, it, expect } from "vitest";
import {
  classifyCompanyTier,
  getBandForRole,
} from "../../server-handlers/_company-band-tiers";

describe("Bug 1: classifyCompanyTier (band-tier)", () => {
  it("classifies IT-services companies", () => {
    expect(classifyCompanyTier("Infosys")).toBe("it-services");
    expect(classifyCompanyTier("TCS")).toBe("it-services");
    expect(classifyCompanyTier("Wipro")).toBe("it-services");
    expect(classifyCompanyTier("Cognizant")).toBe("it-services");
    expect(classifyCompanyTier("HCL Technologies")).toBe("it-services");
    expect(classifyCompanyTier("Tech Mahindra")).toBe("it-services");
    expect(classifyCompanyTier("Capgemini India")).toBe("it-services");
    expect(classifyCompanyTier("LTIMindtree")).toBe("it-services");
    expect(classifyCompanyTier("Mphasis")).toBe("it-services");
    expect(classifyCompanyTier("Accenture")).toBe("it-services");
  });
  it("classifies big-tech", () => {
    expect(classifyCompanyTier("Google")).toBe("big-tech");
    expect(classifyCompanyTier("Microsoft India")).toBe("big-tech");
    expect(classifyCompanyTier("Amazon")).toBe("big-tech");
    expect(classifyCompanyTier("Meta")).toBe("big-tech");
    expect(classifyCompanyTier("Apple")).toBe("big-tech");
    expect(classifyCompanyTier("Netflix")).toBe("big-tech");
  });
  it("classifies GCC", () => {
    expect(classifyCompanyTier("Walmart Labs")).toBe("gcc");
    expect(classifyCompanyTier("Target")).toBe("gcc");
    expect(classifyCompanyTier("Lowe's India")).toBe("gcc");
    expect(classifyCompanyTier("JPMC")).toBe("gcc");
    expect(classifyCompanyTier("Deutsche Bank")).toBe("gcc");
  });
  it("classifies unicorns", () => {
    expect(classifyCompanyTier("Flipkart")).toBe("unicorn");
    expect(classifyCompanyTier("Swiggy")).toBe("unicorn");
    expect(classifyCompanyTier("Zomato")).toBe("unicorn");
    expect(classifyCompanyTier("Razorpay")).toBe("unicorn");
    expect(classifyCompanyTier("PhonePe")).toBe("unicorn");
  });
  it("classifies product-india", () => {
    expect(classifyCompanyTier("Zoho")).toBe("product-india");
    expect(classifyCompanyTier("Freshworks")).toBe("product-india");
    expect(classifyCompanyTier("Postman")).toBe("product-india");
    expect(classifyCompanyTier("Hasura")).toBe("product-india");
    expect(classifyCompanyTier("BrowserStack")).toBe("product-india");
  });
  it("classifies consulting", () => {
    expect(classifyCompanyTier("McKinsey")).toBe("consulting");
    expect(classifyCompanyTier("BCG")).toBe("consulting");
    expect(classifyCompanyTier("Bain & Company")).toBe("consulting");
    expect(classifyCompanyTier("Deloitte")).toBe("consulting");
    expect(classifyCompanyTier("EY")).toBe("consulting");
  });
  it("classifies BFSI", () => {
    expect(classifyCompanyTier("HDFC Bank")).toBe("bfsi");
    expect(classifyCompanyTier("ICICI Bank")).toBe("bfsi");
    expect(classifyCompanyTier("SBI")).toBe("bfsi");
    expect(classifyCompanyTier("Axis Bank")).toBe("bfsi");
  });
  it("returns sme for unknown / empty", () => {
    expect(classifyCompanyTier("")).toBe("sme");
    expect(classifyCompanyTier(null)).toBe("sme");
    expect(classifyCompanyTier(undefined)).toBe("sme");
    expect(classifyCompanyTier("Random Pvt Ltd")).toBe("sme");
  });
});

describe("Bug 1: getBandForRole (React Dev / 5yr / each tier)", () => {
  it("IT-services React Dev 5yr ≈ ₹8-14L (target ₹11L)", () => {
    const b = getBandForRole("it-services", "React Developer", 5);
    expect(b.floor).toBeCloseTo(8, 0);
    expect(b.ceil).toBeCloseTo(14, 0);
    expect(b.target).toBeCloseTo(11, 0);
  });
  it("product-india ≈ ₹18-32L target ₹24L", () => {
    const b = getBandForRole("product-india", "React Developer", 5);
    expect(b.target).toBeCloseTo(24, 0);
    expect(b.ceil).toBeCloseTo(32, 0);
  });
  it("gcc ≈ ₹22-38L target ₹28L", () => {
    const b = getBandForRole("gcc", "React Developer", 5);
    expect(b.target).toBeCloseTo(28, 0);
  });
  it("unicorn ≈ ₹20-40L target ₹28L", () => {
    const b = getBandForRole("unicorn", "React Developer", 5);
    expect(b.target).toBeCloseTo(28, 0);
  });
  it("big-tech ≈ ₹35-65L target ₹48L", () => {
    const b = getBandForRole("big-tech", "React Developer", 5);
    expect(b.target).toBeCloseTo(48, 0);
    expect(b.ceil).toBeCloseTo(65, 0);
  });
  it("bfsi target ≈ ₹16L", () => {
    const b = getBandForRole("bfsi", "React Developer", 5);
    expect(b.target).toBeCloseTo(16, 0);
  });
  it("consulting target ≈ ₹20L", () => {
    const b = getBandForRole("consulting", "React Developer", 5);
    expect(b.target).toBeCloseTo(20, 0);
  });
  it("startup target ≈ ₹18L", () => {
    const b = getBandForRole("startup", "React Developer", 5);
    expect(b.target).toBeCloseTo(18, 0);
  });
  it("sme target ≈ ₹9L", () => {
    const b = getBandForRole("sme", "React Developer", 5);
    expect(b.target).toBeCloseTo(9, 0);
  });
  it("pharma target ≈ ₹14L", () => {
    const b = getBandForRole("pharma", "React Developer", 5);
    expect(b.target).toBeCloseTo(14, 0);
  });
});

describe("Bug 1: getBandForRole yoe scaling", () => {
  it("<2y scales down (×0.6)", () => {
    const base = getBandForRole("it-services", "React Developer", 5);
    const junior = getBandForRole("it-services", "React Developer", 1);
    expect(junior.target).toBeCloseTo(base.target * 0.6, 0);
  });
  it("2-4y scales to ×0.85", () => {
    const base = getBandForRole("it-services", "React Developer", 5);
    const mid = getBandForRole("it-services", "React Developer", 3);
    expect(mid.target).toBeCloseTo(base.target * 0.85, 0);
  });
  it("8-12y scales up to ×1.4", () => {
    const base = getBandForRole("it-services", "React Developer", 5);
    const senior = getBandForRole("it-services", "React Developer", 10);
    expect(senior.target).toBeCloseTo(base.target * 1.4, 0);
  });
  it("12+y scales to ×1.8", () => {
    const base = getBandForRole("it-services", "React Developer", 5);
    const ld = getBandForRole("it-services", "React Developer", 14);
    expect(ld.target).toBeCloseTo(base.target * 1.8, 0);
  });
});

describe("Bug 1: regression — Infosys React Dev does NOT anchor ₹22L", () => {
  it("infosys react dev 5yr target is far below ₹22L", () => {
    const tier = classifyCompanyTier("Infosys");
    const b = getBandForRole(tier, "React Developer", 5);
    expect(tier).toBe("it-services");
    expect(b.ceil).toBeLessThanOrEqual(15);
    expect(b.target).toBeLessThanOrEqual(12);
  });
});
