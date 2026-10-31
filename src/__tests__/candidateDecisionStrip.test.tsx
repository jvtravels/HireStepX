import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DecisionStrip } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/DecisionStrip";

const requirement: any = { id: "r", title: "Backend Engineer", skills: ["Go", "SQL", "AWS", "Kafka", "Redis"], experienceMin: 3, experienceMax: 6, locations: [], workMode: "hybrid", candidates: [] };
const candidate: any = { id: "c1", matchScore: 31, city: "Not specified", resume: { yearsExperience: 4, education: [], experience: [], industries: [] } };

describe("DecisionStrip on a resume-only candidate", () => {
  it("explains the score and says practice is missing", () => {
    render(<DecisionStrip candidate={candidate} requirement={requirement} matched={[]} evidence={null} />);
    const text = screen.getByLabelText("At a glance").textContent ?? "";
    expect(text).toContain("Score 31:");
    expect(text).toContain("gaps in required skills");
    expect(text).toContain("No graded practice yet");
  });

  it("does not claim practice is missing when a graded session exists but detailed evidence is empty", () => {
    render(<DecisionStrip candidate={{ ...candidate, sessionsCompleted: 1 }} requirement={requirement} matched={[]} evidence={null} />);
    const text = screen.getByLabelText("At a glance").textContent ?? "";
    expect(text).toContain("Score 31:");
    expect(text).not.toContain("No graded practice yet");
    expect(text).not.toContain("Ask them to practise");
  });

  it("leads with the best graded answer and a trust label", () => {
    const q = (idx: number, score: number, star: any) => ({ idx, question: `Question ${idx}`, score, verdict: "complete", difficulty: null, star, length: null });
    const evidence: any = {
      sessionDate: "2026-10-17T10:00:00Z",
      questions: [q(1, 55, null), q(2, 88, { S: true, T: true, A: true, R: false }), { ...q(3, 95, null), verdict: "skipped" }],
    };
    render(<DecisionStrip candidate={{ ...candidate, sessionsCompleted: 1 }} requirement={requirement} matched={[]} evidence={evidence} />);
    const text = screen.getByLabelText("At a glance").textContent ?? "";
    expect(text).toContain("Graded in practice: 1 session, latest 17 Oct 2026");
    expect(text).toContain("Best single answer, 88 out of 100: Question 2");
    expect(text).not.toContain("Question 3");
  });

  it("shows no best answer or trust label without practice", () => {
    render(<DecisionStrip candidate={candidate} requirement={requirement} matched={[]} evidence={null} />);
    expect(screen.getByLabelText("At a glance").textContent).not.toContain("Graded in practice");
  });
});
