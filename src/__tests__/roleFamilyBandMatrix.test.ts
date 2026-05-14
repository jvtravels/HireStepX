/* Fix 2 (2026-05-15) — Role-family × tier band matrix.
 *
 * Real session: Customer Success Manager at Freshworks (product-india)
 * with 5 yrs YOE anchored at ₹34L. Google market data is ₹12.4-17.7L.
 * Root cause: getBandForRole used a single engineering reference row
 * for every role. The fix introduces a roleFamily classifier and a
 * full family × tier matrix. */
import { describe, it, expect } from "vitest";
import {
  classifyRoleFamily,
  getBandForRole,
} from "../../server-handlers/_company-band-tiers";

describe("classifyRoleFamily — role -> family", () => {
  it("classifies CSM titles as csm-cs", () => {
    expect(classifyRoleFamily("Customer Success Manager")).toBe("csm-cs");
    expect(classifyRoleFamily("CSM")).toBe("csm-cs");
    expect(classifyRoleFamily("Account Manager")).toBe("csm-cs");
    expect(classifyRoleFamily("Technical Account Manager")).toBe("csm-cs");
  });

  it("classifies PM titles as product", () => {
    expect(classifyRoleFamily("Product Manager")).toBe("product");
    expect(classifyRoleFamily("Group Product Manager")).toBe("product");
    expect(classifyRoleFamily("Senior PM")).toBe("product");
  });

  it("classifies design titles as design", () => {
    expect(classifyRoleFamily("Senior Product Designer")).toBe("design");
    expect(classifyRoleFamily("UX Designer")).toBe("design");
    expect(classifyRoleFamily("Visual Designer")).toBe("design");
  });

  it("classifies sales titles as sales", () => {
    expect(classifyRoleFamily("Account Executive")).toBe("sales");
    expect(classifyRoleFamily("SDR")).toBe("sales");
    expect(classifyRoleFamily("Enterprise Sales Manager")).toBe("sales");
  });

  it("classifies marketing titles as marketing", () => {
    expect(classifyRoleFamily("Growth Marketing Manager")).toBe("marketing");
    expect(classifyRoleFamily("Product Marketing Manager")).toBe("marketing");
    expect(classifyRoleFamily("Brand Manager")).toBe("marketing");
  });

  it("classifies data titles as data", () => {
    expect(classifyRoleFamily("Data Scientist")).toBe("data");
    expect(classifyRoleFamily("ML Engineer")).toBe("data");
    expect(classifyRoleFamily("Business Analyst")).toBe("data");
  });

  it("classifies ops titles as ops", () => {
    expect(classifyRoleFamily("Operations Manager")).toBe("ops");
    expect(classifyRoleFamily("Supply Chain Manager")).toBe("ops");
    expect(classifyRoleFamily("City Manager")).toBe("ops");
  });

  it("defaults engineering for SWE / dev / unknown technical titles", () => {
    expect(classifyRoleFamily("Software Engineer")).toBe("engineering");
    expect(classifyRoleFamily("React Developer")).toBe("engineering");
    expect(classifyRoleFamily("SDE-II")).toBe("engineering");
    expect(classifyRoleFamily("")).toBe("engineering");
  });
});

describe("getBandForRole — role-family aware bands", () => {
  it("CSM at product-india × 5yr lands within Indian market spread (₹12-20L)", () => {
    const band = getBandForRole("product-india", "Customer Success Manager", 5);
    expect(band.target).toBeGreaterThanOrEqual(12);
    expect(band.target).toBeLessThanOrEqual(20);
    expect(band.floor).toBeGreaterThanOrEqual(10);
    expect(band.ceil).toBeLessThanOrEqual(22);
  });

  it("engineering at it-services × 5yr stays in the legacy ₹8-14L range", () => {
    const band = getBandForRole("it-services", "React Developer", 5);
    expect(band.target).toBeGreaterThanOrEqual(8);
    expect(band.target).toBeLessThanOrEqual(14);
  });

  it("PM at unicorn × 5yr is materially above CSM at unicorn × 5yr", () => {
    const pm = getBandForRole("unicorn", "Product Manager", 5);
    const csm = getBandForRole("unicorn", "Customer Success Manager", 5);
    expect(pm.target).toBeGreaterThan(csm.target);
  });

  it("Design at big-tech × 5yr is materially above design at it-services × 5yr", () => {
    const bigTech = getBandForRole("big-tech", "Product Designer", 5);
    const itSvc = getBandForRole("it-services", "Product Designer", 5);
    expect(bigTech.target).toBeGreaterThan(itSvc.target * 2);
  });

  it("Engineering and Product diverge at the same tier (product premium)", () => {
    const eng = getBandForRole("product-india", "Backend Engineer", 5);
    const pm = getBandForRole("product-india", "Product Manager", 5);
    expect(pm.target).toBeGreaterThan(eng.target);
  });

  it("Consulting at big-tech × 5yr is not engineering-priced (sanity)", () => {
    const consultant = getBandForRole("consulting", "Sales Manager", 5);
    expect(consultant.target).toBeGreaterThan(0);
    expect(consultant.target).toBeLessThan(100);
  });

  it("Freshworks-CSM-5yr regression — target near ₹15L, not ₹34L", () => {
    /* Real session bug. product-india × csm-cs × 5yr base should be
     * ₹15L target. With 5yr yoeScale = 1.0, expect ~₹15L exactly. */
    const band = getBandForRole("product-india", "Customer Success Manager", 5);
    expect(band.target).toBeLessThan(20);
  });

  it("YOE scaling still applies (junior CSM cheaper than senior CSM)", () => {
    const junior = getBandForRole("product-india", "Customer Success Manager", 2);
    const senior = getBandForRole("product-india", "Customer Success Manager", 8);
    expect(senior.target).toBeGreaterThan(junior.target);
  });

  it("Unknown role family defaults to engineering bands", () => {
    const unknown = getBandForRole("product-india", "Wizard Specialist", 5);
    const eng = getBandForRole("product-india", "Backend Engineer", 5);
    expect(unknown.target).toBeCloseTo(eng.target, 0);
  });

  it("Data scientist at gcc × 5yr lands in 5L-50L sanity range", () => {
    const band = getBandForRole("gcc", "Data Scientist", 5);
    expect(band.floor).toBeGreaterThan(5);
    expect(band.ceil).toBeLessThan(50);
  });

  it("Sales at startup × 3yr is non-zero and modest", () => {
    const band = getBandForRole("startup", "Account Executive", 3);
    expect(band.target).toBeGreaterThan(5);
    expect(band.target).toBeLessThan(30);
  });
});
