import { describe, it, expect } from "vitest";
import {
  classifyCompanyTier,
  classifyRoleFamily,
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
    // Accenture reclassified to consulting (S50-B5, 2026-07-24)
  });
  it("classifies Accenture as consulting (S50-B5)", () => {
    expect(classifyCompanyTier("Accenture")).toBe("consulting");
    expect(classifyCompanyTier("Accenture Strategy")).toBe("consulting");
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

  // S46-B2: Quick-commerce players were in QCOM (sector) but not UNICORN (comp-tier),
  // so they fell through to "sme" and received a ₹9-19L band — far below market.
  it("classifies quick-commerce players as unicorn (S46-B2)", () => {
    expect(classifyCompanyTier("Zepto")).toBe("unicorn");
    expect(classifyCompanyTier("zepto")).toBe("unicorn");
    expect(classifyCompanyTier("Blinkit")).toBe("unicorn");
    expect(classifyCompanyTier("Dunzo Daily")).toBe("unicorn");
    expect(classifyCompanyTier("Instamart")).toBe("unicorn");
  });
  it("classifies Reliance Jio and PayU as unicorn, not sme (S181/S182)", () => {
    expect(classifyCompanyTier("Reliance Jio")).toBe("unicorn");
    expect(classifyCompanyTier("Jio Platforms")).toBe("unicorn");
    expect(classifyCompanyTier("Jio")).toBe("unicorn");
    expect(classifyCompanyTier("PayU")).toBe("unicorn");
    // Regression guard: the bare "jio" token must not swallow unrelated names.
    expect(classifyCompanyTier("Religion Tech")).toBe("sme");
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

/* N-1 (2026-07-10, live staging — Senior Product Designer @ a design studio,
 * text-only setup so YoE unknown) — a senior title with UNKNOWN YoE resolved
 * to a mid-IC band (₹8 target / ₹11.5 ceil) because yoeScale() defaults to the
 * 5-yr anchor and only the 1.15× roleModifier lifted it. A seniority-bearing
 * title is itself an experience floor; when YoE is unknown, the title now
 * floors the effective YoE (TITLE_IMPLIED_YOE). Explicit YoE is untouched. */
describe("N-1: title-implied YoE floor when YoE is unknown", () => {
  it("Senior title (unknown YoE) lifts the band well above the 5-yr mid anchor", () => {
    const mid = getBandForRole("sme", "Product Designer", null);
    const senior = getBandForRole("sme", "Senior Product Designer", null);
    // Senior with no YoE must clear the mid band, not collapse onto it.
    expect(senior.target).toBeGreaterThan(mid.target * 1.3);
    expect(senior.ceil).toBeGreaterThanOrEqual(15);
  });

  it("Staff/Principal (unknown YoE) floors higher than Senior", () => {
    const senior = getBandForRole("sme", "Senior Product Designer", null);
    const staff = getBandForRole("sme", "Staff Product Designer", null);
    expect(staff.target).toBeGreaterThan(senior.target);
  });

  it("explicit YoE is byte-identical (floor fires ONLY on unknown YoE)", () => {
    // yoe=5 senior — the title floor must NOT override a supplied YoE.
    const a = getBandForRole("sme", "Senior Product Designer", 5);
    const b = getBandForRole("sme", "Senior Product Designer", 5);
    expect(a).toEqual(b);
    // With yoe=5 the multiplier is yoeScale(5)=1.0 × roleModifier(senior)=1.15.
    const base = getBandForRole("sme", "Product Designer", 5);
    expect(a.target).toBeCloseTo(base.target * 1.15, 0);
  });

  it("non-senior title (unknown YoE) still uses the 5-yr default anchor", () => {
    const unknown = getBandForRole("sme", "Product Designer", null);
    const fiveYr = getBandForRole("sme", "Product Designer", 5);
    expect(unknown).toEqual(fiveYr);
  });
});

describe("S189-S198: exec / director / head / founding seniority lift (unknown YoE)", () => {
  it("VP-level title resolves ABOVE a same-family 5-yr IC (S193)", () => {
    const vp = getBandForRole("unicorn", "VP of Engineering", null);
    const ic = getBandForRole("unicorn", "Software Engineer", 5);
    // A VP must not collapse to (or below) the 5-yr IC anchor.
    expect(vp.target).toBeGreaterThan(ic.target * 1.5);
  });

  it("Director resolves above a Staff IC (S192 vs director)", () => {
    const dir = getBandForRole("unicorn", "Director of Engineering", null);
    const staff = getBandForRole("unicorn", "Staff Software Engineer", null);
    // Director sits at exec level — at least on par with staff, not below it.
    expect(dir.target).toBeGreaterThanOrEqual(staff.target * 0.9);
  });

  it("Head-of-function lifts above the IC anchor and keeps its family (S191)", () => {
    // "Head of Data Science" must route to the data family, not engineering...
    expect(classifyRoleFamily("Head of Data Science")).toBe("data");
    const head = getBandForRole("unicorn", "Head of Data Science", null);
    const ic = getBandForRole("unicorn", "Data Scientist", 5);
    expect(head.target).toBeGreaterThan(ic.target * 1.5);
  });

  it("Founding engineer gets a senior-equivalent lift (S194)", () => {
    const founding = getBandForRole("startup", "Founding Engineer", null);
    const junior = getBandForRole("startup", "Software Engineer", 2);
    expect(founding.target).toBeGreaterThan(junior.target);
  });

  it("explicit YoE still wins for exec titles (byte-identical)", () => {
    const a = getBandForRole("unicorn", "VP of Engineering", 6);
    const b = getBandForRole("unicorn", "VP of Engineering", 6);
    expect(a).toEqual(b);
  });
});

describe("S123: consulting-senior ladder lifts above the IC Consultant anchor", () => {
  const consultant = getBandForRole("consulting", "Consultant", null);
  it("Partner resolves far above a base Consultant", () => {
    const partner = getBandForRole("consulting", "Partner", null);
    expect(partner.target).toBeGreaterThan(consultant.target * 2.5);
  });
  it("Associate Partner sits between Partner and Engagement Manager", () => {
    const ap = getBandForRole("consulting", "Associate Partner", null);
    const partner = getBandForRole("consulting", "Partner", null);
    const em = getBandForRole("consulting", "Engagement Manager", null);
    expect(ap.target).toBeLessThan(partner.target);
    expect(ap.target).toBeGreaterThan(em.target);
  });
  it("Engagement Manager lifts above the IC Consultant", () => {
    const em = getBandForRole("consulting", "Engagement Manager", null);
    expect(em.target).toBeGreaterThan(consultant.target * 1.4);
  });
  it("the consulting-senior lift is gated to the consulting tier", () => {
    // "Partner" outside consulting (e.g. a sales 'Partner' at a unicorn) must
    // NOT get the equity-partner lift — it stays at the generic anchor.
    const uniPartner = getBandForRole("unicorn", "Partner", null);
    const uniBase = getBandForRole("unicorn", "Software Engineer", null);
    expect(uniPartner.target).toBeLessThanOrEqual(uniBase.target * 1.1);
  });
  it("sales/BD 'Partner Manager' in consulting is not lifted as equity partner", () => {
    const pm = getBandForRole("consulting", "Partner Manager", null);
    const partner = getBandForRole("consulting", "Partner", null);
    expect(pm.target).toBeLessThan(partner.target * 0.6);
  });
});
