import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DashboardHeader } from "../employer/DashboardSections";
import type { RequirementSummary } from "../employer/mockData";
import type { RecommendedCard } from "../employer/dashboardData";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => React.createElement("a", { href, ...props }, children),
}));

beforeAll(() => {
  // cmdk measures its list and scrolls the active option into view; jsdom has neither.
  globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  Element.prototype.scrollIntoView = vi.fn();
});

const jobs = [
  { id: "j1", title: "Senior Frontend Engineer", skills: ["React", "TypeScript"] },
  { id: "j2", title: "Data Analyst", skills: ["SQL"] },
] as unknown as RequirementSummary[];
const candidates = [
  { matchId: "m1", requirementId: "j1", name: "Asha Rao", roleTitle: "Senior Frontend Engineer", matchedSkills: ["React"] },
] as unknown as RecommendedCard[];

function setup() {
  push.mockClear();
  render(<DashboardHeader companyName="Acme" range={30} onRangeChange={vi.fn()} jobs={jobs} recommended={candidates} />);
  return screen.getByPlaceholderText("Search jobs and candidates");
}

describe("Dashboard search", () => {
  it("is a labelled combobox that names what it searches", () => {
    const box = setup();
    expect(box.getAttribute("role")).toBe("combobox");
    expect(box.getAttribute("aria-controls")).toBeTruthy();
  });

  it("shows grouped job and candidate results and announces the count", () => {
    const box = setup();
    fireEvent.change(box, { target: { value: "react" } });
    expect(screen.getByRole("option", { name: /^Senior Frontend Engineer/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Asha Rao/ })).toBeTruthy();
    expect(screen.getByText("2 results")).toBeTruthy();
  });

  it("opens a job on selection", () => {
    const box = setup();
    fireEvent.change(box, { target: { value: "analyst" } });
    fireEvent.click(screen.getByRole("option", { name: /Data Analyst/ }));
    expect(push).toHaveBeenCalledWith("/employer/requirements/j2");
  });

  it("opens a candidate on selection", () => {
    const box = setup();
    fireEvent.change(box, { target: { value: "asha" } });
    fireEvent.click(screen.getByRole("option", { name: /Asha Rao/ }));
    expect(push).toHaveBeenCalledWith("/employer/requirements/j1/candidates/m1");
  });

  it("says so when nothing matches", () => {
    const box = setup();
    fireEvent.change(box, { target: { value: "zzz" } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
    expect(screen.getByText("No results")).toBeTruthy();
  });

  it("clears the query on Escape", () => {
    const box = setup() as HTMLInputElement;
    fireEvent.change(box, { target: { value: "react" } });
    fireEvent.keyDown(box, { key: "Escape" });
    expect(box.value).toBe("");
  });
});
