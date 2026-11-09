/* Design Interview Loop dashboard grouping (Stage 2) — pure progress math.
   Round availability must track roleInterviewMatrix's existing seniority
   gating exactly (no hardcoded 6), and done/not-done must key off the
   DashboardSession.type values the rest of the dashboard already uses. */

import { describe, it, expect } from "vitest";
import { getDesignerLoopProgress } from "../designerLoop";
import { profileFromRole } from "../roleInterviewMatrix";

describe("getDesignerLoopProgress", () => {
  it("a senior designer sees all 6 rounds, none done, when no sessions exist", () => {
    const { focuses } = profileFromRole("Senior Product Designer");
    const progress = getDesignerLoopProgress(focuses, []);
    expect(progress.total).toBe(6);
    expect(progress.doneCount).toBe(0);
    expect(progress.rounds.map((r) => r.slug)).toEqual([
      "hr-round", "portfolio-review", "design-exercise", "panel", "strategic", "salary-negotiation",
    ]);
    expect(progress.rounds.every((r) => !r.done)).toBe(true);
  });

  it("a junior designer sees fewer rounds — Panel Interview and Strategic are gated out", () => {
    const { focuses } = profileFromRole("Junior Product Designer");
    const progress = getDesignerLoopProgress(focuses, []);
    expect(progress.rounds.map((r) => r.slug)).not.toContain("panel");
    expect(progress.rounds.map((r) => r.slug)).not.toContain("strategic");
    expect(progress.total).toBeLessThan(6);
  });

  it("a non-designer role never gets the designer-only rounds (Portfolio Review / Design Exercise)", () => {
    const { focuses } = profileFromRole("Senior Software Engineer");
    const progress = getDesignerLoopProgress(focuses, []);
    const slugs = progress.rounds.map((r) => r.slug);
    expect(slugs).not.toContain("portfolio-review");
    expect(slugs).not.toContain("design-exercise");
  });

  it("marks rounds done by DashboardSession.type, matching normalizeType's display labels", () => {
    const { focuses } = profileFromRole("Senior Product Designer");
    const progress = getDesignerLoopProgress(focuses, ["Portfolio Review", "Salary Negotiation", "Behavioral"]);
    const byDone = Object.fromEntries(progress.rounds.map((r) => [r.slug, r.done]));
    expect(byDone["portfolio-review"]).toBe(true);
    expect(byDone["salary-negotiation"]).toBe(true);
    expect(byDone["hr-round"]).toBe(false);
    expect(byDone["design-exercise"]).toBe(false);
  });

  it("an unrelated completed type (e.g. a non-loop session) never false-marks a round done", () => {
    const { focuses } = profileFromRole("Senior Product Designer");
    const progress = getDesignerLoopProgress(focuses, ["Technical Leadership", "Case Study"]);
    expect(progress.doneCount).toBe(0);
  });
});
