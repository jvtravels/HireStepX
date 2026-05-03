import { describe, it, expect } from "vitest";
import {
  aggregatePatterns,
  pickWorstPatterns,
  pickRealMatchCandidates,
  buildReport,
  renderReportHtml,
  bucketLabel,
  type FeedbackRow,
} from "../../server-handlers/_aggregate-feedback-helpers";

const row = (over: Partial<FeedbackRow>): FeedbackRow => ({
  question_text: over.question_text ?? "Tell me about yourself.",
  thumbs: over.thumbs ?? "up",
  company: over.company ?? "flipkart",
  role: over.role ?? "swe",
  focus: over.focus ?? "behavioral",
  created_at: over.created_at ?? new Date().toISOString(),
});

/* ─── bucketLabel ───────────────────────────────────────────────── */
describe("bucketLabel", () => {
  it("formats company × focus", () => {
    expect(bucketLabel("flipkart", "case-study")).toBe("flipkart × case-study");
  });
  it("collapses empty company to (any)", () => {
    expect(bucketLabel("", "behavioral")).toBe("(any) × behavioral");
  });
  it("collapses both empty to (any) × (any)", () => {
    expect(bucketLabel("", "")).toBe("(any) × (any)");
  });
});

/* ─── aggregatePatterns ─────────────────────────────────────────── */
describe("aggregatePatterns", () => {
  it("groups rows by (company × focus)", () => {
    const rows = [
      row({ company: "flipkart", focus: "case-study", thumbs: "up" }),
      row({ company: "flipkart", focus: "case-study", thumbs: "down" }),
      row({ company: "razorpay", focus: "system-design", thumbs: "up" }),
    ];
    const out = aggregatePatterns(rows);
    expect(out).toHaveLength(2);
    const fk = out.find(p => p.bucket === "flipkart × case-study")!;
    expect(fk.upCount).toBe(1);
    expect(fk.downCount).toBe(1);
    expect(fk.downRatio).toBeCloseTo(0.5);
  });

  it("excludes 'real' thumbs from the up:down ratio (it's an additive signal)", () => {
    const rows = [
      row({ thumbs: "up" }),
      row({ thumbs: "real" }),
      row({ thumbs: "real" }),
    ];
    const [g] = aggregatePatterns(rows);
    expect(g.upCount).toBe(1);
    expect(g.downCount).toBe(0);
    expect(g.realCount).toBe(2);
    /* Down-ratio = 0 / (1 + 0) = 0; the real-thumbs don't penalise it. */
    expect(g.downRatio).toBe(0);
  });

  it("returns downRatio=0 when there are no up or down votes (only real)", () => {
    const [g] = aggregatePatterns([row({ thumbs: "real" })]);
    expect(g.downRatio).toBe(0);
  });

  it("returns empty array on empty input", () => {
    expect(aggregatePatterns([])).toEqual([]);
  });
});

/* ─── pickWorstPatterns ─────────────────────────────────────────── */
describe("pickWorstPatterns", () => {
  it("excludes patterns below the minimum sample size", () => {
    const patterns = aggregatePatterns([
      row({ company: "tiny", thumbs: "down" }),
      row({ company: "tiny", thumbs: "down" }),
      // 2 votes — below default minSample of 5
    ]);
    const worst = pickWorstPatterns(patterns);
    expect(worst).toHaveLength(0);
  });

  it("excludes patterns below the alert threshold (30% down-rate)", () => {
    const rows: FeedbackRow[] = [];
    for (let i = 0; i < 9; i++) rows.push(row({ thumbs: "up" }));
    for (let i = 0; i < 1; i++) rows.push(row({ thumbs: "down" }));
    /* 1 down out of 10 = 10% — well below 30% threshold. */
    const worst = pickWorstPatterns(aggregatePatterns(rows));
    expect(worst).toHaveLength(0);
  });

  it("surfaces patterns above the threshold with sufficient sample", () => {
    const rows: FeedbackRow[] = [];
    for (let i = 0; i < 4; i++) rows.push(row({ company: "bad", thumbs: "down" }));
    for (let i = 0; i < 3; i++) rows.push(row({ company: "bad", thumbs: "up" }));
    /* 4/7 = 57% down-rate, sample 7 ≥ 5. */
    const worst = pickWorstPatterns(aggregatePatterns(rows));
    expect(worst).toHaveLength(1);
    expect(worst[0].downRatio).toBeCloseTo(4 / 7);
  });

  it("sorts highest down-rate first, then by sample size", () => {
    const rows: FeedbackRow[] = [];
    // bucket A: 60% down, sample 10
    for (let i = 0; i < 6; i++) rows.push(row({ company: "a", thumbs: "down" }));
    for (let i = 0; i < 4; i++) rows.push(row({ company: "a", thumbs: "up" }));
    // bucket B: 80% down, sample 5
    for (let i = 0; i < 4; i++) rows.push(row({ company: "b", thumbs: "down" }));
    for (let i = 0; i < 1; i++) rows.push(row({ company: "b", thumbs: "up" }));
    const worst = pickWorstPatterns(aggregatePatterns(rows));
    expect(worst[0].company).toBe("b"); // 80% beats 60%
    expect(worst[1].company).toBe("a");
  });

  it("respects custom thresholds", () => {
    const rows: FeedbackRow[] = [];
    for (let i = 0; i < 2; i++) rows.push(row({ thumbs: "down" }));
    for (let i = 0; i < 1; i++) rows.push(row({ thumbs: "up" }));
    /* sample 3, downRatio 67% — passes a custom relaxed config. */
    const worst = pickWorstPatterns(aggregatePatterns(rows), {
      minSample: 2, minDownRatio: 0.5,
    });
    expect(worst).toHaveLength(1);
  });
});

/* ─── pickRealMatchCandidates ───────────────────────────────────── */
describe("pickRealMatchCandidates", () => {
  it("only counts 'real' thumbs", () => {
    const rows = [
      row({ thumbs: "up" }),
      row({ thumbs: "down" }),
      row({ thumbs: "real" }),
      row({ thumbs: "real" }),
    ];
    const out = pickRealMatchCandidates(rows);
    /* Only 2 'real' votes; default minHits=2 → surfaces. */
    expect(out).toHaveLength(1);
    expect(out[0].realCount).toBe(2);
  });

  it("requires at least 2 hits per question by default", () => {
    const rows = [row({ thumbs: "real", question_text: "Lonely Q" })];
    expect(pickRealMatchCandidates(rows)).toHaveLength(0);
  });

  it("merges questions with trivial punctuation/casing differences", () => {
    const rows = [
      row({ thumbs: "real", question_text: "Tell me about yourself" }),
      row({ thumbs: "real", question_text: "Tell me about yourself." }),
      row({ thumbs: "real", question_text: "TELL ME ABOUT YOURSELF" }),
    ];
    const out = pickRealMatchCandidates(rows);
    expect(out).toHaveLength(1);
    expect(out[0].realCount).toBe(3);
  });

  it("sorts by realCount, then by recency", () => {
    const old = "2026-01-01T00:00:00Z";
    const recent = "2026-04-15T00:00:00Z";
    const rows = [
      row({ thumbs: "real", question_text: "Q popular old", created_at: old }),
      row({ thumbs: "real", question_text: "Q popular old", created_at: old }),
      row({ thumbs: "real", question_text: "Q popular old", created_at: old }),
      row({ thumbs: "real", question_text: "Q recent fewer", created_at: recent }),
      row({ thumbs: "real", question_text: "Q recent fewer", created_at: recent }),
    ];
    const out = pickRealMatchCandidates(rows);
    /* Popular-old (3 hits) outranks recent-fewer (2 hits). */
    expect(out[0].questionText).toBe("Q popular old");
    expect(out[1].questionText).toBe("Q recent fewer");
  });

  it("captures the most recent timestamp per candidate", () => {
    const t1 = "2026-04-01T00:00:00Z";
    const t2 = "2026-04-15T00:00:00Z";
    const rows = [
      row({ thumbs: "real", question_text: "Q", created_at: t1 }),
      row({ thumbs: "real", question_text: "Q", created_at: t2 }),
    ];
    const [c] = pickRealMatchCandidates(rows);
    expect(c.lastSeenAt).toBe(t2);
  });
});

/* ─── buildReport ───────────────────────────────────────────────── */
describe("buildReport", () => {
  it("flags hasFindings=true when there are worst patterns OR real matches", () => {
    const rows: FeedbackRow[] = [];
    for (let i = 0; i < 4; i++) rows.push(row({ thumbs: "down" }));
    for (let i = 0; i < 3; i++) rows.push(row({ thumbs: "up" }));
    const r = buildReport(rows, 7);
    expect(r.hasFindings).toBe(true);
    expect(r.totalRowsAnalysed).toBe(7);
    expect(r.windowDays).toBe(7);
  });

  it("flags hasFindings=false on quiet weeks", () => {
    /* All up-votes, no real-matches → nothing actionable. */
    const rows = Array.from({ length: 20 }, () => row({ thumbs: "up" }));
    const r = buildReport(rows, 7);
    expect(r.hasFindings).toBe(false);
    expect(r.worstPatterns).toHaveLength(0);
    expect(r.realMatchCandidates).toHaveLength(0);
  });

  it("flags hasFindings=true when only real-matches surface (no bad patterns)", () => {
    const rows: FeedbackRow[] = [];
    for (let i = 0; i < 30; i++) rows.push(row({ thumbs: "up" }));
    rows.push(row({ thumbs: "real", question_text: "Confirmed Q" }));
    rows.push(row({ thumbs: "real", question_text: "Confirmed Q" }));
    const r = buildReport(rows, 7);
    expect(r.hasFindings).toBe(true);
    expect(r.realMatchCandidates).toHaveLength(1);
  });
});

/* ─── renderReportHtml ──────────────────────────────────────────── */
describe("renderReportHtml", () => {
  it("renders a complete HTML body for a report with findings", () => {
    const rows: FeedbackRow[] = [];
    for (let i = 0; i < 5; i++) rows.push(row({ company: "x", thumbs: "down" }));
    for (let i = 0; i < 2; i++) rows.push(row({ company: "x", thumbs: "up" }));
    rows.push(row({ thumbs: "real", question_text: "Real Q" }));
    rows.push(row({ thumbs: "real", question_text: "Real Q" }));
    const html = renderReportHtml(buildReport(rows, 7));
    expect(html).toContain("question-feedback");
    expect(html).toContain("Worst-performing patterns");
    /* Header text uses the smart-quoted phrase "Matched my real interview"
       — match a substring that's robust to quote-style changes. */
    expect(html.toLowerCase()).toContain("matched my real interview");
    expect(html).toContain("Real Q");
  });

  it("escapes HTML entities in question text", () => {
    const rows: FeedbackRow[] = [
      row({ thumbs: "real", question_text: "<script>alert(1)</script>" }),
      row({ thumbs: "real", question_text: "<script>alert(1)</script>" }),
    ];
    const html = renderReportHtml(buildReport(rows, 7));
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("renders an empty-state message when there are no findings", () => {
    const html = renderReportHtml(buildReport([], 7));
    expect(html).toContain("No (company × focus) buckets crossed");
    expect(html).toContain("No questions reached the 2+");
  });
});
