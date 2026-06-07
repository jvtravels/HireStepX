/* Month 2 PR-6 (PDF #28) — CoachingSignalsPanel rendering tests.
 *
 * Verifies the panel respects the honest-empty-state contract (returns
 * null when no flags) and renders the human-readable labels + counts
 * for the three guardrail flags shipped in M2 PR-3/PR-4. */

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CoachingSignalsPanel } from "../sessionReport/panels/CoachingSignalsPanel";

describe("CoachingSignalsPanel", () => {
  it("renders nothing when flagSummary is undefined", () => {
    const { container } = render(<CoachingSignalsPanel />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when flagSummary is an empty object", () => {
    const { container } = render(<CoachingSignalsPanel flagSummary={{}} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when every flag has count 0", () => {
    const { container } = render(
      <CoachingSignalsPanel flagSummary={{ "pressure-repeat": 0 }} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders the pressure-repeat label when flagged", () => {
    render(
      <CoachingSignalsPanel flagSummary={{ "pressure-repeat": 2 }} />,
    );
    expect(
      screen.getByText("Two pressure moves in a row"),
    ).toBeInTheDocument();
    expect(screen.getByText("×2")).toBeInTheDocument();
  });

  it("renders all three known flag labels when all flagged", () => {
    render(
      <CoachingSignalsPanel
        flagSummary={{
          "pressure-repeat": 1,
          "stall-cascade": 3,
          "anchor-double-set": 2,
        }}
      />,
    );
    expect(screen.getByText("Two pressure moves in a row")).toBeInTheDocument();
    expect(screen.getByText("Two stalling tactics in a row")).toBeInTheDocument();
    expect(
      screen.getByText("They anchored twice without listening"),
    ).toBeInTheDocument();
  });

  it("orders flags by count descending (highest count first)", () => {
    render(
      <CoachingSignalsPanel
        flagSummary={{
          "pressure-repeat": 1,
          "stall-cascade": 5,
          "anchor-double-set": 3,
        }}
      />,
    );
    /* Read the rendered count chips in document order. */
    const counts = screen
      .getAllByText(/×\d+/)
      .map((el) => parseInt(el.textContent!.replace("×", ""), 10));
    expect(counts).toEqual([5, 3, 1]);
  });

  it("falls through to a generic label for unknown flag names", () => {
    render(
      <CoachingSignalsPanel flagSummary={{ "new-rule-not-mapped": 1 }} />,
    );
    /* The flag name itself should appear (fallback label). */
    expect(screen.getByText("new-rule-not-mapped")).toBeInTheDocument();
  });
});
