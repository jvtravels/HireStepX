import { describe, it, expect } from "vitest";
import {
  selectHrPersona,
  getHrPersona,
  hrPersonaPromptFragment,
} from "../_indian-hr-personas";

describe("selectHrPersona", () => {
  it("returns Talent Acquisition for IT-services freshers / early-career", () => {
    expect(selectHrPersona({ companyTier: "it-services", experienceLevel: "fresher" }).id).toBe(
      "talent-acquisition",
    );
    expect(selectHrPersona({ companyTier: "it-services", experienceLevel: "entry" }).id).toBe(
      "talent-acquisition",
    );
    expect(selectHrPersona({ companyTier: "edtech", experienceLevel: "mid" }).id).toBe(
      "talent-acquisition",
    );
    expect(selectHrPersona({ companyTier: "startup-early", experienceLevel: "fresher" }).id).toBe(
      "talent-acquisition",
    );
  });

  it("returns HR Business Partner for FAANG / GCC / MNC regardless of level", () => {
    expect(selectHrPersona({ companyTier: "faang", experienceLevel: "mid" }).id).toBe("hr-bp-firm");
    expect(selectHrPersona({ companyTier: "gcc", experienceLevel: "entry" }).id).toBe("hr-bp-firm");
    expect(selectHrPersona({ companyTier: "big-tech", experienceLevel: "fresher" }).id).toBe(
      "hr-bp-firm",
    );
    expect(selectHrPersona({ companyTier: "consulting-mbb", experienceLevel: "mid" }).id).toBe(
      "hr-bp-firm",
    );
  });

  it("returns HR Business Partner for any senior / lead / executive hire", () => {
    expect(selectHrPersona({ companyTier: "indian-unicorn", experienceLevel: "senior" }).id).toBe(
      "hr-bp-firm",
    );
    expect(selectHrPersona({ companyTier: "bfsi-domestic", experienceLevel: "lead" }).id).toBe(
      "hr-bp-firm",
    );
    expect(selectHrPersona({ companyTier: "edtech", experienceLevel: "executive" }).id).toBe(
      "hr-bp-firm",
    );
  });

  it("falls back to warm HR Partner for indian-unicorn / BFSI-domestic / FMCG mid-career", () => {
    expect(selectHrPersona({ companyTier: "indian-unicorn", experienceLevel: "mid" }).id).toBe(
      "hr-partner-warm",
    );
    expect(selectHrPersona({ companyTier: "bfsi-domestic", experienceLevel: "mid" }).id).toBe(
      "hr-partner-warm",
    );
    expect(selectHrPersona({ companyTier: "fmcg-mnc", experienceLevel: "entry" }).id).toBe(
      "hr-partner-warm",
    );
  });

  it("returns warm HR Partner when company tier and level are unknown / missing", () => {
    expect(selectHrPersona({}).id).toBe("hr-partner-warm");
    expect(selectHrPersona({ companyTier: null, experienceLevel: null }).id).toBe(
      "hr-partner-warm",
    );
    expect(selectHrPersona({ companyTier: "garbage", experienceLevel: "garbage" }).id).toBe(
      "hr-partner-warm",
    );
  });
});

describe("getHrPersona", () => {
  it("resolves canonical ids and friendly display strings", () => {
    expect(getHrPersona("hr-partner-warm")?.id).toBe("hr-partner-warm");
    expect(getHrPersona("HR Partner")?.id).toBe("hr-partner-warm");
    expect(getHrPersona("HRBP")?.id).toBe("hr-bp-firm");
    expect(getHrPersona("Talent Acquisition")?.id).toBe("talent-acquisition");
    expect(getHrPersona("TA")?.id).toBe("talent-acquisition");
  });

  it("returns null on unknown ids", () => {
    expect(getHrPersona("interviewer")).toBeNull();
    expect(getHrPersona(null)).toBeNull();
    expect(getHrPersona("")).toBeNull();
  });
});

describe("hrPersonaPromptFragment", () => {
  it("includes persona name, probe style, pressure topics, and scoring emphasis", () => {
    const persona = selectHrPersona({ companyTier: "faang", experienceLevel: "senior" });
    const frag = hrPersonaPromptFragment(persona);
    expect(frag).toContain("INDIAN HR-ROUND PERSONA");
    expect(frag).toContain("HR Business Partner");
    expect(frag).toContain("BGV");
    expect(frag).toContain("Pressure topics");
    // Scoring-emphasis tail.
    expect(frag.toLowerCase()).toMatch(/onboard|risk|document/);
  });

  it("produces distinct fragments for each archetype (no copy-paste)", () => {
    const warm = hrPersonaPromptFragment(
      selectHrPersona({ companyTier: "indian-unicorn", experienceLevel: "mid" }),
    );
    const firm = hrPersonaPromptFragment(
      selectHrPersona({ companyTier: "faang", experienceLevel: "mid" }),
    );
    const ta = hrPersonaPromptFragment(
      selectHrPersona({ companyTier: "it-services", experienceLevel: "fresher" }),
    );
    expect(warm).not.toEqual(firm);
    expect(firm).not.toEqual(ta);
    expect(warm).not.toEqual(ta);
  });
});
