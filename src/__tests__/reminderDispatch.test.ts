import { describe, it, expect } from "vitest";
import {
  dueReminders,
  reminderKey,
  leadLabel,
  type ReminderEvent,
} from "../../server-handlers/_reminder-dispatch";

function ev(overrides: Partial<ReminderEvent>): ReminderEvent {
  return {
    id: "e1",
    user_id: "u1",
    title: "Amazon SDE",
    company: "Amazon",
    start_utc: "2026-07-01T09:00:00.000Z",
    timezone: "Asia/Kolkata",
    status: "upcoming",
    reminders: [{ channel: "email", minutesBefore: 1440 }],
    ...overrides,
  };
}

describe("reminderKey", () => {
  it("is the stable dedup key", () => {
    expect(reminderKey("e1", "email", 1440)).toBe("e1:email:1440");
  });
});

describe("leadLabel", () => {
  it("formats days, hours, and minutes", () => {
    expect(leadLabel(1440)).toBe("1 day");
    expect(leadLabel(2880)).toBe("2 days");
    expect(leadLabel(180)).toBe("3 hours");
    expect(leadLabel(60)).toBe("1 hour");
    expect(leadLabel(45)).toBe("45 minutes");
  });
});

describe("dueReminders", () => {
  it("fires a 1-day email reminder on the day-before scan", () => {
    // ~23h before the interview: the 1440m reminder fired ~1h ago.
    const due = dueReminders([ev({})], { now: "2026-06-30T10:00:00.000Z" });
    expect(due).toHaveLength(1);
    expect(due[0].key).toBe("e1:email:1440");
    expect(due[0].fireAt).toBe("2026-06-30T09:00:00.000Z");
  });

  it("does not fire when the lead time is still far in the future", () => {
    // 5 days out: the 1440m reminder fires in ~4 days, outside the lookahead.
    const due = dueReminders([ev({})], { now: "2026-06-26T09:00:00.000Z" });
    expect(due).toHaveLength(0);
  });

  it("skips reminders already in the sent log", () => {
    const due = dueReminders([ev({})], {
      now: "2026-06-30T10:00:00.000Z",
      sentKeys: new Set(["e1:email:1440"]),
    });
    expect(due).toHaveLength(0);
  });

  it("ignores short-lead reminders a daily cron can't serve", () => {
    const due = dueReminders([ev({ reminders: [{ channel: "email", minutesBefore: 30 }] })], {
      now: "2026-07-01T08:30:00.000Z",
    });
    expect(due).toHaveLength(0);
  });

  it("ignores non-email channels", () => {
    const due = dueReminders([ev({ reminders: [{ channel: "push", minutesBefore: 1440 }] })], {
      now: "2026-06-30T10:00:00.000Z",
    });
    expect(due).toHaveLength(0);
  });

  it("skips cancelled/completed and already-started events", () => {
    const cancelled = dueReminders([ev({ status: "cancelled" })], { now: "2026-06-30T10:00:00.000Z" });
    const started = dueReminders([ev({ start_utc: "2026-06-29T09:00:00.000Z" })], { now: "2026-06-30T10:00:00.000Z" });
    const noInstant = dueReminders([ev({ start_utc: null })], { now: "2026-06-30T10:00:00.000Z" });
    expect(cancelled).toHaveLength(0);
    expect(started).toHaveLength(0);
    expect(noInstant).toHaveLength(0);
  });

  it("still sends a reminder whose fire time slipped within the lookback window", () => {
    // The interview is ~20h out; the 1440m reminder fired ~4h ago. A daily scan
    // that missed the exact moment still catches it within the 25h lookback.
    const due = dueReminders([ev({})], { now: "2026-06-30T13:00:00.000Z" });
    expect(due).toHaveLength(1);
  });

  it("de-dupes multiple identical reminder configs on one event", () => {
    const due = dueReminders(
      [ev({ reminders: [{ channel: "email", minutesBefore: 1440 }, { channel: "email", minutesBefore: 1440 }] })],
      { now: "2026-06-30T10:00:00.000Z" },
    );
    expect(due).toHaveLength(1);
  });

  it("handles multiple distinct leads on one event independently", () => {
    const due = dueReminders(
      [ev({ reminders: [{ channel: "email", minutesBefore: 2880 }, { channel: "email", minutesBefore: 1440 }] })],
      { now: "2026-06-30T11:00:00.000Z" },
    );
    // The 1440m reminder fired 2h ago (in window); the 2880m fired 26h ago,
    // past the 25h lookback, so a prior scan would already have handled it.
    expect(due.map((d) => d.minutesBefore)).toEqual([1440]);
  });
});
