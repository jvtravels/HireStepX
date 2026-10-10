import { describe, expect, it } from "vitest";
import {
  NOTIFICATION_TYPES, categoriesForAudience, dayGroupLabel, groupByDay, isInAppEnabled, sanitizePrefs,
  snoozeUntil, timeAgo, typesForAudience, visibleTo,
} from "../notifications/registry";

describe("notification registry", () => {
  it("scopes types by audience", () => {
    expect(visibleTo("strong_match_found", "candidate")).toBe(false);
    expect(visibleTo("strong_match_found", "employer")).toBe(true);
    expect(visibleTo("new_message", "candidate")).toBe(true);
    expect(visibleTo("new_message", "employer")).toBe(true);
    expect(typesForAudience("candidate")).not.toContain("unlock_confirmed");
  });

  it("derives categories per audience", () => {
    expect(categoriesForAudience("employer")).not.toContain("rewards");
    expect(categoriesForAudience("candidate")).toContain("rewards");
  });

  it("never lets preferences mute critical items", () => {
    const prefs = { inApp: { billing: false } };
    expect(isInAppEnabled(prefs, "payment_failed", "critical")).toBe(true);
    expect(isInAppEnabled(prefs, "payment_success", "normal")).toBe(false);
    expect(isInAppEnabled(prefs, "new_message", "normal")).toBe(true);
  });

  it("marks payment_failed critical", () => {
    expect(NOTIFICATION_TYPES.payment_failed.priority).toBe("critical");
  });

  it("sanitizes junk preferences", () => {
    expect(sanitizePrefs(null)).toEqual({ inApp: {} });
    expect(sanitizePrefs({ inApp: { billing: false, bogus: false, rewards: "no" } })).toEqual({ inApp: { billing: false } });
  });
});

describe("presentation helpers", () => {
  const now = new Date(2026, 9, 10, 15, 0, 0);
  it("labels days", () => {
    expect(dayGroupLabel(new Date(2026, 9, 10, 1).toISOString(), now)).toBe("Today");
    expect(dayGroupLabel(new Date(2026, 9, 9, 20).toISOString(), now)).toBe("Yesterday");
    expect(dayGroupLabel(new Date(2026, 9, 6).toISOString(), now)).toBe("This week");
    expect(dayGroupLabel(new Date(2026, 8, 1).toISOString(), now)).toBe("Earlier");
  });

  it("groups consecutive items by day label", () => {
    const items = [
      { id: "a", created_at: new Date(2026, 9, 10, 9).toISOString() },
      { id: "b", created_at: new Date(2026, 9, 10, 8).toISOString() },
      { id: "c", created_at: new Date(2026, 9, 9, 8).toISOString() },
    ];
    const groups = groupByDay(items, now);
    expect(groups.map((g) => [g.label, g.items.length])).toEqual([["Today", 2], ["Yesterday", 1]]);
  });

  it("formats relative time", () => {
    const t = Date.parse("2026-10-10T12:00:00Z");
    expect(timeAgo("2026-10-10T11:59:40Z", t)).toBe("now");
    expect(timeAgo("2026-10-10T11:30:00Z", t)).toBe("30m");
    expect(timeAgo("2026-10-10T09:00:00Z", t)).toBe("3h");
    expect(timeAgo("2026-10-08T12:00:00Z", t)).toBe("2d");
  });

  it("computes snooze targets", () => {
    expect(snoozeUntil("1h", now)?.getTime()).toBe(now.getTime() + 3_600_000);
    const tomorrow = snoozeUntil("tomorrow", now);
    expect(tomorrow?.getDate()).toBe(11);
    expect(tomorrow?.getHours()).toBe(9);
    expect(snoozeUntil("nope", now)).toBeNull();
  });
});
