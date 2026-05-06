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

  it("infers EM, data, ml, and design correctly", () => {
    expect(inferRoleFamily("Engineering Manager")).toBe("em");
    expect(inferRoleFamily("Tech Lead")).toBe("em");
    expect(inferRoleFamily("Data Scientist")).toBe("data");
    // ML/AI Engineer maps to its own family (was "data" before bank
    // expansion in 2026-Q2). Tier-1/2 retrieval prefers dedicated ML
    // entries from OpenAI/Anthropic/Razorpay/Sarvam over generic data.
    expect(inferRoleFamily("ML Engineer")).toBe("ml");
    expect(inferRoleFamily("AI Engineer")).toBe("ml");
    expect(inferRoleFamily("Product Designer")).toBe("design");
    expect(inferRoleFamily("UX Lead")).toBe("design");
  });

  it("infers consultant and quant families when title is specific", () => {
    expect(inferRoleFamily("Management Consultant")).toBe("consultant");
    expect(inferRoleFamily("Engagement Manager")).toBe("consultant");
    expect(inferRoleFamily("Quantitative Researcher")).toBe("quant");
    expect(inferRoleFamily("Quant Trader")).toBe("quant");
    // Generic "Partner" / "Manager" must NOT trip the consultant regex
    expect(inferRoleFamily("HR Partner")).toBe("behavioral");
    expect(inferRoleFamily("Account Manager")).toBe("behavioral");
  });

  it("infers government / PSU / campus families correctly", () => {
    expect(inferRoleFamily("IAS Officer")).toBe("civil-services");
    expect(inferRoleFamily("IPS Officer")).toBe("civil-services");
    expect(inferRoleFamily("RBI Grade B")).toBe("civil-services");
    expect(inferRoleFamily("Indian Army Officer")).toBe("defence");
    expect(inferRoleFamily("AFCAT Officer")).toBe("defence");
    expect(inferRoleFamily("ISRO Scientist")).toBe("scientist");
    expect(inferRoleFamily("DRDO Scientist")).toBe("scientist");
    expect(inferRoleFamily("Bank PO")).toBe("psu-engineer");
    expect(inferRoleFamily("Fresher")).toBe("campus");
    expect(inferRoleFamily("Graduate Engineer Trainee (GET)")).toBe("campus");
    expect(inferRoleFamily("Management Trainee")).toBe("campus");
    // ISRO Scientist must NOT trip "engineer" → swe (it goes scientist first)
    expect(inferRoleFamily("ISRO Scientist")).not.toBe("swe");
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

  it("preserves strategic as its own focus bucket (was aliased to case-study pre-2026-Q2)", () => {
    /* Strategic split from case-study. The bank now has dedicated
       strategic entries (CEO disagreement, board commitment defense,
       founder pivot) that are distinct from framework-driven case
       analysis. Tier-1 retrieval should hit those. */
    expect(normaliseFocus("strategic")).toBe("strategic");
  });

  it("preserves new management and government-psu focuses without aliasing", () => {
    expect(normaliseFocus("management")).toBe("management");
    expect(normaliseFocus("government-psu")).toBe("government-psu");
    expect(normaliseFocus("psu")).toBe("government-psu");
    expect(normaliseFocus("government")).toBe("government-psu");
    expect(normaliseFocus("civil-services")).toBe("government-psu");
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
    /* TCS doesn't have any PM case-study entries; bank has Flipkart,
       BCG, Atlassian etc. → expect tier-2 (role+focus, any company). */
    const result = retrieveReferenceQuestions({
      company: "TCS",
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
    /* No (writer, system-design) entries exist anywhere in the bank.
       Should drop to tier 3 — any system-design entry. */
    const result = retrieveReferenceQuestions({
      company: "TCS",
      roleFamily: "writer",
      focus: "system-design",
    });
    expect(result.tier).toBe(3);
    expect(result.hasMatches).toBe(true);
    /* All returned should be system-design (any role/company). */
    for (const e of result.entries) {
      expect(e.focus).toBe("system-design");
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
  it("emits a tier-4 grounding warning when no matches (was empty pre-2026-Q2)", () => {
    /* Tier-4 used to return "" — silent. The LLM still got the
       (company, role, focus) but no reference block, and would happily
       fabricate company-specific detail. Now we explicitly tell the LLM
       it's flying blind so it stays generic. */
    const out = formatReferencesForPrompt({ entries: [], tier: 4, hasMatches: false });
    expect(out).toMatch(/tier 4/);
    expect(out).toMatch(/no verified reference questions/i);
    expect(out).toMatch(/DO NOT invent/);
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
      company: "TCS", roleFamily: "writer", focus: "system-design",
    }));
    expect(t3).toMatch(/tier 3/);
  });

  it("includes tier-aware grounding warnings on tier 2 and tier 3 results", () => {
    /* The grounding warnings are the load-bearing anti-hallucination
       guard — they explicitly tell the LLM these references belong to
       a peer company / different role and that it must NOT carry over
       company-specific facts. */
    const t2 = formatReferencesForPrompt(retrieveReferenceQuestions({
      company: "TCS", roleFamily: "pm", focus: "case-study",
    }));
    expect(t2).toMatch(/GROUNDING NOTE/);
    expect(t2).toMatch(/peer companies/i);
    expect(t2).toMatch(/DO NOT carry over/i);

    const t3 = formatReferencesForPrompt(retrieveReferenceQuestions({
      company: "TCS", roleFamily: "writer", focus: "system-design",
    }));
    expect(t3).toMatch(/GROUNDING NOTE/);
    expect(t3).toMatch(/different role family/i);

    /* Tier 1 (exact match) should NOT emit a grounding warning —
       the references genuinely apply, no need to caveat. */
    const t1 = formatReferencesForPrompt(retrieveReferenceQuestions({
      company: "Flipkart", roleFamily: "pm", focus: "case-study",
    }));
    expect(t1).not.toMatch(/GROUNDING NOTE/);
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
