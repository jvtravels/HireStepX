/* 2026-05-29 realism-pass — per-session deterministic jitter.
 *
 * Why this exists: the reactive-followup rules use hard thresholds
 * (>25% variable share → probe comfort; >30% hike → probe justification).
 * A hard threshold reads as a switch: a candidate at 25.1% variable
 * always gets probed; a candidate at 24.9% never does. Real recruiters
 * have a soft band — some fire at 23%, some at 27% — based on the
 * recruiter, the day, the role.
 *
 * `sessionJitter` produces a deterministic ±range offset keyed by
 * sessionId + salt. Properties:
 *   1. Same session → same jitter across turns (a candidate doesn't
 *      get probed on turn 3 and not on turn 5 because the threshold
 *      "moved").
 *   2. Different sessions → independently jittered (sessionA fires at
 *      23%, sessionB at 27%).
 *   3. Different salts → independent jitter per axis (the hike jitter
 *      and variable jitter shouldn't co-vary; a session unlucky on one
 *      shouldn't be unlucky on both).
 *
 * Pure. No state, no IO. */

/* Tiny FNV-1a — same shape as `_candidate-question.ts`'s hashSeed.
 * Duplicated rather than re-exported because the dependency would point
 * the wrong way (planner-util depending on response-bank). */
function fnv1a(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Returns a deterministic value in `[-range, +range]` from the session
 * + salt. Same (sessionId, salt) → same jitter every time.
 *
 * Use a distinct salt per threshold axis (e.g. `"hike"`, `"variable"`)
 * so jitter on one doesn't co-vary with jitter on another.
 */
export function sessionJitter(
  sessionId: string | null | undefined,
  salt: string,
  range: number,
): number {
  /* Null / empty sessionId → no jitter. Snapshot tests + unit tests
   * that don't carry a session pass null and get the canonical threshold. */
  if (!sessionId) return 0;
  const h = fnv1a(`${sessionId}|${salt}`);
  /* Map [0, 2^32-1] to [-1, 1], then scale to [-range, range]. */
  const norm = (h / 0xffffffff) * 2 - 1;
  return norm * range;
}
