/* Session Report — cross-session negotiation skill progress.
 *
 * Pure storage + derivation logic so the user can see whether they're
 * improving on ESOPs, Anchoring, etc. across sessions. Today every
 * report is standalone; this module is the seam for that.
 *
 * Design note on persistence
 * ─────────────────────────────
 * There is no Convex in this project (no `convex/**`). Existing
 * persistence is split between Supabase (server, see `src/supabase.ts`)
 * and localStorage (client, see `src/DashboardContext.tsx`, etc.).
 *
 * Rather than commit to either here — wiring a Convex / Supabase
 * mutation without product sign-off is risky — the storage layer is
 * declared as an injected `ProgressStore` interface. A future caller
 * can supply a Convex-backed, Supabase-backed, localStorage-backed,
 * or in-memory implementation without this module changing.
 *
 * If/when Convex lands, the rough schema would be:
 *   negotiationProgress: {
 *     userId: Id<"users">,
 *     skill: string,            // SkillName
 *     scorePct: number,         // 0..100
 *     sessionId: Id<"sessions">,
 *     completedAt: number,      // epoch ms
 *     sector?: string,          // e.g. "fintech", "saas"
 *   }
 * indexed on (userId, skill, completedAt).
 * Not implemented here — left to product sign-off.
 */

export type SkillName = string;

export interface SkillProgressPoint {
  skill: SkillName;
  scorePct: number;
  sessionId: string;
  completedAt: number;
  sector?: string;
}

export interface SkillTrend {
  skill: SkillName;
  latestScore: number;
  /** latest minus the immediately prior session for this skill. 0 if only
   *  one point exists. */
  deltaVsLast: number;
  /** latest minus the avg of the prior 3 sessions for this skill (the
   *  3 right before `latest`, so up to 4 points are consulted total).
   *  0 if no prior history. */
  deltaVs3SessionAvg: number;
  /** 'up' if latestScore exceeds the 3-session avg by ≥3 points, 'down'
   *  if it's below by ≥3, otherwise 'flat'. Single-point histories are
   *  'flat' since there is no baseline to compare against. */
  trend: "up" | "flat" | "down";
  /** Score sequence oldest → newest for sparkline rendering. Always
   *  includes the latest. */
  sparkline: number[];
}

export interface ProgressStore {
  read(userId: string): Promise<SkillProgressPoint[]>;
  write(userId: string, point: SkillProgressPoint): Promise<void>;
}

/* In-memory ProgressStore — useful for tests + canvas storybook.
 * Production callers would inject a Convex / Supabase / localStorage
 * implementation that satisfies the same interface. */
export function createInMemoryProgressStore(): ProgressStore {
  const byUser = new Map<string, SkillProgressPoint[]>();
  return {
    async read(userId) {
      return [...(byUser.get(userId) ?? [])];
    },
    async write(userId, point) {
      const arr = byUser.get(userId) ?? [];
      arr.push(point);
      byUser.set(userId, arr);
    },
  };
}

/* Pure trend computation. History order is irrelevant — sorted by
 * completedAt ascending here. Returns a zero-baselined SkillTrend even
 * for skills not present in history (so call sites can render an empty
 * tile rather than special-casing). */
export function computeTrend(
  history: SkillProgressPoint[],
  skill: SkillName,
): SkillTrend {
  const points = history
    .filter((p) => p.skill === skill)
    .slice()
    .sort((a, b) => a.completedAt - b.completedAt);

  if (points.length === 0) {
    return {
      skill,
      latestScore: 0,
      deltaVsLast: 0,
      deltaVs3SessionAvg: 0,
      trend: "flat",
      sparkline: [],
    };
  }

  const sparkline = points.map((p) => p.scorePct);
  const latestScore = sparkline[sparkline.length - 1];

  if (points.length === 1) {
    return {
      skill,
      latestScore,
      deltaVsLast: 0,
      deltaVs3SessionAvg: 0,
      trend: "flat",
      sparkline,
    };
  }

  const prior = sparkline.slice(0, -1);
  const deltaVsLast = latestScore - prior[prior.length - 1];

  const last3 = prior.slice(-3);
  const avg3 = last3.reduce((s, n) => s + n, 0) / last3.length;
  const deltaVs3SessionAvg = latestScore - avg3;

  let trend: "up" | "flat" | "down";
  if (deltaVs3SessionAvg >= 3) trend = "up";
  else if (deltaVs3SessionAvg <= -3) trend = "down";
  else trend = "flat";

  return {
    skill,
    latestScore,
    deltaVsLast,
    deltaVs3SessionAvg,
    trend,
    sparkline,
  };
}

/* Convenience: compute trends for every unique skill present in
 * `history`. Order: alphabetical by skill name for stable rendering. */
export function computeAllTrends(history: SkillProgressPoint[]): SkillTrend[] {
  const skills = Array.from(new Set(history.map((p) => p.skill))).sort();
  return skills.map((s) => computeTrend(history, s));
}
