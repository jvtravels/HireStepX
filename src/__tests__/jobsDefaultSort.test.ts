import { describe, expect, it } from "vitest";
import { compareRows, DEFAULT_SORT } from "../../app/(employer)/employer/jobs/_components/jobsHelpers";
import type { RequirementSummary } from "@/employer/mockData";

const job = (id: string, createdAt: string, status: RequirementSummary["status"], candidateCount = 5) => ({ id, createdAt, status, candidateCount }) as RequirementSummary;

describe("jobs list default sort", () => {
  const rows = [job("closed-new", "2026-10-30", "closed"), job("open-old", "2026-10-01", "ready"), job("open-new", "2026-10-20", "zero")];

  it("puts jobs with candidates ahead of newer empty ones", () => {
    const withEmpty = [job("empty-newest", "2026-10-29", "zero", 0), job("busy-old", "2026-09-01", "ready", 21)];
    expect([...withEmpty].sort((a, b) => compareRows(a, b, DEFAULT_SORT)).map((r) => r.id)).toEqual(["busy-old", "empty-newest"]);
  });

  it("lists live jobs newest first, then closed jobs", () => {
    expect([...rows].sort((a, b) => compareRows(a, b, DEFAULT_SORT)).map((r) => r.id)).toEqual(["open-new", "open-old", "closed-new"]);
  });

  it("keeps closed jobs last when the dates are sorted oldest first", () => {
    expect([...rows].sort((a, b) => compareRows(a, b, { column: "created", direction: "asc" })).map((r) => r.id)).toEqual(["open-old", "open-new", "closed-new"]);
  });
});
