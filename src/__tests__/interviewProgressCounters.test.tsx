import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render } from "@testing-library/react";
import { EndModal } from "../InterviewPanels";
import { ReconnectingOverlay } from "../InterviewRobustness";

/* Regression guard for the interview question-counter desync.
 *
 * currentQuestionNum is a BASE-question position (1..baseQuestionCount;
 * follow-ups counted under their parent question). totalQuestions counts
 * every inserted follow-up as its own question. Mixing the two — a
 * base-capped numerator over a follow-up-inflated denominator — made a
 * fully-answered 5-question session read "5 of 8". Both the EndModal and
 * the ReconnectingOverlay must render base over base. */

describe("EndModal — question counter shares one basis", () => {
  const baseProps = {
    isOffline: false,
    handleEnd: vi.fn(),
    setShowEndModal: vi.fn(),
    endModalTriggerRef: createRef<HTMLSpanElement>(),
  };

  it("uses baseQuestionCount as the denominator, never the follow-up-inflated total", () => {
    const { container } = render(
      <EndModal currentQuestionNum={5} totalQuestions={8} baseQuestionCount={5} {...baseProps} />,
    );
    expect(container.textContent).toContain("5 of 5");
    expect(container.textContent).not.toContain("5 of 8");
  });

  it("caps the numerator at the total so it can never overflow the denominator", () => {
    const { container } = render(
      <EndModal currentQuestionNum={7} totalQuestions={9} baseQuestionCount={5} {...baseProps} />,
    );
    expect(container.textContent).toContain("5 of 5");
  });

  it("falls back to totalQuestions only when baseQuestionCount is absent (degenerate script)", () => {
    const { container } = render(
      <EndModal currentQuestionNum={2} totalQuestions={3} {...baseProps} />,
    );
    expect(container.textContent).toContain("2 of 3");
  });
});

describe("ReconnectingOverlay — question counter shares one basis", () => {
  it("inline banner (attempt 1) renders base over base", () => {
    const { container } = render(
      <ReconnectingOverlay attempt={1} currentQuestion={3} totalQuestions={8} baseQuestionCount={5} />,
    );
    expect(container.textContent).toContain("Q3 of 5");
    expect(container.textContent).not.toContain("Q3 of 8");
  });

  it("escalated modal (attempt 3) renders base over base", () => {
    const { container } = render(
      <ReconnectingOverlay attempt={3} currentQuestion={4} totalQuestions={8} baseQuestionCount={5} />,
    );
    expect(container.textContent).toContain("4 of 5");
    expect(container.textContent).not.toContain("4 of 8");
  });

  it("falls back to totalQuestions when base is absent", () => {
    const { container } = render(
      <ReconnectingOverlay attempt={1} currentQuestion={2} totalQuestions={4} />,
    );
    expect(container.textContent).toContain("Q2 of 4");
  });
});
