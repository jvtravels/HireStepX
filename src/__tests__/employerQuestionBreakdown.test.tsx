// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { QuestionBreakdown } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/QuestionBreakdown";
import { summarizeQuestions } from "../../app/(employer)/employer/requirements/[id]/candidates/[candidateId]/_components/helpers";
import { TooltipProvider } from "../components/ui/tooltip";
import type { EvidenceQuestion } from "../employer/EmployerDataContext";
import type { Candidate } from "../employer/mockData";

const fullStar = { S: true, T: true, A: true, R: true };
const q = (over: Partial<EvidenceQuestion>): EvidenceQuestion => ({
  idx: 0, question: "Tell me about a launch", score: 70, verdict: "complete",
  difficulty: "standard", star: fullStar, length: null, ...over,
});
const requestUi = {
  state: { requests: [], pending: [], available: false, loaded: true, create: vi.fn(), cancel: vi.fn(), findPending: () => null },
  disabled: false,
  disabledReason: null,
};
const renderBreakdown = (questions: EvidenceQuestion[]) =>
  render(<TooltipProvider><QuestionBreakdown questions={questions} candidate={candidate} requestUi={requestUi} /></TooltipProvider>);
const candidate = { unlocked: false } as any as Candidate;

describe("QuestionBreakdown", () => {
  it("does not count warm-up answers toward the STAR summary", () => {
    const s = summarizeQuestions([q({ idx: 0, difficulty: "warmup" }), q({ idx: 1 }), q({ idx: 2, star: { ...fullStar, R: false } })]);
    expect(s?.starCounted).toBe(2);
    expect(s?.fullStar).toBe(1);
  });

  it("hides STAR marks on a warm-up question", () => {
    renderBreakdown([q({ difficulty: "warmup" })]);
    expect(screen.queryByTitle(/Situation/)).toBeNull();
  });

  it("pluralizes the word count", () => {
    renderBreakdown([q({ idx: 0, length: { verdict: "too-brief", wordCount: 1 } }), q({ idx: 1, question: "Describe a conflict with a peer", length: { verdict: "right", wordCount: 80 } })]);
    expect(screen.getByText(/, 1 word$/)).toBeTruthy();
    expect(screen.getByText(/, 80 words$/)).toBeTruthy();
  });
});
