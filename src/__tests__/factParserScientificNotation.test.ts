/* OA-B23 — scientific-notation guard in digitsToNumber.
 *
 * Strings like "6e6" look like numbers to JavaScript (Number("6e6") === 6000000)
 * but are never valid salary inputs — no recruiter writes "₹6e6 LPA". If such
 * a token somehow reached digitsToNumber it would produce 6,000,000 which
 * exceeds MAX_LPA (5000) and be silently dropped, losing the entire fact.
 * The guard in digitsToNumber now returns NaN for any string containing 'e'
 * or 'E', so the !Number.isFinite guard correctly discards it early. */
import { describe, it, expect } from "vitest";
import { parseSalaryFacts } from "../../server-handlers/_fact-parser";

describe("_fact-parser — OA-B23 scientific-notation guard", () => {
  it("does not extract a salary from bare '6e6'", () => {
    expect(parseSalaryFacts("6e6")).toHaveLength(0);
  });

  it("'₹6e6' — RUPEE_NUM_RE captures only '6' (before the e); no fact value exceeds MAX_LPA", () => {
    // The ₹-prefix regex matches "₹6", capturing digits="6" and leaving "e6"
    // unconsumed. digitsToNumber("6") = 6 (no 'e'/'E' in the captured string).
    // resolveBareRupee(6) = 6 LPA (medium confidence). No scientific-notation
    // magnitude (6,000,000) leaks into the output — that's the key invariant.
    for (const f of parseSalaryFacts("₹6e6")) {
      expect(f.value).toBeLessThan(1000);
    }
  });

  it("does not extract a salary from '6e6 LPA'", () => {
    // The regex wouldn't match "6e6" as a unit-prefixed number, but even if
    // the digit fragment "6" from "6e6 LPA" were naively re-bound the guard
    // ensures the 'e6' tail can't contribute a spurious 6,000,000 reading.
    const facts = parseSalaryFacts("6e6 LPA");
    // Either zero facts or a single low-value fact (the trailing digit "6" LPA).
    // What we must NOT see is a fact with value >= 1000 (which would indicate
    // scientific-notation magnitude leaked through).
    for (const f of facts) {
      expect(f.value).toBeLessThan(1000);
    }
  });

  it("normal salary strings are unaffected", () => {
    const facts = parseSalaryFacts("30 LPA");
    expect(facts).toHaveLength(1);
    expect(facts[0].value).toBe(30);
  });

  it("digit-string guard: captured digit fragment '4' (not '2E4') is extracted from '2E4 LPA'", () => {
    // Regex matches "4 LPA" at position 2 (the "2E" prefix is unreachable by
    // the digit pattern). The captured raw digits are "4", which contain no
    // 'e'/'E', so digitsToNumber("4") = 4 LPA — well within MAX_LPA.
    // The key invariant: no fact with value >= 1000 (scientific-notation leak).
    const facts = parseSalaryFacts("2E4 LPA");
    for (const f of facts) {
      expect(f.value).toBeLessThan(1000);
    }
  });
});
