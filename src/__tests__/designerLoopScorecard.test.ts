/* Design Interview Loop combined scorecard (Stage 3) — pure fold logic.
   Must only surface rounds the candidate actually completed, join each
   one to its real skill_scores (not invent placeholders), and only flip
   `visible` once 2+ rounds are represented, per the approved brief's
   "once a candidate finishes 2+ rounds" gate. */

import { describe, it, expect } from "vitest";
import { getDesignerLoopScorecard } from "../designerLoopScorecard";
import type { DesignerLoopRound } from "../designerLoop";
import type { RealSession } from "../dashboardData";

function round(over: Partial<DesignerLoopRound> = {}): DesignerLoopRound {
  return { slug: "hr-round", label: "HR / Culture Fit", sessionTypeLabel: "HR Round", done: true, ...over };
}

function session(over: Partial<RealSession> = {}): RealSession {
  return {
    id: "s1", date: "2026-11-01", type: "hr-round", difficulty: "medium",
    focus: "hr-round", duration: 900, score: 80, questions: 5, ...over,
  };
}

describe("getDesignerLoopScorecard", () => {
  it("is not visible with fewer than 2 completed rounds", () => {
    const rounds = [round({ done: true })];
    const recent = [{ id: "s1", type: "HR Round" }];
    const raw = [session({ id: "s1", score: 80 })];
    const result = getDesignerLoopScorecard(rounds, recent, raw);
    expect(result.visible).toBe(false);
    expect(result.rounds).toHaveLength(1);
  });

  it("becomes visible once 2+ rounds are completed and joined to a session", () => {
    const rounds = [
      round({ slug: "hr-round", sessionTypeLabel: "HR Round", done: true }),
      round({ slug: "portfolio-review", label: "Portfolio Review", sessionTypeLabel: "Portfolio Review", done: true }),
    ];
    const recent = [
      { id: "s1", type: "HR Round" },
      { id: "s2", type: "Portfolio Review" },
    ];
    const raw = [
      session({ id: "s1", score: 72, skill_scores: { "Self-awareness": 70 } }),
      session({ id: "s2", score: 88, skill_scores: { "Design rationale": 90, "Trade-off honesty": 85 } }),
    ];
    const result = getDesignerLoopScorecard(rounds, recent, raw);
    expect(result.visible).toBe(true);
    expect(result.rounds.map((r) => r.slug)).toEqual(["hr-round", "portfolio-review"]);
    expect(result.rounds[1].skills).toEqual([
      { name: "Design rationale", score: 90 },
      { name: "Trade-off honesty", score: 85 },
    ]);
    expect(result.averageScore).toBe(80);
  });

  it("skips a round marked done when no matching session can be found (data drift, not a crash)", () => {
    const rounds = [
      round({ slug: "hr-round", sessionTypeLabel: "HR Round", done: true }),
      round({ slug: "panel", label: "Panel", sessionTypeLabel: "Panel", done: true }),
    ];
    const recent = [{ id: "s1", type: "HR Round" }];
    const raw = [session({ id: "s1", score: 60 })];
    const result = getDesignerLoopScorecard(rounds, recent, raw);
    expect(result.rounds).toHaveLength(1);
    expect(result.visible).toBe(false);
  });

  it("excludes rounds that are not done at all", () => {
    const rounds = [
      round({ slug: "hr-round", sessionTypeLabel: "HR Round", done: true }),
      round({ slug: "design-exercise", label: "Design Exercise", sessionTypeLabel: "Design Exercise", done: false }),
    ];
    const recent = [{ id: "s1", type: "HR Round" }];
    const raw = [session({ id: "s1", score: 60 })];
    const result = getDesignerLoopScorecard(rounds, recent, raw);
    expect(result.rounds.map((r) => r.slug)).toEqual(["hr-round"]);
  });

  it("returns an empty skills list rather than fabricating entries when skill_scores is missing", () => {
    const rounds = [
      round({ slug: "hr-round", sessionTypeLabel: "HR Round", done: true }),
      round({ slug: "salary-negotiation", label: "Salary Negotiation", sessionTypeLabel: "Salary Negotiation", done: true }),
    ];
    const recent = [
      { id: "s1", type: "HR Round" },
      { id: "s2", type: "Salary Negotiation" },
    ];
    const raw = [
      session({ id: "s1", score: 60, skill_scores: null }),
      session({ id: "s2", score: 70 }),
    ];
    const result = getDesignerLoopScorecard(rounds, recent, raw);
    expect(result.rounds[0].skills).toEqual([]);
  });
});
