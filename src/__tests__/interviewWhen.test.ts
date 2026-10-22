import { describe, it, expect } from "vitest";
import { formatInterviewWhen, isDateOnlyInstant, isInterviewPast } from "../interviewWhen";
import { inviteEvent } from "../interviewInvite";
import { generateICS } from "../dashboardHelpers";
import { threadMessageFor } from "../../server-handlers/_employer-candidate-status-helpers";

const DATE_ONLY = "2026-10-10T00:00:00+00:00";
const TIMED = "2026-10-10T09:30:00.000Z";

describe("isDateOnlyInstant", () => {
  it("is true only for exact UTC midnight", () => {
    expect(isDateOnlyInstant(DATE_ONLY)).toBe(true);
    expect(isDateOnlyInstant(TIMED)).toBe(false);
    expect(isDateOnlyInstant("nope")).toBe(false);
  });
});

describe("formatInterviewWhen", () => {
  it("shows only the date for a date-only value, whatever the local zone", () => {
    const out = formatInterviewWhen(DATE_ONLY);
    expect(out).toContain("10");
    expect(out).toContain("Oct");
    expect(out).not.toMatch(/\d:\d\d/);
  });
  it("includes the time for a timed value", () => {
    expect(formatInterviewWhen(TIMED)).toMatch(/\d:\d\d/);
  });
  it("returns empty for garbage", () => {
    expect(formatInterviewWhen("nope")).toBe("");
  });
});

describe("isInterviewPast", () => {
  it("keeps a date-only invite live through its whole day", () => {
    expect(isInterviewPast(DATE_ONLY, new Date("2026-10-10T18:00:00Z"))).toBe(false);
    expect(isInterviewPast(DATE_ONLY, new Date("2026-10-11T00:00:00Z"))).toBe(true);
  });
  it("treats a timed invite as past once it starts", () => {
    expect(isInterviewPast(TIMED, new Date("2026-10-10T09:29:00Z"))).toBe(false);
    expect(isInterviewPast(TIMED, new Date("2026-10-10T09:30:00Z"))).toBe(true);
  });
  it("is false for an unparsable value", () => {
    expect(isInterviewPast("nope")).toBe(false);
  });
});

describe("date-only invite exports", () => {
  const job = { id: "m1", roleTitle: "Designer", companyName: "Acme" };
  it("exports an all-day .ics for a date-only value", () => {
    const ics = generateICS(inviteEvent({ ...job, interviewScheduledAt: DATE_ONLY })!);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261010");
    expect(ics).toContain("DTEND;VALUE=DATE:20261011");
  });
  it("keeps a timed .ics as UTC instants", () => {
    expect(generateICS(inviteEvent({ ...job, interviewScheduledAt: TIMED })!)).toContain("DTSTART:20261010T093000Z");
  });
});

describe("threadMessageFor with a date-only invite", () => {
  it("does not invent a clock time", () => {
    const msg = threadMessageFor("interview_invited", null, DATE_ONLY)!;
    expect(msg).toContain("Oct");
    expect(msg).not.toMatch(/\d:\d\d/);
  });
});
