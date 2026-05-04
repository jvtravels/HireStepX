import { describe, it, expect } from "vitest";
import { matchRoleKey, ROLE_COMPETENCIES } from "../../data/role-competencies";
import { matchCompanyKey, COMPANY_GUIDANCE, classifyCompanyType } from "../../data/company-guidance";

/**
 * Regression tests for the match helpers used by generate-questions.ts.
 * These used to live inline in the 1,000-line handler; extracting them
 * let us finally cover the matching behaviour end-to-end. Without these,
 * a typo in the hyphenated slug (e.g. "data-scientist" → "datascientist")
 * silently fell through to "" which the LLM prompt treats as a total
 * miss — users get generic questions instead of role-specific ones.
 */

describe("matchRoleKey", () => {
  it("returns empty for empty input", () => {
    expect(matchRoleKey("")).toEqual({ key: "", fallback: "" });
  });

  it("exact-matches a canonical slug", () => {
    const { key, fallback } = matchRoleKey("product-manager");
    expect(key).toBe("product-manager");
    expect(fallback.length).toBeGreaterThan(100);
  });

  it("matches a humanised role name via word-part substring", () => {
    // "Senior Product Manager" → contains "product" + "manager" via split-part match
    const { key } = matchRoleKey("Senior Product Manager");
    expect(key).toBe("product-manager");
  });

  it("matches single-word slugs case-insensitively", () => {
    expect(matchRoleKey("Designer").key).toBe("designer");
    expect(matchRoleKey("DESIGNER").key).toBe("designer");
  });

  it("prefers the first matching key when multiple parts match", () => {
    // Object iteration order is insertion order — "product-manager" is
    // declared before "engineering-manager". A role description that
    // could match either must be deterministic.
    const { key } = matchRoleKey("product engineering");
    expect(key).toBe("product-manager");
  });

  it("returns empty when nothing matches", () => {
    expect(matchRoleKey("astronaut")).toEqual({ key: "", fallback: "" });
  });

  it("never returns a role key not present in ROLE_COMPETENCIES", () => {
    const inputs = ["pm", "swe", "sde", "DevOps Lead", "VP of Engineering", "QA Manager"];
    for (const input of inputs) {
      const { key } = matchRoleKey(input);
      if (key) expect(key in ROLE_COMPETENCIES).toBe(true);
    }
  });
});

describe("matchCompanyKey", () => {
  it("normalises whitespace and punctuation", () => {
    expect(matchCompanyKey("Google Inc.").key).toBe("google");
    expect(matchCompanyKey("  google  ").key).toBe("google");
  });

  it("matches case-insensitively", () => {
    expect(matchCompanyKey("TCS").key).toBe("tcs");
    expect(matchCompanyKey("amazon").key).toBe("amazon");
  });

  it("matches via substring containment both ways", () => {
    // "microsoft" contains "micro" and "microsoftindia" contains "microsoft"
    expect(matchCompanyKey("MicrosoftIndia").key).toBe("microsoft");
  });

  it("returns empty for genuinely-unknown company (no exact, no type bucket)", () => {
    expect(matchCompanyKey("some-unknown-corp-xyz")).toEqual({ key: "", fallback: "" });
  });

  // ─── Type-pattern fallbacks ───
  // For companies in the 1,000-entry autocomplete that don't have a
  // bespoke entry, matchCompanyKey now falls through to bucket
  // matching. These tests pin the bucket boundaries so changes to the
  // patterns surface in CI.

  it("falls through to consulting_big4 bucket for PwC / EY / KPMG", () => {
    expect(matchCompanyKey("PwC").key).toBe("consulting_big4");
    expect(matchCompanyKey("EY").key).toBe("consulting_big4");
    expect(matchCompanyKey("KPMG").key).toBe("consulting_big4");
    expect(matchCompanyKey("Grant Thornton").key).toBe("consulting_big4");
  });

  it("falls through to psu_bank for SBI / PNB / Bank of Baroda", () => {
    expect(matchCompanyKey("Punjab National Bank").key).toBe("psu_bank");
    expect(matchCompanyKey("Bank of Baroda").key).toBe("psu_bank");
  });

  it("falls through to private_bank for Yes Bank / IndusInd / Federal", () => {
    expect(matchCompanyKey("Yes Bank").key).toBe("private_bank");
    expect(matchCompanyKey("IndusInd Bank").key).toBe("private_bank");
    expect(matchCompanyKey("Federal Bank").key).toBe("private_bank");
  });

  it("falls through to indian_unicorn_fintech for Slice / Jupiter / Cashfree", () => {
    expect(matchCompanyKey("Slice").key).toBe("indian_unicorn_fintech");
    expect(matchCompanyKey("Jupiter").key).toBe("indian_unicorn_fintech");
    expect(matchCompanyKey("Cashfree").key).toBe("indian_unicorn_fintech");
  });

  it("falls through to gcc_global_capability_centre for Walmart Labs / Target India", () => {
    expect(matchCompanyKey("Walmart Global Tech (Walmart Labs)").key).toBe(
      "gcc_global_capability_centre",
    );
    expect(matchCompanyKey("Target India").key).toBe("gcc_global_capability_centre");
    expect(matchCompanyKey("Synopsys India").key).toBe("gcc_global_capability_centre");
  });

  it("falls through to indian_pharma for Sun Pharma / Cipla / Biocon", () => {
    expect(matchCompanyKey("Sun Pharma").key).toBe("indian_pharma");
    expect(matchCompanyKey("Cipla").key).toBe("indian_pharma");
    expect(matchCompanyKey("Biocon").key).toBe("indian_pharma");
  });

  it("falls through to indian_aviation for IndiGo / SpiceJet / Akasa", () => {
    expect(matchCompanyKey("IndiGo").key).toBe("indian_aviation");
    expect(matchCompanyKey("SpiceJet").key).toBe("indian_aviation");
    expect(matchCompanyKey("Akasa Air").key).toBe("indian_aviation");
  });

  it("falls through to psu_central for ONGC / NTPC / Coal India", () => {
    expect(matchCompanyKey("ONGC").key).toBe("psu_central");
    expect(matchCompanyKey("NTPC").key).toBe("psu_central");
    expect(matchCompanyKey("Coal India").key).toBe("psu_central");
  });

  it("falls through to indian_civil_services for IAS / SSC / RBI Grade B", () => {
    expect(matchCompanyKey("UPSC (Indian Administrative Service)").key).toBe(
      "indian_civil_services",
    );
    expect(matchCompanyKey("SSC CGL").key).toBe("indian_civil_services");
    expect(matchCompanyKey("RBI Grade B").key).toBe("indian_civil_services");
  });

  it("exact match takes precedence over type bucket (Deloitte → exact, not big4-type)", () => {
    // Deloitte has an exact entry in COMPANY_GUIDANCE; it should win
    // over the consulting_big4 bucket pattern that also matches it.
    expect(matchCompanyKey("Deloitte").key).toBe("deloitte");
  });

  it("returns a non-empty fallback string for every type bucket match", () => {
    const inputs = ["PwC", "EY", "Yes Bank", "Slice", "Walmart Labs", "Cipla", "IndiGo", "ONGC"];
    for (const input of inputs) {
      const { fallback } = matchCompanyKey(input);
      expect(fallback.length).toBeGreaterThan(50);
    }
  });
});

describe("classifyCompanyType", () => {
  it("returns null for empty / unknown input", () => {
    expect(classifyCompanyType("")).toBeNull();
    expect(classifyCompanyType("???")).toBeNull();
    expect(classifyCompanyType("totally-made-up-corp")).toBeNull();
  });

  it("classifies bulge-bracket banks correctly", () => {
    expect(classifyCompanyType("Barclays")?.key).toBe("ibank_bulgebracket");
    expect(classifyCompanyType("HSBC")?.key).toBe("ibank_bulgebracket");
  });

  it("classifies quant / HFT firms correctly", () => {
    expect(classifyCompanyType("Two Sigma")?.key).toBe("quant_hft");
    expect(classifyCompanyType("Citadel")?.key).toBe("quant_hft");
    expect(classifyCompanyType("Jump Trading")?.key).toBe("quant_hft");
  });

  it("normalizes whitespace and punctuation before matching", () => {
    expect(classifyCompanyType("  Yes  Bank  ")?.key).toBe("private_bank");
    expect(classifyCompanyType("PwC.")?.key).toBe("consulting_big4");
  });
});

describe("matchCompanyKey — empty + integrity", () => {
  it("returns empty for empty input", () => {
    expect(matchCompanyKey("")).toEqual({ key: "", fallback: "" });
  });

  it("every returned key from an exact-match input is a real COMPANY_GUIDANCE entry", () => {
    const inputs = ["Google", "Amazon", "Infosys", "Accenture India"];
    for (const input of inputs) {
      const { key } = matchCompanyKey(input);
      expect(key in COMPANY_GUIDANCE).toBe(true);
    }
  });
});
