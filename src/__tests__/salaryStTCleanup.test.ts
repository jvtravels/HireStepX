import { describe, it, expect } from "vitest";
import { cleanSalarySttArtifacts } from "../_salary-stt-cleanup";

describe("cleanSalarySttArtifacts", () => {
  it("rewrites 'N legs' → 'N lakhs'", () => {
    expect(cleanSalarySttArtifacts("I would like to go for 20 legs"))
      .toBe("I would like to go for 20 lakhs");
  });

  it("rewrites 'N. Legs' across a sentence boundary", () => {
    expect(cleanSalarySttArtifacts("Whatever you want to do, you can do it. 28. Legs"))
      .toContain("28 lakhs");
  });

  it("keeps real 'legs' alone when no number/comp context is present", () => {
    expect(cleanSalarySttArtifacts("I broke both legs in a hike"))
      .toBe("I broke both legs in a hike");
  });

  it("rewrites 'the celery' → 'the salary'", () => {
    expect(cleanSalarySttArtifacts("20 legs at the celery"))
      .toBe("20 lakhs at the salary");
  });

  it("normalizes CTZ / NMCTC / MCTC → CTC", () => {
    expect(cleanSalarySttArtifacts("21 lakhs per annum CTZ from some other company"))
      .toContain("CTC");
    expect(cleanSalarySttArtifacts("offering me 21 lakhs per NMCTC"))
      .toContain("CTC");
    expect(cleanSalarySttArtifacts("MCTC"))
      .toBe("CTC");
  });

  it("collapses spaced 'L P A' / 'L.P.A.' → 'LPA'", () => {
    expect(cleanSalarySttArtifacts("18 L P A"))
      .toBe("18 LPA");
    expect(cleanSalarySttArtifacts("18 L.P.A."))
      .toBe("18 LPA");
  });

  it("rewrites 'lacks' near a number → 'lakhs'", () => {
    expect(cleanSalarySttArtifacts("expecting 25 lacks"))
      .toBe("expecting 25 lakhs");
  });

  it("is a no-op on already-clean text", () => {
    const clean = "I'd like 25 LPA based on my market research and competing offers.";
    expect(cleanSalarySttArtifacts(clean)).toBe(clean);
  });

  it("handles the production transcript end-to-end", () => {
    const input = "I would like to go for 20 legs at the celery. 18 legs as a base salary of it, and 28. Legs. Whatever you want to do, you can do it.";
    const out = cleanSalarySttArtifacts(input);
    expect(out).toContain("20 lakhs");
    expect(out).toContain("the salary");
    expect(out).toContain("18 lakhs");
    expect(out).toContain("28 lakhs");
    expect(out).not.toMatch(/\blegs\b/i);
    expect(out).not.toMatch(/\bcelery\b/i);
  });
});
