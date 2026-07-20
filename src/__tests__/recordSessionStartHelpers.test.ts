/* OA-B50: cross-device concurrent session detection.
 *
 * BroadcastChannel only guards same-browser tabs. A user running a session
 * on mobile AND desktop simultaneously consumes double quota with no warning.
 * The server-side guard in record-session-start compares recently-started IDs
 * against the sessions table: any started ID not yet saved = in-flight on
 * another device. detectConcurrentSession() is the pure logic for that check.
 */
import { describe, it, expect } from "vitest";
import { detectConcurrentSession } from "../../server-handlers/_record-session-start-helpers";

const A = "session-aaa";
const B = "session-bbb";
const C = "session-ccc";

describe("detectConcurrentSession — OA-B50 cross-device guard", () => {
  it("returns false when no prior starts exist", () => {
    expect(detectConcurrentSession({
      existingStarts: [],
      currentSessionId: A,
      savedSessionIds: new Set(),
    })).toBe(false);
  });

  it("returns false when all prior starts are already saved", () => {
    expect(detectConcurrentSession({
      existingStarts: [B, C],
      currentSessionId: A,
      savedSessionIds: new Set([B, C]),
    })).toBe(false);
  });

  it("OA-B50: returns true when a prior start is not yet saved (in-flight session)", () => {
    // B was started but not yet saved — device 2 running in parallel
    expect(detectConcurrentSession({
      existingStarts: [B],
      currentSessionId: A,
      savedSessionIds: new Set(),
    })).toBe(true);
  });

  it("OA-B50: mixed — some saved, one in-flight → still true", () => {
    expect(detectConcurrentSession({
      existingStarts: [C, B],
      currentSessionId: A,
      savedSessionIds: new Set([C]),
    })).toBe(true);
  });

  it("excludes the current sessionId from the in-flight check", () => {
    // A is being started right now; it won't be in savedSessionIds yet.
    // The check must not flag A itself as an in-flight session.
    expect(detectConcurrentSession({
      existingStarts: [A],
      currentSessionId: A,
      savedSessionIds: new Set(),
    })).toBe(false);
  });

  it("respects the lookback window — IDs beyond lookback are ignored", () => {
    // existingStarts has 6 items, all unsaved, but lookback=5 so only last 5 checked.
    // The 6th-oldest is ignored. With lookback=5 all 5 in the window are unsaved → true.
    const starts = ["old-1", "old-2", B, C, "session-d", "session-e"];
    expect(detectConcurrentSession({
      existingStarts: starts,
      currentSessionId: A,
      savedSessionIds: new Set(["old-1", "old-2"]),
      lookback: 5,
    })).toBe(true); // B/C/d/e are in-flight
  });

  it("with lookback=5 only the 5 most-recent prior starts are checked", () => {
    // last 5: [B, C, d, e, f] — all saved; the only unsaved one is older (old-1)
    const starts = ["old-1", B, C, "d", "e", "f"];
    expect(detectConcurrentSession({
      existingStarts: starts,
      currentSessionId: A,
      savedSessionIds: new Set([B, C, "d", "e", "f"]),
      lookback: 5,
    })).toBe(false);
  });

  it("returns false when existingStarts only contains the current sessionId", () => {
    expect(detectConcurrentSession({
      existingStarts: [A],
      currentSessionId: A,
      savedSessionIds: new Set(),
    })).toBe(false);
  });
});
