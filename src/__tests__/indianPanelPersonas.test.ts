import { describe, it, expect } from "vitest";
import {
  getPanelPersona,
  panelPersonaPromptFragment,
  PANEL_ROTATION,
} from "../_indian-panel-personas";

describe("getPanelPersona", () => {
  it("resolves canonical ids", () => {
    expect(getPanelPersona("hr-partner")?.id).toBe("hr-partner");
    expect(getPanelPersona("hiring-manager")?.id).toBe("hiring-manager");
    expect(getPanelPersona("tech-lead")?.id).toBe("tech-lead");
  });

  it("resolves display-name variants (case + spacing tolerant)", () => {
    expect(getPanelPersona("HR Partner")?.id).toBe("hr-partner");
    expect(getPanelPersona("Hiring Manager")?.id).toBe("hiring-manager");
    expect(getPanelPersona("Technical Lead")?.id).toBe("tech-lead");
    expect(getPanelPersona("tech lead")?.id).toBe("tech-lead");
  });

  it("returns null for unknown / empty input", () => {
    expect(getPanelPersona("ceo")).toBeNull();
    expect(getPanelPersona("")).toBeNull();
    expect(getPanelPersona(null)).toBeNull();
    expect(getPanelPersona(undefined)).toBeNull();
  });
});

describe("persona register policies", () => {
  it("HR Partner rewards deferential gratitude (NOT a penalty in HR turn)", () => {
    const hr = getPanelPersona("hr-partner")!;
    expect(hr.registerRewards).toContain("deferentialGratitude");
    expect(hr.registerRedirects).not.toContain("deferentialGratitude");
  });

  it("Tech Lead redirects deferential gratitude (wants STAR Action, not pedigree)", () => {
    const tl = getPanelPersona("tech-lead")!;
    expect(tl.registerRedirects).toContain("deferentialGratitude");
    expect(tl.registerRedirects).toContain("pedigreeRecital");
  });

  it("Hiring Manager rewards hedged disagreement (strong conviction in Indian register)", () => {
    const hm = getPanelPersona("hiring-manager")!;
    expect(hm.registerRewards).toContain("hedgedDisagreement");
  });

  it("every persona has a scoringEmphasis line", () => {
    for (const id of ["hr-partner", "hiring-manager", "tech-lead"] as const) {
      const p = getPanelPersona(id)!;
      expect(p.scoringEmphasis.length).toBeGreaterThan(20);
    }
  });
});

describe("PANEL_ROTATION", () => {
  it("has exactly 5 slots matching the behavioural 5-question arc", () => {
    expect(PANEL_ROTATION).toHaveLength(5);
  });

  it("opens on HR and closes on HR (warmup + stay-intent bookends)", () => {
    expect(PANEL_ROTATION[0]).toBe("hr-partner");
    expect(PANEL_ROTATION[4]).toBe("hr-partner");
  });

  it("rotates through all three personas", () => {
    const unique = new Set(PANEL_ROTATION);
    expect(unique.size).toBe(3);
  });
});

describe("panelPersonaPromptFragment", () => {
  it("combines probeStyle + register policy + scoringEmphasis into one block", () => {
    const hr = getPanelPersona("hr-partner")!;
    const frag = panelPersonaPromptFragment(hr);
    expect(frag).toContain("HR Partner");
    expect(frag).toContain("Reward as positive signal");
    expect(frag).toContain("deferentialGratitude");
    expect(frag.toLowerCase()).toContain("authenticity");
  });

  it("omits the redirects line when persona has no redirects", () => {
    const hr = getPanelPersona("hr-partner")!;
    // HR Partner has empty redirects array
    const frag = panelPersonaPromptFragment(hr);
    expect(frag).not.toContain("Softly redirect");
  });

  it("includes redirects line for Tech Lead (has redirects)", () => {
    const tl = getPanelPersona("tech-lead")!;
    const frag = panelPersonaPromptFragment(tl);
    expect(frag).toContain("Softly redirect");
    expect(frag).toContain("deferentialGratitude");
  });
});
