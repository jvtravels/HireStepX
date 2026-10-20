// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { RequirementSummary } from "../employer/mockData";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MatchesCell, DueCell } from "../../app/(employer)/employer/jobs/_components/JobCells";
import { compareRows } from "../../app/(employer)/employer/jobs/_components/jobsHelpers";

const base = { evaluated: 0, totalMatched: 0, scoreLow: null, scoreHigh: null, topMatches: 0, strongAvgScore: null, strongMatchInitials: [], strongMatchExtra: 0, strongMatches: [] };
const job = (over: Partial<RequirementSummary["aiScreening"]> = {}, status = "active"): RequirementSummary =>
  ({ id: "j", title: "Engineer", status, createdAt: "2026-01-01", aiScreening: { ...base, ...over } }) as unknown as RequirementSummary;

const renderCell = (ui: React.ReactElement) => render(<TooltipProvider>{ui}</TooltipProvider>);

describe("MatchesCell", () => {
  it("says None yet before anything is evaluated, never a dash", () => {
    const { container } = render(<MatchesCell r={job()} />);
    expect(container.textContent).toBe("None yet");
  });

  it("shows the finding state while matching runs", () => {
    render(<MatchesCell r={job({}, "generating")} />);
    expect(screen.getByText("Finding candidates")).toBeTruthy();
  });

  it("leads with the total matched, then the strong count, with the score range kept in the info tip", () => {
    renderCell(<MatchesCell r={job({ evaluated: 12, totalMatched: 12, scoreLow: 48, scoreHigh: 91, topMatches: 3, strongAvgScore: 82 })} />);
    expect(screen.getByText("12 candidates matched")).toBeTruthy();
    expect(screen.getByText("3 strong")).toBeTruthy();
    expect(screen.getByText("82% avg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "About these matches" })).toBeTruthy();
    expect(screen.queryByText("Scores 48 to 91%")).toBeNull();
  });

  it("uses the capped-pool wording", () => {
    renderCell(<MatchesCell r={job({ evaluated: 20, totalMatched: 35, topMatches: 1 })} />);
    expect(screen.getByText("35 candidates matched")).toBeTruthy();
    expect(screen.getByText("1 strong")).toBeTruthy();
    expect(screen.queryByText("Top 20 scored")).toBeNull();
  });

  it("keeps the score spread out of the cell body", () => {
    renderCell(<MatchesCell r={job({ evaluated: 3, totalMatched: 3, scoreLow: 25, scoreHigh: 25 })} />);
    expect(screen.getByText("3 candidates matched")).toBeTruthy();
    expect(screen.queryByText("All scored 25%")).toBeNull();
  });

  it("leaves out the strong line when nothing qualifies, and explains it in the tip", () => {
    renderCell(<MatchesCell r={job({ evaluated: 4, totalMatched: 4 })} />);
    expect(screen.getByText("4 candidates matched")).toBeTruthy();
    expect(screen.queryByText("None strong yet")).toBeNull();
    expect(screen.queryByText(/strong$/)).toBeNull();
  });
});

describe("DueCell", () => {
  it("shows Not set instead of an em dash", () => {
    const { container } = render(<DueCell dueDate={null} />);
    expect(container.textContent).toBe("Not set");
  });
});

describe("DueCell date", () => {
  it("shows a readable date, not the raw ISO string", () => {
    const { container } = render(<DueCell dueDate="2026-11-01" />);
    expect(container.textContent).toContain("1 Nov 2026");
    expect(container.textContent).not.toContain("2026-11-01");
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
