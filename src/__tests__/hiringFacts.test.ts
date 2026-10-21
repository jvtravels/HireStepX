import { describe, it, expect } from "vitest";
import { carryHiringFacts, factsChanged, readHiringFacts, withHiringFacts, EMPTY_FACTS } from "../hiringFacts";
import type { StoredResume } from "../resumeParser";
import { extractResumeDetail } from "../../server-handlers/_resume-detail-helpers";

const ai = (extra: Record<string, unknown> = {}) => ({ _type: "ai", name: "A", ...extra }) as never as StoredResume;

describe("hiringFacts", () => {
  it("reads nothing from a missing or fallback resume", () => {
    expect(readHiringFacts(undefined)).toEqual(EMPTY_FACTS);
    expect(readHiringFacts({ _type: "fallback", name: "A" } as never as StoredResume)).toEqual(EMPTY_FACTS);
  });

  it("reads and trims the three facts from an AI resume", () => {
    expect(readHiringFacts(ai({ noticePeriod: " 30  days ", currentCtc: "18 LPA", expectedCtc: null }))).toEqual({ noticePeriod: "30 days", currentCtc: "18 LPA", expectedCtc: "" });
  });

  it("writes empty strings as null and caps length", () => {
    const out = withHiringFacts(ai({ noticePeriod: "old" }), { noticePeriod: "", currentCtc: "x".repeat(80), expectedCtc: "24 LPA" });
    expect(out).toMatchObject({ noticePeriod: null, expectedCtc: "24 LPA" });
    expect((out as { currentCtc: string }).currentCtc).toHaveLength(40);
  });

  it("detects real changes only", () => {
    const a = { noticePeriod: "30 days", currentCtc: "", expectedCtc: "" };
    expect(factsChanged(a, { ...a, noticePeriod: " 30 days " })).toBe(false);
    expect(factsChanged(a, { ...a, expectedCtc: "20 LPA" })).toBe(true);
  });

  it("keeps shared facts across a re-parse unless the new resume states its own", () => {
    const prev = ai({ noticePeriod: "60 days", currentCtc: "15 LPA", expectedCtc: "20 LPA" });
    const merged = carryHiringFacts(ai({ noticePeriod: null, currentCtc: "18 LPA" }), prev);
    expect(merged).toMatchObject({ noticePeriod: "60 days", currentCtc: "18 LPA", expectedCtc: "20 LPA" });
  });
});

describe("employer view of expected CTC", () => {
  it("exposes expectedCtc from resume data and defaults to null", () => {
    expect(extractResumeDetail({ _type: "ai", topSkills: [], expectedCtc: "24 LPA" }).expectedCtc).toBe("24 LPA");
    expect(extractResumeDetail(null).expectedCtc).toBeNull();
  });
});
