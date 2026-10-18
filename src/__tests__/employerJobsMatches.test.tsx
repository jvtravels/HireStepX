// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RequirementSummary } from "../employer/mockData";
import { MatchesCell, DueCell } from "../../app/(employer)/employer/jobs/_components/JobCells";
import { compareRows } from "../../app/(employer)/employer/jobs/_components/jobsHelpers";

const base = { evaluated: 0, totalMatched: 0, scoreLow: null, scoreHigh: null, topMatches: 0, strongAvgScore: null, strongMatchInitials: [], strongMatchExtra: 0, strongMatches: [] };
const job = (over: Partial<RequirementSummary["aiScreening"]> = {}, status = "active"): RequirementSummary =>
  ({ id: "j", title: "Engineer", status, createdAt: "2026-01-01", aiScreening: { ...base, ...over } }) as unknown as RequirementSummary;

describe("MatchesCell", () => {
  it("says None yet before anything is evaluated, never a dash", () => {
    const { container } = render(<MatchesCell r={job()} />);
    expect(container.textContent).toBe("None yet");
  });

  it("shows the finding state while matching runs", () => {
    render(<MatchesCell r={job({}, "generating")} />);
    expect(screen.getByText("Finding candidates")).toBeTruthy();
  });

  it("leads with strong matches and folds the evaluated count and score range into one cell", () => {
    render(<MatchesCell r={job({ evaluated: 12, totalMatched: 12, scoreLow: 48, scoreHigh: 91, topMatches: 3, strongAvgScore: 82 })} />);
    expect(screen.getByText("3 strong matches")).toBeTruthy();
    expect(screen.getByText("82% avg")).toBeTruthy();
    expect(screen.getByText("12 evaluated, scores 48 to 91%")).toBeTruthy();
  });

  it("uses the singular and the capped-pool wording", () => {
    render(<MatchesCell r={job({ evaluated: 20, totalMatched: 35, topMatches: 1 })} />);
    expect(screen.getByText("1 strong match")).toBeTruthy();
    expect(screen.getByText("Top 20 of 35 matched")).toBeTruthy();
  });

  it("says so when nothing qualifies as a strong match", () => {
    render(<MatchesCell r={job({ evaluated: 4, totalMatched: 4 })} />);
    expect(screen.getByText("No strong matches yet")).toBeTruthy();
  });
});

describe("DueCell", () => {
  it("shows Not set instead of an em dash", () => {
    const { container } = render(<DueCell dueDate={null} />);
    expect(container.textContent).toBe("Not set");
  });
});

describe("compareRows by matches", () => {
  it("sorts by strong matches, then by evaluated count", () => {
    const a = job({ topMatches: 2, evaluated: 5 });
    const b = job({ topMatches: 2, evaluated: 9 });
    const c = job({ topMatches: 4, evaluated: 4 });
    const sorted = [a, b, c].sort((x, y) => compareRows(x, y, { column: "topMatches", direction: "desc" }));
    expect(sorted).toEqual([c, b, a]);
  });
});
