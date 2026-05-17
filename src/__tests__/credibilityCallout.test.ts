import { describe, it, expect } from "vitest";
import { summarizeCredibility, CREDIBILITY_FLAGS } from "../_credibilityCallout";

describe("summarizeCredibility", () => {
  it("returns empty summary for null / undefined / no flags", () => {
    expect(summarizeCredibility(null)).toEqual({ hasIssues: false, items: [], count: 0 });
    expect(summarizeCredibility(undefined)).toEqual({ hasIssues: false, items: [], count: 0 });
    expect(summarizeCredibility({ flags: [], rubric_gaps: [] })).toEqual({
      hasIssues: false, items: [], count: 0,
    });
  });

  it("ignores non-credibility flags", () => {
    const out = summarizeCredibility({
      flags: ["excessive_filler_words", "mti_pattern_detected", "no_company_specific_research"],
      rubric_gaps: [],
    });
    expect(out.hasIssues).toBe(false);
    expect(out.items).toHaveLength(0);
  });

  it("picks up the cgpa mismatch flag with action + label", () => {
    const out = summarizeCredibility({
      flags: ["cgpa_mismatch_with_resume"],
      rubric_gaps: [],
    });
    expect(out.hasIssues).toBe(true);
    expect(out.count).toBe(1);
    expect(out.items[0].flag).toBe("cgpa_mismatch_with_resume");
    expect(out.items[0].label.toLowerCase()).toContain("cgpa");
    expect(out.items[0].action).toMatch(/transcript|round up/i);
  });

  it("pairs a rubric gap with the same dimension + keyword as evidence", () => {
    const out = summarizeCredibility({
      flags: ["college_mismatch_with_resume"],
      rubric_gaps: [
        {
          dimension: "credibility",
          expected: "Match the college you mentioned (IIT Bombay) with the one on your resume (NIT Surat).",
          observed: "Resume lists NIT Surat but candidate said IIT Bombay in the transcript.",
          severity: "high",
        },
      ],
    });
    expect(out.items[0].evidence).toBeDefined();
    expect(out.items[0].evidence?.observed).toMatch(/NIT|IIT/);
  });

  it("orders items per CREDIBILITY_FLAGS regardless of input order", () => {
    const out = summarizeCredibility({
      flags: ["cgpa_mismatch_with_resume", "claimed_internship_not_in_resume", "college_mismatch_with_resume"],
      rubric_gaps: [],
    });
    const idxClaim = CREDIBILITY_FLAGS.indexOf("claimed_internship_not_in_resume");
    const idxCollege = CREDIBILITY_FLAGS.indexOf("college_mismatch_with_resume");
    const idxCgpa = CREDIBILITY_FLAGS.indexOf("cgpa_mismatch_with_resume");
    expect(idxClaim).toBeLessThan(idxCollege);
    expect(idxCollege).toBeLessThan(idxCgpa);
    expect(out.items.map((i) => i.flag)).toEqual([
      "claimed_internship_not_in_resume",
      "college_mismatch_with_resume",
      "cgpa_mismatch_with_resume",
    ]);
  });

  it("dedupes if the same flag appears twice", () => {
    const out = summarizeCredibility({
      flags: ["cgpa_mismatch_with_resume", "cgpa_mismatch_with_resume"],
      rubric_gaps: [],
    });
    expect(out.count).toBe(1);
  });

  it("handles a row where rubric_gaps is malformed (not an array)", () => {
    const out = summarizeCredibility({
      flags: ["cgpa_mismatch_with_resume"],
      // simulating bad data — e.g. someone wrote a JSON object by mistake
      rubric_gaps: { dimension: "credibility" } as unknown,
    });
    expect(out.hasIssues).toBe(true);
    expect(out.items[0].evidence).toBeUndefined();
  });
});
