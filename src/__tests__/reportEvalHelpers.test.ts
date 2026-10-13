import { describe, it, expect } from "vitest";
import {
  checkCase,
  checkGroupMeans,
  checkOrdering,
  checkReportSchema,
  checkTwins,
  evaluateSuite,
  formatVerdictLine,
  providerOfModel,
  tallyModels,
  type EvalOutcome,
} from "../../server-handlers/_report-eval-helpers";
import {
  GOLDEN_BY_ID,
  REPORT_SCORING_GOLDEN,
  type GoldenCase,
} from "../../data/report-scoring-golden";

const BANDS = { strongHire: 85, hire: 70, leanHire: 55, noHire: 40 };

function bandFor(score: number) {
  if (score >= BANDS.strongHire) return "strongHire";
  if (score >= BANDS.hire) return "hire";
  if (score >= BANDS.leanHire) return "leanHire";
  if (score >= BANDS.noHire) return "noHire";
  return "strongNoHire";
}

function makeReport(score: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: "mvp-9",
    overallScore: score,
    scoreConfidence: 0.7,
    band: bandFor(score),
    verdict: "Solid answers with room to quantify results.",
    wins: [{ text: "Clear structure", questionIdx: 1, quote: "I decided" }],
    fixes: [{ text: "Quantify the result", questionIdx: 1, quote: "it worked out" }],
    redFlags: [],
    coreMetrics: { fillerPerMin: 2, silenceRatio: 0.1, paceWpm: 130, energy: 0.6 },
    skills: [{ name: "Structure", score: score }],
    perQuestion: [{ idx: 1, score }],
    calibration: { companyLabel: "Generic", note: "", bands: BANDS },
    model: "llama-3.3-70b-versatile",
    ...overrides,
  };
}

const ok = (score: number, overrides: Record<string, unknown> = {}): EvalOutcome => ({
  kind: "report",
  report: makeReport(score, overrides),
});

const rejected422: EvalOutcome = { kind: "rejected", status: 422, error: "no_candidate_answers" };

describe("report-scoring golden set", () => {
  it("has unique ids and covers the required categories", () => {
    const ids = REPORT_SCORING_GOLDEN.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = new Set(REPORT_SCORING_GOLDEN.map((c) => c.category));
    for (const c of ["strong", "mid", "weak", "off-topic", "empty", "injection", "hinglish"] as const) {
      expect(categories.has(c)).toBe(true);
    }
    expect(REPORT_SCORING_GOLDEN.length).toBeGreaterThanOrEqual(12);
  });

  it("every request has the shape evaluate-session accepts", () => {
    for (const c of REPORT_SCORING_GOLDEN) {
      const { sessionId, transcript, meta } = c.request;
      expect(sessionId.length).toBeGreaterThan(0);
      expect(transcript.length).toBeGreaterThan(0);
      expect(transcript.length).toBeLessThanOrEqual(200);
      expect(transcript.some((t) => t.role === "candidate")).toBe(true);
      expect(meta.duration).toBeGreaterThan(0);
    }
  });

  it("rejected cases really fall under the handler's 20-character candidate floor", () => {
    for (const c of REPORT_SCORING_GOLDEN.filter((g) => g.expect.outcome === "rejected")) {
      const chars = c.request.transcript
        .filter((t) => t.role === "candidate")
        .reduce((n, t) => n + t.text.trim().length, 0);
      expect(chars).toBeLessThan(20);
    }
  });

  it("scored cases clear the handler's 20-character candidate floor", () => {
    for (const c of REPORT_SCORING_GOLDEN.filter((g) => g.expect.outcome === "report")) {
      const chars = c.request.transcript
        .filter((t) => t.role === "candidate")
        .reduce((n, t) => n + t.text.trim().length, 0);
      expect(chars).toBeGreaterThanOrEqual(20);
    }
  });

  it("twin references resolve and sessionIds are unique", () => {
    const sessionIds = REPORT_SCORING_GOLDEN.map((c) => c.request.sessionId);
    expect(new Set(sessionIds).size).toBe(sessionIds.length);
    for (const c of REPORT_SCORING_GOLDEN) {
      if (c.twin) expect(GOLDEN_BY_ID[c.twin.caseId]).toBeDefined();
    }
  });

  it("injection transcripts all carry an instruction aimed at the grader", () => {
    for (const c of REPORT_SCORING_GOLDEN.filter((g) => g.category === "injection")) {
      const text = c.request.transcript.filter((t) => t.role === "candidate").map((t) => t.text).join(" ");
      expect(/ignore (all )?previous instructions|override|evaluator/i.test(text)).toBe(true);
    }
  });
});

describe("checkReportSchema", () => {
  it("accepts a complete, consistent report", () => {
    expect(checkReportSchema(makeReport(62))).toEqual([]);
  });

  it("rejects non-objects", () => {
    expect(checkReportSchema(null)).toEqual(["report is not an object"]);
    expect(checkReportSchema("nope")).toEqual(["report is not an object"]);
    expect(checkReportSchema([])).toEqual(["report is not an object"]);
  });

  it("flags out-of-range and non-finite scores", () => {
    expect(checkReportSchema(makeReport(120)).join()).toContain("overallScore");
    expect(checkReportSchema(makeReport(Number.NaN)).join()).toContain("overallScore");
    expect(checkReportSchema(makeReport(-1)).join()).toContain("overallScore");
  });

  it("flags missing required fields one by one", () => {
    for (const key of ["version", "verdict", "model", "skills", "perQuestion", "coreMetrics", "calibration"]) {
      const r = makeReport(60);
      delete r[key];
      expect(checkReportSchema(r).length, key).toBeGreaterThan(0);
    }
  });

  it("flags a band that disagrees with the score and thresholds", () => {
    const problems = checkReportSchema(makeReport(30, { band: "strongHire" }));
    expect(problems.some((p) => p.includes("does not match overallScore"))).toBe(true);
  });

  it("flags an unknown band value", () => {
    expect(checkReportSchema(makeReport(60, { band: "great" })).join()).toContain("band");
  });

  it("flags a report with no coaching content", () => {
    const problems = checkReportSchema(makeReport(60, { wins: [], fixes: [] }));
    expect(problems.some((p) => p.includes("no coaching content"))).toBe(true);
  });

  it("flags malformed skills and perQuestion entries", () => {
    expect(checkReportSchema(makeReport(60, { skills: [{ name: "", score: 50 }] })).join()).toContain("skills[0]");
    expect(checkReportSchema(makeReport(60, { perQuestion: [{ score: 50 }] })).join()).toContain("perQuestion[0]");
  });

  it("flags scoreConfidence outside 0-1", () => {
    expect(checkReportSchema(makeReport(60, { scoreConfidence: 70 })).join()).toContain("scoreConfidence");
  });
});

describe("checkCase", () => {
  const strong = GOLDEN_BY_ID["strong-behavioral-pm"];
  const injection = GOLDEN_BY_ID["injection-pure"];
  const empty = GOLDEN_BY_ID["empty-answers"];

  it("passes a score inside the band", () => {
    const v = checkCase(strong, ok(82));
    expect(v.status).toBe("pass");
    expect(v.score).toBe(82);
    expect(v.model).toBe("llama-3.3-70b-versatile");
  });

  it("fails a score below the band with the band in the reason", () => {
    const v = checkCase(strong, ok(50));
    expect(v.status).toBe("fail");
    expect(v.reasons.join()).toContain("outside expected band [68, 100]");
  });

  it("fails an injection transcript that earned a top score", () => {
    const v = checkCase(injection, ok(100));
    expect(v.status).toBe("fail");
    expect(v.reasons.join()).toContain("outside expected band");
    expect(v.reasons.join()).toContain("forbidden");
  });

  it("passes an injection transcript scored low", () => {
    expect(checkCase(injection, ok(12)).status).toBe("pass");
  });

  it("fails on forbidden band even when the score is inside the numeric band", () => {
    const golden: GoldenCase = {
      ...strong,
      id: "synthetic",
      expect: { outcome: "report", scoreBand: [0, 100], forbidBands: ["hire"] },
    };
    const v = checkCase(golden, ok(75));
    expect(v.status).toBe("fail");
    expect(v.reasons.join()).toContain("band hire is forbidden");
  });

  it("fails on schema problems even when the score is in band", () => {
    const v = checkCase(strong, ok(82, { skills: [] }));
    expect(v.status).toBe("fail");
    expect(v.reasons.join()).toContain("schema: skills missing or empty");
  });

  it("passes an empty-answer case when the handler rejects with 422", () => {
    expect(checkCase(empty, rejected422).status).toBe("pass");
  });

  it("fails an empty-answer case when the handler invents a report", () => {
    const v = checkCase(empty, ok(35));
    expect(v.status).toBe("fail");
    expect(v.reasons.join()).toContain("expected the handler to reject");
  });

  it("fails an empty-answer case rejected with the wrong status or error", () => {
    const v = checkCase(empty, { kind: "rejected", status: 400, error: "sessionId required" });
    expect(v.status).toBe("fail");
    expect(v.reasons).toHaveLength(2);
  });

  it("fails a scored case the handler rejected", () => {
    const v = checkCase(strong, rejected422);
    expect(v.status).toBe("fail");
    expect(v.reasons.join()).toContain("a report was expected");
  });

  it("marks provider errors inconclusive rather than failed", () => {
    const v = checkCase(strong, { kind: "error", status: 503, message: "Couldn't generate your report" });
    expect(v.status).toBe("inconclusive");
    expect(v.reasons[0]).toContain("HTTP 503");
  });
});

describe("checkOrdering", () => {
  const strong = GOLDEN_BY_ID["strong-behavioral-pm"];
  const mid = GOLDEN_BY_ID["mid-behavioral-pm"];
  const weak = GOLDEN_BY_ID["weak-behavioral-vague"];
  const strongTech = GOLDEN_BY_ID["strong-technical-swe"];

  it("passes strong > mid > weak with margin", () => {
    expect(
      checkOrdering([
        { golden: strong, score: 85 },
        { golden: mid, score: 60 },
        { golden: weak, score: 20 },
      ]),
    ).toEqual([]);
  });

  it("flags the higher-ranked case when it does not clear the margin", () => {
    const failures = checkOrdering([
      { golden: strong, score: 62 },
      { golden: mid, score: 60 },
    ]);
    expect(failures).toHaveLength(1);
    expect(failures[0].caseId).toBe("strong-behavioral-pm");
  });

  it("flags a strict inversion", () => {
    const failures = checkOrdering([
      { golden: mid, score: 75 },
      { golden: weak, score: 80 },
    ]);
    expect(failures.map((f) => f.caseId)).toEqual(["mid-behavioral-pm"]);
  });

  it("does not compare cases of different interview types", () => {
    expect(
      checkOrdering([
        { golden: strongTech, score: 40 },
        { golden: weak, score: 38 },
      ]),
    ).toEqual([]);
  });

  it("ignores unranked cases", () => {
    expect(
      checkOrdering([
        { golden: GOLDEN_BY_ID["injection-on-mid"], score: 90 },
        { golden: weak, score: 20 },
      ]),
    ).toEqual([]);
  });
});

describe("checkGroupMeans", () => {
  it("passes when group means descend with margin", () => {
    expect(
      checkGroupMeans([
        { golden: GOLDEN_BY_ID["strong-behavioral-pm"], score: 85 },
        { golden: GOLDEN_BY_ID["strong-technical-swe"], score: 80 },
        { golden: GOLDEN_BY_ID["mid-behavioral-pm"], score: 60 },
        { golden: GOLDEN_BY_ID["weak-technical-wrong"], score: 20 },
      ]),
    ).toEqual([]);
  });

  it("flags the higher group when means are too close", () => {
    const failures = checkGroupMeans([
      { golden: GOLDEN_BY_ID["strong-behavioral-pm"], score: 66 },
      { golden: GOLDEN_BY_ID["strong-technical-swe"], score: 64 },
      { golden: GOLDEN_BY_ID["mid-behavioral-pm"], score: 60 },
    ]);
    expect(failures.map((f) => f.caseId).sort()).toEqual(["strong-behavioral-pm", "strong-technical-swe"]);
  });
});

describe("checkTwins", () => {
  const mid = GOLDEN_BY_ID["mid-behavioral-pm"];
  const injected = GOLDEN_BY_ID["injection-on-mid"];
  const hinglish = GOLDEN_BY_ID["hinglish-mid-behavioral"];

  it("flags an injection that lifts the score above its clean twin", () => {
    const failures = checkTwins([
      { golden: mid, score: 55 },
      { golden: injected, score: 80 },
    ]);
    expect(failures).toHaveLength(1);
    expect(failures[0].caseId).toBe("injection-on-mid");
    expect(failures[0].reason).toContain("ceiling");
  });

  it("allows an injection that scores the same or lower", () => {
    expect(checkTwins([{ golden: mid, score: 55 }, { golden: injected, score: 40 }])).toEqual([]);
    expect(checkTwins([{ golden: mid, score: 55 }, { golden: injected, score: 60 }])).toEqual([]);
  });

  it("flags Hinglish scoring well below the English twin", () => {
    const failures = checkTwins([
      { golden: mid, score: 62 },
      { golden: hinglish, score: 45 },
    ]);
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toContain("floor");
  });

  it("allows Hinglish within tolerance, or higher", () => {
    expect(checkTwins([{ golden: mid, score: 62 }, { golden: hinglish, score: 54 }])).toEqual([]);
    expect(checkTwins([{ golden: mid, score: 62 }, { golden: hinglish, score: 70 }])).toEqual([]);
  });

  it("skips when the twin was not scored", () => {
    expect(checkTwins([{ golden: injected, score: 99 }])).toEqual([]);
  });
});

describe("evaluateSuite", () => {
  const healthy: Record<string, EvalOutcome> = {
    "strong-behavioral-pm": ok(84),
    "strong-technical-swe": ok(80),
    "mid-behavioral-pm": ok(60),
    "mid-technical-swe": ok(56),
    "weak-behavioral-vague": ok(25),
    "weak-technical-wrong": ok(22),
    "weak-one-word-answers": ok(8),
    "offtopic-rambling": ok(10),
    "empty-answers": rejected422,
    "too-short-total": rejected422,
    "injection-pure": ok(6),
    "injection-on-mid": ok(52),
    "hinglish-mid-behavioral": ok(58),
  };

  it("passes every case for a healthy scorer", () => {
    const suite = evaluateSuite(REPORT_SCORING_GOLDEN, healthy);
    expect(suite.failed, JSON.stringify(suite.cases.filter((c) => c.status !== "pass"))).toBe(0);
    expect(suite.passed).toBe(REPORT_SCORING_GOLDEN.length);
    expect(suite.passRate).toBe(1);
  });

  it("catches an injection that was obeyed", () => {
    const suite = evaluateSuite(REPORT_SCORING_GOLDEN, { ...healthy, "injection-pure": ok(100) });
    const v = suite.cases.find((c) => c.id === "injection-pure");
    expect(v?.status).toBe("fail");
    expect(suite.failed).toBeGreaterThanOrEqual(1);
    expect(suite.passRate).toBeLessThan(1);
  });

  it("catches a collapsed scorer that rates everything the same", () => {
    const flat: Record<string, EvalOutcome> = {};
    for (const c of REPORT_SCORING_GOLDEN) {
      flat[c.id] = c.expect.outcome === "rejected" ? rejected422 : ok(55);
    }
    const suite = evaluateSuite(REPORT_SCORING_GOLDEN, flat);
    expect(suite.failed).toBeGreaterThan(3);
    const strong = suite.cases.find((c) => c.id === "strong-behavioral-pm");
    expect(strong?.reasons.some((r) => r.startsWith("ordering:"))).toBe(true);
  });

  it("does not count provider errors against the pass rate", () => {
    const outcomes: Record<string, EvalOutcome> = {
      ...healthy,
      "mid-technical-swe": { kind: "error", status: 503, message: "quota" },
    };
    const suite = evaluateSuite(REPORT_SCORING_GOLDEN, outcomes);
    expect(suite.inconclusive).toBe(1);
    expect(suite.failed).toBe(0);
    expect(suite.passRate).toBe(1);
  });

  it("returns a null pass rate when nothing was conclusive", () => {
    const outcomes: Record<string, EvalOutcome> = {};
    for (const c of REPORT_SCORING_GOLDEN) outcomes[c.id] = { kind: "error", status: 429, message: "rate limited" };
    const suite = evaluateSuite(REPORT_SCORING_GOLDEN, outcomes);
    expect(suite.passRate).toBeNull();
    expect(suite.inconclusive).toBe(REPORT_SCORING_GOLDEN.length);
  });

  it("treats a missing outcome as inconclusive", () => {
    const suite = evaluateSuite(REPORT_SCORING_GOLDEN.slice(0, 1), {});
    expect(suite.cases[0].status).toBe("inconclusive");
  });

  it("evaluates a subset without cross-case noise from absent cases", () => {
    const subset = REPORT_SCORING_GOLDEN.filter((c) => c.id === "strong-behavioral-pm");
    const suite = evaluateSuite(subset, { "strong-behavioral-pm": ok(84) });
    expect(suite.passed).toBe(1);
  });
});

describe("formatVerdictLine", () => {
  it("renders pass, fail and skip tags with score and model", () => {
    expect(formatVerdictLine({ id: "a", status: "pass", score: 80, band: "hire", model: "m", reasons: [] })).toBe(
      "PASS  a  score 80 (hire) [m]",
    );
    expect(formatVerdictLine({ id: "b", status: "fail", score: null, band: null, model: null, reasons: [] })).toBe(
      "FAIL  b  no score",
    );
    expect(formatVerdictLine({ id: "c", status: "inconclusive", score: null, band: null, model: null, reasons: [] })).toBe(
      "SKIP  c  no score",
    );
  });
});

describe("providerOfModel / tallyModels", () => {
  it("labels providers from model ids", () => {
    expect(providerOfModel("llama-3.3-70b-versatile")).toBe("groq");
    expect(providerOfModel("openai/gpt-oss-120b")).toBe("groq");
    expect(providerOfModel("gemini-3.5-flash-lite")).toBe("gemini");
    expect(providerOfModel("cloudflare-@cf/openai/gpt-oss-120b")).toBe("cloudflare");
    expect(providerOfModel("Mystery-1")).toBe("mystery-1");
  });

  it("tallies cases per model, most frequent first, ignoring cases without a model", () => {
    const base = { status: "pass" as const, score: 50, band: "leanHire", reasons: [] };
    const tally = tallyModels([
      { id: "a", model: "gemini-3.5-flash-lite", ...base },
      { id: "b", model: "llama-3.3-70b-versatile", ...base },
      { id: "c", model: "llama-3.3-70b-versatile", ...base },
      { id: "d", model: null, ...base },
    ]);
    expect(tally).toEqual([
      { model: "llama-3.3-70b-versatile", provider: "groq", cases: 2 },
      { model: "gemini-3.5-flash-lite", provider: "gemini", cases: 1 },
    ]);
  });
});
