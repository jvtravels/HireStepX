import { describe, it, expect } from "vitest";
import {
  resolveHrSectorOverlay,
  applyHrOverlays,
  resolveHrRoundRecipe,
} from "../../server-handlers/_hr-round-overlays";
import { RECIPES } from "../../data/focus-question-recipes";

/* Sector × seniority overlay coverage. The audit flagged that MNC GCCs,
   consulting firms, and Government/PSU employers all fell through to the
   generic base rubric ("none"), understating compliance and overstating
   comp negotiability for those candidates. These lock in the added
   overlays and prove the base rubric is untouched for unknown companies. */

const hrBase = RECIPES["hr-round"];

function weightOf(recipe: typeof hrBase, dimension: string): number {
  return recipe.scoringRubric?.find((r) => r.dimension === dimension)?.weight ?? 0;
}

describe("resolveHrSectorOverlay — added sectors", () => {
  it("maps MNC GCC / captive tech centres to 'gcc'", () => {
    expect(resolveHrSectorOverlay("Walmart Global Tech")).toBe("gcc");
    expect(resolveHrSectorOverlay("Google")).toBe("gcc");
    expect(resolveHrSectorOverlay("Microsoft IDC")).toBe("gcc");
    expect(resolveHrSectorOverlay("Target Corporation")).toBe("gcc");
  });

  it("maps strategy / Big-4 consulting to 'consulting'", () => {
    expect(resolveHrSectorOverlay("McKinsey & Company")).toBe("consulting");
    expect(resolveHrSectorOverlay("Boston Consulting Group")).toBe("consulting");
    expect(resolveHrSectorOverlay("Deloitte")).toBe("consulting");
    expect(resolveHrSectorOverlay("KPMG")).toBe("consulting");
  });

  it("maps Government / PSU employers to 'psu'", () => {
    expect(resolveHrSectorOverlay("ONGC")).toBe("psu");
    expect(resolveHrSectorOverlay("ISRO")).toBe("psu");
    expect(resolveHrSectorOverlay("NTPC Limited")).toBe("psu");
    expect(resolveHrSectorOverlay("BHEL")).toBe("psu");
  });

  it("still returns 'none' for a genuinely unknown company", () => {
    expect(resolveHrSectorOverlay("Some Unknown Startup XYZ")).toBe("none");
    expect(resolveHrSectorOverlay("")).toBe("none");
  });

  it("does not misclassify existing sectors (no regex bleed)", () => {
    expect(resolveHrSectorOverlay("TCS")).toBe("services-tier1");
    expect(resolveHrSectorOverlay("Razorpay")).toBe("product-unicorn");
    expect(resolveHrSectorOverlay("HDFC Bank")).toBe("bfsi");
  });
});

describe("applyHrOverlays — added-sector weight lensing", () => {
  it("PSU collapses comp-transparency weight (pay scales are fixed)", () => {
    const base = weightOf(hrBase, "Comp transparency");
    const psu = applyHrOverlays(hrBase, { sector: "psu", seniority: "mid" });
    expect(weightOf(psu, "Comp transparency")).toBeLessThan(base);
    // Compliance is what actually matters at a PSU — it should rise.
    expect(weightOf(psu, "Compliance readiness")).toBeGreaterThan(weightOf(hrBase, "Compliance readiness"));
  });

  it("GCC lifts comp-transparency (RSU literacy) above baseline", () => {
    const gcc = applyHrOverlays(hrBase, { sector: "gcc", seniority: "mid" });
    expect(weightOf(gcc, "Comp transparency")).toBeGreaterThan(weightOf(hrBase, "Comp transparency"));
  });

  it("consulting lifts motivation specificity (why-consulting) above baseline", () => {
    const con = applyHrOverlays(hrBase, { sector: "consulting", seniority: "mid" });
    expect(weightOf(con, "Motivation specificity")).toBeGreaterThan(weightOf(hrBase, "Motivation specificity"));
  });

  it("every overlaid rubric still sums to 1.0 (renormalised)", () => {
    for (const sector of ["gcc", "consulting", "psu", "none"] as const) {
      const out = applyHrOverlays(hrBase, { sector, seniority: "senior" });
      const sum = (out.scoringRubric ?? []).reduce((a, r) => a + r.weight, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    }
  });

  it("leaves the base rubric object unmutated", () => {
    const before = weightOf(hrBase, "Comp transparency");
    applyHrOverlays(hrBase, { sector: "psu", seniority: "executive" });
    expect(weightOf(hrBase, "Comp transparency")).toBe(before);
  });
});

describe("resolveHrRoundRecipe — end to end", () => {
  it("threads company + level into a renormalised recipe + context", () => {
    const { recipe, context } = resolveHrRoundRecipe(hrBase, { company: "ONGC", expLevel: "senior" });
    expect(context.sector).toBe("psu");
    expect(context.seniority).toBe("senior");
    const sum = (recipe.scoringRubric ?? []).reduce((a, r) => a + r.weight, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });
});
