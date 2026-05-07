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

  it("returns empty for ambiguous multi-part inputs that don't fully match any key", () => {
    // "product engineering" partially matches both "product-manager"
    // (product, no manager) and "engineering-manager" (engineering, no
    // manager). Under longest-match-with-all-parts-present rules, neither
    // wins and we return empty rather than silently routing to a wrong
    // competency. Previously the buggy matcher returned "product-manager"
    // by first-match-wins, injecting wrong PM competencies into the
    // prompt.
    expect(matchRoleKey("product engineering").key).toBe("");
  });

  it("returns empty when nothing matches", () => {
    expect(matchRoleKey("astronaut")).toEqual({ key: "", fallback: "" });
  });

  // ─── Regression: writer-role substring collision ───
  // Pre-fix bug: "UX Writer" → "technical-writer" because "writer"
  // was a part of both keys and the matcher returned the first hit.
  // After fix: longest matching multi-part key wins, all parts must
  // be present.
  it("disambiguates writer roles correctly (was buggy pre-2026-Q2)", () => {
    expect(matchRoleKey("UX Writer").key).toBe("ux-writer");
    expect(matchRoleKey("Senior UX Writer").key).toBe("ux-writer");
    expect(matchRoleKey("Technical Writer").key).toBe("technical-writer");
    expect(matchRoleKey("Lead Technical Writer").key).toBe("technical-writer");
    expect(matchRoleKey("Copywriter").key).toBe("copywriter");
    expect(matchRoleKey("Senior Copywriter").key).toBe("copywriter");
    expect(matchRoleKey("Screenwriter").key).toBe("screenwriter");
  });

  it("disambiguates director roles correctly (was buggy pre-2026-Q2)", () => {
    // "Art Director" used to fall to "creative-director" because
    // "director" was a part of both keys.
    expect(matchRoleKey("Art Director").key).toBe("art-director");
    expect(matchRoleKey("Creative Director").key).toBe("creative-director");
    expect(matchRoleKey("Executive Creative Director").key).toBe("creative-director");
  });

  it("matches new 2026-Q2 role keys", () => {
    expect(matchRoleKey("UX Researcher").key).toBe("ux-researcher");
    expect(matchRoleKey("Industrial Designer").key).toBe("industrial-designer");
    expect(matchRoleKey("ESG Analyst").key).toBe("esg-analyst");
    expect(matchRoleKey("IAS Officer").key).toBe("ias");
    expect(matchRoleKey("Recruiter").key).toBe("recruiter");
    expect(matchRoleKey("Junior Doctor").key).toBe("doctor");
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

  it("falls through to indian_market_generic for genuinely-unknown company", () => {
    /* After 2026-Q2 catch-all addition, no company is "truly
       unknown" — every input gets classified, even if to the
       generic catch-all. */
    const result = matchCompanyKey("some-unknown-corp-xyz");
    expect(result.key === "" || result.key === "indian_market_generic").toBe(true);
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
  it("returns null for empty input; catches everything else via catch-all", () => {
    expect(classifyCompanyType("")).toBeNull();
    /* "???" normalizes to empty after stripping non-alphanumerics */
    expect(classifyCompanyType("???")).toBeNull();
    /* Non-empty inputs hit the indian_market_generic catch-all. */
    expect(classifyCompanyType("totally-made-up-corp")?.key).toBe("indian_market_generic");
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
