import { describe, it, expect } from "vitest";
import { buildFixPlanPrompt, parseFixPlan, isFileGrounded, buildDedupKey } from "../../server-handlers/_fix-plan-helpers";

describe("isFileGrounded", () => {
  it("accepts exact known paths", () => {
    expect(isFileGrounded("data/salaries.ts")).toBe(true);
    expect(isFileGrounded("server-handlers/analyzers/behavioral.ts")).toBe(true);
  });
  it("accepts new-but-plausible analyzer/data paths via prefix", () => {
    expect(isFileGrounded("server-handlers/analyzers/future-focus.ts")).toBe(true);
    expect(isFileGrounded("data/new-bank.ts")).toBe(true);
  });
  it("rejects clearly hallucinated paths", () => {
    expect(isFileGrounded("src/imaginary.ts")).toBe(false);
    expect(isFileGrounded("")).toBe(false);
    expect(isFileGrounded("not-a-path")).toBe(false);
  });
});

describe("buildFixPlanPrompt", () => {
  it("includes the focus filter when set", () => {
    const p = buildFixPlanPrompt({
      focus: "salary-negotiation",
      openIssues: [{ flag: "implausible_salary_claim", count: 4, severity_high: 3, example_evidence: ["AI quoted 850 LPA"] }],
      flaggedSessions: [],
      registeredFocuses: ["behavioral", "salary-negotiation"],
    });
    expect(p).toContain('"salary-negotiation"');
    expect(p).toContain("implausible_salary_claim");
    expect(p).toContain("AI quoted 850 LPA");
  });

  it("renders gracefully with no data", () => {
    const p = buildFixPlanPrompt({
      openIssues: [],
      flaggedSessions: [],
      registeredFocuses: [],
    });
    expect(p).toContain("(no open issues)");
    expect(p).toContain("Across all focuses");
  });

  it("steers the LLM to the right code layer", () => {
    const p = buildFixPlanPrompt({
      openIssues: [{ flag: "weak_star_structure", count: 5, severity_high: 0, example_evidence: [] }],
      flaggedSessions: [],
      registeredFocuses: ["behavioral"],
    });
    // The prompt must explain where each fix type lives.
    expect(p).toContain("server-handlers/analyzers");
    expect(p).toContain("data/salaries.ts");
    expect(p).toContain("interviewEvaluation");
  });
});

describe("parseFixPlan", () => {
  it("parses a well-formed plan", () => {
    const out = parseFixPlan(JSON.stringify({
      summary: "Salary-neg drift is the biggest issue.",
      items: [
        {
          priority: "high",
          title: "Lower senior tier ceiling",
          target_file: "data/salaries.ts",
          change: "Reduce SALARY_DATA[software-engineer][tier1][senior].total_max from 75 to 60.",
          rationale: "Catches AI hallucinations in senior salary-neg sessions.",
          affected_flags: ["implausible_salary_claim"],
        },
      ],
      cautions: ["Verify against levels.fyi before lowering."],
    }));
    expect(out.summary).toBe("Salary-neg drift is the biggest issue.");
    expect(out.items).toHaveLength(1);
    expect(out.items[0].priority).toBe("high");
    expect(out.items[0].target_file).toBe("data/salaries.ts");
    expect(out.cautions).toHaveLength(1);
  });

  it("clamps invalid priority values to medium", () => {
    const out = parseFixPlan(JSON.stringify({
      summary: "x",
      items: [{ priority: "urgent", title: "x", target_file: "x", change: "x", rationale: "x", affected_flags: [] }],
      cautions: [],
    }));
    expect(out.items[0].priority).toBe("medium");
  });

  it("returns empty plan on malformed JSON", () => {
    const out = parseFixPlan("not json");
    expect(out.summary).toBe("");
    expect(out.items).toEqual([]);
    expect(out.cautions).toEqual([]);
  });

  it("marks items with file_grounded based on KNOWN_FIX_TARGETS", () => {
    const out = parseFixPlan(JSON.stringify({
      summary: "x",
      items: [
        { priority: "high", title: "Real", target_file: "data/salaries.ts", change: "x", rationale: "x", affected_flags: [] },
        { priority: "high", title: "Hallucinated", target_file: "src/imaginary.ts", change: "x", rationale: "x", affected_flags: [] },
        { priority: "medium", title: "New analyzer", target_file: "server-handlers/analyzers/new-thing.ts", change: "x", rationale: "x", affected_flags: [] },
      ],
      cautions: [],
    }));
    expect(out.items[0].file_grounded).toBe(true);
    expect(out.items[1].file_grounded).toBe(false);
    expect(out.items[2].file_grounded).toBe(true); // matches known prefix
  });

  it("caps items at 10 to bound the UI", () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      priority: "low" as const, title: `t${i}`, target_file: "x", change: "x", rationale: "x", affected_flags: [],
    }));
    const out = parseFixPlan(JSON.stringify({ summary: "x", items, cautions: [] }));
    expect(out.items).toHaveLength(10);
  });
});

describe("buildDedupKey", () => {
  it("collides across reworded titles for the same file + flags", () => {
    const a = buildDedupKey({
      target_file: "server-handlers/analyzers/salary-negotiation.ts",
      affected_flags: ["implausible_salary_claim", "off_topic_drift"],
      title: "Fix negotiation off-topic drift",
    });
    const b = buildDedupKey({
      target_file: "server-handlers/analyzers/salary-negotiation.ts",
      affected_flags: ["off_topic_drift", "implausible_salary_claim"],
      title: "Address salary claim plausibility and topic drift",
    });
    expect(a).toBe(b);
  });

  it("differs across different target files", () => {
    const a = buildDedupKey({ target_file: "a.ts", affected_flags: ["x"], title: "same title" });
    const b = buildDedupKey({ target_file: "b.ts", affected_flags: ["x"], title: "same title" });
    expect(a).not.toBe(b);
  });

  it("differs across different flag sets on the same file", () => {
    const a = buildDedupKey({ target_file: "a.ts", affected_flags: ["x"], title: "same title" });
    const b = buildDedupKey({ target_file: "a.ts", affected_flags: ["y"], title: "same title" });
    expect(a).not.toBe(b);
  });

  it("falls back to title when no flags are given, so distinct no-flag fixes don't collide", () => {
    const a = buildDedupKey({ target_file: "a.ts", affected_flags: [], title: "Fix one thing" });
    const b = buildDedupKey({ target_file: "a.ts", affected_flags: [], title: "Fix a different thing" });
    expect(a).not.toBe(b);
  });

  it("is case-insensitive", () => {
    const a = buildDedupKey({ target_file: "A.TS", affected_flags: ["X"], title: "t" });
    const b = buildDedupKey({ target_file: "a.ts", affected_flags: ["x"], title: "t" });
    expect(a).toBe(b);
  });
});
