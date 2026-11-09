/* Designer Interview Loop: Portfolio Review + Design Exercise recipes.
   Spot-checks the two new focus-question-recipes entries added for the
   designer-only rounds — category keys resolve, rubric weights are sane,
   and formatRecipe() produces a non-empty prompt fragment (same contract
   every other focus relies on). */

import { describe, it, expect } from "vitest";
import { RECIPES, formatRecipe } from "../../data/focus-question-recipes";
import { CATEGORIES } from "../../data/question-taxonomy";

describe("Designer Interview Loop recipes", () => {
  it.each(["portfolio-review", "design-exercise"])("%s recipe exists with valid category keys", (key) => {
    const recipe = RECIPES[key];
    expect(recipe).toBeDefined();
    for (const catKey of [...recipe.mandatory, ...recipe.optional]) {
      expect(CATEGORIES[catKey]).toBeDefined();
    }
  });

  it.each(["portfolio-review", "design-exercise"])("%s scoring rubric weights sum to ~1", (key) => {
    const recipe = RECIPES[key];
    const total = (recipe.scoringRubric ?? []).reduce((sum, d) => sum + d.weight, 0);
    expect(total).toBeCloseTo(1, 1);
  });

  it.each(["portfolio-review", "design-exercise"])("%s formats a non-empty prompt fragment", (key) => {
    const fragment = formatRecipe(key);
    expect(fragment.length).toBeGreaterThan(0);
    expect(fragment).toContain(RECIPES[key].label);
  });

  it("design-exercise is not adversarial (trapBudget 0) and invites candidate questions", () => {
    expect(RECIPES["design-exercise"].trapBudget).toBe(0);
    expect(RECIPES["design-exercise"].inviteCandidateQuestions).toBe(true);
  });

  it("portfolio-review is not adversarial (trapBudget 0) and invites candidate questions", () => {
    expect(RECIPES["portfolio-review"].trapBudget).toBe(0);
    expect(RECIPES["portfolio-review"].inviteCandidateQuestions).toBe(true);
  });
});
