/* Streak milestone reward helpers.
   Called from save-session.ts after practice_timestamps is updated.
   Returns the number of bonus session credits to grant (0 or 1). */

const MILESTONES = [7, 14, 30] as const;
type Milestone = (typeof MILESTONES)[number];

export function computeStreakReward(
  prevTimestamps: string[],
  _newTimestamp: string
): number {
  const next = prevTimestamps.length + 1;
  return (MILESTONES as readonly number[]).includes(next) ? 1 : 0;
}

export function getMilestoneHit(streakLength: number): Milestone | null {
  return (MILESTONES as readonly number[]).includes(streakLength)
    ? (streakLength as Milestone)
    : null;
}
