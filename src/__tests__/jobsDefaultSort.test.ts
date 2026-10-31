import { describe, expect, it } from "vitest";
import { compareRows, DEFAULT_SORT } from "../../app/(employer)/employer/jobs/_components/jobsHelpers";
import type { RequirementSummary } from "@/employer/mockData";

const job = (id: string, createdAt: string, status: RequirementSummary["status"]) => ({ id, createdAt, status }) as RequirementSummary;

describe("jobs list default sort", () => {
  const rows = [job("closed-new", "2026-10-30", "closed"), job("open-old", "2026-10-01", "ready"), job("open-new", "2026-10-20", "zero")];

  it("lists live jobs newest first, then closed jobs", () => {
    expect([...rows].sort((a, b) => compareRows(a, b, DEFAULT_SORT)).map((r) => r.id)).toEqual(["open-new", "open-old", "closed-new"]);
  });

  it("keeps closed jobs last when the dates are sorted oldest first", () => {
    expect([...rows].sort((a, b) => compareRows(a, b, { column: "created", direction: "asc" })).map((r) => r.id)).toEqual(["open-old", "open-new", "closed-new"]);
  });
});
