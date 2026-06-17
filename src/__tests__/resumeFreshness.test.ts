import { describe, it, expect } from "vitest";
import {
  resumeAgeDays,
  freshnessBucket,
  computeResumeFreshness,
  parseDismissal,
  RESUME_FRESHNESS_MIN_DAYS,
  RESUME_FRESHNESS_REAPPEAR_DAYS,
} from "../resumeFreshness";

/* Fixed clock so day math is deterministic. */
const NOW = Date.parse("2026-06-17T12:00:00.000Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("resumeAgeDays", () => {
  it("returns null for missing / unparseable timestamps", () => {
    expect(resumeAgeDays(null, NOW)).toBeNull();
    expect(resumeAgeDays(undefined, NOW)).toBeNull();
    expect(resumeAgeDays("not-a-date", NOW)).toBeNull();
  });

  it("floors to whole days", () => {
    expect(resumeAgeDays(daysAgo(0), NOW)).toBe(0);
    expect(resumeAgeDays(daysAgo(29.9), NOW)).toBe(29);
    expect(resumeAgeDays(daysAgo(30), NOW)).toBe(30);
  });

  it("clamps future timestamps (clock skew) to 0", () => {
    expect(resumeAgeDays(new Date(NOW + 5 * 86_400_000).toISOString(), NOW)).toBe(0);
  });
});

describe("freshnessBucket", () => {
  it("buckets by the crossed threshold", () => {
    expect(freshnessBucket(0)).toBe(0);
    expect(freshnessBucket(29)).toBe(0);
    expect(freshnessBucket(30)).toBe(RESUME_FRESHNESS_MIN_DAYS);
    expect(freshnessBucket(59)).toBe(RESUME_FRESHNESS_MIN_DAYS);
    expect(freshnessBucket(60)).toBe(RESUME_FRESHNESS_REAPPEAR_DAYS);
    expect(freshnessBucket(120)).toBe(RESUME_FRESHNESS_REAPPEAR_DAYS);
  });
});

describe("computeResumeFreshness", () => {
  it("no parsedAt → never shows (graceful back-compat for old resumes)", () => {
    expect(computeResumeFreshness(null, NOW, null)).toEqual({ days: null, show: false, bucket: 0 });
  });

  it("fresh resume (< 30 days) → hidden", () => {
    const r = computeResumeFreshness(daysAgo(10), NOW, null);
    expect(r.show).toBe(false);
    expect(r.days).toBe(10);
  });

  it("≥ 30 days, not dismissed → shows", () => {
    const r = computeResumeFreshness(daysAgo(31), NOW, null);
    expect(r.show).toBe(true);
    expect(r.bucket).toBe(30);
  });

  it("dismissed at 30 → stays hidden through the 30-59 window", () => {
    const parsedAt = daysAgo(45);
    const dismissal = { parsedAt, bucket: 30 };
    expect(computeResumeFreshness(parsedAt, NOW, dismissal).show).toBe(false);
  });

  it("dismissed at 30 → REAPPEARS once age crosses 60", () => {
    const parsedAt = daysAgo(61);
    const dismissal = { parsedAt, bucket: 30 };
    const r = computeResumeFreshness(parsedAt, NOW, dismissal);
    expect(r.show).toBe(true);
    expect(r.bucket).toBe(60);
  });

  it("dismissed at 60 → stays hidden at 60+", () => {
    const parsedAt = daysAgo(70);
    expect(computeResumeFreshness(parsedAt, NOW, { parsedAt, bucket: 60 }).show).toBe(false);
  });

  it("a dismissal for a DIFFERENT resume (re-upload) does not suppress the new one", () => {
    const r = computeResumeFreshness(daysAgo(40), NOW, { parsedAt: daysAgo(400), bucket: 60 });
    expect(r.show).toBe(true);
  });
});

describe("parseDismissal", () => {
  it("parses a well-formed blob", () => {
    expect(parseDismissal('{"parsedAt":"2026-01-01T00:00:00.000Z","bucket":30}')).toEqual({
      parsedAt: "2026-01-01T00:00:00.000Z",
      bucket: 30,
    });
  });

  it("returns null for missing / corrupt / wrong-shape input", () => {
    expect(parseDismissal(null)).toBeNull();
    expect(parseDismissal("not json")).toBeNull();
    expect(parseDismissal('{"parsedAt":123,"bucket":"x"}')).toBeNull();
    expect(parseDismissal("{}")).toBeNull();
  });
});
