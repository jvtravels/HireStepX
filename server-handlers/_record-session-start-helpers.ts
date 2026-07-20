/* Pure helpers for record-session-start, extracted for unit-testability.
 * OA-B50: BroadcastChannel only guards same-browser tabs. Cross-device
 * concurrent sessions (mobile + desktop) cannot be detected client-side.
 * The server-side guard compares recently-started session IDs against the
 * sessions table — any started ID not yet saved = an in-flight session on
 * another device. */

export interface ConcurrentSessionInput {
  /** All session IDs recorded as started for this user, in order. */
  existingStarts: string[];
  /** The session ID being started now (excluded from the in-flight check). */
  currentSessionId: string;
  /** IDs from existingStarts that are already present in the sessions table. */
  savedSessionIds: ReadonlySet<string>;
  /** How many of the most-recent existing starts to check (default: 5). */
  lookback?: number;
}

/**
 * Returns true when at least one recently-started session is not yet saved —
 * indicating an in-flight session on another device/browser.
 *
 * Rationale: `existingStarts` holds the last N session IDs written by
 * record-session-start. `savedSessionIds` is the set of IDs already present
 * in the `sessions` table (written by save-session at completion). Any ID in
 * existingStarts that is NOT in savedSessionIds is still in-flight. We only
 * look at the last `lookback` entries to avoid false positives from old
 * abandoned sessions that fell off the save queue.
 */
export function detectConcurrentSession(input: ConcurrentSessionInput): boolean {
  const { existingStarts, currentSessionId, savedSessionIds, lookback = 5 } = input;
  const recent = existingStarts
    .filter(id => id !== currentSessionId)
    .slice(-lookback);
  return recent.some(id => !savedSessionIds.has(id));
}
