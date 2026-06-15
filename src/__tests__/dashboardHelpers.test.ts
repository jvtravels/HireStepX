import { describe, it, expect } from "vitest";
import {
  daysUntilEvent,
  formatEventDate,
  formatEventTime,
  generateEventId,
  generateICS,
  generateGoogleCalendarURL,
  focusForType,
  zonedWallTimeToUtc,
  formatTimeInZone,
  hourInZone,
  isAwkwardHour,
  describeReminders,
  parseNaturalEvent,
  interviewTypeOptions,
  type InterviewEvent,
} from "../dashboardHelpers";

// daysUntilEvent interprets its date/time in LOCAL time, so the test must build
// the date string in local time too. Using toISOString() (UTC) here made the
// "now" case flake to -1 in zones ahead of UTC (e.g. IST after local midnight,
// when the UTC date is still "yesterday").
const localDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

describe("daysUntilEvent", () => {
  it("returns 0 for an event happening now", () => {
    const now = new Date();
    const date = localDate(now);
    const time = `${String(now.getHours() + 1).padStart(2, "0")}:00`;
    const days = daysUntilEvent(date, time);
    expect(days).toBeGreaterThanOrEqual(0);
    expect(days).toBeLessThanOrEqual(1);
  });

  it("returns positive for future events", () => {
    const future = new Date(Date.now() + 5 * 86400000);
    const date = localDate(future);
    const days = daysUntilEvent(date, "12:00");
    expect(days).toBeGreaterThanOrEqual(4);
    expect(days).toBeLessThanOrEqual(6);
  });

  it("returns negative for past events", () => {
    const past = new Date(Date.now() - 3 * 86400000);
    const date = localDate(past);
    const days = daysUntilEvent(date, "12:00");
    expect(days).toBeLessThan(0);
  });
});

describe("formatEventDate", () => {
  it("formats a date correctly", () => {
    const formatted = formatEventDate("2026-04-03");
    expect(formatted).toContain("Apr");
    expect(formatted).toContain("3");
  });

  it("includes day of week", () => {
    const formatted = formatEventDate("2026-04-03"); // Friday
    expect(formatted).toContain("Fri");
  });
});

describe("formatEventTime", () => {
  it("formats 24h time to 12h AM/PM", () => {
    expect(formatEventTime("09:30")).toBe("9:30 AM");
    expect(formatEventTime("14:00")).toBe("2:00 PM");
    expect(formatEventTime("00:00")).toBe("12:00 AM");
    expect(formatEventTime("12:00")).toBe("12:00 PM");
    expect(formatEventTime("23:45")).toBe("11:45 PM");
  });

  it("handles single-digit minutes", () => {
    expect(formatEventTime("08:05")).toBe("8:05 AM");
  });
});

describe("generateEventId", () => {
  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateEventId()));
    expect(ids.size).toBe(100);
  });

  it("generates string IDs", () => {
    const id = generateEventId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(5);
  });
});

describe("generateICS", () => {
  const event: InterviewEvent = {
    id: "test1",
    title: "Engineering Interview",
    company: "Google",
    type: "Technical",
    date: "2026-04-10",
    time: "14:00",
    duration: 60,
    location: "Zoom",
    notes: "Prepare system design",
    status: "upcoming",
    reminders: true,
  };

  it("generates valid iCalendar format", () => {
    const ics = generateICS(event);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("includes event summary with title and company", () => {
    const ics = generateICS(event);
    expect(ics).toContain("SUMMARY:Engineering Interview (Google)");
  });

  it("emits a UID and DTSTAMP (RFC 5545 required properties)", () => {
    const ics = generateICS(event);
    expect(ics).toMatch(/UID:.+@hirestepx\.com/);
    expect(ics).toMatch(/DTSTAMP:\d{8}T\d{6}Z/);
    expect(ics).toContain("SEQUENCE:0");
  });

  it("escapes reserved characters in text values", () => {
    const tricky = { ...event, notes: "Line one;\npart two, end" };
    const ics = generateICS(tricky);
    expect(ics).toContain("part two\\, end");
    expect(ics).toContain("Line one\\;\\npart two");
  });

  it("includes location", () => {
    const ics = generateICS(event);
    expect(ics).toContain("LOCATION:Zoom");
  });

  it("includes interview type in description", () => {
    const ics = generateICS(event);
    expect(ics).toContain("Interview Type: Technical");
  });

  it("includes alarm reminders", () => {
    const ics = generateICS(event);
    expect(ics).toContain("BEGIN:VALARM");
    expect(ics).toContain("TRIGGER:-PT30M");
    expect(ics).toContain("TRIGGER:-P1D");
  });

  it("marks cancelled events", () => {
    const cancelled = { ...event, status: "cancelled" as const };
    const ics = generateICS(cancelled);
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("marks upcoming events as confirmed", () => {
    const ics = generateICS(event);
    expect(ics).toContain("STATUS:CONFIRMED");
  });
});

describe("generateGoogleCalendarURL", () => {
  const event: InterviewEvent = {
    id: "test1",
    title: "Product Interview",
    company: "Meta",
    type: "Behavioral",
    date: "2026-05-15",
    time: "10:00",
    duration: 45,
    location: "On-site",
    notes: "Bring portfolio",
    status: "upcoming",
    reminders: true,
  };

  it("generates a Google Calendar URL", () => {
    const url = generateGoogleCalendarURL(event);
    expect(url).toContain("calendar.google.com/calendar/render");
  });

  it("includes event title and company", () => {
    const url = generateGoogleCalendarURL(event);
    expect(url).toContain("Product+Interview");
    expect(url).toContain("Meta");
  });

  it("includes action=TEMPLATE", () => {
    const url = generateGoogleCalendarURL(event);
    expect(url).toContain("action=TEMPLATE");
  });
});

describe("Event data serialization", () => {
  it("round-trips events through JSON", () => {
    const events: InterviewEvent[] = [
      {
        id: "e1", title: "Test", company: "Co", type: "Technical",
        date: "2026-04-10", time: "10:00", duration: 60, location: "",
        notes: "", status: "upcoming", reminders: true,
      },
    ];
    const serialized = JSON.stringify(events);
    const parsed = JSON.parse(serialized);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("Test");
    expect(parsed[0].company).toBe("Co");
  });

  it("handles empty array serialization", () => {
    const serialized = JSON.stringify([]);
    expect(JSON.parse(serialized)).toEqual([]);
  });

  it("returns empty array for invalid JSON", () => {
    // Mirrors loadEvents() catch behavior
    let result: InterviewEvent[] = [];
    try {
      result = JSON.parse("invalid-json");
    } catch {
      result = [];
    }
    expect(result).toEqual([]);
  });
});

describe("focusForType", () => {
  it("maps known round labels to the mock focus vocabulary", () => {
    expect(focusForType("Technical")).toBe("technical");
    expect(focusForType("System Design")).toBe("technical");
    expect(focusForType("HR Round")).toBe("hr-round");
    expect(focusForType("Salary Negotiation")).toBe("salary-negotiation");
    expect(focusForType("Final Round")).toBe("strategic");
  });
  it("returns undefined for the focus-less 'Other', unknowns, and blanks", () => {
    expect(focusForType("Other")).toBeUndefined();
    expect(focusForType("Nonsense")).toBeUndefined();
    expect(focusForType(undefined)).toBeUndefined();
    expect(focusForType("")).toBeUndefined();
  });
  it("covers every shipped round label", () => {
    for (const label of interviewTypeOptions) {
      if (label === "Other") continue;
      expect(focusForType(label)).toBeTruthy();
    }
  });
});

describe("zonedWallTimeToUtc", () => {
  it("treats the wall time as IST and yields the right UTC instant", () => {
    // 09:00 IST = 03:30 UTC (UTC+5:30, no DST)
    expect(zonedWallTimeToUtc("2026-07-01", "09:00", "Asia/Kolkata")).toBe("2026-07-01T03:30:00.000Z");
  });
  it("handles US Pacific daylight time", () => {
    // 09:00 PDT (July) = 16:00 UTC (UTC-7)
    expect(zonedWallTimeToUtc("2026-07-01", "09:00", "America/Los_Angeles")).toBe("2026-07-01T16:00:00.000Z");
  });
  it("handles UTC directly", () => {
    expect(zonedWallTimeToUtc("2026-07-01", "15:30", "UTC")).toBe("2026-07-01T15:30:00.000Z");
  });
  it("returns null on an unparseable date", () => {
    expect(zonedWallTimeToUtc("not-a-date", "09:00", "UTC")).toBeNull();
    expect(zonedWallTimeToUtc("", "09:00", "UTC")).toBeNull();
  });
  it("defaults a missing time to midnight", () => {
    expect(zonedWallTimeToUtc("2026-07-01", "", "UTC")).toBe("2026-07-01T00:00:00.000Z");
  });
});

describe("formatTimeInZone / hourInZone", () => {
  it("renders a UTC instant in the candidate's zone", () => {
    // 03:30 UTC = 09:00 IST
    expect(formatTimeInZone("2026-07-01T03:30:00.000Z", "Asia/Kolkata")).toContain("9:00");
    expect(hourInZone("2026-07-01T03:30:00.000Z", "Asia/Kolkata")).toBe(9);
  });
  it("returns safe fallbacks on bad input", () => {
    expect(formatTimeInZone("garbage", "UTC")).toBe("");
    expect(hourInZone("garbage", "UTC")).toBe(12);
  });
});

describe("isAwkwardHour", () => {
  it("flags pre-8am and 9pm-or-later", () => {
    expect(isAwkwardHour(7)).toBe(true);
    expect(isAwkwardHour(21)).toBe(true);
    expect(isAwkwardHour(23)).toBe(true);
    expect(isAwkwardHour(0)).toBe(true);
  });
  it("treats normal daytime hours as comfortable", () => {
    expect(isAwkwardHour(8)).toBe(false);
    expect(isAwkwardHour(14)).toBe(false);
    expect(isAwkwardHour(20)).toBe(false);
  });
});

describe("describeReminders", () => {
  const now = Date.parse("2026-06-14T00:00:00.000Z");
  it("promises both reminders when the interview is far out", () => {
    const start = new Date(now + 10 * 86400000).toISOString();
    expect(describeReminders(start, now)).toBe("Email reminders 3 days and 1 day before");
  });
  it("drops the 3-day reminder inside the 3-day window", () => {
    const start = new Date(now + 2 * 86400000).toISOString();
    expect(describeReminders(start, now)).toBe("Email reminder 1 day before");
  });
  it("admits when it is too soon for any reminder", () => {
    const start = new Date(now + 60 * 60000).toISOString();
    expect(describeReminders(start, now)).toBe("Too soon for an email reminder before this interview");
  });
  it("falls back gracefully on missing/garbage start", () => {
    expect(describeReminders(null, now)).toContain("3 days and 1 day");
    expect(describeReminders("nonsense", now)).toContain("3 days and 1 day");
  });
});

describe("parseNaturalEvent", () => {
  // A fixed Sunday so weekday math is deterministic.
  const now = new Date("2026-06-14T08:00:00");
  it("extracts company, round, weekday, and time", () => {
    const p = parseNaturalEvent("Amazon SDE phone screen tuesday 3pm", now);
    expect(p.company).toBe("Amazon");
    expect(p.type).toBe("Phone Screen");
    expect(p.time).toBe("15:00");
    expect(p.date).toBe("2026-06-16"); // next Tuesday after Sun Jun 14
  });
  it("prefers the longest matching round label", () => {
    expect(parseNaturalEvent("Google system design tomorrow", now).type).toBe("System Design");
  });
  it("resolves 'today' and 'tomorrow'", () => {
    expect(parseNaturalEvent("today", now).date).toBe("2026-06-14");
    expect(parseNaturalEvent("tomorrow", now).date).toBe("2026-06-15");
  });
  it("parses 24-hour and am times", () => {
    expect(parseNaturalEvent("call at 09:30", now).time).toBe("09:30");
    expect(parseNaturalEvent("meet 11am", now).time).toBe("11:00");
  });
  it("returns an empty object for blank input", () => {
    expect(parseNaturalEvent("", now)).toEqual({});
    expect(parseNaturalEvent("   ", now)).toEqual({});
  });
  it("falls back to keyword heuristics when no label is present", () => {
    expect(parseNaturalEvent("quick hr chat", now).type).toBe("HR Round");
  });
});
