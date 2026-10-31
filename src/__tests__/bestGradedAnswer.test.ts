import { describe, it, expect } from "vitest";
import { bestGradedAnswer, isOpeningSmallTalk } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers";
import type { EvidenceQuestion } from "@/employer/EmployerDataContext";

const q = (question: string, score: number): EvidenceQuestion => ({ question, score, verdict: "ok" } as unknown as EvidenceQuestion);

describe("bestGradedAnswer", () => {
  it("never picks the interviewer's opening greeting", () => {
    const greeting = q("Hi thanks for making the time today. I'm Aditya, and I'll be your interviewer.", 60);
    const real = q("Walk me through a project you led.", 45);
    expect(bestGradedAnswer([greeting, real])).toBe(real);
  });
  it("returns null when the only graded turn is small talk", () => {
    expect(bestGradedAnswer([q("Hello, thanks for taking the time.", 60)])).toBeNull();
  });
  it("does not flag real questions", () => {
    expect(isOpeningSmallTalk("Tell me about a time you hello-world'd a service")).toBe(false);
  });
});
