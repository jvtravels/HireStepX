import { describe, it, expect } from "vitest";
import {
  extractNoticeJoining,
  mergeNoticeJoining,
} from "../../server-handlers/_notice-joining";

describe("extractNoticeJoining — notice period", () => {
  it("extracts '60 day notice'", () => {
    const r = extractNoticeJoining("I have a 60 day notice");
    expect(r.noticePeriodDays).toBe(60);
  });

  it("extracts '90-day notice'", () => {
    const r = extractNoticeJoining("My 90-day notice period applies");
    expect(r.noticePeriodDays).toBe(90);
  });

  it("converts '2 months notice' to 60 days", () => {
    const r = extractNoticeJoining("I'm serving 2 months notice");
    expect(r.noticePeriodDays).toBe(60);
  });

  it("normalizes 'ninety day notice' to 90", () => {
    const r = extractNoticeJoining("I have ninety day notice");
    expect(r.noticePeriodDays).toBe(90);
  });

  it("handles 'notice period is 30 days'", () => {
    const r = extractNoticeJoining("notice period is 30 days");
    expect(r.noticePeriodDays).toBe(30);
  });

  it("rejects out-of-range notice (500 days)", () => {
    const r = extractNoticeJoining("notice is 500 days");
    expect(r.noticePeriodDays).toBe(null);
  });
});

describe("extractNoticeJoining — buyout", () => {
  it("detects 'buy out my notice'", () => {
    const r = extractNoticeJoining("can you buy out my notice?");
    expect(r.buyoutRequested).toBe(true);
  });

  it("detects 'buyout'", () => {
    const r = extractNoticeJoining("offering a buyout");
    expect(r.buyoutRequested).toBe(true);
  });

  it("is false when unrelated text", () => {
    expect(extractNoticeJoining("hello").buyoutRequested).toBe(false);
  });
});

describe("extractNoticeJoining — joining bonus", () => {
  it("extracts '5 LPA joining bonus'", () => {
    const r = extractNoticeJoining("I'd want a joining bonus of 5 LPA");
    expect(r.joiningBonusAsk).toBe(5);
  });

  it("extracts 'sign-on bonus 3 LPA'", () => {
    const r = extractNoticeJoining("sign-on bonus 3 LPA please");
    expect(r.joiningBonusAsk).toBe(3);
  });

  it("extracts reverse phrasing '5L joining bonus'", () => {
    const r = extractNoticeJoining("₹5L joining bonus would help");
    expect(r.joiningBonusAsk).toBe(5);
  });

  it("rejects too-large bonus", () => {
    const r = extractNoticeJoining("joining bonus of 500 LPA");
    expect(r.joiningBonusAsk).toBe(null);
  });
});

describe("extractNoticeJoining — early join", () => {
  it("detects 'join earlier'", () => {
    const r = extractNoticeJoining("can I join earlier?");
    expect(r.earlyJoinPreferred).toBe(true);
  });

  it("detects 'reduce my notice'", () => {
    const r = extractNoticeJoining("I want to reduce my notice");
    expect(r.earlyJoinPreferred).toBe(true);
  });
});

describe("extractNoticeJoining — empty/hasAny", () => {
  it("returns hasAny=false on empty", () => {
    expect(extractNoticeJoining("").hasAny).toBe(false);
  });

  it("sets hasAny=true when any field set", () => {
    expect(extractNoticeJoining("60 day notice").hasAny).toBe(true);
  });
});

describe("mergeNoticeJoining", () => {
  it("non-null fields overwrite prior", () => {
    const prior = extractNoticeJoining("30 day notice");
    const next = extractNoticeJoining("60 day notice");
    expect(mergeNoticeJoining(prior, next).noticePeriodDays).toBe(60);
  });

  it("null fields preserve prior", () => {
    const prior = extractNoticeJoining("60 day notice");
    const next = extractNoticeJoining("buyout please");
    const m = mergeNoticeJoining(prior, next);
    expect(m.noticePeriodDays).toBe(60);
    expect(m.buyoutRequested).toBe(true);
  });

  it("booleans monotone-up", () => {
    const prior = extractNoticeJoining("buyout please");
    const next = extractNoticeJoining("hello");
    expect(mergeNoticeJoining(prior, next).buyoutRequested).toBe(true);
  });

  it("handles null prior", () => {
    const next = extractNoticeJoining("60 day notice");
    expect(mergeNoticeJoining(null, next).noticePeriodDays).toBe(60);
  });
});
