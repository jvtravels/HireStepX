/* Wave-7 company-band-tier expansion tests.
 *
 * The Wave-7 ship added ~150 keyword entries across the 8 existing tier
 * buckets plus a new sector classifier covering 13 verticals. These
 * tests lock the major expansion roster so future churn doesn't silently
 * drop a major Indian employer back to the "sme" fallback. */
import { describe, it, expect } from "vitest";
import {
  classifyCompanyTier,
  classifyCompanySector,
} from "../../server-handlers/_company-band-tiers";

describe("classifyCompanyTier — Wave-7 expansion", () => {
  it("classifies new IT-services entrants correctly", () => {
    expect(classifyCompanyTier("LTTS")).toBe("it-services");
    expect(classifyCompanyTier("L&T Technology Services")).toBe("it-services");
    expect(classifyCompanyTier("Happiest Minds")).toBe("it-services");
    expect(classifyCompanyTier("Tata Elxsi")).toBe("it-services");
    expect(classifyCompanyTier("Nagarro")).toBe("it-services");
    expect(classifyCompanyTier("Thoughtworks")).toBe("it-services");
    expect(classifyCompanyTier("Globant")).toBe("it-services");
    expect(classifyCompanyTier("Virtusa")).toBe("it-services");
  });

  it("classifies new big-tech entries", () => {
    expect(classifyCompanyTier("Salesforce")).toBe("big-tech");
    expect(classifyCompanyTier("Atlassian")).toBe("big-tech");
    expect(classifyCompanyTier("Stripe")).toBe("big-tech");
    expect(classifyCompanyTier("Snowflake")).toBe("big-tech");
    expect(classifyCompanyTier("Databricks")).toBe("big-tech");
    expect(classifyCompanyTier("NVIDIA")).toBe("big-tech");
  });

  it("classifies expanded GCC roster", () => {
    expect(classifyCompanyTier("Tesco")).toBe("gcc");
    expect(classifyCompanyTier("Bank of America")).toBe("gcc");
    expect(classifyCompanyTier("Standard Chartered")).toBe("gcc");
    expect(classifyCompanyTier("SAP Labs")).toBe("gcc");
    expect(classifyCompanyTier("Dell India")).toBe("gcc");
    expect(classifyCompanyTier("Cisco India")).toBe("gcc");
    expect(classifyCompanyTier("Bosch")).toBe("gcc");
  });

  it("classifies new unicorns", () => {
    expect(classifyCompanyTier("Rapido")).toBe("unicorn");
    expect(classifyCompanyTier("Porter")).toBe("unicorn");
    expect(classifyCompanyTier("Shiprocket")).toBe("unicorn");
    expect(classifyCompanyTier("Zerodha")).toBe("unicorn");
    expect(classifyCompanyTier("Myntra")).toBe("unicorn");
    expect(classifyCompanyTier("PhysicsWallah")).toBe("unicorn");
  });

  it("classifies expanded BFSI roster", () => {
    expect(classifyCompanyTier("PNB")).toBe("bfsi");
    expect(classifyCompanyTier("Punjab National Bank")).toBe("bfsi");
    expect(classifyCompanyTier("LIC")).toBe("bfsi");
    expect(classifyCompanyTier("Bajaj Finserv")).toBe("bfsi");
    expect(classifyCompanyTier("Muthoot")).toBe("bfsi");
    expect(classifyCompanyTier("Canara Bank")).toBe("bfsi");
  });

  it("classifies expanded pharma roster", () => {
    expect(classifyCompanyTier("Zydus")).toBe("pharma");
    expect(classifyCompanyTier("Alkem")).toBe("pharma");
    expect(classifyCompanyTier("Piramal")).toBe("pharma");
    expect(classifyCompanyTier("Mankind")).toBe("pharma");
    expect(classifyCompanyTier("Abbott India")).toBe("pharma");
  });

  it("classifies expanded consulting roster", () => {
    expect(classifyCompanyTier("Kearney")).toBe("consulting");
    expect(classifyCompanyTier("Oliver Wyman")).toBe("consulting");
    expect(classifyCompanyTier("ZS Associates")).toBe("consulting");
    expect(classifyCompanyTier("Mercer")).toBe("consulting");
  });

  it("classifies expanded product-india", () => {
    expect(classifyCompanyTier("Innovaccer")).toBe("product-india");
    expect(classifyCompanyTier("MindTickle")).toBe("product-india");
    expect(classifyCompanyTier("CleverTap")).toBe("product-india");
    expect(classifyCompanyTier("Whatfix")).toBe("product-india");
  });

  it("falls back to sme for genuinely unknown employers", () => {
    expect(classifyCompanyTier("Random SMB Pvt Ltd")).toBe("sme");
    expect(classifyCompanyTier("")).toBe("sme");
    expect(classifyCompanyTier(null)).toBe("sme");
  });
});

describe("classifyCompanySector — Wave-7 sector classifier", () => {
  it("returns null for unknown companies", () => {
    expect(classifyCompanySector("Random Pvt Ltd")).toBe(null);
    expect(classifyCompanySector(null)).toBe(null);
    expect(classifyCompanySector("")).toBe(null);
  });

  it("recognises edtech names", () => {
    expect(classifyCompanySector("Byju's")).toBe("edtech");
    expect(classifyCompanySector("Unacademy")).toBe("edtech");
    expect(classifyCompanySector("PhysicsWallah")).toBe("edtech");
    expect(classifyCompanySector("Scaler")).toBe("edtech");
  });

  it("recognises EV / mobility startups", () => {
    expect(classifyCompanySector("Ather")).toBe("ev-mobility");
    expect(classifyCompanySector("Ola Electric")).toBe("ev-mobility");
    expect(classifyCompanySector("Ultraviolette")).toBe("ev-mobility");
    expect(classifyCompanySector("Tork Motors")).toBe("ev-mobility");
  });

  it("recognises space-tech startups", () => {
    expect(classifyCompanySector("Skyroot")).toBe("space-tech");
    expect(classifyCompanySector("Agnikul")).toBe("space-tech");
    expect(classifyCompanySector("Pixxel")).toBe("space-tech");
  });

  it("recognises defence startups", () => {
    expect(classifyCompanySector("Tonbo")).toBe("defence");
    expect(classifyCompanySector("ideaForge")).toBe("defence");
    expect(classifyCompanySector("Paras Defence")).toBe("defence");
  });

  it("recognises web3 / crypto", () => {
    expect(classifyCompanySector("Polygon Labs")).toBe("web3-crypto");
    expect(classifyCompanySector("CoinDCX")).toBe("web3-crypto");
    expect(classifyCompanySector("WazirX")).toBe("web3-crypto");
  });

  it("recognises PSUs / defence-aero", () => {
    expect(classifyCompanySector("Indian Oil")).toBe("psu-defence-aero");
    expect(classifyCompanySector("ONGC")).toBe("psu-defence-aero");
    expect(classifyCompanySector("BHEL")).toBe("psu-defence-aero");
    expect(classifyCompanySector("HAL")).toBe("psu-defence-aero");
    expect(classifyCompanySector("DRDO")).toBe("psu-defence-aero");
  });

  it("subdivides fintech sub-sectors", () => {
    expect(classifyCompanySector("Lendingkart")).toBe("fintech-lending");
    expect(classifyCompanySector("Razorpay")).toBe("fintech-payments");
    expect(classifyCompanySector("Groww")).toBe("fintech-wealth");
    expect(classifyCompanySector("Jupiter")).toBe("fintech-neobank");
    expect(classifyCompanySector("Acko")).toBe("fintech-insurtech");
  });

  it("recognises core engineering employers", () => {
    expect(classifyCompanySector("L&T")).toBe("core-engineering");
    expect(classifyCompanySector("Siemens India")).toBe("core-engineering");
    expect(classifyCompanySector("Thermax")).toBe("core-engineering");
  });

  it("recognises quick-commerce players", () => {
    expect(classifyCompanySector("Zepto")).toBe("quick-commerce");
    expect(classifyCompanySector("Blinkit")).toBe("quick-commerce");
    expect(classifyCompanySector("Swiggy Instamart")).toBe("quick-commerce");
  });
});
