/* Pure helpers extracted from save-session.ts for unit-testability.
 * OA-B18: the practice_timestamps append is a read-modify-write that
 * is NOT safe under concurrent two-tab saves for the same session.
 * The guard is: if the session is already present in started_session_ids
 * (written by /api/record-session-start at page-load), treat it as
 * already counted and skip the append. Two tabs submitting the same
 * session both see alreadyCounted=true → neither appends → idempotent. */

export interface PracticeTimestampsInput {
  existing: string[];
  startedIds: string[];
  sessionId: string;
  questionsAnswered: boolean;
  nowIso: string;
}

export interface PracticeTimestampsResult {
  next: string[];
  refundedStartedIds: string[] | null;
  alreadyCounted: boolean;
  isGhostSession: boolean;
}

/**
 * Compute the new practice_timestamps array and whether to refund started_session_ids.
 *
 * Three cases:
 * 1. Ghost session (alreadyCounted && !questionsAnswered) — user opened /interview
 *    and immediately closed without answering anything. Refund: pop the last
 *    timestamp that record-session-start added and remove the ID from startedIds.
 * 2. Already counted (alreadyCounted && questionsAnswered) — normal session that
 *    went through record-session-start. Skip append (idempotent for concurrent tabs).
 * 3. Legacy / first-time (not in startedIds) — session predates record-session-start.
 *    Append once; cap at 500 entries.
 */
export function computePracticeTimestamps(input: PracticeTimestampsInput): PracticeTimestampsResult {
  const { existing, startedIds, sessionId, questionsAnswered, nowIso } = input;
  const alreadyCounted = startedIds.includes(sessionId);
  const isGhostSession = alreadyCounted && !questionsAnswered;

  let next: string[];
  let refundedStartedIds: string[] | null = null;

  if (isGhostSession) {
    next = existing.length > 0 ? existing.slice(0, -1) : existing;
    refundedStartedIds = startedIds.filter(id => id !== sessionId);
  } else {
    next = alreadyCounted ? existing : [...existing, nowIso].slice(-500);
  }

  return { next, refundedStartedIds, alreadyCounted, isGhostSession };
}
