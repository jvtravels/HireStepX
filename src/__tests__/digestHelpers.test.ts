import { describe, it, expect } from "vitest";
import { buildDigestPrompt, parseDigest, computeSeverity } from "../../server-handlers/_digest-helpers";

describe("computeSeverity", () => {
  it("returns 'high' when any hallucination is present", () => {
    expect(computeSeverity({ hallucinationCount: 1, scoreDrift: 0, flagCount: 1 })).toBe("high");
  });

  it("returns 'high' when |score_drift| >= 10", () => {
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: -12, flagCount: 0 })).toBe("high");
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: 11, flagCount: 0 })).toBe("high");
  });

  it("returns 'medium' when there are flags but no hallucinations or large drift", () => {
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: 3, flagCount: 2 })).toBe("medium");
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: null, flagCount: 1 })).toBe("medium");
  });

  it("returns 'low' for clean sessions", () => {
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: null, flagCount: 0 })).toBe("low");
    expect(computeSeverity({ hallucinationCount: 0, scoreDrift: 1, flagCount: 0 })).toBe("low");
  });
});

describe("buildDigestPrompt", () => {
  it("includes the day, total counts, and per-focus breakdown", () => {
    const prompt = buildDigestPrompt({
      day: "2026-05-07",
      byFocus: [{ focus: "behavioral", sessions: 12, avg_drift: -3.4, hallucination_rate: 0.08, top_flags: [{ flag: "weak_star_structure", count: 5 }] }],
      resolutionsToday: [{ focus: "behavioral", status: "resolved", count: 2 }],
      recentCommits: [{ sha: "abc123", subject: "Tighten STAR regex", date: "2026-05-07" }],
      weekTrend: [{ focus: "behavioral", flag: "weak_star_structure", today_count: 5, week_avg: 1.5 }],
      totalAnalyzed: 12,
      totalOpenIssues: 47,
    });
    expect(prompt).toContain("2026-05-07");
    expect(prompt).toContain("12");
    expect(prompt).toContain("behavioral");
    expect(prompt).toContain("weak_star_structure");
    expect(prompt).toContain("Tighten STAR regex");
    expect(prompt).toContain("47");
  });

  it("renders empty sections gracefully", () => {
    const prompt = buildDigestPrompt({
      day: "2026-05-07",
      byFocus: [],
      resolutionsToday: [],
      recentCommits: [],
      weekTrend: [],
      totalAnalyzed: 0,
      totalOpenIssues: 0,
    });
    expect(prompt).toContain("(no analyzed sessions today)");
    expect(prompt).toContain("(none)");
  });
});

describe("parseDigest", () => {
  it("extracts all four fields from valid JSON", () => {
    const out = parseDigest(JSON.stringify({
      fixes_summary: "Resolved 3 sessions today.",
      improvements_summary: "Tightened STAR regex.",
      patterns_summary: "Salary-neg drifting.",
      recommendations: "Audit equity claims.",
    }));
    expect(out.fixes_summary).toBe("Resolved 3 sessions today.");
    expect(out.improvements_summary).toBe("Tightened STAR regex.");
    expect(out.patterns_summary).toBe("Salary-neg drifting.");
    expect(out.recommendations).toBe("Audit equity claims.");
  });

  it("returns empty strings on malformed JSON without throwing", () => {
    const out = parseDigest("not json at all");
    expect(out.fixes_summary).toBe("");
    expect(out.improvements_summary).toBe("");
    expect(out.patterns_summary).toBe("");
    expect(out.recommendations).toBe("");
  });

  it("ignores non-string fields safely", () => {
    const out = parseDigest(JSON.stringify({ fixes_summary: 42, improvements_summary: null, patterns_summary: ["array"], recommendations: "ok" }));
    expect(out.fixes_summary).toBe("");
    expect(out.improvements_summary).toBe("");
    expect(out.patterns_summary).toBe("");
    expect(out.recommendations).toBe("ok");
  });
});
