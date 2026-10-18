import { describe, it, expect } from "vitest";
import { buildSplitPrompts, isUsablePerQuestion, splitReportEnabled } from "../../server-handlers/_evaluate-session-helpers";

const PQ = `  "perQuestion": [\n    { "idx": 1 }\n  ],\n`;
const prompt = `RULES...\nTRANSCRIPT\nReturn a JSON object with EXACTLY this shape:\n{\n  "overallScore": 1,\n${PQ}  "scoreConfidence": 0.8\n}\n\nApply all the CRITICAL RULES above to every field. Return ONLY valid JSON.`;

describe("buildSplitPrompts", () => {
  it("removes perQuestion from the core prompt and keeps the rest", () => {
    const s = buildSplitPrompts(prompt, PQ)!;
    expect(s.core).not.toContain('"perQuestion"');
    expect(s.core).toContain('"overallScore"');
    expect(s.core).toContain("Do NOT include a perQuestion field");
  });
  it("keeps transcript context and only the perQuestion shape in the second prompt", () => {
    const s = buildSplitPrompts(prompt, PQ)!;
    expect(s.perQuestion).toContain("TRANSCRIPT");
    expect(s.perQuestion).toContain('"perQuestion"');
    expect(s.perQuestion).not.toContain('"overallScore": 1');
    expect(s.perQuestion).toContain("Apply all the CRITICAL RULES");
  });
  it("returns null when anchors are missing so the caller uses the single call", () => {
    expect(buildSplitPrompts("no anchors", PQ)).toBeNull();
    expect(buildSplitPrompts(prompt, "  \"other\": 1,\n")).toBeNull();
  });
});

describe("isUsablePerQuestion", () => {
  it("accepts graded items", () => expect(isUsablePerQuestion({ perQuestion: [{ idx: 2, score: 70 }] })).toBe(true));
  it("rejects empty, missing, or malformed items", () => {
    expect(isUsablePerQuestion({ perQuestion: [] })).toBe(false);
    expect(isUsablePerQuestion({})).toBe(false);
    expect(isUsablePerQuestion(null)).toBe(false);
    expect(isUsablePerQuestion({ perQuestion: [{ idx: 2 }] })).toBe(false);
  });
});

describe("splitReportEnabled", () => {
  it("is off by default and on for 1/true", () => {
    expect(splitReportEnabled(undefined)).toBe(false);
    expect(splitReportEnabled("0")).toBe(false);
    expect(splitReportEnabled("1")).toBe(true);
    expect(splitReportEnabled("TRUE")).toBe(true);
  });
});
