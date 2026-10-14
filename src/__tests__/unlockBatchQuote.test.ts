import { describe, it, expect } from "vitest";
import { rankVisibleMatches, nextUnlockBatchQuote } from "../../server-handlers/_employer-matching-helpers";
import { formatPaise } from "../../server-handlers/_unlock-pricing";

const m = (id: string, cand: string, score: number, unlocked = false) => ({
  id, candidate_user_id: cand, match_score: score, unlocked,
  candidate_status: "shortlisted", candidate_status_note: null, interview_scheduled_at: null,
});

describe("rankVisibleMatches", () => {
  it("drops blocked, locked opted-out and no-evidence rows, keeps unlocked opted-out", () => {
    const rows = [m("a", "c1", 90), m("b", "c2", 80), m("c", "c3", 70), m("d", "c4", 60, true), m("e", "c5", 50)];
    const out = rankVisibleMatches(rows, {
      blocked: new Set(["c1"]),
      optedOut: new Set(["c3", "c4"]),
      evidence: new Map([["c2", true], ["c3", true], ["c4", false], ["c5", false]]),
    });
    expect(out.map((r) => r.id)).toEqual(["b", "d"]);
  });

  it("orders by score desc then id asc", () => {
    const out = rankVisibleMatches([m("b", "c2", 80), m("a", "c1", 80), m("c", "c3", 95)], {
      blocked: new Set(), optedOut: new Set(), evidence: new Map([["c1", true], ["c2", true], ["c3", true]]),
    });
    expect(out.map((r) => r.id)).toEqual(["c", "a", "b"]);
  });
});

describe("nextUnlockBatchQuote", () => {
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: `m${i}`, unlocked: i < 10 || i === 12 }));

  it("skips fully unlocked windows and prices only locked rows", () => {
    const q = nextUnlockBatchQuote(rows)!;
    expect(q.start).toBe(11);
    expect(q.end).toBe(20);
    expect(q.count).toBe(9);
    expect(q.matchIds).not.toContain("m12");
    expect(q.amountPaise).toBe(9 * 2990);
  });

  it("reports locked rows across the whole shortlist, not just the window", () => {
    const q = nextUnlockBatchQuote(rows)!;
    expect(q.count).toBe(9);
    expect(q.lockedRemaining).toBe(12);
  });

  it("charges the flat batch price for a full window", () => {
    const q = nextUnlockBatchQuote(Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, unlocked: false })))!;
    expect(q.amountPaise).toBe(29_900);
  });

  it("returns null when everything is unlocked", () => {
    expect(nextUnlockBatchQuote([{ id: "a", unlocked: true }])).toBeNull();
  });
});

describe("formatPaise", () => {
  it("shows paise only when present", () => {
    expect(formatPaise(29_900)).toBe("₹299");
    expect(formatPaise(2_990)).toBe("₹29.90");
    expect(formatPaise(5_900)).toBe("₹59");
  });
});
