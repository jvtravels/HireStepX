/* Tests for the cross-session skill-progress derivation logic.
 *
 * The trend math is the user-visible signal — "am I improving on ESOPs?"
 * — so the boundary cases (single-point, empty, exact ±3 thresholds,
 * mid-stream regression, multi-skill isolation) all get a dedicated test
 * rather than a single happy-path. */

import { describe, expect, it } from "vitest";
import {
  capHistoryToSession,
  computeAllTrends,
  computeTrend,
  computeTrendsForSkills,
  createInMemoryProgressStore,
  groundGapClosureSkillScores,
  groundNoCounterSkillScores,
  humanizeSkillKey,
  sessionRowsToProgressPoints,
  type SessionSkillRow,
  type SkillProgressPoint,
} from "../sessionReport/progressTracking";

const t0 = Date.UTC(2026, 0, 1);
const DAY = 24 * 60 * 60 * 1000;

function pt(skill: string, scorePct: number, dayOffset: number, sessionId?: string): SkillProgressPoint {
  return {
    skill,
    scorePct,
    sessionId: sessionId ?? `s${dayOffset}`,
    completedAt: t0 + dayOffset * DAY,
  };
}

describe("computeTrend", () => {
  it("returns a zero-baselined flat trend for empty history", () => {
    const r = computeTrend([], "Anchoring");
    expect(r).toEqual({
      skill: "Anchoring",
      latestScore: 0,
      deltaVsLast: 0,
      deltaVs3SessionAvg: 0,
      trend: "flat",
      sparkline: [],
    });
  });

  it("treats a single point as flat with no delta", () => {
    const r = computeTrend([pt("Anchoring", 60, 0)], "Anchoring");
    expect(r.latestScore).toBe(60);
    expect(r.deltaVsLast).toBe(0);
    expect(r.deltaVs3SessionAvg).toBe(0);
    expect(r.trend).toBe("flat");
    expect(r.sparkline).toEqual([60]);
  });

  it("flags 'up' when latest beats 3-session avg by ≥3 pts", () => {
    const hist = [
      pt("Anchoring", 50, 0),
      pt("Anchoring", 52, 1),
      pt("Anchoring", 54, 2),
      pt("Anchoring", 65, 3), // avg(50,52,54)=52; +13 ≥ 3 ⇒ up
    ];
    const r = computeTrend(hist, "Anchoring");
    expect(r.trend).toBe("up");
    expect(r.latestScore).toBe(65);
    expect(r.deltaVsLast).toBe(11);
    expect(r.deltaVs3SessionAvg).toBe(13);
    expect(r.sparkline).toEqual([50, 52, 54, 65]);
  });

  it("flags 'down' when latest is ≥3 pts below 3-session avg", () => {
    const hist = [
      pt("ESOPs", 70, 0),
      pt("ESOPs", 72, 1),
      pt("ESOPs", 68, 2),
      pt("ESOPs", 55, 3), // avg(70,72,68)=70; -15 ⇒ down
    ];
    const r = computeTrend(hist, "ESOPs");
    expect(r.trend).toBe("down");
    expect(r.deltaVs3SessionAvg).toBe(-15);
    expect(r.deltaVsLast).toBe(-13);
  });

  it("flags 'flat' for movement within ±3 pts", () => {
    const hist = [
      pt("Silence Discipline", 60, 0),
      pt("Silence Discipline", 62, 1),
      pt("Silence Discipline", 58, 2),
      pt("Silence Discipline", 61, 3), // avg=60; +1 ⇒ flat
    ];
    const r = computeTrend(hist, "Silence Discipline");
    expect(r.trend).toBe("flat");
    expect(Math.abs(r.deltaVs3SessionAvg)).toBeLessThan(3);
  });

  it("uses only the 3 sessions immediately prior to latest for avg", () => {
    // 5-point history: avg should ignore the oldest two when computing.
    const hist = [
      pt("Anchoring", 10, 0), // ignored
      pt("Anchoring", 20, 1), // ignored
      pt("Anchoring", 60, 2),
      pt("Anchoring", 60, 3),
      pt("Anchoring", 60, 4),
      pt("Anchoring", 70, 5), // avg(60,60,60)=60 ⇒ +10 up
    ];
    const r = computeTrend(hist, "Anchoring");
    expect(r.deltaVs3SessionAvg).toBe(10);
    expect(r.trend).toBe("up");
    expect(r.sparkline).toEqual([10, 20, 60, 60, 60, 70]);
  });

  it("isolates per-skill history when other skills are present", () => {
    const hist = [
      pt("Anchoring", 40, 0),
      pt("ESOPs", 90, 0),
      pt("Anchoring", 45, 1),
      pt("ESOPs", 88, 1),
      pt("Anchoring", 55, 2),
      pt("ESOPs", 50, 2),
    ];
    const a = computeTrend(hist, "Anchoring");
    const e = computeTrend(hist, "ESOPs");
    expect(a.latestScore).toBe(55);
    expect(e.latestScore).toBe(50);
    expect(a.sparkline).toEqual([40, 45, 55]);
    expect(e.sparkline).toEqual([90, 88, 50]);
    expect(e.trend).toBe("down");
  });

  it("sorts unordered history by completedAt before deriving", () => {
    const hist = [
      pt("Concessions", 70, 3),
      pt("Concessions", 40, 0),
      pt("Concessions", 50, 1),
      pt("Concessions", 60, 2),
    ];
    const r = computeTrend(hist, "Concessions");
    expect(r.sparkline).toEqual([40, 50, 60, 70]);
    expect(r.deltaVsLast).toBe(10);
  });

  it("handles two-point history (uses 1 prior as the avg baseline)", () => {
    const hist = [pt("Anchoring", 50, 0), pt("Anchoring", 56, 1)];
    const r = computeTrend(hist, "Anchoring");
    expect(r.sparkline).toEqual([50, 56]);
    expect(r.deltaVsLast).toBe(6);
    expect(r.deltaVs3SessionAvg).toBe(6);
    expect(r.trend).toBe("up");
  });
});

describe("computeAllTrends", () => {
  it("returns one trend per unique skill, sorted alphabetically", () => {
    const hist = [
      pt("ESOPs", 50, 0),
      pt("Anchoring", 40, 0),
      pt("Concessions", 60, 0),
      pt("Anchoring", 50, 1),
    ];
    const all = computeAllTrends(hist);
    expect(all.map((tr) => tr.skill)).toEqual(["Anchoring", "Concessions", "ESOPs"]);
  });
});

describe("computeTrendsForSkills", () => {
  it("returns trends only for the named skills, sorted, deduped", () => {
    const hist = [
      pt("Anchoring", 40, 0),
      pt("ESOPs", 50, 0),
      pt("Concessions", 60, 0),
      pt("Anchoring", 50, 1),
    ];
    const out = computeTrendsForSkills(hist, ["ESOPs", "Anchoring", "ESOPs", " "]);
    expect(out.map((tr) => tr.skill)).toEqual(["Anchoring", "ESOPs"]);
  });

  it("yields a zero-baselined trend for a named skill absent from history", () => {
    const out = computeTrendsForSkills([pt("Anchoring", 70, 0)], ["Silence Discipline"]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ skill: "Silence Discipline", latestScore: 0, sparkline: [] });
  });
});

describe("sessionRowsToProgressPoints", () => {
  const row = (
    sessionId: string,
    completedAt: number,
    skillScores: SessionSkillRow["skillScores"],
    sector?: string,
  ): SessionSkillRow => ({ sessionId, completedAt, skillScores, sector });

  it("flattens numeric skill_scores into one point per skill", () => {
    const pts = sessionRowsToProgressPoints([
      row("s1", t0, { Anchoring: 60, ESOPs: 40 }, "razorpay"),
    ]);
    expect(pts).toHaveLength(2);
    expect(pts).toContainEqual({ skill: "Anchoring", scorePct: 60, sessionId: "s1", completedAt: t0, sector: "razorpay" });
    expect(pts).toContainEqual({ skill: "ESOPs", scorePct: 40, sessionId: "s1", completedAt: t0, sector: "razorpay" });
  });

  it("unwraps the legacy { score } wrapper shape", () => {
    const pts = sessionRowsToProgressPoints([row("s1", t0, { Anchoring: { score: 72 } })]);
    expect(pts).toEqual([{ skill: "Anchoring", scorePct: 72, sessionId: "s1", completedAt: t0, sector: undefined }]);
  });

  it("skips rows with null/absent skill_scores or non-finite timestamps", () => {
    expect(sessionRowsToProgressPoints([row("s1", t0, null)])).toEqual([]);
    expect(sessionRowsToProgressPoints([row("s1", t0, undefined)])).toEqual([]);
    expect(sessionRowsToProgressPoints([row("s1", NaN, { Anchoring: 50 })])).toEqual([]);
  });

  it("skips non-finite scores and blank skill names without poisoning the series", () => {
    const pts = sessionRowsToProgressPoints([
      row("s1", t0, { Anchoring: 50, Junk: Number.NaN, "  ": 80 }),
    ]);
    expect(pts).toEqual([{ skill: "Anchoring", scorePct: 50, sessionId: "s1", completedAt: t0, sector: undefined }]);
  });

  it("applies labelFn before grouping so a key humanizes consistently", () => {
    const pts = sessionRowsToProgressPoints(
      [
        row("s1", t0, { concessionStrategy: 40 }),
        row("s2", t0 + DAY, { concessionStrategy: 55 }),
      ],
      humanizeSkillKey,
    );
    expect(pts.map((p) => p.skill)).toEqual(["Concession Strategy", "Concession Strategy"]);
    // Grouping stays consistent → one trend across both sessions.
    const trends = computeAllTrends(pts);
    expect(trends).toHaveLength(1);
    expect(trends[0].skill).toBe("Concession Strategy");
    expect(trends[0].sparkline).toEqual([40, 55]);
  });

  it("end-to-end: derived points feed computeTrendsForSkills into a real up-trend", () => {
    const pts = sessionRowsToProgressPoints([
      row("s1", t0, { Anchoring: 50 }),
      row("s2", t0 + DAY, { Anchoring: 60 }),
      row("s3", t0 + 2 * DAY, { Anchoring: 70 }),
    ]);
    const [trend] = computeTrendsForSkills(pts, ["Anchoring"]);
    expect(trend.sparkline).toEqual([50, 60, 70]);
    expect(trend.trend).toBe("up");
    expect(trend.latestScore).toBe(70);
  });
});

describe("humanizeSkillKey", () => {
  it("maps known negotiation keys to curated labels", () => {
    expect(humanizeSkillKey("anchoring")).toBe("Anchoring");
    expect(humanizeSkillKey("concessionStrategy")).toBe("Concession Strategy");
    expect(humanizeSkillKey("closingTechnique")).toBe("Closing Technique");
    expect(humanizeSkillKey("leverageUse")).toBe("Leverage Use");
  });

  it("falls back to Title Case for unknown camelCase / snake_case keys", () => {
    expect(humanizeSkillKey("riskAppetite")).toBe("Risk Appetite");
    expect(humanizeSkillKey("walk_away_discipline")).toBe("Walk Away Discipline");
    expect(humanizeSkillKey("communication")).toBe("Communication");
  });

  it("returns empty for blank input", () => {
    expect(humanizeSkillKey("   ")).toBe("");
  });
});

describe("createInMemoryProgressStore", () => {
  it("round-trips written points and isolates users", async () => {
    const store = createInMemoryProgressStore();
    await store.write("u1", pt("Anchoring", 50, 0));
    await store.write("u1", pt("Anchoring", 60, 1));
    await store.write("u2", pt("Anchoring", 99, 0));
    const u1 = await store.read("u1");
    const u2 = await store.read("u2");
    expect(u1.length).toBe(2);
    expect(u2.length).toBe(1);
    expect(u2[0].scorePct).toBe(99);
  });
});

/* The ONE no-counter grounding rule, shared by the write seam
 * (save-session) and the cross-session read seam (fetchSkillProgressTrends).
 * A no-counter session's anchor/counter/specificity persisted skill_scores
 * must not render above the same report's grounded Skills Breakdown. */
describe("groundNoCounterSkillScores", () => {
  const inflated = () => ({
    anchoring: 72,
    specificity: 70,
    closingTechnique: 66,
    leverageUse: 80,
    packageThinking: 88,
    composure: 74,
    concessionStrategy: 60,
  });

  it("caps anchor/specificity/counter axes into the weak band when no counter was named", () => {
    const out = groundNoCounterSkillScores(
      { ...inflated(), counterOfferJudgement: 90 },
      null,
    ) as Record<string, number>;
    expect(out.anchoring).toBe(35);
    expect(out.specificity).toBe(35);
    expect(out.counterOfferJudgement).toBe(35);
  });

  it("leaves leverage / package / composure / concession / closing untouched", () => {
    const out = groundNoCounterSkillScores(inflated(), null) as Record<string, number>;
    expect(out.leverageUse).toBe(80);
    expect(out.packageThinking).toBe(88);
    expect(out.composure).toBe(74);
    expect(out.concessionStrategy).toBe(60);
    expect(out.closingTechnique).toBe(66);
  });

  it("does not raise a score already below the ceiling", () => {
    const out = groundNoCounterSkillScores({ anchoring: 20 }, null) as Record<string, number>;
    expect(out.anchoring).toBe(20);
  });

  it("caps the legacy { score } wrapper shape, preserving sibling fields", () => {
    const out = groundNoCounterSkillScores(
      { anchoring: { score: 88, label: "Anchoring" } },
      null,
    ) as Record<string, { score: number; label: string }>;
    expect(out.anchoring.score).toBe(35);
    expect(out.anchoring.label).toBe("Anchoring");
  });

  it("is a no-op once a counter WAS named (numeric ask) — returns the same ref", () => {
    const scores = inflated();
    expect(groundNoCounterSkillScores(scores, 30)).toBe(scores);
  });

  it("is a no-op for null / undefined skillScores", () => {
    expect(groundNoCounterSkillScores(null, null)).toBeNull();
    expect(groundNoCounterSkillScores(undefined, null)).toBeUndefined();
  });

  it("leaves non-numeric anchor garbage untouched rather than coercing", () => {
    const out = groundNoCounterSkillScores(
      { anchoring: "n/a" as unknown as number, specificity: 90 },
      null,
    ) as Record<string, unknown>;
    expect(out.anchoring).toBe("n/a");
    expect(out.specificity).toBe(35);
  });

  it("flows through sessionRowsToProgressPoints so the current session's point is grounded", () => {
    // Mirrors the read-seam usage: ground the viewed row's skill_scores with
    // its authoritative (null) ask before flattening into progress points.
    const grounded = groundNoCounterSkillScores(inflated(), null);
    const points = sessionRowsToProgressPoints(
      [{ sessionId: "cur", completedAt: t0, skillScores: grounded, sector: "Flipkart" }],
      humanizeSkillKey,
    );
    const byLabel = (label: string) => points.find((p) => p.skill === label)?.scorePct;
    expect(byLabel("Anchoring")).toBe(35);
    expect(byLabel("Specificity")).toBe(35);
    expect(byLabel("Leverage Use")).toBe(80);
    expect(byLabel("Package Thinking")).toBe(88);
  });
});

describe("capHistoryToSession — scope trend to the viewed session", () => {
  // Three sessions of the SAME skill, ascending in time. Each session also
  // carries a stable skill (Leverage) that only moved once, early on — the
  // shape that produced the live bug where an OLD report showed the NEWEST
  // session's Leverage number.
  const history: SkillProgressPoint[] = [
    pt("Anchoring", 35, 0, "s-old"),
    pt("Leverage Use", 50, 0, "s-old"),
    pt("Anchoring", 70, 1, "s-mid"),
    pt("Leverage Use", 75, 1, "s-mid"),
    pt("Anchoring", 40, 2, "s-new"),
    pt("Leverage Use", 75, 2, "s-new"),
  ];

  it("ends the trend at the viewed session, not the globally-latest one", () => {
    // Viewing the MIDDLE session: latest Anchoring must be 70 (that session's
    // own value), NOT 40 (the newest session's). Pre-fix this returned 40.
    const scoped = capHistoryToSession(history, "s-mid");
    const anchor = computeAllTrends(scoped).find((t) => t.skill === "Anchoring")!;
    expect(anchor.latestScore).toBe(70);
    expect(anchor.deltaVsLast).toBe(35); // 70 vs the prior s-old 35
  });

  it("drops every point newer than the viewed session", () => {
    const scoped = capHistoryToSession(history, "s-mid");
    expect(scoped.every((p) => p.sessionId !== "s-new")).toBe(true);
    expect(scoped.some((p) => p.sessionId === "s-old")).toBe(true);
  });

  it("is a no-op for the newest session (common case: viewing latest report)", () => {
    const scoped = capHistoryToSession(history, "s-new");
    expect(scoped).toHaveLength(history.length);
  });

  it("returns history unchanged when the viewed session isn't in the window", () => {
    const scoped = capHistoryToSession(history, "s-absent");
    expect(scoped).toBe(history);
  });

  it("keeps ties at the cutoff (points sharing the viewed session's timestamp)", () => {
    // A second skill point at the same completedAt as the viewed session is
    // kept — the cutoff is inclusive so the viewed session's full skill set
    // survives.
    const withTie = [...history, pt("Composure", 80, 1, "s-mid")];
    const scoped = capHistoryToSession(withTie, "s-mid");
    expect(scoped.some((p) => p.skill === "Composure")).toBe(true);
  });
});

/* ── groundGapClosureSkillScores (S44-B13) ─────────────────────────────────
   Write-seam gap-closure cap — persisted skill_scores must match the adapter's
   render-time caps so the Skill Progress panel and Skills Breakdown show the
   same value for the same session. */
describe("groundGapClosureSkillScores", () => {
  const scores = {
    "Anchor strength": 95,
    "Leverage Use": 92,
    "Closing Technique": 88,
    "Concession Strategy": 90,
    "Tactical composure": 85,  // demeanour axis — should NOT be capped
  };

  it("caps outcome-dependent axes at 45 when gap closed <10%", () => {
    // candidate asked 55L, recruiter opened 43L, closed at 43.6L → 5% gap closed
    const out = groundGapClosureSkillScores(scores, "accepted", 55, 43, 43.6);
    expect(out!["Anchor strength"]).toBe(45);
    expect(out!["Leverage Use"]).toBe(45);
    expect(out!["Closing Technique"]).toBe(45);
    expect(out!["Concession Strategy"]).toBe(45);
    expect(out!["Tactical composure"]).toBe(85); // demeanour — untouched
  });

  it("caps at 60 when gap closed 10–29%", () => {
    // candidate 55L, opened 43L, closed at 46L → (46-43)/(55-43)=25%
    const out = groundGapClosureSkillScores(scores, "accepted", 55, 43, 46);
    expect(out!["Anchor strength"]).toBe(60);
    expect(out!["Tactical composure"]).toBe(85);
  });

  it("caps at 75 when gap closed 30–54%", () => {
    // candidate 55L, opened 43L, closed at 48.6L → (48.6-43)/(55-43)≈46.7%
    const out = groundGapClosureSkillScores(scores, "accepted", 55, 43, 48.6);
    expect(out!["Anchor strength"]).toBe(75);
  });

  it("does NOT cap when gap closed ≥55%", () => {
    // candidate 55L, opened 43L, closed at 50L → (50-43)/(55-43)≈58%
    const out = groundGapClosureSkillScores(scores, "accepted", 55, 43, 50);
    expect(out!["Anchor strength"]).toBe(95);
    expect(out!["Leverage Use"]).toBe(92);
  });

  it("passes through on non-accepted outcome", () => {
    const out = groundGapClosureSkillScores(scores, "walked-away", 55, 43, 50);
    expect(out).toBe(scores); // identity — no copy
  });

  it("passes through when candidateAskLpa equals initialOfferLpa (no gap)", () => {
    const out = groundGapClosureSkillScores(scores, "accepted", 43, 43, 45);
    expect(out).toBe(scores);
  });

  it("returns null input unchanged", () => {
    expect(groundGapClosureSkillScores(null, "accepted", 55, 43, 44)).toBeNull();
  });

  it("preserves legacy { score } wrapper shape on capped axes", () => {
    const wrapped = { "Anchor strength": { score: 95, weight: 2 } };
    // 43.6L close on 43→55 spread → 5% gap → ceiling 45
    const out = groundGapClosureSkillScores(wrapped, "accepted", 55, 43, 43.6);
    expect((out!["Anchor strength"] as { score: number }).score).toBe(45);
  });
});
