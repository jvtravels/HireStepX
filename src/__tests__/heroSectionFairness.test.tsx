/* Render test for the Phase-1 India-context fairness card in the
 * session-report hero. The card only renders when fairnessSignals.notes
 * is non-empty — a truthful-by-construction surface: each note is shown
 * only because its cultural-register marker fired on the candidate's own
 * words (see _cultural-register.ts summarizeIndianRegister). These tests
 * exercise the real HeroSection through the real card markup. */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { HeroSection } from "../sessionReport/panels/sr-HeroSection";
import type { InterviewResultData } from "../sessionReport/types";

function makeData(overrides: Partial<InterviewResultData> = {}): InterviewResultData {
  return {
    overallScore: 72,
    verdict: "hire",
    scoreDelta: 0,
    company: "Razorpay",
    role: "Backend Engineer",
    level: "Mid",
    difficulty: "Medium",
    aiVerdict: "Solid structured answers with measurable impact.",
    strengths: ["Clear ownership"],
    improvements: ["Quantify outcomes"],
    metrics: [],
    skills: [],
    weakestSkill: { name: "Concision", tip: "Trim preamble" },
    questions: [],
    ...overrides,
  };
}

describe("HeroSection — India-context fairness card", () => {
  it("renders the fairness heading and each note when notes are present", () => {
    const notes = [
      "Treated your courtesy and gratitude as professionalism, not low confidence",
      "Read your respectful pushback as conviction, not timidity",
    ];
    render(<HeroSection data={makeData({ fairnessSignals: { notes } })} />);

    expect(screen.getByText(/India-context fairness applied/i)).toBeInTheDocument();
    for (const note of notes) {
      expect(screen.getByText(note)).toBeInTheDocument();
    }
  });

  it("hides the card when fairnessSignals is undefined", () => {
    render(<HeroSection data={makeData()} />);
    expect(screen.queryByText(/India-context fairness applied/i)).toBeNull();
  });

  it("hides the card when notes is an empty array", () => {
    render(<HeroSection data={makeData({ fairnessSignals: { notes: [] } })} />);
    expect(screen.queryByText(/India-context fairness applied/i)).toBeNull();
  });
});
