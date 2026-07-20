/* OA-B18: practice_timestamps idempotency guard.
 *
 * Two browser tabs submitting the same session simultaneously would
 * both read the same profile state and both attempt to append a
 * timestamp. The started_session_ids guard prevents this: if the
 * session ID is already present (written by /api/record-session-start
 * at page-load), alreadyCounted=true → no append → idempotent for
 * concurrent tabs.
 *
 * Extracted to _save-session-helpers.ts for unit-testability since
 * save-session.ts is an Edge Function that can't be directly instantiated.
 */
import { describe, it, expect } from "vitest";
import { computePracticeTimestamps } from "../../server-handlers/_save-session-helpers";

const T1 = "2026-01-01T00:00:00.000Z";
const T2 = "2026-01-02T00:00:00.000Z";
const T3 = "2026-01-03T00:00:00.000Z";
const SESSION_A = "session-aaa";
const SESSION_B = "session-bbb";

describe("computePracticeTimestamps — OA-B18 idempotency guard", () => {
  it("normal first save: appends a timestamp when session not in startedIds (legacy path)", () => {
    const result = computePracticeTimestamps({
      existing: [T1],
      startedIds: [],
      sessionId: SESSION_A,
      questionsAnswered: true,
      nowIso: T2,
    });
    expect(result.next).toEqual([T1, T2]);
    expect(result.alreadyCounted).toBe(false);
    expect(result.isGhostSession).toBe(false);
    expect(result.refundedStartedIds).toBeNull();
  });

  it("already counted (record-session-start path): does NOT append", () => {
    const result = computePracticeTimestamps({
      existing: [T1, T2],
      startedIds: [SESSION_A],
      sessionId: SESSION_A,
      questionsAnswered: true,
      nowIso: T3,
    });
    expect(result.next).toEqual([T1, T2]);
    expect(result.alreadyCounted).toBe(true);
    expect(result.isGhostSession).toBe(false);
    expect(result.refundedStartedIds).toBeNull();
  });

  it("OA-B18: concurrent second tab sees alreadyCounted=true → no append (idempotent)", () => {
    // Simulate: both Tab A and Tab B call save-session simultaneously.
    // Both read the same profile: startedIds includes SESSION_A (from record-session-start).
    // Both should compute the same result: no new timestamp appended.
    const input = {
      existing: [T1],
      startedIds: [SESSION_A],
      sessionId: SESSION_A,
      questionsAnswered: true,
      nowIso: T2,
    };
    const tabA = computePracticeTimestamps(input);
    const tabB = computePracticeTimestamps({ ...input, nowIso: T3 });
    expect(tabA.next).toEqual([T1]);
    expect(tabB.next).toEqual([T1]);
  });

  it("ghost session (alreadyCounted && 0 questions): refunds the start-time timestamp", () => {
    const result = computePracticeTimestamps({
      existing: [T1, T2],
      startedIds: [SESSION_A],
      sessionId: SESSION_A,
      questionsAnswered: false,
      nowIso: T3,
    });
    expect(result.isGhostSession).toBe(true);
    expect(result.next).toEqual([T1]);
    expect(result.refundedStartedIds).toEqual([]);
  });

  it("ghost session refund only removes THIS session from startedIds", () => {
    const result = computePracticeTimestamps({
      existing: [T1, T2],
      startedIds: [SESSION_B, SESSION_A],
      sessionId: SESSION_A,
      questionsAnswered: false,
      nowIso: T3,
    });
    expect(result.refundedStartedIds).toEqual([SESSION_B]);
  });

  it("ghost session with empty timestamps: result stays empty (no underflow)", () => {
    const result = computePracticeTimestamps({
      existing: [],
      startedIds: [SESSION_A],
      sessionId: SESSION_A,
      questionsAnswered: false,
      nowIso: T3,
    });
    expect(result.next).toEqual([]);
  });

  it("unrelated startedIds do not trigger alreadyCounted", () => {
    const result = computePracticeTimestamps({
      existing: [T1],
      startedIds: [SESSION_B],
      sessionId: SESSION_A,
      questionsAnswered: true,
      nowIso: T2,
    });
    expect(result.alreadyCounted).toBe(false);
    expect(result.next).toEqual([T1, T2]);
  });

  it("caps practice_timestamps at 500 entries on legacy first-save path", () => {
    const big = Array.from({ length: 500 }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`);
    const result = computePracticeTimestamps({
      existing: big,
      startedIds: [],
      sessionId: SESSION_A,
      questionsAnswered: true,
      nowIso: T3,
    });
    expect(result.next).toHaveLength(500);
    expect(result.next[499]).toBe(T3);
  });
});
