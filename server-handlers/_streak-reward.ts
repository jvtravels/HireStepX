/* Streak milestone reward helpers.
   Called from save-session.ts after practice_timestamps is updated.
   Returns the number of bonus session credits to grant (0 or 1). */

const MILESTONES = [7, 14, 30] as const;
type Milestone = (typeof MILESTONES)[number];

// Users are ~all IST (UTC+5:30) — bucket by IST calendar day, not the raw
// UTC date, so a late-evening IST session lands on the day it was actually
// practiced. Mirrors src/dashboardData.ts's toISTDateString.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
function toISTDateString(iso: string): string {
  return new Date(new Date(iso).getTime() + IST_OFFSET_MS).toISOString().split("T")[0];
}

/** Consecutive-day streak (IST calendar days) ending at the most recent of
    `timestamps` — the same definition as src/dashboardData.ts's computeStreak,
    so the reward and the UI-displayed streak never disagree. Previously this
    milestone check fired on lifetime session COUNT (prevTimestamps.length + 1),
    so 7 sessions scattered across months triggered a "7-day streak" reward. */
function computeCurrentStreakDays(timestamps: string[]): number {
  const days = Array.from(new Set(timestamps.map(toISTDateString))).sort().reverse();
  if (days.length === 0) return 0;

  let streak = 1;
  let cursor = new Date(`${days[0]}T00:00:00Z`).getTime();
  for (let i = 1; i < days.length; i++) {
    cursor -= 24 * 60 * 60 * 1000;
    if (days[i] !== new Date(cursor).toISOString().split("T")[0]) break;
    streak++;
  }
  return streak;
}

export function computeStreakReward(
  prevTimestamps: string[],
  newTimestamp: string
): number {
  const streak = computeCurrentStreakDays([...prevTimestamps, newTimestamp]);
  return getMilestoneHit(streak) !== null ? 1 : 0;
}

export function getMilestoneHit(streakLength: number): Milestone | null {
  return (MILESTONES as readonly number[]).includes(streakLength)
    ? (streakLength as Milestone)
    : null;
}
