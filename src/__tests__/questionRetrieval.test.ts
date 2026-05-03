import { describe, it, expect } from "vitest";
import {
  retrieveReferenceQuestions,
  formatReferencesForPrompt,
  normaliseCompany,
  inferRoleFamily,
  normaliseFocus,
} from "../../server-handlers/_question-retrieval";

/* ─── Company normalisation ───────────────────────────────────────── */
describe("normaliseCompany", () => {
  it("maps canonical names to keys", () => {
    expect(normaliseCompany("Flipkart")).toBe("flipkart");
    expect(normaliseCompany("Razorpay")).toBe("razorpay");
    expect(normaliseCompany("PhonePe")).toBe("phonepe");
    expect(normaliseCompany("TCS")).toBe("tcs");
  });

  it("handles common aliases and casing", () => {
    expect(normaliseCompany("AWS")).toBe("amazon");
    expect(normaliseCompany("Facebook")).toBe("meta");
    expect(normaliseCompany("FB")).toBe("meta");
    expect(normaliseCompany("Tata Consultancy Services")).toBe("tcs");
    expect(normaliseCompany("Phone Pe")).toBe("phonepe");
  });

  it("matches partial / wrapped names", () => {
    expect(normaliseCompany("Flipkart Internet Pvt Ltd")).toBe("flipkart");
    expect(normaliseCompany("Amazon India Development Centre")).toBe("amazon");
  });

  it("returns null for unknown / empty input", () => {
    expect(normaliseCompany(undefined)).toBeNull();
    expect(normaliseCompany("")).toBeNull();
    expect(normaliseCompany("Some Random Startup XYZ")).toBeNull();
  });
});

/* ─── Role-family inference ──────────────────────────────────────── */
describe("inferRoleFamily", () => {
  it("infers PM family from common variants", () => {
    expect(inferRoleFamily("Product Manager")).toBe("pm");
    expect(inferRoleFamily("Senior PM")).toBe("pm");
    expect(inferRoleFamily("APM at Razorpay")).toBe("pm");
    expect(inferRoleFamily("Group Product Manager")).toBe("pm");
  });

  it("infers SWE family", () => {
    expect(inferRoleFamily("SDE-2")).toBe("swe");
    expect(inferRoleFamily("Software Engineer")).toBe("swe");
    expect(inferRoleFamily("Backend Developer")).toBe("swe");
    expect(inferRoleFamily("Full Stack Engineer")).toBe("swe");
  });

  it("infers EM, data, and design correctly", () => {
    expect(inferRoleFamily("Engineering Manager")).toBe("em");
    expect(inferRoleFamily("Tech Lead")).toBe("em");
    expect(inferRoleFamily("Data Scientist")).toBe("data");
    expect(inferRoleFamily("ML Engineer")).toBe("data");
    expect(inferRoleFamily("Product Designer")).toBe("design");
    expect(inferRoleFamily("UX Lead")).toBe("design");
  });

  it("falls back to behavioral for unrecognised generic roles", () => {
    expect(inferRoleFamily("HR Partner")).toBe("behavioral");
    expect(inferRoleFamily("Account Manager")).toBe("behavioral");
  });

  it("returns null for empty input", () => {
    expect(inferRoleFamily(undefined)).toBeNull();
    expect(inferRoleFamily("")).toBeNull();
  });
});

/* ─── Focus normalisation ────────────────────────────────────────── */
describe("normaliseFocus", () => {
  it("maps known focus values", () => {
    expect(normaliseFocus("behavioral")).toBe("behavioral");
    expect(normaliseFocus("system-design")).toBe("system-design");
    expect(normaliseFocus("salary-negotiation")).toBe("salary-negotiation");
  });

  it("aliases strategic → case-study", () => {
    expect(normaliseFocus("strategic")).toBe("case-study");
  });

  it("returns null for unknown values", () => {
    expect(normaliseFocus("mystery-focus")).toBeNull();
    expect(normaliseFocus(undefined)).toBeNull();
  });
});

/* ─── Hierarchical retrieval ─────────────────────────────────────── */
describe("retrieveReferenceQuestions", () => {
  it("returns tier 1 (exact) when company × role × focus all match", () => {
    const result = retrieveReferenceQuestions({
      company: "Flipkart",
      roleFamily: "pm",
      focus: "case-study",
    });
    expect(result.tier).toBe(1);
    expect(result.hasMatches).toBe(true);
    expect(result.entries.length).toBeGreaterThan(0);
    /* All returned entries should be Flipkart PM case-study. */
    for (const e of result.entries) {
      expect(e.company).toBe("flipkart");
      expect(e.roleFamily).toBe("pm");
      expect(e.focus).toBe("case-study");
    }
  });

  it("falls back to tier 2 (role + focus, any company) when no exact match", () => {
    const result = retrieveReferenceQuestions({
      company: "Atlassian", // we have only behavioral for atlassian, no PM case-study
      roleFamily: "pm",
      focus: "case-study",
    });
    expect(result.tier).toBe(2);
    expect(result.hasMatches).toBe(true);
    /* All returned should be PM case-study from any company. */
    for (const e of result.entries) {
      expect(e.roleFamily).toBe("pm");
      expect(e.focus).toBe("case-study");
    }
  });

  it("falls back to tier 3 (focus only) when role+focus combo is rare", () => {
    const result = retrieveReferenceQuestions({
      company: "Atlassian",
      roleFamily: "design", // no design entries at all in current bank
      focus: "case-study",
    });
    expect(result.tier).toBe(3);
    expect(result.hasMatches).toBe(true);
    /* All returned should be case-study (any role/company). */
    for (const e of result.entries) {
      expect(e.focus).toBe("case-study");
    }
  });

  it("returns tier 4 with no entries when nothing matches", () => {
    const result = retrieveReferenceQuestions({
      company: "Unknown Co",
      roleFamily: undefined,
      focus: undefined,
    });
    expect(result.tier).toBe(4);
    expect(result.hasMatches).toBe(false);
    expect(result.entries.length).toBe(0);
  });

  it("respects the limit parameter (capped at 8)", () => {
    const result = retrieveReferenceQuestions({
      focus: "behavioral",
      limit: 3,
    });
    expect(result.entries.length).toBeLessThanOrEqual(3);

    const big = retrieveReferenceQuestions({ focus: "behavioral", limit: 100 });
    expect(big.entries.length).toBeLessThanOrEqual(8);
  });
});

/* ─── Prompt formatting ──────────────────────────────────────────── */
describe("formatReferencesForPrompt", () => {
  it("returns empty string when no matches", () => {
    const out = formatReferencesForPrompt({ entries: [], tier: 4, hasMatches: false });
    expect(out).toBe("");
  });

  it("includes the 'do not copy verbatim' instruction inline", () => {
    const result = retrieveReferenceQuestions({
      company: "Flipkart", roleFamily: "pm", focus: "case-study",
    });
    const out = formatReferencesForPrompt(result);
    expect(out).toMatch(/DO NOT copy/i);
    expect(out).toMatch(/STYLE/);
  });

  it("describes the tier in human-readable form", () => {
    const t1 = formatReferencesForPrompt(retrieveReferenceQuestions({
      company: "Flipkart", roleFamily: "pm", focus: "case-study",
    }));
    expect(t1).toMatch(/tier 1/);
    expect(t1).toMatch(/exact match/);

    const t3 = formatReferencesForPrompt(retrieveReferenceQuestions({
      company: "Atlassian", roleFamily: "design", focus: "case-study",
    }));
    expect(t3).toMatch(/tier 3/);
  });

  it("includes the question text and any style note", () => {
    const result = retrieveReferenceQuestions({
      company: "Razorpay", roleFamily: "swe", focus: "system-design",
    });
    const out = formatReferencesForPrompt(result);
    expect(out).toContain("UPI");
    /* Razorpay SWE entries have styleNote — rendered inline */
    expect(out).toMatch(/\[pattern:/);
  });
});
