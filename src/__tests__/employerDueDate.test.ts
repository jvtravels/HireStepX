import { describe, it, expect } from "vitest";
import { calendarDaysUntil } from "../employer/dueDate";
import { dueLabel } from "../../app/(employer)/employer/requirements/[id]/_components/requirementFormat";
import { matchesDueFilter } from "../../app/(employer)/employer/jobs/_components/jobsHelpers";
import type { RequirementSummary } from "../employer/mockData";

// 2026-10-21 23:30 in India is 18:00 UTC the same day; 2026-10-22 00:30 in India is 19:00 UTC the 21st.
const LATE_EVENING_IST = Date.parse("2026-10-21T18:00:00Z");
const JUST_AFTER_MIDNIGHT_IST = Date.parse("2026-10-21T19:00:00Z");

describe("calendarDaysUntil", () => {
  it("counts calendar days in India, not elapsed hours", () => {
    expect(calendarDaysUntil("2026-11-01", LATE_EVENING_IST)).toBe(11);
    expect(calendarDaysUntil("2026-11-01", JUST_AFTER_MIDNIGHT_IST)).toBe(10);
  });
  it("is 0 today and negative once the day has passed", () => {
    expect(calendarDaysUntil("2026-10-21", LATE_EVENING_IST)).toBe(0);
    expect(calendarDaysUntil("2026-10-20", LATE_EVENING_IST)).toBe(-1);
  });
  it("returns NaN for an unreadable date", () => {
    expect(calendarDaysUntil("soon")).toBeNaN();
  });
});

describe("dueLabel", () => {
  it("uses singular and plural wording", () => {
    expect(dueLabel("2000-01-01").overdue).toBe(true);
    expect(dueLabel("2999-01-01").text).toMatch(/^Due in \d+ days$/);
  });
});

describe("matchesDueFilter", () => {
  const job = (over: Partial<RequirementSummary>) => ({ dueDate: "2000-01-01", status: "ready", ...over }) as RequirementSummary;
  it("treats a passed deadline as overdue only while the job is open", () => {
    expect(matchesDueFilter(job({}), "Overdue")).toBe(true);
    expect(matchesDueFilter(job({ status: "closed" }), "Overdue")).toBe(false);
    expect(matchesDueFilter(job({ status: "closed", dueDate: "2999-01-01" }), "Due within 7 days")).toBe(false);
  });
});
