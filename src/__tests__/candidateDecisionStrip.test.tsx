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
});
