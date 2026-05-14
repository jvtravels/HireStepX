/* Fix 3 (2026-05-15) — Promise-keeping enforcement.
 *
 * Real session: bot said "we can definitely discuss the variable payout
 * structure" three turns in a row and never delivered. extractRecruiter
 * Promises captures the open subject; extractPromisesFulfilled clears it
 * when the next turn delivers substantive (numeric / factual) content. */
import { describe, it, expect } from "vitest";
import {
  extractRecruiterPromises,
  extractPromisesFulfilled,
} from "../../server-handlers/_recruiter-facts";

describe("extractRecruiterPromises", () => {
  it("captures 'we can discuss X' promises", () => {
    const p = extractRecruiterPromises(
      "Yes, we can definitely discuss the variable payout structure later.",
    );
    expect(p.length).toBeGreaterThan(0);
    expect(p[0]).toMatch(/variable payout/i);
  });

  it("captures 'let me share Y' promises", () => {
    const p = extractRecruiterPromises("Let me share the vesting schedule.");
    expect(p[0]).toMatch(/vesting schedule/i);
  });

  it("captures 'we'll share Z' promises", () => {
    const p = extractRecruiterPromises("We'll share the full breakdown shortly.");
    expect(p.length).toBeGreaterThan(0);
  });

  it("captures multiple distinct promises in one reply", () => {
    const p = extractRecruiterPromises(
      "We can discuss the variable structure. Let me share the cliff period.",
    );
    expect(p.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty array for plain confirmation without a promise", () => {
    const p = extractRecruiterPromises("Yes, that sounds reasonable.");
    expect(p).toEqual([]);
  });

  it("returns empty array for null / empty input", () => {
    expect(extractRecruiterPromises(null)).toEqual([]);
    expect(extractRecruiterPromises("")).toEqual([]);
    expect(extractRecruiterPromises(undefined)).toEqual([]);
  });

  it("deduplicates identical subjects", () => {
    const p = extractRecruiterPromises(
      "We can discuss the variable payout. Let me share the variable payout.",
    );
    const subjects = p.filter((s) => s.includes("variable payout"));
    expect(subjects.length).toBeLessThanOrEqual(2);
  });
});

describe("extractPromisesFulfilled", () => {
  it("marks a promise fulfilled when reply contains a number + topic", () => {
    const fulfilled = extractPromisesFulfilled(
      ["variable payout structure"],
      "The variable payout is 30% of base, paid quarterly against OKR attainment.",
    );
    expect(fulfilled.length).toBe(1);
  });

  it("does NOT mark fulfilled when reply re-promises without delivering", () => {
    const fulfilled = extractPromisesFulfilled(
      ["variable payout structure"],
      "Sure, we can discuss the variable payout structure when we close.",
    );
    /* The reply contains the topic but no substantive content (no
     * digit / percent / monthly-cadence token). Should NOT fulfil. */
    expect(fulfilled.length).toBe(0);
  });

  it("does not match an unrelated reply", () => {
    const fulfilled = extractPromisesFulfilled(
      ["vesting cliff"],
      "We work in a hybrid model with 3 days in office.",
    );
    expect(fulfilled.length).toBe(0);
  });

  it("returns empty when no pending promises", () => {
    expect(extractPromisesFulfilled([], "Anything here.")).toEqual([]);
    expect(extractPromisesFulfilled(null, "Anything here.")).toEqual([]);
  });

  it("returns empty when reply is empty", () => {
    expect(extractPromisesFulfilled(["x"], "")).toEqual([]);
    expect(extractPromisesFulfilled(["x"], null)).toEqual([]);
  });

  it("counts ₹ amounts as substantive content", () => {
    const fulfilled = extractPromisesFulfilled(
      ["variable payout structure"],
      "The variable payout is ₹4L per year, paid quarterly.",
    );
    expect(fulfilled.length).toBe(1);
  });
});
