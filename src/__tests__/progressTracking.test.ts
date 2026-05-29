/* Tests for the cross-session skill-progress derivation logic.
 *
 * The trend math is the user-visible signal — "am I improving on ESOPs?"
 * — so the boundary cases (single-point, empty, exact ±3 thresholds,
 * mid-stream regression, multi-skill isolation) all get a dedicated test
 * rather than a single happy-path. */

import { describe, expect, it } from "vitest";
import {
  computeAllTrends,
  computeTrend,
  createInMemoryProgressStore,
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
