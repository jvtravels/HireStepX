/**
 * Tests for the time-of-day / day-of-week mood overlay
 * (server-handlers/_recruiter-time-context.ts).
 *
 * IST = UTC+5:30, so all anchor timestamps below are expressed in UTC and
 * the IST clock offset is folded into the chosen UTC hour.
 */

import { describe, it, expect, afterEach } from "vitest";
import {
  deriveTimeContext,
  timeContextToMoodDelta,
  timeContextPrefix,
  type TimeContext,
} from "../../server-handlers/_recruiter-time-context";

// --- IST anchor timestamps -------------------------------------------------
// 2026-05-29 is a Friday (matches the product's current date), so we build
// the rest of the cases off the same calendar week for clarity.
const FRIDAY_5PM_IST = "2026-05-29T11:30:00Z"; // Fri 17:00 IST -> friday-rush
const MONDAY_11AM_IST = "2026-06-01T05:30:00Z"; // Mon 11:00 IST -> monday-fresh
const TUESDAY_1PM_IST = "2026-06-02T07:30:00Z"; // Tue 13:00 IST -> lunch-distracted
const WEDNESDAY_9PM_IST = "2026-06-03T15:30:00Z"; // Wed 21:00 IST -> after-hours-tired
const SATURDAY_NOON_IST = "2026-05-30T06:30:00Z"; // Sat 12:00 IST -> weekend-unusual
const WEDNESDAY_11AM_IST = "2026-06-03T05:30:00Z"; // Wed 11:00 IST -> midweek-standard

describe("deriveTimeContext", () => {
  it("classifies Friday 5pm IST as friday-rush", () => {
    expect(deriveTimeContext({ callTimeIso: FRIDAY_5PM_IST })).toBe("friday-rush");
  });

  it("classifies Monday 11am IST as monday-fresh", () => {
    expect(deriveTimeContext({ callTimeIso: MONDAY_11AM_IST })).toBe("monday-fresh");
  });

  it("classifies Tuesday 1pm IST as lunch-distracted (overrides everything in the lunch window)", () => {
    expect(deriveTimeContext({ callTimeIso: TUESDAY_1PM_IST })).toBe("lunch-distracted");
  });

  it("classifies Wednesday 9pm IST as after-hours-tired", () => {
    expect(deriveTimeContext({ callTimeIso: WEDNESDAY_9PM_IST })).toBe("after-hours-tired");
  });

  it("classifies Saturday noon IST as weekend-unusual", () => {
    expect(deriveTimeContext({ callTimeIso: SATURDAY_NOON_IST })).toBe("weekend-unusual");
  });

  it("classifies Wednesday 11am IST as midweek-standard", () => {
    expect(deriveTimeContext({ callTimeIso: WEDNESDAY_11AM_IST })).toBe("midweek-standard");
  });

  it("falls back to midweek-standard when callTimeIso is undefined", () => {
    expect(deriveTimeContext({})).toBe("midweek-standard");
  });

  it("falls back to midweek-standard for an invalid ISO string", () => {
    expect(deriveTimeContext({ callTimeIso: "not-a-date" })).toBe("midweek-standard");
  });

  it("lunch window beats Monday-fresh window when they overlap (Monday 1pm IST)", () => {
    // Monday 13:00 IST -> 07:30 UTC same day
    const mondayLunch = "2026-06-01T07:30:00Z";
    expect(deriveTimeContext({ callTimeIso: mondayLunch })).toBe("lunch-distracted");
  });
});

describe("timeContextToMoodDelta", () => {
  it("friday-rush is impatient and concession-stingy", () => {
    const d = timeContextToMoodDelta("friday-rush");
    expect(d.patience).toBeLessThan(0);
    expect(d.concessionHeadroom).toBeLessThan(1);
    expect(d.replyLengthBias).toBe("short");
  });

  it("monday-fresh is patient and concession-generous", () => {
    const d = timeContextToMoodDelta("monday-fresh");
    expect(d.patience).toBeGreaterThan(0);
    expect(d.concessionHeadroom).toBeGreaterThan(1);
    expect(d.replyLengthBias).toBe("long");
  });

  it("midweek-standard is neutral baseline", () => {
    const d = timeContextToMoodDelta("midweek-standard");
    expect(d.patience).toBe(0);
    expect(d.concessionHeadroom).toBe(1.0);
    expect(d.replyLengthBias).toBe("neutral");
  });

  it("lunch-distracted is mildly impatient and short", () => {
    const d = timeContextToMoodDelta("lunch-distracted");
    expect(d.patience).toBeLessThan(0);
    expect(d.replyLengthBias).toBe("short");
  });

  it("after-hours-tired is tired and terse", () => {
    const d = timeContextToMoodDelta("after-hours-tired");
    expect(d.patience).toBeLessThan(0);
    expect(d.concessionHeadroom).toBeLessThan(1);
    expect(d.replyLengthBias).toBe("short");
  });

  it("all deltas stay within the documented 0.7..1.2 headroom band", () => {
    const ctxs: TimeContext[] = [
      "monday-fresh",
      "midweek-standard",
      "friday-rush",
      "lunch-distracted",
      "after-hours-tired",
      "weekend-unusual",
    ];
    for (const c of ctxs) {
      const d = timeContextToMoodDelta(c);
      expect(d.concessionHeadroom).toBeGreaterThanOrEqual(0.7);
      expect(d.concessionHeadroom).toBeLessThanOrEqual(1.2);
      expect(d.patience).toBeGreaterThanOrEqual(-2);
      expect(d.patience).toBeLessThanOrEqual(2);
    }
  });
});

describe("timeContextPrefix", () => {
  it("returns the friday-rush prefix on a bare opener", () => {
    expect(timeContextPrefix("friday-rush", "thanks for jumping on")).toBe(
      "Quick one before EOD — "
    );
  });

  it("returns the monday-fresh prefix on a bare opener", () => {
    expect(timeContextPrefix("monday-fresh", "thanks for jumping on")).toBe(
      "Got a fresh slot this morning, so — "
    );
  });

  it("returns the lunch-distracted prefix on a bare opener", () => {
    expect(timeContextPrefix("lunch-distracted", "thanks for jumping on")).toBe(
      "Just stepped out for a minute, but — "
    );
  });

  it("returns the after-hours-tired prefix on a bare opener", () => {
    expect(timeContextPrefix("after-hours-tired", "thanks for jumping on")).toBe(
      "Late one on my side, so — "
    );
  });

  it("returns null for midweek-standard", () => {
    expect(timeContextPrefix("midweek-standard", "thanks for jumping on")).toBeNull();
  });

  it("returns null for weekend-unusual (no opener prefix bank)", () => {
    expect(timeContextPrefix("weekend-unusual", "thanks for jumping on")).toBeNull();
  });

  it("is idempotent: calling twice on already-prefixed text returns null", () => {
    const base = "thanks for jumping on";
    const prefix = timeContextPrefix("friday-rush", base)!;
    expect(prefix).not.toBeNull();
    const prefixed = prefix + base;
    expect(timeContextPrefix("friday-rush", prefixed)).toBeNull();
  });

  it("idempotency holds across contexts — a monday prefix blocks adding a friday prefix", () => {
    const base = "thanks for jumping on";
    const mondayPrefixed = timeContextPrefix("monday-fresh", base)! + base;
    expect(timeContextPrefix("friday-rush", mondayPrefixed)).toBeNull();
  });
});

describe("TZ-independence", () => {
  const ORIGINAL_TZ = process.env.TZ;

  afterEach(() => {
    if (ORIGINAL_TZ === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = ORIGINAL_TZ;
    }
  });

  it("returns the same answer when process.env.TZ is UTC", () => {
    process.env.TZ = "UTC";
    expect(deriveTimeContext({ callTimeIso: FRIDAY_5PM_IST })).toBe("friday-rush");
    expect(deriveTimeContext({ callTimeIso: WEDNESDAY_11AM_IST })).toBe("midweek-standard");
    expect(deriveTimeContext({ callTimeIso: SATURDAY_NOON_IST })).toBe("weekend-unusual");
  });

  it("returns the same answer when process.env.TZ is PST (America/Los_Angeles)", () => {
    process.env.TZ = "America/Los_Angeles";
    expect(deriveTimeContext({ callTimeIso: FRIDAY_5PM_IST })).toBe("friday-rush");
    expect(deriveTimeContext({ callTimeIso: WEDNESDAY_11AM_IST })).toBe("midweek-standard");
    expect(deriveTimeContext({ callTimeIso: SATURDAY_NOON_IST })).toBe("weekend-unusual");
  });
});
