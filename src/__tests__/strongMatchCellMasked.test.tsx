import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import StrongMatchCell from "../../app/(employer)/employer/jobs/_components/StrongMatchCell";
import type { RequirementSummary } from "../employer/mockData";

const summary = (strongMatches: Array<{ id: string; name: string; initials: string }>) => ({
  evaluated: 5, totalMatched: 5, scoreLow: 40, scoreHigh: 90, topMatches: strongMatches.length, strongAvgScore: 70,
  strongMatchInitials: strongMatches.map((c) => c.initials), strongMatchExtra: 0,
  strongMatches: strongMatches.map((c) => ({ ...c, yearsExperience: null, skills: [] })),
}) as unknown as RequirementSummary["aiScreening"];

describe("StrongMatchCell avatars", () => {
  it("shows a person icon, not hex digits, for a masked candidate", () => {
    const { container } = render(<StrongMatchCell aiScreening={summary([{ id: "a", name: "Candidate #665e1d", initials: "66" }])} />);
    expect(container.querySelector(".hsx-avatar svg")).not.toBeNull();
    expect(container.textContent).not.toContain("66");
  });

  it("keeps initials for an unlocked candidate", () => {
    const { container } = render(<StrongMatchCell aiScreening={summary([{ id: "b", name: "Jay Vyas", initials: "JV" }])} />);
    expect(container.querySelector(".hsx-avatar")?.textContent).toBe("JV");
  });
});
