import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { CompareBoard } from "../../app/(employer)/employer/requirements/[id]/_components/CompareBoard";
import type { Candidate } from "../employer/mockData";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => React.createElement("a", { href, ...props }, children),
}));

const getEvidence = vi.fn();
vi.mock("@/employer/_requirementCalls", () => ({ getEvidence: (id: string) => getEvidence(id) }));

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

describe("CompareBoard evidence", () => {
  const ev = (over: Record<string, unknown>) => ({ ok: true, data: { matchId: "x", skills: [], quotes: [], readiness: null, starCompleteness: null, sessionDate: null, verifiedCapabilities: [], ...over } });
  const u1 = cand("u1", { unlocked: true, name: "Asha Rao", matchScore: 70, sessionsCompleted: 3 });
  const u2 = cand("u2", { unlocked: true, name: "Dev Patel", matchScore: 68, sessionsCompleted: 0 });

  it("shows readiness, structure, skills and a real answer quote, and names who to interview first", async () => {
    getEvidence.mockImplementation((id: string) =>
      Promise.resolve(
        id === "u1"
          ? ev({ readiness: { band: "strongHire", confidence: "high" }, starCompleteness: { pct: 80, questionsConsidered: 5 }, skills: [{ name: "React", score: 88 }], quotes: [{ kind: "win", text: "Gave a concrete result", quote: "We cut load time by 40%" }] })
          : ev({ readiness: { band: "leanHire", confidence: "low" }, starCompleteness: { pct: 40, questionsConsidered: 5 } }),
      ),
    );
    board([u1, u2]);
    expect(await screen.findByText("Strong hire")).toBeTruthy();
    expect(screen.getByText("Lean hire")).toBeTruthy();
    expect(screen.getByText(/We cut load time by 40%/)).toBeTruthy();
    expect(screen.getByText(/Asha Rao is the stronger pick to interview first/)).toBeTruthy();
    expect(getEvidence).toHaveBeenCalledTimes(2);
  });

  it("does not fetch locked candidates and says to unlock them", () => {
    getEvidence.mockClear();
    board([cand("l1"), cand("l2")]);
    expect(getEvidence).not.toHaveBeenCalled();
    expect(screen.getByText(/Unlock .* from the shortlist to see their evidence/)).toBeTruthy();
  });

  it("falls back to a quiet note when evidence cannot load", async () => {
    getEvidence.mockResolvedValue({ ok: false, status: 500 });
    board([u1, u2]);
    await waitFor(() => expect(screen.getAllByText("Couldn't load evidence").length).toBeGreaterThan(0));
  });

  it("says plainly when a candidate has no graded interview", async () => {
    getEvidence.mockImplementation((id: string) => Promise.resolve(id === "u1" ? ev({ readiness: { band: "hire", confidence: "medium" } }) : ev({})));
    board([u1, u2]);
    expect(await screen.findByText("Hire")).toBeTruthy();
    expect(screen.getAllByText("No graded interview yet").length).toBeGreaterThan(0);
    expect(screen.getByText(/Dev Patel has no graded interview yet/)).toBeTruthy();
  });
});
