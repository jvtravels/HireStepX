import { describe, it, expect } from "vitest";
import {
  asString,
  clampDuration,
  sanitizeTimezone,
  parseInstant,
  normalizeReminders,
  deriveTimes,
  normalizeCalendarEvent,
  DEFAULT_REMINDERS,
} from "../../server-handlers/_calendar-helpers";

const ctx = { userId: "user-123", id: "evt-1", updatedAt: "2026-06-13T00:00:00.000Z" };

describe("asString", () => {
  it("trims and caps length", () => {
    expect(asString("  hi  ")).toBe("hi");
    expect(asString("abcdef", 3)).toBe("abc");
  });
  it("returns empty for non-strings", () => {
    expect(asString(42)).toBe("");
    expect(asString(null)).toBe("");
  });
});

describe("clampDuration", () => {
  it("defaults non-numbers to 60", () => {
    expect(clampDuration("x")).toBe(60);
    expect(clampDuration(undefined)).toBe(60);
    expect(clampDuration(NaN)).toBe(60);
  });
  it("clamps to [5, 1440]", () => {
    expect(clampDuration(1)).toBe(5);
    expect(clampDuration(99999)).toBe(1440);
    expect(clampDuration(45.6)).toBe(46);
  });
});

describe("sanitizeTimezone", () => {
  it("accepts plausible IANA zones", () => {
    expect(sanitizeTimezone("America/Los_Angeles")).toBe("America/Los_Angeles");
    expect(sanitizeTimezone("Asia/Kolkata")).toBe("Asia/Kolkata");
    expect(sanitizeTimezone("UTC")).toBe("UTC");
  });
  it("defaults garbage to Asia/Kolkata", () => {
    expect(sanitizeTimezone("not a zone")).toBe("Asia/Kolkata");
    expect(sanitizeTimezone(123)).toBe("Asia/Kolkata");
    expect(sanitizeTimezone("'; drop table")).toBe("Asia/Kolkata");
  });
});

describe("parseInstant", () => {
  it("normalizes valid ISO strings", () => {
    expect(parseInstant("2026-06-13T10:00:00Z")).toBe("2026-06-13T10:00:00.000Z");
  });
  it("rejects invalid input", () => {
    expect(parseInstant("garbage")).toBeNull();
    expect(parseInstant("")).toBeNull();
    expect(parseInstant(42)).toBeNull();
  });
});

describe("normalizeReminders", () => {
  it("expands the legacy boolean true to the default ladder", () => {
    expect(normalizeReminders(true)).toEqual(DEFAULT_REMINDERS);
  });
  it("returns empty for false/null/non-array", () => {
    expect(normalizeReminders(false)).toEqual([]);
    expect(normalizeReminders(null)).toEqual([]);
    expect(normalizeReminders("x")).toEqual([]);
  });
  it("validates, clamps, and de-dupes array entries", () => {
    const out = normalizeReminders([
      { channel: "email", minutesBefore: 30 },
      { channel: "email", minutesBefore: 30 }, // dupe
      { channel: "push", minutesBefore: 999999 }, // clamp
      { channel: "sms", minutesBefore: 10 }, // bad channel
      { channel: "push" }, // missing minutes
    ]);
    expect(out).toEqual([
      { channel: "email", minutesBefore: 30 },
      { channel: "push", minutesBefore: 10080 },
    ]);
  });
  it("caps at 6 reminders", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ channel: "email" as const, minutesBefore: i + 1 }));
    expect(normalizeReminders(many).length).toBe(6);
  });
});

describe("deriveTimes", () => {
  it("prefers an explicit start_utc and derives end from duration", () => {
    const { start_utc, end_utc } = deriveTimes({ start_utc: "2026-06-13T10:00:00Z" }, 90);
    expect(start_utc).toBe("2026-06-13T10:00:00.000Z");
    expect(end_utc).toBe("2026-06-13T11:30:00.000Z");
  });
  it("composes legacy date+time when no start_utc", () => {
    const { start_utc, end_utc } = deriveTimes({ date: "2026-06-13", time: "09:00" }, 60);
    expect(start_utc).toBe("2026-06-13T09:00:00.000Z");
    expect(end_utc).toBe("2026-06-13T10:00:00.000Z");
  });
  it("honors an explicit end_utc after start", () => {
    const { end_utc } = deriveTimes(
      { start_utc: "2026-06-13T10:00:00Z", end_utc: "2026-06-13T12:00:00Z" },
      30,
    );
    expect(end_utc).toBe("2026-06-13T12:00:00.000Z");
  });
  it("ignores an end_utc that precedes start and falls back to duration", () => {
    const { end_utc } = deriveTimes(
      { start_utc: "2026-06-13T10:00:00Z", end_utc: "2026-06-13T09:00:00Z" },
      30,
    );
    expect(end_utc).toBe("2026-06-13T10:30:00.000Z");
  });
  it("returns nulls with neither date nor start", () => {
    expect(deriveTimes({}, 60)).toEqual({ start_utc: null, end_utc: null });
  });
});

describe("normalizeCalendarEvent", () => {
  it("rejects a missing title", () => {
    const r = normalizeCalendarEvent({ date: "2026-06-13" }, ctx);
    expect(r.ok).toBe(false);
  });
  it("rejects when neither date nor start_utc present", () => {
    const r = normalizeCalendarEvent({ title: "Amazon SDE" }, ctx);
    expect(r.ok).toBe(false);
  });
  it("builds a clean row with server-supplied id/user/updatedAt", () => {
    const r = normalizeCalendarEvent(
      { title: "Amazon SDE phone screen", company: "Amazon", start_utc: "2026-06-20T14:30:00Z", duration: 45, reminders: true },
      ctx,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.id).toBe("evt-1");
    expect(r.row.user_id).toBe("user-123");
    expect(r.row.updated_at).toBe(ctx.updatedAt);
    expect(r.row.title).toBe("Amazon SDE phone screen");
    expect(r.row.duration_minutes).toBe(45);
    expect(r.row.end_utc).toBe("2026-06-20T15:15:00.000Z");
    expect(r.row.kind).toBe("real");
    expect(r.row.status).toBe("upcoming");
    expect(r.row.source).toBe("manual");
    expect(r.row.reminders).toEqual(DEFAULT_REMINDERS);
    // date back-filled from start_utc
    expect(r.row.date).toBe("2026-06-20");
  });
  it("defaults invalid enums to safe values", () => {
    const r = normalizeCalendarEvent(
      { title: "x", date: "2026-06-13", kind: "bogus", status: "weird", source: "evil" },
      ctx,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.row.kind).toBe("real");
    expect(r.row.status).toBe("upcoming");
    expect(r.row.source).toBe("manual");
  });
  it("only keeps parent_interview_id for prep-session rows", () => {
    const real = normalizeCalendarEvent(
      { title: "x", date: "2026-06-13", kind: "real", parent_interview_id: "p1" },
      ctx,
    );
    const prep = normalizeCalendarEvent(
      { title: "x", date: "2026-06-13", kind: "prep-session", parent_interview_id: "p1" },
      ctx,
    );
    expect(real.ok && real.row.parent_interview_id).toBe(null);
    expect(prep.ok && prep.row.parent_interview_id).toBe("p1");
  });
});
