import { describe, it, expect } from "vitest";
import {
  redactForAnalytics,
  SPECIAL_PERSONAL_DATA_FLAGS,
} from "../../server-handlers/_candidate-profile";

describe("redactForAnalytics — DPDP-sensitive key sweep", () => {
  it("returns primitives unchanged", () => {
    expect(redactForAnalytics(null)).toBe(null);
    expect(redactForAnalytics(42)).toBe(42);
    expect(redactForAnalytics("hello")).toBe("hello");
    expect(redactForAnalytics(true)).toBe(true);
  });

  it("zeros every SPECIAL_PERSONAL_DATA_FLAGS key at the top level", () => {
    const payload: Record<string, unknown> = { keepMe: 7 };
    for (const k of SPECIAL_PERSONAL_DATA_FLAGS) {
      payload[k as string] = true;
    }
    const out = redactForAnalytics(payload) as Record<string, unknown>;
    expect(out.keepMe).toBe(7);
    for (const k of SPECIAL_PERSONAL_DATA_FLAGS) {
      expect(out[k as string]).toBe(false);
    }
  });

  it("walks nested objects", () => {
    const payload = {
      session: { id: "s1", profile: { pipDisclosed: true, careerGapMonths: 6 } },
    };
    const out = redactForAnalytics(payload) as {
      session: { id: string; profile: { pipDisclosed: boolean; careerGapMonths: number } };
    };
    expect(out.session.id).toBe("s1");
    expect(out.session.profile.pipDisclosed).toBe(false);
    expect(out.session.profile.careerGapMonths).toBe(6);
  });

  it("walks arrays", () => {
    const payload = {
      events: [
        { kind: "turn", pregnancyDisclosed: true, note: "ok" },
        { kind: "turn", casteReservationContext: true, note: "ok2" },
      ],
    };
    const out = redactForAnalytics(payload) as { events: Array<Record<string, unknown>> };
    expect(out.events[0].pregnancyDisclosed).toBe(false);
    expect(out.events[0].note).toBe("ok");
    expect(out.events[1].casteReservationContext).toBe(false);
  });

  it("does not mutate the input", () => {
    const payload = { pipDisclosed: true, x: 1 };
    redactForAnalytics(payload);
    expect(payload.pipDisclosed).toBe(true);
  });

  it("handles empty object", () => {
    expect(redactForAnalytics({})).toEqual({});
  });

  it("preserves non-sensitive keys verbatim", () => {
    const payload = { role: "swe", company: "Acme", careerGapMonths: 12 };
    expect(redactForAnalytics(payload)).toEqual(payload);
  });

  it("zeros nested sensitive flag inside an array of objects", () => {
    const payload = [{ lgbtqDisclosure: true }, { paternityLeaveAsk: true }];
    const out = redactForAnalytics(payload) as Array<Record<string, unknown>>;
    expect(out[0].lgbtqDisclosure).toBe(false);
    expect(out[1].paternityLeaveAsk).toBe(false);
  });
});
