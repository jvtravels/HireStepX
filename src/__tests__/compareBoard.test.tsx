import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { CompareBoard } from "../../app/(employer)/employer/requirements/[id]/_components/CompareBoard";
import type { Candidate } from "../employer/mockData";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => React.createElement("a", { href, ...props }, children),
}));

const REQ = ["React", "TypeScript"];
function cand(id: string, over: Partial<Candidate> = {}): Candidate {
  return {
    id, name: `Candidate #${id}`, unlocked: false, skills: ["React"], matchScore: 50, sessionsCompleted: 0, rosterScore: 0,
    lastActiveDaysAgo: 1, targetRole: "Engineer", city: "Pune", candidateStatus: null, candidateStatusNote: null, ...over,
  } as unknown as Candidate;
}

const a = cand("a", { matchScore: 80, sessionsCompleted: 4, rosterScore: 70 });
const b = cand("b", { matchScore: 50, sessionsCompleted: 1, rosterScore: 30 });
const c = cand("c", { matchScore: 60, sessionsCompleted: 2, rosterScore: 50 });

function board(chosen: Candidate[]) {
  return render(<CompareBoard requirementId="r1" requirementTitle="Frontend Engineer" required={REQ} chosen={chosen} />);
}

describe("CompareBoard", () => {
  it("renders a table with one column per candidate and links each to its profile", () => {
    board([a, b, c]);
    expect(screen.getAllByRole("columnheader").filter((h) => h.querySelector("a"))).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Candidate #a" }).getAttribute("href")).toBe("/employer/requirements/r1/candidates/a");
  });

  it("marks the clear leader with a text label, not colour alone", () => {
    board([a, b]);
    expect(screen.getAllByText("Leads").length).toBeGreaterThan(0);
    expect(screen.getByText("Leads 3 of 4")).toBeTruthy();
  });

  it("hides rows that match and lets the user show them", () => {
    board([a, b]);
    expect(screen.queryByText("Target role")).toBeNull();
    expect(screen.getByText(/rows? (is|are) the same/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Show all rows" }));
    expect(screen.getByText("Target role")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide matching rows" }));
    expect(screen.queryByText("Target role")).toBeNull();
  });

  it("keeps the no-pick disclaimer and reveals interview questions on demand", () => {
    board([a, b]);
    expect(screen.getByText(/does not pick a hire for you/)).toBeTruthy();
    const ask = screen.getByRole("button", { name: /Worth asking in the interview/ });
    expect(ask.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(ask);
    expect(ask.getAttribute("aria-expanded")).toBe("true");
  });

  it("says so when everything matches", () => {
    board([cand("x"), cand("y")]);
    expect(screen.getByText("Every row matches across these candidates.")).toBeTruthy();
  });
});
