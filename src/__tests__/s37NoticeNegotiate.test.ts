import { describe, it, expect } from "vitest";
import { extractNoticeJoining as parseNoticeJoining } from "../../server-handlers/_notice-joining";

describe("S37-B1 notice period negotiate keyword", () => {
  it("'can negotiate to 60 days' sets earlyJoinPreferred", () => {
    const r = parseNoticeJoining("I have a 90-day notice period but can negotiate to 60 days");
    expect(r.noticePeriodDays).toBe(90);
    expect(r.earlyJoinPreferred).toBe(true);
  });

  it("'negotiate my notice' sets earlyJoinPreferred", () => {
    const r = parseNoticeJoining("I can negotiate my notice period if needed");
    expect(r.earlyJoinPreferred).toBe(true);
  });

  it("'negotiate the notice period' sets earlyJoinPreferred", () => {
    const r = parseNoticeJoining("I'm open to negotiate the notice period with my current employer");
    expect(r.earlyJoinPreferred).toBe(true);
  });

  it("existing: 'reduce notice' still works", () => {
    const r = parseNoticeJoining("I can reduce my notice by 30 days");
    expect(r.earlyJoinPreferred).toBe(true);
  });

  it("plain 90-day notice without flexibility — earlyJoinPreferred false", () => {
    const r = parseNoticeJoining("I have a 90-day notice period");
    expect(r.noticePeriodDays).toBe(90);
    expect(r.earlyJoinPreferred).toBe(false);
  });
});
