/* Below this, a "N+ interviews practiced" line reads as an admission of a tiny
   base rather than social proof, so the UI shows nothing instead. */
export const MIN_PUBLIC_SESSION_COUNT = 100;

/** A session only counts as "completed" once the user answered this many
    questions (the same bar the referral payout uses). */
export const COMPLETED_SESSION_MIN_QUESTIONS = 3;

/** Floor a real count to the nearest 10 for display ("120+"). Returns null
    when the number is too small to show — never inflates it. */
export function displaySessionCount(n: number): number | null {
  if (!Number.isFinite(n) || n < MIN_PUBLIC_SESSION_COUNT) return null;
  return Math.floor(n / 10) * 10;
}
