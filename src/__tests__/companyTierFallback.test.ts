/**
 * Regression tests for getCompanyTier() in data/company-tiers.ts.
 *
 * The function maps free-text company names → CompanyTier (used for
 * salary-band lookup). Substring matching has been a source of silent
 * mis-tiering — the most expensive recent bug was "Bombay Design
 * Centre" falling through to indian-unicorn, producing a ₹22L opening
 * offer for a Product Designer where the real market is ₹9-10L.
 *
 * These tests pin the design-firm naming conventions + the keyword
 * fallbacks so that mis-tiering can't silently regress.
 */

import { describe, it, expect } from "vitest";
import { getCompanyTier } from "../../data/company-tiers";

describe("getCompanyTier — design-firm fallbacks (2026-Q2 fix)", () => {
  it("maps generic '<word> Design Centre/Company/Studio' to it-services", () => {
    expect(getCompanyTier("Bombay Design Centre")).toBe("it-services");
    expect(getCompanyTier("Bombay Design Center")).toBe("it-services");
    expect(getCompanyTier("Bombay Design Company")).toBe("it-services");
    expect(getCompanyTier("Hyderabad Design Lab")).toBe("it-services");
    expect(getCompanyTier("Pune Design Works")).toBe("it-services");
    expect(getCompanyTier("Bangalore Design Partners")).toBe("it-services");
    expect(getCompanyTier("Madras Design House")).toBe("it-services");
    expect(getCompanyTier("Indus Design Collective")).toBe("it-services");
  });

  it("maps creative / advertising / brand agency suffixes to it-services", () => {
    /* Test names chosen to NOT collide with substring-match for any
       existing key (avoid "indus" → IndusInd, "bombay" → Bombay
       Hemp Co etc.). */
    expect(getCompanyTier("Mumbai Advertising Agency")).toBe("it-services");
    expect(getCompanyTier("Crayonbox Brand Consultancy")).toBe("it-services");
    expect(getCompanyTier("Pune Creative Agency")).toBe("it-services");
  });

  it("does NOT mis-tier IC titles containing 'design'", () => {
    /* "Design Manager" / "Senior Design Engineer" are role titles,
       not company suffixes. They should NOT route to it-services
       via the new design-firm regex. (They may still match other
       keyword patterns or return null — we just assert the design-
       firm path didn't fire.) */
    const designManager = getCompanyTier("Design Manager Role");
    /* Should fall through the design-firm regex (no <word>+design+
       suffix pattern) — concrete tier varies but should not be
       it-services FROM the design-firm rule specifically. */
    expect(designManager).not.toBe("it-services");
  });

  it("known FAANG / unicorn / IT-services don't drift to design-firm bucket", () => {
    expect(getCompanyTier("Google")).toBe("faang");
    expect(getCompanyTier("Razorpay")).toBe("indian-unicorn");
    expect(getCompanyTier("TCS")).toBe("it-services");
  });

  it("genuinely unknown companies still return null (fallback to caller)", () => {
    /* Use a name with no substring overlap with any tier-map key
       (no 'co', 'tech', 'design', 'studio', 'group', etc.). */
    expect(getCompanyTier("Zyxqfraz Holdings")).toBeNull();
    expect(getCompanyTier("")).toBeNull();
    expect(getCompanyTier(null)).toBeNull();
    expect(getCompanyTier(undefined)).toBeNull();
  });
});

describe("getCompanyTier — US SaaS / enterprise (Bugs (4).pdf fix)", () => {
  /* The DocuSign session in Bugs (4).pdf shipped an initial offer of
     ₹27 LPA for senior Product Designer — Google's reported band for
     DocuSign India is ₹57-77L. Root cause: DocuSign wasn't in
     COMPANY_TIER_MAP, so getCompanyTier returned null and the lookup
     silently fell back to "indian-unicorn". The fix maps DocuSign and
     a cluster of similar US SaaS companies to "big-tech" (which then
     falls back to the FAANG salary band — yielding ~₹55 LPA initial
     offer, matching market). */
  it("maps DocuSign to big-tech", () => {
    expect(getCompanyTier("DocuSign")).toBe("big-tech");
    expect(getCompanyTier("docusign")).toBe("big-tech");
    expect(getCompanyTier("DocuSign India")).toBe("big-tech");
    expect(getCompanyTier("Docu Sign")).toBe("big-tech");
  });

  it("maps the US-SaaS peer cluster to big-tech", () => {
    expect(getCompanyTier("Databricks")).toBe("big-tech");
    expect(getCompanyTier("Snowflake")).toBe("big-tech");
    expect(getCompanyTier("Datadog")).toBe("big-tech");
    expect(getCompanyTier("Cloudflare")).toBe("big-tech");
    expect(getCompanyTier("HashiCorp")).toBe("big-tech");
    expect(getCompanyTier("MongoDB")).toBe("big-tech");
    expect(getCompanyTier("Okta")).toBe("big-tech");
    expect(getCompanyTier("Palo Alto Networks")).toBe("big-tech");
    expect(getCompanyTier("Confluent")).toBe("big-tech");
    expect(getCompanyTier("Asana")).toBe("big-tech");
  });
});
