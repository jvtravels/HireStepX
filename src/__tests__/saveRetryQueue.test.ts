/* Save-retry queue: pure-logic tests for backoff + drain behavior.
   The IndexedDB-backed pieces (open/put/get) aren't unit-tested here;
   they'd require a fake-IndexedDB environment. The pure logic that
   decides "is this record ready to retry?" is the one most likely
   to drift from the spec, so that's where we focus the tests. */

import { describe, it, expect } from "vitest";
import { isReadyForRetry } from "../saveRetryQueue";

const baseRecord = {
  id: "session-x",
  payload: {
    id: "session-x", date: "2026-05-05", type: "behavioral",
    difficulty: "standard", focus: "general", duration: 600,
    score: 70, questions: 5,
  },
  userId: "user-1",
  queuedAt: 0,
  lastError: undefined,
};

describe("isReadyForRetry", () => {
  it("attempts=0 → always ready (never tried)", () => {
    expect(isReadyForRetry({ ...baseRecord, attempts: 0, lastAttemptAt: 0 })).toBe(true);
    expect(isReadyForRetry({ ...baseRecord, attempts: 0, lastAttemptAt: Date.now() })).toBe(true);
  });

  it("attempts >= 5 → never ready (max-out)", () => {
    expect(isReadyForRetry({ ...baseRecord, attempts: 5, lastAttemptAt: 0 })).toBe(false);
    expect(isReadyForRetry({ ...baseRecord, attempts: 99, lastAttemptAt: 0 })).toBe(false);
  });

  it("attempts=1 → ready after 60s (1m backoff)", () => {
    const now = 1_000_000;
    expect(isReadyForRetry({ ...baseRecord, attempts: 1, lastAttemptAt: now - 30_000 }, now)).toBe(false);
    expect(isReadyForRetry({ ...baseRecord, attempts: 1, lastAttemptAt: now - 60_000 }, now)).toBe(true);
    expect(isReadyForRetry({ ...baseRecord, attempts: 1, lastAttemptAt: now - 90_000 }, now)).toBe(true);
  });

  it("attempts=2 → ready after 5m", () => {
    const now = 10_000_000;
    expect(isReadyForRetry({ ...baseRecord, attempts: 2, lastAttemptAt: now - 60_000 }, now)).toBe(false);
    expect(isReadyForRetry({ ...baseRecord, attempts: 2, lastAttemptAt: now - 5 * 60_000 }, now)).toBe(true);
  });

  it("attempts=4 → ready after 3h", () => {
    const now = 100_000_000;
    expect(isReadyForRetry({ ...baseRecord, attempts: 4, lastAttemptAt: now - 60 * 60_000 }, now)).toBe(false); // 1h, not enough
    expect(isReadyForRetry({ ...baseRecord, attempts: 4, lastAttemptAt: now - 3 * 60 * 60_000 }, now)).toBe(true);
  });

  it("backoff window scales monotonically with attempts", () => {
    const now = 1_000_000_000;
    // For each attempt level, the same elapsed time should be ready iff small attempts
    const oneHourElapsed = 60 * 60_000;
    expect(isReadyForRetry({ ...baseRecord, attempts: 1, lastAttemptAt: now - oneHourElapsed }, now)).toBe(true);  // 1m window passed
    expect(isReadyForRetry({ ...baseRecord, attempts: 2, lastAttemptAt: now - oneHourElapsed }, now)).toBe(true);  // 5m window passed
    expect(isReadyForRetry({ ...baseRecord, attempts: 3, lastAttemptAt: now - oneHourElapsed }, now)).toBe(true);  // 30m window passed
    expect(isReadyForRetry({ ...baseRecord, attempts: 4, lastAttemptAt: now - oneHourElapsed }, now)).toBe(false); // 3h window NOT passed
  });
});
