import { describe, it, expect } from "vitest";
import {
  behavioralPersonaPromptFragment,
  getBehavioralPersona,
  pedigreeAwareOpenerFragment,
  selectBehavioralPersona,
} from "../../_indian-behavioral-personas";

/* Behavioral interviewer-personas — Phase 4.2 + 4.3 unit tests.
 *
 * The selector is keyed off company-tier × experience-level. Pin the
 * decision boundaries: bumping a candidate from "mid" to "senior" or
 * from "edtech" to "faang" should flip the persona predictably. */

describe("selectBehavioralPersona", () => {
  it("returns Director for lead/executive regardless of tier", () => {
    expect(
      selectBehavioralPersona({ companyTier: "it-services", experienceLevel: "lead" }).id,
    ).toBe("director-strategic");
    expect(
      selectBehavioralPersona({ companyTier: "startup-early", experienceLevel: "executive" }).id,
    ).toBe("director-strategic");
  });

  it("returns Director for senior at FAANG / big-tech / GCC tiers", () => {
    expect(
      selectBehavioralPersona({ companyTier: "faang", experienceLevel: "senior" }).id,
    ).toBe("director-strategic");
    expect(
      selectBehavioralPersona({ companyTier: "gcc", experienceLevel: "senior" }).id,
    ).toBe("director-strategic");
  });

  it("returns warm HR Partner for fresher / entry across the board", () => {
    expect(
      selectBehavioralPersona({ companyTier: "indian-unicorn", experienceLevel: "fresher" }).id,
    ).toBe("hr-partner-warm");
    expect(
      selectBehavioralPersona({ companyTier: "it-services", experienceLevel: "entry" }).id,
    ).toBe("hr-partner-warm");
  });

  it("returns warm HR Partner for mid at IT-services / edtech / early-startup", () => {
    expect(
      selectBehavioralPersona({ companyTier: "it-services", experienceLevel: "mid" }).id,
    ).toBe("hr-partner-warm");
    expect(
      selectBehavioralPersona({ companyTier: "edtech", experienceLevel: "mid" }).id,
    ).toBe("hr-partner-warm");
  });

  it("defaults to depth-led Hiring Manager for the common mid-senior IC case", () => {
    expect(
      selectBehavioralPersona({ companyTier: "indian-unicorn", experienceLevel: "mid" }).id,
    ).toBe("hiring-manager-depth");
    expect(
      selectBehavioralPersona({ companyTier: "saas-product", experienceLevel: "senior" }).id,
    ).toBe("hiring-manager-depth");
  });

  it("falls back to Hiring Manager on unknown tier + unknown level", () => {
    expect(selectBehavioralPersona({}).id).toBe("hiring-manager-depth");
  });
});

describe("getBehavioralPersona — id normalisation", () => {
  it("looks up by canonical id", () => {
    expect(getBehavioralPersona("director-strategic")?.id).toBe("director-strategic");
  });

  it("accepts common synonyms (hm, director, hiring manager)", () => {
    expect(getBehavioralPersona("hm")?.id).toBe("hiring-manager-depth");
    expect(getBehavioralPersona("director")?.id).toBe("director-strategic");
    expect(getBehavioralPersona("hiring manager")?.id).toBe("hiring-manager-depth");
  });

  it("returns null on unrecognised input", () => {
    expect(getBehavioralPersona(null)).toBeNull();
    expect(getBehavioralPersona("clown")).toBeNull();
  });
});

describe("behavioralPersonaPromptFragment", () => {
  it("includes display name, probe style, scoring emphasis", () => {
    const p = selectBehavioralPersona({ companyTier: "faang", experienceLevel: "senior" });
    const frag = behavioralPersonaPromptFragment(p);
    expect(frag).toContain("Director");
    expect(frag).toContain(p.scoringEmphasis);
    // Story-shapes line surfaces the top pressure topics
    expect(frag).toMatch(/Story shapes for this archetype/i);
  });
});

describe("pedigreeAwareOpenerFragment", () => {
  it("fires for fresher / entry experience levels", () => {
    expect(pedigreeAwareOpenerFragment({ experienceLevel: "fresher" })).toContain("PEDIGREE-AWARE");
    expect(pedigreeAwareOpenerFragment({ experienceLevel: "entry" })).toContain("PEDIGREE-AWARE");
  });

  it("fires when numeric yoe < 2", () => {
    expect(pedigreeAwareOpenerFragment({ yoe: 1 })).toContain("PEDIGREE-AWARE");
    expect(pedigreeAwareOpenerFragment({ yoe: 0.5 })).toContain("PEDIGREE-AWARE");
  });

  it("silent no-op for mid+ / yoe ≥ 2 / unknown", () => {
    expect(pedigreeAwareOpenerFragment({ experienceLevel: "mid" })).toBe("");
    expect(pedigreeAwareOpenerFragment({ experienceLevel: "senior" })).toBe("");
    expect(pedigreeAwareOpenerFragment({ yoe: 4 })).toBe("");
    expect(pedigreeAwareOpenerFragment({})).toBe("");
  });
});
